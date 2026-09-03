"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { deleteImages, uploadImage } from "@/lib/storage";
import { getProductById } from "@/lib/data";
import { isValidDomain, isValidSlug, normalizeDomain, normalizeSlug } from "@/lib/domain";
import { revalidateStorefronts } from "@/lib/revalidate";
import { FREE_DELIVERY_MODES, type FreeDeliveryMode } from "@/lib/types";
import { requireAdmin } from "./auth";

export type StorefrontFormState = { success?: boolean; error?: string };

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Violation d'unicité côté Postgres (slug ou domaine déjà pris). */
const UNIQUE_VIOLATION = "23505";

/**
 * La vitrine d'un produit : son domaine, sa marque, son pixel et sa politique
 * de livraison. C'est ce qui distingue deux boutiques servies par le même
 * code — chacune a son identité, et son Pixel Meta à elle : un pixel partagé
 * entre plusieurs domaines mélangerait les conversions de toutes les
 * campagnes.
 */
export async function updateStorefront(
  _prev: StorefrontFormState,
  formData: FormData
): Promise<StorefrontFormState> {
  await requireAdmin();

  const product = await getProductById(String(formData.get("product_id") || ""));
  if (!product) return { error: "Produit introuvable." };

  const store_name = String(formData.get("store_name") || "").trim();
  const primary_color = String(formData.get("primary_color") || "").trim();
  const slug = normalizeSlug(String(formData.get("slug") || ""));
  const domainRaw = String(formData.get("domain") || "").trim();
  const domain = domainRaw ? normalizeDomain(domainRaw) : null;
  const active = formData.get("active") === "1";
  const pixelRaw = String(formData.get("pixel_id") || "").trim();
  const pixel_id = pixelRaw || null;
  const fbDomainRaw = String(formData.get("fb_domain_verification") || "").trim();
  const fb_domain_verification = fbDomainRaw || null;
  const free_delivery_mode = String(
    formData.get("free_delivery_mode") || "none"
  ) as FreeDeliveryMode;

  if (!store_name) return { error: "Le nom de la boutique est requis." };
  if (!isValidSlug(slug))
    return { error: "Identifiant invalide (lettres, chiffres et tirets)." };
  if (domain && !isValidDomain(domain))
    return { error: "Domaine invalide (ex : ma-boutique.dz)." };
  if (!COLOR_RE.test(primary_color))
    return { error: "Couleur invalide (format #rrggbb)." };
  if (!FREE_DELIVERY_MODES.includes(free_delivery_mode))
    return { error: "Mode de livraison offerte invalide." };
  if (pixel_id && !/^\d{10,20}$/.test(pixel_id))
    return { error: "Pixel ID invalide (uniquement des chiffres, ex: 123456789012345)." };
  if (fb_domain_verification && !/^[a-z0-9]{10,100}$/i.test(fb_domain_verification))
    return { error: "Code de vérification de domaine invalide." };

  let logo_url = product.logo_url;
  const removeLogo = formData.get("remove_logo") === "1";
  if (removeLogo) logo_url = null;

  const logoFile = formData.get("logo");
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      logo_url = await uploadImage(logoFile, "logo");
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Upload du logo échoué." };
    }
  }

  const { error } = await supabase()
    .from("product")
    .update({
      store_name,
      slug,
      domain,
      active,
      primary_color,
      pixel_id,
      fb_domain_verification,
      free_delivery_mode,
      logo_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        error: error.message.includes("domain")
          ? "Ce domaine est déjà utilisé par une autre boutique."
          : "Cet identifiant est déjà utilisé par une autre boutique.",
      };
    }
    return { error: error.message };
  }

  // L'ancien logo est supprimé du storage s'il a été retiré ou remplacé
  if (product.logo_url && product.logo_url !== logo_url) {
    await deleteImages([product.logo_url]);
  }

  revalidateStorefronts();
  revalidatePath(`/admin/produits/${product.id}`, "layout");
  return { success: true };
}
