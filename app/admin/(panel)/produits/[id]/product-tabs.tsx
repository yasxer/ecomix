"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutTemplate, Package, Store } from "lucide-react";

/**
 * Onglets d'un produit. L'onglet actif se déduit de l'URL. La barre défile
 * horizontalement sur les petits écrans plutôt que de casser sur deux lignes.
 */
export function ProductTabs({ productId }: { productId: string }) {
  const pathname = usePathname();
  const base = `/admin/produits/${productId}`;
  const tabs = [
    { href: base, label: "Produit", icon: Package },
    { href: `${base}/landing`, label: "Landing", icon: LayoutTemplate },
    { href: `${base}/vitrine`, label: "Vitrine", icon: Store },
  ];

  return (
    <nav className="no-scrollbar admin-card flex gap-1 overflow-x-auto p-1.5">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = href === base ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition ${
              active
                ? "bg-linear-to-b from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
