"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFlash } from "@/components/crm/overlay";
import { DetailDialog, downloadCsv } from "@/components/crm/sales-detail";
import type { TeamMember } from "@/lib/crm/data";
import { METRICS, OFFICIAL_ROWS, type MetricKey } from "@/lib/crm/options";
import { byMemberWeek, eurFmt, isoWeekNo, sumCells, weekMonth, weeksOfMonth, type Cell, type SalesEvent } from "@/lib/crm/sales";
import { addDays, fmtDay, fmtMonth, weekStart } from "@/lib/crm/dates";
import { initials } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export function OfficialView({
  events,
  team,
  today,
  meId,
  isAdmin,
  from,
}: {
  events: SalesEvent[];
  team: TeamMember[];
  today: string;
  meId: string;
  isAdmin: boolean;
  from: string;
}) {
  const [mode, setMode] = React.useState<"tjedno" | "mjesecno">("tjedno");
  const [week, setWeek] = React.useState(weekStart(today));
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [detail, setDetail] = React.useState<{ title: string; details: Cell["details"][MetricKey] } | null>(null);
  const { show, node } = useFlash();
  const grid = byMemberWeek(events);

  const pred = mode === "tjedno" ? (ws: string) => ws === week : (ws: string) => weeksOfMonth(month).includes(ws) && weekMonth(ws) === month;
  const cellFor = (memberId: string | null) => {
    const keys = memberId === null ? [...grid.keys()] : [memberId];
    return sumCells(keys.flatMap((k) => [...(grid.get(k)?.entries() ?? [])].filter(([ws]) => pred(ws)).map(([, c]) => c)));
  };
  const cols = team.map((t) => ({ id: t.id, label: t.short || initials(t.name), name: t.name, cell: cellFor(t.id) }));
  const total = cellFor(null);
  const label =
    mode === "tjedno" ? `T${isoWeekNo(week)} · ${fmtDay(week)} – ${fmtDay(addDays(week, 6))}` : fmtMonth(`${month}-01`);
  const canPrev = mode === "tjedno" ? addDays(week, -7) >= from : `${month}-01` > from;
  const canNext = mode === "tjedno" ? addDays(week, 7) <= today : `${month}-01` < today.slice(0, 7) + "-01";
  const shift = (d: number) => {
    if (mode === "tjedno") setWeek(addDays(week, 7 * d));
    else {
      const dt = new Date(`${month}-15T12:00:00Z`);
      dt.setUTCMonth(dt.getUTCMonth() + d);
      setMonth(dt.toISOString().slice(0, 7));
    }
  };
  const fmt = (k: MetricKey, v: number) => (METRICS.find((m) => m.key === k)?.money ? eurFmt.format(v) : String(v));
  const details = (c: Cell, k: MetricKey) => (k === "total" ? [...(c.details.ugovoreno ?? []), ...(c.details.stara ?? [])] : c.details[k] ?? []);

  function exportCsv() {
    downloadCsv(`prodajni-official-${mode}-${mode === "tjedno" ? week : month}.csv`, [
      ["Pokazatelj", ...cols.map((c) => c.name), "UKUPNO"],
      ...OFFICIAL_ROWS.map((k) => [METRICS.find((m) => m.key === k)!.label, ...cols.map((c) => c.cell[k]), total[k]]),
    ]);
  }

  return (
    <div className="space-y-4">
      {node}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
          {(["tjedno", "mjesecno"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("rounded px-3 py-1", mode === m ? "bg-brand text-brand-contrast" : "text-muted hover:text-foreground")}>
              {m === "tjedno" ? "Tjedno" : "Mjesečno"}
            </button>
          ))}
        </div>
        <Button size="icon" variant="ghost" disabled={!canPrev} onClick={() => shift(-1)} aria-label="Prethodno">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-56 text-center font-display font-semibold capitalize">{label}</span>
        <Button size="icon" variant="ghost" disabled={!canNext} onClick={() => shift(1)} aria-label="Sljedeće">
          <ChevronRight className="h-4 w-4" />
        </Button>
        {total.manual && <span className="text-xs text-warning">uključuje tjedni unos</span>}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Izvoz (CSV)
        </Button>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-2">Pokazatelj</th>
              {cols.map((c) => (
                <th key={c.id} title={c.name} className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-2">
                  {c.label}
                </th>
              ))}
              <th className="bg-surface-2 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider">Ukupno</th>
            </tr>
          </thead>
          <tbody>
            {OFFICIAL_ROWS.map((k) => {
              const m = METRICS.find((x) => x.key === k)!;
              return (
                <tr key={k} className={cn("border-b border-border", k === "total" && "font-semibold")}>
                  <td className="px-3 py-2">{m.label}</td>
                  {cols.map((c) => (
                    <td key={c.id} className="px-2 py-1 text-right tabular">
                      <button
                        className={cn("rounded px-1.5 py-0.5 hover:bg-brand-soft", c.cell[k] === 0 && "text-muted-2")}
                        onClick={() => setDetail({ title: `${m.label} · ${c.name} · ${label}`, details: details(c.cell, k) })}
                      >
                        {fmt(k, c.cell[k])}
                      </button>
                    </td>
                  ))}
                  <td className="bg-surface-2 px-3 py-1 text-right tabular">
                    <button className="rounded px-1.5 py-0.5 hover:bg-brand-soft" onClick={() => setDetail({ title: `${m.label} · tim · ${label}`, details: details(total, k) })}>
                      {fmt(k, total[k])}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-muted">
        „Novi leadovi u CRM (ukupno)“ uključuje i leadove bez vlasnika (registracije na EU Radar). Upitnik leadovi broje se po vlasniku leada. Iznosi su bez PDV-a.
      </p>

      {detail && <DetailDialog title={detail.title} details={detail.details ?? []} meId={meId} isAdmin={isAdmin} onClose={() => setDetail(null)} notify={show} />}
    </div>
  );
}
