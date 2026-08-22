import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_DAYS = 30;

/**
 * Clé de signature des sessions admin.
 *
 * Le repli "dev-secret" n'a de sens qu'en développement : en production il
 * signerait les cookies avec une valeur écrite en clair dans ce fichier, donc
 * publique. N'importe qui pourrait forger `admin.<date>.<hmac>` et obtenir un
 * accès complet au panneau — sans même connaître le mot de passe, puisque la
 * vérification du cookie ne le consulte jamais. On échoue donc plutôt que de
 * signer avec un secret connu de tous.
 *
 * L'erreur est levée à l'appel et non au chargement du module : `next build`
 * s'exécute lui aussi avec NODE_ENV=production et n'a pas forcément accès aux
 * secrets d'exécution, la vérification ne doit pas faire échouer la
 * compilation. À l'exécution, elle ne touche que les routes admin.
 */
function secret(): string {
  const configured = process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (ou à défaut ADMIN_PASSWORD) doit être défini : sans lui les sessions admin seraient signées avec un secret public."
    );
  }
  return "dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [role, expires, signature] = parts;
  const payload = `${role}.${expires}`;
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  return role === "admin" && Number(expires) > Date.now();
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
