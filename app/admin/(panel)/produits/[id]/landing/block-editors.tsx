"use client";

import {
  CircleAlert,
  ImageIcon,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  IMAGE_RATIOS,
  LANDING_ICONS,
  LANDING_LIMITS,
  type ImageBrief,
  type LandingBlock,
  type LandingBlockType,
  type LandingIcon,
  type LandingItem,
  type LandingQuestion,
  type LandingReview,
} from "@/lib/types";
import { BlockIcon } from "@/app/components/landing-icon";
import { inputClass } from "../../../ui";

/* ── Brouillons ───────────────────────────────────────────────────────────────
   Un bloc en cours d'édition n'a pas tout à fait la forme du bloc enregistré :
   une image mise en ligne à l'instant n'a pas encore d'URL, seulement un
   aperçu local et une progression. Ces types portent cet écart, et
   `toBlocks` le referme au moment d'enregistrer. */

/** État d'un visuel en cours de mise en ligne, partagé par « image » et « showcase ». */
export type ImageState = {
  url: string | null;
  width: number;
  height: number;
  /** Aperçu affiché ; `null` tant que la conversion n'a pas produit de WebP. */
  preview: string | null;
  status: "empty" | "generating" | "preparing" | "uploading" | "done" | "error";
  progress: number;
  /** Mise en ligne dans cette session : peut être effacée du storage si retirée. */
  isNew: boolean;
  /** Fichier converti, conservé pour permettre un réessai. */
  file?: File;
  error?: string;
};

export type ImageDraft = { id: string; type: "image" } & ImageState;

export type ShowcaseDraft = {
  id: string;
  type: "showcase";
  title: string;
  body: string;
  bullets: string[];
  layout: "baked" | "stack";
  image: ImageState;
  /**
   * Scène à composer autour du produit. Vit uniquement dans l'éditeur : le
   * bloc enregistré ne garde que l'image obtenue. La conserver ici permet de
   * relancer une génération, ou d'en corriger la consigne, sans repasser par
   * le rédacteur.
   */
  brief?: ImageBrief;
};

export type Draft =
  | Exclude<LandingBlock, { type: "image" } | { type: "showcase" }>
  | ImageDraft
  | ShowcaseDraft;

const EMPTY_IMAGE: ImageState = {
  url: null,
  width: 0,
  height: 0,
  preview: null,
  status: "empty",
  progress: 0,
  isNew: false,
};

/** Le visuel d'un brouillon, quel que soit le bloc qui le porte. */
export function imageOf(draft: Draft): ImageState | null {
  if (draft.type === "image") return draft;
  if (draft.type === "showcase") return draft.image;
  return null;
}

/** Réécrit le visuel d'un brouillon sans que l'appelant sache où il est rangé. */
export function withImage(draft: Draft, changes: Partial<ImageState>): Draft {
  if (draft.type === "image") return { ...draft, ...changes };
  if (draft.type === "showcase") return { ...draft, image: { ...draft.image, ...changes } };
  return draft;
}

export function toDrafts(blocks: LandingBlock[]): Draft[] {
  return blocks.map((block): Draft => {
    if (block.type === "image") {
      return { ...block, preview: block.url, status: "done", progress: 100, isNew: false };
    }
    if (block.type === "showcase") {
      const { url, width, height, ...rest } = block;
      return {
        ...rest,
        image: url
          ? { url, width, height, preview: url, status: "done", progress: 100, isNew: false }
          : EMPTY_IMAGE,
      };
    }
    return block;
  });
}

/** Ne garde que ce que le serveur saura enregistrer. */
export function toBlocks(drafts: Draft[]): LandingBlock[] {
  return drafts.flatMap((draft): LandingBlock[] => {
    if (draft.type === "image") {
      if (draft.status !== "done" || !draft.url) return [];
      return [
        { id: draft.id, type: "image", url: draft.url, width: draft.width, height: draft.height },
      ];
    }
    if (draft.type === "showcase") {
      // Une mise en ligne encore en cours ne fait pas perdre le texte : la
      // section part sans visuel plutôt que d'être écartée.
      const { image } = draft;
      const ready = image.status === "done" && image.url !== null;
      // Champ par champ, et non par diffusion : `image` et `brief` n'existent
      // que dans l'éditeur, et cette liste dit exactement ce qui est conservé.
      return [
        {
          id: draft.id,
          type: "showcase",
          title: draft.title,
          body: draft.body,
          bullets: draft.bullets,
          layout: draft.layout,
          url: ready ? image.url : null,
          width: ready ? image.width : 0,
          height: ready ? image.height : 0,
        },
      ];
    }
    return [draft];
  });
}

