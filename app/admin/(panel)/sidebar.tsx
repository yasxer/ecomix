"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Package,
  PackageOpen,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "./theme-toggle";

const LINKS = [
  { href: "/admin", label: "Statistiques", short: "Stats", icon: LayoutDashboard },
  { href: "/admin/commandes", label: "Commandes", short: "Commandes", icon: ShoppingCart },
  { href: "/admin/produits", label: "Produits", short: "Produits", icon: Package },
  { href: "/admin/settings", label: "Paramètres", short: "Réglages", icon: Settings },
];

function Logo({
  storeName,
  logoUrl,
  className = "size-9",
}: {
  storeName: string;
  logoUrl: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={storeName}
        className={`${className} shrink-0 rounded-xl border border-line bg-surface object-contain`}
      />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-xl text-white`}
      style={{
        background:
          "linear-gradient(140deg, var(--accent-strong), var(--accent) 55%, color-mix(in oklab, var(--accent) 70%, black))",
      }}
    >
      <PackageOpen className="size-1/2" />
    </span>
  );
}

export function Sidebar({
  storeName,
  logoUrl,
}: {
  storeName: string;
  logoUrl: string | null;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <>
      {/* ── Colonne de navigation (tablette et plus) ──
          Une surface adossée au fond teinté de la page : le contraste des deux
          plans sépare la navigation du contenu, sans ombre ni carte flottante. */}
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col border-r border-line bg-surface px-2 py-4 sm:flex lg:w-60 lg:px-3">
        <div className="mb-6 flex items-center gap-2.5 px-1 lg:px-1.5">
          <Logo storeName={storeName} logoUrl={logoUrl} />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold tracking-tight text-ink">
              {storeName}
            </p>
            <p className="text-[11px] font-medium text-ink-faint">Administration</p>
          </div>
        </div>

        <p className="mb-1.5 hidden px-2.5 text-[10px] font-semibold uppercase tracking-widest text-ink-faint lg:block">
          Pilotage
        </p>

        <nav className="flex flex-1 flex-col gap-0.5">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-10 items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition lg:justify-start ${
                  active
                    ? "bg-accent-soft text-accent-ink"
                    : "text-ink-dim hover:bg-raised hover:text-ink"
                }`}
              >
                {/* Repère d'onglet actif : un trait sur le bord interne, qui
                    reste lisible même quand la colonne est réduite aux icônes. */}
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent" />
                )}
                <Icon
                  className={`size-4.5 shrink-0 ${active ? "text-accent" : "text-ink-faint"}`}
                />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-line pt-2">
          <ThemeToggle labelled />
          <button
            onClick={() => logout()}
            title="Déconnexion"
            className="flex min-h-9 items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-ink-dim transition hover:bg-danger-soft hover:text-danger lg:justify-start"
          >
            <LogOut className="size-4.5 shrink-0" />
            <span className="hidden lg:inline">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* ── En-tête mobile ──
          Volontairement sans `backdrop-blur` : sur un élément fixe, Safari iOS
          refait le flou du contenu derrière à chaque frame de scroll. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo storeName={storeName} logoUrl={logoUrl} className="size-8" />
          <p className="truncate text-sm font-semibold text-ink">{storeName}</p>
        </div>
        <div className="-me-2 flex shrink-0 items-center">
          <ThemeToggle />
          <button
            onClick={() => logout()}
            aria-label="Déconnexion"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-faint transition active:bg-danger-soft active:text-danger"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      {/* ── Navigation mobile ──
          Ancrée au bas de l'écran plutôt que flottante : une barre pleine
          largeur donne des cibles plus grandes. `pb-safe` la maintient
          au-dessus de la barre d'accueil de l'iPhone. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface pb-safe sm:hidden">
        {LINKS.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium whitespace-nowrap transition ${
                active ? "text-accent-ink" : "text-ink-faint active:bg-raised"
              }`}
            >
              {/* La pastille teintée porte l'état actif : au doigt, une simple
                  nuance de gris sur une icône de 20px ne se voit pas. */}
              <span
                className={`flex h-6 w-10 items-center justify-center rounded-full transition ${
                  active ? "bg-accent-soft" : ""
                }`}
              >
                <Icon className={`size-5 ${active ? "text-accent" : ""}`} />
              </span>
              {short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
