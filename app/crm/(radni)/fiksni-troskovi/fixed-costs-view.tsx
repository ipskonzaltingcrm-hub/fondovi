"use client";

import * as React from "react";
import { MoreHorizontal, Pencil, Plus, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu, MenuItem, Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, Stat, Tabs, inputClass, textareaClass } from "@/components/crm/ui";
import { archiveFixedCost, saveFixedCost, type FixedCostInput } from "@/lib/crm/actions/system";

export type FixedCost = {
  id: string;
  naziv: string;
  kategorija: string;
  dobavljac: string | null;
  iznos: number;
  ucestalost: "mjesecno" | "kvartalno" | "polugodisnje" | "godisnje";
  od: string | null;
  do: string | null;
  dan_placanja: number | null;
  napomena: string | null;
  archived_at: string | null;
};

const KATEGORIJE: Record<string, string> = {
  najam: "Najam ureda",
  rezije: "Režije",
  telekom: "Telefon i internet",
  softver: "Softver i pretplate",
  hosting: "Hosting i domene",
  ai: "AI servisi",
  knjigovodstvo: "Knjigovodstvo",
  osiguranje: "Osiguranje",
  vozila: "Vozila",
  marketing: "Marketing",
  edukacija: "Edukacija",
  clanarine: "Članarine",
  ostalo: "Ostalo",
};
const UCESTALOST: Record<FixedCost["ucestalost"], { label: string; perMonth: number }> = {
  mjesecno: { label: "Mjesečno", perMonth: 1 },
  kvartalno: { label: "Kvartalno", perMonth: 1 / 3 },
  polugodisnje: { label: "Polugodišnje", perMonth: 1 / 6 },
  godisnje: { label: "Godišnje", perMonth: 1 / 12 },
};
const PREDLOZENO: Omit<FixedCostInput, "iznos">[] = [
  { naziv: "Najam ureda", kategorija: "najam", ucestalost: "mjesecno" },
  { naziv: "Knjigovodstveni servis", kategorija: "knjigovodstvo", ucestalost: "mjesecno" },
  { naziv: "Microsoft 365", kategorija: "softver", ucestalost: "mjesecno" },
  { naziv: "Vercel (hosting EU Radara)", kategorija: "hosting", ucestalost: "mjesecno" },
  { naziv: "Supabase (baza EU Radara)", kategorija: "hosting", ucestalost: "mjesecno" },
  { naziv: "Claude API (AI)", kategorija: "ai", ucestalost: "mjesecno" },
  { naziv: "Mobilni telefoni", kategorija: "telekom", ucestalost: "mjesecno" },
  { naziv: "Domene", kategorija: "hosting", ucestalost: "godisnje" },
  { naziv: "Osiguranje od odgovornosti", kategorija: "osiguranje", ucestalost: "godisnje" },
];
const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });
const monthly = (c: FixedCost) => Number(c.iznos) * UCESTALOST[c.ucestalost].perMonth;

