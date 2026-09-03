import { Home, Inbox, Package, Phone, Store } from "lucide-react";
import {
  getOrders,
  getProducts,
  syncYalidineStatuses,
  type OrderFilters,
} from "@/lib/data";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/types";
import { formatVariants } from "@/lib/variants";
import { WILAYAS } from "@/lib/wilayas";
import { PageHeader } from "../page-header";
import { OrderActions } from "./order-actions";
import { OrdersFilters } from "./orders-filters";
import { StatusBadge, YalidineStatusBadge } from "./status-badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Commandes — Admin" };

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function OrderStatusCell({ order }: { order: Order }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 lg:flex-col lg:items-start">
      <StatusBadge status={order.status} />
      {order.status === "confirmee" && order.yalidine_status && (
        <YalidineStatusBadge status={order.yalidine_status} />
      )}
      {order.status === "confirmee" && order.yalidine_tracking && (
        <span className="font-mono text-[10px] text-zinc-400">
          {order.yalidine_tracking}
        </span>
      )}
    </div>
  );
}

/** Livraison : à domicile ou au bureau, avec le nom du bureau s'il y en a un. */
function DeliveryLine({ order }: { order: Order }) {
  const Icon = order.delivery_type === "domicile" ? Home : Store;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
      <Icon className="size-3.5 shrink-0" />
      {order.delivery_type === "domicile" ? "Domicile" : "Stopdesk"}
      {order.stopdesk_name && ` — ${order.stopdesk_name}`}
    </span>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [params, products] = await Promise.all([searchParams, getProducts()]);
  const filters: OrderFilters = {};
  const productParam = typeof params.product === "string" ? params.product : "";
  if (products.some((p) => p.id === productParam)) filters.productId = productParam;
  const statusParam = typeof params.status === "string" ? params.status : "";
  if (ORDER_STATUSES.some((s) => s.value === statusParam)) {
    filters.status = statusParam as OrderStatus;
  }
  if (typeof params.wilaya === "string" && WILAYAS.includes(params.wilaya)) {
    filters.wilaya = params.wilaya;
  }
  if (typeof params.q === "string" && params.q.trim()) {
    filters.search = params.q.trim();
  }
  if (typeof params.from === "string" && params.from) filters.from = params.from;
  if (typeof params.to === "string" && params.to) filters.to = params.to;

  // Statuts Yalidine rafraîchis à chaque chargement de la page
  const orders = await syncYalidineStatuses(await getOrders(filters));
  const multi = products.length > 1;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <PageHeader
        title="Commandes"
        subtitle={
          <>
            {orders.length} commande{orders.length > 1 ? "s" : ""} — confirmez pour
            envoyer le colis chez Yalidine, le suivi se met à jour tout seul.
          </>
        }
      />

      <OrdersFilters
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        values={{
          q: filters.search ?? "",
          product: filters.productId ?? "",
          status: statusParam,
          wilaya: filters.wilaya ?? "",
          from: filters.from ?? "",
          to: filters.to ?? "",
        }}
      />

      {orders.length === 0 ? (
        <div className="admin-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Inbox className="size-10 text-zinc-300" strokeWidth={1.5} />
          <p className="text-sm text-zinc-500">
            Aucune commande ne correspond à ces filtres.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tableau desktop ── */}
          <div className="admin-card hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-400">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  {multi && <th className="px-4 py-3 font-semibold">Boutique</th>}
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Destination</th>
                  <th className="px-4 py-3 font-semibold">Livraison</th>
                  <th className="px-4 py-3 font-semibold">Qté</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {orders.map((o) => (
                  <tr key={o.id} className="transition hover:bg-zinc-50/60">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {formatDate(o.created_at)}
                    </td>
                    {multi && (
                      <td className="px-4 py-3 text-xs font-medium text-zinc-600">
                        {o.product_name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">{o.customer_name}</p>
                      <a
                        href={`tel:${o.phone}`}
                        className="text-xs text-zinc-500 transition hover:text-indigo-600"
                      >
                        {o.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-700">{o.wilaya}</p>
                      <p className="text-xs text-zinc-500">
                        {o.commune}
                        {o.address ? ` — ${o.address}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryLine order={o} />
                      {o.pack_label && (
                        <p className="mt-0.5 text-xs font-semibold text-zinc-700">
                          {o.pack_label}
                        </p>
                      )}
                      {formatVariants(o) && (
                        <p className="mt-0.5 text-xs font-medium text-indigo-600">
                          {formatVariants(o)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{o.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-zinc-900">
                      {formatDA(Number(o.total))}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusCell order={o} />
                    </td>
                    <td className="px-4 py-3">
                      <OrderActions
                        orderId={o.id}
                        status={o.status}
                        label={o.yalidine_label}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Cartes mobile / tablette ──
              Une commande se traite au téléphone : le nom, le montant et le
              bouton d'appel passent en premier, le détail d'expédition ensuite. */}
          <div className="flex flex-col gap-3 lg:hidden">
            {orders.map((o) => (
              <div key={o.id} className="admin-card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-zinc-900">
                      {o.customer_name}
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {formatDate(o.created_at)}
                      {multi && o.product_name && (
                        <span className="ms-1.5 inline-flex items-center gap-1 font-medium text-zinc-500">
                          <Package className="inline size-3" />
                          {o.product_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-extrabold text-zinc-900">
                    {formatDA(Number(o.total))}
                  </span>
                </div>

                {/* Appeler le client : l'action la plus fréquente en paiement
                    à la livraison, donc une cible tactile pleine largeur. */}
                <a
                  href={`tel:${o.phone}`}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-50 px-4 font-semibold text-indigo-700 transition active:scale-[0.98] active:bg-indigo-100"
                >
                  <Phone className="size-4" />
                  {o.phone}
                </a>

                <div className="flex flex-col gap-1 rounded-xl bg-zinc-50 px-3 py-2.5">
                  <p className="text-sm text-zinc-700">
                    {o.wilaya} — {o.commune}
                    {o.address ? ` — ${o.address}` : ""}
                  </p>
                  <DeliveryLine order={o} />
                  <p className="text-xs font-medium text-zinc-600">
                    Qté {o.quantity}
                    {o.pack_label && ` — ${o.pack_label}`}
                    {formatVariants(o) && (
                      <span className="text-indigo-600"> — {formatVariants(o)}</span>
                    )}
                  </p>
                </div>

                <OrderStatusCell order={o} />

                <div className="border-t border-zinc-100 pt-3">
                  <OrderActions
                    orderId={o.id}
                    status={o.status}
                    label={o.yalidine_label}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
