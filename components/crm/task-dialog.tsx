"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "./overlay";
import { Field, inputClass, textareaClass, Notice } from "./ui";
import { createTask, updateTask, type TaskInput } from "@/lib/crm/actions/tasks";
import { TASK_VRSTA, PRIORITET, type Prioritet, type TaskVrsta } from "@/lib/crm/options";
import type { Task, TaskRefs } from "@/lib/crm/data";
import { todayZg } from "@/lib/crm/dates";

/** Obrazac zadatka (novi ili izmjena). `preset` popunjava vezu (lead, klijent, natječaj) i vlasnika. */
export function TaskDialog({
  open,
  onClose,
  refs,
  meId,
  task,
  preset,
  lockOwner,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  refs: TaskRefs;
  meId: string;
  task?: Task | null;
  preset?: Partial<TaskInput>;
  lockOwner?: boolean;
  onSaved?: (id?: string) => void;
}) {
  const init = React.useMemo<TaskInput>(
    () => ({
      naslov: task?.naslov ?? preset?.naslov ?? "",
      opis: task?.opis ?? "",
      vrsta: task?.vrsta ?? preset?.vrsta ?? "ostalo",
      prioritet: task?.prioritet ?? "srednji",
      rok: task?.rok ?? preset?.rok ?? todayZg(),
      vrijeme: task?.vrijeme?.slice(0, 5) ?? "",
      owner: task?.owner ?? preset?.owner ?? meId,
      lead_id: task?.lead_id ?? preset?.lead_id ?? "",
      jls_profile_id: task?.jls_profile_id ?? preset?.jls_profile_id ?? "",
      call_id: task?.call_id ?? preset?.call_id ?? "",
    }),
    [task, preset, meId],
  );
  const [f, setF] = React.useState<TaskInput>(init);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    setError(null);
    start(async () => {
      const r = task ? await updateTask(task.id, f) : await createTask(f);
      if (!r.ok) setError(r.error);
      else {
        onSaved?.(r.data);
        onClose();
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Uredi zadatak" : "Novi zadatak"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button size="sm" disabled={pending} onClick={save}>
            {pending ? "Spremam…" : "Spremi"}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Zadatak" className="sm:col-span-2">
          <input autoFocus className={inputClass} value={f.naslov} onChange={(e) => set("naslov", e.target.value)} />
        </Field>
        <Field label="Opis" className="sm:col-span-2">
          <textarea rows={3} className={textareaClass} value={f.opis ?? ""} onChange={(e) => set("opis", e.target.value)} />
        </Field>
        <Field label="Vrsta">
          <select className={inputClass} value={f.vrsta} onChange={(e) => set("vrsta", e.target.value as TaskVrsta)}>
            {Object.entries(TASK_VRSTA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioritet">
          <select className={inputClass} value={f.prioritet} onChange={(e) => set("prioritet", e.target.value as Prioritet)}>
            {Object.entries(PRIORITET).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rok">
          <input type="date" className={inputClass} value={f.rok ?? ""} onChange={(e) => set("rok", e.target.value)} />
        </Field>
        <Field label="Vrijeme (neobavezno)">
          <input type="time" className={inputClass} value={f.vrijeme ?? ""} onChange={(e) => set("vrijeme", e.target.value)} />
        </Field>
        <Field label="Vlasnik" className="sm:col-span-2">
          <select
            className={inputClass}
            value={f.owner ?? ""}
            disabled={lockOwner}
            onChange={(e) => set("owner", e.target.value)}
          >
            {refs.team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id === meId ? " (ja)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Povezano s leadom">
          <select className={inputClass} value={f.lead_id ?? ""} onChange={(e) => set("lead_id", e.target.value)}>
            <option value="">—</option>
            {refs.leads.map((l) => (
              <option key={l.id} value={l.id}>
                L-{l.broj} · {l.naziv}
              </option>
            ))}
            {f.lead_id && !refs.leads.some((l) => l.id === f.lead_id) && <option value={f.lead_id}>{task?.lead ? `L-${task.lead.broj} · ${task.lead.naziv}` : "Odabrani lead"}</option>}
          </select>
        </Field>
        <Field label="Povezano s klijentom">
          <select className={inputClass} value={f.jls_profile_id ?? ""} onChange={(e) => set("jls_profile_id", e.target.value)}>
            <option value="">—</option>
            {refs.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Natječaj (EU Radar)" className="sm:col-span-2">
          <select className={inputClass} value={f.call_id ?? ""} onChange={(e) => set("call_id", e.target.value)}>
            <option value="">—</option>
            {refs.calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naslov.length > 90 ? c.naslov.slice(0, 90) + "…" : c.naslov}
              </option>
            ))}
            {f.call_id && !refs.calls.some((c) => c.id === f.call_id) && <option value={f.call_id}>{task?.call?.naslov ?? "Odabrani natječaj"}</option>}
          </select>
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
