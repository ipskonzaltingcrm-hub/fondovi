import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Star,
  CalendarClock,
  Coins,
  Layers,
  Building2,
  RefreshCw,
  CheckCircle2,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  DeadlinePill,
  LevelBadge,
  StatusBadge,
} from "@/components/pozivi/call-badges";
import { applicantLabel, getCall, matchCall } from "@/lib/domain";
import { jlsList } from "@/lib/mock-data";
import { formatDate, formatEur, formatRange } from "@/lib/utils";

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const call = getCall(id);
  if (!call) notFound();

  const relevant = jlsList
    .map((j) => ({ jls: j, m: matchCall(call, j) }))
    .filter((r) => r.m.eligible)
    .sort((a, b) => b.m.score - a.m.score);

  return (
    <div>
      <Link
        href="/pozivi"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Natrag na natječaje
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={call.status} />
        <LevelBadge level={call.level} />
        <DeadlinePill call={call} />
      </div>

      <PageHeader title={call.naslov} description={call.davatelj}>
        <Button variant="outline">
          <Star className="h-4 w-4" /> Prati
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h2 className="font-display text-base font-semibold">O pozivu</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {call.sazetak}
            </p>
            <p className="mt-3 text-sm font-medium text-brand-ink">
              {call.program}
            </p>

            <h3 className="mt-6 text-sm font-semibold">Prihvatljivi prijavitelji</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {call.prihvatljivi.map((a) => (
                <span
                  key={a}
                  className="rounded-md bg-surface-2 px-2.5 py-1 text-sm text-foreground"
                >
                  {applicantLabel[a]}
                </span>
              ))}
            </div>

            <h3 className="mt-6 text-sm font-semibold">Sektori / tematika</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {call.sektori.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          </Card>

          {/* Relevantno za JLS klijente */}
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-ink" />
              <h2 className="font-display text-base font-semibold">
                Relevantno za klijente
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              JLS-ovi za koje je ovaj poziv prihvatljiv — rangirano po
              podudarnosti profila.
            </p>
            <ul className="mt-4 space-y-2">
              {relevant.map(({ jls, m }) => (
                <li key={jls.id}>
                  <Link
                    href={`/klijenti/${jls.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-brand hover:bg-surface-2"
                  >
                    <MatchRing score={m.score} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{jls.naziv}</p>
                      <p className="truncate text-xs text-muted">
                        {m.reasons[0]}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <dl className="space-y-4">
              <Fact icon={CalendarClock} label="Rok prijave">
                {call.status === "najava" ? "Najava" : formatDate(call.rokPrijave)}
              </Fact>
              <Fact icon={Coins} label="Iznos potpore">
                <span className="tabular">
                  {formatRange(call.iznosMin, call.iznosMax)}
                </span>
              </Fact>
              <Fact icon={Layers} label="Intenzitet potpore">
                {call.intenzitet}
              </Fact>
              <Fact icon={Wallet} label="Ukupna alokacija">
                <span className="tabular">{formatEur(call.ukupnaAlokacija)}</span>
              </Fact>
              <Fact icon={RefreshCw} label="Ažurirano">
                {formatDate(call.azurirano)} · izvor {call.izvor}
              </Fact>
            </dl>

            <ButtonLink
              href={call.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 w-full"
            >
              Otvori izvorni poziv <ExternalLink className="h-4 w-4" />
            </ButtonLink>
            <p className="mt-2 text-center text-xs text-muted-2">
              Vodi na službeni tekst poziva, ne na vijest.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-2" />
      <div>
        <dt className="text-xs text-muted-2">{label}</dt>
        <dd className="text-sm font-medium">{children}</dd>
      </div>
    </div>
  );
}

function MatchRing({ score }: { score: number }) {
  return (
    <div
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--brand) ${score * 3.6}deg, var(--surface-3) 0deg)`,
      }}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[11px] font-bold tabular">
        {score}
      </div>
    </div>
  );
}
