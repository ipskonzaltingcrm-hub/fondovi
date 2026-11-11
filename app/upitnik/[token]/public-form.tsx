"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Notice, inputClass, textareaClass } from "@/components/crm/ui";
import { JLS_TIP, KLIJENT_TIP, SEKTORI, ZUPANIJE, type KlijentTip } from "@/lib/crm/options";
import { submitForm, type SubmitState } from "./actions";

export function PublicForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitForm.bind(null, token), null);
  const [tip, setTip] = React.useState<KlijentTip>("jls");

  if (state?.ok) {
    return (
      <div className="mt-8 rounded-lg border border-success/30 bg-success-soft p-6">
        <CheckCircle2 className="h-8 w-8 text-success" />
        <h2 className="mt-2 font-display text-xl font-semibold">Hvala, upit je zaprimljen.</h2>
        <p className="mt-1 text-sm">
          {state.matches
            ? `Prema vašem profilu EU Radar trenutno vidi ${state.matches} otvorenih natječaja na koje se možete prijaviti.`
            : "EU Radar će pratiti natječaje prema vašem profilu."}{" "}
          Naš konzultant javit će vam se u roku jednog radnog dana.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="mt-8 space-y-4 rounded-lg border border-border bg-surface p-6">
      <Field label="Tko ste?">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(KLIJENT_TIP) as KlijentTip[]).map((k) => (
            <label key={k} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${tip === k ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted"}`}>
              <input type="radio" name="klijent_tip" value={k} checked={tip === k} onChange={() => setTip(k)} className="sr-only" />
              {k === "jls" ? "Općina / grad / županija" : KLIJENT_TIP[k]}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tip === "jls" ? "Naziv JLS-a" : "Naziv organizacije"} className="sm:col-span-2">
          <input name="naziv" required maxLength={200} className={inputClass} />
        </Field>
        {tip === "jls" && (
          <Field label="Vrsta">
            <select name="jls_tip" className={inputClass} defaultValue="opcina">
              {Object.entries(JLS_TIP).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Županija">
          <select name="zupanija" className={inputClass} defaultValue="">
            <option value="">—</option>
            {ZUPANIJE.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Što vas zanima? (područja)">
        <div className="flex flex-wrap gap-1.5">
          {SEKTORI.map((s) => (
            <label key={s} className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-ink">
              <input type="checkbox" name="sektori" value={s} className="sr-only" /> {s}
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ime i prezime">
          <input name="kontakt_ime" maxLength={200} className={inputClass} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" maxLength={200} className={inputClass} />
        </Field>
        <Field label="Telefon">
          <input name="telefon" maxLength={50} className={inputClass} />
        </Field>
      </div>
      <Field label="Poruka (neobavezno)">
        <textarea name="poruka" rows={3} maxLength={2000} className={textareaClass} placeholder="npr. planiramo rekonstrukciju društvenog doma…" />
      </Field>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="privola" required className="mt-1" />
        <span>Pristajem da me IPS Konzalting kontaktira u vezi s ovim upitom.</span>
      </label>
      {state?.error && <Notice tone="danger">{state.error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Šaljem…" : "Pošalji upit"}
      </Button>
    </form>
  );
}
