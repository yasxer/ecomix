import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getProductById } from "@/lib/data";
import { ProductTabs } from "./product-tabs";

export const dynamic = "force-dynamic";

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const product = await getProductById((await params).id);
  if (!product) notFound();

  // Lien vers la boutique : son domaine s'il est branché, sinon l'aperçu par
  // slug servi depuis le domaine de l'admin.
  const publicUrl = product.domain ? `https://${product.domain}` : `/p/${product.slug}`;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <Link
        href="/admin/produits"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-500 transition hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        Produits
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-zinc-900">
            {product.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
            <span className="truncate">{product.domain ?? `/p/${product.slug}`}</span>
            <span
              className={`admin-chip shrink-0 ${
                product.active
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                  : "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-300"
              }`}
            >
              {product.active ? "En ligne" : "Hors ligne"}
            </span>
          </p>
        </div>
        <a href={publicUrl} target="_blank" className="admin-btn-ghost w-full sm:w-fit">
          <ExternalLink className="size-4" />
          Voir la boutique
        </a>
      </div>

      <ProductTabs productId={product.id} />
      <div className="pt-1">{children}</div>
    </div>
  );
}
