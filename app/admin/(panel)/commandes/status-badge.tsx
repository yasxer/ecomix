import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUSES } from "@/lib/types";

/**
 * Les couleurs passent par les jetons de statut (`ok`, `warn`, `danger`,
 * `info`) : la teinte de fond et l'encre s'inversent avec le thème, une
 * palette figée (`bg-amber-50 text-amber-700`) resterait illisible en sombre.
 */
const STYLES: Record<OrderStatus, string> = {
  en_attente: "bg-warn-soft text-warn-ink ring-warn/30",
  confirmee: "bg-ok-soft text-ok-ink ring-ok/30",
  annulee: "bg-danger-soft text-danger-ink ring-danger/30",
};

const DOTS: Record<OrderStatus, string> = {
  en_attente: "bg-warn",
  confirmee: "bg-ok",
  annulee: "bg-danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span className={`admin-chip ${STYLES[status]}`}>
      {/* Une pastille pleine double la couleur : le statut reste distinguable
          en niveaux de gris comme pour un daltonien. */}
      <span className={`size-1.5 rounded-full ${DOTS[status]}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Badge pour le statut de suivi renvoyé par Yalidine (Livré, Expédié, Retour...). */
export function YalidineStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let style = "bg-accent-soft text-accent-ink ring-accent/30";
  if (s.includes("livré")) style = "bg-ok-soft text-ok-ink ring-ok/30";
  else if (
    s.includes("retour") ||
    s.includes("échoué") ||
    s.includes("echec") ||
    s.includes("échec")
  )
    style = "bg-danger-soft text-danger-ink ring-danger/30";
  else if (s.includes("sorti en livraison"))
    style = "bg-info-soft text-info-ink ring-info/30";
  else if (s.includes("préparation") || s.includes("pas encore"))
    style = "bg-raised text-ink-dim ring-line-strong";

  return <span className={`admin-chip ${style}`}>{status}</span>;
}
