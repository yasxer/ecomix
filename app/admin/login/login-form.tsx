"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { login, type LoginState } from "@/app/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-soft">
        Mot de passe
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="••••••••"
          className="admin-field"
        />
      </label>

      {state.error && (
        <p className="rounded-lg border border-danger/35 bg-danger-soft px-3 py-2.5 text-sm text-danger-ink">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="admin-btn-primary w-full">
        {pending && <Loader2 className="size-4 animate-spin" />}
        Se connecter
      </button>
    </form>
  );
}
