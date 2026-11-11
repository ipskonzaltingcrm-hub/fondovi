"use client";

import * as React from "react";
import { Download, Plus, Target, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, useFlash } from "@/components/crm/overlay";
import { DetailDialog, downloadCsv } from "@/components/crm/sales-detail";
import { Field, Notice, inputClass, selectSmClass, textareaClass } from "@/components/crm/ui";
import { addSale, deleteWeekEntry, logExport, saveTarget, saveWeekEntry, type SaleInput, type WeekEntryInput } from "@/lib/crm/actions/sales";
import type { ClientOption, Service, TeamMember } from "@/lib/crm/data";
import { METRICS, type MetricKey } from "@/lib/crm/options";
import { byMemberWeek, eurFmt, isoWeekNo, lastWeeks, sumCells, weekMonth, type Cell, type SalesEvent } from "@/lib/crm/sales";
import { addDays, fmtDay, weekStart } from "@/lib/crm/dates";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

type Target = { mjesec: string; member: string | null; iznos: number };
const MONTHS = ["sij", "velj", "ožu", "tra", "svi", "lip", "srp", "kol", "ruj", "lis", "stu", "pro"];

export function SalesView({
  events,
  team,
  services,
  clients,
  targets,
  me,
  today,
}: {
  events: SalesEvent[];
  team: TeamMember[];
  services: Service[];
  clients: ClientOption[];
  targets: Target[];
  me: { id: string; role: StaffRole; isAdmin: boolean };
  today: string;
}) {
  const [mode, setMode] = React.useState<"tjedno" | "mjesecno">("tjedno");
  const [metric, setMetric] = React.useState<MetricKey>("total");
  const [dialog, setDialog] = React.useState<null | "sale" | "week" | "targets">(null);
  const [detail, setDetail] = React.useState<{ title: string; cell: Cell } | null>(null);
  const { show, node } = useFlash();
  const canEnter = me.role !== "suradnik";

  const grid = byMemberWeek(events);
  const members = me.isAdmin ? team : team.filter((t) => t.id === me.id);
  const money = METRICS.find((m) => m.key === metric)?.money;
  const fmt = (v: number) => (money ? eurFmt.format(v) : String(v));
  const weeks = lastWeeks(today, 8);
  const year = today.slice(0, 4);
  const months = Array.from({ length: Number(today.slice(5, 7)) }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const cellsFor = (memberId: string | null, pred: (ws: string) => boolean): (Cell | undefined)[] => {
    const keys = memberId === null ? [...grid.keys()] : [memberId];
    return keys.flatMap((k) => [...(grid.get(k)?.entries() ?? [])].filter(([ws]) => pred(ws)).map(([, c]) => c));
  };
  const periods =
    mode === "tjedno"
      ? weeks.map((ws) => ({ key: ws, label: `T${isoWeekNo(ws)}`, sub: fmtDay(ws), pred: (w: string) => w === ws }))
      : months.map((m) => ({ key: m, label: MONTHS[Number(m.slice(5)) - 1], sub: m.slice(0, 4), pred: (w: string) => weekMonth(w) === m }));
  const rows = [
    ...members.map((t) => ({ id: t.id as string | null, name: t.short || t.name })),
    ...(me.isAdmin ? [{ id: null as string | null, name: "Tim" }] : []),
  ];
  const manualWeek = (ws: string) => [...grid.values()].some((m) => m.get(ws)?.manual);

  function exportCsv() {
    const header = ["Član", ...periods.map((p) => `${p.label} ${p.sub}`), "Ukupno"];
    const body = rows.map((r) => {
      const vals = periods.map((p) => sumCells(cellsFor(r.id, p.pred))[metric]);
      return [r.name, ...vals, vals.reduce((a, b) => a + b, 0)];
    });
    downloadCsv(`prodaja-${metric}-${mode}-${today}.csv`, [header, ...body]);
    void logExport("crm_sales", `Prodajni monitoring (${mode}, ${metric}), CSV`);
  }

  // Mjesečni pregled: ukupno / nova / stara po mjesecu + po usluzi (godina)
  const yearCells = cellsFor(me.isAdmin ? null : me.id, (w) => weekMonth(w).startsWith(year));
  const byService = new Map<string, number>();
  for (const e of events) if ((e.kind === "ugovoreno" || e.kind === "stara") && e.at.startsWith(year) && (me.isAdmin || e.member === me.id)) {
    const svc = services.find((s) => s.id === (e.meta?.service_id as string | undefined))?.naziv ?? (e.label ?? "").split(" · ")[0];
    byService.set(svc, (byService.get(svc) ?? 0) + Number(e.iznos ?? 0));
  }
  const monthTotals = months.map((m) => sumCells(cellsFor(me.isAdmin ? null : me.id, (w) => weekMonth(w) === m)));
  const maxMonth = Math.max(1, ...monthTotals.map((c) => c.total));
  const curMonth = today.slice(0, 7);
  const teamTarget = targets.find((t) => t.mjesec.slice(0, 7) === curMonth && t.member === null)?.iznos;

  return (
    <div className="space-y-4">
      {node}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
            {(["tjedno", "mjesecno"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("rounded px-3 py-1", mode === m ? "bg-brand text-brand-contrast" : "text-muted hover:text-foreground")}>
                {m === "tjedno" ? "Tjedno" : "Mjesečno"}
              </button>
            ))}
          </div>
          <select className={selectSmClass} value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <div className="ml-auto flex flex-wrap gap-2">
            {canEnter && (
              <>
                <Button size="sm" onClick={() => setDialog("sale")}>
                  <Plus className="h-4 w-4" /> Brzi unos prodaje
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setDialog("week")}>
                  <CalendarCheck className="h-4 w-4" /> Tjedni unos
                </Button>
              </>
            )}
            {me.isAdmin && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setDialog("targets")}>
                  <Target className="h-4 w-4" /> Ciljevi
                </Button>
                <Button size="sm" variant="ghost" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Izvoz (CSV)
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-2">Član tima</th>
              {periods.map((p) => (
                <th key={p.key} className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                  {p.label}
                  <div className="font-normal normal-case">{p.sub}</div>
                  {mode === "tjedno" && manualWeek(p.key) && <div className="font-normal normal-case text-warning">tjedni unos</div>}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-2">Ukupno</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cells = periods.map((p) => sumCells(cellsFor(r.id, p.pred)));
              const total = sumCells(cells);
              return (
                <tr key={r.id ?? "tim"} className={cn("border-b border-border", r.id === null && "bg-surface-2/60 font-semibold")}>
                  <td className="px-3 py-2">{r.name}</td>
                  {cells.map((c, i) => (
                    <td key={periods[i].key} className="px-2 py-1 text-right tabular">
                      <button
                        className={cn("rounded px-1.5 py-0.5 hover:bg-brand-soft", c[metric] === 0 && "text-muted-2")}
                        onClick={() => setDetail({ title: `${r.name} · ${periods[i].label} ${periods[i].sub}`, cell: c })}
                      >
                        {fmt(c[metric])}
                      </button>
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right tabular">{fmt(total[metric])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {mode === "mjesecno" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-1 font-display font-semibold">Prodaja po mjesecima — {year}.</h3>
            <p className="mb-3 text-xs text-muted">
              Ukupno {eurFmt.format(sumCells(yearCells).total)} · nova prodaja {eurFmt.format(sumCells(yearCells).ugovoreno)} · „stara“ provedba{" "}
              {eurFmt.format(sumCells(yearCells).stara)}
              {teamTarget != null && me.isAdmin ? ` · cilj tima za ovaj mjesec ${eurFmt.format(teamTarget)}` : ""}
            </p>
            <div className="flex h-40 items-end gap-2">
              {monthTotals.map((c, i) => (
                <div key={months[i]} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-col justify-end" style={{ height: 120 }}>
                    <div className="w-full rounded-t bg-brand-soft" style={{ height: `${(c.stara / maxMonth) * 120}px` }} title={`„Stara“ ${eurFmt.format(c.stara)}`} />
                    <div className="w-full bg-brand" style={{ height: `${(c.ugovoreno / maxMonth) * 120}px` }} title={`Nova ${eurFmt.format(c.ugovoreno)}`} />
                  </div>
                  <span className="text-[10px] text-muted-2">{MONTHS[i]}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="mb-3 font-display font-semibold">Po usluzi — {year}.</h3>
            {byService.size === 0 ? (
              <p className="text-sm text-muted">Još nema prodaje ove godine.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {[...byService.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex gap-2">
                      <span className="min-w-0 flex-1 truncate">{k}</span>
                      <span className="tabular">{eurFmt.format(v)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {detail && (
        <DetailDialog
          title={`${METRICS.find((m) => m.key === metric)?.label} · ${detail.title}`}
          details={
            metric === "total"
              ? [...(detail.cell.details.ugovoreno ?? []), ...(detail.cell.details.stara ?? [])]
              : (detail.cell.details[metric] ?? [])
          }
          meId={me.id}
          isAdmin={me.isAdmin}
          onClose={() => setDetail(null)}
          notify={show}
        />
      )}
      {dialog === "sale" && <SaleDialog team={team} services={services} clients={clients} me={me} today={today} onClose={() => setDialog(null)} notify={show} />}
      {dialog === "week" && <WeekDialog team={team} me={me} today={today} onClose={() => setDialog(null)} notify={show} />}
      {dialog === "targets" && <TargetsDialog team={team} targets={targets} today={today} onClose={() => setDialog(null)} notify={show} />}
    </div>
  );
}

type Notify = (r: { ok: boolean; message?: string; error?: string }) => void;

function SaleDialog({
  team,
  services,
  clients,
  me,
  today,
  onClose,
  notify,
}: {
  team: TeamMember[];
  services: Service[];
  clients: ClientOption[];
  me: { id: string; isAdmin: boolean };
  today: string;
  onClose: () => void;
  notify: Notify;
}) {
  const [f, setF] = React.useState<SaleInput>({ member: me.id, service_id: "", usluga: "", jls_profile_id: "", iznos: "", datum: today, vrsta: "nova", napomena: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title="Brzi unos prodaje"
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
                const r = await addSale(f);
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
        {me.isAdmin && (
          <Field label="Član tima">
            <select className={inputClass} value={f.member ?? ""} onChange={(e) => setF({ ...f, member: e.target.value })}>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Usluga iz cjenika">
          <select
            className={inputClass}
            value={f.service_id ?? ""}
            onChange={(e) => {
              const s = services.find((x) => x.id === e.target.value);
              setF({ ...f, service_id: e.target.value, usluga: s?.naziv ?? f.usluga, iznos: f.iznos || (s?.cijena ?? "") });
            }}
          >
            <option value="">—</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Usluga (opis)" className="sm:col-span-2">
          <input className={inputClass} value={f.usluga} onChange={(e) => setF({ ...f, usluga: e.target.value })} />
        </Field>
        <Field label="Klijent">
          <select className={inputClass} value={f.jls_profile_id ?? ""} onChange={(e) => setF({ ...f, jls_profile_id: e.target.value })}>
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Iznos bez PDV-a (EUR)">
          <input type="number" step="0.01" className={inputClass} value={f.iznos} onChange={(e) => setF({ ...f, iznos: e.target.value })} />
        </Field>
        <Field label="Datum">
          <input type="date" className={inputClass} value={f.datum} onChange={(e) => setF({ ...f, datum: e.target.value })} />
        </Field>
        <Field label="Vrsta">
          <select className={inputClass} value={f.vrsta} onChange={(e) => setF({ ...f, vrsta: e.target.value as "nova" })}>
            <option value="nova">Nova prodaja</option>
            <option value="stara">„Stara“ provedba</option>
          </select>
        </Field>
        <Field label="Napomena" className="sm:col-span-2">
          <input className={inputClass} value={f.napomena ?? ""} onChange={(e) => setF({ ...f, napomena: e.target.value })} />
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

function WeekDialog({ team, me, today, onClose, notify }: { team: TeamMember[]; me: { id: string; isAdmin: boolean }; today: string; onClose: () => void; notify: Notify }) {
  const [f, setF] = React.useState<WeekEntryInput>({ week_start: addDays(weekStart(today), -7), member: me.id, napomena: "" });
  const [pending, start] = React.useTransition();
  const fields: [keyof WeekEntryInput, string][] = [
    ["preuzeti", "Preuzeti leadovi"],
    ["doneseni", "Donijeti leadovi"],
    ["pozivi", "Pozivi / sastanci"],
    ["ponude_poslane", "Ponude poslane"],
    ["ponude_ugovorene", "Ponude ugovorene"],
    ["stara_provedba", "„Stara“ provedba (€)"],
  ];
  return (
    <Modal
      open
      onClose={onClose}
      title="Tjedni unos"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto"
            disabled={pending}
            onClick={() => start(async () => notify(await deleteWeekEntry(f.week_start, (me.isAdmin ? f.member : me.id) ?? me.id)))}
          >
            Ukloni unos za tjedan
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveWeekEntry(f);
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
      <p className="mb-3 text-sm text-muted">Brojke za sastanak koje za taj tjedan zamjenjuju brojače iz CRM-a. Prazno polje = vrijedi brojač iz CRM-a.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tjedan (ponedjeljak)">
          <input
            type="date"
            className={inputClass}
            value={f.week_start}
            onChange={(e) => setF({ ...f, week_start: e.target.value ? weekStart(e.target.value) : f.week_start })}
          />
        </Field>
        {me.isAdmin && (
          <Field label="Član tima">
            <select className={inputClass} value={f.member ?? ""} onChange={(e) => setF({ ...f, member: e.target.value })}>
              {team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {fields.map(([k, l]) => (
          <Field key={k} label={l}>
            <input type="number" min={0} className={inputClass} value={(f[k] as string | number | null | undefined) ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
        <Field label="Napomena" className="sm:col-span-2">
          <textarea rows={2} className={textareaClass} value={f.napomena ?? ""} onChange={(e) => setF({ ...f, napomena: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function TargetsDialog({ team, targets, today, onClose, notify }: { team: TeamMember[]; targets: Target[]; today: string; onClose: () => void; notify: Notify }) {
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [pending, start] = React.useTransition();
  const get = (member: string | null) => targets.find((t) => t.mjesec.slice(0, 7) === month && t.member === member)?.iznos ?? "";
  const [vals, setVals] = React.useState<Record<string, string | number>>({});
  const keyOf = (m: string | null) => `${month}:${m ?? "tim"}`;
  return (
    <Modal open onClose={onClose} title="Mjesečni ciljevi prodaje (EUR bez PDV-a)">
      <Field label="Mjesec">
        <input type="month" className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)} />
      </Field>
      <div className="mt-3 space-y-2">
        {[{ id: null as string | null, name: "Cilj tima" }, ...team.map((t) => ({ id: t.id as string | null, name: t.name }))].map((m) => (
          <div key={m.id ?? "tim"} className="flex items-center gap-2">
            <span className={cn("w-48 truncate text-sm", m.id === null && "font-semibold")}>{m.name}</span>
            <input
              type="number"
              step="100"
              className={inputClass}
              value={vals[keyOf(m.id)] ?? get(m.id)}
              onChange={(e) => setVals({ ...vals, [keyOf(m.id)]: e.target.value })}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={pending || vals[keyOf(m.id)] === undefined}
              onClick={() => start(async () => notify(await saveTarget(`${month}-01`, m.id, vals[keyOf(m.id)] ?? null)))}
            >
              Spremi
            </Button>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">Prazno polje + Spremi briše cilj. Cilj tima prikazuje se na Mom danu.</p>
    </Modal>
  );
}
