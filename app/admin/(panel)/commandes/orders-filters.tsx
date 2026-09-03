"use client";

import { useState } from "react";
import { ChevronDown, Filter, Search, X } from "lucide-react";
import { ORDER_STATUSES } from "@/lib/types";
import { WILAYAS } from "@/lib/wilayas";

export type FilterValues = {
  q: string;
  product: string;
  status: string;
  wilaya: string;
  from: string;
  to: string;
};

const fieldClass = "admin-field";

/**
 * Filtres des commandes. Formulaire GET : il fonctionne sans JavaScript, le
 * client ne sert qu'à replier les critères secondaires sur mobile — six champs
 * dépliés y occupaient tout l'écran avant la première commande.
 */
export function OrdersFilters({
  values,
  products,
}: {
  values: FilterValues;
  products: { id: string; name: string }[];
}) {
  // Un filtre déjà actif ouvre le panneau : sinon on ne verrait pas pourquoi
  // la liste est incomplète.
  const activeCount = [
    values.product,
    values.status,
    values.wilaya,
    values.from,
    values.to,
  ].filter(Boolean).length;
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <form method="GET" className="admin-card flex flex-col gap-3 p-3 sm:p-4">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            name="q"
            defaultValue={values.q}
            placeholder="Nom ou téléphone…"
            className={`${fieldClass} pl-9`}
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`admin-btn shrink-0 border sm:hidden ${
            activeCount > 0
              ? "border-accent-line bg-accent-soft text-accent-ink"
              : "border-line-strong bg-surface text-ink-soft"
          }`}
        >
          <Filter className="size-4" />
          {activeCount > 0 && activeCount}
          <ChevronDown
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        <button
          type="submit"
          className="admin-btn-primary hidden shrink-0 sm:flex"
        >
          <Filter className="size-4" />
          Filtrer
        </button>
      </div>

      {/* Critères secondaires : toujours visibles à partir de `sm` */}
      <div
        className={`flex-col gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-end ${
          open ? "flex" : "hidden"
        }`}
      >
        {products.length > 1 && (
          <select
            name="product"
            defaultValue={values.product}
            aria-label="Boutique"
            className={`${fieldClass} sm:w-auto`}
          >
            <option value="">Toutes les boutiques</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <select
          name="status"
          defaultValue={values.status}
          aria-label="Statut"
          className={`${fieldClass} sm:w-auto`}
        >
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          name="wilaya"
          defaultValue={values.wilaya}
          aria-label="Wilaya"
          className={`${fieldClass} sm:w-auto`}
        >
          <option value="">Toutes les wilayas</option>
          {WILAYAS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-dim">
            Du
            <input
              type="date"
              name="from"
              defaultValue={values.from}
              className={`${fieldClass} sm:w-auto`}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-dim">
            Au
            <input
              type="date"
              name="to"
              defaultValue={values.to}
              className={`${fieldClass} sm:w-auto`}
            />
          </label>
        </div>

        <div className="flex gap-2 sm:hidden">
          <button type="submit" className="admin-btn-primary flex-1">
            <Filter className="size-4" />
            Filtrer
          </button>
          {activeCount > 0 && (
            <a href="/admin/commandes" className="admin-btn-ghost shrink-0">
              <X className="size-4" />
              Effacer
            </a>
          )}
        </div>
      </div>
    </form>
  );
}
