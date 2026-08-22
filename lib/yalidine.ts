import "server-only";
import type { Order, Settings } from "./types";
import { formatVariants } from "./variants";
import { wilayaId, wilayaName } from "./wilayas";

const BASE_URL = "https://api.yalidine.app/v1";

export function yalidineConfigured(): boolean {
  return Boolean(process.env.YALIDINE_API_ID && process.env.YALIDINE_API_TOKEN);
}

function headers(): HeadersInit {
  const id = process.env.YALIDINE_API_ID;
  const token = process.env.YALIDINE_API_TOKEN;
  if (!id || !token) {
    throw new Error(
      "Clés Yalidine manquantes (YALIDINE_API_ID / YALIDINE_API_TOKEN dans .env.local)."
    );
  }
  return {
    "X-API-ID": id,
    "X-API-TOKEN": token,
    "Content-Type": "application/json",
  };
}

export type YalidineParcel = { tracking: string; label: string | null };

export type YalidineResult =
  | { ok: true; parcel: YalidineParcel }
  | { ok: false; error: string };

/**
 * Crée un colis Yalidine à partir d'une commande.
 * Docs: https://yalidine.app/app/dev/docs/api/index.php
 */
export async function createParcel(
  order: Order,
  productName: string,
  settings: Settings
): Promise<YalidineResult> {
  const nameParts = order.customer_name.trim().split(/\s+/);
  const firstname = nameParts[0] || order.customer_name;
  const familyname = nameParts.slice(1).join(" ") || firstname;

  const parcel = {
    order_id: order.id,
    from_wilaya_name: wilayaName(settings.from_wilaya),
    firstname,
    familyname,
    contact_phone: order.phone,
    address: order.address || order.commune,
    to_commune_name: order.commune,
    to_wilaya_name: wilayaName(order.wilaya),
    product_list: [
      productName,
      order.pack_label,
      formatVariants(order),
      `x${order.quantity}`,
    ]
      .filter(Boolean)
      .join(" - "),
    price: Math.round(order.total),
    do_insurance: false,
    declared_value: Math.round(order.total),
    freeshipping: true,
    is_stopdesk: order.delivery_type === "stopdesk",
    stopdesk_id:
      order.delivery_type === "stopdesk" ? order.stopdesk_id ?? undefined : undefined,
    has_exchange: false,
  };

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/parcels`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify([parcel]),
    });
  } catch {
    return { ok: false, error: "Impossible de contacter l'API Yalidine." };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      error: `Erreur Yalidine (${response.status}): ${body.slice(0, 300)}`,
    };
  }

  const data = (await response.json()) as Record<
    string,
    { success: boolean; tracking?: string; label?: string; message?: string }
  >;
  const result = data[order.id];
  if (result?.success && result.tracking) {
    return {
      ok: true,
      parcel: { tracking: result.tracking, label: result.label ?? null },
    };
  }
  return {
    ok: false,
    error: result?.message || "Yalidine a refusé le colis (vérifiez la commune).",
  };
}

/**
 * Récupère le dernier statut Yalidine pour plusieurs trackings en une requête.
 * Retourne une map tracking -> last_status.
 */
export async function getParcelStatuses(
  trackings: string[]
): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  if (trackings.length === 0 || !yalidineConfigured()) return statuses;

  // L'API accepte une liste de trackings séparés par des virgules
  const params = new URLSearchParams({
    tracking: trackings.join(","),
    fields: "tracking,last_status",
  });

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/parcels?${params}`, {
      headers: headers(),
    });
  } catch {
    return statuses;
  }
  if (!response.ok) return statuses;

  const body = (await response.json()) as {
    data?: { tracking: string; last_status: string }[];
  };
  for (const parcel of body.data ?? []) {
    if (parcel.tracking && parcel.last_status) {
      statuses.set(parcel.tracking, parcel.last_status);
    }
  }
  return statuses;
}

// ── Tarifs de livraison + bureaux (stopdesk) par wilaya ─────────────────────

export type StopdeskCenter = {
  id: number;
  name: string;
  commune: string;
  address: string;
  fee: number | null;
};

export type DeliveryInfo = {
  /** Tarif livraison à domicile (le plus courant dans la wilaya), null si indisponible */
  homeFee: number | null;
  /** Tarif stopdesk par défaut, null si indisponible */
  deskFee: number | null;
  centers: StopdeskCenter[];
};

const deliveryCache = new Map<string, { expires: number; data: DeliveryInfo }>();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 heures

/** Valeur la plus fréquente d'une liste de tarifs (les communes d'une wilaya
 *  partagent presque toutes le même tarif). */
function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Tarifs Yalidine (GET /fees) + bureaux stopdesk (GET /centers) pour une
 * wilaya de destination. Mis en cache 6h. Retourne des valeurs nulles/vides
 * si Yalidine est injoignable ou non configuré (le site utilise alors les
 * tarifs manuels du produit).
 */
export async function getDeliveryInfo(
  toWilaya: string,
  fromWilaya: string
): Promise<DeliveryInfo> {
  const empty: DeliveryInfo = { homeFee: null, deskFee: null, centers: [] };
  const toId = wilayaId(toWilaya);
  const fromId = wilayaId(fromWilaya);
  if (!toId || !fromId || !yalidineConfigured()) return empty;

  const cacheKey = `${fromId}->${toId}`;
  const cached = deliveryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const [feesRes, centersRes] = await Promise.all([
      fetch(`${BASE_URL}/fees/?from_wilaya_id=${fromId}&to_wilaya_id=${toId}`, {
        headers: headers(),
      }),
      fetch(`${BASE_URL}/centers/?wilaya_id=${toId}`, { headers: headers() }),
    ]);
    if (!feesRes.ok) return empty;

    const fees = (await feesRes.json()) as {
      per_commune?: Record<
        string,
        {
          commune_id: number;
          commune_name: string;
          express_home: number | null;
          express_desk: number | null;
        }
      >;
    };
    const communes = Object.values(fees.per_commune ?? {});
    const homeFee = mode(
      communes.map((c) => c.express_home).filter((v): v is number => v !== null)
    );
    const deskFee = mode(
      communes.map((c) => c.express_desk).filter((v): v is number => v !== null)
    );
    const deskFeeByCommune = new Map<string, number | null>(
      communes.map((c) => [c.commune_name.toLowerCase(), c.express_desk])
    );

    let centers: StopdeskCenter[] = [];
    if (centersRes.ok) {
      const body = (await centersRes.json()) as {
        data?: {
          center_id: number;
          name: string;
          commune_name: string;
          address: string;
        }[];
      };
      centers = (body.data ?? []).map((c) => ({
        id: c.center_id,
        name: c.name,
        commune: c.commune_name,
        address: c.address,
        fee: deskFeeByCommune.get(c.commune_name.toLowerCase()) ?? deskFee,
      }));
    }

    const data: DeliveryInfo = { homeFee, deskFee, centers };
    deliveryCache.set(cacheKey, { expires: Date.now() + CACHE_TTL, data });
    return data;
  } catch {
    return empty;
  }
}

/** Supprime un colis Yalidine (possible tant qu'il n'est pas ramassé). */
export async function deleteParcel(
  tracking: string
): Promise<{ ok: boolean; error?: string }> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/parcels/${encodeURIComponent(tracking)}`, {
      method: "DELETE",
      headers: headers(),
    });
  } catch {
    return { ok: false, error: "Impossible de contacter l'API Yalidine." };
  }
  if (!response.ok) {
    return { ok: false, error: `Suppression refusée par Yalidine (${response.status}).` };
  }
  return { ok: true };
}
