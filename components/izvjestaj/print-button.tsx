"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0b1f4d] px-4 text-sm font-semibold text-white hover:bg-[#0a1430]"
    >
      <Printer className="h-4 w-4" /> Ispis / Spremi PDF
    </button>
  );
}
