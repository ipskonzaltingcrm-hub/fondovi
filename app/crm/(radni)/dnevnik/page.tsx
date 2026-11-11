import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, inputClass, Table, Td, Th } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { fmtDateTime } from "@/lib/crm/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dnevnik izmjena" };

const PERIODS = { danas: "Danas", "7": "Zadnjih 7 dana", "30": "Zadnjih 30 dana", "90": "Zadnjih 90 dana" } as const;
type Period = keyof typeof PERIODS;

const TABS = {
  sve: { label: "Sve", actions: null },
  pregledi: { label: "Pregledi", actions: ["pregled"] },
  izmjene: { label: "Izmjene", actions: ["novo", "izmjena", "brisanje"] },
  izvozi: { label: "Izvozi", actions: ["izvoz"] },
  prijave: { label: "Prijave", actions: ["prijava"] },
} as const;
type Tab = keyof typeof TABS;

const ACTION: Record<string, { label: string; tone: "neutral" | "success" | "info" | "danger" | "warning" | "brand" }> = {
  pregled: { label: "Pregled", tone: "neutral" },
  novo: { label: "Novo", tone: "success" },
  izmjena: { label: "Izmjena", tone: "info" },
  brisanje: { label: "Brisanje", tone: "danger" },
  izvoz: { label: "Izvoz", tone: "warning" },
  prijava: { label: "Prijava", tone: "brand" },
};

const ENTITY: Record<string, string> = {
  tenants: "Klijent",
  jls_profiles: "Profil klijenta",
  profiles: "Korisnik",
  crm_invitations: "Pozivnica",
  sesija: "Prijava u CRM",
};

const FIELD: Record<string, string> = {
  naziv: "naziv",
  status: "status",
  staff_role: "uloga",
  staff_active: "aktivan",
  full_name: "ime",
  short_name: "kratko ime",
  job_title: "funkcija",
  phone: "mobitel",
  email: "e-mail",
  role: "uloga",
  revoked_at: "opozvana",
  accepted_at: "prihvaćena",
};

type Row = {
  id: number;
  at: string;
  actor: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  label: string | null;
  changes: Record<string, [unknown, unknown]>;
};

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function since(p: Period): string {
  const d = new Date();
  if (p === "danas") d.setHours(0, 0, 0, 0);
  else d.setDate(d.getDate() - Number(p));
  return d.toISOString();
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "da" : "ne";
  if (Array.isArray(v)) return v.join(", ") || "—";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? fmtDateTime(s) : s;
}

