import { notFound } from "next/navigation";
import { PrintButton } from "@/components/izvjestaj/print-button";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { OFFER_COLS, getSettings, type Offer, type OfferItem } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { JEDINICA } from "@/lib/crm/options";
import { fmtDay } from "@/lib/crm/dates";

export const metadata = { title: "Ponuda (PDF)" };

const eur = new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" });
const qty = new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 3 });

export default async function PonudaPdf({ params }: PageProps<"/crm/ponuda-pdf/[id]">) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("crm_offers").select(OFFER_COLS).eq("id", id).maybeSingle();
  if (!row) notFound();
  const o = row as unknown as Offer;
  const client = one(o.client);
  const lead = one(o.lead);
  const [{ data: items }, settings, { data: crm }, { data: leadRow }] = await Promise.all([
    supabase.from("crm_offer_items").select("naziv,opis,kolicina,jedinica,cijena,postotak,pdv,iznos").eq("offer_id", id).order("position"),
    getSettings(),
    o.jls_profile_id
      ? supabase.from("crm_clients").select("oib,adresa,email").eq("jls_profile_id", o.jls_profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
    o.lead_id ? supabase.from("crm_leads").select("oib,email,kontakt_ime").eq("id", o.lead_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  await supabase.rpc("crm_log", { p_action: "izvoz", p_entity: "crm_offers", p_entity_id: id, p_label: `${o.broj} (PDF)` });
  const c = settings.company;
  const list = (items ?? []) as OfferItem[];
  const kupac = client?.naziv ?? lead?.naziv ?? "—";
  const kupacOib = (crm as { oib?: string } | null)?.oib ?? (leadRow as { oib?: string } | null)?.oib;
  const kupacAdresa = (crm as { adresa?: string } | null)?.adresa;

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`@media print { .no-print { display:none !important } body { background:#fff } .page { box-shadow:none !important; margin:0 !important } .break { break-before: page } } @page { size: A4; margin: 16mm }`}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <span className="text-sm text-slate-600">
          Ponuda {o.broj} — spremi kao PDF i priloži u e-mail iz svoje pošte.
        </span>
        <PrintButton />
      </div>

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
            <div className="text-lg font-bold">{o.broj}</div>
            <div className="text-xs text-slate-500">
              Datum: {fmtDay(o.datum)}
              {o.vrijedi_do ? ` · vrijedi do ${fmtDay(o.vrijedi_do)}` : ""}
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Naručitelj</div>
            <div className="font-semibold">{kupac}</div>
            {kupacAdresa && <div>{kupacAdresa}</div>}
            {kupacOib && <div>OIB: {kupacOib}</div>}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Predmet</div>
            <div className="font-semibold">{o.predmet}</div>
            {o.visina_investicije != null && <div>Vrijednost projekta: {eur.format(Number(o.visina_investicije))}</div>}
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
            {list.map((i, idx) => (
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
              <dd>{eur.format(Number(o.iznos_neto))}</dd>
            </div>
            <div className="flex justify-between">
              <dt>PDV</dt>
              <dd>{eur.format(Number(o.iznos_pdv))}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-[#0b1f4d] pt-1 text-base font-bold">
              <dt>Ukupno</dt>
              <dd>{eur.format(Number(o.iznos_ukupno))}</dd>
            </div>
          </dl>
        </div>

        {o.rate?.length > 0 && (
          <section className="mt-6">
            <div className="text-xs uppercase tracking-widest text-slate-500">Dinamika plaćanja</div>
            <ul className="mt-1 list-disc pl-5">
              {o.rate.map((r, i) => (
                <li key={i}>
                  {r.opis}
                  {r.iznos != null ? ` — ${eur.format(Number(r.iznos))}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {o.napomene && (
          <section className="mt-6">
            <div className="text-xs uppercase tracking-widest text-slate-500">Napomene</div>
            <p className="whitespace-pre-wrap">{o.napomene}</p>
          </section>
        )}

        <footer className="mt-10 grid grid-cols-2 gap-10 text-xs text-slate-500">
          <div>
            Plaćanje na račun {c.iban || "—"}. Cijene su izražene u eurima.
          </div>
          <div className="text-right">
            Za {c.naziv || "IPS Konzalting d.o.o."}
            <div className="mt-10 border-t border-slate-300 pt-1">potpis</div>
          </div>
        </footer>

        {settings.offerTerms && (
          <section className="break mt-10">
            <h2 className="mb-2 text-base font-bold text-[#0b1f4d]">Opći uvjeti poslovanja</h2>
            <p className="whitespace-pre-wrap text-xs">{settings.offerTerms}</p>
          </section>
        )}
      </div>
    </div>
  );
}
