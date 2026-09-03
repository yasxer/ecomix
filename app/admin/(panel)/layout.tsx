import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { Sidebar } from "./sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }
  const settings = await getSettings();

  return (
    <div className="flex min-h-screen bg-[#f6f7fb]">
      <Sidebar storeName={settings.store_name} logoUrl={settings.logo_url} />

      {/*
        Mobile : `pt-16` laisse la place à l'en-tête fixe, et la marge basse
        additionne la hauteur de la navigation flottante et l'encoche iPhone —
        sans quoi le dernier bouton d'une page se retrouve dessous.
      */}
      <main className="min-w-0 flex-1 px-4 pb-32 pt-20 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8">
        <div className="pb-safe">{children}</div>
      </main>
    </div>
  );
}
