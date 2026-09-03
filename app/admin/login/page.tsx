import { PackageOpen } from "lucide-react";
import { getSettings } from "@/lib/data";
import { THEME_BOOTSTRAP } from "../(panel)/theme-toggle";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion — Admin" };

export default async function LoginPage() {
  const settings = await getSettings();

  return (
    <>
      {/* La page de connexion est hors du gabarit de l'admin : elle doit poser
          le thème elle-même, sinon on passe d'un écran sombre à un formulaire
          blanc au moment de se connecter. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />

      <main className="admin-root relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
        {/* Halo d'accent : la seule couleur de l'écran, derrière la carte. Il
            reste très dilué pour ne pas concurrencer le champ de saisie. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 size-[28rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
        />

        <div className="relative w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logo_url}
                alt=""
                className="size-12 rounded-2xl border border-line bg-surface object-contain"
              />
            ) : (
              <span
                className="flex size-12 items-center justify-center rounded-2xl text-white"
                style={{
                  background:
                    "linear-gradient(140deg, var(--accent-strong), var(--accent) 55%, color-mix(in oklab, var(--accent) 70%, black))",
                }}
              >
                <PackageOpen className="size-6" />
              </span>
            )}
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                {settings.store_name}
              </h1>
              <p className="mt-1 text-sm text-ink-dim">
                Connectez-vous pour accéder à l&apos;administration
              </p>
            </div>
          </div>

          <div className="admin-card p-6 sm:p-7">
            <LoginForm />
          </div>

          <p className="mt-5 text-center text-xs text-ink-faint">
            Espace réservé — paiement à la livraison
          </p>
        </div>
      </main>
    </>
  );
}
