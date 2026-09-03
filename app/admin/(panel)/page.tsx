import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Inbox,
  Target,
  Wallet,
} from "lucide-react";
import { getAllOrdersForStats, getOrders } from "@/lib/data";
import { ORDER_STATUSES } from "@/lib/types";
import { StatusBadge } from "./commandes/status-badge";
import { PageHeader } from "./page-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "Statistiques — Admin" };

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

/** Montants compacts : « 1 240 000 DA » ne tient pas dans une colonne mobile. */
function formatCompactDA(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toLocaleString("fr-DZ", { maximumFractionDigits: 1 })} M`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("fr-DZ")} k`;
  return n.toLocaleString("fr-DZ");
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Initiales du client, à défaut d'une photo — repère visuel dans une liste. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Chiffre clé. La pastille colorée est le seul endroit où la couleur porte du
 * sens ici : elle rattache la carte à un statut (en attente = ambre, revenus =
 * accent), le reste de la carte reste neutre pour que le nombre domine.
 */
function StatCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  icon: typeof Wallet;
  tone: string;
}) {
  return (
    <div className="admin-card flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-dim">{label}</p>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${tone}`}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-ink">
        {value}
        {unit && <span className="ms-1 text-base font-medium text-ink-faint">{unit}</span>}
      </p>
      <p className="text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [orders, recent] = await Promise.all([
    getAllOrdersForStats(),
    getOrders().then((o) => o.slice(0, 6)),
  ]);

  const today = dayKey(new Date());
  const ordersToday = orders.filter((o) => o.created_at.slice(0, 10) === today).length;
  const pending = orders.filter((o) => o.status === "en_attente").length;
  // Livré = statut de suivi renvoyé par Yalidine
  const delivered = orders.filter((o) =>
    o.yalidine_status?.toLowerCase().includes("livré")
  );
  const revenue = delivered.reduce((sum, o) => sum + Number(o.total), 0);
  const confirmed = orders.filter((o) => o.status === "confirmee").length;
  const cancelled = orders.filter((o) => o.status === "annulee").length;
  const decided = confirmed + cancelled;
  const confirmationRate = decided > 0 ? Math.round((confirmed / decided) * 100) : 0;

  // Commandes des 14 derniers jours
  const days: { key: string; label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    days.push({
      key,
      label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      count: orders.filter((o) => o.created_at.slice(0, 10) === key).length,
    });
  }
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const fortnight = days.reduce((sum, d) => sum + d.count, 0);

  // Couleur de la barre de répartition, accordée au badge du même statut.
  const STATUS_BAR: Record<string, string> = {
    en_attente: "bg-warn",
    confirmee: "bg-ok",
    annulee: "bg-danger",
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Statistiques"
        subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""} au total — ${fortnight} sur les 14 derniers jours.`}
      />

      {/* Chiffres clés */}
      <div className="admin-rise grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Aujourd'hui"
          value={String(ordersToday)}
          hint="Commandes reçues depuis minuit"
          icon={CalendarDays}
          tone="bg-info-soft text-info-ink ring-info/25"
        />
        <StatCard
          label="En attente"
          value={String(pending)}
          hint="À confirmer par téléphone"
          icon={Clock}
          tone="bg-warn-soft text-warn-ink ring-warn/25"
        />
        <StatCard
          label="Revenus livrés"
          value={formatCompactDA(revenue)}
          unit="DA"
          hint={`${delivered.length} colis livré${delivered.length > 1 ? "s" : ""}`}
          icon={Wallet}
          tone="bg-accent-soft text-accent-ink ring-accent/25"
        />
        <StatCard
          label="Confirmation"
          value={String(confirmationRate)}
          unit="%"
          hint={`${confirmed} confirmée${confirmed > 1 ? "s" : ""} sur ${decided} décidée${decided > 1 ? "s" : ""}`}
          icon={Target}
          tone="bg-ok-soft text-ok-ink ring-ok/25"
        />
      </div>

      {/* Graphique 14 jours */}
      <section className="admin-card flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink">Commandes — 14 derniers jours</h2>
          <span className="text-xs text-ink-faint">max {maxCount}/jour</span>
        </div>

        <div className="relative">
          {/* Ligne du maximum : sans repère, la hauteur d'une barre ne se
              compare qu'aux autres barres, jamais à une valeur. */}
          <span className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
          <div className="flex h-28 items-end gap-1 border-b border-line pb-px sm:h-36 sm:gap-1.5">
            {days.map((d) => (
              <div key={d.key} className="group flex flex-1 flex-col items-center gap-1.5">
                {/* Le compte reste visible sur mobile : il n'y a pas de survol au doigt */}
                <span
                  className={`text-[10px] font-semibold tabular-nums text-ink-dim sm:opacity-0 sm:transition sm:group-hover:opacity-100 ${
                    d.count > 0 ? "" : "opacity-0"
                  }`}
                >
                  {d.count}
                </span>
                <div
                  title={`${d.label} — ${d.count} commande${d.count > 1 ? "s" : ""}`}
                  className={`w-full rounded-t-md transition ${
                    d.count > 0
                      ? d.key === today
                        ? "bg-accent"
                        : "bg-accent/30 group-hover:bg-accent/60"
                      : "bg-raised"
                  }`}
                  style={{ height: `${Math.max((d.count / maxCount) * 100, 3)}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between text-[10px] font-medium text-ink-faint">
          <span>{days[0].label}</span>
          <span className="text-accent">Aujourd&apos;hui</span>
        </div>
      </section>

      {/* Répartition par statut */}
      <section className="flex flex-col gap-3">
        <h2 className="admin-eyebrow">Répartition par statut</h2>
        <div className="admin-card admin-divide">
          {ORDER_STATUSES.map((s) => {
            const count = orders.filter((o) => o.status === s.value).length;
            const share = orders.length > 0 ? (count / orders.length) * 100 : 0;
            return (
              <div key={s.value} className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-28 shrink-0">
                  <StatusBadge status={s.value} />
                </div>
                {/* Barre de proportion : lire trois nombres bruts ne dit rien
                    de leur poids relatif. */}
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-raised">
                  <div
                    className={`h-full rounded-full transition-all ${STATUS_BAR[s.value] ?? "bg-line-strong"}`}
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-end text-xs font-medium tabular-nums text-ink-faint">
                  {Math.round(share)}%
                </span>
                <span className="w-8 shrink-0 text-end text-sm font-semibold tabular-nums text-ink">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dernières commandes */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="admin-eyebrow">Dernières commandes</h2>
          <Link
            href="/admin/commandes"
            className="group flex items-center gap-1 text-sm font-medium text-accent transition hover:text-accent-strong"
          >
            Tout voir
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="admin-card flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Inbox className="size-8 text-ink-faint" strokeWidth={1.5} />
            <p className="text-sm text-ink-dim">Aucune commande pour le moment.</p>
          </div>
        ) : (
          <ul className="admin-card admin-divide">
            {recent.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-raised"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold text-ink-dim ring-1 ring-inset ring-line">
                  {initials(o.customer_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {o.customer_name}
                  </p>
                  <p className="truncate text-xs text-ink-dim">
                    {o.phone} — {o.wilaya}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-ink">
                    {formatDA(Number(o.total))}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
