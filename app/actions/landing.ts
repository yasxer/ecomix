"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import {
  createUploadTarget,
  deleteImages,
  isBucketUrl,
  MAX_IMAGE_SIZE,
  uploadImage,
  type UploadTarget,
} from "@/lib/storage";
import { readSize } from "@/lib/image-size";
import { composeSection } from "@/lib/compose-section";
import { generateSceneImage } from "@/lib/replicate";
import { getProductById, normalizeLandingBlocks } from "@/lib/data";
import { generateLandingBlocks } from "@/lib/ai-landing";
import { revalidateStorefronts } from "@/lib/revalidate";
import {
  IMAGE_RATIOS,
  LANDING_MODES,
  LANDING_THEMES,
  type ImageBrief,
  type LandingBlock,
  type LandingLanguage,
  type LandingMode,
  type LandingTheme,
} from "@/lib/types";
import { requireAdmin } from "./auth";

export type LandingFormState = { success?: boolean; error?: string };

/** Dossier du bucket réservé aux images de sections (distinct des photos produit). */
const FOLDER = "landing";

/** Au-delà, la page devient interminable à charger sur mobile. */
const MAX_BLOCKS = 40;

/** Blocs qui reprennent les données du produit : les répéter n'aurait aucun sens. */
const SINGLETONS: LandingBlock["type"][] = ["hero", "gallery", "description", "form"];

/**
 * Toutes les images portées par les blocs, pour comparer avant/après
 * enregistrement. Une section « showcase » a la sienne, en plus des blocs
 * image : l'oublier ici laisserait des fichiers orphelins dans le bucket.
 */
function imageUrls(blocks: LandingBlock[]): string[] {
  return blocks.flatMap((b) => {
    if (b.type === "image") return [b.url];
    if (b.type === "showcase" && b.url) return [b.url];
    return [];
  });
}

/**
 * Prépare une URL d'upload signée pour l'image d'une section. Une seule à la
 * fois : chaque bloc image porte exactement une image.
 */
export async function createLandingUploadUrl(file: {
  name: string;
  type: string;
  size: number;
}): Promise<{ target?: UploadTarget; error?: string }> {
  await requireAdmin();

  if (typeof file?.type !== "string" || !file.type.startsWith("image/"))
    return { error: "Seules les images sont acceptées." };
  if (!Number.isFinite(file?.size) || file.size <= 0 || file.size > MAX_IMAGE_SIZE)
    return { error: "Image trop lourde (max 5 Mo)." };

  try {
    const target = await createUploadTarget(String(file.name || "image.jpg"), FOLDER);
    return { target };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload impossible." };
  }
}

/**
 * Supprime une image de section uploadée puis retirée avant enregistrement.
 * Refuse toute URL déjà rattachée à un bloc enregistré : celles-là ne partent
 * qu'après un enregistrement réussi (voir `updateLanding`).
 */
export async function discardLandingImage(
  productId: string,
  url: string
): Promise<void> {
  await requireAdmin();
  if (typeof url !== "string" || !isBucketUrl(url, FOLDER)) return;

  const product = await getProductById(productId);
  if (!product) return;
  if (imageUrls(product.landing_blocks).includes(url)) return;
  await deleteImages([url]);
}

