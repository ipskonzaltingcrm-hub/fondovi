import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { getClientOptions, getServices, getTeam } from "@/lib/crm/data";
import { addDays, todayZg, weekStart } from "@/lib/crm/dates";
import type { SalesEvent } from "@/lib/crm/sales";
import { SalesView } from "./sales-view";

export const metadata = { title: "Prodajni monitoring" };

export default async function ProdajaPage() {
  const me = await requireStaff();
  const today = todayZg();
  const from = [weekStart(`${today.slice(0, 4)}-01-01`), addDays(weekStart(today), -7 * 8)].sort()[0];
  const supabase = await createClient();
  const [{ data: ev }, team, services, clients, { data: targets }] = await Promise.all([
    supabase.rpc("crm_sales_events", { p_from: from, p_to: today }),
    getTeam(),
    getServices(),
    getClientOptions(),
    supabase.from("crm_sales_targets").select("mjesec,member,iznos"),
  ]);
  // Administrator vidi cijeli tim, ostali samo sebe (Prodajni official prikazuje cijeli tim svima).
  const events = ((ev ?? []) as SalesEvent[]).filter((e) => me.isAdmin || e.member === me.id);

  return (
    <>
      <PageHeader
        title="Prodajni monitoring"
        description="Tko je što prodao i odradio, po tjednu i mjesecu. Prihvaćene ponude same ulaze u prodaju; prodaju izvan ponude upiši brzim unosom."
      />
      <SalesView
        events={events}
        team={team.filter((t) => t.active)}
        services={services}
        clients={clients}
        targets={(targets ?? []) as { mjesec: string; member: string | null; iznos: number }[]}
        me={{ id: me.id, role: me.role, isAdmin: me.isAdmin }}
        today={today}
      />
    </>
  );
}
