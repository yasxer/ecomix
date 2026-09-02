"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Home,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  Store,
  Truck,
  User,
} from "lucide-react";
import { createOrder, type OrderFormState } from "@/app/actions/orders";
import { WILAYAS } from "@/lib/wilayas";
import type {
  FreeDeliveryMode,
  OrderItem,
  ProductColor,
  ProductPack,
} from "@/lib/types";
import { VariantPicker } from "./variant-picker";

const initialState: OrderFormState = {};

type Center = {
  id: number;
  name: string;
  commune: string;
  address: string;
  fee: number | null;
};

type DeliveryData = {
  homeFee: number;
  deskFee: number | null;
  centers: Center[];
};

function formatDA(n: number) {
  return `${n.toLocaleString("fr-DZ")} DA`;
}

// Cache côté navigateur : re-sélectionner une wilaya déjà chargée est instantané
const deliveryCache = new Map<string, DeliveryData>();

// Meta Pixel (injecté par MetaPixel si configuré dans les settings)
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function trackPixel(event: string, data?: Record<string, unknown>) {
  try {
    window.fbq?.("track", event, data);
  } catch {
    // le pixel ne doit jamais casser le formulaire
  }
}

/** Pièce dont la variante n'a pas encore été choisie. */
const EMPTY_ITEM: OrderItem = { color: null, size: null };

