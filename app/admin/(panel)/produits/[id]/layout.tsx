import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Globe } from "lucide-react";
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
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        Tous les produits
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-zinc-900">{product.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <Globe className="size-3.5" />
            {product.domain ?? `/p/${product.slug}`}
            {!product.active && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">
                Hors ligne
              </span>
            )}
          </p>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm ring-1 ring-zinc-900/5 transition hover:text-indigo-600"
        >
          <ExternalLink className="size-4" />
          Voir la boutique
        </a>
      </div>

      <ProductTabs productId={product.id} />
      {children}
    </div>
  );
}
