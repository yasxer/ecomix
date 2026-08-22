"use client";

import type { OrderItem, ProductColor } from "@/lib/types";

/**
 * Couleur et taille, une fois par pièce commandée. Un pack de 2 pièces demande
 * donc 2 choix : le client qui prend l'offre familiale veut rarement deux fois
 * le même coloris. À une seule pièce l'intitulé « القطعة 1 » disparaît — il
 * n'apprendrait rien.
 */
export function VariantPicker({
  colors,
  sizes,
  count,
  items,
  onChange,
}: {
  colors: ProductColor[];
  sizes: string[];
  count: number;
  items: OrderItem[];
  onChange: (index: number, changes: Partial<OrderItem>) => void;
}) {
  if (colors.length === 0 && sizes.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => {
        const item = items[index] ?? { color: null, size: null };
        return (
          <div
            key={index}
            className={
              count > 1
                ? "flex flex-col gap-3 rounded-xl border border-zinc-200 p-4"
                : "flex flex-col gap-3"
            }
          >
            {count > 1 && (
              <span className="text-sm font-bold text-zinc-900">
                القطعة {index + 1}
              </span>
            )}

            {colors.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-zinc-700">
                  اللون{" "}
                  {item.color ? (
                    <span className="font-normal text-zinc-500">— {item.color}</span>
                  ) : (
                    <span className="font-normal text-zinc-400">(اختر)</span>
                  )}
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => onChange(index, { color: c.name })}
                      title={c.name}
                      aria-label={`اللون ${c.name}`}
                      className={`size-10 rounded-full ring-2 ring-offset-2 transition ${
                        item.color === c.name
                          ? "ring-(--primary) scale-110"
                          : "ring-zinc-200 hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-zinc-700">المقاس</span>
                <div className="flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onChange(index, { size: s })}
                      className={`min-w-11 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition ${
                        item.size === s
                          ? "border-(--primary) bg-(--primary)/5 text-(--primary)"
                          : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
