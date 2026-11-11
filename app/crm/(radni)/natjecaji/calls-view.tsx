"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CheckCheck, ExternalLink, FolderPlus, Search, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Stat, Table, Tabs, Td, Th, inputClass, selectSmClass, textareaClass } from "@/components/crm/ui";
import { createCallTasks, markCallUnread, markCallsRead, setCallMeta } from "@/lib/crm/actions/calls";
import type { TeamMember } from "@/lib/crm/data";
import { RELEVANCE, type Relevance } from "@/lib/crm/options";
import { VERDICT, type Verdict } from "@/lib/crm/matching";
import { addDays, daysBetween, fmtDay } from "@/lib/crm/dates";
import { fmtDate } from "@/lib/crm/format";
import type { StaffRole } from "@/lib/crm/roles";
import type { IngestSource } from "@/lib/types";
import { applicantLabel } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type CallMatch = { kind: "klijent" | "lead"; id: string; naziv: string; owner: string | null; label: string; score: number; verdict: Verdict };
export type CallItem = {
  id: string;
  slug: string;
  naslov: string;
  davatelj: string;
  program: string;
  status: "najava" | "otvoren" | "zatvoren";
  rok: string | null;
  createdAt: string;
  iznosMin: number | null;
  iznosMax: number | null;
  alokacija: number | null;
  intenzitet: string | null;
  prihvatljivi: string[];
  sektori: string[];
  sazetak: string | null;
  url: string;
  izvor: string | null;
  relevance: Relevance;
  autoRelevance: Relevance;
  manual: boolean;
  prioritet: boolean;
  manualPrioritet: boolean;
  archived: boolean;
  napomena: string | null;
  read: boolean;
  open: boolean;
  matches: CallMatch[];
};

