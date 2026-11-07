import { Badge } from "@/components/ui/badge";
import { deadlineState, levelLabel, statusLabel } from "@/lib/domain";
import type { CallLevel, CallStatus, FundingCall } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: CallStatus }) {
  const tone =
    status === "otvoren" ? "success" : status === "najava" ? "info" : "neutral";
  return (
    <Badge tone={tone}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "otvoren" && "bg-success",
          status === "najava" && "bg-info",
          status === "zatvoren" && "bg-muted-2",
        )}
      />
      {statusLabel[status]}
    </Badge>
  );
}

export function LevelBadge({ level }: { level: CallLevel }) {
  return <Badge tone="outline">{levelLabel[level]}</Badge>;
}

export function DeadlinePill({ call }: { call: FundingCall }) {
  const ds = deadlineState(call);
  const tone =
    ds.kind === "istekao"
      ? "neutral"
      : ds.kind === "hitno"
        ? "danger"
        : ds.kind === "uskoro"
          ? "warning"
          : ds.kind === "najava"
            ? "info"
            : "success";
  return <Badge tone={tone}>{ds.label}</Badge>;
}
