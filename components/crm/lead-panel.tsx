"use client";

import * as React from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Building2,
  CheckSquare,
  Flame,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, Menu, MenuItem, Modal } from "./overlay";
import { ActivityFeed } from "./activity-feed";
import { TaskDialog } from "./task-dialog";
import { LeadForm } from "./lead-form";
import { Field, Notice, TriageBadge, inputClass, textareaClass } from "./ui";
import {
  archiveLead,
  assignLead,
  convertLead,
  loadLeadDetail,
  setHotLead,
  setLeadStatus,
  setTriage,
  unsetHotLead,
} from "@/lib/crm/actions/leads";
import { setTaskDone } from "@/lib/crm/actions/tasks";
import type { Activity, ClientOption, HotGroup, Lead, Task, TaskRefs } from "@/lib/crm/data";
import {
  CLIENT_STATUS,
  KLIJENT_TIP,
  LEAD_IZVOR,
  LEAD_STATUS,
  LEAD_STATUS_MANUAL,
  type ClientStatus,
  type LeadStatus,
} from "@/lib/crm/options";
import { fmtDateTime } from "@/lib/crm/format";
import { fmtDay } from "@/lib/crm/dates";
import type { StaffRole } from "@/lib/crm/roles";

type Notify = (r: { ok: boolean; message?: string; error?: string }) => void;

