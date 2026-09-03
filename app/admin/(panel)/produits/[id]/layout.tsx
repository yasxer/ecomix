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
        className="group flex w-fit items-center gap-1.5 text-sm font-medium text-ink-dim transition hover:text-ink"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Produits
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">
            {product.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-dim">
            <span className="truncate">{product.domain ?? `/p/${product.slug}`}</span>
            <span
              className={`admin-chip shrink-0 ${
                product.active
                  ? "bg-ok-soft text-ok-ink ring-ok/30"
                  : "bg-raised text-ink-dim ring-line-strong"
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
