import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { probeImageSize } from "./image-size";
import {
  IMAGE_RATIOS,
  type ImageBrief,
  type ImageRatio,
  type LandingBlock,
  type LandingLanguage,
  type Product,
} from "./types";

/**
 * Composition automatique d'une landing page à partir du produit et de ses
 * photos.
 *
 * Le modèle ne rend jamais de HTML : il remplit les mêmes blocs que l'admin
 * compose à la main (voir `LandingBlock`). Le rendu, la colonne de 420 px, le
 * thème, la couleur de la boutique et le formulaire restent donc entièrement
 * de notre côté — le modèle n'écrit que le contenu, et une réponse aberrante
 * ne peut pas casser la page, seulement produire un texte à corriger.
 *
 * Le texte n'est pas non plus incrusté dans une image : il vit dans les blocs,
 * donc il reste net, indexable, modifiable, et correctement rendu en arabe.
 */

const LANGUAGE_RULES: Record<LandingLanguage, string> = {
  ar: "Écris en arabe standard moderne, simple et direct — pas de tournures littéraires.",
  darija:
    "Écris en derja algérienne, en caractères arabes, telle qu'on la parle à Alger. Reste compréhensible partout dans le pays : évite l'argot trop local.",
  fr: "Écris en français, sur un ton direct et concret.",
};

/** Photos envoyées au modèle. Au-delà, il décrit deux fois la même chose. */
const MAX_PHOTOS = 4;

/* ── Schéma de sortie ─────────────────────────────────────────────────────────
   Un schéma strict : le modèle ne peut pas inventer un type de section, un nom
   d'icône ou un champ. Ce qui en sort repasse malgré tout par
   `normalizeLandingBlocks` — le schéma garantit la forme, pas la longueur des
   textes ni la cohérence de l'ensemble. */

type JsonSchema = Record<string, unknown>;

const TEXT: JsonSchema = { type: "string" };
const TEXT_LIST: JsonSchema = { type: "array", items: { type: "string" } };

