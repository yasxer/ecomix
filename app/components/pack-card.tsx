"use client";

import { Check } from "lucide-react";
import type { ProductPack } from "@/lib/types";

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

export function PackCard({
  pack,
  selected,
  onSelect,
}: {
  pack: ProductPack;
  selected: boolean;
  onSelect: () => void;
}) {
  const discount =
    pack.old_price && pack.old_price > pack.price
      ? Math.round((1 - pack.price / pack.old_price) * 100)
      : null;
  const ribbon = pack.highlight !== "none" && pack.badge ? pack.badge : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      dir="rtl"
      className={`relative mt-1 flex min-h-20 w-full items-center rounded-2xl border-2 bg-white px-5 py-4 dark:bg-zinc-900 text-start transition hover:border-(--primary)/60 ${
        selected
          ? "border-(--primary) bg-(--primary)/5"
          : "border-zinc-200 dark:border-zinc-700"
      } ${pack.highlight === "border" ? "ring-1 ring-(--primary)/35" : ""}`}
    >
      {ribbon && (
        <span
          dir="auto"
          className="absolute -bottom-4 end-5 z-10 rounded-full bg-(--primary) px-4 py-1 text-xs font-bold leading-tight text-white shadow-md"
        >
          {ribbon}
        </span>
      )}

      <span className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
            selected
              ? "border-(--primary) bg-(--primary) text-white"
              : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
          }`}
        >
          {selected && <Check className="size-4" strokeWidth={3} />}
        </span>
        <span dir="auto" className="truncate text-base font-bold text-zinc-900 dark:text-zinc-100">
          {pack.label}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-0.5 ps-3">
        {pack.old_price && pack.old_price > pack.price && (
          <span className="flex items-baseline gap-1.5 text-xs">
            <span className="font-medium text-zinc-400">قبل</span>
            <span className="font-medium text-zinc-400 line-through">
              {formatDA(pack.old_price)}
            </span>
          </span>
        )}
        <span className="flex items-baseline gap-1.5">
          {pack.old_price && pack.old_price > pack.price && (
            <span className="text-xs font-bold text-(--primary)">الآن</span>
          )}
          <span className="text-xl font-extrabold text-(--primary)">
            {formatDA(pack.price)}
          </span>
        </span>
        {discount !== null && (
          <span className="rounded-full bg-(--primary)/10 px-2 py-0.5 text-[11px] font-bold text-(--primary)">
            -{discount}%
          </span>
        )}
      </span>
    </button>
  );
}
