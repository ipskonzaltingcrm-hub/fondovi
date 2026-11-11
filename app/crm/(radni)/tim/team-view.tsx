"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Minus, UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClass, Notice, Table, Td, Th } from "@/components/crm/ui";
import { ROLE_LABEL, ROLE_PERMISSIONS, ROLE_TONE, type StaffRole } from "@/lib/crm/roles";
import { fmtDate, fmtDateTime, initials } from "@/lib/crm/format";
import type { ActionResult } from "@/lib/crm/session";
import { cn } from "@/lib/utils";
import { inviteMember, revokeInvitation, updateMember } from "./actions";

export type Member = {
  id: string;
  email: string;
  name: string;
  shortName: string | null;
  jobTitle: string | null;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  since: string | null;
};
export type Invitation = {
  id: string;
  email: string;
  name: string | null;
  role: StaffRole;
  token: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  invitedBy: string;
};
type Me = { id: string; role: StaffRole; isAdmin: boolean; isSuperadmin: boolean };

/** Smije li `me` mijenjati ulogu/status člana `t` (ista pravila kao crm_update_member u bazi). */
function canManage(me: Me, t: Member) {
  if (t.id === me.id || !me.isAdmin || t.role === "superadmin") return false;
  return !(me.role === "admin" && t.role === "admin");
}

function rolesFor(me: Me): StaffRole[] {
  return me.isSuperadmin ? ["admin", "konzultant", "suradnik"] : ["konzultant", "suradnik"];
}

