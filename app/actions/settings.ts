"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { deleteImages, uploadImage } from "@/lib/storage";
import { getSettings } from "@/lib/data";
import { WILAYAS } from "@/lib/wilayas";
import { FREE_DELIVERY_MODES, type FreeDeliveryMode } from "@/lib/types";
import { requireAdmin } from "./auth";

export type SettingsFormState = { success?: boolean; error?: string };

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function updateSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireAdmin();

  const settings = await getSettings();
  if (!settings.id) return { error: "Settings introuvables (exécutez le schema.sql)." };

  const store_name = String(formData.get("store_name") || "").trim();
  const primary_color = String(formData.get("primary_color") || "").trim();
  const from_wilaya = String(formData.get("from_wilaya") || "");
  const pixelRaw = String(formData.get("pixel_id") || "").trim();
  const pixel_id = pixelRaw || null;
  const fbDomainRaw = String(formData.get("fb_domain_verification") || "").trim();
  const fb_domain_verification = fbDomainRaw || null;
  const free_delivery_mode = String(
    formData.get("free_delivery_mode") || "none"
  ) as FreeDeliveryMode;

  if (!store_name) return { error: "Le nom de la boutique est requis." };
  if (!COLOR_RE.test(primary_color))
    return { error: "Couleur invalide (format #rrggbb)." };
  if (!WILAYAS.includes(from_wilaya))
    return { error: "Wilaya d'expédition invalide." };
  if (!FREE_DELIVERY_MODES.includes(free_delivery_mode))
    return { error: "Mode de livraison offerte invalide." };
  if (pixel_id && !/^\d{10,20}$/.test(pixel_id))
    return { error: "Pixel ID invalide (uniquement des chiffres, ex: 123456789012345)." };
  if (fb_domain_verification && !/^[a-z0-9]{10,100}$/i.test(fb_domain_verification))
    return { error: "Code de vérification de domaine invalide." };

  let logo_url = settings.logo_url;
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
    .from("settings")
    .update({
      store_name,
      primary_color,
      from_wilaya,
      pixel_id,
      fb_domain_verification,
      free_delivery_mode,
      logo_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id);
  if (error) return { error: error.message };

  // L'ancien logo est supprimé du storage s'il a été retiré ou remplacé
  if (settings.logo_url && settings.logo_url !== logo_url) {
    await deleteImages([settings.logo_url]);
  }

  revalidatePath("/");
  revalidatePath("/admin", "layout");
  return { success: true };
}