/** Bočni panel leada: status, vlasnik, trijaža, poziv/bilješka, zadaci, hot lead, pretvorba u klijenta. */
export function LeadPanel({
  lead,
  groups,
  clients,
  refs,
  me,
  today,
  onClose,
  notify,
}: {
  lead: Lead;
  groups: HotGroup[];
  clients: ClientOption[];
  refs: TaskRefs;
  me: { id: string; role: StaffRole };
  today: string;
  onClose: () => void;
  notify: Notify;
}) {
  const [acts, setActs] = React.useState<Activity[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [dialog, setDialog] = React.useState<null | "edit" | "task" | "hot" | "convert" | "lost">(null);
  const [feedVrsta, setFeedVrsta] = React.useState<"biljeska" | "poziv">("biljeska");
  const [feedKey, setFeedKey] = React.useState(0);
  const [pending, start] = React.useTransition();
  const id = lead.id;

  const reload = React.useCallback(() => {
    loadLeadDetail(id).then((d) => {
      setActs(d.activities);
      setTasks(d.tasks);
    });
  }, [id]);
  React.useEffect(() => {
    reload();
  }, [reload]);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      notify(r);
      reload();
    });

  const isSuradnik = me.role === "suradnik";
  const closed = lead.status === "pretvoren";
  const group = groups.find((g) => g.id === lead.hot_group_id);

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="max-w-2xl"
        title={
          <span className="flex items-center gap-2">
            {lead.hot_at && <Flame className="h-5 w-5 text-danger" />}
            <span className="text-muted-2">L-{lead.broj}</span> {lead.naziv}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={LEAD_STATUS[lead.status].tone}>{LEAD_STATUS[lead.status].label}</Badge>
            <Badge tone="neutral">{KLIJENT_TIP[lead.klijent_tip]}</Badge>
            <span className="text-xs">
              {LEAD_IZVOR[lead.izvor]} · primljeno {fmtDateTime(lead.created_at)}
            </span>
            {lead.archived_at && <Badge tone="outline">Arhiviran</Badge>}
          </span>
        }
        actions={
          <Menu trigger={<MoreHorizontal className="h-5 w-5" />}>
            <MenuItem onClick={() => setDialog("edit")}>
              <Pencil className="h-4 w-4" /> Uredi podatke
            </MenuItem>
            {!closed && lead.status !== "izgubljen" && (
              <MenuItem onClick={() => setDialog("lost")}>
                <XCircle className="h-4 w-4" /> Označi kao izgubljen
              </MenuItem>
            )}
            {lead.archived_at ? (
              <MenuItem onClick={() => run(() => archiveLead(lead.id, false))}>
                <ArchiveRestore className="h-4 w-4" /> Vrati iz arhive
              </MenuItem>
            ) : (
              <MenuItem danger onClick={() => run(() => archiveLead(lead.id, true))}>
                <Archive className="h-4 w-4" /> Arhiviraj lead
              </MenuItem>
            )}
          </Menu>
        }
      >
        {/* Brze radnje */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => {
              setFeedVrsta("poziv");
              setFeedKey((k) => k + 1);
              document.getElementById("lead-feed")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Phone className="h-4 w-4" /> Zabilježi poziv
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog("task")}>
            <CheckSquare className="h-4 w-4" /> Novi zadatak
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDialog("hot")}>
            <Flame className="h-4 w-4" /> {lead.hot_at ? "Hot lead" : "Označi kao hot"}
          </Button>
          {lead.jls_profile_id ? (
            <Link
              href={`/crm/klijenti/${lead.jls_profile_id}`}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-success-soft px-3 text-sm font-medium text-success hover:border-success"
            >
              <Building2 className="h-4 w-4" /> Otvori klijenta
            </Link>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setDialog("convert")}>
              <UserCheck className="h-4 w-4" /> Pretvori u klijenta
            </Button>
          )}
        </div>

        {lead.status === "izgubljen" && lead.razlog_gubitka && (
          <div className="mb-4">
            <Notice tone="warning">Razlog gubitka: {lead.razlog_gubitka}</Notice>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <select
              className={inputClass}
              value={lead.status}
              disabled={closed || pending}
              onChange={(e) => {
                const s = e.target.value as LeadStatus;
                if (s === "izgubljen") setDialog("lost");
                else run(() => setLeadStatus(lead.id, s));
              }}
            >
              {closed && <option value="pretvoren">Klijent (pretvoren)</option>}
              {LEAD_STATUS_MANUAL.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vlasnik">
            <select
              className={inputClass}
              value={lead.owner ?? ""}
              disabled={pending || isSuradnik}
              onChange={(e) => run(() => assignLead(lead.id, e.target.value || null))}
            >
              <option value="">Nedodijeljen</option>
              {refs.team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.id === me.id ? " (ja)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Kontakt */}
        <div className="mt-4 grid gap-x-4 gap-y-1.5 rounded-lg border border-border p-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted">Kontakt: </span>
            {lead.kontakt_ime || "—"}
          </div>
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-muted-2" />
            {lead.telefon ? (
              <a className="text-brand-ink hover:underline" href={`tel:${lead.telefon.replace(/\s/g, "")}`}>
                {lead.telefon}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-muted-2" />
            {lead.email ? (
              <a className="truncate text-brand-ink hover:underline" href={`mailto:${lead.email}`}>
                {lead.email}
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-muted">Županija: </span>
            {lead.zupanija || "—"}
          </div>
          {lead.oib && (
            <div>
              <span className="text-muted">OIB: </span>
              {lead.oib}
            </div>
          )}
          {lead.interes && (
            <div className="sm:col-span-2">
              <span className="text-muted">Interes: </span>
              {lead.interes}
            </div>
          )}
          {lead.sektori.length > 0 && (
            <div className="sm:col-span-2">
              <span className="text-muted">Sektori: </span>
              {lead.sektori.join(", ")}
            </div>
          )}
          {lead.napomena && <div className="whitespace-pre-wrap text-muted sm:col-span-2">{lead.napomena}</div>}
          {lead.hot_at && (
            <div className="sm:col-span-2">
              <span className="text-muted">Hot: </span>
              {group ? group.naziv : "bez natječaja"}
              {lead.hot_note ? ` · ${lead.hot_note}` : ""}
            </div>
          )}
        </div>

        {/* Trijaža */}
        <Triage key={`${lead.t_prihvatljivost}-${lead.t_dokumentacija}-${lead.t_financije}`} lead={lead} onSave={(t) => run(() => setTriage(lead.id, t))} pending={pending} />

        {/* Zadaci */}
        <div className="mt-5">
          <div className="mb-2 flex items-center">
            <h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Zadaci</h3>
            <Button size="sm" variant="ghost" onClick={() => setDialog("task")}>
              <Plus className="h-4 w-4" /> Zadatak
            </Button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted">Nema otvorenih zadataka.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!t.done_at}
                    onChange={() => run(() => setTaskDone(t.id, !t.done_at))}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  <Link href={`/crm/zadaci?zadatak=${t.id}`} className={`flex-1 hover:underline ${t.done_at ? "text-muted line-through" : ""}`}>
                    {t.naslov}
                  </Link>
                  <span className={`text-xs tabular ${!t.done_at && t.rok && t.rok < today ? "font-semibold text-danger" : "text-muted"}`}>
                    {t.rok ? fmtDay(t.rok) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Povijest */}
        <div id="lead-feed" className="mt-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">Povijest</h3>
          <ActivityFeed key={feedKey} target={{ lead_id: lead.id }} items={acts} onAdded={reload} initialVrsta={feedVrsta} />
        </div>
      </Drawer>

      {dialog === "edit" && (
        <LeadForm
          lead={lead}
          team={refs.team}
          meId={me.id}
          lockOwner={isSuradnik}
          onClose={() => setDialog(null)}
          onSaved={(_, m) => notify({ ok: true, message: m })}
        />
      )}
      {dialog === "task" && (
        <TaskDialog
          open
          onClose={() => setDialog(null)}
          refs={refs}
          meId={me.id}
          lockOwner={isSuradnik}
          preset={{ lead_id: lead.id, naslov: `Nazvati: ${lead.naziv}`, vrsta: "poziv", owner: lead.owner ?? me.id }}
          onSaved={() => {
            notify({ ok: true, message: "Zadatak je spremljen." });
            reload();
          }}
        />
      )}
      {dialog === "hot" && <HotDialog lead={lead} groups={groups} onClose={() => setDialog(null)} run={run} />}
      {dialog === "convert" && (
        <ConvertDialog lead={lead} clients={clients} onClose={() => setDialog(null)} notify={notify} />
      )}
      {dialog === "lost" && <LostDialog onClose={() => setDialog(null)} onSave={(r) => run(() => setLeadStatus(lead.id, "izgubljen", r))} />}
    </>
  );
}

function Triage({
  lead,
  onSave,
  pending,
}: {
  lead: Lead;
  onSave: (t: { prihvatljivost: number | null; dokumentacija: number | null; financije: number | null }) => void;
  pending: boolean;
}) {
  const [p, setP] = React.useState(lead.t_prihvatljivost ?? 0);
  const [d, setD] = React.useState(lead.t_dokumentacija ?? 0);
  const [f, setFi] = React.useState(lead.t_financije ?? 0);
  const total = Math.round(0.5 * p + 0.25 * d + 0.25 * f);
  const dirty = p !== (lead.t_prihvatljivost ?? 0) || d !== (lead.t_dokumentacija ?? 0) || f !== (lead.t_financije ?? 0);
  const rows: [string, string, number, (n: number) => void][] = [
    ["Prihvatljivost", "50 %", p, setP],
    ["Dokumentacija", "25 %", d, setD],
    ["Financije", "25 %", f, setFi],
  ];
  return (
    <div className="mt-5 rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Trijaža</h3>
        <TriageBadge value={lead.trijaza == null && !dirty ? null : total} />
        {dirty && (
          <Button size="sm" disabled={pending} onClick={() => onSave({ prihvatljivost: p, dokumentacija: d, financije: f })}>
            Spremi trijažu
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {rows.map(([label, w, v, set]) => (
          <label key={label} className="flex items-center gap-3 text-sm">
            <span className="w-32 text-muted">
              {label} <span className="text-xs text-muted-2">({w})</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={v}
              onChange={(e) => set(Number(e.target.value))}
              className="flex-1 accent-[var(--brand)]"
            />
            <span className="w-8 text-right tabular">{v}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function HotDialog({
  lead,
  groups,
  onClose,
  run,
}: {
  lead: Lead;
  groups: HotGroup[];
  onClose: () => void;
  run: (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => void;
}) {
  const [g, setG] = React.useState(lead.hot_group_id ?? "");
  const [note, setNote] = React.useState(lead.hot_note ?? "");
  return (
    <Modal
      open
      onClose={onClose}
      title="Hot lead — natječaj i bilješka"
      footer={
        <>
          {lead.hot_at && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto text-danger"
              onClick={() => {
                run(() => unsetHotLead(lead.id));
                onClose();
              }}
            >
              Makni iz hot leadova
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            onClick={() => {
              run(() => setHotLead(lead.id, g || null, note));
              onClose();
            }}
          >
            Spremi
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Natječaj" hint="Natječaje (kartice) dodaješ u Hot leadovima gumbom „+ Natječaj“.">
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

function ConvertDialog({
  lead,
  clients,
  onClose,
  notify,
}: {
  lead: Lead;
  clients: ClientOption[];
  onClose: () => void;
  notify: Notify;
}) {
  const [mode, setMode] = React.useState<"novi" | "postojeci">("novi");
  const [status, setStatus] = React.useState<ClientStatus>("trial");
  const [existing, setExisting] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [doneId, setDoneId] = React.useState<string | null>(null);

  function go() {
    setError(null);
    start(async () => {
      const r = await convertLead(lead.id, mode === "postojeci" ? existing || null : null, status);
      if (!r.ok) setError(r.error);
      else {
        notify(r);
        setDoneId(r.data ?? null);
      }
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Pretvori L-${lead.broj} u klijenta`}
      footer={
        doneId ? (
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Zatvori
            </Button>
            <Link
              href={`/crm/klijenti/${doneId}`}
              className="inline-flex h-8 items-center rounded-md bg-brand px-3 text-sm font-medium text-brand-contrast"
            >
              Otvori klijenta
            </Link>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Odustani
            </Button>
            <Button size="sm" disabled={pending || (mode === "postojeci" && !existing)} onClick={go}>
              {pending ? "Pretvaram…" : mode === "novi" ? "Otvori klijenta" : "Poveži"}
            </Button>
          </>
        )
      }
    >
      {doneId ? (
        <Notice tone="success">Gotovo. Lead je označen kao „Klijent“, a povijest leada ostaje na leadu.</Notice>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" checked={mode === "novi"} onChange={() => setMode("novi")} className="mt-1" />
            <span>
              <b>Novi klijent</b> — otvara se klijent u CRM-u i u aplikaciji EU Radar (profil za praćenje natječaja), s kontaktom
              i podacima iz leada.
            </span>
          </label>
          {mode === "novi" && (
            <Field label="Status pretplate na EU Radar" className="ml-6">
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
                {Object.entries(CLIENT_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <label className="flex items-start gap-2">
            <input type="radio" checked={mode === "postojeci"} onChange={() => setMode("postojeci")} className="mt-1" />
            <span>
              <b>Postojeći klijent</b> — lead se samo poveže s klijentom koji već postoji.
            </span>
          </label>
          {mode === "postojeci" && (
            <Field label="Klijent" className="ml-6">
              <select className={inputClass} value={existing} onChange={(e) => setExisting(e.target.value)}>
                <option value="">Odaberi…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.naziv}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      )}
    </Modal>
  );
}

function LostDialog({ onClose, onSave }: { onClose: () => void; onSave: (razlog: string) => void }) {
  const [r, setR] = React.useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Označi kao izgubljen"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSave(r);
              onClose();
            }}
          >
            Spremi
          </Button>
        </>
      }
    >
      <Field label="Razlog (neobavezno)">
        <input autoFocus className={inputClass} value={r} onChange={(e) => setR(e.target.value)} placeholder="npr. nije prihvatljiv, odabrao drugog konzultanta…" />
      </Field>
    </Modal>
  );
}
