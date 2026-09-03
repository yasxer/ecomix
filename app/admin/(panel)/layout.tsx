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
    <div className="flex min-h-screen bg-white">
      <Sidebar storeName={settings.store_name} logoUrl={settings.logo_url} />

      {/*
        Mobile : `pt-16` laisse la place à l'en-tête fixe, et la marge basse
        additionne la hauteur de la navigation et l'encoche iPhone — sans quoi
        le dernier bouton d'une page se retrouve dessous.
      */}
      <main className="min-w-0 flex-1 px-4 pb-28 pt-20 sm:px-8 sm:pb-12 sm:pt-10">
        <div className="pb-safe">{children}</div>
      </main>
    </div>
  );
}
