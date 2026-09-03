"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutTemplate, Package, Store } from "lucide-react";

/** Onglets d'un produit. L'onglet actif se déduit de l'URL. */
export function ProductTabs({ productId }: { productId: string }) {
  const pathname = usePathname();
  const base = `/admin/produits/${productId}`;
  const tabs = [
    { href: base, label: "Produit", icon: Package },
    { href: `${base}/landing`, label: "Landing page", icon: LayoutTemplate },
    { href: `${base}/vitrine`, label: "Vitrine", icon: Store },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ring-zinc-900/5">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = href === base ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-linear-to-b from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
