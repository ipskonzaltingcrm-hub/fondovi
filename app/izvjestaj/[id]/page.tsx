import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCalls, getJlsBySlug } from "@/lib/data";
import { klijentTipLabel, levelLabel, matchesForJls, statusLabel } from "@/lib/domain";
import { formatDate, formatRange } from "@/lib/utils";
import { PrintButton } from "@/components/izvjestaj/print-button";

export const metadata = { title: "Izvještaj" };
export const dynamic = "force-dynamic";

export default async function IzvjestajPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Zaštita: samo prijavljeni (stranica je izvan (app) layouta).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const jls = await getJlsBySlug(id);
  if (!jls) notFound();

  const calls = await getCalls();
  const matches = matchesForJls(calls, jls).filter(
    (m) => m.call.status !== "zatvoren",
  );
  const danas = new Date().toLocaleDateString("hr-HR");

  return (
    <div className="min-h-screen bg-white text-[#0d1a33]">
      <style>{`@media print { .no-print { display:none !important } body { background:#fff } }`}</style>

      {/* Alatna traka (ne ispisuje se) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <Link
          href={`/klijenti/${jls.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Natrag na profil
        </Link>
        <div className="flex items-center gap-2">
          <a
            href={`/izvjestaj/${jls.id}/csv`}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> CSV (Excel)
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Dokument */}
      <div className="mx-auto max-w-4xl px-8 py-10 print:px-0 print:py-0">
        {/* Zaglavlje */}
        <div className="flex items-start justify-between border-b-2 border-[#efb429] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0b1f4d]">
              <Radar className="h-6 w-6 text-[#efb429]" />
            </div>
            <div>
              <div className="font-bold tracking-tight">
                <span className="text-[#efb429]">EU</span>{" "}
                <span className="text-[#0b1f4d]">Radar</span>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                IPS Konzalting
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            Izvještaj izrađen
            <br />
            {danas}
          </div>
        </div>

        {/* Klijent */}
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Prilike za financiranje — {klijentTipLabel[jls.tipKlijenta]}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#0b1f4d]">
            {jls.naziv}
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500">
            {jls.zupanija && <span>{jls.zupanija}</span>}
            {jls.tipKlijenta === "jls" && jls.stanovnika > 0 && (
              <span>{jls.stanovnika.toLocaleString("hr-HR")} stanovnika</span>
            )}
            {jls.velicina && <span className="capitalize">{jls.velicina} poduzeće</span>}
            {jls.kontaktOsoba && <span>Kontakt: {jls.kontaktOsoba}</span>}
          </div>
          {jls.sektoriInteresa.length > 0 && (
            <div className="mt-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">Sektori interesa:</span>{" "}
              {jls.sektoriInteresa.join(", ")}
            </div>
          )}
        </div>

        <p className="mt-5 text-sm text-slate-600">
          Ukupno <strong>{matches.length}</strong> otvorenih i najavljenih prilika na
          koje se {jls.naziv} može prijaviti, rangirano po podudarnosti s profilom.
        </p>

        {/* Tablica */}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-slate-200 text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Natječaj</th>
              <th className="py-2 pr-2 font-semibold">Razina</th>
              <th className="py-2 pr-2 font-semibold">Rok</th>
              <th className="py-2 pr-2 font-semibold">Potpora</th>
              <th className="py-2 text-right font-semibold">Podud.</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => {
              const c = m.call;
              return (
                <tr
                  key={c.id}
                  className="border-b border-slate-100 align-top break-inside-avoid"
                >
                  <td className="py-2.5 pr-2 tabular text-slate-400">{i + 1}</td>
                  <td className="py-2.5 pr-2">
                    <div className="font-medium text-[#0b1f4d]">{c.naslov}</div>
                    <div className="text-xs text-slate-500">
                      {c.davatelj}
                      {c.status === "najava" && " · najava"}
                    </div>
                    <a
                      href={c.url}
                      className="text-xs text-[#1b3a8f] underline print:text-slate-500"
                    >
                      {c.url.replace(/^https?:\/\//, "").slice(0, 60)}
                    </a>
                  </td>
                  <td className="py-2.5 pr-2 text-xs text-slate-600">
                    {levelLabel[c.level]}
                  </td>
                  <td className="py-2.5 pr-2 text-xs tabular text-slate-600">
                    {c.rokPrijave ? formatDate(c.rokPrijave) : "—"}
                  </td>
                  <td className="py-2.5 pr-2 text-xs tabular text-slate-600">
                    {formatRange(c.iznosMin, c.iznosMax)}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="font-semibold text-[#0b1f4d] tabular">
                      {m.score}%
                    </span>
                  </td>
                </tr>
              );
            })}
            {matches.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Trenutno nema otvorenih prilika za ovaj profil.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-400">
          EU Radar · IPS Konzalting · Podaci se automatski ažuriraju dnevno iz
          službenih izvora. Prihvatljivost prijavitelja obvezno provjeriti u tekstu
          samog poziva.
        </div>
      </div>
    </div>
  );
}
