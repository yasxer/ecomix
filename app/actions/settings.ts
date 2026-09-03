"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { deleteImages, uploadImage } from "@/lib/storage";
import { getSettings } from "@/lib/data";
import { WILAYAS } from "@/lib/wilayas";
import { requireAdmin } from "./auth";

export type SettingsFormState = { success?: boolean; error?: string };

/**
 * Réglages de la plateforme : ce qui ne dépend d'aucune boutique. Le nom et le
 * logo servis aux clients, eux, appartiennent au produit — voir
 * `app/actions/storefront.ts`.
 */
export async function updateSettings(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireAdmin();

  const settings = await getSettings();
  if (!settings.id) return { error: "Settings introuvables (exécutez le schema.sql)." };

  const store_name = String(formData.get("store_name") || "").trim();
  const from_wilaya = String(formData.get("from_wilaya") || "");

  if (!store_name) return { error: "Le nom est requis." };
  if (!WILAYAS.includes(from_wilaya))
    return { error: "Wilaya d'expédition invalide." };

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
      from_wilaya,
      logo_url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id);
  if (error) return { error: error.message };

  // L'ancien logo est supprimé du storage s'il a été retiré ou remplacé
  if (settings.logo_url && settings.logo_url !== logo_url) {
    await deleteImages([settings.logo_url]);
  }

  revalidatePath("/admin", "layout");
  return { success: true };
}
