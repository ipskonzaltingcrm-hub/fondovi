"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Copy, KeyRound, Lock, Mail, Plus, Search, Unlock, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer, Modal, useFlash } from "@/components/crm/overlay";
import { Empty, Field, Notice, Stat, Table, Tabs, Td, Th, inputClass, selectSmClass, textareaClass } from "@/components/crm/ui";
import {
  blockPortalUser,
  cancelSubscription,
  invitePortalUser,
  recordPayment,
  revokePortalInvite,
  setMembership,
  setPortalMeta,
  setRegistrationMode,
  type PaymentInput,
} from "@/lib/crm/actions/portal";
import type { Service } from "@/lib/crm/data";
import { CLIENT_STATUS, type ClientStatus } from "@/lib/crm/options";
import { addDays, daysBetween, fmtDay } from "@/lib/crm/dates";
import { fmtAgo, fmtDateTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export type PortalUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  blocked_at: string | null;
  oznaka: Oznaka;
  napomena: string | null;
  lead_id: string | null;
  clanstva: { jls_profile_id: string; naziv: string; status: ClientStatus; role: string }[];
};
export type ClientLite = { id: string; naziv: string; klijent_tip: string; status: ClientStatus };
export type Subscription = { id: string; jls_profile_id: string; service_id: string | null; paket: string; od: string; do: string; iznos: number | null; status: "aktivna" | "otkazana"; napomena: string | null; created_at: string };
export type Payment = { id: string; jls_profile_id: string; subscription_id: string | null; iznos: number; datum: string; nacin: string; napomena: string | null; created_at: string };
export type Invite = { id: string; email: string; jls_profile_id: string; role: string; token: string; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };
type Oznaka = "novi" | "provjeren" | "sumnjiv" | "konkurencija" | "testni";
type Tab = "korisnici" | "pretplate" | "pozivnice" | "registracija";
type Notify = (r: { ok: boolean; message?: string; error?: string }) => void;

const OZNAKA: Record<Oznaka, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "info" }> = {
  novi: { label: "Novi", tone: "info" },
  provjeren: { label: "Provjeren", tone: "success" },
  sumnjiv: { label: "Sumnjiv", tone: "warning" },
  konkurencija: { label: "Konkurencija", tone: "danger" },
  testni: { label: "Testni", tone: "neutral" },
};
const ROLE: Record<string, string> = { tenant_admin: "Administrator klijenta", member: "Član", viewer: "Samo čitanje" };
const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });

