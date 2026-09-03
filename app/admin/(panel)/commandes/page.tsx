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
        <span className="font-mono text-[10px] text-ink-faint">
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
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft">
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
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
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
          <span className="admin-icon-tile size-11 rounded-xl">
            <Inbox className="size-5" strokeWidth={1.5} />
          </span>
          <p className="text-sm text-ink-dim">
            Aucune commande ne correspond à ces filtres.
          </p>
        </div>
      ) : (
        <>
          {/* ── Tableau desktop ── */}
          <div className="admin-card hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-raised text-[11px] uppercase tracking-wider text-ink-faint">
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
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="transition hover:bg-raised/70">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-dim">
                      {formatDate(o.created_at)}
                    </td>
                    {multi && (
                      <td className="px-4 py-3 text-xs font-medium text-ink-soft">
                        {o.product_name ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{o.customer_name}</p>
                      <a
                        href={`tel:${o.phone}`}
                        className="text-xs text-ink-dim transition hover:text-accent"
                      >
                        {o.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink-soft">{o.wilaya}</p>
                      <p className="text-xs text-ink-dim">
                        {o.commune}
                        {o.address ? ` — ${o.address}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <DeliveryLine order={o} />
                      {o.pack_label && (
                        <p className="mt-0.5 text-xs font-semibold text-ink-soft">
                          {o.pack_label}
                        </p>
                      )}
                      {formatVariants(o) && (
                        <p className="mt-0.5 text-xs font-medium text-accent">
                          {formatVariants(o)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{o.quantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-ink">
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
          </div>

          {/* ── Cartes mobile / tablette ──
              Une commande se traite au téléphone : le nom, le montant et le
              bouton d'appel passent en premier, le détail d'expédition ensuite. */}
          <div className="flex flex-col gap-3 lg:hidden">
            {orders.map((o) => (
              <div key={o.id} className="admin-card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {o.customer_name}
                    </p>
                    <p className="text-[11px] text-ink-faint">
                      {formatDate(o.created_at)}
                      {multi && o.product_name && (
                        <span className="ms-1.5 inline-flex items-center gap-1 font-medium text-ink-dim">
                          <Package className="inline size-3" />
                          {o.product_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-semibold tabular-nums text-ink">
                    {formatDA(Number(o.total))}
                  </span>
                </div>

                {/* Appeler le client : l'action la plus fréquente en paiement
                    à la livraison, donc une cible tactile pleine largeur. */}
                <a
                  href={`tel:${o.phone}`}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-accent-line bg-accent-soft px-4 text-sm font-semibold text-accent-ink transition active:scale-[0.99] active:brightness-95"
                >
                  <Phone className="size-4" />
                  {o.phone}
                </a>

                <div className="admin-inset flex flex-col gap-1 px-3 py-2.5">
                  <p className="text-sm text-ink-soft">
                    {o.wilaya} — {o.commune}
                    {o.address ? ` — ${o.address}` : ""}
                  </p>
                  <DeliveryLine order={o} />
                  <p className="text-xs font-medium text-ink-soft">
                    Qté {o.quantity}
                    {o.pack_label && ` — ${o.pack_label}`}
                    {formatVariants(o) && (
                      <span className="text-accent"> — {formatVariants(o)}</span>
                    )}
                  </p>
                </div>

                <OrderStatusCell order={o} />

                <div className="border-t border-line pt-3">
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
