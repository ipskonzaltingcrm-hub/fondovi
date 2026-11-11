"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ClientForm } from "@/components/crm/client-form";
import { Empty, Stat, Table, Td, Th, inputClass, selectSmClass } from "@/components/crm/ui";
import type { ClientRow, TeamMember } from "@/lib/crm/data";
import { CLIENT_STATUS, JLS_TIP, KLIJENT_TIP, type ClientStatus, type KlijentTip } from "@/lib/crm/options";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

export type ClientListItem = {
  client: ClientRow;
  openCalls: number;
  topScore: number | null;
  openTasks: number;
  leads: number;
};

export function ClientsView({
  items,
  team,
  me,
  startNew,
}: {
  items: ClientListItem[];
  team: TeamMember[];
  me: { id: string; role: StaffRole };
  startNew: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [tip, setTip] = React.useState<"" | KlijentTip>("");
  const [status, setStatus] = React.useState<"" | ClientStatus>("");
  const [owner, setOwner] = React.useState("");
  const [creating, setCreating] = React.useState(startNew);
  const canCreate = me.role !== "suradnik";

  const rows = items.filter(({ client: c }) => {
    if (tip && c.klijent_tip !== tip) return false;
    if (status && c.status !== status) return false;
    if (owner === "-" ? c.crm?.owner : owner && c.crm?.owner !== owner) return false;
    if (q) {
      const s = q.toLowerCase();
      const hay = [c.naziv, c.zupanija, c.kontakt_osoba, c.crm?.oib, c.crm?.email, c.crm?.telefon].join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
  const ownerName = (id: string | null | undefined) => {
    const m = team.find((t) => t.id === id);
    return m ? m.short || m.name : null;
  };
  const count = (s: ClientStatus) => items.filter((i) => i.client.status === s).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Klijenti" value={items.length} />
        <Stat label="Aktivni" value={count("aktivan")} hint="plaćena pretplata" />
        <Stat label="Probni" value={count("trial")} />
        <Stat label="Otvoreni natječaji" value={items.reduce((s, i) => s + i.openCalls, 0)} hint="zbroj prihvatljivih po klijentu" />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input
              className={cn(inputClass, "pl-8")}
              placeholder="Traži po nazivu, OIB-u, kontaktu, županiji…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className={selectSmClass} value={tip} onChange={(e) => setTip(e.target.value as KlijentTip)}>
            <option value="">Sve vrste</option>
            {Object.entries(KLIJENT_TIP).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className={selectSmClass} value={status} onChange={(e) => setStatus(e.target.value as ClientStatus)}>
            <option value="">Svi statusi</option>
            {Object.entries(CLIENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <select className={selectSmClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Svi vlasnici</option>
            <option value="-">Bez vlasnika</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Novi klijent
            </Button>
          )}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Empty title="Nema klijenata">{items.length ? "Promijeni filtre." : "Klijent nastaje pretvorbom leada ili gumbom „Novi klijent“."}</Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>Klijent</Th>
                <Th>Vrsta</Th>
                <Th>Status</Th>
                <Th>Kontakt</Th>
                <Th className="text-right">Natječaji</Th>
                <Th className="text-right">Zadaci</Th>
                <Th>Vlasnik</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client: c, openCalls, topScore, openTasks }) => (
                <tr key={c.id} className="hover:bg-surface-2/60">
                  <Td>
                    <Link href={`/crm/klijenti/${c.id}`} className="font-medium hover:text-brand-ink hover:underline">
                      {c.naziv}
                    </Link>
                    <div className="text-xs text-muted">
                      {c.zupanija ?? "—"}
                      {c.crm?.oib ? ` · OIB ${c.crm.oib}` : ""}
                    </div>
                  </Td>
                  <Td className="text-sm">
                    {KLIJENT_TIP[c.klijent_tip]}
                    {c.tip ? <span className="text-muted"> · {JLS_TIP[c.tip]}</span> : null}
                  </Td>
                  <Td>
                    <Badge tone={CLIENT_STATUS[c.status]?.tone ?? "neutral"}>{CLIENT_STATUS[c.status]?.label ?? c.status}</Badge>
                  </Td>
                  <Td className="text-sm">
                    <div>{c.kontakt_osoba || "—"}</div>
                    {(c.crm?.email || c.crm?.telefon) && <div className="text-xs text-muted">{c.crm?.telefon || c.crm?.email}</div>}
                  </Td>
                  <Td className="text-right tabular">
                    {openCalls}
                    {topScore != null && <div className="text-xs text-muted">najbolji {topScore}</div>}
                  </Td>
                  <Td className="text-right tabular">{openTasks || "—"}</Td>
                  <Td className="text-sm">{ownerName(c.crm?.owner) ?? <span className="text-muted-2">—</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {creating && <ClientForm team={team.filter((t) => t.active)} meId={me.id} onClose={() => setCreating(false)} />}
    </div>
  );
}
