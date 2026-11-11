"use client";

import * as React from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useFlash } from "@/components/crm/overlay";
import { inputClass } from "@/components/crm/ui";
import { createTask, setTaskDone } from "@/lib/crm/actions/tasks";
import type { Task, TaskRefs } from "@/lib/crm/data";
import { addDays, fmtDay } from "@/lib/crm/dates";
import { cn } from "@/lib/utils";

type Channel = { key: string; label: string; week: number; month: number; year: number };

/** Leadovi po kanalu s prekidačem Ovaj tjedan / Mjesec / Godina. */
export function LeadChannels({ channels }: { channels: Channel[] }) {
  const [p, setP] = React.useState<"week" | "month" | "year">("week");
  const max = Math.max(1, ...channels.map((c) => c[p]));
  const sorted = [...channels].sort((a, b) => b[p] - a[p]);
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="flex-1 text-sm font-medium">Kanali</h3>
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
          {(
            [
              ["week", "Ovaj tjedan"],
              ["month", "Mjesec"],
              ["year", "Godina"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setP(k)}
              className={cn("rounded px-2 py-0.5", p === k ? "bg-brand text-brand-contrast" : "text-muted hover:text-foreground")}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-1.5">
        {sorted.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-xs">
            <span className="w-40 truncate text-muted">{c.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(c[p] / max) * 100}%` }} />
            </span>
            <span className="w-6 text-right tabular">{c[p]}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Moji zadaci: kasni, danas, sutra; brzi unos (rok danas, ostalo, srednji). */
export function MyTasks({
  tasks,
  today,
  meId,
}: {
  tasks: Task[];
  today: string;
  refs: TaskRefs;
  meId: string;
  lockOwner: boolean;
}) {
  const [quick, setQuick] = React.useState("");
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const tomorrow = addDays(today, 1);
  const groups: { label: string; list: Task[]; tone?: string }[] = [
    { label: "Kasni", list: tasks.filter((t) => t.rok && t.rok < today), tone: "text-danger" },
    { label: "Danas", list: tasks.filter((t) => t.rok === today) },
    { label: "Sutra", list: tasks.filter((t) => t.rok === tomorrow) },
  ];
  const later = tasks.filter((t) => !t.rok || t.rok > tomorrow).length;

  return (
    <Card className="p-4">
      {node}
      <div className="mb-3 flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-brand-ink" />
        <h2 className="flex-1 font-display font-semibold">Moji zadaci</h2>
        <Link href="/crm/zadaci" className="text-xs font-medium text-brand-ink hover:underline">
          Svi zadaci
        </Link>
      </div>
      <input
        className={inputClass}
        placeholder="Brzi zadatak… (Enter, rok danas)"
        value={quick}
        disabled={pending}
        onChange={(e) => setQuick(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && quick.trim())
            start(async () => {
              const r = await createTask({ naslov: quick, rok: today, vrsta: "ostalo", prioritet: "srednji", owner: meId });
              show(r);
              if (r.ok) setQuick("");
            });
        }}
      />
      <div className="mt-3 space-y-3">
        {groups.every((g) => !g.list.length) && <p className="text-sm text-muted">Nema zadataka za danas i sutra.</p>}
        {groups
          .filter((g) => g.list.length)
          .map((g) => (
            <div key={g.label}>
              <h3 className={cn("mb-1 text-[11px] font-semibold uppercase tracking-wider", g.tone ?? "text-muted-2")}>
                {g.label} · {g.list.length}
              </h3>
              <ul className="space-y-1">
                {g.list.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--brand)]"
                      disabled={pending}
                      onChange={() => start(async () => show(await setTaskDone(t.id, true)))}
                    />
                    <Link href={`/crm/zadaci?zadatak=${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
                      {t.naslov}
                    </Link>
                    {g.label === "Kasni" && <span className="text-xs text-danger">{fmtDay(t.rok)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {later > 0 && <p className="text-xs text-muted">+ {later} kasnije ili bez roka</p>}
      </div>
    </Card>
  );
}