/** Contenu de départ d'un bloc fraîchement ajouté. */
export function newDraft(id: string, type: LandingBlockType): Draft | null {
  switch (type) {
    case "hero":
    case "gallery":
    case "description":
    case "form":
      return { id, type };
    case "text":
      return { id, type, title: "", body: "" };
    case "showcase":
      return { id, type, title: "", body: "", bullets: [""], layout: "baked", image: EMPTY_IMAGE };
    case "problem":
      return { id, type, title: "", body: "", items: [newItem(), newItem(), newItem()] };
    case "features":
      return { id, type, title: "", items: [newItem(), newItem()] };
    case "compare":
      return {
        id,
        type,
        title: "",
        before: { label: "Avant", points: [""] },
        after: { label: "Après", points: [""] },
      };
    case "faq":
      return { id, type, title: "", items: [{ question: "", answer: "" }] };
    case "reviews":
      return { id, type, title: "", items: [{ name: "", text: "", rating: 5 }] };
    case "cta":
      return { id, type, title: "", body: "", label: "Commander maintenant" };
    // L'image naît de la sélection d'un fichier, pas d'un clic sur la palette.
    case "image":
      return null;
  }
}

function newItem(): LandingItem {
  return { icon: "check", label: "", hint: "" };
}

/* ── Briques d'édition ────────────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
      {children}
    </span>
  );
}

/** Bouton « retirer une ligne », commun à toutes les listes. */
function RemoveRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint transition hover:bg-danger-soft hover:text-danger"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function AddRow({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-fit items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-line disabled:opacity-40"
    >
      <Plus className="size-3.5" />
      {children}
    </button>
  );
}

/**
 * Choix d'une icône dans la liste fermée. Un `<details>` plutôt qu'un menu
 * flottant : la grille pousse le contenu vers le bas au lieu de se poser
 * dessus, ce qui évite de gérer un positionnement et une fermeture au clic
 * extérieur pour un contrôle utilisé quelques secondes.
 */
function IconPicker({
  value,
  onChange,
}: {
  value: LandingIcon;
  onChange: (icon: LandingIcon) => void;
}) {
  return (
    <details className="group relative shrink-0">
      <summary
        aria-label="Choisir une icône"
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg border border-line-strong bg-surface text-ink-soft transition hover:border-accent hover:text-accent sm:size-9"
      >
        <BlockIcon name={value} className="size-5" />
      </summary>
      <div className="absolute z-20 mt-1 grid max-h-56 w-64 grid-cols-8 gap-0.5 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
        {LANDING_ICONS.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            onClick={(e) => {
              onChange(name);
              e.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className={`flex size-7 items-center justify-center rounded-md transition ${
              name === value
                ? "bg-accent-soft text-accent"
                : "text-ink-dim hover:bg-raised hover:text-ink"
            }`}
          >
            <BlockIcon name={name} className="size-4" />
          </button>
        ))}
      </div>
    </details>
  );
}

/** Liste de textes courts : puces d'un « showcase », arguments d'une colonne. */
function StringList({
  values,
  onChange,
  placeholder,
  max,
  addLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  max: number;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) =>
              onChange(values.map((v, i) => (i === index ? e.target.value : v)))
            }
            placeholder={placeholder}
            maxLength={LANDING_LIMITS.label}
            dir="auto"
            className={inputClass}
          />
          <RemoveRow
            onClick={() => onChange(values.filter((_, i) => i !== index))}
            label="Retirer la ligne"
          />
        </div>
      ))}
      <AddRow onClick={() => onChange([...values, ""])} disabled={values.length >= max}>
        {addLabel}
      </AddRow>
    </div>
  );
}

