import Link from "next/link";
import {
  Megaphone,
  TimerReset,
  Bell,
  Wallet,
  ArrowRight,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { DeadlinePill, StatusBadge } from "@/components/pozivi/call-badges";
import { ButtonLink } from "@/components/ui/button";
import { calls, jlsList } from "@/lib/mock-data";
import { dashboardStats, deadlineState } from "@/lib/domain";
import { daysUntil, formatDate, formatEur } from "@/lib/utils";

export const metadata = { title: "Pregled" };

export default function DashboardPage() {
  const stats = dashboardStats();

  const hitni = calls
    .filter((c) => {
      const d = daysUntil(c.rokPrijave);
      return c.status === "otvoren" && d !== null && d >= 0 && d <= 30;
    })
    .sort((a, b) => (daysUntil(a.rokPrijave) ?? 0) - (daysUntil(b.rokPrijave) ?? 0));

  const najave = calls.filter((c) => c.status === "najava");

  return (
    <div>
      <PageHeader
        title="Dobrodošli natrag 👋"
        description="Pregled otvorenih prilika, rokova koji istječu i najava za jedinice lokalne samouprave."
      >
        <ButtonLink href="/pozivi" variant="primary">
          Svi natječaji <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </PageHeader>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Megaphone}
          label="Otvoreni natječaji"
          value={stats.otvoreniBroj}
          tone="brand"
        />
        <StatTile
          icon={TimerReset}
          label="Rok ≤ 14 dana"
          value={stats.hitniBroj}
          tone="danger"
        />
        <StatTile
          icon={Bell}
          label="Najave"
          value={stats.najaveBroj}
          tone="info"
        />
        <StatTile
          icon={Wallet}
          label="Dostupna alokacija"
          value={formatEur(stats.ukupnaAlokacija)}
          tone="neutral"
          small
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Rokovi koji istječu */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="font-display text-base font-semibold">
                Rokovi koji istječu
              </h2>
              <p className="text-sm text-muted">Sljedećih 30 dana</p>
            </div>
            <Link
              href="/pozivi"
              className="text-sm font-medium text-brand-ink hover:underline"
            >
              Svi
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {hitni.map((c) => {
              const ds = deadlineState(c);
              return (
                <li key={c.id}>
                  <Link
                    href={`/pozivi/${c.id}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-2"
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-background"
                      aria-hidden
                    >
                      <span className="text-sm font-bold leading-none tabular">
                        {ds.days}
                      </span>
                      <span className="text-[10px] text-muted-2">dana</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.naslov}</p>
                      <p className="truncate text-xs text-muted">
                        {c.davatelj} · rok {formatDate(c.rokPrijave)}
                      </p>
                    </div>
                    <DeadlinePill call={c} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Najave + klijenti */}
        <div className="space-y-6">
          <Card>
            <div className="border-b border-border p-5">
              <h2 className="font-display text-base font-semibold">Najave</h2>
              <p className="text-sm text-muted">Pripremite se unaprijed</p>
            </div>
            <ul className="divide-y divide-border">
              {najave.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/pozivi/${c.id}`}
                    className="block p-4 transition-colors hover:bg-surface-2"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="text-sm font-medium leading-snug">{c.naslov}</p>
                    <p className="mt-0.5 text-xs text-muted">{c.davatelj}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
                  <Building2 className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="font-display text-lg font-bold leading-none tabular">
                    {stats.jlsBroj}
                  </p>
                  <p className="text-xs text-muted">JLS klijenata</p>
                </div>
              </div>
              <Link
                href="/klijenti"
                className="text-sm font-medium text-brand-ink hover:underline"
              >
                Pregled
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  small,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  tone: "brand" | "danger" | "info" | "neutral";
  small?: boolean;
}) {
  const toneClasses = {
    brand: "bg-brand-soft text-brand-ink",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    neutral: "bg-surface-2 text-muted",
  }[tone];

  return (
    <Card className="p-5">
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${toneClasses}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div
        className={`font-display font-bold tracking-tight tabular ${small ? "text-xl" : "text-3xl"}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-sm text-muted">{label}</div>
    </Card>
  );
}
