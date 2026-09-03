"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Printer, RotateCcw, Trash2, X } from "lucide-react";
import {
  cancelOrder,
  confirmOrder,
  deleteOrder,
  reopenOrder,
} from "@/app/actions/orders";
import type { OrderStatus } from "@/lib/types";

/**
 * Boutons d'une commande. Sur mobile (jusqu'à `lg`, là où la liste passe en
 * cartes) ils s'étirent pour offrir une vraie cible tactile ; dans le tableau
 * de bureau ils reprennent leur largeur naturelle.
 */
const btn =
  "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition active:scale-[0.99] disabled:opacity-50 lg:min-h-8 lg:flex-none";

const dangerGhost = `${btn} border border-red-200 bg-white text-red-600 hover:bg-red-50`;

export function OrderActions({
  orderId,
  status,
  label,
}: {
  orderId: string;
  status: OrderStatus;
  label: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const run = (action: (id: string) => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action(orderId);
      if (result.error) setError(result.error);
    });
  };

  // Suppression définitive : confirmation en deux temps, pas de clic accidentel
  if (confirmingDelete) {
    return (
      <div className="flex flex-col items-stretch gap-2 lg:items-start">
        <p className="text-[11px] font-semibold leading-tight text-red-600">
          Supprimer définitivement&nbsp;?
          {status === "confirmee" && (
            <span className="block font-normal text-zinc-500">
              Le colis Yalidine sera annulé lui aussi.
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={isPending}
            onClick={() => run(deleteOrder)}
            className={`${btn} bg-red-600 text-white hover:bg-red-700`}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            Oui, supprimer
          </button>
          <button
            disabled={isPending}
            onClick={() => {
              setConfirmingDelete(false);
              setError(null);
            }}
            className={`${btn} border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50`}
          >
            Non
          </button>
        </div>
        {error && (
          <p className="text-[11px] leading-tight text-red-600 lg:max-w-64">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-2 lg:items-start">
      <div className="flex items-center gap-2">
        {status === "en_attente" && (
          <>
            <button
              disabled={isPending}
              onClick={() => run(confirmOrder)}
              className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Confirmer
            </button>
            <button
              disabled={isPending}
              onClick={() => run(cancelOrder)}
              className={dangerGhost}
            >
              <X className="size-3.5" />
              Annuler
            </button>
          </>
        )}

        {status === "confirmee" && (
          <>
            {label && (
              <a
                href={label}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btn} bg-zinc-900 text-white hover:bg-zinc-800`}
              >
                <Printer className="size-3.5" />
                Bordereau
              </a>
            )}
            <button
              disabled={isPending}
              onClick={() => run(cancelOrder)}
              className={dangerGhost}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              Annuler
            </button>
          </>
        )}

        {status === "annulee" && (
          <button
            disabled={isPending}
            onClick={() => run(reopenOrder)}
            className={`${btn} border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50`}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Remettre en attente
          </button>
        )}

        <button
          disabled={isPending}
          onClick={() => setConfirmingDelete(true)}
          title="Supprimer définitivement"
          aria-label="Supprimer définitivement la commande"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 lg:size-8"
        >
          <Trash2 className="size-4 lg:size-3.5" />
        </button>
      </div>
      {error && (
        <p className="text-[11px] leading-tight text-red-600 lg:max-w-64">{error}</p>
      )}
    </div>
  );
}
