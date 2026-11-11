"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Flame, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu, MenuItem, Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, TriageBadge, inputClass, textareaClass } from "@/components/crm/ui";
import { createHotGroup, deleteHotGroup, updateHotGroup, type HotGroupInput } from "@/lib/crm/actions/hot";
import { searchLeads, setHotLead, unsetHotLead, type LeadSearchHit } from "@/lib/crm/actions/leads";
import type { CallOption, HotGroup, Lead, TeamMember } from "@/lib/crm/data";
import { LEAD_STATUS } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";
import { cn } from "@/lib/utils";

const NONE = "__none__";
type Notify = (r: { ok: boolean; message?: string; error?: string }) => void;

/** Rok natječaja: ručno upisan ili iz EU Radara. */
export function groupDeadline(g: HotGroup): string | null {
  return g.deadline_on ?? g.call?.rok_prijave ?? null;
}

export function HotView({
  groups,
  leads,
  calls,
  team,
  canEditGroups,
}: {
  groups: HotGroup[];
  leads: Lead[];
  calls: CallOption[];
  team: TeamMember[];
  canEditGroups: boolean;
}) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [groupDialog, setGroupDialog] = React.useState<HotGroup | "novi" | null>(null);
  const { show, node } = useFlash();

  const byGroup = new Map<string, Lead[]>();
  for (const l of leads) {
    const k = l.hot_group_id ?? NONE;
    byGroup.set(k, [...(byGroup.get(k) ?? []), l]);
  }
  const latest = (k: string) =>
    Math.max(0, ...(byGroup.get(k) ?? []).map((l) => Math.max(new Date(l.last_activity_at).getTime(), new Date(l.hot_at!).getTime())));
  const cards = [...groups]
    .filter((g) => !q || [g.naziv, g.sifra, g.podnaslov].join(" ").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => latest(b.id) - latest(a.id) || a.position - b.position);

  const current = open === NONE ? null : groups.find((g) => g.id === open) ?? null;

  if (open) {
    return (
      <>
        {node}
        <GroupDetail
          group={current}
          groups={groups}
          leads={byGroup.get(open) ?? []}
          team={team}
          canEditGroups={canEditGroups}
          onBack={() => setOpen(null)}
          onEdit={() => current && setGroupDialog(current)}
          notify={show}
        />
        {groupDialog && (
          <GroupDialog group={groupDialog === "novi" ? null : groupDialog} calls={calls} onClose={() => setGroupDialog(null)} notify={show} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {node}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input className={cn(inputClass, "pl-8")} placeholder="Pretraži natječaje…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {canEditGroups && (
          <Button size="sm" onClick={() => setGroupDialog("novi")}>
            <Plus className="h-4 w-4" /> Natječaj
          </Button>
        )}
      </div>

      {cards.length === 0 && !byGroup.has(NONE) ? (
        <Empty title="Još nema hot leadova">
          Dodaj natječaj gumbom „+ Natječaj“, a zatim leadove. Lead možeš označiti i u Leadovima gumbom „Označi kao hot“.
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((g) => (
            <GroupCard key={g.id} group={g} count={byGroup.get(g.id)?.length ?? 0} onOpen={() => setOpen(g.id)} />
          ))}
          {byGroup.has(NONE) && (
            <button onClick={() => setOpen(NONE)} className="rounded-lg border border-dashed border-border-strong bg-surface p-4 text-left hover:border-brand">
              <div className="font-display font-semibold">Bez natječaja</div>
              <div className="mt-1 text-sm text-muted">{byGroup.get(NONE)!.length} hot leadova bez dodijeljenog natječaja</div>
            </button>
          )}
        </div>
      )}

      {groupDialog && (
        <GroupDialog group={groupDialog === "novi" ? null : groupDialog} calls={calls} onClose={() => setGroupDialog(null)} notify={show} />
      )}
    </div>
  );
}

