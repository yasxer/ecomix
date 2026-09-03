"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getProductById, getSettings, normalizeItems } from "@/lib/data";
import { createParcel, deleteParcel, getDeliveryInfo } from "@/lib/yalidine";
import { notifyNewOrder } from "@/lib/telegram";
import { WILAYAS } from "@/lib/wilayas";
import { summarize } from "@/lib/variants";
import type { Order, OrderItem, Product } from "@/lib/types";
import { requireAdmin } from "./auth";

export type OrderFormState = {
  success?: boolean;
  error?: string;
};

const PHONE_RE = /^(0)(5|6|7)[0-9]{8}$/;

/**
 * Variante de chaque pièce, validée contre le catalogue. Le formulaire envoie
 * une entrée par pièce ; on exige donc exactement `quantity` entrées, chacune
 * portant une couleur et une taille connues dès que le produit en définit.
 */
function parseItems(
  raw: unknown,
  quantity: number,
  product: Product
): { items: OrderItem[] } | { error: string } {
  let parsed: OrderItem[];
  try {
    parsed = normalizeItems(JSON.parse(String(raw || "[]")));
  } catch {
    return { error: "الرجاء اختيار اللون و المقاس." };
  }
  if (parsed.length !== quantity) {
    // Sans couleurs ni tailles au catalogue, il n'y a rien à choisir : on
    // complète plutôt que de rejeter une commande parfaitement valide.
    if (product.colors.length === 0 && product.sizes.length === 0) {
      return {
        items: Array.from({ length: quantity }, () => ({ color: null, size: null })),
      };
    }
    return { error: "الرجاء اختيار اللون و المقاس لكل قطعة." };
  }
  for (const item of parsed) {
    if (
      product.colors.length > 0 &&
      !product.colors.some((c) => c.name === item.color)
    ) {
      return { error: "الرجاء اختيار لون." };
    }
    if (product.sizes.length > 0 && !product.sizes.includes(item.size ?? "")) {
      return { error: "الرجاء اختيار مقاس." };
    }
  }
  return { items: parsed };
}

export async function createOrder(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  // Champ invisible anti-bot
  if (formData.get("website")) return { success: true };

  const customer_name = String(formData.get("customer_name") || "").trim();
  const phone = String(formData.get("phone") || "").replace(/[\s.-]/g, "");
  const wilaya = String(formData.get("wilaya") || "");
  const address = String(formData.get("address") || "").trim();
  const stopdeskId = Number(formData.get("stopdesk_id")) || null;
  const requestedQuantity = Math.min(
    Math.max(Number(formData.get("quantity")) || 1, 1),
    20
  );

  // Contrôles sans accès base d'abord : inutile d'interroger Supabase pour
  // une soumission manifestement invalide
  if (customer_name.length < 3) return { error: "الرجاء إدخال اسمكم الكامل." };
  if (!PHONE_RE.test(phone))
    return { error: "رقم الهاتف غير صحيح (مثال: 0550123456)." };
  if (!WILAYAS.includes(wilaya)) return { error: "الرجاء اختيار ولايتكم." };

  // La boutique commandée arrive du formulaire, mais tout le reste est relu
  // en base : le navigateur ne décide ni du prix, ni de la quantité, ni des
  // frais de livraison.
  const [product, settings] = await Promise.all([
    getProductById(String(formData.get("product_id") || "")),
    getSettings(),
  ]);
  if (!product || !product.active) return { error: "المنتج غير متوفر حاليا." };

  // En mode "tout offert" le formulaire n'affiche plus le choix : on impose le
  // domicile côté serveur pour qu'une requête forgée ne puisse pas passer en
  // Stopdesk.
  const requestedType =
    formData.get("delivery_type") === "stopdesk" ? "stopdesk" : "domicile";
  const delivery_type =
    product.free_delivery_mode === "all" ? "domicile" : requestedType;

  if (delivery_type === "domicile" && address.length < 5)
    return { error: "الرجاء إدخال عنوان التوصيل." };

  // Offre groupée : le pack fixe la quantité et le prix. Les deux sont relus
  // depuis la base d'après le seul identifiant envoyé — le client ne décide ni
  // du nombre de pièces ni du montant.
  const packId = String(formData.get("pack_id") || "");
  const pack = product.packs.find((p) => p.id === packId) ?? null;
  if (product.packs.length > 0 && !pack) return { error: "الرجاء اختيار عرض." };

  const quantity = pack ? pack.quantity : requestedQuantity;
  const subtotal = pack ? pack.price : product.price * quantity;

  // Variantes : une par pièce, obligatoires si le produit en définit
  const parsedItems = parseItems(formData.get("items"), quantity, product);
  if ("error" in parsedItems) return { error: parsedItems.error };
  const items = parsedItems.items;
  const color = summarize(items, "color");
  const size = summarize(items, "size");

  // Tarifs et bureaux recalculés côté serveur depuis Yalidine
  // (jamais confiés au client, aucun tarif manuel)
  const info = await getDeliveryInfo(wilaya, settings.from_wilaya);
  if (info.homeFee === null) {
    return {
      error:
        "أسعار التوصيل غير متوفرة حاليا. الرجاء إعادة المحاولة بعد قليل.",
    };
  }

  let delivery: number;
  let stopdesk_name: string | null = null;
  let stopdesk_id: number | null = null;
  // Pas de champ "commune" séparé : on réutilise l'adresse saisie par le client
  // (Yalidine a besoin d'un nom de commune pour créer le colis à domicile)
  let finalCommune = address;

  if (delivery_type === "stopdesk") {
    const center = info.centers.find((c) => c.id === stopdeskId);
    if (!center) return { error: "الرجاء اختيار مكتب التوصيل." };
    stopdesk_id = center.id;
    stopdesk_name = center.name;
    finalCommune = center.commune;
    delivery = center.fee ?? info.deskFee ?? info.homeFee;
  } else {
    delivery = info.homeFee;
  }

  // Livraison offerte : le client ne paie que le produit. Yalidine facture
  // quand même ses frais, déduits du versement à la boutique.
  const isFree =
    product.free_delivery_mode === "all" ||
    (product.free_delivery_mode === "stopdesk" && delivery_type === "stopdesk");
  const total = subtotal + (isFree ? 0 : delivery);

  const { error } = await supabase().from("orders").insert({
    product_id: product.id,
    // Nom figé : renommer ou supprimer le produit ne réécrit pas l'historique
    product_name: product.name,
    customer_name,
    phone,
    wilaya,
    commune: finalCommune,
    address: address || null,
    delivery_type,
    stopdesk_id,
    stopdesk_name,
    pack_label: pack?.label ?? null,
    items,
    color,
    size,
    quantity,
    total,
  });
  if (error) return { error: "Une erreur est survenue, veuillez réessayer." };

  await notifyNewOrder({
    customer_name,
    phone,
    wilaya,
    commune: finalCommune,
    address: address || null,
    delivery_type,
    stopdesk_name,
    packLabel: pack?.label ?? null,
    items,
    color,
    size,
    quantity,
    total,
    productName: product.name,
  });

  return { success: true };
}

