export type OrderStatus = "en_attente" | "confirmee" | "annulee";

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "en_attente", label: "En attente" },
  { value: "confirmee", label: "Confirmée" },
  { value: "annulee", label: "Annulée" },
];

export type ProductColor = { name: string; hex: string };

export const BASE_PACK_ID = "base-product";

/**
 * Mise en avant d'un pack sur la landing :
 * - "none"   : carte simple
 * - "badge"  : ruban statique aux couleurs de la boutique
 * - "border" : ruban + bordure animée (l'offre à pousser)
 */
export type PackHighlight = "none" | "badge" | "border";

export const PACK_HIGHLIGHTS: PackHighlight[] = ["none", "badge", "border"];

/**
 * Offre groupée : « 2 pièces à 4 000 DA ». Le pack porte sa propre photo et son
 * prix total — jamais unitaire — et remplace le sélecteur de quantité : c'est
 * `quantity` qui fait le nombre de pièces commandées.
 */
export type ProductPack = {
  /** Clé stable côté React et lors de la validation de la commande. */
  id: string;
  label: string;
  /** Nombre de pièces, 1 à 20. */
  quantity: number;
  /** Prix total du lot, pas le prix d'une pièce. */
  price: number;
  old_price: number | null;
  /** Texte du ruban ("الأكثر طلبا"), affiché selon `highlight`. */
  badge: string | null;
  highlight: PackHighlight;
};

/**
 * Variante d'une pièce. Un pack de 2 pièces produit 2 entrées : le client
 * choisit couleur et taille pièce par pièce.
 */
export type OrderItem = { color: string | null; size: string | null };

/**
 * Portée de la livraison offerte :
 * - "none"     : le client paie les frais Yalidine
 * - "stopdesk" : le bureau est offert, le domicile reste payant
 * - "all"      : tout est offert, la commande part toujours à domicile
 */
export type FreeDeliveryMode = "none" | "all" | "stopdesk";

export const FREE_DELIVERY_MODES: FreeDeliveryMode[] = ["none", "all", "stopdesk"];

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  old_price: number | null;
  delivery_home: number;
  delivery_desk: number;
  images: string[];
  features: string[];
  colors: ProductColor[];
  sizes: string[];
  /** Offres groupées. Vide = vente à la pièce avec sélecteur de quantité. */
  packs: ProductPack[];
  updated_at: string;
};

export type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  phone: string;
  wilaya: string;
  commune: string;
  address: string | null;
  delivery_type: "domicile" | "stopdesk";
  stopdesk_id: number | null;
  stopdesk_name: string | null;
  /** Pack retenu, figé à la commande. Null = commande sans pack. */
  pack_label: string | null;
  /** Variante de chaque pièce — source de vérité. */
  items: OrderItem[];
  /** Résumé lisible des valeurs distinctes de `items` ("Noir, Blanc"). */
  color: string | null;
  size: string | null;
  quantity: number;
  total: number;
  status: OrderStatus;
  yalidine_tracking: string | null;
  yalidine_status: string | null;
  yalidine_label: string | null;
  notes: string | null;
};

/** Mise en page de la landing : fixe ("simple") ou composée de blocs ("custom"). */
export type LandingMode = "simple" | "custom";

export const LANDING_MODES: LandingMode[] = ["simple", "custom"];

/** Thème du mode custom. Le mode simple reste clair. */
export type LandingTheme = "light" | "dark";

export const LANDING_THEMES: LandingTheme[] = ["light", "dark"];

/**
 * Bloc de la landing en mode custom. Les blocs "hero", "gallery",
 * "description" et "form" reprennent les données du produit ; "image" et
 * "text" portent leur propre contenu.
 */
export type LandingBlock =
  | { id: string; type: "hero" }
  | { id: string; type: "gallery" }
  | { id: string; type: "description" }
  | { id: string; type: "form" }
  | {
      id: string;
      type: "image";
      url: string;
      /** Dimensions réelles : `next/image` en a besoin pour réserver la place. */
      width: number;
      height: number;
    }
  | { id: string; type: "text"; title: string; body: string };

export type LandingBlockType = LandingBlock["type"];

export const LANDING_BLOCK_TYPES: LandingBlockType[] = [
  "hero",
  "gallery",
  "description",
  "form",
  "image",
  "text",
];

export type Settings = {
  id: string;
  store_name: string;
  logo_url: string | null;
  primary_color: string;
  from_wilaya: string;
  pixel_id: string | null;
  fb_domain_verification: string | null;
  /** Livraison offerte au client : la boutique absorbe les frais Yalidine. */
  free_delivery_mode: FreeDeliveryMode;
  landing_mode: LandingMode;
  /** Blocs du mode custom, dans l'ordre d'affichage. Ignorés en mode simple. */
  landing_blocks: LandingBlock[];
  /** Options d'affichage du mode custom, sans effet en mode simple. */
  landing_theme: LandingTheme;
  /** Bouton « Commander » flottant, visible sur toute la page. */
  landing_sticky_cta: boolean;
  /** En-tête collé en haut pendant le défilement. */
  landing_sticky_header: boolean;
  updated_at: string;
};
