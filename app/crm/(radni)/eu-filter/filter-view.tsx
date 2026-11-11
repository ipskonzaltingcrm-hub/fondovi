"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CircleHelp, FileText, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, Tabs, inputClass, selectSmClass, textareaClass } from "@/components/crm/ui";
import { saveHearsay, setHearsayStatus, type HearsayInput } from "@/lib/crm/actions/calls";
import { VERDICT, evaluate, type Candidate, type Check as CheckT } from "@/lib/crm/matching";
import { JLS_TIP, KLIJENT_TIP, SEKTORI, type KlijentTip } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";
import { fmtDate } from "@/lib/crm/format";
import type { FundingCall, Jls } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Hearsay = {
  id: string;
  program: string;
  call_id: string | null;
  call_slug?: string | null;
  izjava: string;
  izvor: string | null;
  datum: string | null;
  poveznica: string | null;
  status: "otvoreno" | "pregledano";
  created_at: string;
};
type Cand = Candidate & { slug: string | null };
type Sub = "klijent" | "natjecaj" | "programi" | "rekla";

export function FilterView({
  calls,
  clients,
  leads,
  hearsay,
  canEdit,
  callUuidBySlug,
}: {
  calls: FundingCall[];
  clients: Cand[];
  leads: Cand[];
  hearsay: Hearsay[];
  canEdit: boolean;
  callUuidBySlug: Record<string, string>;
}) {
  const [sub, setSub] = React.useState<Sub>("klijent");
  const live = calls.filter((c) => c.status !== "zatvoren");
  const openHearsay = hearsay.filter((h) => h.status === "otvoreno").length;
  return (
    <div className="space-y-4">
      <Tabs<Sub>
        value={sub}
        onChange={setSub}
        items={[
          { value: "klijent", label: "Klijent → natječaji" },
          { value: "natjecaj", label: "Natječaj → klijenti" },
          { value: "programi", label: "Programi" },
          { value: "rekla", label: "Rekla-kazala", count: openHearsay || undefined },
        ]}
      />
      {sub === "klijent" && <ClientCheck calls={live} clients={clients} leads={leads} />}
      {sub === "natjecaj" && <CallCheck calls={live} candidates={[...clients, ...leads]} />}
      {sub === "programi" && <Programs calls={calls} hearsay={hearsay} />}
      {sub === "rekla" && <Hearsays hearsay={hearsay} calls={live} canEdit={canEdit} callUuidBySlug={callUuidBySlug} />}
    </div>
  );
}

function CheckIcon({ ok }: { ok: boolean | null }) {
  if (ok === true) return <Check className="h-3.5 w-3.5 text-success" />;
  if (ok === false) return <X className="h-3.5 w-3.5 text-danger" />;
  return <CircleHelp className="h-3.5 w-3.5 text-warning" />;
}

function Checks({ checks }: { checks: CheckT[] }) {
  return (
    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
      {checks.map((c) => (
        <li key={c.text} className="inline-flex items-center gap-1 text-xs text-muted">
          <CheckIcon ok={c.ok} /> {c.text}
        </li>
      ))}
    </ul>
  );
}