function GroupCard({ group, count, onOpen }: { group: HotGroup; count: number; onOpen: () => void }) {
  const rok = groupDeadline(group);
  return (
    <button onClick={onOpen} className="group overflow-hidden rounded-lg border border-border bg-surface text-left transition-colors hover:border-brand">
      <div className="flex items-center gap-3 bg-gradient-to-br from-brand to-brand-deep px-4 py-3 text-brand-contrast">
        <Flame className="h-5 w-5 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-bold">{group.sifra || group.naziv}</div>
          {group.sifra && <div className="truncate text-xs opacity-80">{group.naziv}</div>}
        </div>
        <span className="rounded-full bg-brand-contrast/15 px-2 py-0.5 text-sm font-semibold tabular">{count}</span>
      </div>
      <div className="px-4 py-2.5 text-sm">
        <div className="truncate text-muted">{group.podnaslov || group.call?.naslov || "—"}</div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-2">
          <CalendarClock className="h-3.5 w-3.5" /> {rok ? `rok ${fmtDay(rok)}` : "rok nije upisan"}
        </div>
      </div>
    </button>
  );
}

function GroupDetail({
  group,
  groups,
  leads,
  team,
  canEditGroups,
  onBack,
  onEdit,
  notify,
}: {
  group: HotGroup | null;
  groups: HotGroup[];
  leads: Lead[];
  team: TeamMember[];
  canEditGroups: boolean;
  onBack: () => void;
  onEdit: () => void;
  notify: Notify;
}) {
  const [adding, setAdding] = React.useState(false);
  const [noteFor, setNoteFor] = React.useState<Lead | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const rok = group ? groupDeadline(group) : null;
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => notify(await fn()));
  const others = groups.filter((g) => g.id !== group?.id);
  const ownerName = (id: string | null) => team.find((t) => t.id === id)?.name ?? "—";

  function drop(target: string | null, e: React.DragEvent) {
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    if (id) run(() => setHotLead(id, target));
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Svi natječaji
      </button>
      <div className="flex items-start gap-3 rounded-lg bg-gradient-to-br from-brand to-brand-deep p-5 text-brand-contrast">
        <Flame className="mt-1 h-6 w-6 opacity-80" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-bold">{group ? group.sifra || group.naziv : "Bez natječaja"}</h2>
          {group?.sifra && <div className="opacity-90">{group.naziv}</div>}
          {group?.podnaslov && <div className="mt-1 text-sm opacity-80">{group.podnaslov}</div>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-90">
            <span>{leads.length} leadova</span>
            {rok && <span>Rok prijave {fmtDay(rok)}</span>}
            {group?.call && (
              <Link href={`/pozivi/${group.call.slug}`} className="underline underline-offset-2">
                Natječaj u EU Radaru
              </Link>
            )}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Lead
        </Button>
        {group && canEditGroups && (
          <Menu trigger={<MoreHorizontal className="h-5 w-5 text-brand-contrast" />}>
            <MenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Uredi karticu
            </MenuItem>
            <MenuItem
              danger
              onClick={() => {
                if (confirm(`Obrisati natječaj „${group.naziv}“? Leadovi ostaju hot, u „Bez natječaja“.`))
                  start(async () => {
                    const r = await deleteHotGroup(group.id);
                    notify(r);
                    if (r.ok) onBack();
                  });
              }}
            >
              <Trash2 className="h-4 w-4" /> Obriši natječaj
            </MenuItem>
          </Menu>
        )}
      </div>

      {(others.length > 0 || group) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">Premjesti povlačenjem na:</span>
          {[...others.map((g) => ({ id: g.id as string | null, label: g.sifra || g.naziv })), ...(group ? [{ id: null, label: "Bez natječaja" }] : [])].map((c) => (
            <span
              key={c.id ?? NONE}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(c.id ?? NONE);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => drop(c.id, e)}
              className={cn(
                "rounded-full border px-2.5 py-1",
                dragOver === (c.id ?? NONE) ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted",
              )}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}

      {leads.length === 0 ? (
        <Empty title="Nema leadova na ovom natječaju">Dodaj ih gumbom „+ Lead“.</Empty>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {leads.map((l) => (
              <li
                key={l.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", l.id)}
                className="flex cursor-grab items-center gap-3 px-4 py-2.5 active:cursor-grabbing"
              >
                <TriageBadge value={l.trijaza} />
                <div className="min-w-0 flex-1">
                  <Link href={`/crm/leadovi?lead=${l.id}`} className="font-medium hover:text-brand-ink hover:underline">
                    <span className="text-muted-2">L-{l.broj}</span> {l.naziv}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {LEAD_STATUS[l.status].label}
                    {l.kontakt_ime ? ` · ${l.kontakt_ime}` : ""}
                    {l.hot_note ? ` · ${l.hot_note}` : ""}
                  </div>
                </div>
                <span className="hidden w-32 truncate text-right text-sm text-muted sm:block">{ownerName(l.owner)}</span>
                <Menu trigger={<MoreHorizontal className="h-4 w-4" />}>
                  <MenuItem onClick={() => setNoteFor(l)}>
                    <Pencil className="h-4 w-4" /> Natječaj i bilješka
                  </MenuItem>
                  <MenuItem danger onClick={() => run(() => unsetHotLead(l.id))}>
                    <X className="h-4 w-4" /> Makni iz hot leadova
                  </MenuItem>
                </Menu>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {pending && <p className="text-xs text-muted">Spremam…</p>}

      {adding && <AddLeadDialog groupId={group?.id ?? null} onClose={() => setAdding(false)} notify={notify} />}
      {noteFor && <NoteDialog lead={noteFor} groups={groups} onClose={() => setNoteFor(null)} notify={notify} />}
    </div>
  );
}

function AddLeadDialog({ groupId, onClose, notify }: { groupId: string | null; onClose: () => void; notify: Notify }) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<LeadSearchHit[]>([]);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    const t = setTimeout(() => {
      searchLeads(q).then(setHits);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <Modal open onClose={onClose} title="Dodaj lead">
      <input
        autoFocus
        className={inputClass}
        placeholder="Ime, organizacija, L-123, mobitel ili e-mail…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto">
        {q.trim().length >= 2 && hits.length === 0 && <li className="py-3 text-sm text-muted">Nema rezultata.</li>}
        {hits.map((h) => (
          <li key={h.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1 text-sm">
              <span className="text-muted-2">L-{h.broj}</span> {h.naziv}
              {h.kontakt_ime && <span className="text-muted"> · {h.kontakt_ime}</span>}
              {h.hot && <span className="ml-1 text-xs text-danger">(već hot)</span>}
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await setHotLead(h.id, groupId);
                  notify(r);
                  if (r.ok) onClose();
                })
              }
            >
              Dodaj
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function NoteDialog({ lead, groups, onClose, notify }: { lead: Lead; groups: HotGroup[]; onClose: () => void; notify: Notify }) {
  const [g, setG] = React.useState(lead.hot_group_id ?? "");
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
                const r = await setHotLead(lead.id, g || null, note);
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
        <Field label="Natječaj">
          <select className={inputClass} value={g} onChange={(e) => setG(e.target.value)}>
            <option value="">Bez natječaja</option>
            {groups.map((x) => (
              <option key={x.id} value={x.id}>
                {x.sifra ? `${x.sifra} · ` : ""}
                {x.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bilješka">
          <textarea rows={3} className={textareaClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function GroupDialog({
  group,
  calls,
  onClose,
  notify,
}: {
  group: HotGroup | null;
  calls: CallOption[];
  onClose: () => void;
  notify: Notify;
}) {
  const [f, setF] = React.useState<HotGroupInput>({
    naziv: group?.naziv ?? "",
    sifra: group?.sifra ?? "",
    podnaslov: group?.podnaslov ?? "",
    call_id: group?.call_id ?? "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function pickCall(id: string) {
    const c = calls.find((x) => x.id === id);
    setF((p) => ({
      ...p,
      call_id: id,
      naziv: p.naziv || (c ? c.naslov : ""),
      podnaslov: p.podnaslov || (c ? c.program : ""),
    }));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={group ? "Uredi karticu natječaja" : "Novi natječaj za hot leadove"}
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
                const r = group ? await updateHotGroup(group.id, f) : await createHotGroup(f);
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
        <Field label="Natječaj iz EU Radara (neobavezno)" hint="Ako ga odabereš, rok prijave i poveznica dolaze iz EU Radara.">
          <select className={inputClass} value={f.call_id ?? ""} onChange={(e) => pickCall(e.target.value)}>
            <option value="">— bez veze —</option>
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naslov.length > 90 ? c.naslov.slice(0, 90) + "…" : c.naslov}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
          <Field label="Šifra (npr. 73.10)">
            <input className={inputClass} value={f.sifra ?? ""} onChange={(e) => setF({ ...f, sifra: e.target.value })} />
          </Field>
          <Field label="Naziv">
            <input autoFocus className={inputClass} value={f.naziv} onChange={(e) => setF({ ...f, naziv: e.target.value })} />
          </Field>
        </div>
        <Field label="Podnaslov">
          <input className={inputClass} value={f.podnaslov ?? ""} onChange={(e) => setF({ ...f, podnaslov: e.target.value })} />
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
