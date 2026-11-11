"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProjectForm } from "@/components/crm/project-form";
import { Empty, Stat, Table, Tabs, Td, Th, inputClass, selectSmClass } from "@/components/crm/ui";
import type { ProjectInput } from "@/lib/crm/actions/projects";
import type { ProjectRow, TaskRefs } from "@/lib/crm/data";
import { PROJECT_ACTIVE, PROJECT_FAZA, type ProjectFaza } from "@/lib/crm/options";
import { daysBetween, fmtDay } from "@/lib/crm/dates";
import type { StaffRole } from "@/lib/crm/roles";
import { cn } from "@/lib/utils";

type Tab = "aktivni" | "zavrseni" | "svi";
const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function ProjectsView({
  projects,
  refs,
  me,
  today,
  preset,
}: {
  projects: ProjectRow[];
  refs: TaskRefs;
  me: { id: string; role: StaffRole };
  today: string;
  preset: Partial<ProjectInput> | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("aktivni");
  const [q, setQ] = React.useState("");
  const [faza, setFaza] = React.useState<"" | ProjectFaza>("");
  const [mine, setMine] = React.useState(false);
  const [creating, setCreating] = React.useState(!!preset);
  const canCreate = me.role !== "suradnik";

  const active = projects.filter((p) => PROJECT_ACTIVE.includes(p.faza));
  const preparing = projects.filter((p) => p.faza === "priprema" || p.faza === "dokumentacija" || p.faza === "evaluacija" || p.faza === "predano");
  const soon = projects.filter((p) => (p.faza === "priprema" || p.faza === "dokumentacija") && p.rok_prijave && p.rok_prijave >= today && daysBetween(today, p.rok_prijave) <= 7);
  const inProcess = preparing.reduce((s, p) => s + (p.iznos_potpore ?? 0), 0);
  const approved = projects.filter((p) => p.faza === "odobreno" || p.faza === "isplata" || p.faza === "zavrseno");

  const base: Record<Tab, ProjectRow[]> = {
    aktivni: active,
    zavrseni: projects.filter((p) => !PROJECT_ACTIVE.includes(p.faza)),
    svi: projects,
  };
  const rows = base[tab].filter((p) => {
    if (faza && p.faza !== faza) return false;
    if (mine && p.owner !== me.id) return false;
    if (q) {
      const s = q.toLowerCase();
      if (![`pr-${p.broj}`, p.naziv, p.program, p.client?.naziv, p.lead?.naziv, p.call?.naslov].join(" ").toLowerCase().includes(s)) return false;
    }
    return true;
  });
  const ownerName = (id: string | null) => {
    const m = refs.team.find((t) => t.id === id);
    return m ? m.short || m.name : "—";
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Aktivni projekti" value={active.length} hint={`${preparing.length} u pripremi ili čeka odluku`} />
        <Stat label="Rok za ≤ 7 dana" value={<span className={soon.length ? "text-danger" : ""}>{soon.length}</span>} hint="priprema / dokumentacija" />
        <Stat label="U obradi" value={eur.format(inProcess)} hint="tražena potpora" />
        <Stat label="Odobreno" value={approved.length} hint={eur.format(approved.reduce((s, p) => s + (p.iznos_potpore ?? 0), 0))} />
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            <input className={cn(inputClass, "pl-8")} placeholder="Traži projekt, klijenta, program, PR-broj…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={selectSmClass} value={faza} onChange={(e) => setFaza(e.target.value as ProjectFaza)}>
            <option value="">Sve faze</option>
            {Object.entries(PROJECT_FAZA).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm text-muted">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Samo moji
          </label>
          {canCreate && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Novi projekt
            </Button>
          )}
        </div>
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "aktivni", label: "Aktivni", count: base.aktivni.length },
          { value: "zavrseni", label: "Završeni i odbijeni", count: base.zavrseni.length },
          { value: "svi", label: "Svi", count: base.svi.length },
        ]}
      />

      {rows.length === 0 ? (
        <Empty title="Nema projekata">{projects.length ? "Promijeni filtre." : "Otvori prvi projekt gumbom „Novi projekt“ ili iz kartice natječaja."}</Empty>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>Projekt</Th>
                <Th>Klijent</Th>
                <Th>Faza</Th>
                <Th>Rok prijave</Th>
                <Th className="text-right">Potpora</Th>
                <Th>Checklista</Th>
                <Th>Vlasnik</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const done = p.items?.filter((i) => i.done_at).length ?? 0;
                const total = p.items?.length ?? 0;
                const d = p.rok_prijave ? daysBetween(today, p.rok_prijave) : null;
                return (
                  <tr key={p.id} className="cursor-pointer hover:bg-surface-2/60" onClick={() => router.push(`/crm/projekti/${p.id}`)}>
                    <Td>
                      <div className="font-medium">
                        <span className="text-muted-2">PR-{p.broj}</span> {p.naziv}
                      </div>
                      <div className="max-w-80 truncate text-xs text-muted">{p.program ?? p.call?.naslov ?? "—"}</div>
                    </Td>
                    <Td className="text-sm">
                      {p.client ? (
                        <Link href={`/crm/klijenti/${p.jls_profile_id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {p.client.naziv}
                        </Link>
                      ) : p.lead ? (
                        <span>
                          L-{p.lead.broj} {p.lead.naziv}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <Badge tone={PROJECT_FAZA[p.faza].tone}>{PROJECT_FAZA[p.faza].label}</Badge>
                    </Td>
                    <Td className={cn("whitespace-nowrap text-sm tabular", d != null && d >= 0 && d <= 7 && PROJECT_ACTIVE.slice(0, 2).includes(p.faza) ? "font-semibold text-danger" : "text-muted")}>
                      {p.rok_prijave ? fmtDay(p.rok_prijave) : "—"}
                    </Td>
                    <Td className="text-right text-sm tabular">{p.iznos_potpore != null ? eur.format(p.iznos_potpore) : "—"}</Td>
                    <Td className="text-sm tabular text-muted">{total ? `${done}/${total}` : "—"}</Td>
                    <Td className="text-sm">{ownerName(p.owner)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {creating && (
        <ProjectForm
          refs={refs}
          meId={me.id}
          preset={preset ?? undefined}
          onClose={() => {
            setCreating(false);
            if (preset) router.replace("/crm/projekti");
          }}
        />
      )}
    </div>
  );
}
