import { notFound } from "next/navigation";
import { PrintButton } from "@/components/izvjestaj/print-button";
import { OfferDocument, PRINT_CSS, type OfferDocItem } from "@/components/crm/offer-document";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { OFFER_COLS, getSettings, type Offer } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";

export const metadata = { title: "Ponuda (PDF)" };

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

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{PRINT_CSS}</style>
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <span className="text-sm text-slate-600">Ponuda {o.broj} — spremi kao PDF ili je pošalji e-mailom iz CRM-a.</span>
        <PrintButton />
      </div>
      <OfferDocument
        d={{
          broj: o.broj,
          predmet: o.predmet,
          datum: o.datum,
          vrijedi_do: o.vrijedi_do,
          visina_investicije: o.visina_investicije,
          rate: o.rate ?? [],
          napomene: o.napomene,
          iznos_neto: Number(o.iznos_neto),
          iznos_pdv: Number(o.iznos_pdv),
          iznos_ukupno: Number(o.iznos_ukupno),
          kupac: client?.naziv ?? lead?.naziv ?? "—",
          kupacOib: (crm as { oib?: string } | null)?.oib ?? (leadRow as { oib?: string } | null)?.oib ?? null,
          kupacAdresa: (crm as { adresa?: string } | null)?.adresa ?? null,
          items: (items ?? []) as OfferDocItem[],
          company: settings.company,
          terms: settings.offerTerms,
        }}
      />
    </div>
  );
}
