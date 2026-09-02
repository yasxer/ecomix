import "server-only";
import { supabase } from "./supabase";
import {
  FREE_DELIVERY_MODES,
  BASE_PACK_ID,
  LANDING_MODES,
  LANDING_THEMES,
  PACK_HIGHLIGHTS,
  type LandingBlock,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Product,
  type ProductPack,
  type Settings,
} from "./types";

export const DEFAULT_SETTINGS: Omit<Settings, "id" | "updated_at"> = {
  store_name: "Ma Boutique",
  logo_url: null,
  primary_color: "#4f46e5",
  from_wilaya: "16 - Alger",
  pixel_id: null,
  fb_domain_verification: null,
  free_delivery_mode: "none",
  landing_mode: "simple",
  landing_blocks: [],
  landing_theme: "light",
  landing_sticky_cta: true,
  landing_sticky_header: true,
};

/**
 * Remet un `landing_blocks` venu de la base dans une forme sûre pour le rendu.
 * Même logique que `normalizePacks` : colonne absente tant que la migration
 * 014 n'a pas été jouée, et une entrée incomplète est écartée plutôt que de
 * faire tomber toute la landing.
 */
export function normalizeLandingBlocks(raw: unknown): LandingBlock[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.flatMap((b): LandingBlock[] => {
    const id = typeof b?.id === "string" ? b.id : "";
    if (!id || seen.has(id)) return [];
    switch (b?.type) {
      case "hero":
      case "gallery":
      case "description":
      case "form":
        seen.add(id);
        return [{ id, type: b.type }];
      case "image": {
        const width = Number(b.width);
        const height = Number(b.height);
        if (typeof b.url !== "string" || !b.url) return [];
        if (!Number.isFinite(width) || width < 1) return [];
        if (!Number.isFinite(height) || height < 1) return [];
        seen.add(id);
        return [
          { id, type: "image", url: b.url, width: Math.round(width), height: Math.round(height) },
        ];
      }
      case "text": {
        const title = typeof b.title === "string" ? b.title : "";
        const body = typeof b.body === "string" ? b.body : "";
        if (!title && !body) return [];
        seen.add(id);
        return [{ id, type: "text", title, body }];
      }
      default:
        return [];
    }
  });
}

/**
 * Remet un `packs` venu de la base dans une forme sur laquelle le rendu peut
 * compter. Tant que la migration 012 n'a pas été jouée la colonne est absente
 * de `select *`, donc `product.packs` vaut `undefined` : sans ce garde-fou la
 * landing planterait sur le premier `.length`. Une entrée incomplète est
 * écartée plutôt que de faire tomber toute la liste.
 */
function normalizePacks(raw: unknown): ProductPack[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p): ProductPack[] => {
    if (typeof p?.id !== "string" || typeof p?.label !== "string") return [];
    const quantity = Number(p.quantity);
    const price = Number(p.price);
    if (!Number.isFinite(quantity) || quantity < 1) return [];
    if (!Number.isFinite(price) || price < 0) return [];
    const oldPrice = Number(p.old_price);
    return [
      {
        id: p.id,
        label: p.label,
        quantity: Math.min(Math.round(quantity), 20),
        price,
        old_price: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : null,
        badge: typeof p.badge === "string" && p.badge ? p.badge : null,
        highlight: PACK_HIGHLIGHTS.includes(p.highlight) ? p.highlight : "none",
      },
    ];
  });
}

/** Même garde-fou que `normalizePacks`, pour les variantes pièce par pièce. */
export function normalizeItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    color: typeof item?.color === "string" && item.color ? item.color : null,
    size: typeof item?.size === "string" && item.size ? item.size : null,
  }));
}

