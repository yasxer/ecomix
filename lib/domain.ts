/**
 * Normalisation des domaines. Partagé par `proxy.ts` (qui tourne à l'Edge et
 * ne peut donc rien importer de `server-only`), les actions d'admin et la
 * résolution de la boutique : l'hôte reçu et le domaine enregistré doivent
 * passer par la même moulinette, sinon `boutique.dz` ne retrouve jamais
 * `www.Boutique.dz`.
 */

/** "www.Ma-Boutique.dz:3000" -> "ma-boutique.dz" */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    // Un domaine collé depuis la barre d'adresse arrive souvent en URL
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}

/**
 * Un domaine est-il utilisable ? Volontairement permissif (on accepte
 * `boutique.localhost` en développement) mais suffisant pour écarter les
 * saisies qui ne résoudront jamais.
 */
export function isValidDomain(domain: string): boolean {
  return (
    domain.length <= 253 &&
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)
  );
}

/** Le slug d'un produit : minuscules, chiffres et tirets. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/.test(slug);
}
