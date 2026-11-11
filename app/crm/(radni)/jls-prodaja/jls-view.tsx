"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, FileText, Mail, Plus, Search, Upload, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, Stat, Table, Tabs, Td, Th, inputClass, selectSmClass, textareaClass } from "@/components/crm/ui";
import { downloadCsv } from "@/components/crm/sales-detail";
import {
  addSignal,
  addTargetNote,
  convertTarget,
  createDraft,
  importTargets,
  logJlsExport,
  saveDraft,
  saveTarget,
  setDraftStatus,
  setTargetStatus,
  type TargetInput,
} from "@/lib/crm/actions/jls";
import { JLS_DRAFT_STATUS, JLS_FUNNEL, JLS_STATUS, JLS_TEMPLATES, JLS_TIP, ZUPANIJE, type JlsDraftStatus, type JlsStatus } from "@/lib/crm/options";
import { addDays, daysBetween, fmtDay } from "@/lib/crm/dates";
import { fmtDateTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export type TargetRow = {
  id: string;
  naziv: string;
  tip: "opcina" | "grad" | "zupanija";
  zupanija: string | null;
  segment: "A" | "B" | "C" | null;
  bodovi: number | null;
  lag: string | null;
  stanovnika: number | null;
  kontakt_osoba: string | null;
  email: string | null;
  telefon: string | null;
  status: JlsStatus;
  zadnji_kontakt: string | null;
  napomena: string | null;
  jls_profile_id: string | null;
};
export type Draft = { id: string; target_id: string; predlozak: string | null; naslov: string; tekst: string; status: JlsDraftStatus; sent_at: string | null; created_at: string };
export type Signal = { id: string; target_id: string | null; naslov: string; opis: string | null; url: string | null; datum: string };
export type TargetNote = { id: number; at: string; actor_name: string | null; vrsta: string; body: string; jls_target_id: string };
export type JlsCall = { id: string; slug: string; naslov: string; davatelj: string; rok_prijave: string | null; status: string; prihvatljivi: string[] };
type Tab = "nacrti" | "ciljna" | "signali" | "natjecaji" | "predlosci" | "kako";
type Notify = (r: { ok: boolean; message?: string; error?: string }) => void;

export function JlsView({
  targets,
  drafts,
  signals,
  notes,
  calls,
  budget,
  signature,
  today,
}: {
  targets: TargetRow[];
  drafts: Draft[];
  signals: Signal[];
  notes: TargetNote[];
  calls: JlsCall[];
  budget: { date: string | null; label: string };
  signature: string;
  today: string;
}) {
  const [tab, setTab] = React.useState<Tab>(drafts.some((d) => d.status === "nacrt") ? "nacrti" : "ciljna");
  const [q, setQ] = React.useState("");
  const [seg, setSeg] = React.useState("");
  const [zup, setZup] = React.useState("");
  const [status, setStatus] = React.useState<"" | JlsStatus>("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<null | "novi" | "import" | "signal" | { mail: string; template?: string; natjecaj?: string }>(null);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();

  const nacrti = drafts.filter((d) => d.status === "nacrt");
  const poslano = drafts.filter((d) => d.status === "poslano");
  const podsjetnik = poslano.filter((d) => d.sent_at && daysBetween(d.sent_at.slice(0, 10), today) >= 7);
  const odgovorili = targets.filter((t) => t.status === "odgovorio" || t.status === "sastanak").length;
  const signals8 = signals.filter((s) => s.datum >= addDays(today, -8)).length;
  const budgetDays = budget.date ? daysBetween(today, budget.date) : null;
  const name = (id: string) => targets.find((t) => t.id === id)?.naziv ?? "—";

  const rows = targets.filter((t) => {
    if (seg && t.segment !== seg) return false;
    if (zup && t.zupanija !== zup) return false;
    if (status && t.status !== status) return false;
    if (q && ![t.naziv, t.kontakt_osoba, t.email, t.lag].join(" ").toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const sel = targets.find((t) => t.id === selected) ?? null;

  function exportCsv() {
    downloadCsv(`jls-ciljna-skupina-${today}.csv`, [
      ["JLS", "Vrsta", "Županija", "Segment", "Bodovi", "LAG", "Kontakt", "E-mail", "Telefon", "Status", "Zadnji kontakt"],
      ...rows.map((t) => [t.naziv, JLS_TIP[t.tip], t.zupanija ?? "", t.segment ?? "", t.bodovi ?? "", t.lag ?? "", t.kontakt_osoba ?? "", t.email ?? "", t.telefon ?? "", JLS_STATUS[t.status].label, t.zadnji_kontakt ?? ""]),
    ]);
    void logJlsExport(rows.length);
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Nacrta za poslati" value={nacrti.length} />
        <Stat label="Poslano, čeka odgovor" value={poslano.length} hint={`${podsjetnik.length} za podsjetnik (7+ dana)`} />
        <Stat label="Odgovorili / sastanak" value={odgovorili} />
        <Stat label="Signala u 8 dana" value={signals8} />
        <Stat
          label={budget.label || "Rok proračuna"}
          value={budgetDays == null ? "—" : budgetDays >= 0 ? `${budgetDays} d` : "prošao"}
          hint={budget.date ? fmtDay(budget.date) : undefined}
        />
      </div>

      <Card className="p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">Lijevak</div>
        <div className="flex gap-1">
          {JLS_FUNNEL.map((s) => {
            const n = targets.filter((t) => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => {
                  setStatus(status === s ? "" : s);
                  setTab("ciljna");
                }}
                className={cn("flex-1 rounded-md border px-2 py-2 text-center", status === s ? "border-brand bg-brand-soft" : "border-border hover:border-brand")}
              >
                <div className="font-display text-lg font-bold tabular">{n}</div>
                <div className="text-[11px] text-muted">{JLS_STATUS[s].label}</div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "nacrti", label: "Nacrti za slanje", count: nacrti.length },
            { value: "ciljna", label: "Ciljna skupina", count: targets.length },
            { value: "signali", label: "Signali", count: signals.length },
            { value: "natjecaji", label: "Natječaji za JLS", count: calls.length },
            { value: "predlosci", label: "Predlošci" },
            { value: "kako", label: "Kako radi" },
          ]}
        />
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Izvoz (CSV)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog("import")}>
            <Upload className="h-4 w-4" /> Uvoz
          </Button>
          <Button size="sm" onClick={() => setDialog("novi")}>
            <Plus className="h-4 w-4" /> JLS
          </Button>
        </div>
      </div>

      {tab === "nacrti" &&
        (nacrti.length + poslano.length === 0 ? (
          <Empty title="Nema nacrta">Otvori JLS u Ciljnoj skupini i klikni „Novi mail“.</Empty>
        ) : (
          <div className="space-y-3">
            {[...nacrti, ...poslano].map((d) => (
              <DraftCard key={d.id} draft={d} target={targets.find((t) => t.id === d.target_id)} today={today} notify={show} />
            ))}
          </div>
        ))}

      {tab === "ciljna" && (
        <>
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                <input className={cn(inputClass, "pl-8")} placeholder="Traži JLS, kontakt, LAG…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className={selectSmClass} value={seg} onChange={(e) => setSeg(e.target.value)}>
                <option value="">Svi segmenti</option>
                {["A", "B", "C"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select className={selectSmClass} value={zup} onChange={(e) => setZup(e.target.value)}>
                <option value="">Sve županije</option>
                {ZUPANIJE.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
              <select className={selectSmClass} value={status} onChange={(e) => setStatus(e.target.value as JlsStatus)}>
                <option value="">Svi statusi</option>
                {Object.entries(JLS_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </Card>
          {rows.length === 0 ? (
            <Empty title="Ciljna skupina je prazna">Dodaj JLS gumbom „+ JLS“ ili uvezi popis (Uvoz).</Empty>
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>JLS</Th>
                    <Th>Seg.</Th>
                    <Th className="text-right">Bodovi</Th>
                    <Th>LAG</Th>
                    <Th>Kontakt osoba</Th>
                    <Th>Status</Th>
                    <Th>Zadnji kontakt</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => setSelected(t.id)}>
                      <Td>
                        <div className="font-medium">{t.naziv}</div>
                        <div className="text-xs text-muted">
                          {JLS_TIP[t.tip]} · {t.zupanija ?? "—"}
                        </div>
                      </Td>
                      <Td>{t.segment ?? "—"}</Td>
                      <Td className="text-right tabular">{t.bodovi ?? "—"}</Td>
                      <Td className="text-sm">{t.lag ?? "—"}</Td>
                      <Td className="text-sm">
                        {t.kontakt_osoba ?? "—"}
                        {t.email && <div className="text-xs text-muted">{t.email}</div>}
                      </Td>
                      <Td>
                        <Badge tone={JLS_STATUS[t.status].tone}>{JLS_STATUS[t.status].label}</Badge>
                        {t.jls_profile_id && <span className="ml-1 text-xs text-success">· klijent</span>}
                      </Td>
                      <Td className="text-sm text-muted">{t.zadnji_kontakt ? fmtDay(t.zadnji_kontakt) : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}

      {tab === "signali" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setDialog("signal")}>
              <Plus className="h-4 w-4" /> Signal
            </Button>
          </div>
          {signals.length === 0 ? (
            <Empty title="Nema signala">Signal je povod za kontakt: novi načelnik, najava projekta, objava u medijima, natječaj…</Empty>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {signals.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                    <span className="w-16 shrink-0 text-xs text-muted">{fmtDay(s.datum)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-brand-ink hover:underline">
                            {s.naslov}
                          </a>
                        ) : (
                          s.naslov
                        )}
                      </div>
                      {s.opis && <div className="text-xs text-muted">{s.opis}</div>}
                    </div>
                    {s.target_id && (
                      <button className="text-xs text-brand-ink hover:underline" onClick={() => setSelected(s.target_id)}>
                        {name(s.target_id)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {tab === "natjecaji" &&
        (calls.length === 0 ? (
          <Empty title="Nema otvorenih natječaja za JLS" />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {calls.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/crm/natjecaji?natjecaj=${c.id}`} className="font-medium hover:text-brand-ink hover:underline">
                      {c.naslov}
                    </Link>
                    <div className="text-xs text-muted">
                      {c.davatelj} · {c.status === "najava" ? "najava" : c.rok_prijave ? `rok ${fmtDay(c.rok_prijave)}` : "bez roka"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {tab === "predlosci" && (
        <div className="grid gap-3 md:grid-cols-2">
          {JLS_TEMPLATES.map((t) => (
            <Card key={t.key} className="p-4">
              <div className="font-display font-semibold">{t.label}</div>
              <div className="mt-1 text-sm font-medium">{t.naslov}</div>
              <p className="mt-2 whitespace-pre-wrap text-xs text-muted">{t.tekst}</p>
            </Card>
          ))}
          <Card className="p-4 md:col-span-2">
            <div className="font-display font-semibold">Skripta poziva (kratko)</div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Predstavljanje: IPS Konzalting, EU Radar — praćenje natječaja za JLS.</li>
              <li>Pitanje: koje projekte planirate u idućoj godini (proračun)?</li>
              <li>Vrijednost: konkretan otvoren natječaj za njihov JLS (kartica Natječaji / EU Filter).</li>
              <li>Prijedlog: 20-minutni sastanak i besplatan pregled natječaja.</li>
              <li>Zapis: poziv upiši u povijest JLS-a i postavi status.</li>
            </ol>
          </Card>
        </div>
      )}

      {tab === "kako" && (
        <Card className="space-y-2 p-4 text-sm">
          <p>1. U <b>Ciljnoj skupini</b> drži popis JLS-ova (segment, bodovi, LAG, kontakt). Popis uvezi ili dodaj ručno.</p>
          <p>2. Na JLS-u klikni <b>Novi mail</b> i odaberi predložak — nacrt se popuni nazivom JLS-a i kontaktom.</p>
          <p>3. U <b>Nacrtima</b> pregledaj tekst, <b>Kopiraj</b> ili <b>Otvori u e-pošti</b>, pošalji iz svoje pošte i postavi „Poslano“.</p>
          <p>4. Kad JLS odgovori: „Odgovorio“ ili „Sastanak dogovoren“ — status JLS-a se sam pomiče naprijed (nikad unatrag).</p>
          <p>5. Pozive i sastanke upisuj u povijest na kartici JLS-a. Kad pristane: <b>Pretvori u klijenta</b>, pa <b>Napravi ponudu</b>.</p>
          <Notice>CRM nikad ne šalje e-mailove JLS-ovima. Masovno slanje samo uz odobrenje vlasnice.</Notice>
        </Card>
      )}

      {sel && (
        <TargetDrawer
          key={sel.id}
          target={sel}
          drafts={drafts.filter((d) => d.target_id === sel.id)}
          notes={notes.filter((n) => n.jls_target_id === sel.id)}
          signals={signals.filter((s) => s.target_id === sel.id)}
          onClose={() => setSelected(null)}
          onMail={() => setDialog({ mail: sel.id })}
          notify={show}
          pending={pending}
          start={start}
        />
      )}
      {dialog === "novi" && <TargetDialog onClose={() => setDialog(null)} notify={show} />}
      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} notify={show} />}
      {dialog === "signal" && <SignalDialog targets={targets} onClose={() => setDialog(null)} notify={show} />}
      {dialog && typeof dialog === "object" && (
        <MailDialog target={targets.find((t) => t.id === dialog.mail)!} calls={calls} signature={signature} onClose={() => setDialog(null)} notify={show} />
      )}
    </div>
  );
}

function fill(text: string, t: TargetRow, natjecaj: string, potpis: string) {
  return text
    .replaceAll("{jls}", t.naziv)
    .replaceAll("{kontakt}", t.kontakt_osoba || "")
    .replaceAll("Poštovani ,", "Poštovani,")
    .replaceAll("{natjecaj}", natjecaj || "…")
    .replaceAll("{potpis}", potpis);
}

function DraftCard({ draft, target, today, notify }: { draft: Draft; target?: TargetRow; today: string; notify: Notify }) {
  const [naslov, setNaslov] = React.useState(draft.naslov);
  const [tekst, setTekst] = React.useState(draft.tekst);
  const [pending, start] = React.useTransition();
  const dirty = naslov !== draft.naslov || tekst !== draft.tekst;
  const old = draft.sent_at && daysBetween(draft.sent_at.slice(0, 10), today) >= 7;
  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-display font-semibold">{target?.naziv ?? "—"}</span>
        <Badge tone={JLS_DRAFT_STATUS[draft.status].tone}>{JLS_DRAFT_STATUS[draft.status].label}</Badge>
        {draft.sent_at && <span className="text-xs text-muted">poslano {fmtDateTime(draft.sent_at)}</span>}
        {old && draft.status === "poslano" && <Badge tone="warning">za podsjetnik</Badge>}
        <span className="ml-auto text-xs text-muted">{target?.email ?? "nema e-maila"}</span>
      </div>
      <input className={cn(inputClass, "mb-2 font-medium")} value={naslov} disabled={draft.status !== "nacrt"} onChange={(e) => setNaslov(e.target.value)} />
      <textarea rows={7} className={textareaClass} value={tekst} disabled={draft.status !== "nacrt"} onChange={(e) => setTekst(e.target.value)} />
      <div className="mt-2 flex flex-wrap gap-2">
        {dirty && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => notify(await saveDraft(draft.id, naslov, tekst)))}>
            Spremi
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(`${naslov}\n\n${tekst}`);
            notify({ ok: true, message: "Tekst je kopiran." });
          }}
        >
          <Copy className="h-4 w-4" /> Kopiraj tekst
        </Button>
        <a
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:bg-surface-2"
          href={`mailto:${target?.email ?? ""}?subject=${encodeURIComponent(naslov)}&body=${encodeURIComponent(tekst)}`}
        >
          <Mail className="h-4 w-4" /> Otvori u e-pošti
        </a>
        <div className="ml-auto flex flex-wrap gap-1">
          {draft.status === "nacrt" && (
            <Button size="sm" disabled={pending} onClick={() => start(async () => notify(await setDraftStatus(draft.id, "poslano")))}>
              Poslano
            </Button>
          )}
          {draft.status === "poslano" && (
            <>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => notify(await setDraftStatus(draft.id, "odgovorio")))}>
                Odgovorio
              </Button>
              <Button size="sm" disabled={pending} onClick={() => start(async () => notify(await setDraftStatus(draft.id, "sastanak")))}>
                Sastanak dogovoren
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => notify(await setDraftStatus(draft.id, "odbaceno")))}>
            Odbaci
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TargetDrawer({
  target: t,
  drafts,
  notes,
  signals,
  onClose,
  onMail,
  notify,
  pending,
  start,
}: {
  target: TargetRow;
  drafts: Draft[];
  notes: TargetNote[];
  signals: Signal[];
  onClose: () => void;
  onMail: () => void;
  notify: Notify;
  pending: boolean;
  start: React.TransitionStartFunction;
}) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [vrsta, setVrsta] = React.useState<"poziv" | "sastanak" | "biljeska" | "email">("poziv");
  const [body, setBody] = React.useState("");
  return (
    <Drawer
      open
      onClose={onClose}
      title={t.naziv}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={JLS_STATUS[t.status].tone}>{JLS_STATUS[t.status].label}</Badge>
          <span className="text-xs">
            {JLS_TIP[t.tip]} · {t.zupanija ?? "—"}
            {t.segment ? ` · segment ${t.segment}` : ""}
          </span>
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={onMail}>
          <Mail className="h-4 w-4" /> Novi mail
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
          Uredi
        </Button>
        {t.jls_profile_id ? (
          <>
            <Link href={`/crm/klijenti/${t.jls_profile_id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-success-soft px-3 text-sm font-medium text-success">
              <UserCheck className="h-4 w-4" /> Klijent
            </Link>
            <Link href={`/crm/ponude?nova=1&klijent=${t.jls_profile_id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
              <FileText className="h-4 w-4" /> Napravi ponudu
            </Link>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              confirm(`Otvoriti ${t.naziv} kao klijenta (i u EU Radaru)?`) &&
              start(async () => {
                const r = await convertTarget(t.id);
                notify(r);
                if (r.ok) router.refresh();
              })
            }
          >
            <UserCheck className="h-4 w-4" /> Pretvori u klijenta
          </Button>
        )}
      </div>

      <Field label="Status">
        <select className={inputClass} value={t.status} disabled={pending} onChange={(e) => start(async () => notify(await setTargetStatus(t.id, e.target.value as JlsStatus)))}>
          {Object.entries(JLS_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>

      <dl className="mt-4 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">Kontakt</dt>
        <dd>{t.kontakt_osoba ?? "—"}</dd>
        <dt className="text-muted">E-mail</dt>
        <dd>{t.email ? <a className="text-brand-ink hover:underline" href={`mailto:${t.email}`}>{t.email}</a> : "—"}</dd>
        <dt className="text-muted">Telefon</dt>
        <dd>{t.telefon ? <a className="text-brand-ink hover:underline" href={`tel:${t.telefon.replace(/\s/g, "")}`}>{t.telefon}</a> : "—"}</dd>
        <dt className="text-muted">LAG</dt>
        <dd>{t.lag ?? "—"}</dd>
        <dt className="text-muted">Stanovnika</dt>
        <dd>{t.stanovnika?.toLocaleString("hr-HR") ?? "—"}</dd>
        <dt className="text-muted">Bodovi</dt>
        <dd>{t.bodovi ?? "—"}</dd>
        <dt className="text-muted">Zadnji kontakt</dt>
        <dd>{t.zadnji_kontakt ? fmtDay(t.zadnji_kontakt) : "—"}</dd>
      </dl>
      {t.napomena && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{t.napomena}</p>}

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-2">Povijest</h3>
      <div className="rounded-lg border border-border bg-surface-2/40 p-3">
        <div className="mb-2 flex gap-1">
          {(["poziv", "sastanak", "email", "biljeska"] as const).map((v) => (
            <button key={v} onClick={() => setVrsta(v)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", vrsta === v ? "bg-brand text-brand-contrast" : "bg-surface text-muted")}>
              {v === "poziv" ? "Poziv" : v === "sastanak" ? "Sastanak" : v === "email" ? "E-mail" : "Bilješka"}
            </button>
          ))}
        </div>
        <textarea rows={2} className={textareaClass} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Što je dogovoreno?" />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={pending || !body.trim()}
            onClick={() =>
              start(async () => {
                const r = await addTargetNote(t.id, vrsta, body);
                notify(r);
                if (r.ok) setBody("");
              })
            }
          >
            Zabilježi
          </Button>
        </div>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {[
          ...notes.map((n) => ({ at: n.at, text: n.body, meta: `${n.vrsta} · ${n.actor_name ?? ""}` })),
          ...drafts.map((d) => ({ at: d.sent_at ?? d.created_at, text: d.naslov, meta: `mail · ${JLS_DRAFT_STATUS[d.status].label}` })),
          ...signals.map((s) => ({ at: s.datum, text: s.naslov, meta: "signal" })),
        ]
          .sort((a, b) => b.at.localeCompare(a.at))
          .map((x, i) => (
            <li key={i}>
              <div className="text-xs text-muted-2">
                {x.meta} · {fmtDateTime(x.at)}
              </div>
              <div className="whitespace-pre-wrap">{x.text}</div>
            </li>
          ))}
      </ul>
      {edit && <TargetDialog target={t} onClose={() => setEdit(false)} notify={notify} />}
    </Drawer>
  );
}

function TargetDialog({ target, onClose, notify }: { target?: TargetRow; onClose: () => void; notify: Notify }) {
  const [f, setF] = React.useState<TargetInput>({
    naziv: target?.naziv ?? "",
    tip: target?.tip ?? "opcina",
    zupanija: target?.zupanija ?? "",
    segment: target?.segment ?? "",
    bodovi: target?.bodovi ?? "",
    lag: target?.lag ?? "",
    stanovnika: target?.stanovnika ?? "",
    kontakt_osoba: target?.kontakt_osoba ?? "",
    email: target?.email ?? "",
    telefon: target?.telefon ?? "",
    napomena: target?.napomena ?? "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const txt = (k: keyof TargetInput, l: string, cls?: string) => (
    <Field label={l} className={cls}>
      <input className={inputClass} value={(f[k] as string | number | null | undefined) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </Field>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={target ? `Uredi: ${target.naziv}` : "Novi JLS u ciljnoj skupini"}
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
                const r = await saveTarget(target?.id ?? null, f);
                if (!r.ok) setError(r.error);
                else {
                  notify(r);
                  onClose();
                }
              })
            }
          >
            Spremi
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {txt("naziv", "Naziv", "sm:col-span-2")}
        <Field label="Vrsta">
          <select className={inputClass} value={f.tip} onChange={(e) => setF({ ...f, tip: e.target.value as "opcina" })}>
            {Object.entries(JLS_TIP).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Županija">
          <select className={inputClass} value={f.zupanija ?? ""} onChange={(e) => setF({ ...f, zupanija: e.target.value })}>
            <option value="">—</option>
            {ZUPANIJE.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Segment">
          <select className={inputClass} value={f.segment ?? ""} onChange={(e) => setF({ ...f, segment: e.target.value as "A" })}>
            <option value="">—</option>
            {["A", "B", "C"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {txt("bodovi", "Bodovi")}
        {txt("lag", "LAG")}
        {txt("stanovnika", "Stanovnika")}
        {txt("kontakt_osoba", "Kontakt osoba")}
        {txt("email", "E-mail")}
        {txt("telefon", "Telefon")}
        <Field label="Napomena" className="sm:col-span-2">
          <textarea rows={2} className={textareaClass} value={f.napomena ?? ""} onChange={(e) => setF({ ...f, napomena: e.target.value })} />
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

function ImportDialog({ onClose, notify }: { onClose: () => void; notify: Notify }) {
  const [text, setText] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title="Uvoz ciljne skupine"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            disabled={pending || !text.trim()}
            onClick={() =>
              start(async () => {
                const r = await importTargets(text);
                notify(r);
                if (r.ok) onClose();
              })
            }
          >
            Uvezi
          </Button>
        </>
      }
    >
      <p className="mb-2 text-sm text-muted">
        Zalijepi retke iz Excela (stupci odvojeni tabom ili točkom-zarezom):{" "}
        <code className="text-xs">naziv; vrsta (općina/grad/županija); županija; e-mail; kontakt osoba; telefon; segment; bodovi</code>. JLS koji već postoji (isti naziv) se preskače.
      </p>
      <textarea rows={12} className={cn(textareaClass, "font-mono text-xs")} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Općina Primjer;općina;Zadarska;nacelnik@primjer.hr;Ivo Ivić;023 000 000;A;80"} />
    </Modal>
  );
}

function SignalDialog({ targets, onClose, notify }: { targets: TargetRow[]; onClose: () => void; notify: Notify }) {
  const [t, setT] = React.useState("");
  const [naslov, setNaslov] = React.useState("");
  const [opis, setOpis] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title="Novi signal"
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
                const r = await addSignal(t || null, naslov, opis, url);
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
      <div className="space-y-3">
        <Field label="JLS (neobavezno)">
          <select className={inputClass} value={t} onChange={(e) => setT(e.target.value)}>
            <option value="">—</option>
            {targets.map((x) => (
              <option key={x.id} value={x.id}>
                {x.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Signal">
          <input className={inputClass} value={naslov} onChange={(e) => setNaslov(e.target.value)} placeholder="npr. najavljena rekonstrukcija vrtića" />
        </Field>
        <Field label="Opis">
          <textarea rows={2} className={textareaClass} value={opis} onChange={(e) => setOpis(e.target.value)} />
        </Field>
        <Field label="Poveznica">
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function MailDialog({ target, calls, signature, onClose, notify }: { target: TargetRow; calls: JlsCall[]; signature: string; onClose: () => void; notify: Notify }) {
  const [tpl, setTpl] = React.useState(JLS_TEMPLATES[0].key);
  const [natjecaj, setNatjecaj] = React.useState("");
  const t = JLS_TEMPLATES.find((x) => x.key === tpl)!;
  const [naslov, setNaslov] = React.useState(fill(t.naslov, target, "", signature));
  const [tekst, setTekst] = React.useState(fill(t.tekst, target, "", signature));
  const [pending, start] = React.useTransition();
  const apply = (key: string, nat: string) => {
    const x = JLS_TEMPLATES.find((y) => y.key === key)!;
    setNaslov(fill(x.naslov, target, nat, signature));
    setTekst(fill(x.tekst, target, nat, signature));
  };
  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={`Novi mail — ${target.naziv}`}
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
                const r = await createDraft(target.id, tpl, naslov, tekst);
                notify(r);
                if (r.ok) onClose();
              })
            }
          >
            Spremi nacrt
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Predložak">
            <select
              className={inputClass}
              value={tpl}
              onChange={(e) => {
                setTpl(e.target.value);
                apply(e.target.value, natjecaj);
              }}
            >
              {JLS_TEMPLATES.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
          </Field>
          {tpl === "natjecaj" && (
            <Field label="Natječaj">
              <select
                className={inputClass}
                value={natjecaj}
                onChange={(e) => {
                  setNatjecaj(e.target.value);
                  apply(tpl, e.target.value);
                }}
              >
                <option value="">—</option>
                {calls.map((c) => (
                  <option key={c.id} value={c.naslov}>
                    {c.naslov.length > 70 ? c.naslov.slice(0, 70) + "…" : c.naslov}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Naslov">
          <input className={inputClass} value={naslov} onChange={(e) => setNaslov(e.target.value)} />
        </Field>
        <Field label="Tekst">
          <textarea rows={12} className={textareaClass} value={tekst} onChange={(e) => setTekst(e.target.value)} />
        </Field>
        {!target.email && <Notice tone="warning">Ovaj JLS nema upisan e-mail.</Notice>}
      </div>
    </Modal>
  );
}
