"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutTemplate, Package, Store } from "lucide-react";

/**
 * Onglets d'un produit — soulignés plutôt qu'en pilules : ils se lisent comme
 * une continuité de la page, pas comme un bloc de boutons posé dessus. La
 * barre défile horizontalement sur les petits écrans.
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
    <nav className="no-scrollbar -mb-px flex gap-6 overflow-x-auto border-b border-zinc-200">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = href === base ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 text-sm font-medium transition ${
              active
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
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
