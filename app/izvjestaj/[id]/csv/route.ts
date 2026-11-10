import { getCalls, getJlsBySlug } from "@/lib/data";
import { levelLabel, matchesForJls, statusLabel } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cell(v: string | number | null): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const jls = await getJlsBySlug(id);
  if (!jls) return new Response("Nije pronađeno", { status: 404 });

  const calls = await getCalls();
  const matches = matchesForJls(calls, jls).filter(
    (m) => m.call.status !== "zatvoren",
  );

  const header = [
    "Naziv natječaja",
    "Davatelj",
    "Program",
    "Razina",
    "Status",
    "Rok prijave",
    "Iznos min (EUR)",
    "Iznos max (EUR)",
    "Podudarnost (%)",
    "Poveznica",
  ];
  const rows = matches.map((m) => {
    const c = m.call;
    return [
      c.naslov,
      c.davatelj,
      c.program,
      levelLabel[c.level],
      statusLabel[c.status],
      c.rokPrijave ?? "",
      c.iznosMin ?? "",
      c.iznosMax ?? "",
      m.score,
      c.url,
    ].map(cell).join(";");
  });

  // BOM + ; separator → Excel (HR) otvara ispravno UTF-8.
  const csv = "﻿" + [header.map(cell).join(";"), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="izvjestaj-${id}.csv"`,
    },
  });
}
