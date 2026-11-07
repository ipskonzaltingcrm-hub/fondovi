import * as React from "react";
import { cn } from "@/lib/utils";

type Tone =
  | "neutral"
  | "brand"
  | "info"
  | "warning"
  | "danger"
  | "success"
  | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border border-border",
  brand: "bg-brand-soft text-brand-ink border border-transparent",
  info: "bg-info-soft text-info border border-transparent",
  warning: "bg-warning-soft text-warning border border-transparent",
  danger: "bg-danger-soft text-danger border border-transparent",
  success: "bg-success-soft text-success border border-transparent",
  outline: "bg-transparent text-muted border border-border-strong",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