export async function getProduct(): Promise<Product | null> {
  const { data, error } = await supabase()
    .from("product")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erreur produit: ${error.message}`);
  if (!data) return null;
  const packs = normalizePacks(data.packs);
  return {
    ...(data as Product),
    packs:
      packs.length > 0
        ? [
            {
              id: BASE_PACK_ID,
              label: "1 pièce",
              quantity: 1,
              price: Number(data.price),
              old_price: Number(data.price),
              badge: null,
              highlight: "none",
            },
            ...packs
              .filter((pack) => pack.id !== BASE_PACK_ID && pack.quantity !== 1)
              .map((pack) => ({
                ...pack,
                old_price: pack.quantity * Number(data.price),
              })),
          ]
        : [],
  };
}

// Cache mémoire court : évite un aller-retour Supabase à chaque requête
// (notamment /api/delivery appelé à chaque changement de wilaya)
let settingsCache: { expires: number; data: Settings } | null = null;

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

export async function getSettings(): Promise<Settings> {
  if (settingsCache && settingsCache.expires > Date.now()) {
    return settingsCache.data;
  }
  const { data, error } = await supabase()
    .from("settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erreur settings: ${error.message}`);
  const raw = data
    ? (data as Settings)
    : { id: "", updated_at: "", ...DEFAULT_SETTINGS };
  // Le mode est retombé sur "none" si la valeur est inconnue — notamment tant
  // que la migration 009 n'a pas été jouée, où la colonne est absente. Sans ce
  // garde-fou la landing annoncerait une livraison offerte qui serait quand
  // même facturée dans le total.
  const settings: Settings = {
    ...raw,
    free_delivery_mode: FREE_DELIVERY_MODES.includes(raw.free_delivery_mode)
      ? raw.free_delivery_mode
      : "none",
    landing_mode: LANDING_MODES.includes(raw.landing_mode) ? raw.landing_mode : "simple",
    landing_blocks: normalizeLandingBlocks(raw.landing_blocks),
    landing_theme: LANDING_THEMES.includes(raw.landing_theme) ? raw.landing_theme : "light",
    // Colonnes absentes tant que la migration 014 n'est pas jouée : on garde
    // le comportement d'avant (en-tête fixé, bouton flottant).
    landing_sticky_cta: raw.landing_sticky_cta !== false,
    landing_sticky_header: raw.landing_sticky_header !== false,
  };
  settingsCache = { expires: Date.now() + 60_000, data: settings };
  return settings;
}

export type OrderFilters = {
  status?: OrderStatus;
  wilaya?: string;
  search?: string;
  from?: string;
  to?: string;
};

export async function getOrders(filters: OrderFilters = {}): Promise<Order[]> {
  let query = supabase()
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.wilaya) query = query.eq("wilaya", filters.wilaya);
  if (filters.search) {
    const s = filters.search.replace(/[%,]/g, "");
    query = query.or(`phone.ilike.%${s}%,customer_name.ilike.%${s}%`);
  }
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new Error(`Erreur commandes: ${error.message}`);
  return (data ?? []).map((o) => ({
    ...(o as Order),
    items: normalizeItems(o.items),
  }));
}

export async function getAllOrdersForStats(): Promise<
  Pick<Order, "created_at" | "status" | "total" | "yalidine_status">[]
> {
  const { data, error } = await supabase()
    .from("orders")
    .select("created_at,status,total,yalidine_status");
  if (error) throw new Error(`Erreur stats: ${error.message}`);
  return (data ?? []) as Pick<
    Order,
    "created_at" | "status" | "total" | "yalidine_status"
  >[];
}

/**
 * Synchronise le statut Yalidine des commandes confirmées (une seule requête
 * API groupée), met à jour la base si un statut a changé, et retourne les
 * commandes avec leur statut à jour. Silencieux si Yalidine est injoignable.
 */
export async function syncYalidineStatuses(orders: Order[]): Promise<Order[]> {
  const tracked = orders.filter(
    (o) => o.status === "confirmee" && o.yalidine_tracking
  );
  if (tracked.length === 0) return orders;

  const { getParcelStatuses } = await import("./yalidine");
  const statuses = await getParcelStatuses(
    tracked.map((o) => o.yalidine_tracking as string)
  );
  if (statuses.size === 0) return orders;

  const updates: { id: string; yalidine_status: string }[] = [];
  const result = orders.map((o) => {
    const fresh = o.yalidine_tracking ? statuses.get(o.yalidine_tracking) : undefined;
    if (fresh && fresh !== o.yalidine_status) {
      updates.push({ id: o.id, yalidine_status: fresh });
      return { ...o, yalidine_status: fresh };
    }
    return o;
  });

  await Promise.all(
    updates.map((u) =>
      supabase()
        .from("orders")
        .update({ yalidine_status: u.yalidine_status })
        .eq("id", u.id)
    )
  );

  return result;
}
