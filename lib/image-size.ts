import "server-only";

/**
 * Dimensions d'une image distante, lues dans son en-tête.
 *
 * Les photos produit sont stockées sans leurs dimensions : le navigateur les
 * relevait au moment de l'upload pour les blocs image, mais une landing
 * composée côté serveur n'a personne pour le faire. Or `next/image` en a
 * besoin pour réserver la place — sans elles, la page saute à chaque photo
 * chargée.
 *
 * Seul le début du fichier est téléchargé : l'en-tête suffit, et une photo de
 * 2 Mo n'a aucune raison de traverser le réseau pour trois nombres.
 */

/** Assez pour dépasser un profil ICC ou un bloc EXIF volumineux en JPEG. */
const HEAD_BYTES = 128 * 1024;

export type ImageSize = { width: number; height: number };

export async function probeImageSize(url: string): Promise<ImageSize | null> {
  let head: Uint8Array;
  try {
    const response = await fetch(url, {
      headers: { Range: `bytes=0-${HEAD_BYTES - 1}` },
      // Une image du bucket ne change jamais de contenu : son URL est unique.
      cache: "force-cache",
    });
    if (!response.ok && response.status !== 206) return null;
    head = new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
  return readSize(head);
}

/** Lit les dimensions dans les premiers octets d'un WebP, PNG, JPEG ou GIF. */
export function readSize(b: Uint8Array): ImageSize | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u16le = (i: number) => b[i] | (b[i + 1] << 8);
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const u32be = (i: number) =>
    ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const ascii = (i: number, length: number) =>
    String.fromCharCode(...b.subarray(i, i + length));

  const ok = (width: number, height: number): ImageSize | null =>
    width > 0 && height > 0 ? { width, height } : null;

  // ── WebP : RIFF….WEBP puis un chunk qui dit comment lire la taille ──
  if (b.length > 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    // Étendu (animation, alpha, ICC) : la taille du canevas est en clair.
    if (chunk === "VP8X") return ok(u24le(24) + 1, u24le(27) + 1);
    // Sans perte : largeur et hauteur sur 14 bits chacune, empaquetées.
    if (chunk === "VP8L" && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    // Avec perte : après le code de départ 9d 01 2a du bitstream VP8.
    if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return ok(u16le(26) & 0x3fff, u16le(28) & 0x3fff);
    }
    return null;
  }

  // ── PNG : le bloc IHDR est toujours le premier ──
  if (b.length > 24 && u32be(0) === 0x89504e47) return ok(u32be(16), u32be(20));

  // ── GIF ──
  if (b.length > 10 && ascii(0, 3) === "GIF") return ok(u16le(6), u16le(8));

  // ── JPEG : parcours des marqueurs jusqu'au premier « start of frame » ──
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      // Remplissage et marqueurs sans charge utile : on avance d'un octet.
      if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        i++;
        continue;
      }
      // SOF0…SOF15, sauf DHT (C4), JPG (C8) et DAC (CC) qui partagent la plage.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return ok(u16be(i + 7), u16be(i + 5));
      }
      i += 2 + u16be(i + 2);
    }
  }

  return null;
}
