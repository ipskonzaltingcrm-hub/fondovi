"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "./overlay";
import { Field, Notice, inputClass, textareaClass } from "./ui";
import { saveProject, type ProjectInput } from "@/lib/crm/actions/projects";
import type { ProjectRow, TaskRefs } from "@/lib/crm/data";
import { PROJECT_FAZA, type ProjectFaza } from "@/lib/crm/options";

/** Novi projekt ili izmjena. `preset` popunjava klijenta / lead / natječaj (npr. iz kartice natječaja). */
export function ProjectForm({
  project,
  refs,
  meId,
  preset,
  onClose,
}: {
  project?: ProjectRow | null;
  refs: TaskRefs;
  meId: string;
  preset?: Partial<ProjectInput>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState<ProjectInput>({
    naziv: project?.naziv ?? preset?.naziv ?? "",
    jls_profile_id: project?.jls_profile_id ?? preset?.jls_profile_id ?? "",
    lead_id: project?.lead_id ?? preset?.lead_id ?? "",
    call_id: project?.call_id ?? preset?.call_id ?? "",
    program: project?.program ?? preset?.program ?? "",
    owner: project?.owner ?? meId,
    faza: project?.faza ?? "priprema",
    rok_prijave: project?.rok_prijave ?? preset?.rok_prijave ?? "",
    iznos_projekta: project?.iznos_projekta ?? "",
    iznos_potpore: project?.iznos_potpore ?? "",
    napomena: project?.napomena ?? "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => setF((p) => ({ ...p, [k]: v }));

  function pickCall(id: string) {
    const c = refs.calls.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      call_id: id,
      program: p.program || c?.program || "",
      rok_prijave: p.rok_prijave || c?.rok_prijave || "",
    }));
  }

  function save() {
    setError(null);
    start(async () => {
      const r = await saveProject(project?.id ?? null, f);
      if (!r.ok) setError(r.error);
      else {
        onClose();
        if (!project && r.data) router.push(`/crm/projekti/${r.data}`);
        else router.refresh();
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={project ? `Uredi PR-${project.broj}` : "Novi projekt"}
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
        <Field label="Klijent">
          <select className={inputClass} value={f.jls_profile_id ?? ""} onChange={(e) => set("jls_profile_id", e.target.value)}>
            <option value="">—</option>
            {refs.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="ili lead">
          <select className={inputClass} value={f.lead_id ?? ""} onChange={(e) => set("lead_id", e.target.value)}>
            <option value="">—</option>
            {refs.leads.map((l) => (
              <option key={l.id} value={l.id}>
                L-{l.broj} · {l.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Natječaj (EU Radar)" className="sm:col-span-2">
          <select className={inputClass} value={f.call_id ?? ""} onChange={(e) => pickCall(e.target.value)}>
            <option value="">—</option>
            {refs.calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naslov.length > 90 ? c.naslov.slice(0, 90) + "…" : c.naslov}
              </option>
            ))}
            {f.call_id && !refs.calls.some((c) => c.id === f.call_id) && <option value={f.call_id}>{project?.call?.naslov ?? "Odabrani natječaj"}</option>}
          </select>
        </Field>
        <Field label="Naziv projekta" className="sm:col-span-2">
          <input autoFocus className={inputClass} value={f.naziv} onChange={(e) => set("naziv", e.target.value)} placeholder="npr. Rekonstrukcija društvenog doma" />
        </Field>
        <Field label="Program">
          <input className={inputClass} value={f.program ?? ""} onChange={(e) => set("program", e.target.value)} />
        </Field>
        <Field label="Vlasnik">
          <select className={inputClass} value={f.owner ?? ""} onChange={(e) => set("owner", e.target.value)}>
            {refs.team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.id === meId ? " (ja)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Faza">
          <select className={inputClass} value={f.faza} onChange={(e) => set("faza", e.target.value as ProjectFaza)}>
            {Object.entries(PROJECT_FAZA).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rok prijave">
          <input type="date" className={inputClass} value={f.rok_prijave ?? ""} onChange={(e) => set("rok_prijave", e.target.value)} />
        </Field>
        <Field label="Vrijednost projekta (EUR)">
          <input type="number" min={0} step="0.01" className={inputClass} value={f.iznos_projekta ?? ""} onChange={(e) => set("iznos_projekta", e.target.value)} />
        </Field>
        <Field label="Traženi / odobreni iznos potpore (EUR)">
          <input type="number" min={0} step="0.01" className={inputClass} value={f.iznos_potpore ?? ""} onChange={(e) => set("iznos_potpore", e.target.value)} />
        </Field>
        <Field label="Napomena" className="sm:col-span-2">
          <textarea rows={2} className={textareaClass} value={f.napomena ?? ""} onChange={(e) => set("napomena", e.target.value)} />
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
