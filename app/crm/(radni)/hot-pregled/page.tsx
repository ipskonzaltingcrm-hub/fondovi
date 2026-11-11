import { PageHeader } from "@/components/layout/page-header";
import { Empty } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { HOT_GROUP_COLS, LEAD_COLS, type HotGroup, type Lead } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { todayZg } from "@/lib/crm/dates";
import { HotOverview } from "./hot-overview";

export const metadata = { title: "Hot pregled" };

export default async function HotPregledPage() {
  const me = await requireStaff();
  if (!me.isSuperadmin) {
    return (
      <>
        <PageHeader title="Hot pregled" />
        <Empty title="Ovu stranicu vidi samo superadmin" />
      </>
    );
  }
  const supabase = await createClient();
  const [{ data: groups }, { data: leads }] = await Promise.all([
    supabase.from("crm_hot_groups").select(HOT_GROUP_COLS).order("position"),
    supabase.from("crm_leads").select(LEAD_COLS).not("hot_at", "is", null).is("archived_at", null),
  ]);
  return (
    <>
      <PageHeader
        title="Hot pregled"
        description="Tablica hot leadova po natječaju sa semaforom. Klik na ime: boja i bilješka. Klik na rok u zaglavlju: rok prijave i oznaka."
      />
      <HotOverview
        groups={((groups ?? []) as unknown as HotGroup[]).map((g) => ({ ...g, call: one(g.call) }))}
        leads={(leads ?? []) as Lead[]}
        today={todayZg()}
      />
    </>
  );
}
