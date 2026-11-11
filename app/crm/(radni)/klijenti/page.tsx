import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { CLIENT_COLS, getTeam, type ClientRow } from "@/lib/crm/data";
import { one, toJls } from "@/lib/crm/clients-util";
import { getCalls } from "@/lib/data";
import { matchesForJls } from "@/lib/domain";
import { ClientsView, type ClientListItem } from "./clients-view";

export const metadata = { title: "Klijenti" };

export default async function KlijentiPage({ searchParams }: PageProps<"/crm/klijenti">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: rows }, { data: leads }, { data: tasks }, calls, team] = await Promise.all([
    supabase.from("jls_profiles").select(CLIENT_COLS).order("naziv"),
    supabase.from("crm_leads").select("jls_profile_id,status").not("jls_profile_id", "is", null),
    supabase.from("crm_tasks").select("jls_profile_id").is("done_at", null).is("archived_at", null).not("jls_profile_id", "is", null),
    getCalls(),
    getTeam(),
  ]);

  const openTasks = new Map<string, number>();
  for (const t of tasks ?? []) openTasks.set(t.jls_profile_id, (openTasks.get(t.jls_profile_id) ?? 0) + 1);
  const leadCount = new Map<string, number>();
  for (const l of leads ?? []) leadCount.set(l.jls_profile_id, (leadCount.get(l.jls_profile_id) ?? 0) + 1);

  const items: ClientListItem[] = ((rows ?? []) as unknown as ClientRow[]).map((r) => {
    const c = { ...r, crm: one(r.crm) };
    const open = matchesForJls(calls, toJls(c)).filter((m) => m.call.status === "otvoren");
    return {
      client: c,
      openCalls: open.length,
      topScore: open[0]?.score ?? null,
      openTasks: openTasks.get(r.id) ?? 0,
      leads: leadCount.get(r.id) ?? 0,
    };
  });

  return (
    <>
      <PageHeader
        title="Klijenti"
        description="Pretplatnici EU Radara i klijenti savjetovanja — isti zapis kao klijent u aplikaciji. Kartica klijenta pokazuje kontakte, povijest, zadatke i natječaje za koje je prihvatljiv."
      />
      <ClientsView
        items={items}
        team={team}
        me={{ id: me.id, role: me.role }}
        startNew={sp.novi === "1"}
      />
    </>
  );
}
