import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Flame, Phone, Plus, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TriageBadge } from "@/components/crm/ui";
import { crmNavFor, PHASE_LABEL, type CrmNavItem } from "@/lib/crm/nav";
import { requireStaff } from "@/lib/crm/session";
import { createClient } from "@/lib/supabase/server";
import { LEAD_COLS, TASK_COLS, getTaskRefs, type Lead, type Task } from "@/lib/crm/data";
import { callQueue } from "@/lib/crm/leads-util";
import { addDays, daysBetween, fmtDay, fmtLongToday, todayZg, weekStart } from "@/lib/crm/dates";
import { KLIJENT_TIP, LEAD_IZVOR } from "@/lib/crm/options";
import { getCalls } from "@/lib/data";
import { cn } from "@/lib/utils";
import { LeadChannels, MyTasks } from "./my-day";

export const metadata = { title: "Moj dan" };

const zgDay = (iso: string) => todayZg(new Date(iso));

export default async function MojDan() {
  const me = await requireStaff();
  const today = todayZg();
  const supabase = await createClient();
  const [{ data: leadRows }, { data: taskRows }, calls, refs] = await Promise.all([
    supabase.from("crm_leads").select(LEAD_COLS).is("archived_at", null).limit(5000),
    supabase
      .from("crm_tasks")
      .select(TASK_COLS)
      .eq("owner", me.id)
      .is("done_at", null)
      .is("archived_at", null)
      .order("rok", { ascending: true, nullsFirst: false }),
    getCalls(),
    getTaskRefs(),
  ]);
  const leads = (leadRows ?? []) as Lead[];
  const myTasks = (taskRows ?? []) as unknown as Task[];

  // Leadovi po tjednima (tjedan od ponedjeljka) i mjesecu.
  const wk = weekStart(today);
  const days = leads.map((l) => ({ l, d: zgDay(l.created_at) }));
  const inRange = (from: string, to: string) => days.filter((x) => x.d >= from && x.d <= to).length;
  const thisWeek = inRange(wk, today);
  const lastWeek = inRange(addDays(wk, -7), addDays(wk, -1));
  const thisMonth = inRange(today.slice(0, 8) + "01", today);
  const yearStart = today.slice(0, 4) + "-01-01";
  const weeksSoFar = Math.max(1, Math.ceil((daysBetween(yearStart, today) + 1) / 7));
  const avgWeek = Math.round((inRange(yearStart, today) / weeksSoFar) * 10) / 10;
  const bars = [3, 2, 1, 0].map((i) => {
    const from = addDays(wk, -7 * i);
    return { label: i === 0 ? "ovaj" : `−${i}`, from, n: inRange(from, i === 0 ? today : addDays(from, 6)) };
  });
  const maxBar = Math.max(1, ...bars.map((b) => b.n));
  const channels = (Object.keys(LEAD_IZVOR) as (keyof typeof LEAD_IZVOR)[]).map((k) => ({
    key: k,
    label: LEAD_IZVOR[k],
    week: days.filter((x) => x.l.izvor === k && x.d >= wk).length,
    month: days.filter((x) => x.l.izvor === k && x.d >= today.slice(0, 8) + "01").length,
    year: days.filter((x) => x.l.izvor === k && x.d >= yearStart).length,
  }));

  const queue = callQueue(leads);
  const hot = leads.filter((l) => l.hot_at && l.status !== "pretvoren" && l.status !== "izgubljen");
  const unassigned = leads.filter((l) => !l.owner && l.status === "novi").length;
  const dueToday = myTasks.filter((t) => t.rok && t.rok <= today).length;

  // Natječaji iz EU Radara: novi u zadnja 3 dana, rokovi u sljedećih 14 dana.
  const fresh = calls.filter((c) => c.status !== "zatvoren" && c.datumObjave.slice(0, 10) >= addDays(today, -3)).slice(0, 6);
  const deadlines = calls
    .filter((c) => c.status === "otvoren" && c.rokPrijave && c.rokPrijave >= today && c.rokPrijave <= addDays(today, 14))
    .sort((a, b) => a.rokPrijave!.localeCompare(b.rokPrijave!))
    .slice(0, 8);

  const first = me.name.split(/\s+/)[0];
  const summary = [
    `${dueToday} ${dueToday === 1 ? "zadatak" : "zadataka"} za danas`,
    `${queue.length} ${queue.length === 1 ? "lead čeka" : "leadova čeka"} poziv`,
    unassigned ? `${unassigned} nedodijeljenih novih leadova` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <p className="text-sm capitalize text-muted">{fmtLongToday()}</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Dobar dan{first && !first.includes("@") ? `, ${first}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">{summary.join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/crm/leadovi?novi=1" size="sm">
            <Plus className="h-4 w-4" /> Novi lead
          </ButtonLink>
          <ButtonLink href="/crm/zadaci" size="sm" variant="secondary">
            <CheckCircle2 className="h-4 w-4" /> Zadaci
          </ButtonLink>
        </div>
      </div>

      {/* 1 Leadovi */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-2">1 · Leadovi</h2>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <Card className="p-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                ["Ovaj tjedan", thisWeek],
                ["Prošli tjedan", lastWeek],
                ["Ovaj mjesec", thisMonth],
                ["Prosjek tjedna", avgWeek],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-2">{l}</div>
                  <div className="font-display text-2xl font-bold tabular">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-20 items-end gap-3">
              {bars.map((b) => (
                <div key={b.from} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs tabular text-muted">{b.n}</span>
                  <div className={cn("w-full rounded-t", b.label === "ovaj" ? "bg-brand" : "bg-brand-soft")} style={{ height: `${(b.n / maxBar) * 48 + 2}px` }} />
                  <span className="text-[10px] text-muted-2">{b.label === "ovaj" ? "ovaj tj." : `${fmtDay(b.from)}`}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-2">Prosjek tjedna računa se od 1. 1.</p>
          </Card>
          <LeadChannels channels={channels} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Nazovi prvo */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4 text-brand-ink" />
            <h2 className="flex-1 font-display font-semibold">Nazovi prvo</h2>
            <Link href="/crm/leadovi" className="text-xs font-medium text-brand-ink hover:underline">
              Svi leadovi
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-muted">Nema leadova koji čekaju poziv.</p>
          ) : (
            <ul className="divide-y divide-border">
              {queue.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <Link href={`/crm/leadovi?lead=${l.id}`} className="flex items-center gap-3 py-2 hover:text-brand-ink">
                    <TriageBadge value={l.trijaza} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="text-muted-2">L-{l.broj}</span> {l.naziv}
                      <span className="text-xs text-muted"> · {KLIJENT_TIP[l.klijent_tip]}</span>
                    </span>
                    {l.telefon && <span className="text-xs text-muted">{l.telefon}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Moji zadaci */}
        <MyTasks tasks={myTasks} today={today} refs={refs} meId={me.id} lockOwner={me.role === "suradnik"} />

        {/* Natječaji */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-brand-ink" />
            <h2 className="flex-1 font-display font-semibold">Natječaji</h2>
            <Link href="/pozivi" className="text-xs font-medium text-brand-ink hover:underline">
              EU Radar
            </Link>
          </div>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">Rokovi u sljedećih 14 dana</h3>
          {deadlines.length === 0 ? (
            <p className="mb-3 text-sm text-muted">Nema rokova u sljedećih 14 dana.</p>
          ) : (
            <ul className="mb-3 space-y-1.5">
              {deadlines.map((c) => {
                const d = daysBetween(today, c.rokPrijave!);
                return (
                  <li key={c.id} className="flex items-center gap-2 text-sm">
                    <span className={cn("w-14 shrink-0 text-xs font-semibold tabular", d <= 7 ? "text-danger" : "text-warning")}>
                      {d === 0 ? "danas" : `još ${d} d`}
                    </span>
                    <Link href={`/pozivi/${c.id}`} className="truncate hover:text-brand-ink hover:underline">
                      {c.naslov}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">Novo u zadnja 3 dana</h3>
          {fresh.length === 0 ? (
            <p className="text-sm text-muted">Nema novih natječaja.</p>
          ) : (
            <ul className="space-y-1.5">
              {fresh.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-ink" />
                  <Link href={`/pozivi/${c.id}`} className="truncate hover:text-brand-ink hover:underline">
                    {c.naslov}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Hot leadovi */}
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-danger" />
            <h2 className="flex-1 font-display font-semibold">Hot leadovi</h2>
            <Link href="/crm/hot-leadovi" className="text-xs font-medium text-brand-ink hover:underline">
              Otvori
            </Link>
          </div>
          {hot.length === 0 ? (
            <p className="text-sm text-muted">Nema otvorenih hot leadova.</p>
          ) : (
            <>
              <p className="mb-2 text-sm">
                <b className="tabular">{hot.length}</b> otvorenih hot leadova
                {hot.filter((l) => l.status === "ponuda").length > 0 && <>, od toga <b className="tabular">{hot.filter((l) => l.status === "ponuda").length}</b> s ponudom</>}.
              </p>
              <ul className="divide-y divide-border">
                {hot
                  .sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))
                  .slice(0, 5)
                  .map((l) => (
                    <li key={l.id}>
                      <Link href={`/crm/leadovi?lead=${l.id}`} className="flex items-center gap-2 py-1.5 text-sm hover:text-brand-ink">
                        <span className="text-muted-2">L-{l.broj}</span>
                        <span className="truncate">{l.naziv}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <Roadmap isAdmin={me.isAdmin} isSuperadmin={me.isSuperadmin} />
    </div>
  );
}

function Roadmap({ isAdmin, isSuperadmin }: { isAdmin: boolean; isSuperadmin: boolean }) {
  const items = crmNavFor(isAdmin, isSuperadmin).flatMap((g) => g.items);
  const byPhase = new Map<number, CrmNavItem[]>();
  for (const i of items) byPhase.set(i.phase, [...(byPhase.get(i.phase) ?? []), i]);
  const phases = [...byPhase.keys()].sort((a, b) => a - b);
  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" /> Plan izgradnje CRM-a po fazama
      </summary>
      <div className="space-y-4 border-t border-border p-4">
        {phases.map((p) => {
          const list = byPhase.get(p)!;
          const done = list.every((i) => i.live);
          return (
            <div key={p}>
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{PHASE_LABEL[p]}</h3>
                {done ? (
                  <Badge tone="success">
                    <CheckCircle2 className="h-3 w-3" /> radi
                  </Badge>
                ) : (
                  <Badge tone="neutral">
                    <Clock className="h-3 w-3" /> u planu
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((i) => (
                  <Link key={i.href} href={i.href} className={cn("rounded-md border px-2.5 py-1 text-xs", i.live ? "border-border-strong" : "border-border text-muted")}>
                    {i.label}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
