import { LoginForm } from "./login-form";
import { getSettings } from "@/lib/data";
import { PackageOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion — Admin" };

export default async function LoginPage() {
  const settings = await getSettings();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logo_url}
              alt=""
              className="size-11 rounded-xl border border-zinc-200 bg-white object-contain"
            />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
              <PackageOpen className="size-5.5" />
            </span>
          )}
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">
              {settings.store_name}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              Connectez-vous pour accéder à l&apos;administration
            </p>
          </div>
        </div>

        <div className="admin-card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