export function OrderForm({
  price,
  colors,
  sizes,
  freeDeliveryMode,
  packs,
  selectedPackId,
}: {
  price: number;
  colors: ProductColor[];
  sizes: string[];
  freeDeliveryMode: FreeDeliveryMode;
  /** Offres groupées. Vide = vente à la pièce avec le sélecteur de quantité. */
  packs: ProductPack[];
  /** Pack choisi dans la section « اختر عرضك » (voir `offers.tsx`). */
  selectedPackId: string | null;
}) {
  const [state, action, pending] = useActionState(createOrder, initialState);
  const [quantity, setQuantity] = useState(1);

  const selectedPack = packs.find((p) => p.id === selectedPackId) ?? null;
  // Le pack fait la quantité : quand des offres existent, le sélecteur `-/+`
  // disparaît et c'est `pack.quantity` qui compte les pièces.
  const effectiveQuantity = selectedPack?.quantity ?? quantity;

  /**
   * Ce que le client a choisi, pièce par pièce. Le tableau n'est jamais retaillé
   * quand l'offre change : c'est `items` qui est dérivé à la bonne longueur au
   * rendu. Passer du pack 2 au pack 1 puis revenir ne perd donc rien, et il n'y
   * a pas d'effet qui corrige l'état après coup.
   */
  const [chosen, setChosen] = useState<OrderItem[]>([]);
  /** Une entrée par pièce commandée, complétée de vides si besoin. */
  const items = Array.from(
    { length: effectiveQuantity },
    (_, i) => chosen[i] ?? EMPTY_ITEM
  );
  const itemsJson = JSON.stringify(items);

  function patchItem(index: number, changes: Partial<OrderItem>) {
    setChosen((prev) =>
      Array.from({ length: Math.max(prev.length, index + 1) }, (_, i) =>
        i === index
          ? { ...(prev[i] ?? EMPTY_ITEM), ...changes }
          : prev[i] ?? EMPTY_ITEM
      )
    );
  }

  // Ce que le client a coché ; `deliveryType` plus bas tient compte des
  // wilayas où Yalidine n'a aucun bureau.
  const [deliveryChoice, setDeliveryChoice] = useState<"domicile" | "stopdesk">(
    "domicile"
  );
  const [wilaya, setWilaya] = useState("");
  const [delivery, setDelivery] = useState<DeliveryData | null>(null);
  const [feesError, setFeesError] = useState(false);
  const [loadingFees, setLoadingFees] = useState(false);
  const [stopdeskId, setStopdeskId] = useState<number | null>(null);
  const requestSeq = useRef(0);
  const checkoutTracked = useRef(false);
  const lastTotal = useRef(0);

  // Purchase envoyé au Pixel une fois la commande enregistrée
  useEffect(() => {
    if (state.success) {
      trackPixel("Purchase", { value: lastTotal.current, currency: "DZD" });
    }
  }, [state.success]);

  // Tarifs + bureaux chargés depuis Yalidine à chaque changement de wilaya
  function handleWilayaChange(value: string) {
    setWilaya(value);
    setStopdeskId(null);
    setFeesError(false);
    if (!value) {
      setDelivery(null);
      return;
    }
    const cached = deliveryCache.get(value);
    if (cached) {
      setDelivery(cached);
      return;
    }
    setDelivery(null);
    const seq = ++requestSeq.current;
    setLoadingFees(true);
    fetch(`/api/delivery?wilaya=${encodeURIComponent(value)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DeliveryData | null) => {
        if (data) deliveryCache.set(value, data);
        if (seq !== requestSeq.current) return;
        setDelivery(data);
        setFeesError(data === null);
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setDelivery(null);
        setFeesError(true);
      })
      .finally(() => {
        if (seq === requestSeq.current) setLoadingFees(false);
      });
  }

  const centers = delivery?.centers ?? [];
  const selectedCenter = centers.find((c) => c.id === stopdeskId) ?? null;
  const stopdeskAvailable = centers.length > 0;
  /** Tarifs chargés, mais Yalidine n'a aucun bureau dans cette wilaya. */
  const noStopdeskHere = delivery !== null && !stopdeskAvailable;
  /**
   * Aucun bureau à proposer, que la wilaya n'en ait pas ou que Yalidine soit
   * injoignable. Dans les deux cas la liste des bureaux ne peut pas s'afficher,
   * donc l'option ne doit pas être sélectionnable : sinon le client la coche et
   * se retrouve devant un choix vide, sans rien pour comprendre pourquoi.
   */
  const stopdeskBlocked = Boolean(wilaya) && !loadingFees && !stopdeskAvailable;

  // Le client peut avoir coché Stopdesk avant de changer de wilaya : on dérive
  // le mode réel plutôt que de corriger l'état après coup. Sans ça la commande
  // partirait sans `stopdesk_id`, que le serveur rejette.
  const deliveryType = stopdeskBlocked ? "domicile" : deliveryChoice;

  // Tarif réellement facturé par Yalidine pour ce mode de livraison
  const yalidineFee =
    delivery === null
      ? null
      : deliveryType === "domicile"
        ? delivery.homeFee
        : selectedCenter?.fee ?? delivery.deskFee ?? delivery.homeFee;
  // "Tout offert" : plus de choix, la commande part toujours à domicile
  const hideDeliveryChoice = freeDeliveryMode === "all";
  // Livraison offerte : le client ne paie rien, la boutique absorbe les frais
  const isFree =
    freeDeliveryMode === "all" ||
    (freeDeliveryMode === "stopdesk" && deliveryType === "stopdesk");
  const fee = isFree ? 0 : yalidineFee;
  // Le pack porte le prix du lot, pas celui d'une pièce : jamais × quantité.
  const subtotal = selectedPack ? selectedPack.price : price * quantity;
  const total = subtotal + (fee ?? 0);
  const variantsOk = items.every(
    (item) =>
      (colors.length === 0 || item.color !== null) &&
      (sizes.length === 0 || item.size !== null)
  );
  // Des offres existent mais aucune n'est retenue : rien à commander.
  const packOk = packs.length === 0 || selectedPack !== null;
  const ready =
    Boolean(wilaya) && !loadingFees && delivery !== null && variantsOk && packOk;

  // Variantes, quantité et pack passent par des boutons qui écrivent dans des
  // champs cachés : React n'émet pas d'`change` pour eux, le `onChange` du
  // formulaire ne les verrait donc jamais.

  if (state.success) {
    return (
      <div
        dir="rtl"
        lang="ar"
        className="flex flex-col items-center gap-4 rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-9" />
        </span>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">تم استلام طلبكم!</h3>
        <p className="max-w-sm text-zinc-600 dark:text-zinc-300">
          شكرا على ثقتكم. سيتصل بكم فريقنا في أقرب وقت لتأكيد طلبكم.
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder-zinc-400 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 transition focus:border-(--primary) focus:ring-2 focus:ring-(--primary)/20";

  return (
    <form
      dir="rtl"
      lang="ar"
      action={action}
      onSubmit={() => {
        lastTotal.current = total;
      }}
      onFocusCapture={() => {
        // InitiateCheckout : première interaction avec le formulaire
        if (!checkoutTracked.current) {
          checkoutTracked.current = true;
          trackPixel("InitiateCheckout", { value: subtotal, currency: "DZD" });
        }
      }}
      className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-zinc-200/60 dark:bg-zinc-900 dark:ring-white/10 sm:p-8"
    >
      <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
        اطلب الآن — الدفع عند الاستلام
      </h3>

      {freeDeliveryMode !== "none" && (
        <p className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-center text-sm font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          <Truck className="size-4 shrink-0" />
          {freeDeliveryMode === "all"
            ? "التوصيل مجاني لكل الولايات"
            : "التوصيل مجاني للمكتب (Stopdesk)"}
        </p>
      )}

      {/* Anti-bot, invisible */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {/* Offre retenue. Le serveur relit le prix et la quantité depuis la base
          d'après cet identifiant : rien de tarifaire ne vient du client. */}
      <input type="hidden" name="pack_id" value={selectedPack?.id ?? ""} />

      {/* Rappel de l'offre choisie. Pas de second sélecteur : la section
          « اختر عرضك » plus haut *est* le sélecteur. */}
      {packs.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-(--primary)/5 px-4 py-3">
          {selectedPack ? (
            <span dir="auto" className="min-w-0 text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {selectedPack.label}
              <span className="ms-1.5 font-extrabold text-(--primary)">
                {formatDA(selectedPack.price)}
              </span>
            </span>
          ) : (
            <span className="text-sm font-semibold text-zinc-500">لم تختر عرضا</span>
          )}
          <a
            href="#offres"
            className="shrink-0 text-sm font-bold text-(--primary) underline underline-offset-4"
          >
            بدّل العرض
          </a>
        </div>
      )}

      {/* Couleur et taille, une fois par pièce */}
      <VariantPicker
        colors={colors}
        sizes={sizes}
        count={effectiveQuantity}
        items={items}
        onChange={patchItem}
      />

      {/* Source de vérité des variantes côté serveur */}
      <input type="hidden" name="items" value={itemsJson} />

      <div className="relative">
        <User className="pointer-events-none absolute start-4 top-1/2 size-4.5 -translate-y-1/2 text-zinc-400" />
        <input
          name="customer_name"
          required
          placeholder="الاسم و اللقب"
          className={`${inputClass} ps-11`}
        />
      </div>

      <div className="relative">
        <Phone className="pointer-events-none absolute start-4 top-1/2 size-4.5 -translate-y-1/2 text-zinc-400" />
        <input
          name="phone"
          required
          type="tel"
          inputMode="tel"
          placeholder="رقم الهاتف (مثال: 0550123456)"
          className={`${inputClass} ps-11`}
        />
      </div>

      <select
        name="wilaya"
        required
        value={wilaya}
        onChange={(e) => handleWilayaChange(e.target.value)}
        className={inputClass}
      >
        <option value="" disabled>
          اختر ولايتك
        </option>
        {WILAYAS.map((w) => (
          <option key={w} value={w}>
            {w}
          </option>
        ))}
      </select>

      {feesError && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          تعذر تحميل أسعار التوصيل. تحقق من اتصالك بالأنترنت ثم أعد اختيار
          الولاية.
        </p>
      )}

      {/* Type de livraison — masqué quand tout est offert : la commande part
          alors systématiquement à domicile */}
      {hideDeliveryChoice ? (
        <input type="hidden" name="delivery_type" value="domicile" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                value: "domicile",
                label: "توصيل للمنزل",
                icon: Home,
                optionFee: delivery?.homeFee ?? null,
                disabled: false,
              },
              {
                value: "stopdesk",
                label: "مكتب Stopdesk",
                icon: Store,
                optionFee: delivery?.deskFee ?? null,
                disabled: stopdeskBlocked,
              },
            ] as const
          ).map(({ value, label, icon: Icon, optionFee, disabled }) => (
            <label
              key={value}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-2 text-center transition ${
                disabled
                  ? "cursor-not-allowed border-zinc-100 opacity-50 dark:border-zinc-800"
                  : deliveryType === value
                    ? "cursor-pointer border-(--primary) bg-(--primary)/5"
                    : "cursor-pointer border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="delivery_type"
                value={value}
                disabled={disabled}
                checked={deliveryType === value}
                onChange={() => setDeliveryChoice(value)}
                className="sr-only"
              />
              <Icon
                className={`size-4 ${deliveryType === value ? "text-(--primary)" : "text-zinc-400"}`}
              />
              {/* `whitespace-nowrap` : sur deux lignes, la carte doublerait de
                  hauteur — c'est ce qui la rendait si haute. */}
              <span className="whitespace-nowrap text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {label}
              </span>
              {freeDeliveryMode === "stopdesk" && value === "stopdesk" ? (
                <span className="text-[11px] font-bold text-emerald-600">مجاني</span>
              ) : (
                <span className="text-[11px] text-zinc-500">
                  {loadingFees
                    ? "..."
                    : optionFee !== null
                      ? formatDA(optionFee)
                      : "—"}
                </span>
              )}
            </label>
          ))}
        </div>
      )}

      {/* Wilaya sans bureau : on le dit, l'option grisée seule n'explique rien */}
      {!hideDeliveryChoice && noStopdeskHere && (
        <p className="flex items-start gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <Store className="mt-0.5 size-4 shrink-0" />
          لا يوجد مكتب Stopdesk في هذه الولاية. التوصيل للمنزل فقط.
        </p>
      )}

      {/* Stopdesk : choix du bureau Yalidine de la wilaya */}
      {deliveryType === "stopdesk" && stopdeskAvailable && (
        <div className="flex flex-col gap-2">
          <select
            name="stopdesk_id"
            required
            value={stopdeskId ?? ""}
            onChange={(e) => setStopdeskId(Number(e.target.value) || null)}
            className={inputClass}
          >
            <option value="" disabled>
              اختر مكتب التوصيل
            </option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.commune}
              </option>
            ))}
          </select>
          {selectedCenter && (
            <p className="flex items-start gap-1.5 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              {selectedCenter.address}
            </p>
          )}
        </div>
      )}

      {/* Adresse : saisie manuelle pour la livraison à domicile (commune incluse) */}
      {deliveryType === "domicile" && (
        <div className="relative">
          <MapPin className="pointer-events-none absolute start-4 top-1/2 size-4.5 -translate-y-1/2 text-zinc-400" />
          <input
            name="address"
            required
            placeholder="العنوان الكامل (البلدية، الحي...)"
            className={`${inputClass} ps-11`}
          />
        </div>
      )}

      {/* Quantité — remplacée par le choix de l'offre quand des packs existent */}
      {packs.length === 0 && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">الكمية</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              aria-label="إنقاص"
            >
              <Minus className="size-4" />
            </button>
            <span className="w-6 text-center font-bold text-zinc-900 dark:text-zinc-100">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              aria-label="زيادة"
            >
              <Plus className="size-4" />
            </button>
            <input type="hidden" name="quantity" value={quantity} />
          </div>
        </div>
      )}

      {/* Récap */}
      <div className="flex flex-col gap-1.5 rounded-xl bg-zinc-50 p-4 text-sm dark:bg-zinc-800">
        <div className="flex justify-between gap-3 text-zinc-600 dark:text-zinc-300">
          <span dir="auto" className="min-w-0">
            {selectedPack ? selectedPack.label : "المنتج"} × {effectiveQuantity}
          </span>
          <span className="shrink-0">{formatDA(subtotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-600 dark:text-zinc-300">
          <span>التوصيل</span>
          {isFree ? (
            <span className="font-bold text-emerald-600">مجاني</span>
          ) : (
            <span>
              {loadingFees
                ? "..."
                : fee !== null
                  ? formatDA(fee)
                  : "اختر ولاية"}
            </span>
          )}
        </div>
        <div className="mt-1 flex justify-between border-t border-zinc-200 pt-2 text-base font-bold text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          <span>المجموع</span>
          <span className="text-(--primary)">
            {fee !== null ? formatDA(total) : formatDA(subtotal)}
          </span>
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-500/15 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || !ready}
        className="flex items-center justify-center gap-2 rounded-xl bg-(--primary) px-6 py-4 text-base font-bold text-white shadow-lg shadow-(--primary)/25 transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" />
            جاري الإرسال...
          </>
        ) : ready ? (
          <>تأكيد الطلب — {formatDA(total)}</>
        ) : !packOk ? (
          <>اختر عرضك</>
        ) : !variantsOk ? (
          // À plusieurs pièces, nommer la couleur ou la taille manquante
          // n'aide pas : c'est *quelle* pièce qui est incomplète qui compte.
          <>
            {effectiveQuantity > 1
              ? "أكمل اختيار كل قطعة"
              : colors.length > 0 && items[0]?.color === null
                ? "اختر لونا"
                : "اختر مقاسا"}
          </>
        ) : (
          <>اختر ولايتك</>
        )}
      </button>
      <p className="text-center text-xs text-zinc-400">
        لن تدفعوا أي شيء الآن. الدفع نقدا عند الاستلام.
      </p>
    </form>
  );
}
