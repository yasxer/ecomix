"use client";

import { useActionState, useCallback, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { updateStorefront, type StorefrontFormState } from "@/app/actions/storefront";
import type { FreeDeliveryMode, Product } from "@/lib/types";
import { LogoPicker } from "../../../logo-picker";
import { inputClass, labelClass } from "../../../ui";

const PRESET_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#059669",
  "#dc2626",
  "#ea580c",
  "#d946ef",
  "#0f172a",
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const FREE_DELIVERY_OPTIONS: {
  value: FreeDeliveryMode;
  label: string;
  hint: string;
}[] = [
  {
    value: "none",
    label: "Aucune",
    hint: "Le client paie les frais de livraison Yalidine.",
  },
  {
    value: "stopdesk",
    label: "Stopdesk uniquement",
    hint: "Le bureau est offert, le domicile reste payant — le client choisit.",
  },
  {
    value: "all",
    label: "Tout offert",
    hint: "Plus de choix pour le client : tout part en livraison à domicile.",
  },
];

export function VitrineForm({ product }: { product: Product }) {
  const [state, action, pending] = useActionState<StorefrontFormState, FormData>(
    updateStorefront,
    {}
  );
  const [color, setColor] = useState(product.primary_color);
  // Texte du champ hex : peut être temporairement invalide pendant la saisie
  const [hexInput, setHexInput] = useState(product.primary_color);
  const [logoBusy, setLogoBusy] = useState(false);
  const [freeDeliveryMode, setFreeDeliveryMode] = useState<FreeDeliveryMode>(
    product.free_delivery_mode
  );
  const [pixelId, setPixelId] = useState(product.pixel_id ?? "");
  const [fbDomainVerification, setFbDomainVerification] = useState(
    product.fb_domain_verification ?? ""
  );
  const [active, setActive] = useState(product.active);

  // Référence stable : `LogoPicker` remonte son état dans un effet.
  const handleLogoBusy = useCallback((busy: boolean) => setLogoBusy(busy), []);

  function applyColor(value: string) {
    setColor(value);
    setHexInput(value);
  }

  function handleHexChange(raw: string) {
    let value = raw.trim();
    if (value && !value.startsWith("#")) value = `#${value}`;
    setHexInput(value);
    if (HEX_RE.test(value)) setColor(value.toLowerCase());
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-5 admin-card p-4 sm:p-8"
    >
      <input type="hidden" name="product_id" value={product.id} />

      {/* Domaine et mise en ligne */}
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-raised p-4">
        <label className={labelClass}>
          <span className="flex items-center gap-2">
            <Globe className="size-4 text-accent" />
            Domaine de cette boutique
          </span>
          <input
            name="domain"
            defaultValue={product.domain ?? ""}
            placeholder="ma-boutique.dz"
            spellCheck={false}
            autoCapitalize="off"
            className={inputClass}
          />
          <span className="text-xs font-normal text-ink-faint">
            Le domaine doit aussi être ajouté au projet sur Vercel (Settings →
            Domains) et pointer vers lui chez votre registrar. « www. » et les
            majuscules sont ignorés. Laissez vide pour n&apos;utiliser que
            l&apos;aperçu ci-dessous.
          </span>
        </label>

        <label className={labelClass}>
          Identifiant (aperçu sans domaine)
          <input
            name="slug"
            required
            defaultValue={product.slug}
            spellCheck={false}
            autoCapitalize="off"
            className={inputClass}
          />
          <span className="text-xs font-normal text-ink-faint">
            Page visible sur <code>/p/{product.slug}</code> — pratique pour
            tester avant de brancher le DNS.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="mt-0.5 size-4.5 shrink-0 cursor-pointer accent-accent"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-ink">
              Boutique en ligne
            </span>
            <span className="text-xs text-ink-dim">
              Décochée, la page renvoie une 404 et plus aucune commande n&apos;est
              acceptée — le produit et ses commandes restent intacts.
            </span>
          </span>
        </label>
        <input type="hidden" name="active" value={active ? "1" : "0"} />
      </div>

      <label className={labelClass}>
        Nom de la boutique (affiché sur la landing)
        <input
          name="store_name"
          required
          defaultValue={product.store_name}
          className={inputClass}
        />
      </label>

      <LogoPicker currentUrl={product.logo_url} onBusyChange={handleLogoBusy} />

      {/* Couleur */}
      <div className="flex flex-col gap-2.5">
        <span className="text-sm font-medium text-ink-soft">
          Couleur principale (boutons, prix, accents de la landing)
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyColor(preset)}
              className={`size-9 rounded-full transition ${
                color === preset
                  ? "ring-2 ring-ink ring-offset-2"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: preset }}
              aria-label={`Couleur ${preset}`}
            />
          ))}
        </div>

        {/* Couleur personnalisée : pipette + code hex saisi à la main */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-raised p-3">
          <label className="relative flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-line-strong transition">
            <input
              type="color"
              value={color}
              onChange={(e) => applyColor(e.target.value)}
              className="absolute -inset-2 size-16 cursor-pointer border-0 p-0"
              aria-label="Ouvrir la palette de couleurs"
            />
          </label>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-ink-soft">
              Couleur personnalisée
            </span>
            <input
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              placeholder="#4f46e5"
              maxLength={7}
              spellCheck={false}
              className={`w-28 rounded-lg border bg-surface px-2.5 py-1.5 font-mono text-sm outline-none transition ${
                HEX_RE.test(hexInput)
                  ? "border-line text-ink focus:border-accent"
                  : "border-danger/45 text-danger"
              }`}
              aria-label="Code couleur hexadécimal"
            />
          </div>
          {!HEX_RE.test(hexInput) && (
            <span className="text-xs font-medium text-danger">
              Format : #rrggbb (ex. #e11d48)
            </span>
          )}
          <input type="hidden" name="primary_color" value={color} />
        </div>

        {/* Aperçu */}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span
            className="flex items-center rounded-xl px-5 py-3 text-sm font-bold text-white shadow-md"
            style={{ backgroundColor: color, boxShadow: `0 4px 14px ${color}55` }}
          >
            Aperçu du bouton
          </span>
          <span className="text-2xl font-extrabold" style={{ color }}>
            12 500 DA
          </span>
        </div>
      </div>

      {/* Livraison offerte */}
      <div className="flex flex-col gap-2.5 rounded-lg border border-line bg-raised p-4">
        <span className="text-sm font-medium text-ink-soft">Livraison offerte</span>
        <div className="flex flex-col gap-1">
          {FREE_DELIVERY_OPTIONS.map(({ value, label, hint }) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition ${
                freeDeliveryMode === value
                  ? "border border-accent-line bg-surface"
                  : "border border-transparent"
              }`}
            >
              <input
                type="radio"
                name="free_delivery_mode"
                value={value}
                checked={freeDeliveryMode === value}
                onChange={() => setFreeDeliveryMode(value)}
                className="mt-0.5 size-4.5 shrink-0 cursor-pointer accent-accent"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{label}</span>
                <span className="text-xs text-ink-dim">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {freeDeliveryMode !== "none" && (
          <p className="flex items-start gap-2 rounded-lg border border-warn/35 bg-warn-soft px-3 py-2.5 text-xs leading-relaxed text-warn-ink">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {freeDeliveryMode === "all"
              ? "Yalidine prélève quand même ses frais sur votre versement, et c'est le tarif domicile — le plus cher — qui est absorbé à chaque commande."
              : "Yalidine prélève quand même ses frais de bureau sur votre versement. Le tarif Stopdesk reste le moins cher, et cette offre pousse les clients vers cette option."}
          </p>
        )}
      </div>

      <label className={labelClass}>
        Meta Pixel ID (Facebook) — optionnel
        <div className="flex items-center gap-2">
          <input
            name="pixel_id"
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value.replace(/\D/g, ""))}
            placeholder="123456789012345"
            inputMode="numeric"
            className={inputClass}
          />
          {pixelId && (
            <button
              type="button"
              onClick={() => setPixelId("")}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-soft"
            >
              <Trash2 className="size-4" />
              Retirer
            </button>
          )}
        </div>
        <span className="text-xs font-normal text-ink-faint">
          Un pixel par boutique : Meta Business Suite → Gestionnaire
          d&apos;événements → votre Pixel → l&apos;ID numérique. Partager le même
          pixel entre deux domaines mélangerait les conversions de vos
          campagnes. Videz le champ (ou cliquez Retirer) puis Enregistrer pour
          désactiver complètement le pixel sur cette landing.
        </span>
      </label>

      <label className={labelClass}>
        Vérification de domaine Facebook — optionnel
        <div className="flex items-center gap-2">
          <input
            name="fb_domain_verification"
            value={fbDomainVerification}
            onChange={(e) => setFbDomainVerification(e.target.value.trim())}
            placeholder="ex: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
            spellCheck={false}
            className={inputClass}
          />
          {fbDomainVerification && (
            <button
              type="button"
              onClick={() => setFbDomainVerification("")}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger-soft"
            >
              <Trash2 className="size-4" />
              Retirer
            </button>
          )}
        </div>
        <span className="text-xs font-normal text-ink-faint">
          Meta Business Suite → Paramètres → Sécurité de la marque → Domaines →
          Ajouter le domaine de CETTE boutique → choisissez
          &laquo;&nbsp;Vérification par balise meta&nbsp;&raquo; → collez ici uniquement le
          code dans <code>content=&quot;...&quot;</code> (pas toute la balise). Nécessaire
          pour que Facebook associe correctement le Pixel à ce site lors de la
          création d&apos;une campagne.
        </span>
      </label>

      {state.error && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="flex items-center gap-2 rounded-xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok-ink">
          <CheckCircle2 className="size-4" />
          Vitrine enregistrée.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || logoBusy}
        className="admin-btn-primary w-full sm:w-fit"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        Enregistrer
      </button>
    </form>
  );
}
