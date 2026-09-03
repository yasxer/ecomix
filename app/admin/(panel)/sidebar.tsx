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
  className = "size-9",
  rounded = "rounded-xl",
}: {
  storeName: string;
  logoUrl: string | null;
  className?: string;
  rounded?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={storeName}
        className={`${className} ${rounded} shrink-0 bg-white object-contain`}
      />
    );
  }
  return (
    <span
      className={`${className} ${rounded} flex shrink-0 items-center justify-center bg-linear-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-600/30`}
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
      {/* ── Sidebar desktop / rail tablette — flottante ── */}
      <div className="sticky top-0 hidden h-screen shrink-0 p-3 sm:block">
        <aside className="flex h-full w-16 flex-col rounded-3xl bg-linear-to-b from-zinc-900 to-zinc-950 p-3 shadow-2xl shadow-zinc-900/20 ring-1 ring-white/5 lg:w-60 lg:p-4">
          <div className="mb-8 flex items-center gap-3 px-1 pt-2">
            <Logo storeName={storeName} logoUrl={logoUrl} />
            <div className="hidden min-w-0 lg:block">
              <p className="truncate font-bold text-white">{storeName}</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                Admin
              </p>
            </div>
          </div>

          <p className="mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600 lg:block">
            Menu
          </p>
          <nav className="flex flex-1 flex-col gap-1.5">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`group flex min-h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-medium transition-all lg:w-full ${
                    active
                      ? "bg-linear-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`size-5 shrink-0 transition-transform ${
                      active ? "" : "group-hover:scale-110"
                    }`}
                  />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/5 pt-3">
            <button
              onClick={() => logout()}
              title="Déconnexion"
              className="flex min-h-11 w-full items-center gap-3 rounded-2xl px-3.5 text-sm font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="size-5 shrink-0" />
              <span className="hidden lg:inline">Déconnexion</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ── En-tête mobile ──
          Volontairement sans `backdrop-blur` : sur un élément fixe, Safari iOS
          refait le flou du contenu derrière à chaque frame de scroll. */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/95 px-4 sm:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo
            storeName={storeName}
            logoUrl={logoUrl}
            className="size-9"
            rounded="rounded-xl"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-zinc-900">
              {storeName}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Admin
            </p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          aria-label="Déconnexion"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 transition active:scale-95 active:bg-red-50 active:text-red-600"
        >
          <LogOut className="size-5" />
        </button>
      </header>

      {/* ── Navigation mobile flottante ──
          `mb-safe` la remonte au-dessus de la barre d'accueil de l'iPhone :
          sans ça, sa moitié basse n'est pas cliquable. */}
      <nav className="fixed inset-x-3 bottom-3 z-40 mb-safe flex gap-1 rounded-3xl bg-zinc-950/95 p-1.5 shadow-xl shadow-zinc-900/30 ring-1 ring-white/10 sm:hidden">
        {LINKS.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-13 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-semibold whitespace-nowrap transition ${
                active
                  ? "bg-linear-to-b from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 active:bg-white/5"
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
