import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowDown, PackageOpen } from "lucide-react";
import { getStorefront, getStorefrontKeys } from "@/lib/data";
import {
  CustomBlocks,
  DescriptionBlock,
  FormBlock,
  GalleryBlock,
  HeroBlock,
  formatDA,
} from "@/app/components/landing-blocks";
import { MetaPixel } from "@/app/components/meta-pixel";

/**
 * La boutique d'un domaine. `key` est l'hôte de la requête, réécrit par
 * `proxy.ts` (`boutique.dz/` → `/s/boutique.dz`) ou le slug d'un produit
 * (`/p/mon-produit`). Chaque domaine a donc sa propre entrée de cache : la
 * page reste servie depuis le CDN, rapide même en 2G.
 *
 * Régénérée immédiatement quand le produit change (`revalidateStorefronts`),
 * avec un filet de sécurité de 5 minutes.
 */
export const revalidate = 300;

/**
 * Les domaines et slugs connus au moment du build. Les autres clés (un
 * domaine ajouté depuis, ou l'hôte qui sert le produit par défaut) sont
 * générées à la première visite puis mises en cache de la même façon.
 */
export async function generateStaticParams() {
  return (await getStorefrontKeys()).map((key) => ({ key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ key: string }>;
}): Promise<Metadata> {
  const product = await getStorefront((await params).key);
  if (!product) return { title: "Boutique introuvable" };
  return {
    title: `${product.name} | ${product.store_name}`,
    description: product.description.slice(0, 160) || product.store_name,
    verification: product.fb_domain_verification
      ? { other: { "facebook-domain-verification": product.fb_domain_verification } }
      : undefined,
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const product = await getStorefront((await params).key);
  if (!product) notFound();

  // La vitrine (marque, couleur, pixel, mise en page) appartient au produit :
  // deux domaines servis par ce même code n'ont donc rien en commun.
  //
  // Mode custom : l'admin a composé la page bloc par bloc (voir
  // /admin/produits/<id>/landing). Sans bloc enregistré on retombe sur la mise
  // en page simple plutôt que de servir une page vide.
  const custom = product.landing_mode === "custom" && product.landing_blocks.length > 0;
  // Les options d'affichage n'existent qu'en mode custom : le mode simple
  // garde son thème clair, son en-tête fixé et son bouton flottant mobile.
  const dark = custom && product.landing_theme === "dark";
  const stickyHeader = !custom || product.landing_sticky_header;
  const cta: "mobile" | "always" | "none" = !custom
    ? "mobile"
    : product.landing_sticky_cta
      ? "always"
      : "none";

  return (
    <div
      data-theme={dark ? "dark" : undefined}
      style={{ "--primary": product.primary_color } as React.CSSProperties}
      className="relative min-h-screen overflow-x-clip bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      {product.pixel_id && <MetaPixel pixelId={product.pixel_id} />}

      {/* Halos de couleur en arrière-plan.
          Dégradés radiaux et non des cercles en `filter: blur()` : Safari
          recalcule une couche floue à chaque frame de scroll, un dégradé est
          peint une fois. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: [
            "radial-gradient(circle 460px at 100% 60px, color-mix(in srgb, var(--primary) 12%, transparent), transparent 65%)",
            "radial-gradient(circle 420px at 0% 40%, color-mix(in srgb, var(--primary) 8%, transparent), transparent 65%)",
          ].join(","),
        }}
      />

      {/* Header. Volontairement sans `backdrop-blur` : sur un élément sticky,
          Safari (surtout iOS) refait le flou du contenu derrière à chaque
          frame de scroll, ce qui saccade le défilement. */}
      <header
        className={`${stickyHeader ? "sticky top-0" : "relative"} z-40 border-b border-zinc-200/50 bg-white/95 dark:border-white/10 dark:bg-zinc-950/95`}
      >
        <div className="mx-auto flex h-16 max-w-[420px] items-center justify-center gap-3 px-4">
          {product.logo_url ? (
            <Image
              src={product.logo_url}
              alt={product.store_name}
              width={36}
              height={36}
              className="size-9 rounded-xl object-contain"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-xl bg-(--primary) text-white shadow-md shadow-(--primary)/30">
              <PackageOpen className="size-5" />
            </span>
          )}
          <span className="landing-title text-lg">
            {product.store_name}
          </span>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-[420px] flex-col px-4 pb-12">
        {custom ? (
          <CustomBlocks blocks={product.landing_blocks} product={product} />
        ) : (
          <>
            <HeroBlock product={product} />
            <GalleryBlock product={product} />
            <DescriptionBlock product={product} />
            <FormBlock product={product} />
          </>
        )}
      </main>

      {/* Bouton flottant : mobile seulement en mode simple, partout ou nulle
          part en mode custom selon l'option choisie. Au-dessus de tout le
          reste : il doit rester cliquable quelle que soit la section. */}
      {cta !== "none" && (
        <a
          href="#commander"
          className={`fixed inset-x-4 bottom-4 z-50 flex items-center justify-center gap-2 rounded-2xl bg-(--primary) px-6 py-4 text-base font-bold text-white shadow-lg shadow-(--primary)/30 ${
            cta === "mobile"
              ? "sm:hidden"
              : "sm:inset-x-auto sm:left-1/2 sm:w-[388px] sm:-translate-x-1/2"
          }`}
        >
          Commander — {formatDA(product.price)}
          <ArrowDown className="size-5" />
        </a>
      )}

      <footer
        className={`relative border-t border-zinc-200/70 bg-white py-7 dark:border-white/10 dark:bg-zinc-900 ${
          cta === "always" ? "pb-24" : cta === "mobile" ? "pb-24 sm:pb-7" : ""
        }`}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            {product.logo_url ? (
              <Image
                src={product.logo_url}
                alt=""
                width={24}
                height={24}
                className="size-6 rounded-md object-contain"
              />
            ) : (
              <PackageOpen className="size-4.5 text-(--primary)" />
            )}
            <span className="text-sm font-bold">{product.store_name}</span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            © {new Date().getFullYear()} {product.store_name} — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  );
}
