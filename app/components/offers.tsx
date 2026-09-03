"use client";

import { useState } from "react";
import { OrderForm } from "./order-form";
import { PackCard } from "./pack-card";
import type { FreeDeliveryMode, ProductColor, ProductPack } from "@/lib/types";

/**
 * Frontière client qui réunit la section des offres et le formulaire. Les deux
 * partagent le pack sélectionné, et `app/page.tsx` est un Server Component :
 * l'état doit vivre dans un composant qui contient les deux. Le titre du bloc
 * commande arrive en `children` pour que la copie de la landing reste, elle,
 * dans `page.tsx`.
 */
export function Offers({
  productId,
  packs,
  price,
  colors,
  sizes,
  freeDeliveryMode,
  children,
}: {
  /** Boutique commandée : le serveur relit tout le produit d'après cet id. */
  productId: string;
  packs: ProductPack[];
  price: number;
  colors: ProductColor[];
  sizes: string[];
  freeDeliveryMode: FreeDeliveryMode;
  children: React.ReactNode;
}) {
  // Le premier pack est présélectionné : l'admin contrôle l'ordre, et le
  // formulaire n'est jamais dans un état où le bouton refuse de partir sans
  // que le client comprenne pourquoi.
  const [selectedPackId, setSelectedPackId] = useState<string | null>(
    packs[0]?.id ?? null
  );

  function selectAndScroll(id: string) {
    setSelectedPackId(id);
    // Le smooth scroll et son garde-fou `prefers-reduced-motion` sont déjà
    // gérés dans `app/globals.css`.
    document.getElementById("commander")?.scrollIntoView();
  }

  return (
    <>
      {packs.length > 0 && (
        <section id="offres" dir="rtl" lang="ar" className="scroll-mt-24 pt-10">
          <div className="mb-4 flex flex-col items-center gap-1 text-center">
            <h2 className="landing-title text-2xl">اختر عرضك</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">كل ما زادت الكمية، رخّص السعر</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {packs.map((pack) => (
              <PackCard
                key={pack.id}
                pack={pack}
                selected={pack.id === selectedPackId}
                onSelect={() => selectAndScroll(pack.id)}
              />
            ))}
          </div>
        </section>
      )}

      <div id="commander" className="scroll-mt-24 pt-10">
        {children}
        <OrderForm
          productId={productId}
          price={price}
          colors={colors}
          sizes={sizes}
          freeDeliveryMode={freeDeliveryMode}
          packs={packs}
          selectedPackId={selectedPackId}
        />
      </div>
    </>
  );
}
