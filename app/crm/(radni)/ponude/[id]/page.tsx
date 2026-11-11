import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { OFFER_COLS, getServices, getTaskRefs, type Offer, type OfferItem } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { todayZg } from "@/lib/crm/dates";
import { OfferEditor } from "./offer-editor";

export const metadata = { title: "Ponuda" };

export default async function PonudaPage({ params }: PageProps<"/crm/ponude/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("crm_offers").select(OFFER_COLS).eq("id", id).maybeSingle();
  if (!row) notFound();
  const o = row as unknown as Offer;
  const [{ data: items }, services, refs] = await Promise.all([
    supabase.from("crm_offer_items").select("id,service_id,naziv,opis,kolicina,jedinica,cijena,postotak,pdv,iznos,position").eq("offer_id", id).order("position"),
    getServices(),
    getTaskRefs(),
  ]);
  await supabase.rpc("crm_log", { p_action: "pregled", p_entity: "crm_offers", p_entity_id: id, p_label: o.broj });
  return (
    <OfferEditor
      key={`${o.id}-${o.status}-${o.iznos_neto}`}
      offer={{ ...o, client: one(o.client), lead: one(o.lead), project: one(o.project) }}
      items={(items ?? []) as OfferItem[]}
      services={services.filter((s) => s.aktivan)}
      refs={refs}
      me={{ id: me.id, role: me.role }}
      today={todayZg()}
    />
  );
}