function ClientCheck({ calls, clients, leads }: { calls: FundingCall[]; clients: Cand[]; leads: Cand[] }) {
  const [mode, setMode] = React.useState<"klijent" | "lead" | "brzo">(clients.length ? "klijent" : "brzo");
  const [pick, setPick] = React.useState("");
  const [quick, setQuick] = React.useState<{ tip: KlijentTip; jlsTip: "opcina" | "grad" | "zupanija"; sektori: string[]; ruralno: boolean }>({
    tip: "jls",
    jlsTip: "opcina",
    sektori: [],
    ruralno: false,
  });
  const cand = mode === "klijent" ? clients.find((c) => c.id === pick) : mode === "lead" ? leads.find((c) => c.id === pick) : null;
  const jls: Jls | null =
    mode === "brzo"
      ? {
          id: "brzo",
          naziv: "Brza provjera",
          tipKlijenta: quick.tip,
          tip: quick.tip === "jls" ? quick.jlsTip : null,
          zupanija: "",
          stanovnika: 0,
          ruralno: quick.tip === "jls" && quick.ruralno,
          lag: null,
          velicina: null,
          sektoriInteresa: quick.sektori,
          kontaktOsoba: "",
          status: "trial",
        }
      : cand?.jls ?? null;

  const results = jls
    ? calls.map((c) => ({ c, e: evaluate(c, jls) })).filter((x) => x.e.verdict !== "nije").sort((a, b) => b.e.score - a.e.score)
    : [];
  const ok = results.filter((r) => r.e.verdict === "prihvatljiv");
  const check = results.filter((r) => r.e.verdict === "provjeriti");
  // "Najviše bi pomoglo upisati": sektori koji bi otvorili najviše natječaja za koje je vrsta prijavitelja već prihvatljiva.
  const hints = jls
    ? SEKTORI.filter((s) => !jls.sektoriInteresa.includes(s))
        .map((s) => ({ s, n: results.filter((r) => r.e.verdict === "provjeriti" && r.c.sektori.includes(s)).length }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, 5)
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit p-4">
        <div className="mb-3 inline-flex rounded-md border border-border p-0.5 text-sm">
          {(
            [
              ["klijent", "Klijent"],
              ["lead", "Lead"],
              ["brzo", "Brza provjera"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => {
                setMode(k);
                setPick("");
              }}
              className={cn("rounded px-2.5 py-1", mode === k ? "bg-brand text-brand-contrast" : "text-muted hover:text-foreground")}
            >
              {l}
            </button>
          ))}
        </div>
        {mode !== "brzo" ? (
          <Field label={mode === "klijent" ? "Klijent" : "Otvoreni lead"}>
            <select className={inputClass} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Odaberi…</option>
              {(mode === "klijent" ? clients : leads).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.naziv}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="space-y-3">
            <Field label="Vrsta">
              <select className={inputClass} value={quick.tip} onChange={(e) => setQuick({ ...quick, tip: e.target.value as KlijentTip })}>
                {Object.entries(KLIJENT_TIP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            {quick.tip === "jls" && (
              <>
                <Field label="Vrsta JLS-a">
                  <select className={inputClass} value={quick.jlsTip} onChange={(e) => setQuick({ ...quick, jlsTip: e.target.value as "opcina" })}>
                    {Object.entries(JLS_TIP).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={quick.ruralno} onChange={(e) => setQuick({ ...quick, ruralno: e.target.checked })} /> Ruralno područje
                </label>
              </>
            )}
            <Field label="Sektori interesa">
              <div className="flex flex-wrap gap-1">
                {SEKTORI.map((s) => {
                  const on = quick.sektori.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setQuick({ ...quick, sektori: on ? quick.sektori.filter((x) => x !== s) : [...quick.sektori, s] })}
                      className={cn("rounded-full border px-2 py-0.5 text-xs", on ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted")}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
            <p className="text-xs text-muted">Brza provjera se ne sprema.</p>
          </div>
        )}
        {cand && (
          <div className="mt-3 space-y-1 text-sm">
            <div className="text-muted">{cand.label}</div>
            <div className="text-xs text-muted">Sektori: {cand.jls.sektoriInteresa.join(", ") || "nisu upisani"}</div>
            {cand.kind === "klijent" && (
              <div className="flex flex-col gap-1 pt-1">
                <Link href={`/crm/klijenti/${cand.id}`} className="text-brand-ink hover:underline">
                  Kartica klijenta (uredi profil)
                </Link>
                {cand.slug && (
                  <Link href={`/izvjestaj/${cand.slug}`} className="inline-flex items-center gap-1 text-brand-ink hover:underline">
                    <FileText className="h-3.5 w-3.5" /> PDF izvještaj za klijenta
                  </Link>
                )}
              </div>
            )}
            {cand.kind === "lead" && (
              <Link href={`/crm/leadovi?lead=${cand.id}`} className="text-brand-ink hover:underline">
                Otvori lead (izvještaj je interni)
              </Link>
            )}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        {!jls ? (
          <Empty title="Odaberi klijenta, lead ili brzu provjeru" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="success">Prihvatljiv · {ok.length}</Badge>
              <Badge tone="warning">Provjeriti · {check.length}</Badge>
              <span className="text-muted">od {calls.length} otvorenih natječaja i najava</span>
            </div>
            {hints.length > 0 && (
              <Notice tone="info">
                <b>Najviše bi pomoglo upisati:</b>{" "}
                {hints.map((h) => `${h.s} (+${h.n})`).join(", ")} — sektori interesa koji bi pretvorili „Provjeriti“ u prihvatljive natječaje.
              </Notice>
            )}
            {results.length === 0 ? (
              <Empty title="Nema prihvatljivih natječaja">Vrsta prijavitelja nije prihvatljiva ni za jedan otvoreni natječaj.</Empty>
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y divide-border">
                  {results.map(({ c, e }) => (
                    <li key={c.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Badge tone={VERDICT[e.verdict].tone}>{VERDICT[e.verdict].label}</Badge>
                        <Link href={`/pozivi/${c.id}`} className="min-w-0 flex-1 text-sm font-medium hover:text-brand-ink hover:underline">
                          {c.naslov}
                        </Link>
                        <span className="text-xs tabular text-muted">{e.score}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {c.davatelj} · {c.status === "najava" ? "najava" : c.rokPrijave ? `rok ${fmtDay(c.rokPrijave)}` : "bez roka"}
                      </div>
                      <Checks checks={e.checks} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CallCheck({ calls, candidates }: { calls: FundingCall[]; candidates: Cand[] }) {
  const [pick, setPick] = React.useState("");
  const call = calls.find((c) => c.id === pick);
  const rows = call
    ? candidates.map((c) => ({ c, e: evaluate(call, c.jls) })).sort((a, b) => (a.e.verdict === b.e.verdict ? b.e.score - a.e.score : a.e.verdict === "prihvatljiv" ? -1 : b.e.verdict === "prihvatljiv" ? 1 : a.e.verdict === "provjeriti" ? -1 : 1))
    : [];
  const [showAll, setShowAll] = React.useState(false);
  const visible = showAll ? rows : rows.filter((r) => r.e.verdict !== "nije");
  return (
    <div className="space-y-3">
      <Card className="p-3">
        <select className={cn(selectSmClass, "w-full")} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Odaberi natječaj…</option>
          {calls.map((c) => (
            <option key={c.id} value={c.id}>
              {c.naslov.length > 110 ? c.naslov.slice(0, 110) + "…" : c.naslov}
            </option>
          ))}
        </select>
      </Card>
      {!call ? (
        <Empty title="Odaberi natječaj" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="success">Prihvatljivo · {rows.filter((r) => r.e.verdict === "prihvatljiv").length}</Badge>
            <Badge tone="warning">Provjeriti · {rows.filter((r) => r.e.verdict === "provjeriti").length}</Badge>
            <label className="ml-auto inline-flex items-center gap-1.5 text-muted">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Prikaži i neprihvatljive
            </label>
          </div>
          {visible.length === 0 ? (
            <Empty title="Nijedan klijent ni otvoreni lead nije prihvatljiv" />
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {visible.map(({ c, e }) => (
                  <li key={`${c.kind}:${c.id}`} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge tone={VERDICT[e.verdict].tone}>{VERDICT[e.verdict].label}</Badge>
                      <Link
                        href={c.kind === "klijent" ? `/crm/klijenti/${c.id}` : `/crm/leadovi?lead=${c.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand-ink hover:underline"
                      >
                        {c.naziv}
                      </Link>
                      <span className="text-xs text-muted">{c.kind === "klijent" ? "klijent" : "lead"} · {c.label}</span>
                      <span className="w-8 text-right text-xs tabular text-muted">{e.score}</span>
                    </div>
                    <Checks checks={e.checks} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <p className="text-xs text-muted">Zadatke „Nazovi“ za odabrane radiš u kartici Natječaji (detalj natječaja).</p>
        </>
      )}
    </div>
  );
}

function Programs({ calls, hearsay }: { calls: FundingCall[]; hearsay: Hearsay[] }) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);
  const groups = new Map<string, FundingCall[]>();
  for (const c of calls) groups.set(c.program, [...(groups.get(c.program) ?? []), c]);
  const list = [...groups.entries()]
    .map(([program, cs]) => ({
      program,
      davatelj: cs[0]?.davatelj ?? "",
      otvoreno: cs.filter((c) => c.status === "otvoren").length,
      najava: cs.filter((c) => c.status === "najava").length,
      ukupno: cs.length,
      rekla: hearsay.filter((h) => h.program === program && h.status === "otvoreno").length,
      cs,
    }))
    .filter((p) => !q || `${p.program} ${p.davatelj}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.otvoreno - a.otvoreno || b.ukupno - a.ukupno);
  return (
    <div className="space-y-3">
      <input className={inputClass} placeholder="Traži program ili davatelja…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {list.map((p) => (
            <li key={p.program}>
              <button onClick={() => setOpen(open === p.program ? null : p.program)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2/60">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.program}</div>
                  <div className="truncate text-xs text-muted">{p.davatelj}</div>
                </div>
                {p.rekla > 0 && <Badge tone="danger">❗ Rekla-kazala {p.rekla}</Badge>}
                <span className="w-40 text-right text-xs text-muted">
                  {p.otvoreno} otvoreno · {p.najava} najava · {p.ukupno} ukupno
                </span>
              </button>
              {open === p.program && (
                <div className="space-y-2 bg-surface-2/40 px-4 py-3">
                  {p.cs.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-sm">
                      <Badge tone={c.status === "otvoren" ? "success" : c.status === "najava" ? "info" : "neutral"}>{c.status}</Badge>
                      <Link href={`/pozivi/${c.id}`} className="min-w-0 flex-1 truncate hover:text-brand-ink hover:underline">
                        {c.naslov}
                      </Link>
                      <span className="text-xs text-muted">{c.rokPrijave ? fmtDay(c.rokPrijave) : "—"}</span>
                    </div>
                  ))}
                  {hearsay
                    .filter((h) => h.program === p.program)
                    .map((h) => (
                      <div key={h.id} className="rounded-md border border-border bg-surface p-2 text-sm">
                        <span className="text-xs text-muted">Rekla-kazala · {h.izvor ?? "—"} · {h.datum ? fmtDay(h.datum) : fmtDate(h.created_at)}: </span>
                        {h.izjava}
                      </div>
                    ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Hearsays({
  hearsay,
  calls,
  canEdit,
  callUuidBySlug,
}: {
  hearsay: Hearsay[];
  calls: FundingCall[];
  canEdit: boolean;
  callUuidBySlug: Record<string, string>;
}) {
  const [filter, setFilter] = React.useState<"otvoreno" | "pregledano" | "sve">("otvoreno");
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const rows = hearsay.filter((h) => filter === "sve" || h.status === filter);
  const programs = [...new Set(calls.map((c) => c.program))].sort((a, b) => a.localeCompare(b, "hr"));
  return (
    <div className="space-y-3">
      {node}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectSmClass} value={filter} onChange={(e) => setFilter(e.target.value as "sve")}>
          <option value="otvoreno">Otvoreno (za provjeru)</option>
          <option value="pregledano">Pregledano</option>
          <option value="sve">Sve</option>
        </select>
        <p className="flex-1 text-xs text-muted">Neslužbene informacije s radionica i iz razgovora s posredničkim tijelima — provjeriti s objavljenim dokumentima.</p>
        {canEdit && (
          <Button size="sm" onClick={() => setEditing(true)}>
            <Plus className="h-4 w-4" /> Nova informacija
          </Button>
        )}
      </div>
      {rows.length === 0 ? (
        <Empty title="Nema zapisa" />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map((h) => (
              <li key={h.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted">
                    <b className="text-foreground">{h.program}</b> · {h.izvor ?? "izvor nije upisan"} · {h.datum ? fmtDay(h.datum) : fmtDate(h.created_at)}
                    {h.call_slug && (
                      <>
                        {" · "}
                        <Link href={`/pozivi/${h.call_slug}`} className="text-brand-ink hover:underline">
                          natječaj
                        </Link>
                      </>
                    )}
                    {h.poveznica && (
                      <>
                        {" · "}
                        <a href={h.poveznica} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">
                          poveznica
                        </a>
                      </>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{h.izjava}</p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant={h.status === "otvoreno" ? "secondary" : "ghost"}
                    disabled={pending}
                    onClick={() => start(async () => show(await setHearsayStatus(h.id, h.status === "otvoreno" ? "pregledano" : "otvoreno")))}
                  >
                    {h.status === "otvoreno" ? "Pregledano" : "Vrati na provjeru"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {editing && (
        <HearsayDialog
          programs={programs}
          calls={calls}
          callUuidBySlug={callUuidBySlug}
          onClose={() => setEditing(false)}
          onSave={(i) =>
            start(async () => {
              const r = await saveHearsay(null, i);
              show(r);
              if (r.ok) setEditing(false);
            })
          }
          pending={pending}
        />
      )}
    </div>
  );
}

function HearsayDialog({
  programs,
  calls,
  callUuidBySlug,
  onClose,
  onSave,
  pending,
}: {
  programs: string[];
  calls: FundingCall[];
  callUuidBySlug: Record<string, string>;
  onClose: () => void;
  onSave: (i: HearsayInput) => void;
  pending: boolean;
}) {
  const [f, setF] = React.useState<HearsayInput & { slug: string }>({ program: "", izjava: "", izvor: "", datum: "", poveznica: "", call_id: null, slug: "" });
  return (
    <Modal
      open
      onClose={onClose}
      title="Nova informacija (rekla-kazala)"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onSave({ ...f, call_id: f.slug ? callUuidBySlug[f.slug] ?? null : null })}>
            Spremi
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Program" className="sm:col-span-2">
          <input list="crm-programi" className={inputClass} value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} />
          <datalist id="crm-programi">
            {programs.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
        <Field label="Izjava (što je rečeno)" className="sm:col-span-2">
          <textarea rows={3} className={textareaClass} value={f.izjava} onChange={(e) => setF({ ...f, izjava: e.target.value })} />
        </Field>
        <Field label="Izvor (radionica, osoba, tijelo)">
          <input className={inputClass} value={f.izvor ?? ""} onChange={(e) => setF({ ...f, izvor: e.target.value })} />
        </Field>
        <Field label="Datum">
          <input type="date" className={inputClass} value={f.datum ?? ""} onChange={(e) => setF({ ...f, datum: e.target.value })} />
        </Field>
        <Field label="Natječaj (neobavezno)" className="sm:col-span-2">
          <select className={inputClass} value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })}>
            <option value="">—</option>
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naslov.length > 90 ? c.naslov.slice(0, 90) + "…" : c.naslov}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Poveznica" className="sm:col-span-2">
          <input className={inputClass} value={f.poveznica ?? ""} onChange={(e) => setF({ ...f, poveznica: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
