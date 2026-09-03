import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Masque le badge "N" (dev tools) qui chevauche la navigation mobile
  devIndicators: false,
  images: {
    // Images produit/logo servies depuis Supabase Storage, optimisées
    // (WebP/AVIF + redimensionnement) par Next à la volée
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  /**
   * Skia est un binaire natif : le bundler ne sait pas le placer dans un
   * module ES, et la compilation échoue s'il essaie. Chargé par `require` à
   * l'exécution, comme n'importe quelle dépendance Node.
   */
  serverExternalPackages: ["@napi-rs/canvas"],

  /**
   * Les polices arabes sont lues sur le disque par le compositeur d'images
   * (`lib/compose-section.ts`), jamais importées : sans cette règle, le
   * traçage des fichiers ne les embarquerait pas et la composition
   * échouerait en production.
   */
  outputFileTracingIncludes: {
    "/admin/**": ["./assets/fonts/**"],
  },
  experimental: {
    serverActions: {
      // Upload d'images produit/logo via Server Actions (5 Mo par image)
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
