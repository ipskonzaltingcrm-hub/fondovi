import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { HOT_GROUP_COLS, LEAD_COLS, getCallOptions, getTeam, type HotGroup, type Lead } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { HotView } from "./hot-view";

export const metadata = { title: "Hot leadovi" };

export default async function HotLeadoviPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const [{ data: groups }, { data: leads }, calls, team] = await Promise.all([
    supabase.from("crm_hot_groups").select(HOT_GROUP_COLS).order("position"),
    supabase
      .from("crm_leads")
      .select(LEAD_COLS)
      .not("hot_at", "is", null)
      .is("archived_at", null)
      .order("hot_position")
      .order("hot_at", { ascending: false }),
    getCallOptions(),
    getTeam(),
  ]);
  await supabase.rpc("crm_mark_seen", { p_key: "hot" });

  return (
    <>
      <PageHeader
        title="Hot leadovi"
        description="Najperspektivniji leadovi složeni po natječaju — odmah se vidi tko je zainteresiran za koji poziv. Natječaj se može vezati na poziv iz EU Radara."
      />
      <HotView
        groups={((groups ?? []) as unknown as HotGroup[]).map((g) => ({ ...g, call: one(g.call) }))}
        leads={(leads ?? []) as Lead[]}
        calls={calls}
        team={team}
        canEditGroups={me.role !== "suradnik"}
      />
    </>
  );
}
