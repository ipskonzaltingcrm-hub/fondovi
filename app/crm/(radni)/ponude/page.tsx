import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { OFFER_COLS, getServices, getSettings, getTaskRefs, type Offer } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { todayZg } from "@/lib/crm/dates";
import { OffersView } from "./offers-view";

export const metadata = { title: "Ponude" };

export default async function PonudePage({ searchParams }: PageProps<"/crm/ponude">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, services, settings, refs] = await Promise.all([
    supabase.from("crm_offers").select(OFFER_COLS).is("archived_at", null).order("created_at", { ascending: false }).limit(2000),
    getServices(),
    getSettings(),
    getTaskRefs(),
  ]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return (
    <>
      <PageHeader
        title="Ponude"
        description="Ponude iz cjenika (pretplate na EU Radar i usluge pripreme i vođenja projekata) s PDF-om za klijenta. Prihvaćena ponuda sama ulazi u prodaju."
      />
      <OffersView
        offers={((data ?? []) as unknown as Offer[]).map((o) => ({ ...o, client: one(o.client), lead: one(o.lead), project: one(o.project) }))}
        services={services}
        terms={settings.offerTerms}
        company={settings.company}
        refs={refs}
        me={{ id: me.id, role: me.role, isAdmin: me.isAdmin }}
        today={todayZg()}
        preset={sp.nova === "1" ? { jls_profile_id: str(sp.klijent), lead_id: str(sp.lead), project_id: str(sp.projekt) } : null}
      />
    </>
  );
}
