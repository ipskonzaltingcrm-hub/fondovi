"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, Tabs, Table, Td, Th, inputClass, selectSmClass, textareaClass } from "@/components/crm/ui";
import { createOffer, saveCompany, saveService, saveSetting, type ServiceInput } from "@/lib/crm/actions/offers";
import type { CompanyInfo, Offer, Service, TaskRefs } from "@/lib/crm/data";
import { JEDINICA, OFFER_STATUS, SERVICE_KATEGORIJA, type OfferStatus } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

export const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });
type Tab = "sve" | OfferStatus;

export function OffersView({
  offers,
  services,
  terms,
  company,
  refs,
  me,
  today,
  preset,
}: {
  offers: Offer[];
  services: Service[];
  terms: string;
  company: CompanyInfo;
  refs: TaskRefs;
  me: { id: string; role: StaffRole; isAdmin: boolean };
  today: string;
  preset: { jls_profile_id?: string; lead_id?: string; project_id?: string } | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("sve");
  const [q, setQ] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [creating, setCreating] = React.useState(!!preset);
  const [dialog, setDialog] = React.useState<null | "cjenik" | "uvjeti" | "tvrtka">(null);
  const { show, node } = useFlash();

  const effective = (o: Offer): OfferStatus => (o.status === "poslana" && o.vrijedi_do && o.vrijedi_do < today ? "istekla" : o.status);
  const tiles = (["nacrt", "poslana", "prihvacena", "odbijena"] as OfferStatus[]).map((s) => {
    const list = offers.filter((o) => o.status === s);
    return { s, n: list.length, sum: list.reduce((a, o) => a + Number(o.iznos_neto), 0) };
  });
  const rows = offers.filter((o) => {
    if (tab !== "sve" && effective(o) !== tab) return false;
    if (owner && o.owner !== owner) return false;
    if (q) {
      const s = q.toLowerCase();
      if (![o.broj, o.predmet, o.client?.naziv, o.lead?.naziv].join(" ").toLowerCase().includes(s)) return false;
    }
    return true;
  });
  const ownerName = (id: string | null) => {
    const m = refs.team.find((t) => t.id === id);
    return m ? m.short || m.name : "—";
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      {node}
      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <button key={t.s} onClick={() => setTab(t.s)} className="rounded-lg border border-border bg-surface p-4 text-left hover:border-brand">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-2">{OFFER_STATUS[t.s].label}</div>
              <div className="mt-1 font-display text-2xl font-bold tabular">{t.n}</div>
              <div className="text-xs text-muted">{eur.format(t.sum)} bez PDV-a</div>
            </button>
          ))}
        </div>

        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
              <input className={cn(inputClass, "pl-8")} placeholder="Traži broj, klijenta, predmet…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className={selectSmClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Svi vlasnici</option>
              {refs.team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nova ponuda
            </Button>
          </div>
        </Card>

        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "sve", label: "Sve", count: offers.length },
            ...(["nacrt", "poslana", "prihvacena", "odbijena", "istekla"] as OfferStatus[]).map((s) => ({
              value: s,
              label: OFFER_STATUS[s].label,
              count: offers.filter((o) => effective(o) === s).length,
            })),
          ]}
        />

        {rows.length === 0 ? (
          <Empty title="Nema ponuda">{offers.length ? "Promijeni filtre." : "Napravi prvu ponudu gumbom „Nova ponuda“ (ili s leada / klijenta)."}</Empty>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <thead>
                <tr>
                  <Th>Broj</Th>
                  <Th>Klijent i predmet</Th>
                  <Th>Datum</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Iznos (bez PDV-a)</Th>
                  <Th>Vlasnik</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const st = effective(o);
                  return (
                    <tr key={o.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => router.push(`/crm/ponude/${o.id}`)}>
                      <Td className="whitespace-nowrap font-medium tabular">{o.broj}</Td>
                      <Td>
                        <div className="font-medium">{o.client?.naziv ?? (o.lead ? `L-${o.lead.broj} ${o.lead.naziv}` : "—")}</div>
                        <div className="max-w-96 truncate text-xs text-muted">{o.predmet}</div>
                      </Td>
                      <Td className="whitespace-nowrap text-sm text-muted">{fmtDay(o.datum)}</Td>
                      <Td>
                        <Badge tone={OFFER_STATUS[st].tone}>{OFFER_STATUS[st].label}</Badge>
                      </Td>
                      <Td className="text-right tabular">{eur.format(Number(o.iznos_neto))}</Td>
                      <Td className="text-sm">{ownerName(o.owner)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
      </div>

      <aside className="space-y-3">
        <Card className="p-4">
          <div className="mb-2 flex items-center">
            <h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Cjenik usluga</h3>
            {me.isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => setDialog("cjenik")}>
                <Pencil className="h-3.5 w-3.5" /> Uredi
              </Button>
            )}
          </div>
          <ul className="space-y-1.5 text-sm">
            {services
              .filter((s) => s.aktivan)
              .map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span className="min-w-0 flex-1">{s.naziv}</span>
                  <span className="whitespace-nowrap text-xs tabular text-muted">
                    {s.jedinica === "postotak" ? (s.postotak != null ? `${s.postotak} %` : "% ?") : s.cijena != null ? `${eur.format(s.cijena)}/${JEDINICA[s.jedinica]}` : "cijena?"}
                  </span>
                </li>
              ))}
          </ul>
          {services.some((s) => s.aktivan && s.cijena == null && s.postotak == null) && (
            <p className="mt-2 text-xs text-warning">Neke usluge još nemaju cijenu — upisuje administrator.</p>
          )}
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex items-center">
            <h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Opći uvjeti poslovanja</h3>
            {me.isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => setDialog("uvjeti")}>
                <Pencil className="h-3.5 w-3.5" /> Uredi
              </Button>
            )}
          </div>
          <p className="line-clamp-4 whitespace-pre-wrap text-sm text-muted">{terms || "Još nisu upisani — PDF ide bez stranice s uvjetima."}</p>
        </Card>
        <Card className="p-4">
          <div className="mb-2 flex items-center">
            <h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Podaci tvrtke (PDF)</h3>
            {me.isAdmin && (
              <Button size="sm" variant="ghost" onClick={() => setDialog("tvrtka")}>
                <Pencil className="h-3.5 w-3.5" /> Uredi
              </Button>
            )}
          </div>
          <p className="text-sm">{company.naziv || "—"}</p>
          <p className="text-xs text-muted">{[company.adresa, company.oib && `OIB ${company.oib}`, company.iban].filter(Boolean).join(" · ") || "Adresa, OIB i IBAN nisu upisani."}</p>
        </Card>
        <Notice>CRM ne šalje e-mailove sam: ponudu preuzmi kao PDF i pošalji iz svoje pošte, pa je označi kao poslanu.</Notice>
      </aside>

      {creating && (
        <NewOfferDialog
          refs={refs}
          preset={preset}
          onClose={() => {
            setCreating(false);
            if (preset) router.replace("/crm/ponude");
          }}
          onCreated={(id) => router.push(`/crm/ponude/${id}`)}
        />
      )}
      {dialog === "cjenik" && <ServicesDialog services={services} onClose={() => setDialog(null)} notify={show} />}
      {dialog === "uvjeti" && <TermsDialog terms={terms} onClose={() => setDialog(null)} notify={show} />}
      {dialog === "tvrtka" && <CompanyDialog company={company} onClose={() => setDialog(null)} notify={show} />}
    </div>
  );
}

