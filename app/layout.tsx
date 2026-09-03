import type { Metadata } from "next";
import { Geist, Geist_Mono, Tajawal } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Geist n'a aucun glyphe arabe : sans cette police, tout texte arabe — la
 * moitié des landings — tombait sur la police par défaut du système, qui varie
 * d'un téléphone à l'autre et casse la mise en page.
 *
 * C'est aussi la police des visuels composés (`lib/compose-section.ts`) :
 * un titre gravé dans l'image et un titre en HTML ne doivent pas se répondre
 * dans deux caractères différents.
 *
 * Elle n'est pas appliquée seule : elle vient après Geist dans la pile, et le
 * navigateur choisit caractère par caractère. Le latin reste donc en Geist,
 * l'arabe passe en Tajawal, sans avoir à savoir d'avance dans quelle langue un
 * champ a été rempli.
 */
const tajawal = Tajawal({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Boutique",
  description: "Boutique en ligne — paiement à la livraison",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Le thème de l'admin est posé sur `<html>` par un script avant
      // l'hydratation : sans cela React signale l'attribut en trop à chaque
      // chargement d'une page d'administration.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${tajawal.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