/** Liste d'atouts : icône + libellé (+ précision pour la grille de features). */
function ItemList({
  items,
  onChange,
  withHint,
  max,
}: {
  items: LandingItem[];
  onChange: (items: LandingItem[]) => void;
  withHint: boolean;
  max: number;
}) {
  const patch = (index: number, changes: Partial<LandingItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <IconPicker value={item.icon} onChange={(icon) => patch(index, { icon })} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input
              value={item.label}
              onChange={(e) => patch(index, { label: e.target.value })}
              placeholder="Libellé (ex. Résistant à l'eau)"
              maxLength={LANDING_LIMITS.label}
              dir="auto"
              className={inputClass}
            />
            {withHint && (
              <input
                value={item.hint}
                onChange={(e) => patch(index, { hint: e.target.value })}
                placeholder="Précision (optionnelle)"
                maxLength={LANDING_LIMITS.hint}
                dir="auto"
                className={inputClass}
              />
            )}
          </div>
          <RemoveRow
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            label="Retirer l'atout"
          />
        </div>
      ))}
      <AddRow onClick={() => onChange([...items, newItem()])} disabled={items.length >= max}>
        Ajouter un atout
      </AddRow>
    </div>
  );
}

function QuestionList({
  items,
  onChange,
}: {
  items: LandingQuestion[];
  onChange: (items: LandingQuestion[]) => void;
}) {
  const patch = (index: number, changes: Partial<LandingQuestion>) =>
    onChange(items.map((q, i) => (i === index ? { ...q, ...changes } : q)));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <input
              value={item.question}
              onChange={(e) => patch(index, { question: e.target.value })}
              placeholder="Question"
              maxLength={LANDING_LIMITS.title}
              dir="auto"
              className={inputClass}
            />
            <textarea
              value={item.answer}
              onChange={(e) => patch(index, { answer: e.target.value })}
              placeholder="Réponse"
              rows={2}
              maxLength={LANDING_LIMITS.body}
              dir="auto"
              className={inputClass}
            />
          </div>
          <RemoveRow
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            label="Retirer la question"
          />
        </div>
      ))}
      <AddRow
        onClick={() => onChange([...items, { question: "", answer: "" }])}
        disabled={items.length >= LANDING_LIMITS.questions}
      >
        Ajouter une question
      </AddRow>
    </div>
  );
}

function ReviewList({
  items,
  onChange,
}: {
  items: LandingReview[];
  onChange: (items: LandingReview[]) => void;
}) {
  const patch = (index: number, changes: Partial<LandingReview>) =>
    onChange(items.map((r, i) => (i === index ? { ...r, ...changes } : r)));

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input
                value={item.name}
                onChange={(e) => patch(index, { name: e.target.value })}
                placeholder="Nom du client"
                maxLength={LANDING_LIMITS.label}
                dir="auto"
                className={inputClass}
              />
              <select
                value={item.rating}
                onChange={(e) => patch(index, { rating: Number(e.target.value) })}
                aria-label="Note"
                className={`${inputClass} w-24 shrink-0`}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} ★
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={item.text}
              onChange={(e) => patch(index, { text: e.target.value })}
              placeholder="Avis"
              rows={2}
              maxLength={LANDING_LIMITS.body}
              dir="auto"
              className={inputClass}
            />
          </div>
          <RemoveRow
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            label="Retirer l'avis"
          />
        </div>
      ))}
      <AddRow
        onClick={() => onChange([...items, { name: "", text: "", rating: 5 }])}
        disabled={items.length >= LANDING_LIMITS.reviews}
      >
        Ajouter un avis
      </AddRow>
    </div>
  );
}

