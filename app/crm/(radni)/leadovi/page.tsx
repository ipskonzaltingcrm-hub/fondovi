import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { HOT_GROUP_COLS, LEAD_COLS, getClientOptions, getTaskRefs, type HotGroup, type Lead } from "@/lib/crm/data";
import { todayZg } from "@/lib/crm/dates";
import { LeadsView } from "./leads-view";

export const metadata = { title: "Leadovi" };

export default async function LeadoviPage({ searchParams }: PageProps<"/crm/leadovi">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: leads }, { data: groups }, clients, refs] = await Promise.all([
    supabase.from("crm_leads").select(LEAD_COLS).order("last_activity_at", { ascending: false }).limit(5000),
    supabase.from("crm_hot_groups").select(HOT_GROUP_COLS).order("position"),
    getClientOptions(),
    getTaskRefs(),
  ]);
  // Brojka u izborniku ("novo od zadnjeg posjeta") se poništava.
  await supabase.rpc("crm_mark_seen", { p_key: "leadovi" });

  return (
    <>
      <PageHeader
        title="Leadovi"
        description="Potencijalni pretplatnici i klijenti: JLS, poduzeća i institucije. Registracije na EU Radar stižu ovdje same. Trijaža određuje koga zvati prvog."
      />
      <LeadsView
        leads={(leads ?? []) as Lead[]}
        groups={(groups ?? []) as unknown as HotGroup[]}
        clients={clients}
        refs={refs}
        me={{ id: me.id, role: me.role }}
        today={todayZg()}
        openId={typeof sp.lead === "string" ? sp.lead : null}
        startNew={sp.novi === "1"}
      />
    </>
  );
}
