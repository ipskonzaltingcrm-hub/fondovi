import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { OFFER_COLS, getServices, getTaskRefs, type Offer, type OfferItem } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { todayZg } from "@/lib/crm/dates";
import { hasEmailKey } from "@/lib/email";
import { OfferEditor, type OfferMail } from "./offer-editor";

export const metadata = { title: "Ponuda" };

export default async function PonudaPage({ params }: PageProps<"/crm/ponude/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("crm_offers").select(OFFER_COLS).eq("id", id).maybeSingle();
  if (!row) notFound();
  const o = row as unknown as Offer;
  const [{ data: items }, services, refs, { data: view }, { data: log }, { data: crm }, { data: lead }] = await Promise.all([
    supabase.from("crm_offer_items").select("id,service_id,naziv,opis,kolicina,jedinica,cijena,postotak,pdv,iznos,position").eq("offer_id", id).order("position"),
    getServices(),
    getTaskRefs(),
    supabase.from("crm_offers").select("viewed_at,view_count").eq("id", id).maybeSingle(),
    supabase.from("crm_email_log").select("id,at,to_email,subject,status,error,opened_at").eq("offer_id", id).order("at", { ascending: false }).limit(20),
    o.jls_profile_id ? supabase.from("crm_clients").select("email").eq("jls_profile_id", o.jls_profile_id).maybeSingle() : Promise.resolve({ data: null }),
    o.lead_id ? supabase.from("crm_leads").select("email").eq("id", o.lead_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  await supabase.rpc("crm_log", { p_action: "pregled", p_entity: "crm_offers", p_entity_id: id, p_label: o.broj });
  const mail: OfferMail = {
    enabled: hasEmailKey(),
    defaultTo: (crm as { email?: string | null } | null)?.email ?? (lead as { email?: string | null } | null)?.email ?? "",
    myEmail: me.email,
    myName: me.name,
    viewedAt: (view?.viewed_at as string | null) ?? null,
    viewCount: (view?.view_count as number | null) ?? 0,
    log: (log ?? []) as OfferMail["log"],
  };
  return (
    <OfferEditor
      key={`${o.id}-${o.status}-${o.iznos_neto}`}
      offer={{ ...o, client: one(o.client), lead: one(o.lead), project: one(o.project) }}
      items={(items ?? []) as OfferItem[]}
      services={services.filter((s) => s.aktivan)}
      refs={refs}
      me={{ id: me.id, role: me.role }}
      today={todayZg()}
      mail={mail}
    />
  );
}
