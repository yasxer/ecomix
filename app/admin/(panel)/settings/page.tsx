import { getSettings } from "@/lib/data";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Paramètres — Admin" };

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Paramètres</h1>
        <p className="text-sm text-zinc-500">
          Réglages communs à toutes les boutiques. Le domaine, la marque, la
          couleur et le pixel de chaque produit se règlent dans son onglet
          Vitrine.
        </p>
      </div>
      {/* La clé remonte le formulaire après un enregistrement réussi :
          l'aperçu du logo et les champs repartent des valeurs du serveur. */}
      <SettingsForm key={settings.updated_at} settings={settings} />
    </div>
  );
}