type Tab = "prioritetno" | "relevantno" | "sve" | "nisko" | "arhiva" | "izvori";
type Sort = "novo" | "rok" | "relevantnost";
const REL_ORDER: Record<Relevance, number> = { visoka: 0, srednja: 1, niska: 2, nebitno: 3 };
const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function CallsView({
  items,
  team,
  sources,
  me,
  today,
  openId,
}: {
  items: CallItem[];
  team: TeamMember[];
  sources: IngestSource[];
  me: { id: string; role: StaffRole };
  today: string;
  openId: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("prioritetno");
  const [q, setQ] = React.useState("");
  const [davatelj, setDavatelj] = React.useState("");
  const [sort, setSort] = React.useState<Sort>("novo");
  const [onlyOpen, setOnlyOpen] = React.useState(true);
  const [onlyUnread, setOnlyUnread] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(openId);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const canJudge = me.role !== "suradnik";

  const live = items.filter((i) => !i.archived);
  const newCut = addDays(today, -3);
  const in14 = addDays(today, 14);
  const tiles = {
    prioritet: live.filter((i) => i.prioritet && i.open).length,
    novo: live.filter((i) => i.createdAt.slice(0, 10) >= newCut && i.relevance !== "nebitno" && i.relevance !== "niska").length,
    rok14: live.filter((i) => i.status === "otvoren" && i.rok && i.rok >= today && i.rok <= in14).length,
    neprocitano: live.filter((i) => !i.read && i.open).length,
  };
  const davatelji = [...new Set(items.map((i) => i.davatelj))].sort((a, b) => a.localeCompare(b, "hr"));

  const base: Record<Exclude<Tab, "izvori">, CallItem[]> = {
    prioritetno: live.filter((i) => i.prioritet),
    relevantno: live.filter((i) => i.relevance === "visoka" || i.relevance === "srednja"),
    sve: live,
    nisko: live.filter((i) => i.relevance === "niska" || i.relevance === "nebitno"),
    arhiva: items.filter((i) => i.archived),
  };
  const rows =
    tab === "izvori"
      ? []
      : base[tab]
          .filter((i) => {
            if (onlyOpen && !i.open && tab !== "arhiva") return false;
            if (onlyUnread && i.read) return false;
            if (davatelj && i.davatelj !== davatelj) return false;
            if (q) {
              const s = q.toLowerCase();
              if (![i.naslov, i.davatelj, i.program, i.sazetak].join(" ").toLowerCase().includes(s)) return false;
            }
            return true;
          })
          .sort((a, b) =>
            sort === "rok"
              ? (a.rok ?? "9999").localeCompare(b.rok ?? "9999")
              : sort === "relevantnost"
                ? REL_ORDER[a.relevance] - REL_ORDER[b.relevance] || b.matches.length - a.matches.length
                : b.createdAt.localeCompare(a.createdAt),
          );
  const sel = items.find((i) => i.id === selected) ?? null;

  function openCall(i: CallItem) {
    setSelected(i.id);
    if (!i.read) start(async () => void (await markCallsRead([i.id])));
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Prioritetno otvoreno" value={tiles.prioritet} />
        <Stat label="Novo relevantno" value={tiles.novo} hint="zadnja 3 dana" />
        <Stat label="Rok u idućih 14 dana" value={tiles.rok14} />
        <Stat label="Nepročitano" value={tiles.neprocitano} hint="otvoreni natječaji" />
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "prioritetno", label: "Prioritetno", count: base.prioritetno.filter((i) => i.open).length },
          { value: "relevantno", label: "Relevantno" },
          { value: "sve", label: "Sve" },
          { value: "nisko", label: "Nebitno i nisko" },
          { value: "arhiva", label: "Arhiva", count: base.arhiva.length },
          { value: "izvori", label: `Izvori${sources.some((s) => s.status === "greska") ? ` · ${sources.filter((s) => s.status === "greska").length} ne radi` : ""}` },
        ]}
      />

      {tab === "izvori" ? (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>Izvor</Th>
                <Th>Status</Th>
                <Th>Zadnje povlačenje</Th>
                <Th className="text-right">Poziva</Th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <a href={s.url} target="_blank" rel="noreferrer" className="font-medium hover:text-brand-ink hover:underline">
                      {s.naziv}
                    </a>
                    <div className="text-xs text-muted">{s.tip} · {s.prioritet}</div>
                  </Td>
                  <Td>
                    <Badge tone={s.status === "aktivan" ? "success" : s.status === "greska" ? "danger" : "neutral"}>{s.status}</Badge>
                  </Td>
                  <Td className="text-sm text-muted">{fmtDate(s.zadnjePovlacenje)}</Td>
                  <Td className="text-right tabular">{s.pozivaUkupno}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted">
            Izvore i raspored prikupljanja vodi EU Radar (stranica <Link className="text-brand-ink hover:underline" href="/izvori">Izvori</Link>).
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                <input className={cn(inputClass, "pl-8")} placeholder="Traži natječaj, davatelja, program…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className={cn(selectSmClass, "max-w-56")} value={davatelj} onChange={(e) => setDavatelj(e.target.value)}>
                <option value="">Svi davatelji</option>
                {davatelji.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <select className={selectSmClass} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="novo">Najnovije</option>
                <option value="rok">Po roku</option>
                <option value="relevantnost">Po relevantnosti</option>
              </select>
              <label className="inline-flex items-center gap-1.5 text-sm text-muted">
                <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Samo otvoreni
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm text-muted">
                <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> Samo nepročitani
              </label>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending || !rows.some((r) => !r.read)}
                onClick={() => start(async () => show(await markCallsRead(rows.filter((r) => !r.read).map((r) => r.id))))}
              >
                <CheckCheck className="h-4 w-4" /> Označi sve pročitanim
              </Button>
            </div>
          </Card>

          {rows.length === 0 ? (
            <Empty title="Nema natječaja">Promijeni karticu ili filtre.</Empty>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {rows.map((i) => {
                  const d = i.rok ? daysBetween(today, i.rok) : null;
                  const klijenti = i.matches.filter((m) => m.kind === "klijent").length;
                  const leadovi = i.matches.length - klijenti;
                  return (
                    <li key={i.id}>
                      <button onClick={() => openCall(i)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/60">
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.read ? "bg-transparent" : "bg-brand")} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {i.prioritet && <Star className="h-3.5 w-3.5 shrink-0 fill-current text-warning" />}
                            <span className={cn("truncate text-sm", !i.read && "font-semibold")}>{i.naslov}</span>
                          </div>
                          <div className="truncate text-xs text-muted">
                            {i.davatelj} · {i.program} · dodano {fmtDay(i.createdAt.slice(0, 10))}
                          </div>
                        </div>
                        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                          <Badge tone={RELEVANCE[i.relevance].tone}>{RELEVANCE[i.relevance].label}</Badge>
                          <span className="text-xs text-muted">
                            {klijenti} klij. · {leadovi} lead.
                          </span>
                        </div>
                        <span
                          className={cn(
                            "w-20 shrink-0 text-right text-xs tabular",
                            i.status === "zatvoren" || (d != null && d < 0) ? "text-muted-2" : d != null && d <= 7 ? "font-semibold text-danger" : d != null && d <= 21 ? "text-warning" : "text-muted",
                          )}
                        >
                          {i.status === "najava" ? "najava" : i.rok ? (d != null && d < 0 ? "istekao" : `rok ${fmtDay(i.rok)}`) : "bez roka"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      {sel && (
        <CallDrawer
          key={sel.id}
          call={sel}
          team={team}
          canJudge={canJudge}
          today={today}
          onClose={() => {
            setSelected(null);
            if (openId) router.replace("/crm/natjecaji");
          }}
          notify={show}
        />
      )}
    </div>
  );
}

function CallDrawer({
  call,
  team,
  canJudge,
  today,
  onClose,
  notify,
}: {
  call: CallItem;
  team: TeamMember[];
  canJudge: boolean;
  today: string;
  onClose: () => void;
  notify: (r: { ok: boolean; message?: string; error?: string }) => void;
}) {
  const [pending, start] = React.useTransition();
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [rok, setRok] = React.useState(addDays(today, 1));
  const [note, setNote] = React.useState(call.napomena ?? "");
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => notify(await fn()));
  const ownerName = (id: string | null) => team.find((t) => t.id === id)?.name ?? "—";
  const key = (m: CallMatch) => `${m.kind}:${m.id}`;
  const toggle = (m: CallMatch) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(key(m))) n.delete(key(m));
      else n.add(key(m));
      return n;
    });
  const amount =
    call.iznosMin || call.iznosMax
      ? `${call.iznosMin ? eur.format(call.iznosMin) : "—"} – ${call.iznosMax ? eur.format(call.iznosMax) : "—"}`
      : null;

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={call.naslov}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={call.status === "otvoren" ? "success" : call.status === "najava" ? "info" : "neutral"}>{call.status}</Badge>
          <Badge tone={RELEVANCE[call.relevance].tone}>
            {RELEVANCE[call.relevance].label}
            {call.manual ? " · tim" : " · auto"}
          </Badge>
          <span className="text-xs">
            {call.davatelj} · {call.rok ? `rok ${fmtDay(call.rok)}` : "bez roka"}
          </span>
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/pozivi/${call.slug}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
          <ExternalLink className="h-4 w-4" /> U EU Radaru
        </Link>
        <a href={call.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
          <ExternalLink className="h-4 w-4" /> Izvorna objava
        </a>
        <Link href={`/crm/projekti?novi=1&natjecaj=${call.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
          <FolderPlus className="h-4 w-4" /> Novi projekt
        </Link>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => markCallUnread(call.id))}>
          Označi nepročitanim
        </Button>
      </div>

      {call.sazetak && <p className="mb-4 whitespace-pre-wrap text-sm">{call.sazetak}</p>}
      <dl className="mb-5 grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted">Program</dt>
        <dd>{call.program}</dd>
        <dt className="text-muted">Tko se može prijaviti</dt>
        <dd>{call.prihvatljivi.map((p) => applicantLabel[p as keyof typeof applicantLabel] ?? p).join(", ") || "—"}</dd>
        <dt className="text-muted">Sektori</dt>
        <dd>{call.sektori.join(", ") || "—"}</dd>
        {amount && (
          <>
            <dt className="text-muted">Iznos potpore</dt>
            <dd>{amount}</dd>
          </>
        )}
        {call.alokacija && (
          <>
            <dt className="text-muted">Ukupna alokacija</dt>
            <dd>{eur.format(call.alokacija)}</dd>
          </>
        )}
        {call.intenzitet && (
          <>
            <dt className="text-muted">Intenzitet</dt>
            <dd>{call.intenzitet}</dd>
          </>
        )}
        <dt className="text-muted">Izvor</dt>
        <dd>{call.izvor || "—"}</dd>
      </dl>

      {canJudge && (
        <div className="mb-5 rounded-lg border border-border p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">Procjena tima</h3>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(RELEVANCE) as Relevance[]).map((r) => (
              <button
                key={r}
                disabled={pending}
                onClick={() => run(() => setCallMeta(call.id, { relevance: call.manual && call.relevance === r ? null : r }))}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-sm",
                  call.manual && call.relevance === r ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted hover:text-foreground",
                )}
              >
                {RELEVANCE[r].label}
              </button>
            ))}
            <button
              disabled={pending}
              onClick={() => run(() => setCallMeta(call.id, { prioritet: !call.manualPrioritet }))}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-sm",
                call.manualPrioritet ? "border-warning bg-warning-soft text-warning" : "border-border text-muted hover:text-foreground",
              )}
            >
              <Star className="h-3.5 w-3.5" /> {call.manualPrioritet ? "Prioritetno" : "Označi prioritetnim"}
            </button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setCallMeta(call.id, { archived: !call.archived }))}>
              {call.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {call.archived ? "Vrati iz arhive" : "Arhiviraj"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Automatska procjena: {RELEVANCE[call.autoRelevance].label} (prema prihvatljivim klijentima i leadovima). Ponovni klik na odabranu procjenu vraća automatsku.
          </p>
          <Field label="Napomena tima" className="mt-3">
            <textarea rows={2} className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {note !== (call.napomena ?? "") && (
            <Button size="sm" className="mt-2" disabled={pending} onClick={() => run(() => setCallMeta(call.id, { napomena: note }))}>
              Spremi napomenu
            </Button>
          )}
        </div>
      )}
      {!canJudge && call.napomena && <p className="mb-5 rounded-md bg-surface-2 p-3 text-sm">{call.napomena}</p>}

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">Prihvatljivi klijenti i leadovi · {call.matches.length}</h3>
      {call.matches.length === 0 ? (
        <p className="text-sm text-muted">Nijedan klijent ni otvoreni lead nije prihvatljiv prema profilu (vrsta prijavitelja, sektori).</p>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {call.matches.map((m) => (
              <li key={key(m)} className="flex items-center gap-3 px-3 py-2 text-sm">
                <input type="checkbox" checked={picked.has(key(m))} onChange={() => toggle(m)} className="h-4 w-4 accent-[var(--brand)]" />
                <span className="w-9 text-xs font-semibold tabular text-muted">{m.score}</span>
                <Link
                  href={m.kind === "klijent" ? `/crm/klijenti/${m.id}` : `/crm/leadovi?lead=${m.id}`}
                  className="min-w-0 flex-1 truncate hover:text-brand-ink hover:underline"
                >
                  {m.naziv}
                  <span className="text-xs text-muted"> · {m.kind === "klijent" ? "klijent" : "lead"} · {m.label}</span>
                </Link>
                <Badge tone={VERDICT[m.verdict].tone}>{VERDICT[m.verdict].label}</Badge>
                <span className="hidden w-28 truncate text-right text-xs text-muted sm:block">{ownerName(m.owner)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPicked(new Set(call.matches.map(key)))}>
              Odaberi sve
            </Button>
            <Field label="Rok zadatka">
              <input type="date" className={inputClass} value={rok} min={today} onChange={(e) => setRok(e.target.value)} />
            </Field>
            <Button
              size="sm"
              disabled={pending || picked.size === 0}
              onClick={() =>
                start(async () => {
                  const targets = call.matches
                    .filter((m) => picked.has(key(m)))
                    .map((m) => ({ kind: m.kind, id: m.id, naziv: m.naziv, owner: m.owner }));
                  const r = await createCallTasks(call.id, call.naslov, targets, rok || null);
                  notify(r);
                  if (r.ok) setPicked(new Set());
                })
              }
            >
              Napravi {picked.size || ""} {picked.size === 1 ? "zadatak" : "zadataka"} „Nazovi“
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">Zadatak dobiva vlasnik klijenta / leada (ili ti, ako vlasnika nema).</p>
        </>
      )}
    </Drawer>
  );
}
