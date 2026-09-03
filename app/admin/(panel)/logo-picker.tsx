"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { prepareImage } from "@/lib/prepare-image";

/**
 * Choix d'un logo, partagé par la vitrine d'un produit et les réglages de la
 * plateforme. Le fichier n'est pas envoyé ici : il reste dans l'input du
 * formulaire (`name="logo"`), c'est l'action qui l'uploade à
 * l'enregistrement — et `remove_logo` demande le retrait de l'actuel.
 */
export function LogoPicker({
  currentUrl,
  onBusyChange,
}: {
  currentUrl: string | null;
  /** Une conversion en cours doit bloquer l'enregistrement. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [removeLogo, setRemoveLogo] = useState(false);
  // Aperçu local du logo choisi : visible avant tout envoi au serveur
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // L'URL objet est libérée dès qu'elle est remplacée ou que l'aperçu disparaît
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  /**
   * Le logo suit le même traitement que les images produit : décodé (HEIC
   * compris) puis réencodé en WebP, sans quoi une photo iPhone ressortirait
   * illisible pour tous les navigateurs sauf Safari. Le fichier converti
   * remplace celui de l'input, c'est lui que le formulaire enverra.
   */
  async function handleChange(file: File | undefined) {
    setError(null);
    if (!file) {
      setPreview(null);
      return;
    }
    // Choisir une image annule une demande de retrait en cours
    setRemoveLogo(false);
    setBusy(true);
    try {
      const converted = await prepareImage(file);
      const transfer = new DataTransfer();
      transfer.items.add(converted);
      if (inputRef.current) inputRef.current.files = transfer.files;
      setPreview(URL.createObjectURL(converted));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion échouée.");
      clearChoice();
    } finally {
      setBusy(false);
    }
  }

  function clearChoice() {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-sm font-medium text-ink-soft">Logo</span>
      <div className="flex flex-wrap items-start gap-4">
        {currentUrl && !removeLogo && (
          <figure className="flex flex-col items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentUrl}
              alt="Logo actuel"
              className={`size-16 rounded-xl object-contain ring-1 ring-line transition ${
                preview ? "opacity-40" : ""
              }`}
            />
            <figcaption className="text-[11px] font-medium text-ink-faint">
              Actuel
            </figcaption>
          </figure>
        )}

        {/* Aperçu du fichier choisi, avant tout envoi au serveur */}
        {preview && (
          <figure className="flex flex-col items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Aperçu du nouveau logo"
              className="size-16 rounded-xl object-contain ring-2 ring-accent"
            />
            <figcaption className="text-[11px] font-semibold text-accent">
              Nouveau
            </figcaption>
          </figure>
        )}

        {removeLogo && <input type="hidden" name="remove_logo" value="1" />}

        <div className="flex flex-col items-start gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-line-strong px-4 py-3 text-sm font-medium text-ink-dim transition hover:border-accent hover:text-accent">
            {busy ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
            {busy
              ? "Conversion…"
              : preview
                ? "Choisir une autre image"
                : currentUrl && !removeLogo
                  ? "Remplacer le logo"
                  : "Choisir un logo"}
            <input
              ref={inputRef}
              type="file"
              name="logo"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleChange(e.target.files?.[0])}
            />
          </label>

          {error && <p className="text-xs font-medium text-danger">{error}</p>}

          {preview ? (
            <button
              type="button"
              onClick={clearChoice}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-dim transition hover:bg-raised"
            >
              <X className="size-3.5" />
              Annuler ce choix
            </button>
          ) : (
            currentUrl &&
            !removeLogo && (
              <button
                type="button"
                onClick={() => setRemoveLogo(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-danger transition hover:bg-danger-soft"
              >
                <Trash2 className="size-3.5" />
                Retirer le logo
              </button>
            )
          )}
        </div>
      </div>

      {preview && (
        <p className="text-xs text-ink-faint">
          Aperçu local — l&apos;image ne sera envoyée qu&apos;à l&apos;enregistrement.
        </p>
      )}
      {removeLogo && (
        <p className="flex flex-wrap items-center gap-2 text-xs text-danger">
          Le logo sera retiré à l&apos;enregistrement.
          <button
            type="button"
            onClick={() => setRemoveLogo(false)}
            className="font-semibold text-ink-dim underline underline-offset-2 hover:text-ink-soft"
          >
            Annuler
          </button>
        </p>
      )}
    </div>
  );
}