export function TeamView({
  me,
  members,
  invitations,
  selectedId,
  origin,
}: {
  me: Me;
  members: Member[];
  invitations: Invitation[];
  selectedId: string | null;
  origin: string;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const selected = members.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {me.isAdmin && (
        <div className="flex justify-end">
          <Button onClick={() => setInviteOpen((o) => !o)} variant={inviteOpen ? "secondary" : "primary"}>
            {inviteOpen ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {inviteOpen ? "Zatvori" : "Pozovi člana"}
          </Button>
        </div>
      )}
      {me.isAdmin && inviteOpen && <InviteCard me={me} />}

      {selected && (
        <MemberEditor
          key={selected.id}
          me={me}
          member={selected}
          onClose={() => router.push("/crm/tim", { scroll: false })}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Članovi tima · {members.filter((m) => m.active).length} aktivnih</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <thead>
              <tr>
                <Th className="pl-5">Član</Th>
                <Th>Funkcija</Th>
                <Th>Kontakt</Th>
                <Th>Uloga</Th>
                <Th>Član od</Th>
                <Th className="pr-5 text-right"></Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const editable = m.id === me.id || canManage(me, m);
                return (
                  <tr key={m.id} className={cn(!m.active && "opacity-60", m.id === selectedId && "bg-surface-2")}>
                    <Td className="pl-5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">
                          {initials(m.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">
                            {m.name}
                            {m.id === me.id && <span className="ml-1.5 text-xs text-muted-2">(ti)</span>}
                          </div>
                          {m.shortName && <div className="text-xs text-muted-2">{m.shortName}</div>}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-muted">{m.jobTitle ?? "—"}</Td>
                    <Td className="text-muted">
                      <div>{m.email}</div>
                      {m.phone && <div className="text-xs">{m.phone}</div>}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                        {!m.active && <Badge tone="danger">Deaktiviran</Badge>}
                      </div>
                    </Td>
                    <Td className="text-muted tabular">{fmtDate(m.since)}</Td>
                    <Td className="pr-5 text-right">
                      {editable && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/crm/tim?id=${m.id === me.id ? "ja" : m.id}`, { scroll: false })}
                        >
                          {m.id === me.id ? "Uredi moj profil" : "Uredi"}
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      {me.isAdmin && <InvitationsCard invitations={invitations} origin={origin} />}

      <Card>
        <CardHeader>
          <CardTitle>Ovlasti po ulozi</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Superadmin je uvijek i isključivo vlasnica. Nitko ne mijenja vlastitu ulogu. Dio ovlasti odnosi se na
            kartice koje stižu u kasnijim fazama.
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <thead>
              <tr>
                <Th className="pl-5">Ovlast</Th>
                {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
                  <Th key={r} className="text-center">
                    {ROLE_LABEL[r]}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_PERMISSIONS.map((p) => (
                <tr key={p.what}>
                  <Td className="pl-5">{p.what}</Td>
                  {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
                    <Td key={r} className="text-center">
                      {p.roles[r] ? (
                        <Check className="mx-auto h-4 w-4 text-success" aria-label="da" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-2" aria-label="ne" />
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CopyButton({ text, label = "Kopiraj poveznicu" }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      {copied ? "Kopirano" : label}
    </Button>
  );
}

function InviteCard({ me }: { me: Me }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(inviteMember, null);
  const [formKey, setFormKey] = React.useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pozovi člana tima</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Dobit ćete jednokratnu poveznicu (vrijedi 7 dana) koju sami pošaljete. Osoba se prijavi kodom na istu
          e-mail adresu i prihvati pozivnicu.
        </p>
      </CardHeader>
      <CardContent>
        <form key={formKey} action={action} className="grid gap-3 sm:grid-cols-[1.4fr_1.2fr_1fr_auto] sm:items-end">
          <Field label="E-mail">
            <input name="email" type="email" required className={inputClass} placeholder="ime@ips-konzalting.hr" />
          </Field>
          <Field label="Ime i prezime">
            <input name="full_name" className={inputClass} placeholder="neobavezno" />
          </Field>
          <Field label="Uloga">
            <select name="role" defaultValue="konzultant" className={inputClass}>
              {rolesFor(me).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Izradi pozivnicu
          </Button>
        </form>
        {state && !state.ok && (
          <div className="mt-3">
            <Notice tone="danger">{state.error}</Notice>
          </div>
        )}
        {state?.ok && state.data && (
          <div className="mt-3 space-y-2">
            <Notice tone="success">{state.message}</Notice>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
                {state.data}
              </code>
              <CopyButton text={state.data} />
              <Button size="sm" variant="ghost" type="button" onClick={() => setFormKey((k) => k + 1)}>
                Nova pozivnica
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvitationsCard({ invitations, origin }: { invitations: Invitation[]; origin: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (invitations.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pozivnice na čekanju · {invitations.length}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {error && (
          <div className="px-5 pb-3">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
        <Table>
          <thead>
            <tr>
              <Th className="pl-5">Osoba</Th>
              <Th>Uloga</Th>
              <Th>Pozivatelj</Th>
              <Th>Vrijedi do</Th>
              <Th className="pr-5"></Th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((i) => {
              const expired = i.expired;
              return (
                <tr key={i.id}>
                  <Td className="pl-5">
                    <div className="font-medium">{i.name ?? i.email}</div>
                    {i.name && <div className="text-xs text-muted-2">{i.email}</div>}
                  </Td>
                  <Td>
                    <Badge tone={ROLE_TONE[i.role]}>{ROLE_LABEL[i.role]}</Badge>
                  </Td>
                  <Td className="text-muted">{i.invitedBy}</Td>
                  <Td className={cn("tabular", expired ? "text-danger" : "text-muted")}>
                    {expired ? "isteklo · " : ""}
                    {fmtDateTime(i.expiresAt)}
                  </Td>
                  <Td className="pr-5">
                    <div className="flex justify-end gap-1.5">
                      {!expired && (
                        <CopyButton text={`${origin}/crm/pozivnica?token=${i.token}`} label="Kopiraj" />
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        className="text-danger"
                        onClick={() =>
                          start(async () => {
                            const r = await revokeInvitation(i.id);
                            setError(r.ok ? null : r.error);
                          })
                        }
                      >
                        Opozovi
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <p className="px-5 pt-2 text-xs text-muted-2">
          Istekla pozivnica obnavlja se ponovnim pozivom iste adrese (stara se automatski opoziva).
        </p>
      </CardContent>
    </Card>
  );
}

function MemberEditor({ me, member, onClose }: { me: Me; member: Member; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateMember, null);
  const self = member.id === me.id;
  const manage = canManage(me, member);
  const roleOptions = manage ? Array.from(new Set([member.role, ...rolesFor(me)])) : [member.role];

  return (
    <Card className="border-brand/50">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{self ? "Moj profil" : `Uredi: ${member.name}`}</CardTitle>
          <p className="mt-0.5 text-sm text-muted">{member.email}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Zatvori">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="id" value={member.id} />
          <Field label="Ime i prezime">
            <input name="full_name" defaultValue={member.name} className={inputClass} />
          </Field>
          <Field label="Kratko ime" hint="npr. inicijali u tablicama">
            <input name="short_name" defaultValue={member.shortName ?? ""} className={inputClass} />
          </Field>
          <Field label="Funkcija">
            <input name="job_title" defaultValue={member.jobTitle ?? ""} className={inputClass} />
          </Field>
          <Field label="Mobitel">
            <input name="phone" defaultValue={member.phone ?? ""} className={inputClass} />
          </Field>

          <Field label="Uloga" hint={manage ? undefined : self ? "Vlastitu ulogu ne možete mijenjati." : undefined}>
            <select name="role" defaultValue={member.role} disabled={!manage} className={inputClass}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            {!manage && <input type="hidden" name="role" value={member.role} />}
          </Field>
          <div className="flex items-end pb-1.5">
            {manage ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={member.active} className="h-4 w-4 accent-brand" />
                Aktivan član
              </label>
            ) : (
              <input type="hidden" name="active" value={String(member.active)} />
            )}
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2 lg:justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Spremi
            </Button>
          </div>
        </form>
        {manage && (
          <p className="mt-2 text-xs text-muted-2">
            Deaktivacija odmah odjavljuje člana sa svih uređaja i zatvara mu CRM. Povijest njegovih radnji ostaje u
            Dnevniku izmjena.
          </p>
        )}
        {state && (
          <div className="mt-3">
            {state.ok ? <Notice tone="success">{state.message}</Notice> : <Notice tone="danger">{state.error}</Notice>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