/** Tous les champs sont requis : le modèle rend une chaîne vide, jamais une clé absente. */
function object(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function section(type: string, properties: Record<string, JsonSchema> = {}): JsonSchema {
  return object({ type: { type: "string", const: type }, ...properties });
}

const BLOCK_SCHEMA: JsonSchema = {
  anyOf: [
    section("hero"),
    section("form"),
    section("showcase", {
      title: TEXT,
      body: TEXT,
      bullets: TEXT_LIST,
      // Photo existante à réutiliser ; -1 pour ne pas en réutiliser.
      image_index: { type: "integer" },
      // Scène à composer autour du produit ; vide pour n'en composer aucune.
      image_prompt: TEXT,
      image_ratio: { type: "string", enum: [...IMAGE_RATIOS] },
    }),
    section("faq", {
      title: TEXT,
      items: { type: "array", items: object({ question: TEXT, answer: TEXT }) },
    }),
    section("cta", { title: TEXT, body: TEXT, label: TEXT }),
  ],
};

const OUTPUT_SCHEMA: JsonSchema = object({
  /** Le monde commun aux sept affiches, appliqué à chacune de leurs scènes. */
  art_direction: TEXT,
  blocks: { type: "array", items: BLOCK_SCHEMA },
});

/* ── Consigne ─────────────────────────────────────────────────────────────── */

const SYSTEM = `Tu composes la page de vente d'un produit vendu en Algérie, en paiement à la livraison.

TU REÇOIS les faits du produit et ses photos. TU RENDS une liste ordonnée de sections.

LE LECTEUR
Il est sur un téléphone, dans une colonne étroite. Il arrive d'une publicité Facebook ou Instagram, il ne connaît ni la marque ni le vendeur, et il paiera en espèces au livreur — donc il cherche surtout des raisons de faire confiance. Il décide en une trentaine de secondes et il fait défiler vite.

LES SECTIONS
- hero : nom, prix et remise, repris de la base. Aucun texte à écrire.
- form : les offres et le bon de commande. Aucun texte à écrire.
- showcase : une affiche. Le titre, le paragraphe et les puces que tu écris sont gravés dans l'image elle-même, et rien n'est réaffiché à côté. La page est une suite d'affiches que l'on fait défiler, comme une brochure — pas un document que l'on lit.
- faq : les objections réelles d'un acheteur en paiement à la livraison — livraison, délai, garantie, taille, entretien, retour. Quatre à six questions.
- cta : une relance vers le bon de commande. Titre, argument, texte du bouton.

LE VISUEL D'UNE SECTION showcase
Deux possibilités, et une seule à la fois.
- Réutiliser une photo fournie : image_index vaut son numéro, image_prompt reste vide.
- Faire composer une nouvelle scène autour du produit : image_prompt décrit la scène, image_index vaut -1.
Compose une nouvelle scène pour chacune des sept affiches : une photo brute sur fond blanc n'a ni la place ni le contraste pour porter un titre.

LA DIRECTION ARTISTIQUE (art_direction)
Les sept affiches se suivent sans marge : elles se touchent. Elles doivent donc se lire comme une seule bande, et non comme sept images sans rapport posées bout à bout.
Tu écris une fois, en anglais, le monde dans lequel elles se passent toutes : la matière du support, la couleur dominante, le type et la direction de la lumière, l'ambiance. Une à deux phrases.
Exemple : "dark brushed slate and charcoal surfaces, cold cinematic side lighting from the left, deep shadows, muted blue-grey palette, matte finish, no props other than the product".
Cette phrase est appliquée automatiquement à chacune des sept scènes : ne la répète jamais dans image_prompt.

ÉCRIRE POUR UN VISUEL
Le texte d'une section showcase est gravé dans l'image : il se lit en une seconde, de loin, sur un écran lumineux, et il ne se corrige pas sans refaire l'image. Sois court et définitif.
- Titre : six mots au maximum. Une affirmation, pas une description.
- Paragraphe : deux phrases courtes au plus.
- Puces : trois au maximum, quatre ou cinq mots chacune. Au-delà, elles sortent du cadre.
- Deux affiches qui se suivent se touchent bord à bord : la jointure ne doit pas se voir. Garde la même matière de support et la même lumière d'une affiche à l'autre, et ne fais varier que le point de vue.

COMMENT ÉCRIRE image_prompt
- En anglais, en une à deux phrases.
- Décris uniquement ce qui change d'une affiche à l'autre : l'angle de prise de vue, la distance, le cadrage, la position du produit, la profondeur de champ. Le décor, la lumière et la palette sont déjà fixés par art_direction — les redire ici les contredirait.
- Ne décris jamais le produit lui-même, ne le renomme pas, ne change ni sa couleur, ni sa forme, ni sa matière, ni sa marque. Il vient des photos de référence et il doit rester rigoureusement identique — c'est le produit que le client recevra.
- Ne demande jamais de texte, de logo, d'étiquette, de chiffre ni de filigrane dans l'image : tous les mots de la page sont écrits en dehors du visuel.
- Ne demande pas de personne reconnaissable ni de marque tierce.
- Prévois où ira le texte : demande une zone calme et peu chargée dans le bas du cadre.
- Exemple de bonne scène : "three-quarter view from slightly above, product resting flat, mid distance, shallow depth of field, empty space in the lower half".
- image_ratio : "4:5" pour un visuel vertical (le plus sûr en overlay), "1:1" pour un carré, "16:9" pour une bannière large.

RÈGLES DE COMPOSITION
La page est une suite d'affiches que l'on fait défiler, pas un document que l'on lit. Elle contient, dans cet ordre : sept sections showcase en "baked", au plus deux sections d'un autre type, et le bon de commande. Rien de plus.

- form exactement une fois, et en dernier : sans lui, personne ne peut commander.
- Exactement sept sections showcase, toutes en "baked", chacune avec sa propre scène.
- Les sept affiches portent tout l'argumentaire. Une affiche, une idée, dans cet ordre de vente :
  1. l'accroche : ce que le produit change pour celui qui le porte
  2. le problème d'aujourd'hui, celui qu'il vit sans le produit
  3. la réponse : comment ce produit le règle
  4. ce qui le distingue de ce qu'on trouve ailleurs
  5. une preuve concrète : matière, fabrication, finition, un détail qui se voit
  6. un usage réel, dans une journée ordinaire du client
  7. ce qui lève la dernière hésitation : garantie, livraison, paiement à la réception
- Au plus deux sections d'un autre type, et seulement si elles apportent ce qu'une image ne peut pas : "hero" affiche le prix et la remise depuis la base, "faq" répond aux objections de livraison, "cta" relance vers le bon de commande. Si aucune n'est nécessaire, n'en mets aucune.
- Seuls hero, showcase, faq, cta et form existent. Tout le reste de l'argumentaire vit dans les affiches.

RÈGLES D'ÉCRITURE
- N'invente aucun fait. Pas de certification, de norme, de récompense, de garantie, de délai, de statistique, de nombre de clients ni d'avis. Tu n'as le droit d'affirmer que ce qui figure dans les faits fournis ou ce que les photos montrent clairement.
- Ne cite jamais le prix, une remise ou un chiffre d'affaires dans ton texte : le prix vient de la base et il change. hero et form l'affichent déjà.
- Décris ce que tu vois sur les photos : matière, finition, couleur, usage. C'est ce qui distingue une page écrite pour CE produit d'un texte interchangeable.
- Phrases courtes. Un titre tient sur une ligne, une puce sur quatre ou cinq mots. Pas de superlatif vide ("incroyable", "révolutionnaire", "le meilleur du marché").
- Parle au lecteur, pas du produit : ce qu'il gagne, pas ce que le produit possède.
- Ne mets jamais de texte dans une consigne d'image : le texte vit dans les blocs, pas dans les visuels.
- Choisis les icônes dans la liste imposée, et choisis-les pour leur sens.`;

/* ── Appel ────────────────────────────────────────────────────────────────── */

/**
 * Traduit les refus d'authentification en consigne actionnable. Le message
 * brut de l'API est exact mais parle d'en-têtes HTTP à quelqu'un qui cherche
 * seulement à générer une page.
 */
function explain(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("anthropic-workspace-id")) {
    return (
      "Votre clé Anthropic est rattachée à un compte, pas à un espace de travail. " +
      "Ajoutez ANTHROPIC_WORKSPACE_ID à vos variables d'environnement (Console " +
      "Anthropic › Settings › Workspaces, identifiant en wrkspc_…), ou créez une " +
      "clé d'API ordinaire depuis un espace de travail."
    );
  }
  if (raw.includes("authentication_error") || raw.includes("invalid x-api-key")) {
    return "Clé Anthropic refusée : vérifiez ANTHROPIC_API_KEY.";
  }
  if (raw.includes("credit balance") || raw.includes("billing")) {
    return "Crédit Anthropic épuisé : rechargez votre compte pour générer des pages.";
  }
  if (raw.includes("rate_limit")) {
    return "Trop de requêtes d'affilée : patientez une minute puis réessayez.";
  }
  return raw;
}