export function PortalView({
  users,
  clients,
  subscriptions,
  payments,
  invites,
  registration,
  services,
  isAdmin,
  origin,
  today,
}: {
  users: PortalUser[];
  clients: ClientLite[];
  subscriptions: Subscription[];
  payments: Payment[];
  invites: Invite[];
  registration: "otvorena" | "pozivnica";
  services: Service[];
  isAdmin: boolean;
  origin: string;
  today: string;
}) {
  const [tab, setTab] = React.useState<Tab>("korisnici");
  const [filter, setFilter] = React.useState("svi");
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<null | "invite" | { pay: string | null }>(null);
  const [pending, start] = React.useTransition();
  const { show, node } = useFlash();

  const weekAgo = addDays(today, -7);
  const inactive = (u: PortalUser) => !u.last_sign_in_at || daysBetween(u.last_sign_in_at.slice(0, 10), today) > 30;
  const filters: Record<string, (u: PortalUser) => boolean> = {
    svi: (u) => !u.blocked_at,
    novi: (u) => !u.blocked_at && u.created_at.slice(0, 10) >= weekAgo,
    bez_klijenta: (u) => !u.blocked_at && u.clanstva.length === 0,
    s_klijentom: (u) => u.clanstva.length > 0,
    neaktivni: (u) => !u.blocked_at && inactive(u),
    sumnjivi: (u) => u.oznaka === "sumnjiv" || u.oznaka === "konkurencija",
    testni: (u) => u.oznaka === "testni",
    blokirani: (u) => !!u.blocked_at,
  };
  const rows = users.filter((u) => filters[filter](u) && (!q || [u.email, u.full_name, ...u.clanstva.map((c) => c.naziv)].join(" ").toLowerCase().includes(q.toLowerCase())));
  const sel = users.find((u) => u.id === selected) ?? null;

  // Pretplate: zadnja pretplata po klijentu
  const latest = new Map<string, Subscription>();
  for (const s of subscriptions) if (s.status === "aktivna" && (!latest.has(s.jls_profile_id) || s.do > latest.get(s.jls_profile_id)!.do)) latest.set(s.jls_profile_id, s);
  const expiring = [...latest.values()].filter((s) => s.do >= today && s.do <= addDays(today, 30));
  const expired = [...latest.values()].filter((s) => s.do < today);
  const openInvites = invites.filter((i) => !i.accepted_at && !i.revoked_at && i.expires_at >= new Date(`${today}T00:00:00`).toISOString());
  const naziv = (id: string) => clients.find((c) => c.id === id)?.naziv ?? "—";

  return (
    <div className="space-y-4">
      {node}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Korisnika" value={users.filter((u) => !u.blocked_at).length} hint={`${users.filter((u) => u.created_at.slice(0, 10) >= weekAgo).length} novih u 7 dana`} />
        <Stat label="Bez klijenta" value={users.filter((u) => !u.blocked_at && u.clanstva.length === 0).length} hint="registrirani, nisu dodijeljeni klijentu" />
        <Stat label="Pretplata ističe" value={expiring.length} hint="u idućih 30 dana" />
        <Stat label="Registracija" value={registration === "pozivnica" ? "Uz pozivnicu" : "Otvorena"} hint={registration === "otvorena" ? "svatko se može registrirati" : "samo pozvani"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "korisnici", label: "Korisnici", count: users.length },
            { value: "pretplate", label: "Pretplate i uplate", count: latest.size },
            { value: "pozivnice", label: "Pozivnice", count: openInvites.length },
            { value: "registracija", label: "Registracija" },
          ]}
        />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDialog("invite")}>
            <Mail className="h-4 w-4" /> Pozovi korisnika
          </Button>
          <Button size="sm" onClick={() => setDialog({ pay: null })}>
            <Wallet className="h-4 w-4" /> Evidentiraj uplatu
          </Button>
        </div>
      </div>

      {tab === "korisnici" && (
        <>
          <Card className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
                <input className={cn(inputClass, "pl-8")} placeholder="Traži e-mail, ime, klijenta…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className={selectSmClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="svi">Svi (bez blokiranih)</option>
                <option value="novi">Novi (7 dana)</option>
                <option value="bez_klijenta">Bez klijenta</option>
                <option value="s_klijentom">S klijentom</option>
                <option value="neaktivni">Neaktivni 30+ dana</option>
                <option value="sumnjivi">Sumnjivi / konkurencija</option>
                <option value="testni">Testni</option>
                <option value="blokirani">Blokirani</option>
              </select>
            </div>
          </Card>
          {rows.length === 0 ? (
            <Empty title="Nema korisnika" />
          ) : (
            <Card className="overflow-hidden">
              <Table>
                <thead>
                  <tr>
                    <Th>Korisnik</Th>
                    <Th>Klijent</Th>
                    <Th>Oznaka</Th>
                    <Th>Registriran</Th>
                    <Th>Zadnja prijava</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => setSelected(u.id)}>
                      <Td>
                        <div className="font-medium">{u.email}</div>
                        {u.full_name && <div className="text-xs text-muted">{u.full_name}</div>}
                      </Td>
                      <Td className="text-sm">
                        {u.clanstva.length ? u.clanstva.map((c) => c.naziv).join(", ") : <span className="text-warning">bez klijenta</span>}
                      </Td>
                      <Td>
                        {u.blocked_at ? <Badge tone="danger">Blokiran</Badge> : <Badge tone={OZNAKA[u.oznaka].tone}>{OZNAKA[u.oznaka].label}</Badge>}
                      </Td>
                      <Td className="text-sm text-muted">{fmtDay(u.created_at.slice(0, 10))}</Td>
                      <Td className={cn("text-sm", inactive(u) ? "text-warning" : "text-muted")}>{fmtAgo(u.last_sign_in_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}

      {tab === "pretplate" && (
        <div className="space-y-4">
          {(expiring.length > 0 || expired.length > 0) && (
            <Notice tone="warning">
              {expiring.length > 0 && `Ističe u 30 dana: ${expiring.map((s) => `${naziv(s.jls_profile_id)} (${fmtDay(s.do)})`).join(", ")}. `}
              {expired.length > 0 && `Nije obnovljeno: ${expired.map((s) => naziv(s.jls_profile_id)).join(", ")}.`}
            </Notice>
          )}
          <Card className="overflow-hidden">
            <Table>
              <thead>
                <tr>
                  <Th>Klijent</Th>
                  <Th>Status u EU Radaru</Th>
                  <Th>Pretplata</Th>
                  <Th>Vrijedi do</Th>
                  <Th className="text-right">Zadnja uplata</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const s = latest.get(c.id);
                  const p = payments.find((x) => x.jls_profile_id === c.id);
                  const d = s ? daysBetween(today, s.do) : null;
                  return (
                    <tr key={c.id}>
                      <Td>
                        <Link href={`/crm/klijenti/${c.id}`} className="font-medium hover:text-brand-ink hover:underline">
                          {c.naziv}
                        </Link>
                      </Td>
                      <Td>
                        <Badge tone={CLIENT_STATUS[c.status]?.tone ?? "neutral"}>{CLIENT_STATUS[c.status]?.label ?? c.status}</Badge>
                      </Td>
                      <Td className="text-sm">{s?.paket ?? <span className="text-muted-2">—</span>}</Td>
                      <Td className={cn("text-sm tabular", d != null && d < 0 ? "text-danger" : d != null && d <= 30 ? "text-warning" : "text-muted")}>
                        {s ? `${fmtDay(s.do)}${d != null && d < 0 ? " · isteklo" : ""}` : "—"}
                      </Td>
                      <Td className="text-right text-sm tabular">{p ? `${eur.format(Number(p.iznos))} · ${fmtDay(p.datum)}` : "—"}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setDialog({ pay: c.id })}>
                            <Plus className="h-3.5 w-3.5" /> Uplata
                          </Button>
                          {s && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => {
                                if (!confirm(`Otkazati pretplatu za ${c.naziv}?`)) return;
                                const pauziraj = confirm("Pauzirati i pristup EU Radaru (status „Pauziran“)?");
                                start(async () => show(await cancelSubscription(s.id, pauziraj)));
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-2">Zadnje uplate</div>
            {payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">Još nema evidentiranih uplata.</p>
            ) : (
              <ul className="divide-y divide-border">
                {payments.slice(0, 50).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-20 text-xs text-muted">{fmtDay(p.datum)}</span>
                    <span className="min-w-0 flex-1 truncate">{naziv(p.jls_profile_id)}</span>
                    <span className="text-xs text-muted">{p.nacin}</span>
                    <span className="tabular">{eur.format(Number(p.iznos))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "pozivnice" && (
        <Card className="overflow-hidden">
          {invites.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">Još nema pozivnica. Pozvani korisnik nakon registracije odmah vidi svog klijenta u EU Radaru.</p>
          ) : (
            <ul className="divide-y divide-border">
              {invites.map((i) => {
                const status = i.revoked_at ? "opozvana" : i.accepted_at ? "prihvaćena" : i.expires_at < new Date(`${today}T00:00:00`).toISOString() ? "istekla" : "vrijedi";
                const link = `${origin}/pristup?token=${i.token}`;
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{i.email}</div>
                      <div className="text-xs text-muted">
                        {naziv(i.jls_profile_id)} · {ROLE[i.role] ?? i.role} · {fmtDateTime(i.created_at)}
                      </div>
                    </div>
                    <Badge tone={status === "vrijedi" ? "info" : status === "prihvaćena" ? "success" : "outline"}>{status}</Badge>
                    {status === "vrijedi" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void navigator.clipboard.writeText(link);
                            show({ ok: true, message: "Poveznica je kopirana." });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => show(await revokePortalInvite(i.id)))}>
                          Opozovi
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === "registracija" && (
        <Card className="space-y-3 p-4">
          <p className="text-sm">
            Trenutno: <b>{registration === "pozivnica" ? "registracija samo uz pozivnicu" : "registracija je otvorena svima"}</b>.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Otvorena: svatko s e-mail adresom može napraviti račun; nova registracija postaje lead (izvor „Registracija na EU Radar“).</li>
            <li>Uz pozivnicu: novi račun može napraviti samo osoba s važećom pozivnicom (korisnik klijenta ili član tima). Postojeći korisnici se i dalje prijavljuju normalno.</li>
          </ul>
          {isAdmin ? (
            <Button
              size="sm"
              variant={registration === "otvorena" ? "primary" : "secondary"}
              disabled={pending}
              onClick={() => {
                const next = registration === "otvorena" ? "pozivnica" : "otvorena";
                if (confirm(next === "pozivnica" ? "Zatvoriti registraciju (samo uz pozivnicu)?" : "Otvoriti registraciju svima?"))
                  start(async () => show(await setRegistrationMode(next)));
              }}
            >
              {registration === "otvorena" ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              {registration === "otvorena" ? "Zatvori registraciju (samo uz pozivnicu)" : "Otvori registraciju svima"}
            </Button>
          ) : (
            <Notice>Registraciju mijenjaju administratori.</Notice>
          )}
        </Card>
      )}

      {sel && (
        <UserDrawer key={sel.id} user={sel} clients={clients} isAdmin={isAdmin} onClose={() => setSelected(null)} notify={show} pending={pending} start={start} />
      )}
      {dialog === "invite" && <InviteDialog clients={clients} onClose={() => setDialog(null)} notify={show} />}
      {dialog && typeof dialog === "object" && (
        <PaymentDialog clients={clients} services={services} jls={dialog.pay} today={today} onClose={() => setDialog(null)} notify={show} />
      )}
    </div>
  );
}

function UserDrawer({
  user: u,
  clients,
  isAdmin,
  onClose,
  notify,
  pending,
  start,
}: {
  user: PortalUser;
  clients: ClientLite[];
  isAdmin: boolean;
  onClose: () => void;
  notify: Notify;
  pending: boolean;
  start: React.TransitionStartFunction;
}) {
  const [jls, setJls] = React.useState("");
  const [role, setRole] = React.useState<"member" | "tenant_admin" | "viewer">("member");
  const [oznaka, setOznaka] = React.useState<Oznaka>(u.oznaka);
  const [napomena, setNapomena] = React.useState(u.napomena ?? "");
  return (
    <Drawer
      open
      onClose={onClose}
      title={u.email}
      subtitle={
        <span className="text-xs">
          Registriran {fmtDateTime(u.created_at)} · zadnja prijava {fmtAgo(u.last_sign_in_at)}
          {u.blocked_at && <Badge tone="danger" className="ml-2">Blokiran</Badge>}
        </span>
      }
    >
      {u.lead_id && (
        <Link href={`/crm/leadovi?lead=${u.lead_id}`} className="mb-4 inline-block text-sm text-brand-ink hover:underline">
          Lead ove registracije →
        </Link>
      )}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">Pristup klijentima u EU Radaru</h3>
      {u.clanstva.length === 0 ? (
        <p className="mb-2 text-sm text-muted">Korisnik vidi samo javni katalog natječaja — nije dodijeljen nijednom klijentu.</p>
      ) : (
        <ul className="mb-3 divide-y divide-border rounded-lg border border-border">
          {u.clanstva.map((c) => (
            <li key={c.jls_profile_id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Link href={`/crm/klijenti/${c.jls_profile_id}`} className="min-w-0 flex-1 truncate hover:underline">
                {c.naziv}
              </Link>
              <span className="text-xs text-muted">{ROLE[c.role] ?? c.role}</span>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => notify(await setMembership(u.id, c.jls_profile_id, null)))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <select className={cn(selectSmClass, "min-w-0 flex-1")} value={jls} onChange={(e) => setJls(e.target.value)}>
          <option value="">Dodijeli klijenta…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.naziv}
            </option>
          ))}
        </select>
        <select className={selectSmClass} value={role} onChange={(e) => setRole(e.target.value as "member")}>
          {Object.entries(ROLE).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button size="sm" disabled={!jls || pending} onClick={() => start(async () => notify(await setMembership(u.id, jls, role)))}>
          Dodijeli
        </Button>
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-2">Oznaka i napomena</h3>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(OZNAKA) as Oznaka[]).map((o) => (
            <button
              key={o}
              onClick={() => setOznaka(o)}
              className={cn("rounded-md border px-2.5 py-1 text-xs", oznaka === o ? "border-brand bg-brand-soft text-brand-ink" : "border-border text-muted")}
            >
              {OZNAKA[o].label}
            </button>
          ))}
        </div>
        <textarea rows={2} className={textareaClass} value={napomena} onChange={(e) => setNapomena(e.target.value)} placeholder="Napomena tima" />
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => notify(await setPortalMeta(u.id, oznaka, napomena)))}>
          Spremi
        </Button>
        <p className="text-xs text-muted">„Testni“ korisnici primaju probne poruke; „Konkurencija“ ne prima poruke.</p>
      </div>

      {isAdmin && (
        <>
          <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-2">Blokada</h3>
          <Button
            size="sm"
            variant={u.blocked_at ? "secondary" : "outline"}
            disabled={pending}
            onClick={() =>
              confirm(u.blocked_at ? "Ukloniti blokadu?" : "Blokirati korisnika? Odmah se odjavljuje i ne može koristiti EU Radar.") &&
              start(async () => notify(await blockPortalUser(u.id, !u.blocked_at)))
            }
          >
            {u.blocked_at ? <KeyRound className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            {u.blocked_at ? "Ukloni blokadu" : "Blokiraj korisnika"}
          </Button>
        </>
      )}
    </Drawer>
  );
}

function InviteDialog({ clients, onClose, notify }: { clients: ClientLite[]; onClose: () => void; notify: Notify }) {
  const [email, setEmail] = React.useState("");
  const [jls, setJls] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [link, setLink] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title="Pozovi korisnika klijenta u EU Radar"
      footer={
        link ? (
          <Button size="sm" onClick={onClose}>
            Gotovo
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Odustani
            </Button>
            <Button
              size="sm"
              disabled={pending || !email || !jls}
              onClick={() =>
                start(async () => {
                  const r = await invitePortalUser(email, jls, role);
                  if (!r.ok) setError(r.error);
                  else {
                    notify(r);
                    setLink(r.data ?? null);
                  }
                })
              }
            >
              Napravi pozivnicu
            </Button>
          </>
        )
      }
    >
      {link ? (
        <div className="space-y-3">
          <Notice tone="success">Pošalji ovu poveznicu osobno (e-mailom ili porukom). Vrijedi 14 dana; prihvaća se istom e-mail adresom.</Notice>
          <div className="flex gap-2">
            <input readOnly className={inputClass} value={link} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                notify({ ok: true, message: "Poveznica je kopirana." });
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="E-mail osobe">
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Klijent">
            <select className={inputClass} value={jls} onChange={(e) => setJls(e.target.value)}>
              <option value="">Odaberi…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.naziv}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Uloga kod klijenta">
            <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
              {Object.entries(ROLE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-muted">Pozivnica vrijedi i kad je registracija zatvorena.</p>
          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      )}
    </Modal>
  );
}

function PaymentDialog({
  clients,
  services,
  jls,
  today,
  onClose,
  notify,
}: {
  clients: ClientLite[];
  services: Service[];
  jls: string | null;
  today: string;
  onClose: () => void;
  notify: Notify;
}) {
  const [f, setF] = React.useState<PaymentInput>({ jls: jls ?? "", iznos: "", datum: today, nacin: "virman", service: "", mjeseci: 12, napomena: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <Modal
      open
      onClose={onClose}
      title="Evidentiraj uplatu pretplate"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Odustani
          </Button>
          <Button
            size="sm"
            disabled={pending || !f.jls}
            onClick={() =>
              start(async () => {
                const r = await recordPayment(f);
                if (!r.ok) setError(r.error);
                else {
                  notify(r);
                  onClose();
                }
              })
            }
          >
            Uplaćeno
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Klijent" className="sm:col-span-2">
          <select className={inputClass} value={f.jls} onChange={(e) => setF({ ...f, jls: e.target.value })}>
            <option value="">Odaberi…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Paket (cjenik)" className="sm:col-span-2">
          <select
            className={inputClass}
            value={f.service ?? ""}
            onChange={(e) => {
              const s = services.find((x) => x.id === e.target.value);
              setF({ ...f, service: e.target.value, iznos: f.iznos || (s?.cijena != null ? Math.round(s.cijena * (1 + s.pdv / 100) * 100) / 100 : "") });
            }}
          >
            <option value="">Pretplata EU Radar</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naziv}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Uplaćeni iznos s PDV-om (EUR)">
          <input type="number" step="0.01" className={inputClass} value={f.iznos} onChange={(e) => setF({ ...f, iznos: e.target.value })} />
        </Field>
        <Field label="Datum uplate">
          <input type="date" className={inputClass} value={f.datum} onChange={(e) => setF({ ...f, datum: e.target.value })} />
        </Field>
        <Field label="Način">
          <select className={inputClass} value={f.nacin} onChange={(e) => setF({ ...f, nacin: e.target.value })}>
            <option value="virman">Virman</option>
            <option value="kartica">Kartica</option>
            <option value="gotovina">Gotovina</option>
            <option value="ostalo">Ostalo</option>
          </select>
        </Field>
        <Field label="Trajanje (mjeseci)">
          <input type="number" min={1} max={36} className={inputClass} value={f.mjeseci} onChange={(e) => setF({ ...f, mjeseci: Number(e.target.value) })} />
        </Field>
        <Field label="Napomena" className="sm:col-span-2">
          <input className={inputClass} value={f.napomena} onChange={(e) => setF({ ...f, napomena: e.target.value })} />
        </Field>
      </div>
      <p className="mt-3 text-xs text-muted">
        Pretplata se nastavlja na aktivnu (bez praznine). Klijent postaje „Aktivan“ u EU Radaru, prodaja se upisuje bez PDV-a, a tebi stiže zadatak „Izdaj račun“.
      </p>
      {error && (
        <div className="mt-3">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
    </Modal>
  );
}
