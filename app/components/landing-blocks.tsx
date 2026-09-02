import Image from "next/image";
import { ArrowDown, BadgeCheck, Banknote, Check, Truck } from "lucide-react";
import type { LandingBlock, Product, Settings } from "@/lib/types";
import { Gallery } from "./gallery";
import { Offers } from "./offers";

/**
 * Les sections de la landing, une par bloc. Le mode simple les enchaîne dans
 * un ordre fixe, le mode custom suit `settings.landing_blocks`. Tout est
 * Server Component : seules la galerie et le formulaire embarquent du client.
 */

export function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

/** Titre, prix, remise, mini badges et bouton d'ancre vers le formulaire. */
export function HeroBlock({
  product,
  settings,
}: {
  product: Product;
  settings: Settings;
}) {
  const discount =
    product.old_price && product.old_price > product.price
      ? Math.round((1 - product.price / product.old_price) * 100)
      : null;

  return (
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
      <div className="mt-1 flex items-center gap-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Truck className="size-4 text-(--primary)" />
          {settings.free_delivery_mode === "all"
            ? "Livraison gratuite"
            : settings.free_delivery_mode === "stopdesk"
              ? "Gratuit en Stopdesk"
              : "69 wilayas"}
        </span>
        <span className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
        <span className="flex items-center gap-1.5">
          <Banknote className="size-4 text-(--primary)" />
          Paiement à la livraison
        </span>
      </div>
      <a
        href="#commander"
        className="mt-2 flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Commander maintenant
        <ArrowDown className="size-4" />
      </a>
    </div>
  );
}

/** Galerie : grande image + miniatures, zoom au clic, swipe. */
export function GalleryBlock({ product }: { product: Product }) {
  return (
    <div className="animate-fade-up-delay relative">
      <div
        aria-hidden="true"
        className="absolute -inset-x-2 -inset-y-2 rounded-4xl bg-(--primary)/10"
      />
      <div className="relative">
        <Gallery images={product.images} alt={product.name} />
      </div>
    </div>
  );
}

/**
 * Description et points forts saisis dans l'admin. `dir="auto"` partout : la
 * page est en LTR mais ces textes sont saisis librement (arabe ici, français
 * ailleurs) — le navigateur déduit le sens du premier caractère fort, et les
 * marges logiques (`start-*`, `ps-*`) suivent.
 */
export function DescriptionBlock({ product }: { product: Product }) {
  if (!product.description && product.features.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 pt-9">
      {product.description && (
        <div
          dir="auto"
          className="relative overflow-hidden rounded-3xl bg-white py-5 pe-5 ps-6 shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 inset-s-0 w-1 bg-(--primary)"
          />
          {/* `whitespace-pre-line` conserve les retours à la ligne saisis */}
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            {product.description}
          </p>
        </div>
      )}

      {product.features.length > 0 && (
        // `gap-px` sur fond gris : des séparateurs d'un pixel entre les
        // lignes blanches, sans bordure à gérer sur chacune.
        <ul className="grid gap-px overflow-hidden rounded-3xl bg-zinc-200/70 shadow-sm ring-1 ring-zinc-200/60 dark:bg-white/10 dark:ring-white/10">
          {product.features.map((feature) => (
            <li
              key={feature}
              dir="auto"
              className="flex items-start gap-3 bg-white px-5 py-3.5 dark:bg-zinc-900"
            >
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-(--primary)/15 text-(--primary)">
                <Check className="size-3" strokeWidth={3.5} />
              </span>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{feature}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Offres groupées (si configurées) puis formulaire : les deux partagent le
 * pack sélectionné, d'où le composant client commun.
 */
export function FormBlock({
  product,
  settings,
}: {
  product: Product;
  settings: Settings;
}) {
  return (
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
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Vous ne payez qu&apos;à la réception de votre colis
        </p>
      </div>
    </Offers>
  );
}

/**
 * Image pleine largeur, bord à bord : `-mx-4` annule le padding de la colonne
 * pour que deux sections image consécutives se touchent et se lisent comme un
 * seul visuel continu. Les dimensions réelles réservent la place avant le
 * chargement (pas de saut de mise en page).
 */
export function ImageBlock({
  block,
  priority = false,
}: {
  block: Extract<LandingBlock, { type: "image" }>;
  priority?: boolean;
}) {
  return (
    <section className="-mx-4">
      <Image
        src={block.url}
        alt=""
        width={block.width}
        height={block.height}
        sizes="(max-width: 420px) 100vw, 420px"
        priority={priority}
        className="block h-auto w-full"
      />
    </section>
  );
}

/** Titre + paragraphe libre, dans la même carte que la description. */
export function TextBlock({
  block,
}: {
  block: Extract<LandingBlock, { type: "text" }>;
}) {
  return (
    <section dir="auto" className="flex flex-col gap-3 pt-9">
      {block.title && (
        <h2 className="text-center text-2xl font-extrabold leading-tight tracking-tight">
          {block.title}
        </h2>
      )}
      {block.body && (
        <div className="relative overflow-hidden rounded-3xl bg-white py-5 pe-5 ps-6 shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 inset-s-0 w-1 bg-(--primary)"
          />
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300">
            {block.body}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Enchaîne les blocs du mode custom. Une image qui suit un autre type de bloc
 * reçoit une marge haute ; deux images consécutives restent collées, et la
 * première image de la page est chargée en priorité (c'est le LCP).
 */
export function CustomBlocks({
  blocks,
  product,
  settings,
}: {
  blocks: LandingBlock[];
  product: Product;
  settings: Settings;
}) {
  const firstImage = blocks.findIndex((b) => b.type === "image");
  return blocks.map((block, index) => {
    const previous = blocks[index - 1];
    switch (block.type) {
      case "hero":
        return <HeroBlock key={block.id} product={product} settings={settings} />;
      case "gallery":
        return <GalleryBlock key={block.id} product={product} />;
      case "description":
        return <DescriptionBlock key={block.id} product={product} />;
      case "form":
        return <FormBlock key={block.id} product={product} settings={settings} />;
      case "text":
        return <TextBlock key={block.id} block={block} />;
      case "image": {
        const glued = !previous || previous.type === "image" || previous.type === "hero";
        return (
          <div key={block.id} className={glued ? undefined : "pt-8"}>
            <ImageBlock block={block} priority={index === firstImage} />
          </div>
        );
      }
    }
  });
}
