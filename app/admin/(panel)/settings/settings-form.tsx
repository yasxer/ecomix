"use client";

import { useActionState, useCallback, useState } from "react";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { updateSettings, type SettingsFormState } from "@/app/actions/settings";
import type { Settings } from "@/lib/types";
import { WILAYAS } from "@/lib/wilayas";
import { LogoPicker } from "../logo-picker";
import { inputClass, labelClass } from "../ui";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(
    updateSettings,
    {}
  );
  const [logoBusy, setLogoBusy] = useState(false);
  // Référence stable : `LogoPicker` remonte son état dans un effet.
  const handleLogoBusy = useCallback((busy: boolean) => setLogoBusy(busy), []);

  return (
    <form
      action={action}
      className="flex flex-col gap-5 admin-card p-4 sm:p-8"
    >
      <label className={labelClass}>
        Nom affiché dans l&apos;administration
        <input
          name="store_name"
          required
          defaultValue={settings.store_name}
          className={inputClass}
        />
        <span className="text-xs font-normal text-zinc-400">
          Vos clients ne le voient pas : le nom de chaque boutique se règle dans
          l&apos;onglet Vitrine du produit.
        </span>
      </label>

      <LogoPicker currentUrl={settings.logo_url} onBusyChange={handleLogoBusy} />

      <label className={labelClass}>
        Wilaya d&apos;expédition (adresse de départ pour Yalidine)
        <select
          name="from_wilaya"
          defaultValue={settings.from_wilaya}
          className={inputClass}
        >
          {WILAYAS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-zinc-400">
          Commune à tous les produits : les colis partent tous du même endroit.
        </span>
      </label>

      {state.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="size-4" />
          Paramètres enregistrés.
        </p>
      )}

      <button
        type="submit"
        disabled={pending || logoBusy}
        className="admin-btn-primary w-full sm:w-fit"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
        Enregistrer
      </button>
    </form>
  );
}