/** Vignette d'un visuel : aperçu, progression, réessai, remplacement. */
export function ImageEditor({
  image,
  optional = false,
  onPick,
  onRetry,
}: {
  image: ImageState;
  /** Un « showcase » se rend sans visuel ; un bloc image, non. */
  optional?: boolean;
  onPick: () => void;
  onRetry: () => void;
}) {
  const working =
    image.status === "generating" ||
    image.status === "preparing" ||
    image.status === "uploading";

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-raised ring-1 ring-line">
        {image.preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.preview} alt="" className="size-full object-cover" />
        )}
        {image.status === "empty" && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-ink-faint">
            <ImageIcon className="size-5" strokeWidth={1.5} />
            <span className="text-[10px] font-medium">Aucun visuel</span>
          </span>
        )}
        {image.status === "generating" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-zinc-900/55">
            <Loader2 className="size-5 animate-spin text-white" />
            <span className="text-[10px] font-semibold text-white">Composition…</span>
          </div>
        )}
        {image.status === "preparing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-zinc-900/10">
            <Loader2 className="size-5 animate-spin text-ink-dim" />
            <span className="text-[10px] font-medium text-ink-dim">Conversion…</span>
          </div>
        )}
        {image.status === "uploading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/55">
            <Loader2 className="size-5 animate-spin text-white" />
            <div className="h-1 w-16 overflow-hidden rounded-full bg-surface/30">
              <div
                className="h-full rounded-full bg-surface transition-all"
                style={{ width: `${image.progress}%` }}
              />
            </div>
          </div>
        )}
        {image.status === "error" &&
          (image.file ? (
            <button
              type="button"
              onClick={onRetry}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-danger/75 text-white"
              title={image.error}
            >
              <RotateCcw className="size-5" />
              <span className="text-[10px] font-semibold">Réessayer</span>
            </button>
          ) : (
            <span
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-danger/75 px-1 text-center text-white"
              title={image.error}
            >
              <CircleAlert className="size-5" />
              <span className="text-[10px] font-semibold">Illisible</span>
            </span>
          ))}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {image.status === "done" && image.width > 0 && (
          <p className="text-xs text-ink-dim">
            {image.width} × {image.height} px
          </p>
        )}
        {optional && image.status === "empty" && (
          <p className="text-xs text-ink-dim">
            Sans visuel, la section s&apos;affiche en carte de texte.
          </p>
        )}
        <button
          type="button"
          onClick={onPick}
          disabled={working}
          className="flex w-fit items-center gap-1.5 rounded-lg bg-raised px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:bg-line disabled:opacity-50"
        >
          <ImageIcon className="size-3.5" />
          {image.status === "empty" ? "Choisir une image" : "Remplacer l'image"}
        </button>
      </div>
    </div>
  );
}

/**
 * Éditeur d'un bloc. Les blocs produit (hero, galerie, description,
 * formulaire) n'ont rien à régler : ils tirent tout du produit, et ce
 * composant ne rend alors rien.
 */
