import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  Clock,
  Percent,
  ShoppingCart,
  TrendingUp,
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

/** Montants compacts pour les tuiles : « 1 240 000 DA » ne tient pas sur mobile. */
function formatCompactDA(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-DZ", { maximumFractionDigits: 1 })} M DA`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("fr-DZ")} k DA`;
  return formatDA(n);
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

  const cards = [
    {
      label: "Aujourd'hui",
      value: String(ordersToday),
      icon: ShoppingCart,
      accent: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "En attente",
      value: String(pending),
      icon: Clock,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      label: "Revenus livrés",
      value: formatCompactDA(revenue),
      icon: CircleDollarSign,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Confirmation",
      value: `${confirmationRate}%`,
      icon: Percent,
      accent: "bg-sky-50 text-sky-600",
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <PageHeader
        title="Statistiques"
        subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""} au total`}
      />

      {/* Tuiles — 2 colonnes sur mobile, la ligne complète à partir de `lg` */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {cards.map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className="admin-card flex flex-col gap-2.5 p-4 transition sm:gap-3 sm:p-5 sm:hover:-translate-y-0.5"
          >
            <span
              className={`flex size-9 items-center justify-center rounded-xl sm:size-10 ${accent}`}
            >
              <Icon className="size-4.5 sm:size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-zinc-900 sm:text-xl">
                {value}
              </p>
              <p className="truncate text-xs font-medium text-zinc-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Graphique 14 jours */}
      <div className="admin-card p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="size-4.5 text-indigo-600" />
          <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
            Commandes — 14 derniers jours
          </h2>
        </div>
        <div className="flex h-32 items-end gap-1 sm:h-40 sm:gap-2">
          {days.map((d) => (
            <div key={d.key} className="group flex flex-1 flex-col items-center gap-1.5">
              {/* Le compte reste visible sur mobile (pas de survol au doigt) */}
              <span
                className={`text-[10px] font-bold text-zinc-500 transition sm:opacity-0 sm:group-hover:opacity-100 ${
                  d.count > 0 ? "" : "opacity-0"
                }`}
              >
                {d.count}
              </span>
              <div
                className={`w-full rounded-t-md transition sm:rounded-full ${
                  d.count > 0
                    ? "bg-linear-to-t from-indigo-600 to-indigo-400"
                    : "bg-zinc-100"
                } ${d.key === today ? "ring-2 ring-indigo-300 ring-offset-1" : ""}`}
                style={{ height: `${Math.max((d.count / maxCount) * 100, 4)}%` }}
              />
              <span className="hidden text-[9px] text-zinc-400 sm:block">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Répartition par statut */}
      <div className="admin-card p-4 sm:p-6">
        <h2 className="mb-3 text-sm font-bold text-zinc-900 sm:text-base">
          Répartition par statut
        </h2>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          {ORDER_STATUSES.map((s) => {
            const count = orders.filter((o) => o.status === s.value).length;
            return (
              <div
                key={s.value}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-zinc-50 px-3 py-3 sm:flex-row sm:gap-2.5 sm:px-4 sm:py-2.5"
              >
                <StatusBadge status={s.value} />
                <span className="text-base font-bold text-zinc-900 sm:text-sm">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dernières commandes */}
      <div className="admin-card p-4 sm:p-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-zinc-900 sm:text-base">
            Dernières commandes
          </h2>
          <Link
            href="/admin/commandes"
            className="flex items-center gap-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-500"
          >
            Tout voir
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400">
            Aucune commande pour le moment.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-900">
                    {o.customer_name}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {o.phone} — {o.wilaya}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold text-zinc-900">
                    {formatDA(Number(o.total))}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
