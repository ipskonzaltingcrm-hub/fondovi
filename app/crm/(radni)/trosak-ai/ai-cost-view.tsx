"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFlash } from "@/components/crm/overlay";
import { Empty, Stat, Tabs, inputClass, selectSmClass } from "@/components/crm/ui";
import { saveClaudeCredit } from "@/lib/crm/actions/system";
import { fmtDateTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export type UsageRow = { id: number; at: string; modul: string; opis: string | null; model: string | null; input_tokens: number; output_tokens: number; cost_usd: number; ref: string | null };
const usd = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const MODUL: Record<string, string> = { chatbot: "Chatbot na webu" };

export function AiCostView({ rows, credit, cur }: { rows: UsageRow[]; credit: number | null; cur: string }) {
  const months = [...new Set(rows.map((r) => r.at.slice(0, 7)))].sort().reverse();
  const [month, setMonth] = React.useState<string>("sve");
  const [modul, setModul] = React.useState<string>("sve");
  const [c, setC] = React.useState(credit ?? "");
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const inPeriod = rows.filter((r) => month === "sve" || r.at.startsWith(month));
  const list = inPeriod.filter((r) => modul === "sve" || r.modul === modul);
  const total = rows.reduce((a, r) => a + Number(r.cost_usd), 0);
  const thisMonth = rows.filter((r) => r.at.startsWith(cur)).reduce((a, r) => a + Number(r.cost_usd), 0);
  const byMod = new Map<string, number>();
  for (const r of inPeriod) byMod.set(r.modul, (byMod.get(r.modul) ?? 0) + Number(r.cost_usd));
  const top = [...byMod.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-4">
      {node}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ukupno (razdoblje)" value={usd.format(inPeriod.reduce((a, r) => a + Number(r.cost_usd), 0))} />
        <Stat label="Ovaj mjesec" value={usd.format(thisMonth)} />
        <Stat label="Od početka" value={usd.format(total)} />
        <Stat label="Najskuplje" value={top ? MODUL[top[0]] ?? top[0] : "—"} hint={top ? usd.format(top[1]) : undefined} />
      </div>
      <Card className="flex flex-wrap items-end gap-3 p-3">
        <select className={selectSmClass} value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="sve">Sve razdoblje</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-end gap-2">
          <label className="text-xs text-muted">
            Kredit za Claude (USD)
            <input type="number" step="0.01" className={cn(inputClass, "mt-1 w-32")} value={c} onChange={(e) => setC(e.target.value)} />
          </label>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => show(await saveClaudeCredit(c)))}>
            Ažuriraj
          </Button>
          {credit != null && (
            <span className={cn("pb-2 text-sm tabular", credit - total < 10 ? "font-semibold text-danger" : "text-muted")}>preostalo ≈ {usd.format(credit - total)}</span>
          )}
        </div>
      </Card>
      <Tabs
        value={modul}
        onChange={setModul}
        items={[{ value: "sve", label: "Sve" }, ...[...byMod.keys()].map((k) => ({ value: k, label: MODUL[k] ?? k }))]}
      />
      {list.length === 0 ? (
        <Empty title="Još nema AI troškova">Trošak se upisuje kad chatbot odgovori (nakon što se doda Claude API ključ).</Empty>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {list.slice(0, 500).map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-32 shrink-0 text-xs text-muted">{fmtDateTime(r.at)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {MODUL[r.modul] ?? r.modul} · {r.opis ?? "—"}
                  {r.modul === "chatbot" && r.ref && (
                    <Link href="/crm/chatbot" className="ml-1 text-xs text-brand-ink hover:underline">
                      razgovor
                    </Link>
                  )}
                </span>
                <span className="text-xs tabular text-muted">
                  {r.input_tokens.toLocaleString("hr-HR")} / {r.output_tokens.toLocaleString("hr-HR")} tok.
                </span>
                <span className="w-20 text-right tabular">{usd.format(Number(r.cost_usd))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
