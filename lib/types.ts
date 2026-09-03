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

/**
 * La vitrine d'un produit : tout ce que voit le client sur son domaine.
 * Ces champs vivaient dans `settings` du temps du produit unique — chaque
 * boutique a désormais sa marque, son pixel et sa mise en page.
 */
export type Storefront = {
  store_name: string;
  logo_url: string | null;
  primary_color: string;
  /** Meta Pixel de CE domaine : un pixel partagé mélangerait les conversions. */
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
};

/** Un produit = une boutique : son domaine, sa vitrine et sa landing page. */
export type Product = Storefront & {
  id: string;
  /** Clé lisible, unique : sert d'aperçu sur `/p/<slug>`. */
  slug: string;
  /** Domaine dédié, normalisé (minuscules, sans « www. »). Null = slug seul. */
  domain: string | null;
  /** Un produit inactif n'est plus servi ni commandable. */
  active: boolean;
  /** Null = le propriétaire de la plateforme (préparation du multi-comptes). */
  owner_id: string | null;
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
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  created_at: string;
  /** Boutique d'origine. Null si le produit a été supprimé depuis. */
  product_id: string | null;
  /** Nom du produit figé à la commande : l'historique ne se réécrit pas. */
  product_name: string | null;
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
 * Icônes utilisables dans les blocs à puces. Liste fermée volontairement :
 * l'admin choisit dans une grille plutôt que de taper un nom, et le jour où la
 * page est composée automatiquement, le modèle n'a qu'un vocabulaire fini à
 * respecter — un nom inventé serait rejeté à la normalisation au lieu de
 * rendre une icône vide.
 */
export const LANDING_ICONS = [
  "shield", "lock", "badge-check", "award", "crown", "gem",
  "droplets", "waves", "thermometer", "wind", "leaf", "recycle",
  "zap", "battery", "wifi", "volume", "headphones", "camera",
  "watch", "timer", "clock", "hourglass", "infinity", "refresh",
  "truck", "package", "box", "layers", "map-pin", "phone",
  "banknote", "credit-card", "tag", "gift", "handshake", "users",
  "star", "heart", "sparkles", "flame", "lightbulb", "target",
  "check", "check-circle", "x-circle", "alert", "thumbs-up", "thumbs-down",
  "smile", "frown", "eye", "bell", "quote", "trending-up",
  "scale", "ruler", "weight", "wrench", "scissors", "brush",
  "palette", "wand", "shirt", "sofa", "baby", "dumbbell",
  "bike", "car", "home", "utensils", "coffee", "feather", "sun", "moon",
] as const;

export type LandingIcon = (typeof LANDING_ICONS)[number];

/** Puce d'un bloc `problem` ou `features` : une icône, un libellé, une précision. */
export type LandingItem = { icon: LandingIcon; label: string; hint: string };

/** Une colonne du bloc `compare` : son intitulé et ses arguments. */
export type LandingSide = { label: string; points: string[] };

/** Question / réponse du bloc `faq`. */
export type LandingQuestion = { question: string; answer: string };

/** Avis client du bloc `reviews`. `rating` va de 1 à 5. */
export type LandingReview = { name: string; text: string; rating: number };

/**
 * Bloc de la landing en mode custom.
 *
 * Trois familles :
 * - "hero", "gallery", "description", "form" reprennent les données du produit
 *   (un seul exemplaire chacun) ;
 * - "image" et "text" portent un contenu libre ;
 * - "showcase", "problem", "features", "compare", "faq", "reviews" et "cta"
 *   sont les sections d'argumentaire — celles qui font une page longue.
 *
 * Le texte n'est jamais incrusté dans une image : il vit ici, donc il reste
 * net, modifiable sans régénérer le visuel, lisible par les moteurs de
 * recherche, et correctement rendu en arabe — ce qu'aucun générateur d'images
 * ne sait faire.
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
  | { id: string; type: "text"; title: string; body: string }
  | {
      id: string;
      type: "showcase";
      title: string;
      body: string;
      bullets: string[];
      /**
       * "baked" : le texte est gravé dans l'image. La section ne rend alors
       *           que le visuel — rien n'est réécrit par-dessus, sinon la
       *           page dirait deux fois la même chose.
       * "stack" : repli, quand aucune image n'a pu être composée. Le texte
       *           s'affiche dans une carte, faute de support où le graver.
       *
       * Le titre et le texte restent stockés dans les deux cas : ce sont eux
       * qu'on grave, et qu'on corrige avant de recomposer.
       */
      layout: "baked" | "stack";
      /** Visuel de la section. Null = la section se rend en carte de texte. */
      url: string | null;
      width: number;
      height: number;
    }
  | { id: string; type: "problem"; title: string; body: string; items: LandingItem[] }
  | { id: string; type: "features"; title: string; items: LandingItem[] }
  | { id: string; type: "compare"; title: string; before: LandingSide; after: LandingSide }
  | { id: string; type: "faq"; title: string; items: LandingQuestion[] }
  | { id: string; type: "reviews"; title: string; items: LandingReview[] }
  | { id: string; type: "cta"; title: string; body: string; label: string };

