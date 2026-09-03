import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ImageOff, Pencil, Truck } from "lucide-react";
import { getProductById } from "@/lib/data";
import { ProductForm } from "./product-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produit — Admin" };

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ id }, product, query] = await Promise.all([
    params,
    params.then(({ id }) => getProductById(id)),
    searchParams,
  ]);
  if (!product) notFound();
  const editing = query.edit === "1";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-zinc-500">
          Prix, photos, variantes et offres groupées — le contenu de la landing
          page de cette boutique.
        </p>
        {!editing && (
          <Link
            href={`/admin/produits/${id}?edit=1`}
            className="admin-btn-primary w-full shrink-0 sm:w-fit"
          >
            <Pencil className="size-4" />
            Modifier
          </Link>
        )}
      </div>

      {editing ? (
        <ProductForm product={product} />
      ) : (
        /* Carte d'aperçu */
        <div className="admin-card overflow-hidden">
          <div className="grid sm:grid-cols-[220px_1fr]">
            {product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.images[0]}
                alt={product.name}
                className="h-48 w-full object-cover sm:h-full sm:max-h-none"
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-zinc-100 text-zinc-300 sm:h-full">
                <ImageOff className="size-10" strokeWidth={1.5} />
              </div>
            )}

            <div className="flex flex-col gap-4 p-4 sm:p-6">
              <div>
                <h2 className="text-xl font-bold text-zinc-900">{product.name}</h2>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-indigo-600">
                    {formatDA(product.price)}
                  </span>
                  {product.old_price && product.old_price > product.price && (
                    <span className="text-zinc-400 line-through">
                      {formatDA(product.old_price)}
                    </span>
                  )}
                </div>
              </div>

              {product.description && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600">
                  {product.description}
                </p>
              )}

              {product.features.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {product.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                      <span className="text-zinc-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {(product.colors.length > 0 || product.sizes.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                  {product.colors.map((c) => (
                    <span
                      key={c.name}
                      title={c.name}
                      className="size-6 rounded-full ring-1 ring-zinc-900/10"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                  {product.sizes.map((s) => (
                    <span
                      key={s}
                      className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {product.packs.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Offres groupées
                  </span>
                  {product.packs.map((pack) => (
                    <div key={pack.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800">
                        {pack.label}
                        <span className="ms-1.5 font-medium text-zinc-400">
                          ×{pack.quantity}
                        </span>
                      </span>
                      {pack.badge && (
                        <span className="shrink-0 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600">
                          {pack.badge}
                        </span>
                      )}
                      <span className="shrink-0 text-sm font-bold text-zinc-900">
                        {formatDA(pack.price)}
                      </span>
                      {pack.old_price && pack.old_price > pack.price && (
                        <span className="shrink-0 text-xs text-zinc-400 line-through">
                          {formatDA(pack.old_price)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-3 border-t border-zinc-100 pt-4 text-xs font-medium text-zinc-500">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="size-3.5" />
                  Frais de livraison via Yalidine
                </span>
                <span className="ml-auto">
                  {product.images.length} image{product.images.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {product.images.length > 1 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-zinc-100 p-4">
              {product.images.slice(1).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-zinc-200"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
