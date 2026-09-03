import { notFound } from "next/navigation";
import { getProductById } from "@/lib/data";
import { VitrineForm } from "./vitrine-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Vitrine — Admin" };

export default async function VitrinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const product = await getProductById((await params).id);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Le domaine, la marque et le pixel de cette boutique. Chaque produit a
        les siens : rien n&apos;est partagé entre deux domaines.
      </p>
      {/* La clé remonte le formulaire après un enregistrement réussi :
          l'aperçu du logo et les champs repartent des valeurs du serveur. */}
      <VitrineForm key={product.updated_at} product={product} />
    </div>
  );
}
