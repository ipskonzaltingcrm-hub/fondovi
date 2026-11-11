import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { PROJECT_COLS, getTaskRefs, type ProjectRow } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { todayZg } from "@/lib/crm/dates";
import { ProjectsView } from "./projects-view";

export const metadata = { title: "Projekti i prijave" };

export default async function ProjektiPage({ searchParams }: PageProps<"/crm/projekti">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, refs] = await Promise.all([
    supabase.from("crm_projects").select(PROJECT_COLS).is("archived_at", null).order("created_at", { ascending: false }),
    getTaskRefs(),
  ]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);

  return (
    <>
      <PageHeader
        title="Projekti i prijave"
        description="Prijave klijenata na natječaje od pripreme do isplate: faze, rokovi, checklista dokumentacije i odgovorne osobe."
      />
      <ProjectsView
        projects={((data ?? []) as unknown as ProjectRow[]).map((p) => ({ ...p, client: one(p.client), lead: one(p.lead), call: one(p.call) }))}
        refs={refs}
        me={{ id: me.id, role: me.role }}
        today={todayZg()}
        preset={
          sp.novi === "1"
            ? { jls_profile_id: str(sp.klijent), lead_id: str(sp.lead), call_id: str(sp.natjecaj) }
            : null
        }
      />
    </>
  );
}
