import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { getTeam } from "@/lib/crm/data";
import { addDays, todayZg, weekStart } from "@/lib/crm/dates";
import type { SalesEvent } from "@/lib/crm/sales";
import { OfficialView } from "./official-view";

export const metadata = { title: "Prodajni official" };

/** Tjedna tablica pokazatelja tima (redovi = pokazatelji, stupci = članovi). Ovdje se ništa ne upisuje. */
export default async function OfficialPage() {
  const me = await requireStaff();
  const today = todayZg();
  const from = [weekStart(`${today.slice(0, 4)}-01-01`), addDays(weekStart(today), -7 * 26)].sort()[0];
  const supabase = await createClient();
  const [{ data: ev }, team] = await Promise.all([supabase.rpc("crm_sales_events", { p_from: from, p_to: today }), getTeam()]);
  return (
    <>
      <PageHeader
        title="Prodajni official"
        description="Tjedna tablica za sastanak: redovi su pokazatelji, stupci članovi tima. Podaci su isti kao u Prodajnom monitoringu; klik na brojku pokazuje od čega se sastoji."
      />
      <OfficialView events={(ev ?? []) as SalesEvent[]} team={team.filter((t) => t.active)} today={today} meId={me.id} isAdmin={me.isAdmin} from={from} />
    </>
  );
}
