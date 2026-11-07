import Link from "next/link";
import { ArrowUpRight, CalendarClock, Coins, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DeadlinePill, LevelBadge, StatusBadge } from "./call-badges";
import { applicantLabel } from "@/lib/domain";
import type { FundingCall } from "@/lib/types";
import { formatDate, formatRange } from "@/lib/utils";

export function CallCard({ call }: { call: FundingCall }) {
  return (
    <Card className="group relative transition-all hover:border-brand hover:shadow-md hover:shadow-black/[0.06]">
      <Link
        href={`/pozivi/${call.id}`}
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={call.naslov}
      />
      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={call.status} />
          <LevelBadge level={call.level} />
          <DeadlinePill call={call} />
          <ArrowUpRight className="ml-auto h-4 w-4 text-muted-2 transition-colors group-hover:text-brand-ink" />
        </div>

        <h3 className="font-display text-[17px] font-semibold leading-snug tracking-tight">
          {call.naslov}
        </h3>
        <p className="mt-1 text-sm text-muted">{call.davatelj}</p>
        <p className="mt-0.5 text-xs font-medium text-brand-ink">{call.program}</p>

        <p className="mt-3 line-clamp-2 text-sm text-muted">{call.sazetak}</p>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <Meta icon={CalendarClock} label="Rok prijave">
            {call.status === "najava" ? "—" : formatDate(call.rokPrijave)}
          </Meta>
          <Meta icon={Coins} label="Iznos potpore">
            <span className="tabular">{formatRange(call.iznosMin, call.iznosMax)}</span>
          </Meta>
          <Meta icon={Building2} label="Intenzitet">
            {call.intenzitet}
          </Meta>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {call.prihvatljivi.map((a) => (
            <span
              key={a}
              className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted"
            >
              {applicantLabel[a]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
