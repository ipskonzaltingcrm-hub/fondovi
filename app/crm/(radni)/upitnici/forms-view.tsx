"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, ExternalLink, KeyRound, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, inputClass, textareaClass } from "@/components/crm/ui";
import { rotateFormToken, saveForm, type FormInput } from "@/lib/crm/actions/forms";
import type { TeamMember } from "@/lib/crm/data";
import { fmtAgo, fmtDateTime } from "@/lib/crm/format";

export type FormRow = {
  id: string;
  naziv: string;
  uvod: string | null;
  token: string;
  owner: string | null;
  create_task: boolean;
  active: boolean;
  created_at: string;
  leads: number;
  leads30: number;
  errors: number;
  lastAt: string | null;
};
export type Submission = { id: number; form_id: string; at: string; outcome: "novi" | "postojeci" | "greska"; lead_id: string | null; error: string | null; payload: Record<string, unknown> };

export function FormsView({
  forms,
  submissions,
  team,
  isAdmin,
  origin,
}: {
  forms: FormRow[];
  submissions: Submission[];
  team: TeamMember[];
  isAdmin: boolean;
  origin: string;
}) {
  const [edit, setEdit] = React.useState<FormRow | "novi" | null>(null);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const ownerName = (id: string | null) => team.find((t) => t.id === id)?.name ?? "automatski (član najdulje bez novog leada)";
  const link = (f: FormRow) => `${origin}/upitnik/${f.token}`;

  return (
    <div className="space-y-4">
      {node}
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEdit("novi")}>
            <Plus className="h-4 w-4" /> Novi upitnik
          </Button>
        </div>
      )}
      {forms.length === 0 ? (
        <Empty title="Nema upitnika" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {forms.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold">{f.naziv}</div>
                  <div className="mt-0.5 text-xs text-muted">Vlasnik leadova: {ownerName(f.owner)}</div>
                </div>
                {!f.active && <Badge tone="outline">Isključen</Badge>}
                {isAdmin && (
                  <Button size="sm" variant="ghost" onClick={() => setEdit(f)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-surface-2 p-2">
                  <div className="font-display text-xl font-bold tabular">{f.leads}</div>
                  <div className="text-[11px] text-muted">leadova ukupno</div>
                </div>
                <div className="rounded-md bg-surface-2 p-2">
                  <div className="font-display text-xl font-bold tabular">{f.leads30}</div>
                  <div className="text-[11px] text-muted">zadnjih 30 dana</div>
                </div>
                <div className="rounded-md bg-surface-2 p-2">
                  <div className={`font-display text-xl font-bold tabular ${f.errors ? "text-danger" : ""}`}>{f.errors}</div>
                  <div className="text-[11px] text-muted">grešaka</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={f.create_task ? "info" : "neutral"}>{f.create_task ? "Zadatak „Nazovi u 24 h“" : "Bez zadatka"}</Badge>
                <span>Zadnja predaja: {f.lastAt ? fmtAgo(f.lastAt) : "—"}</span>
              </div>
              {isAdmin && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <a href={link(f)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
                    <ExternalLink className="h-4 w-4" /> Javni link
                  </a>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(link(f));
                      show({ ok: true, message: "Poveznica je kopirana." });
                    }}
                  >
                    <Copy className="h-4 w-4" /> Kopiraj
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => confirm("Nova poveznica? Stara prestaje raditi (npr. ako je procurila).") && start(async () => show(await rotateFormToken(f.id)))}
                  >
                    <KeyRound className="h-4 w-4" /> Nova poveznica
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {isAdmin && (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-2">Dnevnik predaja (zadnjih 200)</div>
          {submissions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Još nema predaja. Probno ispuni upitnik preko javnog linka.</p>
          ) : (
            <ul className="divide-y divide-border">
              {submissions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-32 shrink-0 text-xs text-muted">{fmtDateTime(s.at)}</span>
                  <Badge tone={s.outcome === "novi" ? "success" : s.outcome === "postojeci" ? "info" : "danger"}>
                    {s.outcome === "novi" ? "Novi lead" : s.outcome === "postojeci" ? "Postojeći lead" : "Greška"}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">
                    {String(s.payload?.naziv ?? "")} {s.error ? <span className="text-danger">· {s.error}</span> : null}
                  </span>
                  {s.lead_id && (
                    <Link href={`/crm/leadovi?lead=${s.lead_id}`} className="text-xs text-brand-ink hover:underline">
                      lead
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {!isAdmin && <Notice>Upitnike, poveznice i dnevnik predaja uređuju administratori.</Notice>}

      {edit && <FormDialog form={edit === "novi" ? null : edit} team={team} onClose={() => setEdit(null)} notify={show} />}
    </div>
  );
}

function FormDialog({
  form,
  team,
  onClose,
  notify,
}: {
  form: FormRow | null;
  team: TeamMember[];
  onClose: () => void;
  notify: (r: { ok: boolean; message?: string; error?: string }) => void;
}) {
  const [f, setF] = React.useState<FormInput>({
    naziv: form?.naziv ?? "",
    uvod: form?.uvod ?? "",
    owner: form?.owner ?? "",
    create_task: form?.create_task ?? true,
    active: form?.active ?? true,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title={form ? "Uredi upitnik" : "Novi upitnik"}
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
                const r = await saveForm(form?.id ?? null, f);
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
      <div className="space-y-3">
        <Field label="Naziv (naslov forme)">
          <input className={inputClass} value={f.naziv} onChange={(e) => setF({ ...f, naziv: e.target.value })} />
        </Field>
        <Field label="Uvodni tekst">
          <textarea rows={3} className={textareaClass} value={f.uvod ?? ""} onChange={(e) => setF({ ...f, uvod: e.target.value })} />
        </Field>
        <Field label="Zadani vlasnik leadova" hint="Bez vlasnika: lead dobiva konzultant ili administrator koji je najdulje bez automatskog leada.">
          <select className={inputClass} value={f.owner ?? ""} onChange={(e) => setF({ ...f, owner: e.target.value })}>
            <option value="">Automatski</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.create_task} onChange={(e) => setF({ ...f, create_task: e.target.checked })} /> Napravi zadatak „Nazovi u 24 h“
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Upitnik je aktivan
        </label>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
