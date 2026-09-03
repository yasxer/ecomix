"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Columns2,
  Frown,
  ImageIcon,
  Images,
  LayoutGrid,
  LayoutList,
  LayoutTemplate,
  Loader2,
  Megaphone,
  MessageCircleQuestion,
  Moon,
  MousePointerClick,
  PackageOpen,
  PanelTop,
  Plus,
  Presentation,
  Save,
  Sparkles,
  Star,
  Sun,
  Tag,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  createLandingUploadUrl,
  discardLandingImage,
  generateLanding,
  generateSectionImage,
  updateLanding,
  type LandingFormState,
} from "@/app/actions/landing";
import { inputClass } from "../../../ui";
import { MAX_SOURCE_SIZE, prepareImage } from "@/lib/prepare-image";
import { mapLimit, putToSignedUrl } from "@/lib/upload-client";
import {
  LANDING_LANGUAGES,
  type ImageBrief,
  type LandingBlock,
  type LandingBlockType,
  type LandingLanguage,
  type LandingMode,
  type LandingTheme,
  type Product,
} from "@/lib/types";
import {
  BlockEditor,
  imageOf,
  newDraft,
  toBlocks,
  toDrafts,
  withImage,
  type Draft,
  type ImageDraft,
  type ImageState,
} from "./block-editors";
import { BlockIcon } from "@/app/components/landing-icon";

/** Conversions menées de front. Le canvas travaille sur le thread principal. */
const CONVERT_CONCURRENCY = 3;

/** Doit rester aligné sur `SINGLETONS` dans `app/actions/landing.ts`. */
const SINGLETONS: LandingBlockType[] = ["hero", "gallery", "description", "form"];

type Palette = {
  type: LandingBlockType;
  label: string;
  hint: string;
  icon: typeof Tag;
};

/**
 * Ce que l'administrateur peut ajouter. Volontairement court : une landing se
 * lit comme une suite d'affiches suivie du bon de commande. Les anciens blocs
 * de texte (description, problème, atouts, avant/après, avis) ne sont plus
 * proposés — leur contenu appartient désormais aux affiches. Leur rendu reste
 * en place pour les pages déjà enregistrées.
 */
const PALETTE: Palette[] = [
  { type: "showcase", label: "Affiche", hint: "Un visuel et son texte, gravé dedans ou posé dessus", icon: Presentation },
  { type: "image", label: "Image section", hint: "Un visuel pleine largeur, sans texte", icon: ImageIcon },
  { type: "hero", label: "Titre + prix", hint: "Nom, prix, remise et bouton Commander", icon: Tag },
  { type: "faq", label: "Questions fréquentes", hint: "Accordéon des objections de livraison", icon: MessageCircleQuestion },
  { type: "cta", label: "Relance", hint: "Titre, argument et bouton vers le formulaire", icon: Megaphone },
  { type: "form", label: "Formulaire", hint: "Offres groupées + commande — obligatoire", icon: ClipboardList },
];

/** Blocs encore rendus, mais qu'on n'ajoute plus : ils gardent leur étiquette. */
const LEGACY: Palette[] = [
  { type: "gallery", label: "Galerie produit", hint: "Les photos de la page Produit", icon: Images },
  { type: "description", label: "Description", hint: "Texte et points forts du produit", icon: LayoutList },
  { type: "text", label: "Texte", hint: "Titre et paragraphe libres", icon: AlignLeft },
  { type: "problem", label: "Le problème", hint: "Ce que vivent vos clients aujourd'hui", icon: Frown },
  { type: "features", label: "Grille d'atouts", hint: "Icône, libellé et précision", icon: LayoutGrid },
  { type: "compare", label: "Avant / après", hint: "Deux colonnes opposées", icon: Columns2 },
  { type: "reviews", label: "Avis clients", hint: "Témoignages notés", icon: Star },
];

const PALETTE_BY_TYPE = Object.fromEntries(
  [...PALETTE, ...LEGACY].map((p) => [p.type, p])
) as Record<LandingBlockType, Palette>;

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

