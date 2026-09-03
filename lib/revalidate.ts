import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Régénère les vitrines après un enregistrement dans l'admin.
 *
 * Le chemin exact d'une boutique dépend de l'hôte appelé (`/s/boutique.dz`),
 * et un même produit peut être servi sous plusieurs clés : son domaine, son
 * slug (`/p/mon-produit`) et n'importe quel hôte non attribué s'il est le
 * produit par défaut. Plutôt que de deviner cette liste, on invalide toute la
 * route : les enregistrements d'admin sont rares, et une page régénérée pour
 * rien coûte un rendu.
 */
export function revalidateStorefronts(): void {
  revalidatePath("/s/[key]", "page");
}
