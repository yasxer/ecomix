import { notFound } from "next/navigation";
import { getProductById } from "@/lib/data";
import { LandingBuilder } from "./landing-builder";

export const dynamic = "force-dynamic";

export const metadata = { title: "Landing page — Admin" };

export default async function LandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const product = await getProductById((await params).id);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-dim">
        Gardez la mise en page simple, ou composez votre propre page bloc par
        bloc : sections image, formulaire, galerie…
      </p>
      <LandingBuilder
        mode={product.landing_mode}
        blocks={product.landing_blocks}
        theme={product.landing_theme}
        stickyCta={product.landing_sticky_cta}
        stickyHeader={product.landing_sticky_header}
        product={product}
        storeName={product.store_name}
        logoUrl={product.logo_url}
        primaryColor={product.primary_color}
      />
    </div>
  );
}
