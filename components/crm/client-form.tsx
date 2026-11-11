"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "./overlay";
import { Field, Notice, inputClass, textareaClass } from "./ui";
import { saveClient, type ClientInput } from "@/lib/crm/actions/clients";
import { CLIENT_STATUS, JLS_TIP, KLIJENT_TIP, SEKTORI, ZUPANIJE, type ClientStatus, type KlijentTip } from "@/lib/crm/options";
import type { ClientRow, TeamMember } from "@/lib/crm/data";
import { cn } from "@/lib/utils";

/** Novi klijent ili izmjena: osnovni podaci (dijele se s EU Radarom) + CRM podaci (vlasnik, OIB, kontakt). */
export function ClientForm({
  client,
  team,
  meId,
  lockOwner,
  onClose,
}: {
  client?: ClientRow | null;
  team: TeamMember[];
  meId: string;
  lockOwner?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState<ClientInput>({
    naziv: client?.naziv ?? "",
    klijent_tip: client?.klijent_tip ?? "poduzece",
    tip: client?.tip ?? "opcina",
    zupanija: client?.zupanija ?? "",
    stanovnika: client?.stanovnika ?? "",
    ruralno: client?.ruralno ?? false,
    velicina: client?.velicina ?? "",
    sektori: client?.sektori_interesa ?? [],
    kontakt_osoba: client?.kontakt_osoba ?? "",
    status: client?.status ?? "trial",
    owner: client ? client.crm?.owner ?? "" : meId,
    oib: client?.crm?.oib ?? "",
    email: client?.crm?.email ?? "",
    telefon: client?.crm?.telefon ?? "",
    adresa: client?.crm?.adresa ?? "",
    web: client?.crm?.web ?? "",
    napomena: client?.crm?.napomena ?? "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    start(async () => {
      const r = await saveClient(client?.id ?? null, f);
      if (!r.ok) setError(r.error);
      else {
        onClose();
        if (!client && r.data) router.push(`/crm/klijenti/${r.data}`);
        else router.refresh();
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={client ? `Uredi: ${client.naziv}` : "Novi klijent"}
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
      {!client && (
        <div className="mb-3">
          <Notice>Klijent se otvara i u aplikaciji EU Radar (profil za praćenje natječaja). Češće nastaje pretvorbom leada.</Notice>
        </div>
      )}
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
        <Field label="Naziv" className="sm:col-span-2">
          <input autoFocus className={inputClass} value={f.naziv} onChange={(e) => set("naziv", e.target.value)} />
        </Field>
        {f.klijent_tip === "jls" && (
          <>
            <Field label="Vrsta JLS-a">
              <select className={inputClass} value={f.tip ?? "opcina"} onChange={(e) => set("tip", e.target.value)}>
                {Object.entries(JLS_TIP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Broj stanovnika">
              <input type="number" min={0} className={inputClass} value={f.stanovnika ?? ""} onChange={(e) => set("stanovnika", e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={!!f.ruralno} onChange={(e) => set("ruralno", e.target.checked)} /> Ruralno područje
            </label>
          </>
        )}
        {f.klijent_tip === "poduzece" && (
          <Field label="Veličina poduzeća">
            <select className={inputClass} value={f.velicina ?? ""} onChange={(e) => set("velicina", e.target.value)}>
              <option value="">—</option>
              {["mikro", "malo", "srednje", "veliko"].map((v) => (
                <option key={v} value={v}>
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
        <Field label="Status pretplate na EU Radar">
          <select className={inputClass} value={f.status} onChange={(e) => set("status", e.target.value as ClientStatus)}>
            {Object.entries(CLIENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vlasnik u timu">
          <select className={inputClass} value={f.owner ?? ""} disabled={lockOwner} onChange={(e) => set("owner", e.target.value)}>
            <option value="">—</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id === meId ? " (ja)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kontakt osoba (EU Radar)">
          <input className={inputClass} value={f.kontakt_osoba ?? ""} onChange={(e) => set("kontakt_osoba", e.target.value)} />
        </Field>
        <Field label="OIB">
          <input className={inputClass} value={f.oib ?? ""} onChange={(e) => set("oib", e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input type="email" className={inputClass} value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Telefon">
          <input className={inputClass} value={f.telefon ?? ""} onChange={(e) => set("telefon", e.target.value)} />
        </Field>
        <Field label="Web">
          <input className={inputClass} value={f.web ?? ""} onChange={(e) => set("web", e.target.value)} />
        </Field>
        <Field label="Adresa" className="sm:col-span-2">
          <input className={inputClass} value={f.adresa ?? ""} onChange={(e) => set("adresa", e.target.value)} />
        </Field>
        <Field label="Sektori interesa (za matching natječaja)" className="sm:col-span-2">
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
