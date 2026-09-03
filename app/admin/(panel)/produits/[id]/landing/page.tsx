import { notFound } from "next/navigation";
import { getProductById } from "@/lib/data";
import { LandingBuilder } from "./landing-builder";

export const dynamic = "force-dynamic";

/**
 * La composition automatique tient une requête ouverte le temps que le modèle
 * rédige la page — bien plus que les quelques secondes d'une action ordinaire.
 * Sans ce plafond relevé, l'hébergeur coupe la connexion en pleine génération.
 * (Un plan Vercel Hobby plafonne malgré tout à 60 s.)
 */
export const maxDuration = 300;

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
        Gardez la mise en page simple, composez votre page bloc par bloc, ou
        laissez l&apos;IA la rédiger à partir du produit et de ses photos.
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
