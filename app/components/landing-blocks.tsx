import Image from "next/image";
import { ArrowDown, BadgeCheck, Banknote, Check, ChevronDown, Star, Truck, X } from "lucide-react";
import type { LandingBlock, Product } from "@/lib/types";
import { Gallery } from "./gallery";
import { BlockIcon } from "./landing-icon";
import { Offers } from "./offers";

/**
 * Les sections de la landing, une par bloc. Le mode simple les enchaîne dans
 * un ordre fixe, le mode custom suit `product.landing_blocks`. Tout est
 * Server Component : seules la galerie et le formulaire embarquent du client.
 */

export function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

/** Titre, prix, remise, mini badges et bouton d'ancre vers le formulaire. */
export function HeroBlock({ product }: { product: Product }) {
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
      <h1 className="landing-title text-3xl">{product.name}</h1>
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
          {product.free_delivery_mode === "all"
            ? "Livraison gratuite"
            : product.free_delivery_mode === "stopdesk"
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
export function FormBlock({ product }: { product: Product }) {
  return (
    <Offers
      productId={product.id}
      packs={product.packs}
      price={product.price}
      colors={product.colors}
      sizes={product.sizes}
      freeDeliveryMode={product.free_delivery_mode}
    >
      <div className="mb-6 flex flex-col items-center gap-1 text-center">
        <h2 className="landing-title text-[26px]">Passez votre commande</h2>
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
  preload = false,
}: {
  block: Extract<LandingBlock, { type: "image" }>;
  /** Réservé au visuel LCP : il est préchargé depuis le `<head>`. */
  preload?: boolean;
}) {
  return (
    <section className="-mx-4">
      <Image
        src={block.url}
        alt=""
        width={block.width}
        height={block.height}
        sizes="(max-width: 420px) 100vw, 420px"
        preload={preload}
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
        <h2 className="landing-title text-center text-[26px]">{block.title}</h2>
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

/* ── Sections d'argumentaire ──────────────────────────────────────────────────
   Celles qui font la longueur d'une page de vente. Toutes suivent les mêmes
   règles : `dir="auto"` (le texte est saisi en arabe ici, en français
   ailleurs — le navigateur déduit le sens du premier caractère fort et les
   marges logiques suivent), aucune largeur fixe, et la couleur de la boutique
   via `--primary` plutôt qu'une teinte codée en dur. */

/** Titre de section, partagé pour que la hiérarchie reste la même partout. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 dir="auto" className="landing-title text-center text-[26px]">
      {children}
    </h2>
  );
}

/** Liste à cocher, reprise par « showcase » et par les colonnes de « compare ». */
function CheckList({ points, tone }: { points: string[]; tone?: "muted" }) {
  if (points.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {points.map((point) => (
        <li key={point} dir="auto" className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-(--primary)/15 text-(--primary)">
            <Check className="size-3" strokeWidth={3.5} />
          </span>
          <span
            className={`text-sm font-medium ${
              tone === "muted"
                ? "text-zinc-600 dark:text-zinc-300"
                : "text-zinc-700 dark:text-zinc-200"
            }`}
          >
            {point}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Visuel + argumentaire. C'est la section qui porte la page : le texte n'est
 * jamais incrusté dans l'image, il se pose dessus (`overlay`) ou dessous
 * (`stack`) en HTML — donc il reste net à tout zoom, indexable, et modifiable
 * sans toucher au visuel.
 *
 * En `overlay`, le texte est blanc sur un dégradé sombre appliqué à l'image :
 * il ne dépend pas du thème de la boutique, seul le dégradé garantit le
 * contraste, quelle que soit la photo derrière.
 */
export function ShowcaseBlock({
  block,
  preload = false,
}: {
  block: Extract<LandingBlock, { type: "showcase" }>;
  preload?: boolean;
}) {
  const photo = block.url && (
    <Image
      src={block.url}
      alt=""
      width={block.width}
      height={block.height}
      sizes="(max-width: 420px) 100vw, 420px"
      preload={preload}
      className="block h-auto w-full"
    />
  );

  /* ── L'affiche ──
     L'image porte déjà le titre, le paragraphe et les puces : ils y ont été
     gravés à la composition. Les réafficher en HTML les dirait deux fois. */
  if (block.layout === "baked" && photo) {
    return <section className="-mx-4">{photo}</section>;
  }

  /* ── Texte sous le visuel ──
     La carte remonte sur l'image plutôt que de se poser dessous : les deux se
     lisent comme un seul bloc, et l'image respire au lieu d'être coupée net
     par un bord droit. */
  return (
    <section className="flex flex-col pt-9">
      {photo && <div className="-mx-4 overflow-hidden">{photo}</div>}
      <div
        className={`flex flex-col gap-3 rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10 ${
          photo ? "relative z-10 -mt-10" : ""
        }`}
      >
        {block.title && (
          <h2 dir="auto" className="landing-title text-[24px]">
            {block.title}
          </h2>
        )}
        {block.body && (
          <p
            dir="auto"
            className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300"
          >
            {block.body}
          </p>
        )}
        <CheckList points={block.bullets} />
      </div>
    </section>
  );
}

/**
 * Le problème que le produit résout. La couleur d'alerte est fixe (rose) et
 * non `--primary` : c'est la seule section où la couleur dit « voilà ce qui
 * ne va pas » — la reprendre de la marque brouillerait le message.
 */
export function ProblemBlock({
  block,
}: {
  block: Extract<LandingBlock, { type: "problem" }>;
}) {
  return (
    <section className="flex flex-col gap-4 pt-9">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      {block.body && (
        <p
          dir="auto"
          className="whitespace-pre-line text-center text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-300"
        >
          {block.body}
        </p>
      )}
      {block.items.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {block.items.slice(0, 3).map((item) => (
            <li
              key={item.label}
              dir="auto"
              className="flex flex-col items-center gap-2 rounded-2xl bg-white px-2 py-4 text-center shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400">
                <BlockIcon name={item.icon} className="size-5" />
              </span>
              <span className="text-xs font-bold leading-snug text-zinc-700 dark:text-zinc-200">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Grille des atouts : icône, libellé, précision. Deux colonnes sur mobile. */
export function FeaturesBlock({
  block,
}: {
  block: Extract<LandingBlock, { type: "features" }>;
}) {
  return (
    <section className="flex flex-col gap-4 pt-9">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <ul className="grid grid-cols-2 gap-2.5">
        {block.items.map((item) => (
          <li
            key={item.label}
            dir="auto"
            className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-(--primary)/12 text-(--primary)">
              <BlockIcon name={item.icon} className="size-5" />
            </span>
            <span className="text-sm font-bold leading-snug text-zinc-800 dark:text-zinc-100">
              {item.label}
            </span>
            {item.hint && (
              <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {item.hint}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Avant / après, côte à côte. Deux colonnes même sur un écran étroit : les
 * empiler ferait disparaître la comparaison, qui est tout l'intérêt du bloc.
 */
export function CompareBlock({
  block,
}: {
  block: Extract<LandingBlock, { type: "compare" }>;
}) {
  const columns = [
    {
      side: block.before,
      icon: X,
      ring: "ring-rose-500/25",
      tint: "text-rose-500 dark:text-rose-400",
      badge: "bg-rose-500/10",
    },
    {
      side: block.after,
      icon: Check,
      ring: "ring-(--primary)/30",
      tint: "text-(--primary)",
      badge: "bg-(--primary)/12",
    },
  ];

  return (
    <section className="flex flex-col gap-4 pt-9">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <div className="grid grid-cols-2 gap-2.5">
        {columns.map(({ side, icon: Icon, ring, tint, badge }) => (
          <div
            key={side.label}
            dir="auto"
            className={`flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 dark:bg-zinc-900 ${ring}`}
          >
            <div className="flex items-center gap-2">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${badge} ${tint}`}>
                <Icon className="size-4" strokeWidth={3} />
              </span>
              <span className={`text-sm font-extrabold ${tint}`}>{side.label}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {side.points.map((point) => (
                <li
                  key={point}
                  className="text-xs font-medium leading-relaxed text-zinc-600 dark:text-zinc-300"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Questions fréquentes. `<details>` natif : l'accordéon fonctionne sans une
 * ligne de JavaScript, donc sans hydratation à payer sur une page qui doit
 * s'ouvrir en 2G.
 */
export function FaqBlock({ block }: { block: Extract<LandingBlock, { type: "faq" }> }) {
  return (
    <section className="flex flex-col gap-4 pt-9">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <div className="grid gap-px overflow-hidden rounded-3xl bg-zinc-200/70 shadow-sm ring-1 ring-zinc-200/60 dark:bg-white/10 dark:ring-white/10">
        {block.items.map((item) => (
          <details key={item.question} className="group bg-white dark:bg-zinc-900">
            <summary
              dir="auto"
              className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-bold text-zinc-800 dark:text-zinc-100"
            >
              <span className="min-w-0 flex-1">{item.question}</span>
              <ChevronDown className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" />
            </summary>
            <p
              dir="auto"
              className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300"
            >
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Avis clients. Les étoiles sont décoratives : la note est déjà dans le texte. */
export function ReviewsBlock({
  block,
}: {
  block: Extract<LandingBlock, { type: "reviews" }>;
}) {
  return (
    <section className="flex flex-col gap-4 pt-9">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <ul className="flex flex-col gap-2.5">
        {block.items.map((review, index) => (
          <li
            key={`${review.name}-${index}`}
            dir="auto"
            className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex gap-0.5"
                aria-label={`${review.rating} sur 5`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    aria-hidden="true"
                    className={`size-3.5 ${
                      i < review.rating
                        ? "fill-amber-400 text-amber-400"
                        : "fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700"
                    }`}
                  />
                ))}
              </span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                {review.name}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              {review.text}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Relance vers le formulaire, au milieu de la page comme à la fin. */
export function CtaBlock({ block }: { block: Extract<LandingBlock, { type: "cta" }> }) {
  return (
    <section className="pt-9">
      <div
        dir="auto"
        className="flex flex-col items-center gap-3 rounded-3xl bg-(--primary)/8 px-5 py-7 text-center ring-1 ring-(--primary)/20"
      >
        {block.title && <h2 className="landing-title text-[22px]">{block.title}</h2>}
        {block.body && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {block.body}
          </p>
        )}
        <a
          href="#commander"
          className="mt-1 flex items-center gap-2 rounded-full bg-(--primary) px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-(--primary)/30 transition hover:-translate-y-0.5"
        >
          {block.label}
          <ArrowDown className="size-4" />
        </a>
      </div>
    </section>
  );
}

/**
 * Enchaîne les blocs du mode custom. Une image qui suit un autre type de bloc
 * reçoit une marge haute ; deux visuels consécutifs restent collés pour se
 * lire comme un seul montage. Le premier visuel de la page est préchargé :
 * c'est lui le LCP.
 */
export function CustomBlocks({
  blocks,
  product,
}: {
  blocks: LandingBlock[];
  product: Product;
}) {
  /**
   * Visuel bord à bord. Deux qui se suivent ne prennent aucune marge : une
   * page composée d'affiches doit se lire comme une seule bande continue, pas
   * comme des images posées les unes sous les autres.
   */
  const isFullBleed = (block: LandingBlock | undefined) =>
    block?.type === "image" ||
    (block?.type === "showcase" && block.layout === "baked" && block.url !== null);

  const firstVisual = blocks.findIndex(isFullBleed);

  /** Une bande continue ne s'interrompt qu'au contact d'une section de texte. */
  const glued = (block: LandingBlock, previous: LandingBlock | undefined) =>
    !isFullBleed(block) || !previous || isFullBleed(previous) || previous.type === "hero";

  return blocks.map((block, index) => {
    const previous = blocks[index - 1];
    const preload = index === firstVisual;

    switch (block.type) {
      case "hero":
        return <HeroBlock key={block.id} product={product} />;
      case "gallery":
        return <GalleryBlock key={block.id} product={product} />;
      case "description":
        return <DescriptionBlock key={block.id} product={product} />;
      case "form":
        return <FormBlock key={block.id} product={product} />;
      case "text":
        return <TextBlock key={block.id} block={block} />;
      case "problem":
        return <ProblemBlock key={block.id} block={block} />;
      case "features":
        return <FeaturesBlock key={block.id} block={block} />;
      case "compare":
        return <CompareBlock key={block.id} block={block} />;
      case "faq":
        return <FaqBlock key={block.id} block={block} />;
      case "reviews":
        return <ReviewsBlock key={block.id} block={block} />;
      case "cta":
        return <CtaBlock key={block.id} block={block} />;
      // En mode empilé, la section porte déjà sa propre marge haute.
      case "showcase":
        return (
          <div key={block.id} className={glued(block, previous) ? undefined : "pt-8"}>
            <ShowcaseBlock block={block} preload={preload} />
          </div>
        );
      case "image":
        return (
          <div key={block.id} className={glued(block, previous) ? undefined : "pt-8"}>
            <ImageBlock block={block} preload={preload} />
          </div>
        );
    }
  });
}
