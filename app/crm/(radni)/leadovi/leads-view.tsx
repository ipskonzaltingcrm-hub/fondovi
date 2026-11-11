"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flame, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LeadForm } from "@/components/crm/lead-form";
import { LeadPanel } from "@/components/crm/lead-panel";
import { useFlash } from "@/components/crm/overlay";
import { Empty, Stat, Table, Tabs, Td, Th, TriageBadge, inputClass, selectSmClass } from "@/components/crm/ui";
import type { ClientOption, HotGroup, Lead, TaskRefs } from "@/lib/crm/data";
import { KLIJENT_TIP, LEAD_IZVOR, LEAD_OPEN, LEAD_STATUS, type KlijentTip, type LeadIzvor } from "@/lib/crm/options";
import { fmtAgo, fmtDate } from "@/lib/crm/format";
import { addDays } from "@/lib/crm/dates";
import { callQueue } from "@/lib/crm/leads-util";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

type Tab = "aktivnosti" | "aktivni" | "nazovi" | "eu_radar" | "zatvoreni" | "arhiva";
const CONVERSION_DAYS = 90;


export function LeadsView({
  leads,
  groups,
  clients,
  refs,
  me,
  today,
  openId,
  startNew,
}: {
  leads: Lead[];
  groups: HotGroup[];
  clients: ClientOption[];
  refs: TaskRefs;
  me: { id: string; role: StaffRole };
  today: string;
  openId: string | null;
  startNew: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("aktivnosti");
  const [q, setQ] = React.useState("");
  const [izvor, setIzvor] = React.useState<"" | LeadIzvor>("");
  const [owner, setOwner] = React.useState("");
  const [tip, setTip] = React.useState<"" | KlijentTip>("");
  const [selected, setSelected] = React.useState<string | null>(openId);
  const [creating, setCreating] = React.useState(startNew);
  const { show, node } = useFlash();

  const live = leads.filter((l) => !l.archived_at);
  const openLeads = live.filter((l) => LEAD_OPEN.includes(l.status));
  const queue = callQueue(live);
  const todayStart = new Date(`${today}T00:00:00`).getTime();
  const weekAgo = new Date(`${addDays(today, -6)}T00:00:00`).getTime();
  const novDanas = live.filter((l) => new Date(l.created_at).getTime() >= todayStart).length;
  const nov7 = live.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;
  const triaged = openLeads.filter((l) => l.trijaza != null);
  const avgTriage = triaged.length ? Math.round(triaged.reduce((s, l) => s + (l.trijaza ?? 0), 0) / triaged.length) : null;
  const since = new Date(`${addDays(today, -CONVERSION_DAYS)}T00:00:00`).getTime();
  const recent = leads.filter((l) => new Date(l.created_at).getTime() >= since);
  const conv = recent.length ? Math.round((recent.filter((l) => l.status === "pretvoren").length / recent.length) * 100) : null;

  const base: Record<Tab, Lead[]> = {
    aktivnosti: live,
    aktivni: openLeads,
    nazovi: queue,
    eu_radar: live.filter((l) => l.izvor === "eu_radar"),
    zatvoreni: live.filter((l) => l.status === "pretvoren" || l.status === "izgubljen"),
    arhiva: leads.filter((l) => l.archived_at),
  };
  const rows = base[tab].filter((l) => {
    if (izvor && l.izvor !== izvor) return false;
    if (tip && l.klijent_tip !== tip) return false;
    if (owner === "-" ? l.owner : owner && l.owner !== owner) return false;
    if (q) {
      const s = q.toLowerCase().trim();
      const hay = [`l-${l.broj}`, l.naziv, l.kontakt_ime, l.email, l.telefon, l.oib, l.interes, l.zupanija].join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
  const selectedLead = leads.find((l) => l.id === selected) ?? null;
  const ownerName = (id: string | null) => {
    const m = refs.team.find((t) => t.id === id);
    return m ? m.short || m.name : "—";
  };

  return (
    <div className="space-y-4">
      {node}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Novi danas" value={novDanas} hint={`${nov7} u zadnjih 7 dana`} />
        <Stat label="Nazovi prvo" value={queue.length} hint={`od toga ${queue.filter((l) => (l.trijaza ?? 0) >= 80).length} s trijažom ≥ 80`} />
        <Stat label="Prosječna trijaža" value={avgTriage ?? "—"} hint="otvoreni leadovi s trijažom" />
        <Stat label="Konverzija" value={conv == null ? "—" : `${conv} %`} hint={`lead → klijent, zadnjih ${CONVERSION_DAYS} dana`} />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input
              className={cn(inputClass, "pl-8")}
              placeholder="Traži po nazivu, L-broju, kontaktu, e-mailu, mobitelu, OIB-u…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className={selectSmClass} value={izvor} onChange={(e) => setIzvor(e.target.value as LeadIzvor)}>
            <option value="">Svi izvori</option>
            {Object.entries(LEAD_IZVOR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className={selectSmClass} value={tip} onChange={(e) => setTip(e.target.value as KlijentTip)}>
            <option value="">Sve vrste</option>
            {Object.entries(KLIJENT_TIP).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className={selectSmClass} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Svi vlasnici</option>
            <option value="-">Nedodijeljeni</option>
            {refs.team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novi lead
          </Button>
        </div>
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "aktivnosti", label: "Zadnje aktivnosti" },
          { value: "aktivni", label: "Aktivni", count: openLeads.length },
          { value: "nazovi", label: "Nazovi prvo", count: queue.length },
          { value: "eu_radar", label: "Iz EU Radara", count: base.eu_radar.length },
          { value: "zatvoreni", label: "Zatvoreni", count: base.zatvoreni.length },
          { value: "arhiva", label: "Arhiva", count: base.arhiva.length },
        ]}
      />

      {rows.length === 0 ? (
        <Empty title="Nema leadova">
          {leads.length === 0 ? "Dodaj prvi lead gumbom „Novi lead“. Registracije na EU Radar stižu ovdje same." : "Promijeni filtre ili tražilicu."}
        </Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th className="w-16">Trijaža</Th>
                <Th>Lead</Th>
                <Th>Izvor</Th>
                <Th>Interes</Th>
                <Th>Status</Th>
                <Th>Vlasnik</Th>
                <Th>{tab === "aktivnosti" ? "Zadnja aktivnost" : "Primljeno"}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => setSelected(l.id)} className="cursor-pointer hover:bg-surface-2/60">
                  <Td>
                    <TriageBadge value={l.trijaza} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5 font-medium">
                      {l.hot_at && <Flame className="h-4 w-4 shrink-0 text-danger" />}
                      <span className="text-muted-2">L-{l.broj}</span>
                      <span className="truncate">{l.naziv}</span>
                    </div>
                    <div className="text-xs text-muted">
                      {KLIJENT_TIP[l.klijent_tip]}
                      {l.kontakt_ime ? ` · ${l.kontakt_ime}` : ""}
                      {l.zupanija ? ` · ${l.zupanija}` : ""}
                    </div>
                  </Td>
                  <Td className="text-xs text-muted">{LEAD_IZVOR[l.izvor]}</Td>
                  <Td className="max-w-56 truncate text-xs">{l.interes ?? "—"}</Td>
                  <Td>
                    <Badge tone={LEAD_STATUS[l.status].tone}>{LEAD_STATUS[l.status].label}</Badge>
                  </Td>
                  <Td className="text-sm">{l.owner ? ownerName(l.owner) : <span className="text-warning">Nedodijeljen</span>}</Td>
                  <Td className="whitespace-nowrap text-xs text-muted">
                    {tab === "aktivnosti" ? fmtAgo(l.last_activity_at) : fmtDate(l.created_at)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {creating && (
        <LeadForm
          team={refs.team}
          meId={me.id}
          lockOwner={me.role === "suradnik"}
          onClose={() => {
            setCreating(false);
            if (startNew) router.replace("/crm/leadovi");
          }}
          onSaved={(id, m) => {
            show({ ok: true, message: m });
            if (id) setSelected(id);
          }}
        />
      )}
      {selectedLead && (
        <LeadPanel
          key={selectedLead.id}
          lead={selectedLead}
          groups={groups}
          clients={clients}
          refs={refs}
          me={me}
          today={today}
          onClose={() => {
            setSelected(null);
            if (openId) router.replace("/crm/leadovi");
          }}
          notify={show}
        />
      )}
    </div>
  );
}
