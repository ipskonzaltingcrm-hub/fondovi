import { notFound } from "next/navigation";
import { PrintButton } from "@/components/izvjestaj/print-button";
import { OfferDocument, PRINT_CSS, type OfferDocItem } from "@/components/crm/offer-document";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CompanyInfo, OfferRate } from "@/lib/crm/data";
import { ViewPing } from "./view-ping";

export const metadata = { title: "Ponuda", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Javni pregled ponude (poveznica iz e-maila). Bez prijave; vidljive su samo poslane ponude. */
export default async function JavnaPonuda({ params }: PageProps<"/ponuda/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const admin = createAdminClient();
  const { data: o } = await admin
    .from("crm_offers")
    .select(
      "id,broj,predmet,status,datum,vrijedi_do,visina_investicije,rate,napomene,iznos_neto,iznos_pdv,iznos_ukupno,jls_profile_id,lead_id,archived_at,client:jls_profiles(naziv),lead:crm_leads(naziv,oib)",
    )
    .eq("public_token", token)
    .maybeSingle();
  if (!o || o.archived_at || o.status === "nacrt") notFound();

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const [{ data: items }, { data: settings }, { data: crm }] = await Promise.all([
    admin.from("crm_offer_items").select("naziv,opis,kolicina,jedinica,cijena,postotak,pdv,iznos").eq("offer_id", o.id).order("position"),
    admin.from("crm_settings").select("key,value").in("key", ["company", "offer_terms"]),
    o.jls_profile_id ? admin.from("crm_clients").select("oib,adresa").eq("jls_profile_id", o.jls_profile_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const map = Object.fromEntries((settings ?? []).map((r) => [r.key as string, r.value]));
  const client = one(o.client as { naziv: string } | { naziv: string }[] | null);
  const lead = one(o.lead as { naziv: string; oib: string | null } | { naziv: string; oib: string | null }[] | null);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{PRINT_CSS}</style>
      <ViewPing token={token} />
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur">
        <span className="text-sm text-slate-600">
          Ponuda {o.broj}
          {o.status === "istekla" ? " — valjanost je istekla" : ""}. Spremite je kao PDF gumbom desno.
        </span>
        <PrintButton />
      </div>
      <OfferDocument
        d={{
          broj: o.broj as string,
          predmet: o.predmet as string,
          datum: o.datum as string,
          vrijedi_do: o.vrijedi_do as string | null,
          visina_investicije: o.visina_investicije as number | null,
          rate: (o.rate ?? []) as OfferRate[],
          napomene: o.napomene as string | null,
          iznos_neto: Number(o.iznos_neto),
          iznos_pdv: Number(o.iznos_pdv),
          iznos_ukupno: Number(o.iznos_ukupno),
          kupac: client?.naziv ?? lead?.naziv ?? "—",
          kupacOib: (crm as { oib?: string } | null)?.oib ?? lead?.oib ?? null,
          kupacAdresa: (crm as { adresa?: string } | null)?.adresa ?? null,
          items: (items ?? []) as OfferDocItem[],
          company: (map.company ?? {}) as CompanyInfo,
          terms: ((map.offer_terms as { text?: string } | undefined)?.text ?? "") as string,
        }}
      />
    </div>
  );
}
