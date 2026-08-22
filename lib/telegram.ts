import "server-only";
import type { OrderItem } from "./types";
import { formatVariants } from "./variants";

export type OrderNotification = {
  customer_name: string;
  phone: string;
  wilaya: string;
  commune: string;
  address: string | null;
  delivery_type: "domicile" | "stopdesk";
  stopdesk_name: string | null;
  packLabel: string | null;
  items: OrderItem[];
  color: string | null;
  size: string | null;
  quantity: number;
  total: number;
  productName: string;
};

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Envoie la nouvelle commande sur Telegram (bot). Ne bloque jamais la
 * commande : toute erreur est silencieuse. Nécessite TELEGRAM_BOT_TOKEN
 * et TELEGRAM_CHAT_ID dans .env.local.
 */
export async function notifyNewOrder(order: OrderNotification): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // Plusieurs destinataires possibles : ids séparés par des virgules
  const chatIds = (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!token || chatIds.length === 0) return;

  const lieu =
    order.delivery_type === "stopdesk"
      ? `Bureau (Stopdesk)${order.stopdesk_name ? ` — ${esc(order.stopdesk_name)}` : ""}`
      : `À domicile${order.address ? ` — ${esc(order.address)}` : ""}`;

  const variante = formatVariants(order);
  const text = [
    "<b>Nouvelle commande</b>",
    "",
    `<b>Client :</b> ${esc(order.customer_name)}`,
    `<b>Téléphone :</b> ${esc(order.phone)}`,
    `<b>Wilaya :</b> ${esc(order.wilaya)}`,
    `<b>Commune :</b> ${esc(order.commune)}`,
    `<b>Livraison :</b> ${lieu}`,
    `<b>Produit :</b> ${esc(order.productName)} x${order.quantity}`,
    ...(order.packLabel ? [`<b>Offre :</b> ${esc(order.packLabel)}`] : []),
    ...(variante ? [`<b>Variante :</b> ${esc(variante)}`] : []),
    `<b>Total :</b> ${order.total.toLocaleString("fr-DZ")} DA`,
  ].join("\n");

  // allSettled : un destinataire injoignable n'empêche pas les autres d'être
  // prévenus, et la notification ne doit jamais faire échouer la commande.
  await Promise.allSettled(
    chatIds.map((chat_id) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML" }),
      })
    )
  );
}
