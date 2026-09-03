"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  deleteImages,
  createUploadTarget,
  isBucketUrl,
  MAX_IMAGE_SIZE,
  type UploadTarget,
} from "@/lib/storage";
import { getProductById, getProducts, getSettings } from "@/lib/data";
import { normalizeSlug } from "@/lib/domain";
import { revalidateStorefronts } from "@/lib/revalidate";
import { BASE_PACK_ID, PACK_HIGHLIGHTS, type ProductPack } from "@/lib/types";
import { requireAdmin } from "./auth";

export type ProductFormState = { success?: boolean; error?: string };

/** Nombre d'images demandables en une seule sélection (la galerie, elle, est illimitée). */
const MAX_BATCH = 40;

/** Nombre de packs qu'un produit peut proposer. Au-delà, plus personne ne choisit. */
const MAX_PACKS = 10;

/**
/**
 * Valide les packs envoyés par l'éditeur. Un pack incomplet (label vide,
 * quantité ou prix absurdes) est écarté silencieusement plutôt que de bloquer
 * l'enregistrement : l'éditeur ne permet pas d'en produire, et un pack invalide
 * en base afficherait une offre incommandable sur la landing.
 */
function parsePacks(raw: unknown[]): ProductPack[] {
  const seen = new Set<string>();
  return raw
    .flatMap((p: unknown): ProductPack[] => {
      const pack = p as Record<string, unknown>;
      const id = typeof pack?.id === "string" ? pack.id : "";
      const label = typeof pack?.label === "string" ? pack.label.trim() : "";
      if (!id || seen.has(id) || !label) return [];

      const quantity = Number(pack.quantity);
      const price = Number(pack.price);
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 20) return [];
      if (!Number.isFinite(price) || price < 0) return [];

      const oldPrice = Number(pack.old_price);
      const badge = typeof pack.badge === "string" ? pack.badge.trim() : "";

      seen.add(id);
      return [
        {
          id,
          label: label.slice(0, 60),
          quantity: Math.round(quantity),
          price,
          old_price:
            pack.old_price !== null && Number.isFinite(oldPrice) && oldPrice > 0
              ? oldPrice
              : null,
          badge: badge ? badge.slice(0, 40) : null,
          highlight: PACK_HIGHLIGHTS.includes(
            pack.highlight as ProductPack["highlight"]
          )
            ? (pack.highlight as ProductPack["highlight"])
            : "none",
        },
      ];
    })
    .slice(0, MAX_PACKS);
}

/**
 * Prépare des URLs d'upload signées pour les images principales du produit.
 */
export async function createProductUploadUrls(
  files: { name: string; type: string; size: number }[]
): Promise<{ targets?: UploadTarget[]; error?: string }> {
  await requireAdmin();

  if (!Array.isArray(files) || files.length === 0) return { error: "Aucun fichier." };
  if (files.length > MAX_BATCH)
    return { error: `${MAX_BATCH} images maximum par sélection.` };

  for (const file of files) {
    if (typeof file?.type !== "string" || !file.type.startsWith("image/"))
      return { error: "Seules les images sont acceptées." };
    if (!Number.isFinite(file?.size) || file.size <= 0 || file.size > MAX_IMAGE_SIZE)
      return { error: "Image trop lourde (max 5 Mo)." };
  }

  try {
    const targets = await Promise.all(
      files.map((file) => createUploadTarget(String(file.name || "image.jpg"), "product"))
    );
    return { targets };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload impossible." };
  }
}

/**
 * Supprime une image tout juste uploadée que l'admin retire avant d'enregistrer.
 * Refuse toute URL déjà rattachée au produit — galerie comme packs : celles-là
 * ne partent qu'après un enregistrement réussi (voir `updateProduct`).
 */
export async function discardProductImage(
  productId: string,
  url: string
): Promise<void> {
  await requireAdmin();
  if (typeof url !== "string" || !isBucketUrl(url, "product")) return;

  const product = await getProductById(productId);
  if (!product) return;
  if (product.images.includes(url)) return;
  await deleteImages([url]);
}

