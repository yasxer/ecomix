import { LoginForm } from "./login-form";
import { getSettings } from "@/lib/data";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion — Admin" };

export default async function LoginPage() {
  const settings = await getSettings();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 p-4">
      {/* Halos décoratifs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/4 size-96 rounded-full bg-indigo-600 opacity-20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-1/4 size-96 rounded-full bg-indigo-500 opacity-10 blur-3xl"
      />
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-900/80 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur sm:p-8">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-600/40">
            <Lock className="size-6" />
          </span>
          <h1 className="text-xl font-bold text-white">{settings.store_name}</h1>
          <p className="text-sm text-zinc-400">
            Espace administrateur — connectez-vous pour continuer
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
