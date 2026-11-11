"use client";

import * as React from "react";
import { useTransition } from "react";
import Link from "next/link";
import { LogOut, MonitorSmartphone, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, Notice, Table, Td, Th } from "@/components/crm/ui";
import { ROLE_LABEL, ROLE_TONE, type StaffRole } from "@/lib/crm/roles";
import { describeUserAgent, fmtAgo, fmtDateTime } from "@/lib/crm/format";
import type { ActionResult } from "@/lib/crm/session";
import { cn } from "@/lib/utils";
import { signOutMember, signOutOthers } from "./actions";

export type SessionRow = {
  session_id: string;
  first_seen: string;
  last_seen: string;
  ip: string | null;
  user_agent: string | null;
  active: boolean;
  is_current: boolean;
};
export type TeamRow = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  lastSeen: string | null;
  activeSessions: number;
};
type Me = { id: string; isAdmin: boolean; isSuperadmin: boolean };

export function SecurityView({
  me,
  mine,
  team,
  selectedMember,
  memberSessions,
}: {
  me: Me;
  mine: SessionRow[];
  team: TeamRow[];
  selectedMember: TeamRow | null;
  memberSessions: SessionRow[] | null;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = React.useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));
  const othersActive = mine.some((s) => s.active && !s.is_current);

  return (
    <div className="space-y-6">
      {result && (result.ok ? <Notice tone="success">{result.message}</Notice> : <Notice tone="danger">{result.error}</Notice>)}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Moje prijave i uređaji</CardTitle>
            <p className="mt-1 text-sm text-muted">Zadnjih 30 prijava u CRM. Ne prepoznajete neku? Odjavite ostale uređaje.</p>
          </div>
          <Button variant="secondary" size="sm" disabled={pending || !othersActive} onClick={() => run(signOutOthers)}>
            <LogOut className="h-4 w-4" /> Odjavi ostale uređaje
          </Button>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <SessionsTable rows={mine} />
        </CardContent>
      </Card>

      {me.isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Sigurnost tima</CardTitle>
            <p className="mt-1 text-sm text-muted">
              Zadnja aktivnost i broj aktivnih prijava po članu. Klik na člana prikazuje njegove prijave.
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <thead>
                <tr>
                  <Th className="pl-5">Član</Th>
                  <Th>Uloga</Th>
                  <Th>Zadnja aktivnost</Th>
                  <Th className="text-center">Aktivne prijave</Th>
                  <Th className="pr-5"></Th>
                </tr>
              </thead>
              <tbody>
                {team.map((t) => {
                  const canSignOut = t.id !== me.id && t.activeSessions > 0 && (t.role !== "superadmin" || me.isSuperadmin);
                  return (
                    <tr key={t.id} className={cn(!t.active && "opacity-60", selectedMember?.id === t.id && "bg-surface-2")}>
                      <Td className="pl-5">
                        <Link href={`/crm/sigurnost?clan=${t.id}`} scroll={false} className="font-medium hover:underline">
                          {t.name}
                        </Link>
                        {t.id === me.id && <span className="ml-1.5 text-xs text-muted-2">(ti)</span>}
                        <div className="text-xs text-muted-2">{t.email}</div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={ROLE_TONE[t.role]}>{ROLE_LABEL[t.role]}</Badge>
                          {!t.active && <Badge tone="danger">Deaktiviran</Badge>}
                        </div>
                      </Td>
                      <Td className="text-muted">{fmtAgo(t.lastSeen)}</Td>
                      <Td className="text-center tabular">{t.activeSessions}</Td>
                      <Td className="pr-5 text-right">
                        {canSignOut && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger"
                            disabled={pending}
                            onClick={() => {
                              if (confirm(`Odjaviti ${t.name} sa svih uređaja?`)) run(() => signOutMember(t.id));
                            }}
                          >
                            Odjavi sa svih uređaja
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
      )}

      {selectedMember && memberSessions && (
        <Card className="border-brand/50">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <CardTitle>Prijave: {selectedMember.name}</CardTitle>
            <Link href="/crm/sigurnost" scroll={false} aria-label="Zatvori" className="rounded-md p-1.5 hover:bg-surface-2">
              <X className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <SessionsTable rows={memberSessions} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SessionsTable({ rows }: { rows: SessionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-5 pb-3">
        <Empty title="Još nema zabilježenih prijava" />
      </div>
    );
  }
  return (
    <Table>
      <thead>
        <tr>
          <Th className="pl-5">Uređaj</Th>
          <Th>IP adresa</Th>
          <Th>Prijava</Th>
          <Th>Zadnja aktivnost</Th>
          <Th className="pr-5">Stanje</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.session_id}>
            <Td className="pl-5">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-muted-2" />
                <span className="font-medium">{describeUserAgent(s.user_agent)}</span>
              </div>
            </Td>
            <Td className="text-muted tabular">{s.ip || "—"}</Td>
            <Td className="text-muted tabular">{fmtDateTime(s.first_seen)}</Td>
            <Td className="text-muted">{fmtAgo(s.last_seen)}</Td>
            <Td className="pr-5">
              {s.is_current ? (
                <Badge tone="brand">Ovaj preglednik</Badge>
              ) : s.active ? (
                <Badge tone="success">Aktivna</Badge>
              ) : (
                <Badge tone="neutral">Odjavljena</Badge>
              )}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