export async function updateProduct(
  _prev: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  await requireAdmin();

  const productId = String(formData.get("product_id") || "");
  const product = await getProductById(productId);
  if (!product) return { error: "Produit introuvable." };

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = Number(formData.get("price"));
  const oldPriceRaw = String(formData.get("old_price") || "").trim();
  const old_price = oldPriceRaw ? Number(oldPriceRaw) : null;
  const features = String(formData.get("features") || "")
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);

  // Variantes : couleurs [{name, hex}] et tailles [string]
  let colors: { name: string; hex: string }[] = [];
  let sizes: string[] = [];
  let packs: ProductPack[] = [];
  try {
    const rawColors: unknown = JSON.parse(String(formData.get("colors") || "[]"));
    const rawSizes: unknown = JSON.parse(String(formData.get("sizes") || "[]"));
    const rawPacks: unknown = JSON.parse(String(formData.get("packs") || "[]"));
    if (Array.isArray(rawColors)) {
      colors = rawColors
        .filter(
          (c): c is { name: string; hex: string } =>
            typeof c?.name === "string" &&
            typeof c?.hex === "string" &&
            /^#[0-9a-fA-F]{6}$/.test(c.hex) &&
            c.name.trim().length > 0
        )
        .map((c) => ({ name: c.name.trim().slice(0, 40), hex: c.hex }))
        .slice(0, 30);
    }
    if (Array.isArray(rawSizes)) {
      sizes = rawSizes
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 20))
        .slice(0, 30);
    }
    if (Array.isArray(rawPacks)) {
      const extraPacks = parsePacks(rawPacks)
        .filter((pack) => pack.id !== BASE_PACK_ID && pack.quantity !== 1)
        .map((pack) => ({ ...pack, old_price: pack.quantity * price }));
      if (extraPacks.length > 0) {
        packs = [
          {
            id: BASE_PACK_ID,
            label: "1 pièce",
            quantity: 1,
            price,
            old_price,
            badge: null,
            highlight: "none",
          },
          ...extraPacks,
        ];
      }
    }
  } catch {
    return { error: "Variantes invalides." };
  }

  if (!name) return { error: "Le nom du produit est requis." };
  if (!Number.isFinite(price) || price < 0) return { error: "Prix invalide." };
  if (old_price !== null && (!Number.isFinite(old_price) || old_price < 0))
    return { error: "Ancien prix invalide." };

  // Le navigateur a déjà uploadé les images vers Supabase : il ne renvoie ici
  // que la liste ordonnée des URLs à conserver.
  let images: string[] = [];
  try {
    const raw: unknown = JSON.parse(String(formData.get("images") || "[]"));
    if (!Array.isArray(raw)) return { error: "Images invalides." };
    images = raw.filter(
      (url): url is string => typeof url === "string" && isBucketUrl(url, "product")
    );
    images = [...new Set(images)];
  } catch {
    return { error: "Images invalides." };
  }

  const { error } = await supabase()
    .from("product")
    .update({
      name,
      description,
      price,
      old_price,
      features,
      colors,
      sizes,
      packs,
      images,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id);
  if (error) return { error: error.message };

  // Les images retirées sont supprimées définitivement du storage (seulement
  // après la réussite de la mise à jour en base). Les photos de packs comptent
  // aussi : supprimer un pack doit effacer son image.
  const kept = new Set(images);
  const removed = product.images.filter((url) => !kept.has(url));
  await deleteImages(removed);

  revalidateStorefronts();
  revalidatePath(`/admin/produits/${product.id}`);
  // Retour à la carte d'aperçu après enregistrement
  redirect(`/admin/produits/${product.id}`);
}

/** Slug libre dérivé du nom : `mon-produit`, `mon-produit-2`, etc. */
async function uniqueSlug(name: string): Promise<string> {
  const taken = new Set((await getProducts()).map((p) => p.slug));
  const base = normalizeSlug(name) || "produit";
  if (!taken.has(base)) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`.slice(0, 60).replace(/-+$/, "");
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 60);
}

/**
 * Nouvelle boutique. Elle démarre sans domaine et inactive : le temps de la
 * remplir, personne ne doit tomber dessus. Le domaine et l'activation se
 * règlent ensuite dans l'onglet Vitrine.
 */
export async function createProduct(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = String(formData.get("name") || "").trim().slice(0, 120) || "Mon Produit";
  const { data, error } = await supabase()
    .from("product")
    .insert({
      name,
      slug: await uniqueSlug(name),
      store_name: name,
      active: false,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Création impossible: ${error?.message}`);

  revalidatePath("/admin/produits");
  redirect(`/admin/produits/${data.id}?edit=1`);
}

/**
 * Supprime définitivement un produit et ses images. Les commandes déjà
 * passées survivent (`product_id` retombe à null en base) : elles gardent le
 * nom du produit figé à la commande.
 */
export async function deleteProduct(formData: FormData): Promise<void> {
  await requireAdmin();

  const product = await getProductById(String(formData.get("product_id") || ""));
  if (!product) redirect("/admin/produits");

  const { error } = await supabase().from("product").delete().eq("id", product.id);
  if (error) throw new Error(`Suppression impossible: ${error.message}`);

  // Images libérées seulement après la suppression en base : un fichier
  // orphelin n'est pas grave, une image manquante sur une page vivante si.
  await deleteImages([
    ...product.images,
    ...product.landing_blocks.flatMap((b) => (b.type === "image" ? [b.url] : [])),
    ...(product.logo_url ? [product.logo_url] : []),
  ]);

  revalidateStorefronts();
  revalidatePath("/admin/produits");
  redirect("/admin/produits");
}

/**
 * Produit servi sur les hôtes qui ne correspondent à aucun domaine — le
 * domaine Vercel du projet, typiquement.
 */
export async function setDefaultProduct(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("product_id") || "");
  const product = await getProductById(id);
  const settings = await getSettings();
  if (!product || !settings.id) redirect("/admin/produits");

  await supabase()
    .from("settings")
    .update({ default_product_id: product.id, updated_at: new Date().toISOString() })
    .eq("id", settings.id);

  revalidateStorefronts();
  revalidatePath("/admin/produits");
  redirect("/admin/produits");
}
