"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "./overlay";
import { Field, Notice, inputClass, textareaClass } from "./ui";
import { createLead, updateLead, type LeadInput } from "@/lib/crm/actions/leads";
import { JLS_TIP, KLIJENT_TIP, LEAD_IZVOR, SEKTORI, ZUPANIJE, type KlijentTip, type LeadIzvor } from "@/lib/crm/options";
import type { Lead, TeamMember } from "@/lib/crm/data";
import { cn } from "@/lib/utils";

/** Novi lead ili izmjena podataka leada. */
export function LeadForm({
  lead,
  team,
  meId,
  lockOwner,
  onClose,
  onSaved,
}: {
  lead?: Lead | null;
  team: TeamMember[];
  meId: string;
  lockOwner?: boolean;
  onClose: () => void;
  onSaved: (id: string | undefined, message?: string) => void;
}) {
  const [f, setF] = React.useState<LeadInput>({
    naziv: lead?.naziv ?? "",
    klijent_tip: lead?.klijent_tip ?? "poduzece",
    jls_tip: lead?.jls_tip ?? "opcina",
    kontakt_ime: lead?.kontakt_ime ?? "",
    email: lead?.email ?? "",
    telefon: lead?.telefon ?? "",
    oib: lead?.oib ?? "",
    zupanija: lead?.zupanija ?? "",
    izvor: lead?.izvor ?? "telefon",
    interes: lead?.interes ?? "",
    sektori: lead?.sektori ?? [],
    napomena: lead?.napomena ?? "",
    owner: lead ? lead.owner : meId,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const set = <K extends keyof LeadInput>(k: K, v: LeadInput[K]) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    start(async () => {
      const r = lead ? await updateLead(lead.id, f) : await createLead(f);
      if (!r.ok) setError(r.error);
      else {
        onSaved(lead ? lead.id : r.data, r.message);
        onClose();
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={lead ? `Uredi lead L-${lead.broj}` : "Novi lead"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Spremam…" : "Spremi"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vrsta" className="sm:col-span-2">
          <div className="flex gap-1">
            {(Object.keys(KLIJENT_TIP) as KlijentTip[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => set("klijent_tip", k)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm",
                  f.klijent_tip === k ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted hover:text-foreground",
                )}
              >
                {KLIJENT_TIP[k]}
              </button>
            ))}
          </div>
        </Field>
        <Field label={f.klijent_tip === "jls" ? "Naziv JLS-a" : "Naziv organizacije ili ime"} className="sm:col-span-2">
          <input autoFocus className={inputClass} value={f.naziv} onChange={(e) => set("naziv", e.target.value)} />
        </Field>
        {f.klijent_tip === "jls" && (
          <Field label="Vrsta JLS-a">
            <select className={inputClass} value={f.jls_tip ?? "opcina"} onChange={(e) => set("jls_tip", e.target.value as "opcina")}>
              {Object.entries(JLS_TIP).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Županija">
          <select className={inputClass} value={f.zupanija ?? ""} onChange={(e) => set("zupanija", e.target.value)}>
            <option value="">—</option>
            {ZUPANIJE.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Kontakt osoba">
          <input className={inputClass} value={f.kontakt_ime ?? ""} onChange={(e) => set("kontakt_ime", e.target.value)} />
        </Field>
        <Field label="Mobitel / telefon">
          <input className={inputClass} value={f.telefon ?? ""} onChange={(e) => set("telefon", e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input type="email" className={inputClass} value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="OIB">
          <input className={inputClass} value={f.oib ?? ""} onChange={(e) => set("oib", e.target.value)} />
        </Field>
        <Field label="Izvor">
          <select className={inputClass} value={f.izvor} onChange={(e) => set("izvor", e.target.value as LeadIzvor)}>
            {Object.entries(LEAD_IZVOR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vlasnik">
          <select
            className={inputClass}
            value={f.owner ?? ""}
            disabled={lockOwner}
            onChange={(e) => set("owner", e.target.value || null)}
          >
            <option value="">Nedodijeljen</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id === meId ? " (ja)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Interes (što traže, koji natječaj)" className="sm:col-span-2">
          <input className={inputClass} value={f.interes ?? ""} onChange={(e) => set("interes", e.target.value)} />
        </Field>
        <Field label="Sektori interesa" className="sm:col-span-2">
          <div className="flex flex-wrap gap-1">
            {SEKTORI.map((s) => {
              const on = f.sektori?.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("sektori", on ? f.sektori!.filter((x) => x !== s) : [...(f.sektori ?? []), s])}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs",
                    on ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Napomena" className="sm:col-span-2">
          <textarea rows={2} className={textareaClass} value={f.napomena ?? ""} onChange={(e) => set("napomena", e.target.value)} />
        </Field>
      </div>
      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
    </Modal>
  );
}
