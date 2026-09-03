import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

  const stats = [
    { label: "Aujourd'hui", value: String(ordersToday), unit: "" },
    { label: "En attente", value: String(pending), unit: "" },
    { label: "Revenus livrés", value: formatCompactDA(revenue), unit: "DA" },
    { label: "Confirmation", value: String(confirmationRate), unit: "%" },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title="Statistiques"
        subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""} au total`}
      />

      {/* Chiffres clés — pas de cartes empilées : une grille séparée par des
          traits d'un pixel (`gap-px` sur fond gris), comme la liste des points
          forts de la landing. La donnée porte l'attention, pas le contenant. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
        {stats.map(({ label, value, unit }) => (
          <div key={label} className="bg-white px-4 py-4 sm:px-5">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              {value}
              {unit && (
                <span className="ms-1 text-sm font-medium text-zinc-400">{unit}</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Graphique 14 jours */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="admin-eyebrow">Commandes — 14 derniers jours</h2>
          <span className="text-xs text-zinc-400">max {maxCount}/jour</span>
        </div>
        <div className="flex h-28 items-end gap-1 border-b border-zinc-200 pb-px sm:h-36 sm:gap-1.5">
          {days.map((d) => (
            <div key={d.key} className="group flex flex-1 flex-col items-center gap-1.5">
              {/* Le compte reste visible sur mobile : il n'y a pas de survol au doigt */}
              <span
                className={`text-[10px] font-medium tabular-nums text-zinc-500 sm:opacity-0 sm:group-hover:opacity-100 ${
                  d.count > 0 ? "" : "opacity-0"
                }`}
              >
                {d.count}
              </span>
              <div
                className={`w-full rounded-t-sm transition ${
                  d.count > 0
                    ? d.key === today
                      ? "bg-indigo-600"
                      : "bg-indigo-200 group-hover:bg-indigo-400"
                    : "bg-zinc-100"
                }`}
                style={{ height: `${Math.max((d.count / maxCount) * 100, 3)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="hidden justify-between text-[10px] text-zinc-400 sm:flex">
          <span>{days[0].label}</span>
          <span>{days[days.length - 1].label}</span>
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
              <div key={s.value} className="flex items-center gap-3 px-4 py-3">
                <StatusBadge status={s.value} />
                {/* Barre de proportion : lire trois nombres bruts ne dit rien
                    de leur poids relatif. */}
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-zinc-300"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-end text-sm font-semibold tabular-nums text-zinc-900">
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
            className="flex items-center gap-1 text-sm font-medium text-indigo-600 transition hover:text-indigo-700"
          >
            Tout voir
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="admin-card px-4 py-10 text-center text-sm text-zinc-400">
            Aucune commande pour le moment.
          </p>
        ) : (
          <ul className="admin-card admin-divide">
            {recent.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {o.customer_name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {o.phone} — {o.wilaya}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-zinc-900">
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
