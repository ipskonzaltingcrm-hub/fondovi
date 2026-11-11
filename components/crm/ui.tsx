import * as React from "react";
import { cn } from "@/lib/utils";

/** Zajednički elementi sučelja CRM-a (obrasci, tablice, prazna stanja). */

export const inputClass =
  "h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-ring/30 disabled:opacity-60";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-2">{hint}</span>}
    </label>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-2",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border px-3 py-2.5 align-top", className)} {...props} />;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "danger" | "success" | "warning";
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-info/30 bg-info-soft text-foreground",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
    warning: "border-warning/30 bg-warning-soft text-foreground",
  };
  return <div className={cn("rounded-md border px-3 py-2 text-sm", tones[tone])}>{children}</div>;
}