export type LandingBlockType = LandingBlock["type"];

export const LANDING_BLOCK_TYPES: LandingBlockType[] = [
  "hero",
  "gallery",
  "description",
  "form",
  "image",
  "text",
  "showcase",
  "problem",
  "features",
  "compare",
  "faq",
  "reviews",
  "cta",
];

/**
 * Plafonds partagés par la normalisation et les éditeurs de l'admin. Ils ne
 * protègent pas la base — ils protègent la mise en page : un titre de trois
 * lignes ou une liste de vingt puces ruinent une colonne de 420 pixels.
 */
export const LANDING_LIMITS = {
  title: 120,
  body: 2000,
  label: 80,
  hint: 120,
  bullets: 6,
  items: 6,
  points: 5,
  questions: 10,
  reviews: 8,
} as const;

/** Cadres utiles pour un visuel de section, dans une colonne de téléphone. */
export const IMAGE_RATIOS = ["4:5", "1:1", "16:9"] as const;

export type ImageRatio = (typeof IMAGE_RATIOS)[number];

/**
 * Consigne de composition d'un visuel, rendue par le modèle rédacteur et
 * exécutée par le générateur d'images. `scene` ne décrit que l'environnement
 * autour du produit : le produit lui-même vient des photos de référence.
 */
export type ImageBrief = {
  scene: string;
  ratio: ImageRatio;
  /**
   * Texte à graver dans le visuel. Présent uniquement pour une section
   * « baked » : la composition le dessine dans l'image, avec un vrai moteur
   * typographique — les générateurs d'images ne savent pas écrire l'arabe.
   */
  text?: { title: string; body: string; bullets: string[] };
};

/**
 * Langue de la copie rédigée par l'IA. La page n'est pas traduite : c'est le
 * texte des blocs qui est écrit dans cette langue.
 */
export type LandingLanguage = "ar" | "darija" | "fr";

export const LANDING_LANGUAGES: { value: LandingLanguage; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "darija", label: "الدارجة الجزائرية" },
  { value: "fr", label: "Français" },
];

/**
 * Réglages de la plateforme — ce qui n'appartient à aucune boutique en
 * particulier. Tout le reste (marque, couleur, pixel, landing) est porté par
 * le produit, voir `Storefront`.
 */
export type Settings = {
  id: string;
  /** Identité affichée dans l'admin, pas sur les landings. */
  store_name: string;
  logo_url: string | null;
  /** Adresse de départ des colis Yalidine. */
  from_wilaya: string;
  /** Produit servi sur un hôte qui ne correspond à aucun domaine. */
  default_product_id: string | null;
  updated_at: string;
};