function NewOfferDialog({
  refs,
  preset,
  onClose,
  onCreated,
}: {
  refs: TaskRefs;
  preset: { jls_profile_id?: string; lead_id?: string; project_id?: string } | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [klijent, setKlijent] = React.useState(preset?.jls_profile_id ?? "");
  const [lead, setLead] = React.useState(preset?.lead_id ?? "");
  const [predmet, setPredmet] = React.useState("Ponuda za pretplatu na EU Radar");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title="Nova ponuda"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await createOffer({ predmet, jls_profile_id: klijent || null, lead_id: lead || null, project_id: preset?.project_id ?? null });
                if (!r.ok) setError(r.error);
                else if (r.data) onCreated(r.data);
              })
            }
          >
            Otvori nacrt
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Klijent">
          <select className={inputClass} value={klijent} onChange={(e) => setKlijent(e.target.value)}>
            <option value="">—</option>
            {refs.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ili lead" hint="Kad lead prihvati ponudu, sam postaje klijent.">
          <select className={inputClass} value={lead} onChange={(e) => setLead(e.target.value)}>
            <option value="">—</option>
            {refs.leads.map((l) => (
              <option key={l.id} value={l.id}>
                L-{l.broj} · {l.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Predmet">
          <input className={inputClass} value={predmet} onChange={(e) => setPredmet(e.target.value)} />
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}

function ServicesDialog({ services, onClose, notify }: { services: Service[]; onClose: () => void; notify: (r: { ok: boolean; message?: string; error?: string }) => void }) {
  const [edit, setEdit] = React.useState<Service | "nova" | null>(null);
  return (
    <Modal open onClose={onClose} title="Cjenik usluga" width="max-w-3xl">
      {edit ? (
        <ServiceForm service={edit === "nova" ? null : edit} onDone={() => setEdit(null)} notify={notify} />
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className={cn("font-medium", !s.aktivan && "text-muted line-through")}>{s.naziv}</div>
                  <div className="text-xs text-muted">{SERVICE_KATEGORIJA[s.kategorija] ?? s.kategorija}</div>
                </div>
                <span className="text-xs tabular text-muted">
                  {s.jedinica === "postotak" ? (s.postotak != null ? `${s.postotak} %` : "% ?") : s.cijena != null ? `${eur.format(s.cijena)} / ${JEDINICA[s.jedinica]}` : "bez cijene"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" className="mt-3" onClick={() => setEdit("nova")}>
            <Plus className="h-4 w-4" /> Nova usluga
          </Button>
        </>
      )}
    </Modal>
  );
}

function ServiceForm({ service, onDone, notify }: { service: Service | null; onDone: () => void; notify: (r: { ok: boolean; message?: string; error?: string }) => void }) {
  const [f, setF] = React.useState<ServiceInput>({
    naziv: service?.naziv ?? "",
    opis: service?.opis ?? "",
    kategorija: service?.kategorija ?? "ostalo",
    jedinica: service?.jedinica ?? "kom",
    cijena: service?.cijena ?? "",
    postotak: service?.postotak ?? "",
    pdv: service?.pdv ?? 25,
    aktivan: service?.aktivan ?? true,
  });
  const [pending, start] = React.useTransition();
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Naziv" className="sm:col-span-2">
          <input className={inputClass} value={f.naziv} onChange={(e) => setF({ ...f, naziv: e.target.value })} />
        </Field>
        <Field label="Opis (ide u ponudu)" className="sm:col-span-2">
          <textarea rows={2} className={textareaClass} value={f.opis ?? ""} onChange={(e) => setF({ ...f, opis: e.target.value })} />
        </Field>
        <Field label="Kategorija">
          <select className={inputClass} value={f.kategorija} onChange={(e) => setF({ ...f, kategorija: e.target.value })}>
            {Object.entries(SERVICE_KATEGORIJA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Jedinica">
          <select className={inputClass} value={f.jedinica} onChange={(e) => setF({ ...f, jedinica: e.target.value })}>
            {Object.entries(JEDINICA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {f.jedinica === "postotak" ? (
          <Field label="Postotak vrijednosti projekta (%)">
            <input type="number" step="0.01" className={inputClass} value={f.postotak ?? ""} onChange={(e) => setF({ ...f, postotak: e.target.value })} />
          </Field>
        ) : (
          <Field label="Cijena bez PDV-a (EUR)">
            <input type="number" step="0.01" className={inputClass} value={f.cijena ?? ""} onChange={(e) => setF({ ...f, cijena: e.target.value })} />
          </Field>
        )}
        <Field label="PDV (%)">
          <input type="number" step="1" className={inputClass} value={f.pdv ?? ""} onChange={(e) => setF({ ...f, pdv: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.aktivan} onChange={(e) => setF({ ...f, aktivan: e.target.checked })} /> Aktivna (nudi se u ponudama)
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Natrag
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveService(service?.id ?? null, f);
              notify(r);
              if (r.ok) onDone();
            })
          }
        >
          Spremi
        </Button>
      </div>
    </div>
  );
}

function TermsDialog({ terms, onClose, notify }: { terms: string; onClose: () => void; notify: (r: { ok: boolean; message?: string; error?: string }) => void }) {
  const [t, setT] = React.useState(terms);
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-3xl"
      title="Opći uvjeti poslovanja"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveSetting("offer_terms", { text: t });
                notify(r);
                if (r.ok) onClose();
              })
            }
          >
            Spremi
          </Button>
        </>
      }
    >
      <textarea rows={18} className={textareaClass} value={t} onChange={(e) => setT(e.target.value)} placeholder="Tekst općih uvjeta — ide kao zasebna stranica PDF-a ponude." />
    </Modal>
  );
}

function CompanyDialog({ company, onClose, notify }: { company: CompanyInfo; onClose: () => void; notify: (r: { ok: boolean; message?: string; error?: string }) => void }) {
  const [c, setC] = React.useState<CompanyInfo>(() => ({
    naziv: company.naziv ?? "",
    oib: company.oib ?? "",
    adresa: company.adresa ?? "",
    iban: company.iban ?? "",
    email: company.email ?? "",
    telefon: company.telefon ?? "",
    web: company.web ?? "",
  }));
  const [pending, start] = React.useTransition();
  const fields: [keyof CompanyInfo, string][] = [
    ["naziv", "Naziv"],
    ["oib", "OIB"],
    ["adresa", "Adresa"],
    ["iban", "IBAN"],
    ["email", "E-mail"],
    ["telefon", "Telefon"],
    ["web", "Web"],
  ];
  return (
    <Modal
      open
      onClose={onClose}
      title="Podaci tvrtke za PDF ponude"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveCompany(c);
                notify(r);
                if (r.ok) onClose();
              })
            }
          >
            Spremi
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(([k, l]) => (
          <Field key={k} label={l} className={k === "adresa" || k === "naziv" ? "sm:col-span-2" : undefined}>
            <input className={inputClass} value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
    </Modal>
  );
}
