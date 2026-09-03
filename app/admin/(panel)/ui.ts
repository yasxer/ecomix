/**
 * Classes partagées par les formulaires de l'admin. Elles étaient recopiées
 * dans chaque fichier, avec des variantes qui divergeaient au fil du temps.
 * Le détail visuel vit dans `app/globals.css` (`admin-field`, `admin-card`…) ;
 * ce module n'existe que pour que les composants clients y accèdent par un
 * nom, sans répéter la chaîne.
 */

/** Champ de saisie : input, select, textarea. */
export const inputClass = "admin-field";

/** Libellé + champ empilés. */
export const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-zinc-700";

/** Texte d'aide sous un champ. */
export const hintClass = "text-xs font-normal leading-relaxed text-zinc-400";

/** Surface blanche de l'admin. */
export const cardClass = "admin-card";
