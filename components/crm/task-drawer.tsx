"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, MoreHorizontal, Pencil, CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, Menu, MenuItem } from "./overlay";
import { ActivityFeed } from "./activity-feed";
import { TaskDialog } from "./task-dialog";
import { archiveTask, setTaskDone } from "@/lib/crm/actions/tasks";
import { loadActivities } from "@/lib/crm/actions/activities";
import type { Activity, Task, TaskRefs } from "@/lib/crm/data";
import { PRIORITET, TASK_VRSTA } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";
import { fmtDateTime } from "@/lib/crm/format";

/** Detalj zadatka: podaci, dovršavanje, uređivanje, arhiviranje, komentari i povijest. */
export function TaskDrawer({
  task,
  onClose,
  refs,
  meId,
  canArchive,
  notify,
}: {
  task: Task | null;
  onClose: () => void;
  refs: TaskRefs;
  meId: string;
  canArchive: (t: Task) => boolean;
  notify: (r: { ok: boolean; message?: string; error?: string }) => void;
}) {
  const [acts, setActs] = React.useState<Activity[]>([]);
  const [editing, setEditing] = React.useState(false);
  const [pending, start] = React.useTransition();
  const id = task?.id;

  const reload = React.useCallback(() => {
    if (id) loadActivities({ task_id: id }).then(setActs);
  }, [id]);
  // Panel se montira s key={task.id}, pa se stanje ne mora čistiti.
  React.useEffect(() => {
    reload();
  }, [reload]);

  if (!task) return null;
  const owner = refs.team.find((t) => t.id === task.owner)?.name ?? "—";
  const done = !!task.done_at;

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={<span className={done ? "text-muted line-through" : ""}>{task.naslov}</span>}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{TASK_VRSTA[task.vrsta]}</Badge>
            <Badge tone={PRIORITET[task.prioritet].tone}>Prioritet: {PRIORITET[task.prioritet].label}</Badge>
            {done && <Badge tone="success">Dovršen {fmtDateTime(task.done_at)}</Badge>}
          </span>
        }
        actions={
          <Menu trigger={<MoreHorizontal className="h-5 w-5" />}>
            <MenuItem onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Uredi zadatak
            </MenuItem>
            {canArchive(task) && (
              <MenuItem
                danger
                onClick={() =>
                  start(async () => {
                    const r = await archiveTask(task.id);
                    notify(r);
                    if (r.ok) onClose();
                  })
                }
              >
                <Archive className="h-4 w-4" /> Arhiviraj zadatak
              </MenuItem>
            )}
          </Menu>
        }
      >
        <div className="mb-4 flex gap-2">
          <Button
            size="sm"
            variant={done ? "secondary" : "primary"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setTaskDone(task.id, !done);
                notify(r);
                reload();
              })
            }
          >
            {done ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {done ? "Vrati u otvorene" : "Označi kao dovršen"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Uredi
          </Button>
        </div>

        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted">Rok</dt>
          <dd>
            {task.rok ? fmtDay(task.rok) : "bez roka"}
            {task.vrijeme ? ` u ${task.vrijeme.slice(0, 5)}` : ""}
          </dd>
          <dt className="text-muted">Vlasnik</dt>
          <dd>{owner}</dd>
          {task.lead && (
            <>
              <dt className="text-muted">Lead</dt>
              <dd>
                <Link className="text-brand-ink hover:underline" href={`/crm/leadovi?lead=${task.lead_id}`}>
                  L-{task.lead.broj} · {task.lead.naziv}
                </Link>
              </dd>
            </>
          )}
          {task.client && (
            <>
              <dt className="text-muted">Klijent</dt>
              <dd>
                <Link className="text-brand-ink hover:underline" href={`/crm/klijenti/${task.jls_profile_id}`}>
                  {task.client.naziv}
                </Link>
              </dd>
            </>
          )}
          {task.call && (
            <>
              <dt className="text-muted">Natječaj</dt>
              <dd>
                <Link className="text-brand-ink hover:underline" href={`/pozivi/${task.call.slug}`}>
                  {task.call.naslov}
                </Link>
              </dd>
            </>
          )}
          {task.opis && (
            <>
              <dt className="text-muted">Opis</dt>
              <dd className="whitespace-pre-wrap">{task.opis}</dd>
            </>
          )}
        </dl>

        <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-2">Komentari i povijest</h3>
        <ActivityFeed target={{ task_id: task.id }} items={acts} onAdded={reload} mode="komentar" />
      </Drawer>

      {editing && (
        <TaskDialog
          open
          onClose={() => setEditing(false)}
          refs={refs}
          meId={meId}
          task={task}
          onSaved={() => {
            notify({ ok: true, message: "Zadatak je spremljen." });
            reload();
          }}
        />
      )}
    </>
  );
}
