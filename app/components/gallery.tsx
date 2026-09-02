"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

export function Gallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const count = images.length;
  const prev = () => setActive((i) => (i - 1 + count) % count);
  const next = () => setActive((i) => (i + 1) % count);

  if (count === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
        <ImageOff className="size-12" strokeWidth={1.5} />
      </div>
    );
  }

  // Glissement du doigt : passe à l'image suivante/précédente
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) next();
    else prev();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Image principale */}
      <div
        className="group relative overflow-hidden rounded-3xl bg-zinc-100 shadow-xl shadow-zinc-900/10 ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="relative aspect-square w-full">
          {/* La page fait max 420px de large : on ne télécharge jamais plus */}
          <Image
            src={images[active]}
            alt={alt}
            fill
            sizes="(max-width: 420px) 100vw, 420px"
            priority
            className="object-cover"
          />
        </div>

        {count > 1 && (
          <>
            {/* Flèches */}
            <button
              type="button"
              onClick={prev}
              aria-label="Image précédente"
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md transition hover:bg-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Image suivante"
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-md transition hover:bg-white"
            >
              <ChevronRight className="size-5" />
            </button>

            {/* Points indicateurs */}
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`size-1.5 rounded-full transition ${
                    i === active ? "w-4 bg-white" : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Miniatures (64px, chargées en différé) */}
      {count > 1 && (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Image ${i + 1}`}
              className={`relative size-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                i === active
                  ? "ring-(--primary) shadow-md"
                  : "ring-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="64px"
                loading="lazy"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
