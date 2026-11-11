import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { crmNavFor, PHASE_LABEL, type CrmNavItem } from "@/lib/crm/nav";
import { requireStaff } from "@/lib/crm/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Moj dan" };

export default async function CrmHome() {
  const me = await requireStaff();
  const items = crmNavFor(me.isAdmin, me.isSuperadmin).flatMap((g) => g.items);
  const byPhase = new Map<number, CrmNavItem[]>();
  for (const i of items) byPhase.set(i.phase, [...(byPhase.get(i.phase) ?? []), i]);
  const phases = [...byPhase.keys()].sort((a, b) => a - b);
  const first = me.name.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        title={`Dobro došli u EU Radar CRM${first && !first.includes("@") ? `, ${first}` : ""}`}
        description="Interni CRM tima, povezan s aplikacijom EU Radar: isti klijenti, isti natječaji, ista baza. Gradi se po fazama — ispod je karta svih kartica i kada stižu."
      />

      <Card className="mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="font-display text-base font-semibold">„Moj dan“ stiže u Fazi 1</p>
          <p className="mt-0.5 text-sm text-muted">
            Kad budu gotovi Leadovi, Klijenti i Zadaci, ova stranica postaje tvoja početna: pokazatelji, koga zvati
            i rokovi natječaja. Do tada ovdje pratiš napredak izgradnje.
          </p>
        </div>
        <Link
          href="/crm/tim"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink hover:underline"
        >
          Tim i uloge <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>

      <div className="space-y-6">
        {phases.map((p) => {
          const list = byPhase.get(p)!;
          const done = list.every((i) => i.live);
          return (
            <section key={p}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">
                  {PHASE_LABEL[p]}
                </h2>
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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((i) => {
                  const Icon = i.icon;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={cn(
                        "group rounded-lg border bg-surface p-4 transition-colors hover:border-brand",
                        i.live ? "border-border-strong" : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-md",
                            i.live ? "bg-brand text-brand-contrast" : "bg-surface-2 text-muted-2",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-medium">{i.label}</span>
                      </div>
                      <p className="mt-2 text-sm text-muted">{i.summary}</p>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
