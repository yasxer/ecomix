"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  Package,
  Plus,
  X,
} from "lucide-react";
import {
  BASE_PACK_ID,
  PACK_HIGHLIGHTS,
  type PackHighlight,
  type ProductPack,
} from "@/lib/types";
import { inputClass, labelClass } from "../../ui";

/** Doit rester aligné sur `MAX_PACKS` dans `app/actions/product.ts`. */
const MAX_PACKS = 10;

const HIGHLIGHT_LABELS: Record<PackHighlight, string> = {
  none: "Aucune",
  badge: "Ruban",
  border: "Ruban + bordure animée",
};

/**
 * Les nombres sont tenus en chaîne le temps de la saisie : un `<input
 * type="number">` contrôlé sur un `number` empêche d'effacer le champ pour le
 * retaper, et `Number("")` vaudrait 0 — donc un prix à 0 DA en base.
 */
type PackDraft = {
  id: string;
  label: string;
  quantity: string;
  price: string;
  old_price: string;
  badge: string;
  highlight: PackHighlight;
};
function toDraft(pack: ProductPack): PackDraft {
  return {
    id: pack.id,
    label: pack.label,
    quantity: String(pack.quantity),
    price: String(pack.price),
    old_price: pack.old_price === null ? "" : String(pack.old_price),
    badge: pack.badge ?? "",
    highlight: pack.highlight,
  };
}

/** Un pack sans label, sans quantité ou sans prix serait écarté par le serveur. */
function isComplete(pack: PackDraft): boolean {
  const quantity = Number(pack.quantity);
  const price = Number(pack.price);
  return (
    pack.label.trim().length > 0 &&
    Number.isFinite(quantity) &&
    quantity >= 1 &&
    quantity <= 20 &&
    pack.price.trim().length > 0 &&
    Number.isFinite(price) &&
    price >= 0
  );
}

export function PackEditor({
  initial,
  basePrice,
  onBusyChange,
}: {
  initial: ProductPack[];
  basePrice: number;
  /** Conservé pour que le formulaire parent puisse garder sa logique de blocage. */
  /** Remonte l'upload en cours pour que le formulaire bloque l'enregistrement. */
  onBusyChange: (busy: boolean) => void;
}) {
  const [packs, setPacks] = useState<PackDraft[]>(() => initial.map(toDraft));
  const incomplete = packs.filter((p) => !isComplete(p)).length;

  useEffect(() => {
    onBusyChange(false);
  }, [onBusyChange]);

  function patch(id: string, changes: Partial<PackDraft>) {
    setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));
  }

  function addPack() {
    if (packs.length >= MAX_PACKS) return;
    const quantity = packs.length === 0 ? 2 : packs.length + 1;
    setPacks([
      ...packs,
      {
        id: crypto.randomUUID(),
        label: `Pack ${quantity} pièce${quantity > 1 ? "s" : ""}`,
        quantity: String(quantity),
        price: "",
        old_price: "",
        badge: "",
        highlight: "none",
      },
    ]);
  }

  function removePack(pack: PackDraft) {
    setPacks((prev) => prev.filter((p) => p.id !== pack.id));
  }
  function movePack(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= packs.length) return;
    const next = [...packs];
    [next[index], next[target]] = [next[target], next[index]];
    setPacks(next);
  }

  // Le serveur revalide tout : ce qui part d'ici n'est qu'une proposition.
  const payload = packs.map((p) => ({
    id: p.id,
    label: p.label.trim(),
    quantity: Number(p.quantity),
    price: Number(p.price),
    old_price: p.old_price.trim() ? Number(p.old_price) : null,
    badge: p.badge.trim(),
    highlight: p.highlight,
  }));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-zinc-700">
          Offres groupées (optionnel — ex: 1 pièce, 2 pièces, 3 pièces)
        </span>
        {packs.length > 0 && (
          <span className="text-xs text-zinc-400">
            {packs.length} offre{packs.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {packs.map((pack, index) => {
        const isBasePack = pack.id === BASE_PACK_ID;
        return (
          <div
            key={pack.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <label className={labelClass}>
                  Titre affiché
                  <input
                    value={pack.label}
                    onChange={(e) => patch(pack.id, { label: e.target.value })}
                    disabled={isBasePack}
                    maxLength={60}
                    placeholder="Pack 2 pièces"
                    className={inputClass}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    Nombre de pièces
                    <input
                      value={pack.quantity}
                      onChange={(e) => patch(pack.id, { quantity: e.target.value })}
                      disabled={isBasePack}
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Prix du lot (DA)
                    <input
                      value={pack.price}
                      onChange={(e) => patch(pack.id, { price: e.target.value })}
                      disabled={isBasePack}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="4000"
                      className={inputClass}
                    />
                  </label>
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => movePack(index, -1)}
                  disabled={index === 0}
                  aria-label="Déplacer avant"
                  className="flex size-8 items-center justify-center rounded-lg bg-white text-zinc-500 ring-1 ring-zinc-200 transition hover:text-zinc-900 disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => movePack(index, 1)}
                  disabled={index === packs.length - 1}
                  aria-label="Déplacer après"
                  className="flex size-8 items-center justify-center rounded-lg bg-white text-zinc-500 ring-1 ring-zinc-200 transition hover:text-zinc-900 disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
                {!isBasePack && (
                  <button
                    type="button"
                    onClick={() => removePack(pack)}
                    aria-label={`Supprimer ${pack.label || "l'offre"}`}
                    className="flex size-8 items-center justify-center rounded-lg bg-white text-zinc-400 ring-1 ring-zinc-200 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>
                Ancien prix (DA)
                <input
                  value={isBasePack ? basePrice : Number(pack.quantity) * basePrice || ""}
                  readOnly
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Prix × quantité"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Texte du ruban
                <input
                  value={pack.badge}
                  onChange={(e) => patch(pack.id, { badge: e.target.value })}
                  disabled={isBasePack}
                  maxLength={40}
                  placeholder="الأكثر طلبا"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Mise en avant
                <select
                  value={pack.highlight}
                  onChange={(e) =>
                    patch(pack.id, { highlight: e.target.value as PackHighlight })
                  }
                  disabled={isBasePack}
                  className={inputClass}
                >
                  {PACK_HIGHLIGHTS.map((h) => (
                    <option key={h} value={h}>
                      {HIGHLIGHT_LABELS[h]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        );
      })}

      {packs.length < MAX_PACKS && (
        <button
          type="button"
          onClick={addPack}
          className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-zinc-300 py-3 text-sm font-semibold text-zinc-500 transition hover:border-indigo-400 hover:text-indigo-500"
        >
          <Plus className="size-4" />
          Ajouter une offre
        </button>
      )}

      <input type="hidden" name="packs" value={JSON.stringify(payload)} />

      {incomplete > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
          <CircleAlert className="size-3.5 shrink-0" />
          {incomplete} offre{incomplete > 1 ? "s" : ""} incomplète
          {incomplete > 1 ? "s" : ""} : titre, nombre de pièces (1 à 20) et prix sont
          obligatoires, sinon elle{incomplete > 1 ? "s" : ""} ne sera
          {incomplete > 1 ? "nt" : ""} pas enregistrée{incomplete > 1 ? "s" : ""}.
        </p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-zinc-400">
        <Package className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Dès qu&apos;une offre existe, la landing remplace le sélecteur de quantité par
          ces cartes : le client choisit une offre et paie son prix, et il indique la
          couleur et la taille de chaque pièce. Laissez vide pour vendre à la pièce avec
          le prix ci-dessus.
        </span>
      </p>
    </div>
  );
}