export function BlockEditor({
  draft,
  patch,
  onPickImage,
  onRetryImage,
  onRegenerate,
}: {
  draft: Draft;
  patch: (changes: Partial<Draft>) => void;
  onPickImage: () => void;
  onRetryImage: () => void;
  /** Recompose le visuel de la section. Absent quand il n'y a pas de consigne. */
  onRegenerate?: () => void;
}) {
  switch (draft.type) {
    case "image":
      return <ImageEditor image={draft} onPick={onPickImage} onRetry={onRetryImage} />;

    case "text":
      return (
        <div className="flex flex-col gap-2">
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titre (optionnel)"
            maxLength={LANDING_LIMITS.title}
            dir="auto"
            className={inputClass}
          />
          <textarea
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Paragraphe"
            rows={4}
            maxLength={LANDING_LIMITS.body}
            dir="auto"
            className={inputClass}
          />
        </div>
      );

    case "showcase":
      return (
        <div className="flex flex-col gap-3">
          <ImageEditor
            image={draft.image}
            optional
            onPick={onPickImage}
            onRetry={onRetryImage}
          />

          {draft.brief && (
            /* Consigne du visuel : c'est la seule chose qui change entre deux
               générations, donc la seule chose à pouvoir corriger. Le produit,
               lui, vient toujours des photos — aucune consigne ne peut le
               redessiner. */
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-raised p-3">
              <div className="flex items-center gap-1.5">
                <WandSparkles className="size-3.5 text-accent" />
                <Label>Scène du visuel</Label>
              </div>
              <textarea
                value={draft.brief.scene}
                onChange={(e) =>
                  patch({ brief: { ...draft.brief!, scene: e.target.value } })
                }
                rows={2}
                maxLength={800}
                placeholder="on a dark slate surface, moody side lighting…"
                className={inputClass}
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={draft.brief.ratio}
                  onChange={(e) =>
                    patch({
                      brief: {
                        ...draft.brief!,
                        ratio: e.target.value as ImageBrief["ratio"],
                      },
                    })
                  }
                  aria-label="Cadrage"
                  className={`${inputClass} w-28`}
                >
                  {IMAGE_RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={!onRegenerate || draft.image.status === "generating"}
                  className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-xs font-semibold text-ink-soft ring-1 ring-line transition hover:bg-raised disabled:opacity-50"
                >
                  {draft.image.status === "generating" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3.5" />
                  )}
                  Recomposer le visuel
                </button>
              </div>
              <p className="text-xs leading-relaxed text-ink-faint">
                Décrivez seulement ce qui entoure le produit — surface, lumière,
                arrière-plan. Le produit est repris tel quel de vos photos, et le
                texte de l&apos;affiche est déjà gravé dans le visuel.
              </p>
            </div>
          )}
        </div>
      );

    case "problem":
      return (
        <div className="flex flex-col gap-3">
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titre (ex. Fatigué des montres qui…)"
            maxLength={LANDING_LIMITS.title}
            dir="auto"
            className={inputClass}
          />
          <textarea
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Le problème, en deux phrases"
            rows={3}
            maxLength={LANDING_LIMITS.body}
            dir="auto"
            className={inputClass}
          />
          <div className="flex flex-col gap-1.5">
            <Label>Symptômes — 3 maximum affichés</Label>
            <ItemList
              items={draft.items}
              onChange={(items) => patch({ items })}
              withHint={false}
              max={3}
            />
          </div>
        </div>
      );

    case "features":
      return (
        <div className="flex flex-col gap-3">
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titre de la grille"
            maxLength={LANDING_LIMITS.title}
            dir="auto"
            className={inputClass}
          />
          <ItemList
            items={draft.items}
            onChange={(items) => patch({ items })}
            withHint
            max={LANDING_LIMITS.items}
          />
        </div>
      );

    case "compare":
      return (
        <div className="flex flex-col gap-3">
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titre (ex. La différence dès le premier jour)"
            maxLength={LANDING_LIMITS.title}
            dir="auto"
            className={inputClass}
          />
          {(["before", "after"] as const).map((key) => {
            const side = draft[key];
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <Label>{key === "before" ? "Colonne « avant »" : "Colonne « après »"}</Label>
                <input
                  value={side.label}
                  onChange={(e) => patch({ [key]: { ...side, label: e.target.value } })}
                  placeholder={key === "before" ? "Avant" : "Après"}
                  maxLength={LANDING_LIMITS.label}
                  dir="auto"
                  className={inputClass}
                />
                <StringList
                  values={side.points}
                  onChange={(points) => patch({ [key]: { ...side, points } })}
                  placeholder="Argument court"
                  max={LANDING_LIMITS.points}
                  addLabel="Ajouter un argument"
                />
              </div>
            );
          })}
        </div>
      );

    case "faq":
      return (
        <div className="flex flex-col gap-3">
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titre (ex. Questions fréquentes)"
            maxLength={LANDING_LIMITS.title}
            dir="auto"
            className={inputClass}
          />
          <QuestionList items={draft.items} onChange={(items) => patch({ items })} />
        </div>
      );

    case "reviews":
      return (
        <div className="flex flex-col gap-3">
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titre (ex. Ils l'ont reçue)"
            maxLength={LANDING_LIMITS.title}
            dir="auto"
            className={inputClass}
          />
          <ReviewList items={draft.items} onChange={(items) => patch({ items })} />
        </div>
      );

    case "cta":
      return (
        <div className="flex flex-col gap-2">
          <input
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Titre de la relance"
            maxLength={LANDING_LIMITS.title}
            dir="auto"
            className={inputClass}
          />
          <textarea
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Argument final (optionnel)"
            rows={2}
            maxLength={LANDING_LIMITS.body}
            dir="auto"
            className={inputClass}
          />
          <input
            value={draft.label}
            onChange={(e) => patch({ label: e.target.value })}
            placeholder="Texte du bouton"
            maxLength={LANDING_LIMITS.label}
            dir="auto"
            className={inputClass}
          />
        </div>
      );

    default:
      return null;
  }
}