export async function updateLanding(
  _prev: LandingFormState,
  formData: FormData
): Promise<LandingFormState> {
  await requireAdmin();

  const product = await getProductById(String(formData.get("product_id") || ""));
  if (!product) return { error: "Produit introuvable." };

  const landing_mode = String(formData.get("landing_mode") || "simple") as LandingMode;
  if (!LANDING_MODES.includes(landing_mode)) return { error: "Mode invalide." };

  const landing_theme = String(formData.get("landing_theme") || "light") as LandingTheme;
  if (!LANDING_THEMES.includes(landing_theme)) return { error: "Thème invalide." };
  const landing_sticky_cta = formData.get("landing_sticky_cta") === "1";
  const landing_sticky_header = formData.get("landing_sticky_header") === "1";

  // Le navigateur a déjà uploadé les images vers Supabase : il ne renvoie ici
  // que la liste ordonnée des blocs. Une URL hors de notre bucket est refusée.
  let blocks: LandingBlock[];
  try {
    const raw: unknown = JSON.parse(String(formData.get("landing_blocks") || "[]"));
    if (!Array.isArray(raw)) return { error: "Blocs invalides." };
    blocks = normalizeLandingBlocks(raw);
  } catch {
    return { error: "Blocs invalides." };
  }

  if (blocks.length > MAX_BLOCKS)
    return { error: `${MAX_BLOCKS} blocs maximum.` };

  // Le client choisit *quelles* images garder, il ne doit pas pouvoir injecter
  // une URL arbitraire — la landing est publique, l'image aussi. La vérification
  // porte sur le bucket et non sur le dossier `landing/` : une section composée
  // automatiquement réutilise les photos du produit, qui vivent ailleurs.
  for (const url of imageUrls(blocks)) {
    if (!isBucketUrl(url))
      return { error: "Une section pointe vers une image inconnue." };
  }

  for (const type of SINGLETONS) {
    if (blocks.filter((b) => b.type === type).length > 1)
      return { error: "Un bloc produit ne peut apparaître qu'une seule fois." };
  }

  // Sans formulaire, personne ne peut commander : le mode custom l'exige.
  // Le mode simple, lui, garde ses blocs en réserve sans les vérifier.
  if (landing_mode === "custom" && !blocks.some((b) => b.type === "form"))
    return { error: "La page personnalisée doit contenir le bloc Formulaire." };

  const { error } = await supabase()
    .from("product")
    .update({
      landing_mode,
      landing_blocks: blocks,
      landing_theme,
      landing_sticky_cta,
      landing_sticky_header,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id);
  if (error) return { error: error.message };

  // Les images de sections retirées sont supprimées du storage, seulement
  // après la réussite de la mise à jour en base.
  // Restreint au dossier des sections : une photo produit citée par un
  // « showcase » puis retirée appartient toujours au produit — l'effacer ici
  // la ferait disparaître de la galerie et de l'admin.
  const kept = new Set(imageUrls(blocks));
  const removed = imageUrls(product.landing_blocks).filter(
    (url) => !kept.has(url) && isBucketUrl(url, FOLDER)
  );
  await deleteImages(removed);

  revalidateStorefronts();
  revalidatePath(`/admin/produits/${product.id}/landing`);
  return { success: true };
}

export type GenerateLandingState = {
  blocks?: LandingBlock[];
  /** Scènes restant à composer, par identifiant de bloc. */
  briefs?: Record<string, ImageBrief>;
  error?: string;
};

/**
 * Compose une landing complète à partir du produit et de ses photos.
 *
 * Rien n'est enregistré : les blocs remontent au navigateur, qui les charge
 * dans l'éditeur. L'administrateur relit, corrige, puis enregistre — une page
 * générée ne doit jamais remplacer sans préavis un travail fait à la main.
 */
export async function generateLanding(
  productId: string,
  language: LandingLanguage,
  hint: string
): Promise<GenerateLandingState> {
  await requireAdmin();

  const product = await getProductById(productId);
  if (!product) return { error: "Produit introuvable." };

  try {
    const composed = await generateLandingBlocks(product, {
      language,
      hint: hint.slice(0, 600),
      canComposeImages:
        Boolean(process.env.REPLICATE_API_TOKEN) && product.images.length > 0,
    });
    // Même porte d'entrée que l'enregistrement : ce que le modèle rend n'a pas
    // plus de crédit que ce que le navigateur envoie.
    const blocks = normalizeLandingBlocks(composed.blocks).slice(0, MAX_BLOCKS);

    if (blocks.length === 0) return { error: "Le modèle n'a rendu aucune section." };
    // Le bon de commande n'est pas négociable : on le remet plutôt que
    // d'obliger l'administrateur à comprendre pourquoi l'enregistrement refuse.
    if (!blocks.some((b) => b.type === "form")) {
      blocks.push({ id: crypto.randomUUID(), type: "form" });
    }

    // Une consigne dont le bloc a été écarté à la normalisation n'a plus de
    // destinataire : la garder ferait générer un visuel pour rien.
    const kept = new Set(blocks.map((b) => b.id));
    const briefs = Object.fromEntries(
      Object.entries(composed.briefs).filter(([id]) => kept.has(id))
    );
    return { blocks, briefs };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Génération impossible." };
  }
}

export type SectionImageState =
  | { ok: true; url: string; width: number; height: number }
  | { ok: false; error: string };

/**
 * Compose le visuel d'une section, en deux temps.
 *
 * 1. Le générateur repeint la scène autour du produit, à partir de ses vraies
 *    photos, et sans y écrire le moindre mot.
 * 2. Si la section demande un visuel gravé, le titre et les puces sont
 *    dessinés dans l'image par un moteur typographique. C'est la seule façon
 *    d'obtenir de l'arabe correct : aucun générateur d'images ne sait lier les
 *    lettres ni les écrire de droite à gauche.
 *
 * Une image à la fois, sur appel du navigateur. Enchaîner les cinq visuels
 * d'une page dans une seule requête la ferait expirer bien avant la fin, et
 * une panne au quatrième ferait perdre les trois premiers.
 *
 * Le fichier rendu est aussitôt rapatrié dans notre bucket : l'URL de
 * Replicate expire au bout de quelques heures, une landing qui pointe dessus
 * s'afficherait vide le lendemain.
 */
export async function generateSectionImage(
  productId: string,
  brief: ImageBrief
): Promise<SectionImageState> {
  await requireAdmin();

  const product = await getProductById(productId);
  if (!product) return { ok: false, error: "Produit introuvable." };
  if (product.images.length === 0) {
    return { ok: false, error: "Ce produit n'a aucune photo à donner comme référence." };
  }

  const scene = String(brief?.scene ?? "").trim().slice(0, 800);
  if (!scene) return { ok: false, error: "Consigne de visuel vide." };
  const ratio = IMAGE_RATIOS.includes(brief?.ratio) ? brief.ratio : "4:5";

  try {
    const remote = await generateSceneImage({
      scene,
      references: product.images,
      ratio,
    });

    const response = await fetch(remote, { cache: "no-store" });
    if (!response.ok) return { ok: false, error: "Visuel généré mais introuvable." };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_SIZE) return { ok: false, error: "Visuel généré trop lourd." };

    // Les dimensions se lisent dans les octets déjà téléchargés : inutile de
    // redemander le fichier une fois en ligne.
    let final: Uint8Array<ArrayBufferLike> = bytes;
    let type = response.headers.get("content-type") ?? "image/jpeg";

    if (brief.text) {
      // Le texte devient l'image : plus rien ne sera rendu par-dessus.
      final = await composeSection({
        background: bytes,
        title: String(brief.text.title ?? "").slice(0, 160),
        body: String(brief.text.body ?? "").slice(0, 400),
        bullets: (Array.isArray(brief.text.bullets) ? brief.text.bullets : [])
          .filter((b) => typeof b === "string" && b.trim())
          .slice(0, 4),
        primaryColor: product.primary_color,
        ratio,
      });
      type = "image/jpeg";
    }

    const size = readSize(final);
    if (!size) return { ok: false, error: "Visuel généré illisible." };

    // Recopie dans un tampon neuf : `File` n'accepte pas un `Buffer` Node,
    // dont la mémoire sous-jacente peut être partagée.
    const file = new File([new Uint8Array(final)], "scene.jpg", {
      type: type.startsWith("image/") ? type : "image/jpeg",
    });
    const url = await uploadImage(file, FOLDER);

    return { ok: true, url, ...size };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Génération du visuel impossible.",
    };
  }
}
