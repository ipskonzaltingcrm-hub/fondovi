"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckSquare, ExternalLink, FileText, FolderPlus, Mail, Pencil, Phone, Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActivityFeed } from "@/components/crm/activity-feed";
import { ClientForm } from "@/components/crm/client-form";
import { TaskDialog } from "@/components/crm/task-dialog";
import { TaskDrawer } from "@/components/crm/task-drawer";
import { Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, Tabs, inputClass } from "@/components/crm/ui";
import { removeContact, saveContact, setPrimaryContact, type ContactInput } from "@/lib/crm/actions/clients";
import { setTaskDone } from "@/lib/crm/actions/tasks";
import type { Activity, ClientRow, Lead, Task, TaskRefs } from "@/lib/crm/data";
import { CLIENT_STATUS, JLS_TIP, KLIJENT_TIP, LEAD_STATUS } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";
import { fmtDate } from "@/lib/crm/format";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

export type Contact = { id: string; ime: string; uloga: string | null; email: string | null; telefon: string | null; primarni: boolean };
export type MatchItem = {
  slug: string;
  naslov: string;
  davatelj: string;
  status: string;
  rok: string | null;
  score: number;
  reasons: string[];
};

type Tab = "aktivnosti" | "zadaci" | "natjecaji" | "leadovi";

