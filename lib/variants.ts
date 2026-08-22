/**
 * Rendu lisible des variantes d'une commande, partagé par Telegram, Yalidine et
 * les tableaux de l'admin. À plusieurs pièces chacune est numérotée —
 * « 1) Noir / M — 2) Blanc / L » : la personne qui prépare le colis a besoin de
 * savoir quelle pièce est laquelle. À une seule pièce le numéro n'apprend rien.
 *
 * `items` est la source de vérité ; `color`/`size` servent de repli pour les
 * commandes créées avant la migration 012, où la colonne n'existait pas.
 */
import type { OrderItem } from "./types";

export function formatVariants(order: {
  items: OrderItem[];
  color: string | null;
  size: string | null;
}): string {
  const detailed = order.items.flatMap((item) => {
    const variant = [item.color, item.size].filter(Boolean).join(" / ");
    return variant ? [variant] : [];
  });
  if (detailed.length > 1) {
    return detailed.map((variant, i) => `${i + 1}) ${variant}`).join(" — ");
  }
  return detailed[0] ?? [order.color, order.size].filter(Boolean).join(" / ");
}

/**
 * Valeurs distinctes d'un champ des `items` (« Noir, Blanc »). C'est ce résumé
 * qu'on écrit dans `orders.color` / `orders.size` : les cellules compactes de
 * l'admin et les anciennes lignes continuent de s'afficher sans cas particulier.
 */
export function summarize(items: OrderItem[], key: keyof OrderItem): string | null {
  const values = [...new Set(items.flatMap((i) => (i[key] ? [i[key] as string] : [])))];
  return values.length > 0 ? values.join(", ") : null;
}
