import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import type { ImageRatio } from "./types";

/**
 * Grave le texte d'une section dans son visuel.
 *
 * Pourquoi ici et non dans le générateur d'images : aucun modèle de génération
 * n'écrit correctement l'arabe. L'écriture arabe est liée et se lit de droite
 * à gauche ; les modèles en sortent des lettres détachées, dans le désordre,
 * ou des mots inventés. Un titre illisible sur le premier visuel d'une page de
 * vente coûte plus cher que tout ce qu'elle peut rapporter.
 *
 * Le modèle compose donc une scène vide de texte, et c'est un vrai moteur
 * typographique (Skia) qui grave le titre par-dessus : les lettres se lient,
 * l'ordre est juste, et le mélange arabe/latin — « سوار acier inoxydable » —
 * tombe au bon endroit.
 */

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

/**
 * Trois graisses statiques plutôt qu'une police variable : Skia choisit une
 * fonte par son nom, et un axe de graisse ne se pilote pas depuis `ctx.font`.
 */
const FONTS = {
  black: "TajawalBlack",
  bold: "TajawalBold",
  regular: "TajawalRegular",
} as const;

let registered = false;

/** Les polices vivent dans le processus, pas dans la requête : une seule fois. */
function registerFonts() {
  if (registered) return;
  for (const [weight, family] of Object.entries(FONTS)) {
    const file = { black: "Black", bold: "Bold", regular: "Regular" }[
      weight as keyof typeof FONTS
    ];
    GlobalFonts.register(readFileSync(path.join(FONT_DIR, `Tajawal-${file}.ttf`)), family);
  }
  registered = true;
}

/** Format du visuel composé. Portrait par défaut : c'est un écran de téléphone. */
const SIZES: Record<ImageRatio, { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1280, height: 720 },
};

/** Un seul caractère arabe suffit à basculer toute la mise en page. */
function isRtl(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(text);
}

/** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Réduit la taille d'un titre jusqu'à ce qu'il tienne en `maxLines`.
 * Un titre de six mots et un titre de deux ne peuvent pas s'écrire dans le
 * même corps sans que l'un déborde ou que l'autre flotte.
 */
function fitTitle(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  from: number,
  to: number
): { size: number; lines: string[] } {
  let size = from;
  let lines: string[] = [];
  while (size > to) {
    ctx.font = `${size}px "${FONTS.black}"`;
    lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines) break;
    size -= 4;
  }
  return { size, lines };
}

/** Pastille de puce : un rond plein aux couleurs de la boutique, coche blanche. */
function drawCheck(ctx: SKRSContext2D, x: number, y: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = radius * 0.28;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.42, y);
  ctx.lineTo(x - radius * 0.1, y + radius * 0.34);
  ctx.lineTo(x + radius * 0.45, y - radius * 0.36);
  ctx.stroke();
}

export type SectionArt = {
  /** Visuel de fond, déjà généré et sans le moindre texte. */
  background: Buffer | Uint8Array;
  title: string;
  body: string;
  bullets: string[];
  /** Couleur de la boutique, pour le filet et les puces. */
  primaryColor: string;
  ratio: ImageRatio;
};

/**
 * Compose la section finie : le visuel, un dégradé, puis le texte gravé.
 * Rend un JPEG prêt à être mis en ligne.
 */