export function ClientDetail({
  client,
  contacts,
  activities,
  tasks,
  leads,
  matches,
  refs,
  me,
  today,
}: {
  client: ClientRow;
  contacts: Contact[];
  activities: Activity[];
  tasks: Task[];
  leads: Lead[];
  matches: MatchItem[];
  refs: TaskRefs;
  me: { id: string; role: StaffRole };
  today: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("aktivnosti");
  const [editing, setEditing] = React.useState(false);
  const [newTask, setNewTask] = React.useState(false);
  const [openTask, setOpenTask] = React.useState<string | null>(null);
  const [contact, setContact] = React.useState<Contact | "novi" | null>(null);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();
  const primary = contacts.find((c) => c.primarni) ?? contacts[0];
  const phone = client.crm?.telefon || primary?.telefon;
  const email = client.crm?.email || primary?.email;
  const owner = refs.team.find((t) => t.id === client.crm?.owner)?.name ?? "—";
  const openTasks = tasks.filter((t) => !t.done_at);
  const selectedTask = tasks.find((t) => t.id === openTask) ?? null;
  const isSuradnik = me.role === "suradnik";

  return (
    <div className="space-y-5">
      {node}
      <Link href="/crm/klijenti" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Klijenti
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">
              {KLIJENT_TIP[client.klijent_tip]}
              {client.tip ? ` · ${JLS_TIP[client.tip]}` : ""}
            </Badge>
            <Badge tone={CLIENT_STATUS[client.status]?.tone ?? "neutral"}>EU Radar: {CLIENT_STATUS[client.status]?.label ?? client.status}</Badge>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{client.naziv}</h1>
          <p className="mt-1 text-sm text-muted">
            {client.zupanija ?? "—"} · vlasnik {owner} · u EU Radaru od {fmtDate(client.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex h-8 items-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-brand-contrast">
              <Phone className="h-4 w-4" /> Nazovi
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
              <Mail className="h-4 w-4" /> E-mail
            </a>
          )}
          <Button size="sm" variant="secondary" onClick={() => setNewTask(true)}>
            <CheckSquare className="h-4 w-4" /> Zadatak
          </Button>
          {!isSuradnik && (
            <Link href={`/crm/projekti?novi=1&klijent=${client.id}`} className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
              <FolderPlus className="h-4 w-4" /> Novi projekt
            </Link>
          )}
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Uredi
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-2">Podaci</h2>
          <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">OIB</dt>
            <dd>{client.crm?.oib || "—"}</dd>
            <dt className="text-muted">E-mail</dt>
            <dd className="truncate">{client.crm?.email || "—"}</dd>
            <dt className="text-muted">Telefon</dt>
            <dd>{client.crm?.telefon || "—"}</dd>
            <dt className="text-muted">Adresa</dt>
            <dd>{client.crm?.adresa || "—"}</dd>
            <dt className="text-muted">Web</dt>
            <dd className="truncate">
              {client.crm?.web ? (
                <a className="text-brand-ink hover:underline" href={client.crm.web.startsWith("http") ? client.crm.web : `https://${client.crm.web}`} target="_blank" rel="noreferrer">
                  {client.crm.web}
                </a>
              ) : (
                "—"
              )}
            </dd>
            {client.klijent_tip === "jls" && (
              <>
                <dt className="text-muted">Stanovnika</dt>
                <dd>{client.stanovnika?.toLocaleString("hr-HR") ?? "—"}{client.ruralno ? " · ruralno" : ""}</dd>
              </>
            )}
            {client.velicina && (
              <>
                <dt className="text-muted">Veličina</dt>
                <dd>{client.velicina}</dd>
              </>
            )}
            <dt className="text-muted">Sektori</dt>
            <dd>{client.sektori_interesa.length ? client.sektori_interesa.join(", ") : "—"}</dd>
          </dl>
          {client.crm?.napomena && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{client.crm.napomena}</p>}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center">
            <h2 className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-2">Kontakti</h2>
            <Button size="sm" variant="ghost" onClick={() => setContact("novi")}>
              <Plus className="h-4 w-4" /> Kontakt
            </Button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted">{client.kontakt_osoba ? `Iz EU Radara: ${client.kontakt_osoba}` : "Nema kontakata."}</p>
          ) : (
            <ul className="space-y-2.5">
              {contacts.map((c) => (
                <li key={c.id} className="group text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">{c.ime}</span>
                    {c.primarni && <Star className="h-3.5 w-3.5 fill-current text-warning" />}
                    {c.uloga && <span className="text-xs text-muted">· {c.uloga}</span>}
                    <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {!c.primarni && (
                        <button title="Postavi kao primarni" className="rounded p-1 text-muted-2 hover:text-foreground" onClick={() => start(async () => { const r = await setPrimaryContact(client.id, c.id); show(r); router.refresh(); })}>
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button title="Uredi" className="rounded p-1 text-muted-2 hover:text-foreground" onClick={() => setContact(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Ukloni"
                        className="rounded p-1 text-muted-2 hover:text-danger"
                        disabled={pending}
                        onClick={() => {
                          if (confirm(`Ukloniti kontakt ${c.ime}?`)) start(async () => { const r = await removeContact(client.id, c.id); show(r); router.refresh(); });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {c.telefon && <a href={`tel:${c.telefon.replace(/\s/g, "")}`} className="hover:underline">{c.telefon}</a>}
                    {c.telefon && c.email && " · "}
                    {c.email && <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-2">EU Radar</h2>
          <p className="text-sm">
            <b className="tabular">{matches.filter((m) => m.status === "otvoren").length}</b> otvorenih i{" "}
            <b className="tabular">{matches.filter((m) => m.status === "najava").length}</b> najavljenih natječaja za koje je klijent prihvatljiv.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <Link href={`/klijenti/${client.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline">
              <ExternalLink className="h-4 w-4" /> Profil u aplikaciji EU Radar
            </Link>
            <Link href={`/izvjestaj/${client.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline">
              <FileText className="h-4 w-4" /> Izvještaj za klijenta (PDF / CSV)
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">Matching koristi vrstu klijenta i sektore interesa — uredi ih gumbom „Uredi“.</p>
        </Card>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "aktivnosti", label: "Aktivnosti", count: activities.length },
          { value: "zadaci", label: "Zadaci", count: openTasks.length },
          { value: "natjecaji", label: "Natječaji", count: matches.length },
          { value: "leadovi", label: "Leadovi", count: leads.length },
        ]}
      />

      {tab === "aktivnosti" && (
        <Card className="p-4">
          <ActivityFeed target={{ jls_profile_id: client.id }} items={activities} onAdded={() => router.refresh()} />
        </Card>
      )}

      {tab === "zadaci" &&
        (tasks.length === 0 ? (
          <Empty title="Nema zadataka">Dodaj zadatak gumbom „Zadatak“ gore.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={!!t.done_at} onChange={() => start(async () => show(await setTaskDone(t.id, !t.done_at)))} />
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

      {tab === "natjecaji" &&
        (matches.length === 0 ? (
          <Empty title="Nema prihvatljivih natječaja">Dopuni vrstu klijenta i sektore interesa.</Empty>
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {matches.map((m) => (
                <li key={m.slug} className="flex items-start gap-3 px-4 py-3">
                  <span className={cn("mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular", m.score >= 70 ? "bg-success-soft text-success" : m.score >= 50 ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted")}>
                    {m.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/pozivi/${m.slug}`} className="text-sm font-medium hover:text-brand-ink hover:underline">
                      {m.naslov}
                    </Link>
                    <div className="text-xs text-muted">
                      {m.davatelj} · {m.status === "najava" ? "najava" : m.rok ? `rok ${fmtDay(m.rok)}` : "bez roka"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-2">{m.reasons.slice(0, 2).join(" · ")}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {tab === "leadovi" &&
        (leads.length === 0 ? (
          <Empty title="Nema povezanih leadova" />
        ) : (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-border">
              {leads.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Link href={`/crm/leadovi?lead=${l.id}`} className="flex-1 hover:underline">
                    <span className="text-muted-2">L-{l.broj}</span> {l.naziv}
                  </Link>
                  <Badge tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Badge>
                  <span className="text-xs text-muted">{fmtDate(l.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {editing && (
        <ClientForm client={client} team={refs.team} meId={me.id} lockOwner={isSuradnik} onClose={() => setEditing(false)} />
      )}
      {newTask && (
        <TaskDialog
          open
          onClose={() => setNewTask(false)}
          refs={refs}
          meId={me.id}
          lockOwner={isSuradnik}
          preset={{ jls_profile_id: client.id, owner: client.crm?.owner ?? me.id }}
          onSaved={() => show({ ok: true, message: "Zadatak je spremljen." })}
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
      {contact && (
        <ContactDialog
          contact={contact === "novi" ? null : contact}
          onClose={() => setContact(null)}
          onSave={(input) =>
            start(async () => {
              const r = await saveContact(client.id, contact === "novi" ? null : contact.id, input);
              show(r);
              if (r.ok) {
                setContact(null);
                router.refresh();
              }
            })
          }
          pending={pending}
        />
      )}
    </div>
  );
}

function ContactDialog({
  contact,
  onClose,
  onSave,
  pending,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSave: (i: ContactInput) => void;
  pending: boolean;
}) {
  const [f, setF] = React.useState<ContactInput>({
    ime: contact?.ime ?? "",
    uloga: contact?.uloga ?? "",
    email: contact?.email ?? "",
    telefon: contact?.telefon ?? "",
    primarni: contact?.primarni ?? false,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={contact ? "Uredi kontakt" : "Novi kontakt"}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onSave(f)}>
            Spremi
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ime i prezime">
          <input autoFocus className={inputClass} value={f.ime} onChange={(e) => setF({ ...f, ime: e.target.value })} />
        </Field>
        <Field label="Uloga (npr. načelnik, direktor)">
          <input className={inputClass} value={f.uloga ?? ""} onChange={(e) => setF({ ...f, uloga: e.target.value })} />
        </Field>
        <Field label="Telefon">
          <input className={inputClass} value={f.telefon ?? ""} onChange={(e) => setF({ ...f, telefon: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <input type="email" className={inputClass} value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={!!f.primarni} onChange={(e) => setF({ ...f, primarni: e.target.checked })} /> Primarni kontakt
        </label>
      </div>
      {!f.ime.trim() && <div className="mt-3"><Notice tone="info">Ime je obavezno.</Notice></div>}
    </Modal>
  );
}
