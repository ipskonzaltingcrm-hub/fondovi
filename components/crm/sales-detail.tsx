"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Modal } from "./overlay";
import { deleteSale } from "@/lib/crm/actions/sales";
import type { Detail } from "@/lib/crm/sales";
import { eurFmt } from "@/lib/crm/sales";

/** Od čega se sastoji brojka u ćeliji (stavke s poveznicama). */
export function DetailDialog({
  title,
  details,
  meId,
  isAdmin,
  onClose,
  notify,
}: {
  title: string;
  details: Detail[];
  meId: string;
  isAdmin: boolean;
  onClose: () => void;
  notify: (r: { ok: boolean; message?: string; error?: string }) => void;
}) {
  const [pending, start] = React.useTransition();
  return (
    <Modal open onClose={onClose} title={title} width="max-w-2xl">
      {details.length === 0 ? (
        <p className="text-sm text-muted">Nema stavki.</p>
      ) : (
        <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
          {details.map((d, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              {d.href ? (
                <Link href={d.href} className="min-w-0 flex-1 truncate hover:text-brand-ink hover:underline">
                  {d.label}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate">{d.label}</span>
              )}
              {d.iznos != null && <span className="tabular text-muted">{eurFmt.format(d.iznos)}</span>}
              {d.sale && d.id && (isAdmin || d.createdBy === meId) && (
                <button
                  title="Obriši stavku prodaje"
                  disabled={pending}
                  className="rounded p-1 text-muted-2 hover:text-danger"
                  onClick={() => {
                    if (confirm("Obrisati ovu stavku prodaje?"))
                      start(async () => {
                        const r = await deleteSale(d.id!);
                        notify(r);
                        if (r.ok) onClose();
                      });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