export type OrderActionState = { error?: string };

async function getOrder(orderId: string): Promise<Order | null> {
  const { data } = await supabase()
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (!data) return null;
  // Même garde-fou que `getOrders` : `items` est absent des lignes créées avant
  // la migration 012, et `createParcel` itère dessus.
  return { ...(data as Order), items: normalizeItems(data.items) };
}

/**
 * Confirmer = créer le colis chez Yalidine.
 * La commande passe en "confirmee" et son suivi se fait via le statut Yalidine.
 */
export async function confirmOrder(orderId: string): Promise<OrderActionState> {
  await requireAdmin();

  const order = await getOrder(orderId);
  if (!order) return { error: "Commande introuvable." };
  if (order.status === "confirmee") return { error: "Commande déjà confirmée." };

  const settings = await getSettings();
  // Le nom figé à la commande fait foi : le produit a pu être renommé, voire
  // supprimé, depuis que le client a commandé.
  const productName =
    order.product_name ??
    (order.product_id ? (await getProductById(order.product_id))?.name : null);
  if (!productName) return { error: "Produit introuvable." };

  let result;
  try {
    result = await createParcel(order, productName, settings);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur Yalidine." };
  }
  if (!result.ok) return { error: result.error };

  await supabase()
    .from("orders")
    .update({
      status: "confirmee",
      yalidine_tracking: result.parcel.tracking,
      yalidine_label: result.parcel.label,
      yalidine_status: "En préparation",
    })
    .eq("id", orderId);

  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
  return {};
}

/**
 * Annuler la commande. Si un colis Yalidine existe déjà, on tente de le
 * supprimer chez Yalidine (possible tant qu'il n'est pas ramassé).
 */
export async function cancelOrder(orderId: string): Promise<OrderActionState> {
  await requireAdmin();

  const order = await getOrder(orderId);
  if (!order) return { error: "Commande introuvable." };

  if (order.yalidine_tracking) {
    const result = await deleteParcel(order.yalidine_tracking);
    if (!result.ok) {
      return {
        error: `${result.error} Annulez le colis depuis votre compte Yalidine d'abord.`,
      };
    }
  }

  await supabase()
    .from("orders")
    .update({
      status: "annulee",
      yalidine_tracking: null,
      yalidine_label: null,
      yalidine_status: null,
    })
    .eq("id", orderId);

  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
  return {};
}

/**
 * Supprime définitivement la commande de la base (action irréversible).
 * Si un colis Yalidine existe encore, il est supprimé chez Yalidine d'abord :
 * sans cela on laisserait un colis en circulation sans aucune trace côté
 * boutique. Si Yalidine refuse (colis déjà ramassé), rien n'est supprimé.
 */
export async function deleteOrder(orderId: string): Promise<OrderActionState> {
  await requireAdmin();

  const order = await getOrder(orderId);
  if (!order) return { error: "Commande introuvable." };

  if (order.yalidine_tracking) {
    const result = await deleteParcel(order.yalidine_tracking);
    if (!result.ok) {
      return {
        error: `${result.error} Annulez le colis depuis votre compte Yalidine d'abord.`,
      };
    }
  }

  const { error } = await supabase().from("orders").delete().eq("id", orderId);
  if (error) return { error: "Suppression impossible, veuillez réessayer." };

  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
  return {};
}

/** Remettre une commande annulée en attente. */
export async function reopenOrder(orderId: string): Promise<OrderActionState> {
  await requireAdmin();

  const order = await getOrder(orderId);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "annulee") return { error: "Commande non annulée." };

  await supabase()
    .from("orders")
    .update({ status: "en_attente" })
    .eq("id", orderId);

  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
  return {};
}
