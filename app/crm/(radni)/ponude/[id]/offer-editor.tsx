"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, Check, Copy, FileText, Mail, MoreHorizontal, Plus, RotateCcw, Save, Send, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu, MenuItem, Modal, useFlash } from "@/components/crm/overlay";
import { Field, Notice, inputClass, textareaClass } from "@/components/crm/ui";
import { archiveOffer, duplicateOffer, saveOffer, setOfferStatus, type OfferHeader } from "@/lib/crm/actions/offers";
import { sendOfferEmail } from "@/lib/crm/actions/email";
import type { Offer, OfferItem, Service, TaskRefs } from "@/lib/crm/data";
import { JEDINICA, OFFER_STATUS } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";
import { fmtDateTime } from "@/lib/crm/format";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });

export type OfferMail = {
  enabled: boolean;
  defaultTo: string;
  myEmail: string;
  myName: string;
  viewedAt: string | null;
  viewCount: number;
  log: { id: number; at: string; to_email: string; subject: string; status: string; error: string | null; opened_at: string | null }[];
};
const MAIL_STATUS: Record<string, string> = {
  poslano: "poslano",
  dostavljeno: "dostavljeno",
  otvoreno: "otvoreno",
  kliknuto: "kliknuto",
  odbijeno: "odbijeno (adresa ne postoji?)",
  prituzba: "označeno kao neželjeno",
  greska: "greška",
};
const n = (v: unknown) => {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

export function OfferEditor({
  offer: o,
  items: initialItems,
  services,
  refs,
  me,
  today,
  mail,
}: {
  offer: Offer;
  items: OfferItem[];
  services: Service[];
  refs: TaskRefs;
  me: { id: string; role: StaffRole };
  today: string;
  mail: OfferMail;
}) {
  const router = useRouter();
  const draft = o.status === "nacrt";
  const [h, setH] = React.useState<OfferHeader>({
    predmet: o.predmet,
    jls_profile_id: o.jls_profile_id ?? "",
    lead_id: o.lead_id ?? "",
    project_id: o.project_id ?? "",
    owner: o.owner ?? me.id,
    datum: o.datum,
    vrijedi_do: o.vrijedi_do ?? "",
    visina_investicije: o.visina_investicije ?? "",
    rate: o.rate ?? [],
    napomene: o.napomene ?? "",
  });
  const [items, setItems] = React.useState<OfferItem[]>(initialItems);
  const [dirty, setDirty] = React.useState(false);
  const [dialog, setDialog] = React.useState<null | "send" | "reject">(null);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const setHeader = <K extends keyof OfferHeader>(k: K, v: OfferHeader[K]) => {
    setH((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };
  const setItem = (i: number, patch: Partial<OfferItem>) => {
    setItems((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setDirty(true);
  };

  const inv = n(h.visina_investicije);
  const priced = items.map((i) => {
    const cijena = i.postotak != null && String(i.postotak) !== "" ? Math.round(inv * n(i.postotak)) / 100 : n(i.cijena);
    const kol = i.postotak != null && String(i.postotak) !== "" ? 1 : n(i.kolicina);
    const iznos = Math.round(kol * cijena * 100) / 100;
    return { ...i, cijena, kolicina: kol, iznos };
  });
  const neto = priced.reduce((s, i) => s + i.iznos, 0);
  const pdv = priced.reduce((s, i) => s + Math.round(i.iznos * n(i.pdv)) / 100, 0);
  const expired = o.status === "poslana" && o.vrijedi_do && o.vrijedi_do < today;

  function addService(id: string) {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    setItems((p) => [
      ...p,
      {
        service_id: s.id,
        naziv: s.naziv,
        opis: s.opis,
        kolicina: 1,
        jedinica: s.jedinica === "postotak" ? "kom" : s.jedinica,
        cijena: s.cijena ?? 0,
        postotak: s.jedinica === "postotak" ? s.postotak ?? 0 : null,
        pdv: s.pdv,
      },
    ]);
    setDirty(true);
  }

  function save(then?: () => void) {
    start(async () => {
      const r = await saveOffer(o.id, h, items);
      show(r);
      if (r.ok) {
        setDirty(false);
        router.refresh();
        then?.();
      }
    });
  }
  const status = (s: Parameters<typeof setOfferStatus>[1], razlog?: string) =>
    start(async () => {
      const r = await setOfferStatus(o.id, s, razlog);
      show(r);
      if (r.ok) router.refresh();
    });

  const who = o.client?.naziv ?? (o.lead ? `L-${o.lead.broj} ${o.lead.naziv}` : "");

  return (
    <div className="space-y-5">
      {node}
      <Link href="/crm/ponude" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Ponude
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={OFFER_STATUS[expired ? "istekla" : o.status].tone}>{OFFER_STATUS[expired ? "istekla" : o.status].label}</Badge>
            {o.sent_at && <span className="text-xs text-muted">poslana {fmtDateTime(o.sent_at)}</span>}
            {o.accepted_at && <span className="text-xs text-muted">· prihvaćena {fmtDateTime(o.accepted_at)}</span>}
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <span className="text-muted-2">{o.broj}</span> {who}
          </h1>
          <p className="mt-1 text-sm text-muted">{o.predmet}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/crm/ponuda-pdf/${o.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium"
            onClick={(e) => {
              if (dirty) {
                e.preventDefault();
                show({ ok: false, error: "Najprije spremi promjene." });
              }
            }}
          >
            <FileText className="h-4 w-4" /> PDF
          </a>
          {draft && (
            <>
              <Button size="sm" variant="secondary" disabled={pending || !dirty} onClick={() => save()}>
                <Save className="h-4 w-4" /> Spremi
              </Button>
              <Button size="sm" disabled={pending} onClick={() => (dirty ? save(() => setDialog("send")) : setDialog("send"))}>
                <Send className="h-4 w-4" /> Pošalji
              </Button>
            </>
          )}
          {o.status === "poslana" && (
            <>
              <Button size="sm" disabled={pending} onClick={() => confirm("Ponuda je prihvaćena? Upisat će se u prodaju (i lead postaje klijent).") && status("prihvacena")}>
                <Check className="h-4 w-4" /> Prihvaćena
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setDialog("reject")}>
                <X className="h-4 w-4" /> Odbijena
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDialog("send")}>
                <Mail className="h-4 w-4" /> {mail.enabled ? "Pošalji ponovno e-mailom" : "Pošalji ponovno"}
              </Button>
            </>
          )}
          <Menu trigger={<MoreHorizontal className="h-5 w-5" />}>
            <MenuItem
              onClick={() =>
                start(async () => {
                  const r = await duplicateOffer(o.id);
                  show(r);
                  if (r.ok && r.data) router.push(`/crm/ponude/${r.data}`);
                })
              }
            >
              <Copy className="h-4 w-4" /> Kopiraj kao novi nacrt
            </MenuItem>
            {(o.status === "poslana" || o.status === "odbijena" || o.status === "istekla") && (
              <MenuItem onClick={() => status("nacrt")}>
                <RotateCcw className="h-4 w-4" /> Vrati u nacrt
              </MenuItem>
            )}
            {(o.status === "poslana" || o.status === "nacrt") && (
              <MenuItem onClick={() => status("istekla")}>
                <X className="h-4 w-4" /> Označi kao isteklu
              </MenuItem>
            )}
            {draft && (
              <MenuItem
                danger
                onClick={() =>
                  start(async () => {
                    const r = await archiveOffer(o.id);
                    show(r);
                    if (r.ok) router.push("/crm/ponude");
                  })
                }
              >
                <Archive className="h-4 w-4" /> Arhiviraj nacrt
              </MenuItem>
            )}
          </Menu>
        </div>
      </div>

      {!draft && (
        <Notice tone={o.status === "prihvacena" ? "success" : o.status === "odbijena" ? "warning" : "info"}>
          {o.status === "prihvacena"
            ? "Ponuda je prihvaćena i upisana u prodaju. Ne mijenja se — za izmjene napravi kopiju."
            : o.status === "odbijena"
              ? `Odbijena${o.razlog_odbijanja ? `: ${o.razlog_odbijanja}` : ""}. Za izmjene je vrati u nacrt ili napravi kopiju.`
              : "Poslana ponuda je zaključana. Za izmjene je vrati u nacrt (⋯) ili napravi kopiju."}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-2">Ponuda</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Predmet" className="sm:col-span-2">
                <input className={inputClass} disabled={!draft} value={h.predmet} onChange={(e) => setHeader("predmet", e.target.value)} />
              </Field>
              <Field label="Klijent">
                <select className={inputClass} disabled={!draft} value={h.jls_profile_id ?? ""} onChange={(e) => setHeader("jls_profile_id", e.target.value)}>
                  <option value="">—</option>
                  {refs.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.naziv}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ili lead">
                <select className={inputClass} disabled={!draft} value={h.lead_id ?? ""} onChange={(e) => setHeader("lead_id", e.target.value)}>
                  <option value="">—</option>
                  {refs.leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      L-{l.broj} · {l.naziv}
                    </option>
                  ))}
                  {o.lead && !refs.leads.some((l) => l.id === o.lead_id) && <option value={o.lead_id!}>L-{o.lead.broj} · {o.lead.naziv}</option>}
                </select>
              </Field>
              <Field label="Datum">
                <input type="date" className={inputClass} disabled={!draft} value={h.datum} onChange={(e) => setHeader("datum", e.target.value)} />
              </Field>
              <Field label="Vrijedi do">
                <input type="date" className={inputClass} disabled={!draft} value={h.vrijedi_do ?? ""} onChange={(e) => setHeader("vrijedi_do", e.target.value)} />
              </Field>
              <Field label="Projekt (neobavezno)">
                <select className={inputClass} disabled={!draft} value={h.project_id ?? ""} onChange={(e) => setHeader("project_id", e.target.value)}>
                  <option value="">—</option>
                  {refs.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      PR-{p.broj} · {p.naziv}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Visina investicije (EUR)" hint="Za usluge u postotku vrijednosti projekta.">
                <input type="number" step="0.01" className={inputClass} disabled={!draft} value={h.visina_investicije ?? ""} onChange={(e) => setHeader("visina_investicije", e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Usluge</h2>
              {draft && (
                <>
                  <select className="h-8 rounded-md border border-border bg-background px-2 text-sm" value="" onChange={(e) => addService(e.target.value)}>
                    <option value="">+ Iz cjenika…</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.naziv}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setItems((p) => [...p, { service_id: null, naziv: "", opis: null, kolicina: 1, jedinica: "kom", cijena: 0, postotak: null, pdv: 25 }]);
                      setDirty(true);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Slobodna stavka
                  </Button>
                </>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">Dodaj usluge iz cjenika ili slobodnu stavku.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-2">
                      <th className="px-3 py-2 text-left">Usluga</th>
                      <th className="w-20 px-2 py-2 text-right">Kol.</th>
                      <th className="w-24 px-2 py-2 text-left">Jed.</th>
                      <th className="w-32 px-2 py-2 text-right">Cijena / %</th>
                      <th className="w-16 px-2 py-2 text-right">PDV</th>
                      <th className="w-28 px-3 py-2 text-right">Iznos</th>
                      {draft && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => {
                      const pct = it.postotak != null && String(it.postotak) !== "";
                      return (
                        <tr key={i} className="border-t border-border align-top">
                          <td className="px-3 py-2">
                            <input className={cn(inputClass, "h-8")} disabled={!draft} value={it.naziv} onChange={(e) => setItem(i, { naziv: e.target.value })} placeholder="Naziv usluge" />
                            <textarea
                              rows={1}
                              className={cn(textareaClass, "mt-1 py-1 text-xs")}
                              disabled={!draft}
                              value={it.opis ?? ""}
                              onChange={(e) => setItem(i, { opis: e.target.value })}
                              placeholder="Opis (neobavezno)"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" step="0.5" className={cn(inputClass, "h-8 text-right")} disabled={!draft || pct} value={pct ? 1 : it.kolicina} onChange={(e) => setItem(i, { kolicina: n(e.target.value) })} />
                          </td>
                          <td className="px-2 py-2">
                            <select className={cn(inputClass, "h-8 px-1")} disabled={!draft || pct} value={pct ? "kom" : it.jedinica} onChange={(e) => setItem(i, { jedinica: e.target.value })}>
                              {Object.entries(JEDINICA)
                                .filter(([k]) => k !== "postotak")
                                .map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            {pct ? (
                              <div className="flex items-center gap-1">
                                <input type="number" step="0.01" className={cn(inputClass, "h-8 text-right")} disabled={!draft} value={it.postotak ?? ""} onChange={(e) => setItem(i, { postotak: n(e.target.value) })} />
                                <span className="text-xs text-muted">%</span>
                              </div>
                            ) : (
                              <input type="number" step="0.01" className={cn(inputClass, "h-8 text-right")} disabled={!draft} value={it.cijena} onChange={(e) => setItem(i, { cijena: n(e.target.value) })} />
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <input type="number" step="1" className={cn(inputClass, "h-8 text-right")} disabled={!draft} value={it.pdv} onChange={(e) => setItem(i, { pdv: n(e.target.value) })} />
                          </td>
                          <td className="px-3 py-2 text-right tabular">
                            {eur.format(priced[i].iznos)}
                            {pct && <div className="text-[11px] text-muted">{it.postotak} % od {eur.format(inv)}</div>}
                          </td>
                          {draft && (
                            <td className="py-2 pr-2">
                              <button
                                className="rounded p-1 text-muted-2 hover:text-danger"
                                title="Ukloni"
                                onClick={() => {
                                  setItems((p) => p.filter((_, j) => j !== i));
                                  setDirty(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 flex items-center">
              <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Dinamika plaćanja</h2>
              {draft && (
                <Button size="sm" variant="ghost" onClick={() => setHeader("rate", [...h.rate, { opis: "", iznos: null }])}>
                  <Plus className="h-4 w-4" /> Rata
                </Button>
              )}
            </div>
            {h.rate.length === 0 ? (
              <p className="text-sm text-muted">Bez rata (jednokratno plaćanje).</p>
            ) : (
              <ul className="space-y-2">
                {h.rate.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <input
                      className={inputClass}
                      disabled={!draft}
                      value={r.opis}
                      placeholder="npr. 30 % po potpisu ugovora"
                      onChange={(e) => setHeader("rate", h.rate.map((x, j) => (j === i ? { ...x, opis: e.target.value } : x)))}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className={cn(inputClass, "w-36 text-right")}
                      disabled={!draft}
                      value={r.iznos ?? ""}
                      placeholder="iznos €"
                      onChange={(e) => setHeader("rate", h.rate.map((x, j) => (j === i ? { ...x, iznos: e.target.value === "" ? null : n(e.target.value) } : x)))}
                    />
                    {draft && (
                      <button className="rounded p-1 text-muted-2 hover:text-danger" onClick={() => setHeader("rate", h.rate.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <Field label="Dodatne napomene (ulaze u PDF)">
              <textarea rows={3} className={textareaClass} disabled={!draft} value={h.napomene ?? ""} onChange={(e) => setHeader("napomene", e.target.value)} />
            </Field>
          </Card>
        </div>

        <aside className="space-y-3">
          <Card className="p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-2">Ukupno</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Osnovica (bez PDV-a)</dt>
                <dd className="tabular">{eur.format(neto)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">PDV</dt>
                <dd className="tabular">{eur.format(pdv)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 font-display text-lg font-bold">
                <dt>Ukupno</dt>
                <dd className="tabular">{eur.format(neto + pdv)}</dd>
              </div>
            </dl>
            {dirty && <p className="mt-2 text-xs text-warning">Ima nespremljenih promjena.</p>}
          </Card>
          <Card className="p-4">
            <Field label="Vlasnik ponude">
              <select className={inputClass} disabled={!draft} value={h.owner ?? ""} onChange={(e) => setHeader("owner", e.target.value)}>
                {refs.team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="mt-3 space-y-1 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-2">Povezano</div>
              {o.jls_profile_id && (
                <Link className="block text-brand-ink hover:underline" href={`/crm/klijenti/${o.jls_profile_id}`}>
                  Klijent: {o.client?.naziv}
                </Link>
              )}
              {o.lead_id && (
                <Link className="block text-brand-ink hover:underline" href={`/crm/leadovi?lead=${o.lead_id}`}>
                  Lead: L-{o.lead?.broj} {o.lead?.naziv}
                </Link>
              )}
              {o.project_id && (
                <Link className="block text-brand-ink hover:underline" href={`/crm/projekti/${o.project_id}`}>
                  Projekt: PR-{o.project?.broj} {o.project?.naziv}
                </Link>
              )}
              <div className="text-xs text-muted">Datum {fmtDay(o.datum)} · vrijedi do {o.vrijedi_do ? fmtDay(o.vrijedi_do) : "—"}</div>
            </div>
          </Card>
          {(mail.log.length > 0 || mail.viewedAt) && (
            <Card className="p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">E-mail</h2>
              {mail.viewedAt ? (
                <p className="mb-2 text-sm text-success">
                  Klijent je otvorio ponudu {fmtDateTime(mail.viewedAt)}
                  {mail.viewCount > 1 ? ` (otvaranja: ${mail.viewCount})` : ""}.
                </p>
              ) : (
                <p className="mb-2 text-sm text-muted">Klijent još nije otvorio poveznicu.</p>
              )}
              <ul className="space-y-1.5 text-xs">
                {mail.log.map((l) => (
                  <li key={l.id} className={cn(l.status === "greska" || l.status === "odbijeno" ? "text-danger" : "text-muted")}>
                    {fmtDateTime(l.at)} → {l.to_email} · {MAIL_STATUS[l.status] ?? l.status}
                    {l.error ? ` — ${l.error}` : ""}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      {dialog === "send" && (
        <SendDialog
          offer={o}
          who={who}
          mail={mail}
          onClose={() => setDialog(null)}
          onEmailed={(r) => {
            setDialog(null);
            show(r);
            router.refresh();
          }}
          onSent={() => {
            setDialog(null);
            status("poslana");
          }}
        />
      )}
      {dialog === "reject" && (
        <RejectDialog
          onClose={() => setDialog(null)}
          onSave={(r) => {
            setDialog(null);
            status("odbijena", r);
          }}
        />
      )}
    </div>
  );
}

function SendDialog({
  offer,
  who,
  mail,
  onClose,
  onSent,
  onEmailed,
}: {
  offer: Offer;
  who: string;
  mail: OfferMail;
  onClose: () => void;
  onSent: () => void;
  onEmailed: (r: { ok: true; message?: string } | { ok: false; error: string }) => void;
}) {
  const [mode, setMode] = React.useState<"email" | "rucno">(mail.enabled ? "email" : "rucno");
  const [to, setTo] = React.useState(mail.defaultTo);
  const [cc, setCc] = React.useState("");
  const [subject, setSubject] = React.useState(`Ponuda ${offer.broj} — ${offer.predmet}`);
  const [body, setBody] = React.useState(
    `Poštovani,\n\nu nastavku vam šaljemo ponudu ${offer.broj} (${offer.predmet}). Ponudu možete pregledati i spremiti kao PDF klikom na gumb ispod.\n\nZa sva pitanja stojimo na raspolaganju.\n\nLijep pozdrav,\n${mail.myName}`,
  );
  const [bccSelf, setBccSelf] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const manualBody = `Poštovani,\n\nu privitku vam šaljemo ponudu ${offer.broj} (${offer.predmet}).\n\nZa sva pitanja stojimo na raspolaganju.\n\nLijep pozdrav`;

  const send = () =>
    start(async () => {
      setError(null);
      const r = await sendOfferEmail(offer.id, { to, cc, subject, body, bccSelf });
      if (r.ok) onEmailed(r);
      else setError(r.error);
    });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pošalji ponudu ${offer.broj}`}
      footer={
        mode === "email" ? (
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Odustani
            </Button>
            <Button size="sm" disabled={pending || !to.trim()} onClick={send}>
              <Send className="h-4 w-4" /> {pending ? "Šaljem…" : "Pošalji e-mail"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Odustani
            </Button>
            <Button size="sm" onClick={onSent}>
              Poslano — označi kao poslanu
            </Button>
          </>
        )
      }
    >
      <div className="mb-3 flex gap-1 rounded-md bg-surface-2 p-1 text-sm">
        <button
          type="button"
          disabled={!mail.enabled}
          onClick={() => setMode("email")}
          className={cn("flex-1 rounded px-2 py-1", mode === "email" ? "bg-surface font-medium shadow-sm" : "text-muted", !mail.enabled && "opacity-50")}
        >
          E-mailom iz CRM-a
        </button>
        <button
          type="button"
          onClick={() => setMode("rucno")}
          className={cn("flex-1 rounded px-2 py-1", mode === "rucno" ? "bg-surface font-medium shadow-sm" : "text-muted")}
        >
          Iz svoje pošte
        </button>
      </div>
      {mode === "email" ? (
        <div className="space-y-3">
          <Field label="Primatelj">
            <input className={inputClass} type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="ime@primjer.hr" />
          </Field>
          <Field label="Kopija (neobavezno, odvojiti zarezom)">
            <input className={inputClass} value={cc} onChange={(e) => setCc(e.target.value)} />
          </Field>
          <Field label="Naslov">
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Poruka">
            <textarea className={textareaClass} rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bccSelf} onChange={(e) => setBccSelf(e.target.checked)} /> Pošalji kopiju i meni ({mail.myEmail})
          </label>
          <p className="text-xs text-muted">
            Šalje se s adrese ponude@radar.ips-konzalting.hr u ime „{mail.myName} | IPS Konzalting“; odgovori stižu na vaš e-mail. Poruka sadrži gumb s poveznicom na
            ponudu (pregled i PDF). Kad je klijent otvori, to se vidi na ponudi i u povijesti{who ? ` (${who})` : ""}.
          </p>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      ) : (
        <>
          {!mail.enabled && (
            <div className="mb-3">
              <Notice>Slanje e-mailom iz CRM-a uključuje se kad se u Vercel upiše RESEND_API_KEY.</Notice>
            </div>
          )}
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              <a href={`/crm/ponuda-pdf/${offer.id}`} target="_blank" rel="noreferrer" className="font-medium text-brand-ink hover:underline">
                Otvori PDF
              </a>{" "}
              i spremi ga („Ispis / Spremi PDF“).
            </li>
            <li>
              <a
                href={`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(manualBody)}`}
                className="font-medium text-brand-ink hover:underline"
              >
                Otvori e-poštu
              </a>{" "}
              s pripremljenim tekstom, priloži PDF i pošalji {who ? `(${who})` : ""} iz svoje pošte.
            </li>
            <li>Klikni „Poslano“ — ponuda postaje Poslana, a lead prelazi u status „Ponuda“.</li>
          </ol>
        </>
      )}
    </Modal>
  );
}

function RejectDialog({ onClose, onSave }: { onClose: () => void; onSave: (r: string) => void }) {
  const [r, setR] = React.useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Ponuda je odbijena"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button size="sm" onClick={() => onSave(r)}>
            Spremi
          </Button>
        </>
      }
    >
      <Field label="Razlog (neobavezno)">
        <input autoFocus className={inputClass} value={r} onChange={(e) => setR(e.target.value)} placeholder="npr. cijena, drugi konzultant, nema proračuna…" />
      </Field>
    </Modal>
  );
}
