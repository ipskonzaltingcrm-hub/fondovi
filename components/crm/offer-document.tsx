import type { CompanyInfo, OfferRate } from "@/lib/crm/data";
import { JEDINICA } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";

const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });
const qty = new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 3 });

export type OfferDocItem = { naziv: string; opis: string | null; kolicina: number; jedinica: string; cijena: number; postotak: number | null; pdv: number; iznos: number };
export type OfferDocData = {
  broj: string;
  predmet: string;
  datum: string;
  vrijedi_do: string | null;
  visina_investicije: number | null;
  rate: OfferRate[];
  napomene: string | null;
  iznos_neto: number;
  iznos_pdv: number;
  iznos_ukupno: number;
  kupac: string;
  kupacOib?: string | null;
  kupacAdresa?: string | null;
  items: OfferDocItem[];
  company: CompanyInfo;
  terms: string;
};

/** Ispis ponude (A4) — isti prikaz za interni PDF i za javnu poveznicu iz e-maila. */
export function OfferDocument({ d }: { d: OfferDocData }) {
  const c = d.company;
  return (
    <div className="page mx-auto my-6 max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-slate-800 shadow-lg">
      <header className="flex items-start justify-between border-b-2 border-[#0b1f4d] pb-4">
        <div>
          <div className="text-xl font-bold text-[#0b1f4d]">{c.naziv || "IPS Konzalting d.o.o."}</div>
          <div className="text-xs text-slate-500">
            {[c.adresa, c.oib && `OIB: ${c.oib}`].filter(Boolean).join(" · ")}
            <br />
            {[c.email, c.telefon, c.web].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-slate-500">Ponuda</div>
          <div className="text-lg font-bold">{d.broj}</div>
          <div className="text-xs text-slate-500">
            Datum: {fmtDay(d.datum)}
            {d.vrijedi_do ? ` · vrijedi do ${fmtDay(d.vrijedi_do)}` : ""}
          </div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">Naručitelj</div>
          <div className="font-semibold">{d.kupac}</div>
          {d.kupacAdresa && <div>{d.kupacAdresa}</div>}
          {d.kupacOib && <div>OIB: {d.kupacOib}</div>}
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-500">Predmet</div>
          <div className="font-semibold">{d.predmet}</div>
          {d.visina_investicije != null && <div>Vrijednost projekta: {eur.format(Number(d.visina_investicije))}</div>}
        </div>
      </section>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="bg-[#0b1f4d] text-left text-xs uppercase tracking-wider text-white">
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Usluga</th>
            <th className="px-2 py-2 text-right">Količina</th>
            <th className="px-2 py-2 text-right">Cijena</th>
            <th className="px-2 py-2 text-right">PDV</th>
            <th className="px-2 py-2 text-right">Iznos</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((i, idx) => (
            <tr key={idx} className="border-b border-slate-200 align-top">
              <td className="px-2 py-2 text-slate-500">{idx + 1}.</td>
              <td className="px-2 py-2">
                <div className="font-medium">{i.naziv}</div>
                {i.opis && <div className="whitespace-pre-wrap text-xs text-slate-500">{i.opis}</div>}
                {i.postotak != null && <div className="text-xs text-slate-500">{i.postotak} % vrijednosti projekta</div>}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">
                {qty.format(Number(i.kolicina))} {JEDINICA[i.jedinica] ?? i.jedinica}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right">{eur.format(Number(i.cijena))}</td>
              <td className="whitespace-nowrap px-2 py-2 text-right">{Number(i.pdv)} %</td>
              <td className="whitespace-nowrap px-2 py-2 text-right font-medium">{eur.format(Number(i.iznos))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <dl className="w-72 space-y-1">
          <div className="flex justify-between">
            <dt>Osnovica</dt>
            <dd>{eur.format(Number(d.iznos_neto))}</dd>
          </div>
          <div className="flex justify-between">
            <dt>PDV</dt>
            <dd>{eur.format(Number(d.iznos_pdv))}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-[#0b1f4d] pt-1 text-base font-bold">
            <dt>Ukupno</dt>
            <dd>{eur.format(Number(d.iznos_ukupno))}</dd>
          </div>
        </dl>
      </div>

      {d.rate?.length > 0 && (
        <section className="mt-6">
          <div className="text-xs uppercase tracking-widest text-slate-500">Dinamika plaćanja</div>
          <ul className="mt-1 list-disc pl-5">
            {d.rate.map((r, i) => (
              <li key={i}>
                {r.opis}
                {r.iznos != null ? ` — ${eur.format(Number(r.iznos))}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.napomene && (
        <section className="mt-6">
          <div className="text-xs uppercase tracking-widest text-slate-500">Napomene</div>
          <p className="whitespace-pre-wrap">{d.napomene}</p>
        </section>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-10 text-xs text-slate-500">
        <div>Plaćanje na račun {c.iban || "—"}. Cijene su izražene u eurima.</div>
        <div className="text-right">
          Za {c.naziv || "IPS Konzalting d.o.o."}
          <div className="mt-10 border-t border-slate-300 pt-1">potpis</div>
        </div>
      </footer>

      {d.terms && (
        <section className="break mt-10">
          <h2 className="mb-2 text-base font-bold text-[#0b1f4d]">Opći uvjeti poslovanja</h2>
          <p className="whitespace-pre-wrap text-xs">{d.terms}</p>
        </section>
      )}
    </div>
  );
}

export const PRINT_CSS = `@media print { .no-print { display:none !important } body { background:#fff } .page { box-shadow:none !important; margin:0 !important } .break { break-before: page } } @page { size: A4; margin: 16mm }`;
