import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Users,
  Sprout,
  Mail,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DeadlinePill,
  LevelBadge,
  StatusBadge,
} from "@/components/pozivi/call-badges";
import { getJls, matchesForJls } from "@/lib/domain";
import { formatRange } from "@/lib/utils";

const tipLabel = { grad: "Grad", opcina: "Općina", zupanija: "Županija" } as const;

export default async function JlsProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jls = getJls(id);
  if (!jls) notFound();

  const matches = matchesForJls(jls);
  const otvoreni = matches.filter((m) => m.call.status === "otvoren");

  return (
    <div>
      <Link
        href="/klijenti"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Natrag na klijente
      </Link>

      <div className="mb-6 flex items-center gap-2">
        <Badge tone="brand">{tipLabel[jls.tip]}</Badge>
        <Badge
          tone={
            jls.status === "aktivan"
              ? "success"
              : jls.status === "trial"
                ? "warning"
                : "neutral"
          }
        >
          {jls.status}
        </Badge>
      </div>

      <PageHeader title={jls.naziv} />

      {/* Atributi profila */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Attr icon={MapPin} label="Županija" value={jls.zupanija} />
        <Attr
          icon={Users}
          label="Stanovnika"
          value={jls.stanovnika.toLocaleString("hr-HR")}
        />
        <Attr
          icon={Sprout}
          label="Tip područja"
          value={jls.ruralno ? "Ruralno" : "Urbano"}
        />
        <Attr icon={Mail} label="Kontakt" value={jls.kontaktOsoba} />
      </div>

      {jls.lag && (
        <p className="mt-3 text-sm text-muted">
          <span className="font-medium text-foreground">LAG:</span> {jls.lag}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-muted">Sektori interesa:</span>
        {jls.sektoriInteresa.map((s) => (
          <span
            key={s}
            className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink"
          >
            {s}
          </span>
        ))}
      </div>

      {/* Matching */}
      <div className="mt-8 flex items-center gap-2">
        <Target className="h-5 w-5 text-brand-ink" />
        <h2 className="font-display text-xl font-bold tracking-tight">
          Na koje se natječaje može prijaviti
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        {otvoreni.length} otvorenih prilika · rangirano po podudarnosti s profilom JLS-a.
      </p>

      <div className="mt-5 space-y-3">
        {matches.map(({ call, score, reasons }) => (
          <Card
            key={call.id}
            className="group relative p-4 transition-all hover:border-brand hover:bg-surface-2"
          >
            <Link
              href={`/pozivi/${call.id}`}
              className="absolute inset-0 z-10 rounded-lg"
              aria-label={call.naslov}
            />
            <div className="flex items-start gap-4">
              <MatchRing score={score} />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={call.status} />
                  <LevelBadge level={call.level} />
                  <DeadlinePill call={call} />
                </div>
                <h3 className="font-display text-[15px] font-semibold leading-snug">
                  {call.naslov}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{call.davatelj}</p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {reasons.slice(0, 2).map((r) => (
                    <li
                      key={r}
                      className="text-xs text-muted before:mr-1 before:text-brand-ink before:content-['✓']"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="hidden shrink-0 text-right sm:block">
                <div className="text-xs text-muted-2">Potpora</div>
                <div className="text-sm font-medium tabular">
                  {formatRange(call.iznosMin, call.iznosMax)}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Attr({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-2">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </Card>
  );
}

function MatchRing({ score }: { score: number }) {
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--brand) ${score * 3.6}deg, var(--surface-3) 0deg)`,
      }}
    >
      <div className="flex h-9 w-9 flex-col items-center justify-center rounded-full bg-surface">
        <span className="text-xs font-bold leading-none tabular">{score}</span>
        <span className="text-[8px] text-muted-2">match</span>
      </div>
    </div>
  );
}
