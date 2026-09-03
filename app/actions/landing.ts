"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import {
  createUploadTarget,
  deleteImages,
  isBucketUrl,
  MAX_IMAGE_SIZE,
  type UploadTarget,
} from "@/lib/storage";
import { getProductById, normalizeLandingBlocks } from "@/lib/data";
import { revalidateStorefronts } from "@/lib/revalidate";
import {
  LANDING_MODES,
  LANDING_THEMES,
  type LandingBlock,
  type LandingMode,
  type LandingTheme,
} from "@/lib/types";
import { requireAdmin } from "./auth";

export type LandingFormState = { success?: boolean; error?: string };

/** Dossier du bucket réservé aux images de sections (distinct des photos produit). */
const FOLDER = "landing";

/** Au-delà, la page devient interminable à charger sur mobile. */
const MAX_BLOCKS = 40;

const MAX_TITLE = 120;
const MAX_BODY = 2000;

/** Blocs qui reprennent les données du produit : les répéter n'aurait aucun sens. */
const SINGLETONS: LandingBlock["type"][] = ["hero", "gallery", "description", "form"];

/** Extrait les URLs des blocs image, pour comparer avant/après enregistrement. */
function imageUrls(blocks: LandingBlock[]): string[] {
  return blocks.flatMap((b) => (b.type === "image" ? [b.url] : []));
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

  for (const block of blocks) {
    if (block.type === "image" && !isBucketUrl(block.url, FOLDER))
      return { error: "Une section image pointe vers une image inconnue." };
  }

  blocks = blocks.map((block) =>
    block.type === "text"
      ? {
          ...block,
          title: block.title.trim().slice(0, MAX_TITLE),
          body: block.body.trim().slice(0, MAX_BODY),
        }
      : block
  ).filter((block) => block.type !== "text" || block.title || block.body);

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
  const kept = new Set(imageUrls(blocks));
  const removed = imageUrls(product.landing_blocks).filter((url) => !kept.has(url));
  await deleteImages(removed);

  revalidateStorefronts();
  revalidatePath(`/admin/produits/${product.id}/landing`);
  return { success: true };
}