/** Ce que le modèle rend, avant résolution des visuels et des identifiants. */
type RawBlock = {
  type: string;
  image_index?: number;
  image_prompt?: string;
  image_ratio?: string;
} & Record<string, unknown>;

/**
 * Une page composée : les blocs, et les scènes qu'il reste à faire générer.
 * Les visuels ne sont pas produits ici — chacun prend une vingtaine de
 * secondes, et les enchaîner dans la même requête la ferait expirer. Le
 * navigateur les demande ensuite un par un, et la page se remplit à vue.
 */
export type ComposedLanding = {
  blocks: LandingBlock[];
  /** Consigne de visuel, par identifiant de bloc. */
  briefs: Record<string, ImageBrief>;
};

export type GenerateOptions = {
  language: LandingLanguage;
  /** Consigne libre de l'administrateur : angle, cible, ton. */
  hint?: string;
  /**
   * Le générateur d'images est-il configuré ? Sinon, inutile de demander des
   * scènes que personne ne composera : le rédacteur se limite aux photos
   * existantes et la page reste complète.
   */
  canComposeImages: boolean;
};

function facts(product: Product): string {
  const lines = [
    `Boutique : ${product.store_name}`,
    `Produit : ${product.name}`,
    `Prix : ${product.price} DA${product.old_price ? ` (barré : ${product.old_price} DA)` : ""}`,
    product.description && `Description saisie : ${product.description}`,
    product.features.length > 0 && `Points forts saisis : ${product.features.join(" | ")}`,
    product.colors.length > 0 && `Couleurs : ${product.colors.map((c) => c.name).join(", ")}`,
    product.sizes.length > 0 && `Tailles : ${product.sizes.join(", ")}`,
    product.packs.length > 0 &&
      `Offres groupées : ${product.packs.map((p) => `${p.label} (${p.quantity} pièces)`).join(", ")}`,
    `Livraison : Yalidine, 58 wilayas, à domicile ou en bureau. ${
      product.free_delivery_mode === "all"
        ? "Livraison offerte partout."
        : product.free_delivery_mode === "stopdesk"
          ? "Livraison offerte en bureau."
          : "Frais de livraison à la charge du client."
    }`,
    `Paiement : en espèces, à la réception du colis.`,
    `Photos fournies : ${product.images.length} (numérotées à partir de 0, dans l'ordre).`,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Demande au modèle une page complète. Rend des blocs déjà rattachés à leurs
 * photos, mais pas encore normalisés : c'est `normalizeLandingBlocks`, côté
 * action, qui reste l'unique porte d'entrée vers la base.
 */
export async function generateLandingBlocks(
  product: Product,
  { language, hint, canComposeImages }: GenerateOptions
): Promise<ComposedLanding> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante : ajoutez-la à vos variables d'environnement."
    );
  }

  /**
   * Une clé « identity-linked » (rattachée à un compte plutôt qu'à un espace
   * de travail) ne dit pas d'elle-même sur quel espace elle agit : l'API la
   * refuse tant qu'on ne le précise pas. Une clé d'API ordinaire, créée dans
   * un espace de travail, n'a pas besoin de cet en-tête — d'où le réglage
   * facultatif.
   */
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic({
    defaultHeaders: workspace ? { "anthropic-workspace-id": workspace } : undefined,
  });
  const photos = product.images.slice(0, MAX_PHOTOS);

  const instructions = [
    LANGUAGE_RULES[language],
    canComposeImages
      ? null
      : "Aucun générateur d'images n'est disponible : laisse image_prompt vide dans toutes les sections showcase et réutilise uniquement les photos fournies.",
    hint?.trim() &&
      `Consigne du vendeur, prioritaire sur le reste : ${hint.trim()}`,
    `Voici les faits :\n${facts(product)}`,
    photos.length > 0
      ? `Les ${photos.length} photos ci-dessus sont numérotées de 0 à ${photos.length - 1}, dans l'ordre.`
      : `Aucune photo n'est disponible : n'utilise pas de section showcase avec image_index, et ne décris pas l'apparence du produit.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          ...photos.map((url) => ({
            type: "image" as const,
            source: { type: "url" as const, url },
          })),
          { type: "text" as const, text: instructions },
        ],
      },
    ],
  });

  let message;
  try {
    message = await stream.finalMessage();
  } catch (e) {
    throw new Error(explain(e));
  }

  if (message.stop_reason === "refusal") {
    throw new Error("Le modèle a refusé de composer cette page.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("Réponse trop longue : réessayez avec une consigne plus courte.");
  }

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Réponse illisible du modèle.");
  }

  const answer = raw as { blocks?: unknown; art_direction?: unknown };
  if (!Array.isArray(answer.blocks)) throw new Error("Réponse inattendue du modèle.");
  const direction =
    typeof answer.art_direction === "string" ? answer.art_direction.trim().slice(0, 400) : "";

  return resolveImages(answer.blocks as RawBlock[], photos, direction);
}

/**
 * Remplace les numéros de photo par de vraies URLs, relève les dimensions dont
 * `next/image` a besoin, et met de côté les scènes à composer. Une photo
 * introuvable ou illisible ne fait pas échouer la page : la section bascule
 * simplement en carte de texte.
 */
async function resolveImages(
  blocks: RawBlock[],
  photos: string[],
  direction: string
): Promise<ComposedLanding> {
  // Une seule mesure par photo, même citée par trois sections.
  const sizes = new Map<string, { width: number; height: number } | null>();
  await Promise.all(
    photos.map(async (url) => {
      sizes.set(url, await probeImageSize(url));
    })
  );

  const briefs: Record<string, ImageBrief> = {};

  const resolved = blocks.map((block) => {
    const id = crypto.randomUUID();
    if (block.type !== "showcase") return { ...block, id } as LandingBlock;

    const scene = typeof block.image_prompt === "string" ? block.image_prompt.trim() : "";
    // Une scène à composer l'emporte sur une photo réutilisée : le modèle ne
    // devrait pas remplir les deux, mais s'il le fait, la consigne gagne.
    if (scene && photos.length > 0) {
      const ratio = block.image_ratio;
      briefs[id] = {
        // La direction artistique est fondue dans la consigne, et non gardée à
        // part : elle survit ainsi à une recomposition, et l'administrateur qui
        // corrige une scène voit le monde dans lequel elle se joue.
        scene: direction ? `${direction}. ${scene}` : scene,
        ratio: (IMAGE_RATIOS as readonly string[]).includes(ratio ?? "")
          ? (ratio as ImageRatio)
          : "4:5",
        // L'affiche emporte son texte : c'est la composition, et non le rendu
        // HTML, qui l'affichera.
        text: {
          title: String(block.title ?? ""),
          body: String(block.body ?? ""),
          bullets: Array.isArray(block.bullets) ? (block.bullets as string[]) : [],
        },
      };
    }

    const index = Number(block.image_index);
    const url = !scene && Number.isInteger(index) && index >= 0 ? photos[index] : undefined;
    const size = url ? sizes.get(url) : null;

    // Une affiche suppose une image composée par nous, avec le texte gravé
    // dedans. Sans consigne de scène — pas de générateur configuré, ou aucune
    // photo de référence — rien n'a été gravé : afficher le visuel seul ferait
    // disparaître le texte en silence, donc on retombe sur la carte.
    block.layout = briefs[id] ? "baked" : "stack";
    // Les champs de composition n'existent que dans la réponse du modèle : le
    // bloc enregistré porte une URL.
    const rest: Record<string, unknown> = { ...block };
    delete rest.image_index;
    delete rest.image_prompt;
    delete rest.image_ratio;

    return {
      ...rest,
      id,
      url: size ? url! : null,
      width: size?.width ?? 0,
      height: size?.height ?? 0,
    } as LandingBlock;
  });

  // Un seul cadrage pour toute la page : des affiches de hauteurs différentes
  // se liraient comme une pile d'images, pas comme une bande.
  const common = Object.values(briefs)[0]?.ratio ?? "4:5";
  for (const brief of Object.values(briefs)) brief.ratio = common;

  return { blocks: resolved, briefs };
}
