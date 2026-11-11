"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function useEscape(onClose: () => void) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

/** Bočni panel (detalj leada / zadatka). */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  useEscape(onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-surface shadow-2xl animate-fade-up",
          width,
        )}
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold leading-tight">{title}</div>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
          {actions}
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-2 hover:bg-surface-2 hover:text-foreground" aria-label="Zatvori">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

/** Dijalog (obrasci). */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  useEscape(onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className={cn("relative w-full rounded-lg border border-border bg-surface shadow-2xl", width)}>
        <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
          <h2 className="flex-1 font-display text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-2 hover:bg-surface-2 hover:text-foreground" aria-label="Zatvori">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/** Mali izbornik "⋯". */
export function Menu({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded-md p-1.5 text-muted-2 hover:bg-surface-2 hover:text-foreground"
      >
        {trigger}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="absolute right-0 z-20 mt-1 min-w-52 rounded-lg border border-border bg-surface p-1 shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export function MenuItem({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm",
        danger ? "text-danger hover:bg-danger-soft" : "hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}

/** Prikaz poruke nakon akcije (nestaje sama). */
export function useFlash() {
  const [flash, setFlash] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  React.useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);
  const show = React.useCallback((r: { ok: boolean; message?: string; error?: string }) => {
    if (!r.ok) setFlash({ tone: "danger", text: r.error ?? "Greška." });
    else if (r.message) setFlash({ tone: "success", text: r.message });
  }, []);
  const node = flash ? (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[60] max-w-sm rounded-md border px-4 py-2.5 text-sm shadow-lg",
        flash.tone === "danger" ? "border-danger/30 bg-danger-soft text-danger" : "border-success/30 bg-success-soft text-success",
      )}
    >
      {flash.text}
    </div>
  ) : null;
  return { show, node };
}