export async function composeSection({
  background,
  title,
  body,
  bullets,
  primaryColor,
  ratio,
}: SectionArt): Promise<Buffer> {
  registerFonts();

  const { width: W, height: H } = SIZES[ratio] ?? SIZES["4:5"];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── Le visuel, recadré pour couvrir sans se déformer ──
  const image = await loadImage(background);
  const scale = Math.max(W / image.width, H / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, (W - drawWidth) / 2, (H - drawHeight) / 2, drawWidth, drawHeight);

  const rtl = isRtl(`${title} ${body}`);
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.textAlign = rtl ? "right" : "left";
  ctx.textBaseline = "alphabetic";

  const pad = Math.round(W * 0.075);
  const maxWidth = W - pad * 2;
  const anchor = rtl ? W - pad : pad;

  // ── Mesure d'abord, dessin ensuite : le dégradé doit couvrir exactement la
  //    hauteur du texte, ni plus (le produit s'assombrit) ni moins (illisible) ──
  // Deux lignes : un titre qui en prend trois se lit comme un paragraphe, et
  // la troisième finit presque toujours sur un mot orphelin.
  const { size: titleSize, lines: titleLines } = fitTitle(
    ctx,
    title,
    maxWidth,
    2,
    Math.round(W / 12),
    Math.round(W / 26)
  );
  const titleLead = titleSize * 1.28;

  const bodySize = Math.round(W / 30);
  ctx.font = `${bodySize}px "${FONTS.regular}"`;
  const bodyLines = body ? wrap(ctx, body, maxWidth) : [];
  const bodyLead = bodySize * 1.55;

  const bulletSize = Math.round(W / 31);
  const bulletRadius = Math.round(bulletSize * 0.62);
  const bulletGap = bulletRadius * 2 + Math.round(W * 0.02);
  ctx.font = `${bulletSize}px "${FONTS.bold}"`;
  const bulletLines = bullets
    .filter(Boolean)
    .map((text) => wrap(ctx, text, maxWidth - bulletGap)[0] ?? text);
  const bulletLead = bulletSize * 1.95;

  const ruleHeight = Math.round(W * 0.008);
  const blockHeight =
    ruleHeight +
    Math.round(W * 0.035) +
    titleLines.length * titleLead +
    (bodyLines.length > 0 ? Math.round(W * 0.02) + bodyLines.length * bodyLead : 0) +
    (bulletLines.length > 0 ? Math.round(W * 0.03) + bulletLines.length * bulletLead : 0);

  const blockTop = H - pad - blockHeight;

  // ── Dégradé ──
  // Il ne s'agit pas d'assombrir joliment : sous le texte, le fond doit être
  // presque noir, sinon un motif clair de la photo passe au travers d'un titre
  // blanc et le rend illisible. La transition démarre donc très haut, et
  // s'écrase vite une fois arrivée au niveau du texte.
  const fadeTop = blockTop - H * 0.45;
  const fade = ctx.createLinearGradient(0, fadeTop, 0, H);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.3, "rgba(0,0,0,0.42)");
  fade.addColorStop(0.62, "rgba(0,0,0,0.84)");
  fade.addColorStop(1, "rgba(0,0,0,0.97)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeTop, W, H - fadeTop);

  let y = blockTop;

  // Filet de marque : le seul rappel de la boutique sur un visuel que le
  // générateur d'images ne connaît pas.
  ctx.fillStyle = primaryColor;
  const ruleWidth = Math.round(W * 0.09);
  ctx.fillRect(rtl ? anchor - ruleWidth : anchor, y, ruleWidth, ruleHeight);
  y += ruleHeight + Math.round(W * 0.035);

  ctx.fillStyle = "#ffffff";
  ctx.font = `${titleSize}px "${FONTS.black}"`;
  for (const line of titleLines) {
    y += titleSize;
    ctx.fillText(line, anchor, y);
    y += titleLead - titleSize;
  }

  if (bodyLines.length > 0) {
    y += Math.round(W * 0.02);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = `${bodySize}px "${FONTS.regular}"`;
    for (const line of bodyLines) {
      y += bodySize;
      ctx.fillText(line, anchor, y);
      y += bodyLead - bodySize;
    }
  }

  if (bulletLines.length > 0) {
    y += Math.round(W * 0.03);
    ctx.font = `${bulletSize}px "${FONTS.bold}"`;
    for (const line of bulletLines) {
      y += bulletSize;
      drawCheck(
        ctx,
        rtl ? anchor - bulletRadius : anchor + bulletRadius,
        y - bulletSize * 0.32,
        bulletRadius,
        primaryColor
      );
      ctx.fillStyle = "#ffffff";
      ctx.fillText(line, rtl ? anchor - bulletGap : anchor + bulletGap, y);
      y += bulletLead - bulletSize;
    }
  }

  return canvas.encode("jpeg", 88);
}
