"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, CheckSquare, ExternalLink, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActivityFeed } from "@/components/crm/activity-feed";
import { ProjectForm } from "@/components/crm/project-form";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskDrawer } from "@/components/crm/task-drawer";
import { Menu, MenuItem, useFlash } from "@/components/crm/overlay";
import { Empty, Tabs, inputClass, selectSmClass } from "@/components/crm/ui";
import {
  addChecklistItem,
  applyChecklistTemplate,
  archiveProject,
  deleteProject,
  removeChecklistItem,
  setProjectPhase,
  toggleChecklistItem,
} from "@/lib/crm/actions/projects";
import { setTaskDone } from "@/lib/crm/actions/tasks";
import type { Activity, ProjectRow, Task, TaskRefs } from "@/lib/crm/data";
import { CHECKLIST_TEMPLATES, PROJECT_FAZA, PROJECT_FLOW } from "@/lib/crm/options";
import { daysBetween, fmtDay } from "@/lib/crm/dates";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

export type Item = { id: string; naziv: string; grupa: string | null; done_at: string | null; done_by: string | null; position: number };
type Tab = "povijest" | "zadaci";
const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export function ProjectDetail({
  project: p,
  items,
  activities,
  tasks,
  refs,
  me,
  canEdit,
  today,
}: {
  project: ProjectRow;
  items: Item[];
  activities: Activity[];
  tasks: Task[];
  refs: TaskRefs;
  me: { id: string; role: StaffRole; isSuperadmin: boolean };
  canEdit: boolean;
  today: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("povijest");
  const [editing, setEditing] = React.useState(false);
  const [newTask, setNewTask] = React.useState(false);
  const [openTask, setOpenTask] = React.useState<string | null>(null);
  const [newItem, setNewItem] = React.useState("");
  const [tpl, setTpl] = React.useState("");
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      show(r);
      router.refresh();
    });

  const done = items.filter((i) => i.done_at).length;
  const flowIdx = PROJECT_FLOW.indexOf(p.faza);
  const owner = refs.team.find((t) => t.id === p.owner)?.name ?? "—";
  const d = p.rok_prijave ? daysBetween(today, p.rok_prijave) : null;
  const groups = [...new Set(items.map((i) => i.grupa ?? ""))];
  const selectedTask = tasks.find((t) => t.id === openTask) ?? null;
  const isSuradnik = me.role === "suradnik";

  return (
    <div className="space-y-5">
      {node}
      <Link href="/crm/projekti" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Projekti i prijave
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={PROJECT_FAZA[p.faza].tone}>{PROJECT_FAZA[p.faza].label}</Badge>
            {p.archived_at && <Badge tone="outline">Arhiviran</Badge>}
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <span className="text-muted-2">PR-{p.broj}</span> {p.naziv}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {p.client ? p.client.naziv : p.lead ? `L-${p.lead.broj} ${p.lead.naziv}` : "—"} · vlasnik {owner}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setNewTask(true)}>
            <CheckSquare className="h-4 w-4" /> Zadatak
          </Button>
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Uredi
            </Button>
          )}
          {canEdit && (
            <Menu trigger={<MoreHorizontal className="h-5 w-5" />}>
              {p.faza !== "odbijeno" && (
                <MenuItem onClick={() => run(() => setProjectPhase(p.id, "odbijeno"))}>
                  <X className="h-4 w-4" /> Odbijeno
                </MenuItem>
              )}
              {p.faza !== "odustalo" && (
                <MenuItem onClick={() => run(() => setProjectPhase(p.id, "odustalo"))}>
                  <X className="h-4 w-4" /> Klijent odustao
                </MenuItem>
              )}
              {!p.archived_at && (
                <MenuItem onClick={() => run(() => archiveProject(p.id))}>
                  <Archive className="h-4 w-4" /> Arhiviraj projekt
                </MenuItem>
              )}
              {me.isSuperadmin && (
                <MenuItem
                  danger
                  onClick={() => {
                    if (confirm(`Trajno obrisati PR-${p.broj}? Briše se i checklista i povijest projekta.`))
                      start(async () => {
                        const r = await deleteProject(p.id);
                        show(r);
                        if (r.ok) router.push("/crm/projekti");
                      });
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Obriši projekt
                </MenuItem>
              )}
            </Menu>
          )}
        </div>
      </div>

      {/* Traka faza */}
      <div className="flex overflow-x-auto rounded-lg border border-border bg-surface">
        {PROJECT_FLOW.map((f, i) => {
          const reached = flowIdx >= 0 && i <= flowIdx;
          return (
            <button
              key={f}
              disabled={!canEdit || pending || f === p.faza}
              onClick={() => run(() => setProjectPhase(p.id, f))}
              className={cn(
                "flex-1 whitespace-nowrap border-r border-border px-3 py-2.5 text-sm font-medium last:border-r-0",
                f === p.faza ? "bg-brand text-brand-contrast" : reached ? "bg-brand-soft text-brand-ink" : "text-muted",
                canEdit && f !== p.faza && "hover:bg-surface-2",
              )}
            >
              {PROJECT_FAZA[f].label}
            </button>
          );
        })}
      </div>
      {flowIdx < 0 && <p className="text-sm text-danger">Projekt je izvan toka: {PROJECT_FAZA[p.faza].label}. Klik na fazu ga vraća u tok.</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-2">Podaci</h2>
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Rok prijave</dt>
            <dd className={cn(d != null && d >= 0 && d <= 7 && flowIdx <= 1 && flowIdx >= 0 && "font-semibold text-danger")}>
              {p.rok_prijave ? `${fmtDay(p.rok_prijave)}${d != null && d >= 0 ? ` (još ${d} d)` : ""}` : "—"}
            </dd>
            <dt className="text-muted">Program</dt>
            <dd>{p.program || "—"}</dd>
            <dt className="text-muted">Vrijednost</dt>
            <dd>{p.iznos_projekta != null ? eur.format(p.iznos_projekta) : "—"}</dd>
            <dt className="text-muted">Potpora</dt>
            <dd>{p.iznos_potpore != null ? eur.format(p.iznos_potpore) : "—"}</dd>
            <dt className="text-muted">Predano</dt>
            <dd>{p.predano_at ? fmtDay(p.predano_at) : "—"}</dd>
            <dt className="text-muted">Odluka</dt>
            <dd>{p.odluka_at ? fmtDay(p.odluka_at) : "—"}</dd>
          </dl>
          {p.napomena && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{p.napomena}</p>}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-2">Veze</h2>
          <ul className="space-y-2 text-sm">
            {p.client && (
              <li>
                <span className="text-muted">Klijent: </span>
                <Link href={`/crm/klijenti/${p.jls_profile_id}`} className="text-brand-ink hover:underline">
                  {p.client.naziv}
                </Link>
              </li>
            )}
            {p.lead && (
              <li>
                <span className="text-muted">Lead: </span>
                <Link href={`/crm/leadovi?lead=${p.lead_id}`} className="text-brand-ink hover:underline">
                  L-{p.lead.broj} {p.lead.naziv}
                </Link>
              </li>
            )}
            {p.call && (
              <li>
                <span className="text-muted">Natječaj: </span>
                <Link href={`/crm/natjecaji?natjecaj=${p.call_id}`} className="text-brand-ink hover:underline">
                  {p.call.naslov}
                </Link>
                <Link href={`/pozivi/${p.call.slug}`} className="ml-1 inline-flex align-middle text-muted hover:text-foreground" title="U EU Radaru">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                {p.call.rok_prijave && <div className="text-xs text-muted">Rok natječaja: {fmtDay(p.call.rok_prijave)}</div>}
              </li>
            )}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="mb-2 flex items-center">
            <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Checklista dokumentacije</h2>
            <span className="text-xs tabular text-muted">
              {done}/{items.length}
            </span>
          </div>
          {items.length > 0 && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-success" style={{ width: `${(done / items.length) * 100}%` }} />
            </div>
          )}
          {items.length === 0 && <p className="mb-2 text-sm text-muted">Primijeni predložak ili dodaj stavke.</p>}
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {groups.map((g) => (
              <div key={g || "-"}>
                {g && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">{g}</div>}
                <ul className="space-y-1">
                  {items
                    .filter((i) => (i.grupa ?? "") === g)
                    .map((i) => (
                      <li key={i.id} className="group flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--brand)]"
                          checked={!!i.done_at}
                          disabled={!canEdit || pending}
                          onChange={() => run(() => toggleChecklistItem(p.id, i.id, !i.done_at))}
                        />
                        <span className={cn("flex-1", i.done_at && "text-muted line-through")}>{i.naziv}</span>
                        {canEdit && (
                          <button className="opacity-0 group-hover:opacity-100" title="Ukloni" onClick={() => run(() => removeChecklistItem(p.id, i.id))}>
                            <X className="h-3.5 w-3.5 text-muted-2 hover:text-danger" />
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <div className="flex gap-2">
                <select className={cn(selectSmClass, "min-w-0 flex-1")} value={tpl} onChange={(e) => setTpl(e.target.value)}>
                  <option value="">Predložak…</option>
                  {CHECKLIST_TEMPLATES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="secondary" disabled={!tpl || pending} onClick={() => run(() => applyChecklistTemplate(p.id, tpl))}>
                  Primijeni
                </Button>
              </div>
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Nova stavka… (Enter)"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItem.trim()) {
                      run(() => addChecklistItem(p.id, newItem, null));
                      setNewItem("");
                    }
                  }}
                />
              </div>
            </div>
          )}
        </Card>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "povijest", label: "Povijest i bilješke", count: activities.length },
          { value: "zadaci", label: "Zadaci", count: tasks.filter((t) => !t.done_at).length },
        ]}
      />
      {tab === "povijest" && (
        <Card className="p-4">
          <ActivityFeed target={{ project_id: p.id }} items={activities} onAdded={() => router.refresh()} />
        </Card>
      )}
      {tab === "zadaci" &&
        (tasks.length === 0 ? (
          <Empty title="Nema zadataka">
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => setNewTask(true)}>
              <Plus className="h-4 w-4" /> Zadatak
            </Button>
          </Empty>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={!!t.done_at} onChange={() => run(() => setTaskDone(t.id, !t.done_at))} />
                  <button className={cn("flex-1 text-left hover:underline", t.done_at && "text-muted line-through")} onClick={() => setOpenTask(t.id)}>
                    {t.naslov}
                  </button>
                  <span className={cn("text-xs tabular", !t.done_at && t.rok && t.rok < today ? "font-semibold text-danger" : "text-muted")}>
                    {t.rok ? fmtDay(t.rok) : "—"}
                  </span>
                  <span className="w-24 truncate text-right text-xs text-muted">{refs.team.find((m) => m.id === t.owner)?.name ?? "—"}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {editing && <ProjectForm project={p} refs={refs} meId={me.id} onClose={() => setEditing(false)} />}
      {newTask && (
        <TaskDialog
          open
          onClose={() => setNewTask(false)}
          refs={refs}
          meId={me.id}
          lockOwner={isSuradnik}
          preset={{ project_id: p.id, jls_profile_id: p.jls_profile_id, lead_id: p.lead_id, call_id: p.call_id, owner: p.owner ?? me.id }}
          onSaved={() => {
            show({ ok: true, message: "Zadatak je spremljen." });
            router.refresh();
          }}
        />
      )}
      {selectedTask && (
        <TaskDrawer
          key={selectedTask.id}
          task={selectedTask}
          onClose={() => setOpenTask(null)}
          refs={refs}
          meId={me.id}
          canArchive={(t) => !isSuradnik || t.created_by === me.id}
          notify={show}
        />
      )}
    </div>
  );
}