export function LandingBuilder({
  mode: initialMode,
  blocks,
  theme: initialTheme,
  stickyCta: initialStickyCta,
  stickyHeader: initialStickyHeader,
  product,
  storeName,
  logoUrl,
  primaryColor,
}: {
  mode: LandingMode;
  blocks: LandingBlock[];
  theme: LandingTheme;
  stickyCta: boolean;
  stickyHeader: boolean;
  product: Product;
  storeName: string;
  logoUrl: string | null;
  primaryColor: string;
}) {
  const [state, action, pending] = useActionState<LandingFormState, FormData>(
    updateLanding,
    {}
  );
  /**
   * Volet affiché. « ia » n'est pas un mode enregistré : la génération produit
   * des blocs, donc elle retombe toujours sur la page personnalisée. Un
   * troisième mode en base voudrait dire un troisième rendu à maintenir, pour
   * exactement le même résultat.
   */
  const [pane, setPane] = useState<"simple" | "custom" | "ia">(initialMode);
  const mode: LandingMode = pane === "simple" ? "simple" : "custom";
  const [language, setLanguage] = useState<LandingLanguage>("ar");
  const [hint, setHint] = useState("");
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();
  /** Avancement de la file des visuels : `null` quand il n'y a rien à composer. */
  const [imaging, setImaging] = useState<{ done: number; total: number } | null>(null);
  const [theme, setTheme] = useState<LandingTheme>(initialTheme);
  const [stickyCta, setStickyCta] = useState(initialStickyCta);
  const [stickyHeader, setStickyHeader] = useState(initialStickyHeader);
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(blocks));
  const [imageError, setImageError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Bloc à remplacer par le prochain fichier choisi ; `null` = nouveaux blocs. */
  const replaceTarget = useRef<string | null>(null);

  // Les objectURL d'aperçu sont libérés au démontage.
  const draftsRef = useRef(drafts);
  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);
  useEffect(
    () => () => {
      for (const d of draftsRef.current) {
        const preview = imageOf(d)?.preview;
        if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      }
    },
    []
  );

  /** Met à jour le visuel d'un bloc, qu'il soit une section image ou un showcase. */
  function patchImage(id: string, changes: Partial<ImageState>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? withImage(d, changes) : d)));
  }

  /** Met à jour le contenu d'un bloc. Le type est garanti par `BlockEditor`. */
  function patchBlock(id: string, changes: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? ({ ...d, ...changes } as Draft) : d))
    );
  }

  function upload(id: string, file: File) {
    startTransition(async () => {
      const result = await createLandingUploadUrl({
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!result.target) {
        setImageError(result.error ?? "Upload impossible.");
        patchImage(id, { status: "error", progress: 0 });
        return;
      }
      try {
        await putToSignedUrl(result.target.signedUrl, file, (percent) =>
          patchImage(id, { progress: percent })
        );
        patchImage(id, { status: "done", progress: 100, url: result.target.publicUrl });
      } catch {
        patchImage(id, { status: "error", progress: 0 });
      }
    });
  }

  async function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    const target = replaceTarget.current;
    replaceTarget.current = null;
    // Réinitialisé pour que resélectionner le même fichier redéclenche `change`.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;

    // Les HEIC de l'iPhone arrivent parfois avec un type MIME vide : on se fie
    // aussi à l'extension, la conversion tranchera pour de bon.
    const accepted = files.filter(
      (f) =>
        (f.type.startsWith("image/") || /\.(hei[cf]|jpe?g|png|webp|gif|avif)$/i.test(f.name)) &&
        f.size <= MAX_SOURCE_SIZE
    );
    const ignored = files.length - accepted.length;
    setImageError(
      ignored > 0
        ? `${ignored} fichier${ignored > 1 ? "s" : ""} ignoré${ignored > 1 ? "s" : ""} : images de 50 Mo maximum.`
        : null
    );
    if (accepted.length === 0) return;

    // Remplacement : seul le premier fichier compte, et l'ancienne image
    // uploadée dans cette session est effacée du storage.
    const entries = (target ? accepted.slice(0, 1) : accepted).map((source) => ({
      id: target ?? crypto.randomUUID(),
      source,
    }));

    if (target) {
      // Effets de bord hors de l'updater : React peut le rejouer en StrictMode.
      const old = drafts.find((d) => d.id === target);
      const image = old ? imageOf(old) : null;
      if (image) {
        if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
        if (image.isNew && image.url) {
          const url = image.url;
          startTransition(async () => {
            await discardLandingImage(product.id, url);
          });
        }
      }
    }

    setDrafts((prev) => {
      if (target) {
        return prev.map((d) =>
          d.id === target
            ? withImage(d, {
                url: null,
                preview: null,
                status: "preparing",
                progress: 0,
                isNew: true,
                file: undefined,
                error: undefined,
              })
            : d
        );
      }
      return [
        ...prev,
        ...entries.map(
          ({ id }): ImageDraft => ({
            id,
            type: "image",
            url: null,
            width: 0,
            height: 0,
            preview: null,
            status: "preparing",
            progress: 0,
            isNew: true,
          })
        ),
      ];
    });

    // Décodage (HEIC compris), redimensionnement et réencodage en WebP avant
    // le moindre octet envoyé. Les dimensions du fichier converti sont
    // relevées ici : la landing en a besoin pour réserver la place de l'image.
    await mapLimit(entries, CONVERT_CONCURRENCY, async ({ id, source }) => {
      try {
        const file = await prepareImage(source);
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        bitmap.close();
        patchImage(id, {
          file,
          width,
          height,
          preview: URL.createObjectURL(file),
          status: "uploading",
        });
        upload(id, file);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Conversion échouée.";
        setImageError(message);
        patchImage(id, { status: "error", error: message });
      }
    });
  }

  function retryImage(id: string, image: ImageState) {
    if (!image.file) return;
    setImageError(null);
    patchImage(id, { status: "uploading", progress: 0 });
    upload(id, image.file);
  }

  function pickFiles(target: string | null) {
    replaceTarget.current = target;
    fileInputRef.current?.click();
  }

  function addBlock(type: LandingBlockType) {
    if (type === "image") {
      pickFiles(null);
      return;
    }
    if (SINGLETONS.includes(type) && drafts.some((d) => d.type === type)) return;
    const draft = newDraft(crypto.randomUUID(), type);
    if (draft) setDrafts((prev) => [...prev, draft]);
  }

  function removeBlock(draft: Draft) {
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    const image = imageOf(draft);
    if (!image) return;
    if (image.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
    // Uploadée puis retirée avant enregistrement : inutile de la laisser
    // traîner dans le storage. Les images déjà enregistrées ne sont supprimées
    // qu'après un enregistrement réussi (côté serveur).
    if (image.isNew && image.url) {
      const url = image.url;
      startTransition(async () => {
        await discardLandingImage(product.id, url);
      });
    }
  }

  /**
   * Compose la page avec le modèle, puis bascule sur l'éditeur. Rien n'est
   * enregistré : l'administrateur relit avant de cliquer sur Enregistrer.
   */
  function generate() {
    setAiError(null);
    startAi(async () => {
      const result = await generateLanding(product.id, language, hint);
      if (result.error || !result.blocks) {
        setAiError(result.error ?? "Génération impossible.");
        return;
      }

      // Ce que les blocs remplacés laissaient derrière eux : aperçus locaux et
      // fichiers envoyés mais jamais enregistrés.
      for (const d of drafts) {
        const image = imageOf(d);
        if (image?.preview?.startsWith("blob:")) URL.revokeObjectURL(image.preview);
        if (image?.isNew && image.url) await discardLandingImage(product.id, image.url);
      }

      const briefs = result.briefs ?? {};
      // Les sections qui attendent un visuel le montrent tout de suite : la
      // page s'affiche complète, et les images s'y posent une à une.
      setDrafts(
        toDrafts(result.blocks).map((d) =>
          d.type === "showcase" && briefs[d.id]
            ? { ...d, brief: briefs[d.id], image: { ...d.image, status: "generating" as const } }
            : d
        )
      );
      setPane("custom");
      void composeAll(Object.entries(briefs));
    });
  }

  /**
   * Compose un visuel et le pose dans sa section. Le produit vient toujours
   * des photos du produit : la consigne ne décrit que la scène autour.
   */
  async function composeImage(id: string, brief: ImageBrief) {
    patchImage(id, { status: "generating", progress: 0, error: undefined });
    const result = await generateSectionImage(product.id, brief);
    if (!result.ok) {
      patchImage(id, { status: "error", error: result.error });
      return;
    }
    patchImage(id, {
      status: "done",
      progress: 100,
      url: result.url,
      preview: result.url,
      width: result.width,
      height: result.height,
      isNew: true,
      error: undefined,
    });
  }

  /**
   * Un visuel à la fois. En parallèle, les requêtes dépasseraient le temps
   * imparti à une action serveur et Replicate limiterait la cadence — et un
   * échec au quatrième ferait perdre les trois premiers.
   */
  async function composeAll(entries: [string, ImageBrief][]) {
    if (entries.length === 0) return;
    setImaging({ done: 0, total: entries.length });
    for (const [id, brief] of entries) {
      await composeImage(id, brief);
      setImaging((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setImaging(null);
  }

  /**
   * Recompose le visuel d'une section, après correction de sa consigne ou de
   * son texte. Le texte gravé est relu au moment du clic, et non repris de la
   * consigne d'origine : sinon corriger un titre n'aurait aucun effet.
   */
  function regenerate(id: string) {
    const draft = drafts.find((d) => d.id === id);
    if (draft?.type !== "showcase" || !draft.brief) return;
    const brief: ImageBrief = {
      ...draft.brief,
      text:
        draft.layout === "baked"
          ? {
              title: draft.title,
              body: draft.body,
              bullets: draft.bullets.filter(Boolean),
            }
          : undefined,
    };
    const previous = draft.image;
    // Le visuel remplacé n'a jamais été enregistré : inutile de le laisser
    // dans le storage.
    if (previous.isNew && previous.url) {
      void discardLandingImage(product.id, previous.url);
    }
    void composeImage(id, brief);
  }

  function moveBlock(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= drafts.length) return;
    const next = [...drafts];
    [next[index], next[target]] = [next[target], next[index]];
    setDrafts(next);
  }

  const busy = drafts.some((d) => {
    const status = imageOf(d)?.status;
    return status === "generating" || status === "preparing" || status === "uploading";
  });
  // Seul un bloc image en échec bloque : une section « showcase » sans visuel
  // reste une carte de texte parfaitement valable.
  const failedCount = drafts.filter((d) => d.type === "image" && d.status === "error").length;
  const hasForm = drafts.some((d) => d.type === "form");
  // Le serveur refuserait de toute façon : autant le dire avant de cliquer.
  const blocking =
    pane === "custom"
      ? !hasForm
        ? "Ajoutez le bloc Formulaire : sans lui, personne ne peut commander."
        : failedCount > 0
          ? "Une image est en échec : réessayez ou retirez la section."
          : null
      : null;

  return (
    <form
      action={action}
      className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_380px] lg:items-start"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="landing_mode" value={mode} />
      <input type="hidden" name="landing_blocks" value={JSON.stringify(toBlocks(drafts))} />
      <input type="hidden" name="landing_theme" value={theme} />
      <input type="hidden" name="landing_sticky_cta" value={stickyCta ? "1" : "0"} />
      <input type="hidden" name="landing_sticky_header" value={stickyHeader ? "1" : "0"} />

      <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
        {/* Choix du mode */}
        <div className="grid gap-3 sm:grid-cols-3">
          <ModeCard
            active={pane === "simple"}
            onSelect={() => setPane("simple")}
            icon={Sparkles}
            title="Simple"
            hint="La mise en page actuelle : titre, galerie, description, formulaire. Rien à configurer."
          />
          <ModeCard
            active={pane === "custom"}
            onSelect={() => setPane("custom")}
            icon={LayoutTemplate}
            title="Personnalisée"
            hint="Vous choisissez les blocs et leur ordre, section par section."
          />
          <ModeCard
            active={pane === "ia"}
            onSelect={() => setPane("ia")}
            icon={WandSparkles}
            title="Générer par IA"
            hint="Le produit et ses photos suffisent : l'IA rédige la page entière."
          />
        </div>

        {pane === "simple" ? (
          <p className="rounded-lg border border-line bg-raised px-4 py-3 text-sm text-ink-dim">
            La landing garde sa mise en page simple. Vos blocs personnalisés sont
            conservés : repassez en mode Personnalisée pour les retrouver.
          </p>
        ) : pane === "ia" ? (
          <section className="flex flex-col gap-5 admin-card p-4 sm:p-5">
            <div>
              <h2 className="font-bold text-ink">Composer la page</h2>
              <p className="text-xs leading-relaxed text-ink-dim">
                L&apos;IA lit les photos et la fiche du produit, écrit toutes les
                sections, puis compose sept affiches : le produit dans une mise en
                situation, avec le titre et les arguments <strong className="font-semibold text-ink">gravés
                dans l&apos;image</strong>. La page finit sur le bon de commande.
                Votre produit y est repris <strong className="font-semibold text-ink">tel
                quel depuis vos photos</strong> — seule la scène autour de lui change.
                Les textes restent du texte posé par-dessus : nets, et modifiables
                ensuite.
              </p>
            </div>

            {/* Ce que le modèle va réellement voir : mieux vaut le montrer que
                le décrire, une fiche vide donne une page creuse. */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                Ce que l&apos;IA reçoit
              </span>
              <div className="flex flex-col gap-2 rounded-lg border border-line bg-raised p-3">
                <p className="text-sm font-semibold text-ink">{product.name}</p>
                {product.images.length > 0 ? (
                  <div className="no-scrollbar flex gap-2 overflow-x-auto">
                    {product.images.slice(0, 4).map((src, index) => (
                      <span key={src} className="relative shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="size-16 rounded-lg object-cover ring-1 ring-line"
                        />
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-zinc-900/70 px-1 text-[10px] font-bold text-white">
                          {index}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warn-ink">
                    <CircleAlert className="size-3.5 shrink-0" />
                    Aucune photo : la page sera écrite à l&apos;aveugle, et sans visuel.
                  </p>
                )}
                <p className="text-xs text-ink-dim">
                  {product.description ? "Description" : "Pas de description"}
                  {" · "}
                  {product.features.length} point{product.features.length > 1 ? "s" : ""} fort
                  {product.features.length > 1 ? "s" : ""}
                  {" · "}
                  {product.colors.length + product.sizes.length} variante
                  {product.colors.length + product.sizes.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                Langue de la page
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LandingLanguage)}
                className={`${inputClass} sm:w-64`}
              >
                {LANDING_LANGUAGES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                Consigne (facultatif)
              </span>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                rows={3}
                maxLength={600}
                dir="auto"
                placeholder="À qui s'adresse le produit, l'angle à prendre, ce qu'il ne faut surtout pas dire…"
                className={inputClass}
              />
              <span className="text-xs text-ink-faint">
                L&apos;IA n&apos;affirme que ce qui figure dans la fiche produit : elle
                n&apos;inventera ni certification, ni garantie, ni avis client.
              </span>
            </div>

            {drafts.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2.5 text-xs font-medium text-warn-ink">
                <CircleAlert className="mt-px size-3.5 shrink-0" />
                Vos {drafts.length} bloc{drafts.length > 1 ? "s" : ""} actuels seront
                remplacés dans l&apos;éditeur. Rien n&apos;est perdu tant que vous
                n&apos;enregistrez pas.
              </p>
            )}

            {aiError && (
              <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
                <CircleAlert className="mt-px size-4 shrink-0" />
                {aiError}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={generate}
                disabled={aiPending}
                className="admin-btn-primary sm:w-fit"
              >
                {aiPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <WandSparkles className="size-5" />
                )}
                {aiPending ? "Rédaction en cours…" : "Générer la page"}
              </button>
              <span className="text-xs text-ink-faint">
                Une minute pour les textes, puis deux à trois minutes pour les sept
                affiches, composées une par une.
              </span>
            </div>
          </section>
        ) : (
          <>
            {/* Options d'affichage */}
            <section className="flex flex-col gap-4 admin-card p-4 sm:p-5">
              <div>
                <h2 className="font-bold text-ink">Affichage</h2>
                <p className="text-xs text-ink-dim">
                  Thème, en-tête et bouton flottant de la page personnalisée.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
                    Thème
                  </span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-raised p-1">
                    {(
                      [
                        { value: "light", label: "Clair", icon: Sun },
                        { value: "dark", label: "Sombre", icon: Moon },
                      ] as const
                    ).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        aria-pressed={theme === value}
                        className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${
                          theme === value
                            ? "bg-surface text-ink shadow-sm"
                            : "text-ink-dim hover:text-ink-soft"
                        }`}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle
                  checked={stickyHeader}
                  onChange={setStickyHeader}
                  icon={PanelTop}
                  label="En-tête fixé"
                  hint={
                    stickyHeader
                      ? "Reste collé en haut pendant le défilement."
                      : "Défile avec la page et disparaît."
                  }
                />
                <Toggle
                  checked={stickyCta}
                  onChange={setStickyCta}
                  icon={MousePointerClick}
                  label="Bouton Commander flottant"
                  hint={
                    stickyCta
                      ? "Toujours visible, au-dessus de toutes les sections."
                      : "Retiré : seuls les boutons des blocs restent."
                  }
                />
              </div>
            </section>

            {/* Palette */}
            <section className="flex flex-col gap-3 admin-card p-4 sm:p-5">
              <div>
                <h2 className="font-bold text-ink">Ajouter un bloc</h2>
                <p className="text-xs text-ink-dim">
                  Les blocs s&apos;ajoutent en bas de la page ; réordonnez-les ensuite.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {PALETTE.map(({ type, label, hint, icon: Icon }) => {
                  const used = SINGLETONS.includes(type) && drafts.some((d) => d.type === type);
                  return (
                    <button
                      key={type}
                      type="button"
                      disabled={used}
                      onClick={() => addBlock(type)}
                      className="group flex items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-accent-line hover:bg-accent-soft/40 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-line disabled:hover:bg-surface"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-raised text-ink-soft transition group-hover:bg-accent-soft group-hover:text-accent group-disabled:bg-raised group-disabled:text-ink-soft">
                        <Icon className="size-4.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                          {label}
                          {used ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                              ajouté
                            </span>
                          ) : (
                            <Plus className="size-3.5 text-ink-faint" />
                          )}
                        </span>
                        <span className="block text-xs leading-snug text-ink-dim">{hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-ink-faint">
                Image section : sélectionnez plusieurs fichiers d&apos;un coup pour créer une
                section par image, dans l&apos;ordre choisi. Chaque photo est convertie en
                WebP dans votre navigateur puis envoyée aussitôt.
              </p>
            </section>

            {/* Liste des blocs */}
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="font-bold text-ink">Votre page</h2>
                <span className="text-xs text-ink-faint">
                  {drafts.length} bloc{drafts.length > 1 ? "s" : ""}
                  {busy && " — envoi en cours…"}
                </span>
              </div>

              {imaging && (
                <div className="flex flex-col gap-2 rounded-lg border border-accent-line bg-accent-soft px-4 py-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-accent-ink">
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    Composition des visuels — {imaging.done} / {imaging.total}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${(imaging.done / imaging.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-accent-ink/80">
                    Le produit est repris tel quel de vos photos : seule la scène
                    autour de lui est composée. Vous pouvez déjà relire les textes.
                  </p>
                </div>
              )}

              {drafts.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong px-6 py-12 text-center">
                  <LayoutTemplate className="size-8 text-ink-faint" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-ink-dim">Page vide</p>
                  <p className="text-xs text-ink-faint">
                    Ajoutez vos blocs ci-dessus. Le Formulaire est obligatoire.
                  </p>
                </div>
              ) : (
                <ol className="flex flex-col gap-3">
                  {drafts.map((draft, index) => {
                    const meta = PALETTE_BY_TYPE[draft.type];
                    const Icon = meta.icon;
                    return (
                      <li
                        key={draft.id}
                        className="flex flex-col gap-3 admin-card p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-surface">
                            {index + 1}
                          </span>
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                            <Icon className="size-4.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink">
                              {meta.label}
                            </p>
                            <p className="truncate text-xs text-ink-dim">{meta.hint}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveBlock(index, -1)}
                              disabled={index === 0}
                              aria-label="Monter"
                              className="flex size-8 items-center justify-center rounded-lg text-ink-dim transition hover:bg-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowUp className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveBlock(index, 1)}
                              disabled={index === drafts.length - 1}
                              aria-label="Descendre"
                              className="flex size-8 items-center justify-center rounded-lg text-ink-dim transition hover:bg-raised hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <ArrowDown className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeBlock(draft)}
                              aria-label="Supprimer le bloc"
                              className="flex size-8 items-center justify-center rounded-lg text-ink-faint transition hover:bg-danger-soft hover:text-danger"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>

                        <BlockEditor
                          draft={draft}
                          patch={(changes) => patchBlock(draft.id, changes)}
                          onPickImage={() => pickFiles(draft.id)}
                          onRetryImage={() => {
                            const image = imageOf(draft);
                            if (image) retryImage(draft.id, image);
                          }}
                          onRegenerate={
                            draft.type === "showcase" && draft.brief
                              ? () => regenerate(draft.id)
                              : undefined
                          }
                        />
                      </li>
                    );
                  })}
                </ol>
              )}

              {imageError && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                  <CircleAlert className="size-3.5 shrink-0" />
                  {imageError}
                </p>
              )}
            </section>
          </>
        )}

        {blocking && (
          <p className="flex items-center gap-2 rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn-ink">
            <CircleAlert className="size-4 shrink-0" />
            {blocking}
          </p>
        )}
        {state.error && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {state.error}
          </p>
        )}
        {state.success && !pending && (
          <p className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok-ink">
            <CheckCircle2 className="size-4 shrink-0" />
            Landing page enregistrée.
          </p>
        )}

        {pane !== "ia" && (
          <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="submit"
              disabled={pending || busy || blocking !== null}
              className="admin-btn-primary sm:w-fit"
            >
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
              Enregistrer
            </button>
            <a
              href={product.domain ? `https://${product.domain}` : `/p/${product.slug}`}
              target="_blank"
              className="admin-btn text-ink-dim hover:bg-raised hover:text-ink-soft sm:w-fit"
            >
              Voir la boutique
            </a>
          </div>
        )}
      </div>

      {/* Aperçu mobile */}
      {pane === "custom" && (
        <Preview
          drafts={drafts}
          theme={theme}
          stickyCta={stickyCta}
          stickyHeader={stickyHeader}
          product={product}
          storeName={storeName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
        />
      )}
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  icon: Icon,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  icon: typeof Sun;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex items-start gap-3 rounded-xl p-3 text-left transition ${
        checked ? "bg-accent-soft ring-1 ring-accent-line" : "bg-raised ring-1 ring-line"
      }`}
    >
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          checked ? "bg-accent-btn text-accent-btn-ink" : "bg-surface text-ink-faint ring-1 ring-line"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs leading-snug text-ink-dim">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`mt-1 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
          checked ? "bg-accent" : "bg-line-strong"
        }`}
      >
        <span
          className={`size-4 rounded-full bg-surface shadow transition ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
    </button>
  );
}

function ModeCard({
  active,
  onSelect,
  icon: Icon,
  title,
  hint,
}: {
  active: boolean;
  onSelect: () => void;
  icon: typeof Sparkles;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-xl p-4 text-left transition ${
        active
          ? "admin-card ring-2 ring-accent"
          : "bg-surface/60 ring-1 ring-line hover:bg-surface hover:ring-line-strong"
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          active ? "bg-accent-btn text-accent-btn-ink" : "bg-raised text-ink-dim"
        }`}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-ink">{title}</span>
        <span className="block text-xs leading-snug text-ink-dim">{hint}</span>
      </span>
    </button>
  );
}

/**
 * Aperçu approximatif de la landing, à la largeur d'un téléphone. Les blocs
 * produit sont résumés (pas de galerie interactive ni de vrai formulaire) :
 * l'objectif est de juger l'ordre et le rythme des sections, pas le pixel.
 */
function Preview({
  drafts,
  theme,
  stickyCta,
  stickyHeader,
  product,
  storeName,
  logoUrl,
  primaryColor,
}: {
  drafts: Draft[];
  theme: LandingTheme;
  stickyCta: boolean;
  stickyHeader: boolean;
  product: Product | null;
  storeName: string;
  logoUrl: string | null;
  primaryColor: string;
}) {
  const name = product?.name ?? "Mon produit";
  const price = product?.price ?? 0;
  const oldPrice = product?.old_price ?? null;
  const cover = product?.images[0] ?? null;

  /** Un visuel bord à bord : deux qui se suivent restent collés. */
  const fullBleed = (draft: Draft) =>
    draft.type === "image" ||
    (draft.type === "showcase" && draft.layout === "baked" && draft.image.preview !== null);

  return (
    <aside className="flex flex-col gap-2 lg:sticky lg:top-8">
      <p className="admin-eyebrow px-1">
        Aperçu mobile
      </p>
      {/* `data-theme` sur le cadre : les mêmes classes `dark:` que la vraie
          landing s'appliquent à l'aperçu. */}
      <div
        data-theme={theme}
        style={{ "--primary": primaryColor } as React.CSSProperties}
        className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[2rem] bg-zinc-900 p-2.5 shadow-2xl shadow-zinc-900/30"
      >
        <div className="relative flex h-[640px] flex-col overflow-y-auto rounded-[1.4rem] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
          <div
            className={`${stickyHeader ? "sticky top-0" : "relative"} z-10 flex h-12 shrink-0 items-center justify-center gap-2 border-b border-zinc-200/60 bg-white/95 dark:border-white/10 dark:bg-zinc-950/95`}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-6 rounded-lg object-contain" />
            ) : (
              <span className="flex size-6 items-center justify-center rounded-lg bg-(--primary) text-white">
                <PackageOpen className="size-3.5" />
              </span>
            )}
            <span className="text-sm font-extrabold tracking-tight">{storeName}</span>
          </div>

          <div className={`flex flex-col px-3 ${stickyCta ? "pb-20" : "pb-8"}`}>
            {drafts.length === 0 && (
              <p className="px-4 py-16 text-center text-xs text-zinc-400">
                Ajoutez des blocs pour voir votre page prendre forme.
              </p>
            )}
            {drafts.map((draft, index) => {
              const previous = drafts[index - 1];
              switch (draft.type) {
                case "hero":
                  return (
                    <div key={draft.id} className="flex flex-col items-center gap-2 pb-5 pt-6 text-center">
                      {oldPrice && oldPrice > price && (
                        <span className="rounded-full bg-(--primary) px-2.5 py-0.5 text-[10px] font-bold text-white">
                          -{Math.round((1 - price / oldPrice) * 100)}% aujourd&apos;hui
                        </span>
                      )}
                      <p className="text-lg font-extrabold leading-tight">{name}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-(--primary)">
                          {formatDA(price)}
                        </span>
                        {oldPrice && oldPrice > price && (
                          <span className="text-sm text-zinc-400 line-through">
                            {formatDA(oldPrice)}
                          </span>
                        )}
                      </div>
                      <span className="mt-1 rounded-full bg-zinc-900 px-4 py-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-zinc-900">
                        Commander maintenant
                      </span>
                    </div>
                  );
                case "gallery":
                  return (
                    <div key={draft.id} className="overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" className="aspect-square w-full object-cover" />
                      ) : (
                        <div className="flex aspect-square items-center justify-center text-zinc-400">
                          <Images className="size-8" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                  );
                case "description":
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col gap-2 pt-6">
                      {product?.description ? (
                        <p className="line-clamp-4 rounded-2xl bg-white px-4 py-3 text-[11px] leading-relaxed text-zinc-600 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10">
                          {product.description}
                        </p>
                      ) : (
                        <p className="rounded-2xl bg-white px-4 py-3 text-[11px] text-zinc-400 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10">
                          Description du produit
                        </p>
                      )}
                      {product && product.features.length > 0 && (
                        <ul className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200/70 ring-1 ring-zinc-200/60 dark:bg-white/10 dark:ring-white/10">
                          {product.features.slice(0, 4).map((f) => (
                            <li key={f} className="bg-white px-4 py-2 text-[11px] font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                              ✓ {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                case "form":
                  return (
                    <div key={draft.id} className="flex flex-col gap-2 pt-7">
                      <p className="text-center text-base font-extrabold">Passez votre commande</p>
                      <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10">
                        {["Nom complet", "Téléphone", "Wilaya", "Commune"].map((label) => (
                          <div key={label} className="rounded-lg border border-zinc-200 px-3 py-2 text-[11px] text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800">
                            {label}
                          </div>
                        ))}
                        <div className="rounded-lg bg-(--primary) py-2 text-center text-[11px] font-bold text-white">
                          Confirmer la commande
                        </div>
                      </div>
                    </div>
                  );
                case "text":
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col gap-2 pt-6">
                      {draft.title && (
                        <p className="text-center text-base font-extrabold leading-tight">{draft.title}</p>
                      )}
                      {draft.body && (
                        <p className="whitespace-pre-line rounded-2xl bg-white px-4 py-3 text-[11px] leading-relaxed text-zinc-600 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-white/10">
                          {draft.body}
                        </p>
                      )}
                      {!draft.title && !draft.body && (
                        <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-3 text-center text-[11px] text-zinc-400 dark:border-zinc-700">
                          Bloc texte vide
                        </p>
                      )}
                    </div>
                  );
                case "showcase": {
                  const bullets = draft.bullets.filter(Boolean);
                  // Le visuel composé porte déjà le texte : on ne le redit pas.
                  if (draft.layout === "baked" && draft.image.preview) {
                    const glued = !previous || fullBleed(previous) || previous.type === "hero";
                    return (
                      <div key={draft.id} className={`-mx-3 ${glued ? "" : "mt-6"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draft.image.preview} alt="" className="block h-auto w-full" />
                      </div>
                    );
                  }
                  // Repli : sans visuel gravé, le texte s'affiche en clair.
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col pt-6">
                      {draft.image.preview ? (
                        <div className="-mx-3 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={draft.image.preview} alt="" className="block h-auto w-full" />
                        </div>
                      ) : (
                        <div className="mb-2 flex h-24 items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-[10px] text-zinc-400 dark:border-zinc-700">
                          {draft.image.status === "generating" ? "Composition…" : "Sans visuel"}
                        </div>
                      )}
                      <div className={`flex flex-col gap-1 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10 ${draft.image.preview ? "relative z-10 -mt-6" : ""}`}>
                        {draft.title && <p className="landing-title text-sm">{draft.title}</p>}
                        {draft.body && (
                          <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {draft.body}
                          </p>
                        )}
                        {bullets.map((b) => (
                          <p key={b} className="text-[11px] font-medium text-zinc-700 dark:text-zinc-200">
                            ✓ {b}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                }
                case "problem":
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col gap-2 pt-6">
                      {draft.title && (
                        <p className="text-center text-base font-extrabold leading-tight">{draft.title}</p>
                      )}
                      {draft.body && (
                        <p className="line-clamp-3 text-center text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {draft.body}
                        </p>
                      )}
                      <div className="grid grid-cols-3 gap-1.5">
                        {draft.items.slice(0, 3).map((item, i) => (
                          <div
                            key={i}
                            className="flex flex-col items-center gap-1 rounded-xl bg-white px-1 py-3 text-center ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
                          >
                            <span className="flex size-7 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                              <BlockIcon name={item.icon} className="size-3.5" />
                            </span>
                            <span className="text-[9px] font-bold leading-tight text-zinc-700 dark:text-zinc-200">
                              {item.label || "Symptôme"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                case "features":
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col gap-2 pt-6">
                      {draft.title && (
                        <p className="text-center text-base font-extrabold leading-tight">{draft.title}</p>
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        {draft.items.map((item, i) => (
                          <div
                            key={i}
                            className="flex flex-col gap-1 rounded-xl bg-white p-2.5 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
                          >
                            <span className="flex size-7 items-center justify-center rounded-lg bg-(--primary)/12 text-(--primary)">
                              <BlockIcon name={item.icon} className="size-3.5" />
                            </span>
                            <span className="text-[10px] font-bold leading-tight text-zinc-800 dark:text-zinc-100">
                              {item.label || "Atout"}
                            </span>
                            {item.hint && (
                              <span className="text-[9px] leading-tight text-zinc-500 dark:text-zinc-400">
                                {item.hint}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                case "compare":
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col gap-2 pt-6">
                      {draft.title && (
                        <p className="text-center text-base font-extrabold leading-tight">{draft.title}</p>
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        {[draft.before, draft.after].map((side, i) => (
                          <div
                            key={i}
                            className={`flex flex-col gap-1 rounded-xl bg-white p-2.5 ring-1 dark:bg-zinc-900 ${
                              i === 0 ? "ring-rose-500/25" : "ring-(--primary)/30"
                            }`}
                          >
                            <span
                              className={`text-[10px] font-extrabold ${
                                i === 0 ? "text-rose-500" : "text-(--primary)"
                              }`}
                            >
                              {i === 0 ? "✗" : "✓"} {side.label}
                            </span>
                            {side.points.filter(Boolean).map((point) => (
                              <span
                                key={point}
                                className="text-[9px] leading-tight text-zinc-600 dark:text-zinc-300"
                              >
                                {point}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                case "faq":
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col gap-2 pt-6">
                      {draft.title && (
                        <p className="text-center text-base font-extrabold leading-tight">{draft.title}</p>
                      )}
                      <div className="grid gap-px overflow-hidden rounded-2xl bg-zinc-200/70 ring-1 ring-zinc-200/60 dark:bg-white/10 dark:ring-white/10">
                        {draft.items.map((item, i) => (
                          <p
                            key={i}
                            className="flex items-center justify-between gap-2 bg-white px-4 py-2.5 text-[11px] font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                          >
                            {item.question || "Question"}
                            <span className="text-zinc-400">⌄</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                case "reviews":
                  return (
                    <div key={draft.id} dir="auto" className="flex flex-col gap-2 pt-6">
                      {draft.title && (
                        <p className="text-center text-base font-extrabold leading-tight">{draft.title}</p>
                      )}
                      {draft.items.map((review, i) => (
                        <div
                          key={i}
                          className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
                        >
                          <span className="flex items-center gap-1">
                            <span className="flex">
                              {Array.from({ length: 5 }, (_, s) => (
                                <Star
                                  key={s}
                                  className={`size-2.5 ${
                                    s < review.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"
                                  }`}
                                />
                              ))}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-800 dark:text-zinc-100">
                              {review.name || "Client"}
                            </span>
                          </span>
                          <p className="line-clamp-2 text-[10px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {review.text || "Avis du client"}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                case "cta":
                  return (
                    <div key={draft.id} dir="auto" className="pt-6">
                      <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-(--primary)/8 px-4 py-5 text-center ring-1 ring-(--primary)/20">
                        {draft.title && (
                          <p className="text-sm font-extrabold leading-tight">{draft.title}</p>
                        )}
                        {draft.body && (
                          <p className="line-clamp-2 text-[10px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                            {draft.body}
                          </p>
                        )}
                        <span className="rounded-full bg-(--primary) px-4 py-1.5 text-[10px] font-bold text-white">
                          {draft.label || "Commander"}
                        </span>
                      </div>
                    </div>
                  );
                case "image": {
                  const glued = !previous || fullBleed(previous) || previous.type === "hero";
                  return (
                    <div key={draft.id} className={`-mx-3 ${glued ? "" : "mt-6"}`}>
                      {draft.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={draft.preview}
                          alt=""
                          className={`block h-auto w-full ${draft.status === "done" ? "" : "opacity-50"}`}
                        />
                      ) : (
                        <div className="flex h-40 items-center justify-center bg-zinc-200 text-zinc-400 dark:bg-zinc-800">
                          <Loader2 className="size-5 animate-spin" />
                        </div>
                      )}
                    </div>
                  );
                }
              }
            })}
          </div>

          <div className="mt-auto flex shrink-0 items-center justify-center gap-1.5 border-t border-zinc-200/60 bg-white py-3 text-[10px] text-zinc-400 dark:border-white/10 dark:bg-zinc-900">
            © {new Date().getFullYear()} {storeName}
          </div>

          {/* Bouton flottant : `sticky bottom` dans le cadre qui défile, il
              reste visible quelle que soit la section, comme sur la landing. */}
          {stickyCta && (
            <div className="pointer-events-none sticky bottom-3 z-20 -mt-14 px-3">
              <div className="flex items-center justify-center gap-1.5 rounded-xl bg-(--primary) py-2.5 text-[11px] font-bold text-white shadow-lg shadow-(--primary)/30">
                Commander — {formatDA(price)}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
