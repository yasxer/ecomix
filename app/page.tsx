import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, BadgeCheck, Banknote, Check, PackageOpen, Truck } from "lucide-react";
import { getProduct, getSettings } from "@/lib/data";
import { Gallery } from "./components/gallery";
import { MetaPixel } from "./components/meta-pixel";
import { Offers } from "./components/offers";

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

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
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

  const discount =
    product.old_price && product.old_price > product.price
      ? Math.round((1 - product.price / product.old_price) * 100)
      : null;

  return (
    <div
      style={{ "--primary": settings.primary_color } as React.CSSProperties}
      className="relative min-h-screen overflow-x-clip bg-zinc-50 text-zinc-900"
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
      <header className="sticky top-0 z-40 border-b border-zinc-200/50 bg-white/95">
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
        {/* Titre + prix */}
        <div className="animate-fade-up flex flex-col items-center gap-3 pb-7 pt-8 text-center">
          {discount !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--primary) px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-(--primary)/30">
              <BadgeCheck className="size-4" />
              -{discount}% aujourd&apos;hui
            </span>
          )}
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            {product.name}
          </h1>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-(--primary)">
              {formatDA(product.price)}
            </span>
            {product.old_price && product.old_price > product.price && (
              <span className="text-xl font-medium text-zinc-400 line-through">
                {formatDA(product.old_price)}
              </span>
            )}
          </div>
          {/* Mini badges */}
          <div className="mt-1 flex items-center gap-4 text-xs font-semibold text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Truck className="size-4 text-(--primary)" />
              {settings.free_delivery_mode === "all"
                ? "Livraison gratuite"
                : settings.free_delivery_mode === "stopdesk"
                  ? "Gratuit en Stopdesk"
                  : "69 wilayas"}
            </span>
            <span className="h-3 w-px bg-zinc-300" />
            <span className="flex items-center gap-1.5">
              <Banknote className="size-4 text-(--primary)" />
              Paiement à la livraison
            </span>
          </div>
          <a
            href="#commander"
            className="mt-2 flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-zinc-700"
          >
            Commander maintenant
            <ArrowDown className="size-4" />
          </a>
        </div>

        {/* Galerie : grande image + miniatures, zoom au clic, swipe */}
        <div className="animate-fade-up-delay relative">
          <div
            aria-hidden="true"
            className="absolute -inset-x-2 -inset-y-2 rounded-4xl bg-(--primary)/10"
          />
          <div className="relative">
            <Gallery images={product.images} alt={product.name} />
          </div>
        </div>

        {/* Description et points forts saisis dans l'admin.
            `dir="auto"` partout : la page est en LTR mais ces textes sont
            saisis librement (arabe ici, français ailleurs) — le navigateur
            déduit le sens du premier caractère fort, et les marges logiques
            (`start-*`, `ps-*`) suivent. */}
        {(product.description || product.features.length > 0) && (
          <section className="flex flex-col gap-3 pt-9">
            {product.description && (
              <div
                dir="auto"
                className="relative overflow-hidden rounded-3xl bg-white py-5 pe-5 ps-6 shadow-sm ring-1 ring-zinc-200/60"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 inset-s-0 w-1 bg-(--primary)"
                />
                {/* `whitespace-pre-line` conserve les retours à la ligne saisis */}
                <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-600">
                  {product.description}
                </p>
              </div>
            )}

            {product.features.length > 0 && (
              // `gap-px` sur fond gris : des séparateurs d'un pixel entre les
              // lignes blanches, sans bordure à gérer sur chacune.
              <ul className="grid gap-px overflow-hidden rounded-3xl bg-zinc-200/70 shadow-sm ring-1 ring-zinc-200/60">
                {product.features.map((feature) => (
                  <li
                    key={feature}
                    dir="auto"
                    className="flex items-start gap-3 bg-white px-5 py-3.5"
                  >
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-(--primary)/15 text-(--primary)">
                      <Check className="size-3" strokeWidth={3.5} />
                    </span>
                    <span className="text-sm font-medium text-zinc-700">{feature}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Offres groupées (si configurées) puis formulaire : les deux
            partagent le pack sélectionné, d'où le composant client commun. */}
        <Offers
          packs={product.packs}
          price={product.price}
          colors={product.colors}
          sizes={product.sizes}
          freeDeliveryMode={settings.free_delivery_mode}
        >
          <div className="mb-6 flex flex-col items-center gap-1 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight">
              Passez votre commande
            </h2>
            <p className="text-sm text-zinc-500">
              Vous ne payez qu&apos;à la réception de votre colis
            </p>
          </div>
        </Offers>
      </main>

      {/* Barre mobile fixe */}
      <a
        href="#commander"
        className="fixed inset-x-4 bottom-4 z-40 flex items-center justify-center gap-2 rounded-2xl bg-(--primary) px-6 py-4 text-base font-bold text-white shadow-lg shadow-(--primary)/30 sm:hidden"
      >
        Commander — {formatDA(product.price)}
        <ArrowDown className="size-5" />
      </a>

      <footer className="relative border-t border-zinc-200/70 bg-white py-7 pb-24 sm:pb-7">
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
          <p className="text-xs text-zinc-400">
            © {new Date().getFullYear()} {settings.store_name} — Tous droits réservés
          </p>
        </div>
      </footer>
    </div>
  );
}