export function FixedCostsView({ costs }: { costs: FixedCost[] }) {
  const [tab, setTab] = React.useState<"aktivne" | "zavrsene">("aktivne");
  const [edit, setEdit] = React.useState<FixedCost | Partial<FixedCostInput> | null>(null);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const active = costs.filter((c) => !c.archived_at);
  const rows = tab === "aktivne" ? active : costs.filter((c) => c.archived_at);
  const perMonth = active.reduce((a, c) => a + monthly(c), 0);
  const byCat = new Map<string, number>();
  for (const c of active) byCat.set(c.kategorija, (byCat.get(c.kategorija) ?? 0) + monthly(c));
  const groups = [...new Set(rows.map((c) => c.kategorija))];

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      {node}
      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Mjesečno" value={eur.format(perMonth)} />
          <Stat label="Godišnje" value={eur.format(perMonth * 12)} />
          <Stat label="Stavki" value={active.length} />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "aktivne", label: "Aktivne", count: active.length },
              { value: "zavrsene", label: "Završene", count: costs.length - active.length },
            ]}
          />
          <Button size="sm" className="ml-auto" onClick={() => setEdit({ ucestalost: "mjesecno", kategorija: "ostalo" })}>
            <Plus className="h-4 w-4" /> Nova stavka
          </Button>
        </div>
        {rows.length === 0 ? (
          <Empty title="Nema stavki">Dodaj stavku ili klikni predloženu desno.</Empty>
        ) : (
          groups.map((g) => (
            <Card key={g} className="overflow-hidden">
              <div className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-2">{KATEGORIJE[g] ?? g}</div>
              <ul className="divide-y divide-border">
                {rows
                  .filter((c) => c.kategorija === g)
                  .map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{c.naziv}</div>
                        <div className="text-xs text-muted">
                          {[c.dobavljac, UCESTALOST[c.ucestalost].label, c.dan_placanja ? `plaća se ${c.dan_placanja}. u mjesecu` : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="text-right tabular">
                        {eur.format(Number(c.iznos))}
                        {c.ucestalost !== "mjesecno" && <div className="text-xs text-muted">{eur.format(monthly(c))}/mj.</div>}
                      </div>
                      <Menu trigger={<MoreHorizontal className="h-4 w-4" />}>
                        <MenuItem onClick={() => setEdit(c)}>
                          <Pencil className="h-4 w-4" /> Uredi
                        </MenuItem>
                        <MenuItem danger={!c.archived_at} onClick={() => start(async () => show(await archiveFixedCost(c.id, !c.archived_at)))}>
                          {c.archived_at ? <RotateCcw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />} {c.archived_at ? "Vrati" : "Ukloni"}
                        </MenuItem>
                      </Menu>
                    </li>
                  ))}
              </ul>
            </Card>
          ))
        )}
      </div>
      <aside className="space-y-3">
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">Po kategorijama (mjesečno)</h3>
          {byCat.size === 0 ? (
            <p className="text-sm text-muted">—</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...byCat.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-2">
                    <span className="truncate">{KATEGORIJE[k] ?? k}</span>
                    <span className="tabular">{eur.format(v)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">Predložene stavke</h3>
          <div className="flex flex-wrap gap-1">
            {PREDLOZENO.filter((p) => !active.some((c) => c.naziv === p.naziv)).map((p) => (
              <button key={p.naziv} onClick={() => setEdit(p)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-brand hover:text-foreground">
                + {p.naziv}
              </button>
            ))}
          </div>
        </Card>
        <Notice>Plaće zaposlenika nisu ovdje (EU Radar nema evidenciju zaposlenika).</Notice>
      </aside>
      {edit && <CostDialog cost={edit} pending={pending} onClose={() => setEdit(null)} onSave={(id, c) => start(async () => { const r = await saveFixedCost(id, c); show(r); if (r.ok) setEdit(null); })} />}
    </div>
  );
}

function CostDialog({
  cost,
  pending,
  onClose,
  onSave,
}: {
  cost: FixedCost | Partial<FixedCostInput>;
  pending: boolean;
  onClose: () => void;
  onSave: (id: string | null, c: FixedCostInput) => void;
}) {
  const id = "id" in cost ? (cost.id as string) : null;
  const [f, setF] = React.useState<FixedCostInput>({
    naziv: cost.naziv ?? "",
    kategorija: cost.kategorija ?? "ostalo",
    dobavljac: cost.dobavljac ?? "",
    iznos: (cost as FixedCost).iznos ?? "",
    ucestalost: cost.ucestalost ?? "mjesecno",
    od: cost.od ?? "",
    do: cost.do ?? "",
    dan_placanja: cost.dan_placanja ?? "",
    napomena: cost.napomena ?? "",
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={id ? "Uredi trošak" : "Novi fiksni trošak"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onSave(id, f)}>
            Spremi
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Naziv" className="sm:col-span-2">
          <input className={inputClass} value={f.naziv} onChange={(e) => setF({ ...f, naziv: e.target.value })} />
        </Field>
        <Field label="Kategorija">
          <select className={inputClass} value={f.kategorija} onChange={(e) => setF({ ...f, kategorija: e.target.value })}>
            {Object.entries(KATEGORIJE).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dobavljač">
          <input className={inputClass} value={f.dobavljac ?? ""} onChange={(e) => setF({ ...f, dobavljac: e.target.value })} />
        </Field>
        <Field label="Iznos (EUR)">
          <input type="number" step="0.01" className={inputClass} value={f.iznos} onChange={(e) => setF({ ...f, iznos: e.target.value })} />
        </Field>
        <Field label="Plaća se">
          <select className={inputClass} value={f.ucestalost} onChange={(e) => setF({ ...f, ucestalost: e.target.value as FixedCostInput["ucestalost"] })}>
            {Object.entries(UCESTALOST).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Vrijedi od">
          <input type="date" className={inputClass} value={f.od ?? ""} onChange={(e) => setF({ ...f, od: e.target.value })} />
        </Field>
        <Field label="Vrijedi do">
          <input type="date" className={inputClass} value={f.do ?? ""} onChange={(e) => setF({ ...f, do: e.target.value })} />
        </Field>
        <Field label="Dan plaćanja u mjesecu">
          <input type="number" min={1} max={31} className={inputClass} value={f.dan_placanja ?? ""} onChange={(e) => setF({ ...f, dan_placanja: e.target.value })} />
        </Field>
        <Field label="Napomena" className="sm:col-span-2">
          <textarea rows={2} className={textareaClass} value={f.napomena ?? ""} onChange={(e) => setF({ ...f, napomena: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
