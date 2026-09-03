import Link from "next/link";
import {
  CircleCheck,
  ExternalLink,
  Globe,
  ImageOff,
  Pencil,
  Plus,
  ShoppingCart,
  Star,
} from "lucide-react";
import { createProduct, deleteProduct, setDefaultProduct } from "@/app/actions/product";
import { getOrderCountsByProduct, getProducts, getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produits — Admin" };

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

export default async function ProductsPage() {
  const [products, settings, counts] = await Promise.all([
    getProducts(),
    getSettings(),
    getOrderCountsByProduct(),
  ]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Produits</h1>
        <p className="text-sm text-zinc-500">
          Un produit = une boutique : son domaine, sa marque et sa landing page.
        </p>
      </div>

      {/* Création : le produit naît hors ligne, le temps d'être rempli */}
      <form
        action={createProduct}
        className="flex flex-wrap items-end gap-3 rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-16px_rgba(16,24,40,0.12)] ring-1 ring-zinc-900/5"
      >
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium text-zinc-700">
          Nouveau produit
          <input
            name="name"
            required
            placeholder="Nom du produit"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
          />
        </label>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-linear-to-b from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-500"
        >
          <Plus className="size-4" />
          Créer
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {products.map((product) => {
          const isDefault = settings.default_product_id === product.id;
          const orders = counts.get(product.id) ?? 0;
          const publicUrl = product.domain
            ? `https://${product.domain}`
            : `/p/${product.slug}`;

          return (
            <div
              key={product.id}
              className="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-16px_rgba(16,24,40,0.12)] ring-1 ring-zinc-900/5 sm:flex-row sm:items-center"
            >
              {product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.images[0]}
                  alt=""
                  className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-zinc-200"
                />
              ) : (
                <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-300">
                  <ImageOff className="size-7" strokeWidth={1.5} />
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-bold text-zinc-900">
                    {product.name}
                  </span>
                  {isDefault && (
                    <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                      <Star className="size-3" />
                      Par défaut
                    </span>
                  )}
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                      product.active
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {product.active ? "En ligne" : "Hors ligne"}
                  </span>
                </div>
                <a
                  href={publicUrl}
                  target="_blank"
                  className="flex w-fit items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-indigo-600"
                >
                  <Globe className="size-3.5" />
                  {product.domain ?? `/p/${product.slug}`}
                  <ExternalLink className="size-3" />
                </a>
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span className="font-bold text-zinc-900">
                    {formatDA(Number(product.price))}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="size-3.5" />
                    {orders} commande{orders > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {!isDefault && (
                  <form action={setDefaultProduct}>
                    <input type="hidden" name="product_id" value={product.id} />
                    <button
                      type="submit"
                      title="Servi sur les domaines non attribués"
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <CircleCheck className="size-4" />
                      Par défaut
                    </button>
                  </form>
                )}
                <Link
                  href={`/admin/produits/${product.id}`}
                  className="flex items-center gap-2 rounded-xl bg-linear-to-b from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-500"
                >
                  <Pencil className="size-4" />
                  Ouvrir
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Suppression : à part, et jamais à un clic d'un bouton d'édition */}
      {products.length > 1 && (
        <details className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-zinc-900/5">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-500">
            Supprimer un produit
          </summary>
          <form action={deleteProduct} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm font-medium text-zinc-700">
              Produit à supprimer
              <select
                name="product_id"
                required
                defaultValue=""
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-zinc-900 outline-none focus:border-red-400"
              >
                <option value="" disabled>
                  Choisir…
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.domain ?? p.slug})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Supprimer définitivement
            </button>
            <p className="w-full text-xs text-zinc-400">
              Le produit, sa landing et ses images partent définitivement. Les
              commandes déjà passées sont conservées, avec le nom du produit
              figé au moment de la commande.
            </p>
          </form>
        </details>
      )}
    </div>
  );
}
