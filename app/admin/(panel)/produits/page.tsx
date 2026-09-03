import Link from "next/link";
import {
  ChevronRight,
  CircleCheck,
  ExternalLink,
  Globe,
  ImageOff,
  Plus,
  ShoppingCart,
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
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Produits"
        subtitle="Un produit = une boutique : son domaine, sa marque et sa landing page."
      />

      {/* Création : le produit naît hors ligne, le temps d'être rempli */}
      <form
        action={createProduct}
        className="admin-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4"
      >
        <input
          name="name"
          required
          placeholder="Nom du nouveau produit"
          aria-label="Nom du nouveau produit"
          className="admin-field sm:flex-1"
        />
        <button type="submit" className="admin-btn-primary sm:shrink-0">
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
            <div key={product.id} className="admin-card overflow-hidden">
              {/* Toute la carte est cliquable sur mobile : viser un bouton
                  « Ouvrir » de 80px de large au pouce n'a aucun intérêt. */}
              <Link
                href={`/admin/produits/${product.id}`}
                className="flex items-center gap-3 p-3 transition active:bg-zinc-50 sm:gap-4 sm:p-4"
              >
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.images[0]}
                    alt=""
                    className="size-16 shrink-0 rounded-2xl object-cover ring-1 ring-zinc-200 sm:size-20"
                  />
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-300 sm:size-20">
                    <ImageOff className="size-6 sm:size-7" strokeWidth={1.5} />
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold text-zinc-900">
                      {product.name}
                    </span>
                    {isDefault && (
                      <span className="flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                        <Star className="size-2.5" />
                        Défaut
                      </span>
                    )}
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        product.active
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {product.active ? "En ligne" : "Hors ligne"}
                    </span>
                  </div>

                  <p className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
                    <Globe className="size-3.5 shrink-0" />
                    <span className="truncate">
                      {product.domain ?? `/p/${product.slug}`}
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span className="font-bold text-zinc-900">
                      {formatDA(Number(product.price))}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShoppingCart className="size-3.5" />
                      {orders} commande{orders > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <ChevronRight className="size-5 shrink-0 text-zinc-300" />
              </Link>

              {/* Actions secondaires, hors de la zone cliquable de la carte */}
              <div className="flex items-center gap-1 border-t border-zinc-100 px-2 py-1.5">
                <a
                  href={publicUrl}
                  target="_blank"
                  className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-50 hover:text-indigo-600"
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
                      className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-900"
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
        <details className="admin-card group p-4 sm:p-5">
          <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-500 transition hover:text-zinc-700">
            <span className="flex items-center gap-2">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
              Supprimer un produit
            </span>
          </summary>
          <form action={deleteProduct} className="mt-4 flex flex-col gap-3">
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
            <p className="text-xs leading-relaxed text-zinc-400">
              Le produit, sa landing et ses images partent définitivement. Les
              commandes déjà passées sont conservées, avec le nom du produit figé
              au moment de la commande.
            </p>
            <button
              type="submit"
              className="admin-btn w-full bg-red-600 text-white hover:bg-red-500 sm:w-fit"
            >
              Supprimer définitivement
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
