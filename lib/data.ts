import "server-only";
import { cache } from "react";
import { supabase } from "./supabase";
import { normalizeDomain } from "./domain";
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
  from_wilaya: "16 - Alger",
  default_product_id: null,
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

/**
 * Remet une ligne `product` dans la forme sur laquelle le rendu peut compter.
 * Chaque énumération repasse par son garde-fou : une colonne absente (une
 * migration pas encore jouée) ou une valeur inconnue ne doit pas faire tomber
 * la landing, ni lui faire annoncer une livraison offerte qui serait quand
 * même facturée dans le total.
 */
function toProduct(data: Record<string, unknown>): Product {
  const price = Number(data.price);
  const packs = normalizePacks(data.packs);
  return {
    ...(data as unknown as Product),
    free_delivery_mode: FREE_DELIVERY_MODES.includes(
      data.free_delivery_mode as Product["free_delivery_mode"]
    )
      ? (data.free_delivery_mode as Product["free_delivery_mode"])
      : "none",
    landing_mode: LANDING_MODES.includes(data.landing_mode as Product["landing_mode"])
      ? (data.landing_mode as Product["landing_mode"])
      : "simple",
    landing_theme: LANDING_THEMES.includes(
      data.landing_theme as Product["landing_theme"]
    )
      ? (data.landing_theme as Product["landing_theme"])
      : "light",
    landing_blocks: normalizeLandingBlocks(data.landing_blocks),
    landing_sticky_cta: data.landing_sticky_cta !== false,
    landing_sticky_header: data.landing_sticky_header !== false,
    // Le pack « 1 pièce » est reconstruit depuis le prix du produit : il n'est
    // pas stocké, pour qu'un changement de prix n'oublie jamais l'offre unitaire.
    packs:
      packs.length > 0
        ? [
            {
              id: BASE_PACK_ID,
              label: "1 pièce",
              quantity: 1,
              price,
              old_price: Number(data.old_price) || null,
              badge: null,
              highlight: "none",
            },
            ...packs
              .filter((pack) => pack.id !== BASE_PACK_ID && pack.quantity !== 1)
              .map((pack) => ({ ...pack, old_price: pack.quantity * price })),
          ]
        : [],
  };
}

/**
 * Une clé d'hôte sûre à interpoler dans un filtre PostgREST. L'en-tête `Host`
 * vient du client : sans ce filtre, une virgule suffirait à greffer une
 * condition supplémentaire dans le `or(...)` ci-dessous.
 */
function safeKey(key: string): string | null {
  const clean = normalizeDomain(key);
  return /^[a-z0-9.-]{1,253}$/.test(clean) ? clean : null;
}

/**
 * La boutique servie pour un hôte : le produit dont c'est le domaine, sinon
 * celui dont c'est le slug (aperçu `/p/<slug>` avant de brancher le DNS).
 */
const findStorefront = cache(async (key: string): Promise<Product | null> => {
  const clean = safeKey(key);
  if (!clean) return null;
  const { data, error } = await supabase()
    .from("product")
    .select("*")
    .or(`domain.eq.${clean},slug.eq.${clean}`)
    .eq("active", true)
    // Un domaine l'emporte sur un slug homonyme : les lignes sans domaine
    // passent en dernier.
    .order("domain", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erreur produit: ${error.message}`);
  return data ? toProduct(data) : null;
});

/**
 * Le produit servi sur un hôte qui ne correspond à aucun domaine — le domaine
 * Vercel du projet, typiquement. Null = 404 sur ces hôtes.
 */
const getDefaultProduct = cache(async (): Promise<Product | null> => {
  const settings = await getSettings();
  if (!settings.default_product_id) return null;
  const { data, error } = await supabase()
    .from("product")
    .select("*")
    .eq("id", settings.default_product_id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`Erreur produit: ${error.message}`);
  return data ? toProduct(data) : null;
});

/**
 * La boutique à servir pour la clé d'URL (l'hôte réécrit par `proxy.ts`).
 * `cache` de React ne mémorise que le temps d'un rendu : la page l'appelle
 * depuis `generateMetadata` puis depuis le corps sans faire deux requêtes.
 */
export const getStorefront = cache(async (key: string): Promise<Product | null> => {
  return (await findStorefront(key)) ?? (await getDefaultProduct());
});

/** Un produit par son id : l'admin et la validation de commande passent par là. */
export const getProductById = cache(async (id: string): Promise<Product | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase()
    .from("product")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Erreur produit: ${error.message}`);
  return data ? toProduct(data) : null;
});

/** Tous les produits, du plus ancien au plus récent (liste de l'admin). */
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase()
    .from("product")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Erreur produits: ${error.message}`);
  return (data ?? []).map(toProduct);
}

/**
 * Les clés sous lesquelles une boutique est servie : son domaine et son slug.
 * Alimente `generateStaticParams` — sans au moins un paramètre connu, Next
 * traite `params` comme une API de requête et la landing tombe en rendu
 * dynamique à chaque visite, sans cache CDN.
 */
export async function getStorefrontKeys(): Promise<string[]> {
  try {
    const { data, error } = await supabase()
      .from("product")
      .select("slug,domain")
      .eq("active", true);
    if (error) throw error;
    return (data ?? []).flatMap((row) => {
      const { slug, domain } = row as { slug: string; domain: string | null };
      return domain ? [domain, slug] : [slug];
    });
  } catch {
    // Base injoignable pendant le build : le site reste servi, simplement
    // rendu à la demande jusqu'au prochain déploiement.
    return [];
  }
}

/** Nombre de commandes par produit, pour la liste de l'admin. */
export async function getOrderCountsByProduct(): Promise<Map<string, number>> {
  const { data, error } = await supabase().from("orders").select("product_id");
  if (error) throw new Error(`Erreur commandes: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { product_id: string | null }).product_id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Les réglages de la plateforme, relus à chaque requête — même mémoïsation
 * par rendu que les produits.
 *
 * Un cache mémoire de 60 secondes vivait ici. Il ne pouvait pas tenir en
 * production : chaque instance serverless garde le sien et l'enregistrement
 * n'en vidait qu'une seule. La landing pouvait donc être régénérée avec des
 * réglages périmés par une autre instance, puis rester figée ainsi le temps de
 * son ISR — et le formulaire d'admin, relu depuis une instance en retard,
 * réécrivait ces réglages périmés au prochain enregistrement.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const { data, error } = await supabase()
    .from("settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erreur settings: ${error.message}`);
  return data
    ? (data as Settings)
    : { id: "", updated_at: "", ...DEFAULT_SETTINGS };
});

export type OrderFilters = {
  productId?: string;
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

  if (filters.productId) query = query.eq("product_id", filters.productId);
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
