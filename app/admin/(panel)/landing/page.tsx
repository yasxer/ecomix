import { getProduct, getSettings } from "@/lib/data";
import { LandingBuilder } from "./landing-builder";

export const dynamic = "force-dynamic";

export const metadata = { title: "Landing page — Admin" };

export default async function LandingPage() {
  const [settings, product] = await Promise.all([getSettings(), getProduct()]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Landing page</h1>
        <p className="text-sm text-zinc-500">
          Gardez la mise en page simple, ou composez votre propre page bloc par
          bloc : sections image, formulaire, galerie…
        </p>
      </div>
      <LandingBuilder
        mode={settings.landing_mode}
        blocks={settings.landing_blocks}
        theme={settings.landing_theme}
        stickyCta={settings.landing_sticky_cta}
        stickyHeader={settings.landing_sticky_header}
        product={product}
        storeName={settings.store_name}
        logoUrl={settings.logo_url}
        primaryColor={settings.primary_color}
      />
    </div>
  );
}
