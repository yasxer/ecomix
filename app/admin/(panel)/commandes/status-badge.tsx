import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUSES } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  en_attente: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  confirmee: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  annulee: "bg-red-50 text-red-700 ring-1 ring-red-600/20",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={`admin-chip ${STYLES[status]}`}
    >
      {label}
    </span>
  );
}

/** Badge pour le statut de suivi renvoyé par Yalidine (Livré, Expédié, Retour...). */
export function YalidineStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let style = "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20";
  if (s.includes("livré")) style = "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20";
  else if (s.includes("retour") || s.includes("échoué") || s.includes("echec") || s.includes("échec"))
    style = "bg-red-50 text-red-700 ring-1 ring-red-600/20";
  else if (s.includes("sorti en livraison"))
    style = "bg-sky-50 text-sky-700 ring-1 ring-sky-600/20";
  else if (s.includes("préparation") || s.includes("pas encore"))
    style = "bg-zinc-50 text-zinc-600 ring-1 ring-zinc-300";

  return (
    <span
      className={`admin-chip ${style}`}
    >
      {status}
    </span>
  );
}
