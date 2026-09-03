import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeDomain } from "@/lib/domain";

/**
 * Chaque produit a son domaine : c'est l'hôte de la requête qui décide quelle
 * boutique servir. La résolution elle-même se fait dans la page (`app/s/[key]`)
 * et non ici — le proxy tourne à chaque requête, y compris celles servies par
 * le CDN, et une lecture en base à cet endroit coûterait un aller-retour sur
 * tout le trafic. Ici on ne fait qu'une réécriture d'URL : `boutique.dz/` →
 * `/s/boutique.dz`, ce qui donne à chaque domaine sa propre entrée de cache.
 */
function siteKey(request: NextRequest): string {
  return normalizeDomain(request.headers.get("host") ?? "");
}

/**
 * Domaine réservé à l'administration. Optionnel : sans lui, /admin répond sur
 * tous les domaines. Avec, l'admin disparaît des domaines clients.
 */
const ADMIN_DOMAIN = process.env.ADMIN_DOMAIN
  ? normalizeDomain(process.env.ADMIN_DOMAIN)
  : null;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // `/s/...` n'existe que comme cible de réécriture : y accéder directement
  // court-circuiterait la résolution par domaine.
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    return new NextResponse(null, { status: 404 });
  }

  if (pathname.startsWith("/admin")) {
    if (ADMIN_DOMAIN && siteKey(request) !== ADMIN_DOMAIN) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Contrôle optimiste : la vérification réelle de la signature du cookie
    // se fait côté serveur (requireAdmin) dans chaque page et action admin.
    const hasSession = Boolean(request.cookies.get("admin_session")?.value);
    if (pathname === "/admin/login") {
      if (hasSession) return NextResponse.redirect(new URL("/admin", request.url));
      return NextResponse.next();
    }
    if (!hasSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Aperçu d'un produit par son slug, avant que son domaine soit branché.
  if (pathname.startsWith("/p/")) {
    return NextResponse.rewrite(
      new URL(`/s/${pathname.slice(3)}`, request.url)
    );
  }

  // Tout le reste : la boutique du domaine appelé. Les chemins autres que
  // « / » tombent sur un 404 — `app/s/[key]` n'a qu'un seul segment.
  return NextResponse.rewrite(
    new URL(`/s/${siteKey(request)}${pathname === "/" ? "" : pathname}`, request.url)
  );
}

export const config = {
  // Tout sauf les routes d'API, les fichiers internes de Next et les fichiers
  // servis depuis `public/`. Les extensions sont listées une par une plutôt
  // que « tout ce qui contient un point » : un domaine en contient toujours
  // un, et `/s/boutique.dz` doit rester filtré par le proxy.
  matcher: [
    "/((?!api|_next|_vercel|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|txt|xml|json|css|js|map|woff2?|ttf|pdf)$).*)",
  ],
};
