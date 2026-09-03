import Link from "next/link";
import {
  ChevronRight,
  CircleCheck,
  ExternalLink,
  ImageOff,
  Plus,
  Star,
} from "lucide-react";
import { createProduct, deleteProduct, setDefaultProduct } from "@/app/actions/product";
import { getOrderCountsByProduct, getProducts, getSettings } from "@/lib/data";
import { PageHeader } from "../page-header";

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
      <PageHeader
        title="Produits"
        subtitle="Un produit = une boutique : son domaine, sa marque et sa landing page."
      />

      {/* Création : le produit naît hors ligne, le temps d'être rempli */}
      <form action={createProduct} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          required
          placeholder="Nom du nouveau produit"
          aria-label="Nom du nouveau produit"
          className="admin-field sm:max-w-xs"
        />
        <button type="submit" className="admin-btn-primary sm:shrink-0">
          <Plus className="size-4" />
          Créer
        </button>
      </form>

      <div className="admin-card admin-divide overflow-hidden">
        {products.map((product) => {
          const isDefault = settings.default_product_id === product.id;
          const orders = counts.get(product.id) ?? 0;
          const publicUrl = product.domain
            ? `https://${product.domain}`
            : `/p/${product.slug}`;

          return (
            <div key={product.id} className="flex flex-col">
              {/* Toute la ligne est cliquable : viser un bouton « Ouvrir » de
                  80px de large au pouce n'a aucun intérêt. */}
              <Link
                href={`/admin/produits/${product.id}`}
                className="flex items-center gap-3 px-3 py-3 transition hover:bg-zinc-50 sm:gap-4 sm:px-4"
              >
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0]}
                    alt=""
                    className="size-12 shrink-0 rounded-lg border border-zinc-200 object-cover sm:size-14"
                  />
                ) : (
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-300 sm:size-14">
                    <ImageOff className="size-5" strokeWidth={1.5} />
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-zinc-900">
                      {product.name}
                    </span>
                    {isDefault && (
                      <span className="admin-chip bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20">
                        <Star className="size-2.5" />
                        Défaut
                      </span>
                    )}
                    <span
                      className={`admin-chip ${
                        product.active
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                          : "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-300"
                      }`}
                    >
                      {product.active ? "En ligne" : "Hors ligne"}
                    </span>
                  </div>

                  <p className="truncate text-xs text-zinc-500">
                    {product.domain ?? `/p/${product.slug}`}
                  </p>

                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                    <span className="font-semibold tabular-nums text-zinc-900">
                      {formatDA(Number(product.price))}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {orders} commande{orders > 1 ? "s" : ""}
                    </span>
                  </p>
                </div>

                <ChevronRight className="size-4 shrink-0 text-zinc-300" />
              </Link>

              {/* Actions secondaires, hors de la zone cliquable de la ligne */}
              <div className="flex items-center gap-1 px-2 pb-2">
                <a
                  href={publicUrl}
                  target="_blank"
                  className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-indigo-600"
                >
                  <ExternalLink className="size-3.5" />
                  Voir la boutique
                </a>
                {!isDefault && (
                  <form action={setDefaultProduct} className="flex-1">
                    <input type="hidden" name="product_id" value={product.id} />
                    <button
                      type="submit"
                      title="Servi sur les domaines non attribués"
                      className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      <CircleCheck className="size-3.5" />
                      Par défaut
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Suppression : à part, et jamais à un clic d'un bouton d'édition */}
      {products.length > 1 && (
        <details className="group border-t border-zinc-200 pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-900">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            Supprimer un produit
          </summary>
          <form action={deleteProduct} className="mt-4 flex max-w-md flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
              Produit à supprimer
              <select name="product_id" required defaultValue="" className="admin-field">
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
            <p className="text-xs leading-relaxed text-zinc-500">
              Le produit, sa landing et ses images partent définitivement. Les
              commandes déjà passées sont conservées, avec le nom du produit figé
              au moment de la commande.
            </p>
            <button
              type="submit"
              className="admin-btn w-full bg-red-600 text-white hover:bg-red-700 sm:w-fit"
            >
              Supprimer définitivement
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
