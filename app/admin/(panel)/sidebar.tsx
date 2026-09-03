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

const LINKS = [
  { href: "/admin", label: "Statistiques", short: "Stats", icon: LayoutDashboard },
  { href: "/admin/commandes", label: "Commandes", short: "Commandes", icon: ShoppingCart },
  { href: "/admin/produits", label: "Produits", short: "Produits", icon: Package },
  { href: "/admin/settings", label: "Paramètres", short: "Réglages", icon: Settings },
];

function Logo({
  storeName,
  logoUrl,
  className = "size-8",
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
        className={`${className} shrink-0 rounded-lg border border-zinc-200 bg-white object-contain`}
      />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white`}
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
          Adossée au contenu par un simple trait : pas de carte flottante, pas
          d'ombre — la séparation suffit à distinguer les deux zones. */}
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/60 px-2 py-4 sm:flex lg:w-56 lg:px-3">
        <div className="mb-6 flex items-center gap-2.5 px-1 lg:px-2">
          <Logo storeName={storeName} logoUrl={logoUrl} />
          <div className="hidden min-w-0 lg:block">
            <p className="truncate text-sm font-semibold text-zinc-900">{storeName}</p>
            <p className="text-[11px] text-zinc-400">Administration</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`flex min-h-9 items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition lg:justify-start ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <Icon
                  className={`size-4.5 shrink-0 ${active ? "text-indigo-600" : "text-zinc-400"}`}
                />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => logout()}
          title="Déconnexion"
          className="flex min-h-9 items-center justify-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-zinc-500 transition hover:bg-red-50 hover:text-red-600 lg:justify-start"
        >
          <LogOut className="size-4.5 shrink-0" />
          <span className="hidden lg:inline">Déconnexion</span>
        </button>
      </aside>

      {/* ── En-tête mobile ──
          Volontairement sans `backdrop-blur` : sur un élément fixe, Safari iOS
          refait le flou du contenu derrière à chaque frame de scroll. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 sm:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo storeName={storeName} logoUrl={logoUrl} className="size-8" />
          <p className="truncate text-sm font-semibold text-zinc-900">{storeName}</p>
        </div>
        <button
          onClick={() => logout()}
          aria-label="Déconnexion"
          className="-me-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition active:bg-red-50 active:text-red-600"
        >
          <LogOut className="size-5" />
        </button>
      </header>

      {/* ── Navigation mobile ──
          Ancrée au bas de l'écran plutôt que flottante : une barre pleine
          largeur donne des cibles plus grandes. `pb-safe` la maintient
          au-dessus de la barre d'accueil de l'iPhone. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-zinc-200 bg-white pb-safe sm:hidden">
        {LINKS.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium whitespace-nowrap transition ${
                active ? "text-indigo-600" : "text-zinc-400 active:bg-zinc-50"
              }`}
            >
              <Icon className="size-5" />
              {short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