export default async function DnevnikPage({ searchParams }: PageProps<"/crm/dnevnik">) {
  const me = await requireStaff();
  if (!me.isAdmin) {
    return (
      <>
        <PageHeader title="Dnevnik izmjena" />
        <Empty title="Dnevnik izmjena vide samo administratori">
          <Lock className="mx-auto mt-2 h-5 w-5 text-muted-2" />
        </Empty>
      </>
    );
  }

  const sp = await searchParams;
  const period: Period = (one(sp.razdoblje) as Period) in PERIODS ? (one(sp.razdoblje) as Period) : "7";
  const tab: Tab = (one(sp.tab) as Tab) in TABS ? (one(sp.tab) as Tab) : "sve";
  const clan = one(sp.clan) ?? "";
  const q = (one(sp.q) ?? "").trim();

  const supabase = await createClient();
  let query = supabase
    .from("crm_audit_log")
    .select("id,at,actor,actor_name,action,entity,entity_id,label,changes")
    .gte("at", since(period))
    .order("at", { ascending: false })
    .limit(1000);
  if (clan) query = query.eq("actor", clan);
  const { data } = await query;
  const all = (data ?? []) as Row[];

  // Kartice po članu (u odabranom razdoblju, prije filtra taba i pretrage).
  const perMember = new Map<string, { name: string; views: number; edits: number; exports: number }>();
  for (const r of all) {
    const key = r.actor ?? "sustav";
    const m = perMember.get(key) ?? { name: r.actor_name ?? "Sustav / servis", views: 0, edits: 0, exports: 0 };
    if (r.action === "pregled") m.views++;
    else if (r.action === "izvoz") m.exports++;
    else if (r.action !== "prijava") m.edits++;
    perMember.set(key, m);
  }

  const actions = TABS[tab].actions as readonly string[] | null;
  const needle = q.toLowerCase();
  const rows = all.filter(
    (r) =>
      (!actions || actions.includes(r.action)) &&
      (!needle ||
        [r.label, r.actor_name, ENTITY[r.entity] ?? r.entity].some((s) => s?.toLowerCase().includes(needle))),
  );

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ razdoblje: period, tab, ...(clan ? { clan } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/crm/dnevnik?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Dnevnik izmjena"
        description="Tko je što pregledao, mijenjao i izvezao, te prijave u CRM. Zapisi se iz aplikacije ne mogu brisati."
      />

      <form className="mb-4 flex flex-wrap items-end gap-2" action="/crm/dnevnik">
        <input type="hidden" name="tab" value={tab} />
        {clan && <input type="hidden" name="clan" value={clan} />}
        <select name="razdoblje" defaultValue={period} className={cn(inputClass, "w-auto")}>
          {Object.entries(PERIODS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Traži zapis ili člana…" className={cn(inputClass, "w-64")} />
        <button className="h-9 rounded-md border border-border px-3 text-sm hover:bg-surface-2">Primijeni</button>
        {(clan || q) && (
          <Link href={href({ clan: "", q: "" })} className="text-sm text-muted hover:underline">
            Poništi filtre
          </Link>
        )}
      </form>

      {perMember.size > 0 && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...perMember.entries()].map(([id, m]) => (
            <Link
              key={id}
              href={id === "sustav" ? href({}) : href({ clan: clan === id ? "" : id })}
              className={cn(
                "rounded-lg border bg-surface p-3 transition-colors hover:border-brand",
                clan === id ? "border-brand" : "border-border",
              )}
            >
              <div className="truncate font-medium">{m.name}</div>
              <div className="mt-1 flex gap-3 text-xs text-muted tabular">
                <span>{m.views} pregleda</span>
                <span>{m.edits} izmjena</span>
                <span>{m.exports} izvoza</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={href({ tab: t })}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {TABS[t].label}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="px-0 py-1">
          {rows.length === 0 ? (
            <div className="p-5">
              <Empty title="Nema zapisa za odabrane filtre" />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="pl-5">Vrijeme</Th>
                  <Th>Član</Th>
                  <Th>Radnja</Th>
                  <Th className="pr-5">Zapis</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = ACTION[r.action] ?? { label: r.action, tone: "neutral" as const };
                  const changes = Object.entries(r.changes ?? {});
                  return (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap pl-5 text-muted tabular">{fmtDateTime(r.at)}</Td>
                      <Td className="whitespace-nowrap">{r.actor_name ?? <span className="text-muted-2">Sustav / servis</span>}</Td>
                      <Td>
                        <Badge tone={a.tone}>{a.label}</Badge>
                      </Td>
                      <Td className="pr-5">
                        <div>
                          <span className="text-muted-2">{ENTITY[r.entity] ?? r.entity}</span>
                          {r.label && <span className="ml-1.5 font-medium">{r.label}</span>}
                        </div>
                        {changes.length > 0 && (
                          <details className="group mt-1">
                            <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted hover:text-foreground">
                              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                              {changes.length} {changes.length === 1 ? "polje" : "polja"}
                            </summary>
                            <ul className="mt-1.5 space-y-0.5 text-xs">
                              {changes.map(([k, [from, to]]) => (
                                <li key={k} className="text-muted">
                                  <span className="text-foreground">{FIELD[k] ?? k}:</span>{" "}
                                  {r.action === "novo" ? show(to) : (
                                    <>
                                      <span className="line-through decoration-muted-2/60">{show(from)}</span> → {show(to)}
                                    </>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
      {all.length === 1000 && (
        <p className="mt-2 text-xs text-muted-2">Prikazano je zadnjih 1000 zapisa u razdoblju; suzite razdoblje ili filtrirajte po članu.</p>
      )}
    </>
  );
}
