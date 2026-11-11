"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Columns3, List, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskDrawer } from "@/components/crm/task-drawer";
import { useFlash } from "@/components/crm/overlay";
import { Empty, Stat, inputClass, selectSmClass } from "@/components/crm/ui";
import { createTask, rescheduleTask, setTaskDone } from "@/lib/crm/actions/tasks";
import type { Task, TaskRefs } from "@/lib/crm/data";
import type { StaffRole } from "@/lib/crm/roles";
import { PRIORITET, TASK_VRSTA } from "@/lib/crm/options";
import {
  DUE_GROUP_LABEL,
  DUE_GROUP_ORDER,
  addDays,
  dayOfWeek,
  dueGroup,
  fmtDay,
  fmtMonth,
  rokForGroup,
  type DueGroup,
} from "@/lib/crm/dates";
import { cn } from "@/lib/utils";

type View = "lista" | "kanban" | "kalendar";

export function TasksView({
  tasks,
  refs,
  me,
  today,
  openId,
}: {
  tasks: Task[];
  refs: TaskRefs;
  me: { id: string; role: StaffRole };
  today: string;
  openId: string | null;
}) {
  const router = useRouter();
  const isSuradnik = me.role === "suradnik";
  const [view, setView] = React.useState<View>("lista");
  const [scope, setScope] = React.useState<string>("moji"); // moji | tim | <user id>
  const [q, setQ] = React.useState("");
  const [showDone, setShowDone] = React.useState(false);
  const [selected, setSelected] = React.useState<string | null>(openId);
  const [creating, setCreating] = React.useState(false);
  const [quick, setQuick] = React.useState("");
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();

  const filtered = tasks.filter((t) => {
    if (isSuradnik || scope === "moji") {
      if (t.owner !== me.id) return false;
    } else if (scope !== "tim" && t.owner !== scope) return false;
    if (q) {
      const s = q.toLowerCase();
      const hay = [t.naslov, t.opis, t.lead?.naziv, t.client?.naziv, t.call?.naslov].join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
  const open = filtered.filter((t) => !t.done_at);
  const counts = {
    open: open.length,
    danas: open.filter((t) => t.rok === today).length,
    kasni: open.filter((t) => t.rok && t.rok < today).length,
  };
  const selectedTask = tasks.find((t) => t.id === selected) ?? null;

  function quickAdd() {
    const naslov = quick.trim();
    if (!naslov) return;
    start(async () => {
      const r = await createTask({ naslov, rok: today, vrsta: "ostalo", prioritet: "srednji", owner: me.id });
      show(r);
      if (r.ok) setQuick("");
    });
  }

  function toggle(t: Task) {
    start(async () => show(await setTaskDone(t.id, !t.done_at)));
  }

  function move(id: string, rok: string | null) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.rok === rok) return;
    start(async () => {
      const r = await rescheduleTask(id, rok);
      show(r.ok ? { ok: true, message: rok ? `Novi rok: ${fmtDay(rok)}` : "Zadatak je bez roka." } : r);
    });
  }

  const ownerName = (id: string | null) => {
    const m = refs.team.find((t) => t.id === id);
    return m ? m.short || m.name.split(/\s+/)[0] : "—";
  };

  return (
    <div className="space-y-4">
      {node}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Otvoreni" value={counts.open} />
        <Stat label="Za danas" value={counts.danas} />
        <Stat label="Kasni" value={<span className={counts.kasni ? "text-danger" : ""}>{counts.kasni}</span>} />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={cn(inputClass, "min-w-56 flex-1")}
            placeholder="Novi zadatak… (Enter za spremanje, rok danas)"
            value={quick}
            disabled={pending}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && quickAdd()}
          />
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novi zadatak
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(
              [
                ["lista", "Lista", List],
                ["kanban", "Kanban", Columns3],
                ["kalendar", "Kalendar", CalendarDays],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-sm",
                  view === v ? "bg-brand text-brand-contrast" : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
          <select
            className={selectSmClass}
            value={isSuradnik ? "moji" : scope}
            disabled={isSuradnik}
            onChange={(e) => setScope(e.target.value)}
            title={isSuradnik ? "Suradnik vidi samo svoje zadatke" : undefined}
          >
            <option value="moji">Moji zadaci</option>
            <option value="tim">Cijeli tim</option>
            {refs.team
              .filter((t) => t.id !== me.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input
              className={cn(inputClass, "pl-8")}
              placeholder="Traži zadatak ili klijenta"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {view === "lista" && (
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              Prikaži dovršene
            </label>
          )}
        </div>
      </Card>

      {view === "lista" && (
        <ListView
          tasks={showDone ? filtered : open}
          today={today}
          onOpen={setSelected}
          onToggle={toggle}
          ownerName={ownerName}
        />
      )}
      {view === "kanban" && (
        <KanbanView tasks={open} today={today} onOpen={setSelected} onMove={move} ownerName={ownerName} />
      )}
      {view === "kalendar" && <CalendarView tasks={filtered} today={today} onOpen={setSelected} onMove={move} />}

      {creating && (
        <TaskDialog
          open
          onClose={() => setCreating(false)}
          refs={refs}
          meId={me.id}
          lockOwner={isSuradnik}
          onSaved={() => show({ ok: true, message: "Zadatak je spremljen." })}
        />
      )}
      {selectedTask && (
        <TaskDrawer
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => {
            setSelected(null);
            if (openId) router.replace("/crm/zadaci");
          }}
          refs={refs}
          meId={me.id}
          canArchive={(t) => !isSuradnik || t.created_by === me.id}
          notify={show}
        />
      )}
    </div>
  );
}

function TaskLine({
  t,
  today,
  onOpen,
  onToggle,
  ownerName,
}: {
  t: Task;
  today: string;
  onOpen: (id: string) => void;
  onToggle: (t: Task) => void;
  ownerName: (id: string | null) => string;
}) {
  const late = !t.done_at && t.rok && t.rok < today;
  const link = t.lead ? `L-${t.lead.broj} ${t.lead.naziv}` : t.client?.naziv ?? t.call?.naslov ?? null;
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2/60">
      <input
        type="checkbox"
        checked={!!t.done_at}
        onChange={() => onToggle(t)}
        className="h-4 w-4 shrink-0 accent-[var(--brand)]"
        aria-label="Dovršeno"
      />
      <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(t.id)}>
        <div className={cn("truncate text-sm font-medium", t.done_at && "text-muted line-through")}>{t.naslov}</div>
        {link && <div className="truncate text-xs text-muted">{link}</div>}
      </button>
      {t.prioritet === "visok" && <Badge tone="danger">Visok</Badge>}
      <span className="hidden text-xs text-muted sm:inline">{TASK_VRSTA[t.vrsta]}</span>
      <span className={cn("w-20 text-right text-xs tabular", late ? "font-semibold text-danger" : "text-muted")}>
        {t.rok ? fmtDay(t.rok) : "—"}
        {t.vrijeme ? ` ${t.vrijeme.slice(0, 5)}` : ""}
      </span>
      <span className="w-20 truncate text-right text-xs text-muted">{ownerName(t.owner)}</span>
    </li>
  );
}

function ListView({
  tasks,
  today,
  onOpen,
  onToggle,
  ownerName,
}: {
  tasks: Task[];
  today: string;
  onOpen: (id: string) => void;
  onToggle: (t: Task) => void;
  ownerName: (id: string | null) => string;
}) {
  if (!tasks.length) return <Empty title="Nema zadataka">Upiši brzi zadatak gore ili klikni „Novi zadatak“.</Empty>;
  const groups = new Map<DueGroup, Task[]>();
  for (const t of tasks) {
    const g = dueGroup(t.rok, !!t.done_at, today);
    groups.set(g, [...(groups.get(g) ?? []), t]);
  }
  return (
    <div className="space-y-4">
      {DUE_GROUP_ORDER.filter((g) => groups.has(g)).map((g) => (
        <Card key={g} className="overflow-hidden">
          <div
            className={cn(
              "border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider",
              g === "kasni" ? "text-danger" : "text-muted-2",
            )}
          >
            {DUE_GROUP_LABEL[g]} · {groups.get(g)!.length}
          </div>
          <ul className="divide-y divide-border">
            {groups.get(g)!.map((t) => (
              <TaskLine key={t.id} t={t} today={today} onOpen={onOpen} onToggle={onToggle} ownerName={ownerName} />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function KanbanView({
  tasks,
  today,
  onOpen,
  onMove,
  ownerName,
}: {
  tasks: Task[];
  today: string;
  onOpen: (id: string) => void;
  onMove: (id: string, rok: string | null) => void;
  ownerName: (id: string | null) => string;
}) {
  const cols: DueGroup[] = ["kasni", "danas", "sutra", "tjedan", "kasnije", "bez"];
  const [over, setOver] = React.useState<DueGroup | null>(null);
  return (
    <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
      {cols.map((g) => {
        const list = tasks.filter((t) => dueGroup(t.rok, false, today) === g);
        const target = rokForGroup(g, today);
        const droppable = target !== undefined;
        return (
          <div
            key={g}
            onDragOver={(e) => {
              if (droppable) {
                e.preventDefault();
                setOver(g);
              }
            }}
            onDragLeave={() => setOver((o) => (o === g ? null : o))}
            onDrop={(e) => {
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              if (id && droppable) onMove(id, target ?? null);
            }}
            className={cn(
              "min-h-40 rounded-lg border bg-surface-2/40 p-2",
              over === g ? "border-brand bg-brand-soft/40" : "border-border",
            )}
          >
            <div className={cn("mb-2 px-1 text-xs font-semibold uppercase tracking-wider", g === "kasni" ? "text-danger" : "text-muted-2")}>
              {DUE_GROUP_LABEL[g]} · {list.length}
            </div>
            <div className="space-y-2">
              {list.map((t) => (
                <button
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  onClick={() => onOpen(t.id)}
                  className="block w-full cursor-grab rounded-md border border-border bg-surface p-2.5 text-left shadow-sm hover:border-brand active:cursor-grabbing"
                >
                  <div className="text-sm font-medium">{t.naslov}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <span>{t.rok ? fmtDay(t.rok) : "bez roka"}</span>
                    <span>·</span>
                    <span>{ownerName(t.owner)}</span>
                    {t.prioritet !== "srednji" && (
                      <Badge tone={PRIORITET[t.prioritet].tone} className="ml-auto px-1.5 py-0 text-[10px]">
                        {PRIORITET[t.prioritet].label}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({
  tasks,
  today,
  onOpen,
  onMove,
}: {
  tasks: Task[];
  today: string;
  onOpen: (id: string) => void;
  onMove: (id: string, rok: string | null) => void;
}) {
  const [month, setMonth] = React.useState(today.slice(0, 7) + "-01");
  const [over, setOver] = React.useState<string | null>(null);
  const start = addDays(month, -dayOfWeek(month));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const byDay = new Map<string, Task[]>();
  for (const t of tasks) if (t.rok) byDay.set(t.rok, [...(byDay.get(t.rok) ?? []), t]);
  const shift = (n: number) => {
    const d = new Date(`${month}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 8) + "01");
  };
  const curMonth = month.slice(0, 7);
  const noDate = tasks.filter((t) => !t.rok && !t.done_at).length;

  return (
    <Card className="p-3">
      <div className="mb-3 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => shift(-1)} aria-label="Prethodni mjesec">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-40 text-center font-display font-semibold capitalize">{fmtMonth(month)}</div>
        <Button size="icon" variant="ghost" onClick={() => shift(1)} aria-label="Sljedeći mjesec">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMonth(today.slice(0, 7) + "-01")}>
          Danas
        </Button>
        {noDate > 0 && <span className="ml-auto text-xs text-muted">{noDate} otvorenih bez roka (vidi Listu)</span>}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border border-border bg-border text-xs">
        {["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"].map((d) => (
          <div key={d} className="bg-surface-2 px-2 py-1 font-semibold text-muted-2">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const past = d < today;
          return (
            <div
              key={d}
              onDragOver={(e) => {
                if (!past) {
                  e.preventDefault();
                  setOver(d);
                }
              }}
              onDragLeave={() => setOver((o) => (o === d ? null : o))}
              onDrop={(e) => {
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id && !past) onMove(id, d);
              }}
              className={cn(
                "min-h-24 bg-surface p-1",
                d.slice(0, 7) !== curMonth && "bg-surface-2/60 text-muted-2",
                over === d && "bg-brand-soft",
              )}
            >
              <div className={cn("mb-1 px-1 tabular", d === today && "inline-block rounded bg-brand px-1.5 text-brand-contrast")}>
                {Number(d.slice(8))}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    draggable={!t.done_at}
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "block w-full truncate rounded px-1 py-0.5 text-left",
                      t.done_at
                        ? "text-muted-2 line-through"
                        : t.rok! < today
                          ? "bg-danger-soft text-danger"
                          : "bg-brand-soft text-brand-ink",
                    )}
                  >
                    {t.naslov}
                  </button>
                ))}
                {list.length > 4 && <div className="px-1 text-muted-2">+{list.length - 4} još</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
