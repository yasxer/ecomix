"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import {
  createProductUploadUrls,
  discardProductImage,
  updateProduct,
  type ProductFormState,
} from "@/app/actions/product";
import { MAX_SOURCE_SIZE, prepareImage } from "@/lib/prepare-image";
import { mapLimit, putToSignedUrl } from "@/lib/upload-client";
import type { Product, ProductColor } from "@/lib/types";
import { PackEditor } from "./pack-editor";
import { inputClass, labelClass } from "../../ui";

/** Taille des lots d'URLs signées demandées au serveur (voir `MAX_BATCH`). */
const BATCH_SIZE = 40;
/** Conversions menées de front. Le canvas travaille sur le thread principal. */
const CONVERT_CONCURRENCY = 3;

type ImageItem = {
  id: string;
  /** Aperçu affiché ; `null` tant que la conversion n'a pas produit de WebP. */
  preview: string | null;
  /** URL publique Supabase, connue une fois l'upload terminé. */
  url: string | null;
  status: "preparing" | "uploading" | "done" | "error";
  progress: number;
  /** Uploadée dans cette session : peut être effacée du storage si retirée. */
  isNew: boolean;
  /** Fichier converti, conservé pour permettre un réessai. */
  file?: File;
  error?: string;
};

export function ProductForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(
    updateProduct,
    {}
  );

  // Images : uploadées directement vers Supabase depuis le navigateur, donc
  // sans limite de nombre ni de poids total (les Server Actions plafonnent).
  const [items, setItems] = useState<ImageItem[]>(() =>
    product.images.map((url) => ({
      id: url,
      preview: url,
      url,
      status: "done" as const,
      progress: 100,
      isNew: false,
    }))
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadedUrls = items.flatMap((it) =>
    it.status === "done" && it.url ? [it.url] : []
  );
  // L'éditeur de packs uploade lui aussi : enregistrer pendant un envoi
  // écrirait un pack sans photo.
  const [packsBusy, setPacksBusy] = useState(false);
  const busy =
    packsBusy ||
    items.some((it) => it.status === "preparing" || it.status === "uploading");
  const failedCount = items.filter((it) => it.status === "error").length;

  // Les objectURL d'aperçu sont libérés au démontage du formulaire.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(
    () => () => {
      for (const it of itemsRef.current) {
        if (it.preview?.startsWith("blob:")) URL.revokeObjectURL(it.preview);
      }
    },
    []
  );

  function patchItem(id: string, changes: Partial<ImageItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }

  function uploadBatch(entries: { id: string; file: File }[]) {
    startTransition(async () => {
      const result = await createProductUploadUrls(
        entries.map(({ file }) => ({ name: file.name, type: file.type, size: file.size }))
      );
      if (!result.targets) {
        setImageError(result.error ?? "Upload impossible.");
        for (const { id } of entries) patchItem(id, { status: "error", progress: 0 });
        return;
      }
      const targets = result.targets;
      await Promise.all(
        entries.map(async ({ id, file }, i) => {
          try {
            await putToSignedUrl(targets[i].signedUrl, file, (percent) =>
              patchItem(id, { progress: percent })
            );
            patchItem(id, { status: "done", progress: 100, url: targets[i].publicUrl });
          } catch {
            patchItem(id, { status: "error", progress: 0 });
          }
        })
      );
    });
  }

  async function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    // Réinitialisé pour que resélectionner le même fichier redéclenche `change`,
    // et pour que chaque sélection s'ajoute aux précédentes au lieu de les remplacer.
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

    const entries = accepted.map((source) => ({ id: crypto.randomUUID(), source }));
    setItems((prev) => [
      ...prev,
      ...entries.map(({ id }) => ({
        id,
        preview: null,
        url: null,
        status: "preparing" as const,
        progress: 0,
        isNew: true,
      })),
    ]);

    // Décodage (HEIC compris), redimensionnement et réencodage en WebP avant
    // le moindre octet envoyé : ce qui part est lisible par tous les navigateurs.
    const ready: { id: string; file: File }[] = [];
    await mapLimit(entries, CONVERT_CONCURRENCY, async ({ id, source }) => {
      try {
        const file = await prepareImage(source);
        patchItem(id, {
          file,
          preview: URL.createObjectURL(file),
          status: "uploading",
        });
        ready.push({ id, file });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Conversion échouée.";
        setImageError(message);
        patchItem(id, { status: "error", error: message });
      }
    });

    for (let i = 0; i < ready.length; i += BATCH_SIZE) {
      uploadBatch(ready.slice(i, i + BATCH_SIZE));
    }
  }

  function retryItem(item: ImageItem) {
    if (!item.file) return;
    setImageError(null);
    patchItem(item.id, { status: "uploading", progress: 0 });
    uploadBatch([{ id: item.id, file: item.file }]);
  }

  function removeItem(item: ImageItem) {
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    if (item.preview?.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    // Uploadée puis retirée avant enregistrement : inutile de la laisser
    // traîner dans le storage. Les images déjà enregistrées, elles, ne sont
    // supprimées qu'après un enregistrement réussi (côté serveur).
    if (item.isNew && item.url) {
      const url = item.url;
      startTransition(async () => {
        await discardProductImage(product.id, url);
      });
    }
  }

  function moveItem(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  // Couleurs disponibles du produit
  const [colors, setColors] = useState<ProductColor[]>(product.colors);
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("#111111");

  // Tailles disponibles du produit
  const [sizes, setSizes] = useState<string[]>(product.sizes);
  const [newSize, setNewSize] = useState("");

  function addColor() {
    const name = newColorName.trim();
    if (!name || colors.some((c) => c.name.toLowerCase() === name.toLowerCase()))
      return;
    setColors([...colors, { name, hex: newColorHex }]);
    setNewColorName("");
  }

  function addSize() {
    const size = newSize.trim();
    if (!size || sizes.some((s) => s.toLowerCase() === size.toLowerCase())) return;
    setSizes([...sizes, size]);
    setNewSize("");
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-5 admin-card p-4 sm:p-8"
    >
      <input type="hidden" name="product_id" value={product.id} />

      <label className={labelClass}>
        Nom du produit
        <input name="name" required defaultValue={product.name} className={inputClass} />
      </label>

      <label className={labelClass}>
        Description
        <textarea
          name="description"
          rows={5}
          defaultValue={product.description}
          className={inputClass}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Prix (DA)
          <input
            name="price"
            type="number"
            min="0"
            step="any"
            required
            defaultValue={product.price}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Ancien prix (DA) — optionnel, affiché barré
          <input
            name="old_price"
            type="number"
            min="0"
            step="any"
            defaultValue={product.old_price ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <p className="rounded-xl bg-zinc-50 px-4 py-3 text-xs text-zinc-500">
        Les frais de livraison sont récupérés automatiquement depuis votre compte
        Yalidine selon la wilaya du client.
      </p>

      <label className={labelClass}>
        Points forts (un par ligne, affichés avec une coche sur la landing)
        <textarea
          name="features"
          rows={4}
          defaultValue={product.features.join("\n")}
          placeholder={"Livraison rapide\nMatériau premium\nGarantie 1 an"}
          className={inputClass}
        />
      </label>

      {/* Couleurs disponibles */}
      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-medium text-zinc-700">
          Couleurs disponibles (optionnel — le client devra en choisir une)
        </span>
        {colors.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <span
                key={c.name}
                className="flex items-center gap-2 rounded-full bg-zinc-50 py-1.5 pl-2 pr-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200"
              >
                <span
                  className="size-5 rounded-full ring-1 ring-zinc-900/10"
                  style={{ backgroundColor: c.hex }}
                />
                {c.name}
                <button
                  type="button"
                  onClick={() => setColors(colors.filter((x) => x.name !== c.name))}
                  aria-label={`Supprimer ${c.name}`}
                  className="flex size-5 items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-100 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl ring-1 ring-zinc-200">
            <input
              type="color"
              value={newColorHex}
              onChange={(e) => setNewColorHex(e.target.value)}
              className="absolute -inset-2 size-14 cursor-pointer border-0 p-0"
              aria-label="Choisir la couleur"
            />
          </label>
          <input
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addColor();
              }
            }}
            placeholder="Nom (ex: Noir, Or, Bleu roi...)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addColor}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            <Plus className="size-4" />
            Ajouter
          </button>
        </div>
        <input type="hidden" name="colors" value={JSON.stringify(colors)} />
      </div>

      {/* Tailles disponibles */}
      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-medium text-zinc-700">
          Tailles disponibles (optionnel — ex: S, M, L ou 40, 41, 42)
        </span>
        {sizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <span
                key={s}
                className="flex items-center gap-1.5 rounded-full bg-zinc-50 py-1.5 pl-3 pr-1.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200"
              >
                {s}
                <button
                  type="button"
                  onClick={() => setSizes(sizes.filter((x) => x !== s))}
                  aria-label={`Supprimer ${s}`}
                  className="flex size-5 items-center justify-center rounded-full text-zinc-400 transition hover:bg-red-100 hover:text-red-600"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSize();
              }
            }}
            placeholder="Taille (ex: M)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={addSize}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
          >
            <Plus className="size-4" />
            Ajouter
          </button>
        </div>
        <input type="hidden" name="sizes" value={JSON.stringify(sizes)} />
      </div>

      {/* Offres groupées */}
      <PackEditor
        initial={product.packs}
        basePrice={product.price}
        onBusyChange={setPacksBusy}
      />

      {/* Images */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-zinc-700">Images du produit</span>
          {items.length > 0 && (
            <span className="text-xs text-zinc-400">
              {items.length} image{items.length > 1 ? "s" : ""}
              {busy && " — traitement en cours…"}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {items.map((item, index) => (
            <div key={item.id} className="group relative">
              {item.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.preview}
                  alt=""
                  className="size-24 rounded-xl object-cover ring-1 ring-zinc-200"
                />
              ) : (
                <div className="size-24 rounded-xl bg-zinc-100 ring-1 ring-zinc-200" />
              )}

              {item.status === "preparing" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-zinc-900/10">
                  <Loader2 className="size-5 animate-spin text-zinc-500" />
                  <span className="text-[10px] font-medium text-zinc-500">Conversion…</span>
                </div>
              )}

              {item.status === "uploading" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-zinc-900/55">
                  <Loader2 className="size-5 animate-spin text-white" />
                  <div className="h-1 w-14 overflow-hidden rounded-full bg-white/30">
                    <div
                      className="h-full rounded-full bg-white transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {item.status === "error" &&
                (item.file ? (
                  <button
                    type="button"
                    onClick={() => retryItem(item)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-red-600/75 text-white"
                    title={item.error}
                  >
                    <RotateCcw className="size-5" />
                    <span className="text-[10px] font-semibold">Réessayer</span>
                  </button>
                ) : (
                  // Échec de conversion : réessayer le même fichier ne servirait à rien.
                  <span
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-red-600/75 px-1 text-center text-white"
                    title={item.error}
                  >
                    <CircleAlert className="size-5" />
                    <span className="text-[10px] font-semibold">Illisible</span>
                  </span>
                ))}

              {item.status === "done" && index === 0 && (
                <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded-md bg-zinc-900/70 py-0.5 text-center text-[10px] font-semibold text-white">
                  Principale
                </span>
              )}

              {item.status === "done" && items.length > 1 && (
                <div className="absolute left-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    aria-label="Déplacer avant"
                    className="flex size-6 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow transition hover:bg-white disabled:opacity-30"
                  >
                    <ArrowLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Déplacer après"
                    className="flex size-6 items-center justify-center rounded-full bg-white/90 text-zinc-700 shadow transition hover:bg-white disabled:opacity-30"
                  >
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => removeItem(item)}
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition hover:bg-red-600"
                aria-label="Supprimer l'image"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}

          <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 transition hover:border-indigo-400 hover:text-indigo-500">
            <ImagePlus className="size-6" />
            <span className="text-[10px] font-medium">Ajouter</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        </div>

        <input type="hidden" name="images" value={JSON.stringify(uploadedUrls)} />

        {imageError && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
            <CircleAlert className="size-3.5 shrink-0" />
            {imageError}
          </p>
        )}
        {failedCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <CircleAlert className="size-3.5 shrink-0" />
            {failedCount} image{failedCount > 1 ? "s" : ""} en échec : cliquez dessus pour
            réessayer, sinon elle{failedCount > 1 ? "s" : ""} ne sera
            {failedCount > 1 ? "nt" : ""} pas enregistrée{failedCount > 1 ? "s" : ""}.
          </p>
        )}
        <p className="text-xs text-zinc-400">
          Autant d&apos;images que vous voulez. Chaque photo — y compris les HEIC de
          l&apos;iPhone — est convertie en WebP et redimensionnée dans votre navigateur,
          puis envoyée aussitôt. Survolez une image pour changer son ordre : la première
          est affichée en grand sur la landing.
        </p>
      </div>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="submit"
          disabled={pending || busy}
          className="admin-btn-primary sm:w-fit"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
          Enregistrer
        </button>
        <Link
          href={`/admin/produits/${product.id}`}
          className="admin-btn text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 sm:w-fit"
        >
          Annuler
        </Link>
      </div>
    </form>
  );
}
