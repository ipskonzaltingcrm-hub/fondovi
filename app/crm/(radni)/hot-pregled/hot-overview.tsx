"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, inputClass, textareaClass } from "@/components/crm/ui";
import { saveHotCell } from "@/lib/crm/actions/leads";
import { saveHotDeadline } from "@/lib/crm/actions/hot";
import type { HotGroup, Lead } from "@/lib/crm/data";
import { HOT_NO_STAGE_ORDER, HOT_STAGES, type HotStage } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";
import { cn } from "@/lib/utils";
import { groupDeadline } from "../hot-leadovi/hot-view";

const NONE = "__none__";

export function HotOverview({ groups, leads, today }: { groups: HotGroup[]; leads: Lead[]; today: string }) {
  const [cell, setCell] = React.useState<Lead | null>(null);
  const [deadline, setDeadline] = React.useState<HotGroup | null>(null);
  const { show, node } = useFlash();

  const cols: { id: string; group: HotGroup | null }[] = [
    ...groups.map((g) => ({ id: g.id, group: g })),
    ...(leads.some((l) => !l.hot_group_id) ? [{ id: NONE, group: null }] : []),
  ];
  const order = (l: Lead) => (l.hot_stage ? HOT_STAGES[l.hot_stage].order : HOT_NO_STAGE_ORDER);

  if (!cols.length) return <Empty title="Još nema hot leadova">Dodaj ih u kartici Hot leadovi.</Empty>;

  return (
    <div className="space-y-3">
      {node}
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        {(Object.keys(HOT_STAGES) as HotStage[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", HOT_STAGES[s].dot)} /> {HOT_STAGES[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-border-strong" /> bez boje
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: cols.length * 170 }}>
          <thead>
            <tr>
              {cols.map(({ id, group }) => {
                const rok = group ? groupDeadline(group) : null;
                const past = rok != null && rok < today;
                return (
                  <th key={id} className="border-b border-r border-border bg-surface-2 px-2 py-2 text-left align-top last:border-r-0">
                    <div className="truncate font-display font-semibold" title={group?.naziv}>
                      {group ? group.sifra || group.naziv : "Bez natječaja"}
                    </div>
                    {group && (
                      <button
                        onClick={() => setDeadline(group)}
                        className={cn("mt-0.5 text-xs font-normal hover:underline", past ? "text-danger" : rok ? "text-muted" : "text-muted-2")}
                      >
                        {rok ? `rok ${fmtDay(rok)}${past ? " · prošao" : ""}` : "rok?"}
                        {group.deadline_note ? ` · ${group.deadline_note}` : ""}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {cols.map(({ id }) => {
                const list = leads
                  .filter((l) => (l.hot_group_id ?? NONE) === id)
                  .sort((a, b) => order(a) - order(b) || a.naziv.localeCompare(b.naziv, "hr"));
                return (
                  <td key={id} className="border-r border-border p-1.5 align-top last:border-r-0">
                    <div className="space-y-1">
                      {list.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => setCell(l)}
                          title={l.hot_note ?? undefined}
                          className={cn(
                            "block w-full rounded px-2 py-1 text-left hover:ring-1 hover:ring-brand",
                            l.hot_stage ? HOT_STAGES[l.hot_stage].cell : "bg-background",
                          )}
                        >
                          <div className="flex items-center gap-1">
                            <span className="truncate font-medium">{l.kontakt_ime || l.naziv}</span>
                            {l.status === "ponuda" && <span className="ml-auto rounded bg-brand px-1 text-[10px] font-bold text-brand-contrast">PON</span>}
                            {l.status === "pretvoren" && <span className="ml-auto rounded bg-success px-1 text-[10px] font-bold text-white">Klijent</span>}
                          </div>
                          {l.kontakt_ime && <div className="truncate text-xs opacity-75">{l.naziv}</div>}
                        </button>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {cell && <CellDialog lead={cell} onClose={() => setCell(null)} notify={show} />}
      {deadline && <DeadlineDialog group={deadline} onClose={() => setDeadline(null)} notify={show} />}
    </div>
  );
}

function CellDialog({ lead, onClose, notify }: { lead: Lead; onClose: () => void; notify: (r: { ok: boolean; error?: string; message?: string }) => void }) {
  const [stage, setStage] = React.useState<HotStage | null>(lead.hot_stage);
  const [note, setNote] = React.useState(lead.hot_note ?? "");
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title={`L-${lead.broj} ${lead.naziv}`}
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
                const r = await saveHotCell(lead.id, stage, note);
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
      <div className="space-y-3">
        <Field label="Semafor">
          <div className="grid gap-1.5">
            {[...(Object.keys(HOT_STAGES) as HotStage[]), null].map((s) => (
              <label key={s ?? "none"} className="flex items-center gap-2 text-sm">
                <input type="radio" checked={stage === s} onChange={() => setStage(s)} />
                <span className={cn("h-3 w-3 rounded-full", s ? HOT_STAGES[s].dot : "border border-border-strong")} />
                {s ? HOT_STAGES[s].label : "Bez boje"}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Bilješka (zajednička s Hot leadovima)">
          <textarea rows={3} className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function DeadlineDialog({ group, onClose, notify }: { group: HotGroup; onClose: () => void; notify: (r: { ok: boolean; error?: string; message?: string }) => void }) {
  const [d, setD] = React.useState(group.deadline_on ?? group.call?.rok_prijave ?? "");
  const [note, setNote] = React.useState(group.deadline_note ?? "");
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title={group.sifra || group.naziv}
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
                const r = await saveHotDeadline(group.id, d || null, note);
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rok prijave" hint={group.call?.rok_prijave ? `EU Radar: ${fmtDay(group.call.rok_prijave)}` : undefined}>
          <input type="date" className={inputClass} value={d} onChange={(e) => setD(e.target.value)} />
        </Field>
        <Field label="Oznaka uz rok (npr. TP)" hint="Najviše 40 znakova.">
          <input maxLength={40} className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
