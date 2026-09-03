"use client";

import { Moon, Sun } from "lucide-react";

export const THEME_KEY = "admin-theme";

/**
 * Posé avant le rendu de l'admin, dans le HTML lui-même : lire le thème depuis
 * un effet React laisserait un éclair blanc à chaque chargement de page.
 * `data-admin-theme` — et non `data-theme`, qui appartient à l'aperçu de la
 * landing.
 */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY
)});if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.dataset.adminTheme=t;}catch(e){}})();`;

/**
 * Bascule clair / sombre. Le thème vit sur `<html>`, jamais dans un état React :
 * le serveur ignore la préférence de l'utilisateur, donc tout rendu conditionnel
 * produirait soit une erreur d'hydratation, soit un changement d'icône visible
 * après le montage. C'est la variante `admin-dark:` qui montre la bonne icône,
 * dès la première frame.
 */
export function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.adminTheme === "dark" ? "light" : "dark";
    root.dataset.adminTheme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Navigation privée : le thème ne vaudra que pour cet onglet, tant pis.
    }
  }

  const icon = labelled ? "size-4.5 shrink-0" : "size-5 shrink-0";

  return (
    <button
      onClick={toggle}
      title="Changer de thème"
      aria-label="Changer de thème"
      className={
        labelled
          ? "flex min-h-9 items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-ink-dim transition hover:bg-raised hover:text-ink lg:justify-start"
          : "flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-faint transition active:bg-raised active:text-ink"
      }
    >
      <Moon className={`${icon} admin-dark:hidden`} />
      <Sun className={`hidden ${icon} admin-dark:block`} />
      {labelled && (
        <span className="hidden lg:inline">
          <span className="admin-dark:hidden">Thème sombre</span>
          <span className="hidden admin-dark:inline">Thème clair</span>
        </span>
      )}
    </button>
  );
}
