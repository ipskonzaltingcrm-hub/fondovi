"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { createKlijent, type KlijentFormState } from "@/app/(app)/klijenti/novi/actions";
import type { KlijentTip } from "@/lib/types";

const SEKTORI = [
  "Energetika",
  "Zgrade",
  "Okoliš",
  "Komunalno",
  "Promet",
  "Digitalizacija",
  "Obrazovanje",
  "Socijalna skrb",
  "Turizam",
  "Ribarstvo",
  "More",
  "Ruralni razvoj",
  "Urbani razvoj",
];

const input =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-ring/30";
const lbl = "mb-1.5 block text-sm font-medium";

export function KlijentForm() {
  const [state, action, pending] = useActionState<KlijentFormState, FormData>(
    createKlijent,
    {},
  );
  const [tip, setTip] = React.useState<KlijentTip>("jls");

  return (
    <form action={action} className="max-w-2xl space-y-5">
      {/* Vrsta klijenta */}
      <div>
        <label className={lbl}>Vrsta klijenta</label>
        <div className="flex flex-wrap gap-2">
          {([
            ["jls", "JLS (grad/općina/županija)"],
            ["poduzece", "Poduzeće"],
            ["institucija", "Institucija"],
          ] as [KlijentTip, string][]).map(([v, label]) => (
            <label
              key={v}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${
                tip === v
                  ? "border-brand bg-brand-soft text-brand-ink"
                  : "border-border hover:bg-surface-2"
              }`}
            >
              <input
                type="radio"
                name="tipKlijenta"
                value={v}
                checked={tip === v}
                onChange={() => setTip(v)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="naziv" className={lbl}>
          Naziv *
        </label>
        <input id="naziv" name="naziv" required className={input} placeholder="npr. Grad Primjer / Primjer d.o.o." />
      </div>

      {/* JLS-specifično */}
      {tip === "jls" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="tip" className={lbl}>Tip JLS-a</label>
            <select id="tip" name="tip" className={input} defaultValue="opcina">
              <option value="grad">Grad</option>
              <option value="opcina">Općina</option>
              <option value="zupanija">Županija</option>
            </select>
          </div>
          <div>
            <label htmlFor="stanovnika" className={lbl}>Stanovnika</label>
            <input id="stanovnika" name="stanovnika" type="number" min="0" className={input} placeholder="npr. 15000" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="ruralno" className="h-4 w-4" /> Ruralno područje
          </label>
        </div>
      )}

      {/* Poduzeće-specifično */}
      {tip === "poduzece" && (
        <div>
          <label htmlFor="velicina" className={lbl}>Veličina poduzeća</label>
          <select id="velicina" name="velicina" className={input} defaultValue="malo">
            <option value="mikro">Mikro</option>
            <option value="malo">Malo</option>
            <option value="srednje">Srednje</option>
            <option value="veliko">Veliko</option>
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="zupanija" className={lbl}>
            {tip === "jls" ? "Županija" : "Sjedište (županija/grad)"}
          </label>
          <input id="zupanija" name="zupanija" className={input} placeholder="npr. Grad Zagreb" />
        </div>
        <div>
          <label htmlFor="kontakt" className={lbl}>Kontakt osoba</label>
          <input id="kontakt" name="kontakt" className={input} placeholder="Ime i prezime" />
        </div>
      </div>

      {/* Sektori interesa */}
      <div>
        <label className={lbl}>Sektori interesa</label>
        <div className="flex flex-wrap gap-2">
          {SEKTORI.map((s) => (
            <label
              key={s}
              className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand-ink"
            >
              <input type="checkbox" name="sektori" value={s} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-2">
          Koristi se za rangiranje natječaja po podudarnosti s profilom klijenta.
        </p>
      </div>

      <div>
        <label htmlFor="status" className={lbl}>Status pretplate</label>
        <select id="status" name="status" className={`${input} max-w-xs`} defaultValue="trial">
          <option value="trial">Trial</option>
          <option value="aktivan">Aktivan</option>
          <option value="pauziran">Pauziran</option>
        </select>
      </div>

      {state.error && (
        <p className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-5 text-sm font-semibold text-brand-contrast transition-colors hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Spremam…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Spremi klijenta
            </>
          )}
        </button>
        <a href="/klijenti" className="text-sm font-medium text-muted hover:text-foreground">
          Odustani
        </a>
      </div>
    </form>
  );
}
