import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, PackageOpen } from "lucide-react";
import { getProduct, getSettings } from "@/lib/data";
import {
  CustomBlocks,
  DescriptionBlock,
  FormBlock,
  GalleryBlock,
  HeroBlock,
  formatDA,
} from "./components/landing-blocks";
import { MetaPixel } from "./components/meta-pixel";

// Page servie depuis le cache CDN (rapide même en 2G). Elle est régénérée
// immédiatement quand le produit ou les settings changent (revalidatePath),
// avec un filet de sécurité de 5 minutes.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [settings, product] = await Promise.all([getSettings(), getProduct()]);
  return {
    title: product ? `${product.name} | ${settings.store_name}` : settings.store_name,
    description: product?.description.slice(0, 160) || settings.store_name,
    verification: settings.fb_domain_verification
      ? { other: { "facebook-domain-verification": settings.fb_domain_verification } }
      : undefined,
  };
}

export default async function LandingPage() {
  const [settings, product] = await Promise.all([getSettings(), getProduct()]);

  if (!product) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <PackageOpen className="size-12 text-zinc-300" strokeWidth={1.5} />
        <p className="text-zinc-500">
          Aucun produit configuré. Rendez-vous dans le panel admin.
        </p>
      </main>
    );
  }

  // Mode custom : l'admin a composé la page bloc par bloc (voir
  // /admin/landing). Sans bloc enregistré on retombe sur la mise en page
  // simple plutôt que de servir une page vide.
  const custom = settings.landing_mode === "custom" && settings.landing_blocks.length > 0;
  // Les options d'affichage n'existent qu'en mode custom : le mode simple
  // garde son thème clair, son en-tête fixé et son bouton flottant mobile.
  const dark = custom && settings.landing_theme === "dark";
  const stickyHeader = !custom || settings.landing_sticky_header;
  const cta: "mobile" | "always" | "none" = !custom
    ? "mobile"
    : settings.landing_sticky_cta
      ? "always"
      : "none";

  return (
    <div
      data-theme={dark ? "dark" : undefined}
      style={{ "--primary": settings.primary_color } as React.CSSProperties}
      className="relative min-h-screen overflow-x-clip bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      {settings.pixel_id && <MetaPixel pixelId={settings.pixel_id} />}

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
          {settings.logo_url ? (
            <Image
              src={settings.logo_url}
              alt={settings.store_name}
              width={36}
              height={36}
              className="size-9 rounded-xl object-contain"
            />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-xl bg-(--primary) text-white shadow-md shadow-(--primary)/30">
              <PackageOpen className="size-5" />
            </span>
          )}
          <span className="text-lg font-extrabold tracking-tight">
            {settings.store_name}
          </span>
        </div>
      </header>

      <main className="relative mx-auto flex max-w-[420px] flex-col px-4 pb-12">
        {custom ? (
          <CustomBlocks
            blocks={settings.landing_blocks}
            product={product}
            settings={settings}
          />
        ) : (
          <>
            <HeroBlock product={product} settings={settings} />
            <GalleryBlock product={product} />
            <DescriptionBlock product={product} />
            <FormBlock product={product} settings={settings} />
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
            {settings.logo_url ? (
              <Image
                src={settings.logo_url}
                alt=""
                width={24}
                height={24}
                className="size-6 rounded-md object-contain"
              />
            ) : (
              <PackageOpen className="size-4.5 text-(--primary)" />
            )}
            <span className="text-sm font-bold">{settings.store_name}</span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            © {new Date().getFullYear()} {settings.store_name} — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  );
}
