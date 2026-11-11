import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { PROJECT_COLS, TASK_COLS, getTaskRefs, type Activity, type ProjectRow, type Task } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { todayZg } from "@/lib/crm/dates";
import { ProjectDetail, type Item } from "./project-detail";

export const metadata = { title: "Projekt" };

export default async function ProjektPage({ params }: PageProps<"/crm/projekti/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("crm_projects").select(PROJECT_COLS).eq("id", id).maybeSingle();
  if (!row) notFound();
  const p = row as unknown as ProjectRow;
  const project = { ...p, client: one(p.client), lead: one(p.lead), call: one(p.call) };

  const [{ data: items }, { data: acts }, { data: tasks }, { data: canEdit }, refs] = await Promise.all([
    supabase.from("crm_project_items").select("id,naziv,grupa,done_at,done_by,position").eq("project_id", id).order("position"),
    supabase
      .from("crm_activities")
      .select("id,at,actor_name,vrsta,body,lead_id,jls_profile_id,task_id")
      .eq("project_id", id)
      .order("at", { ascending: false })
      .limit(200),
    supabase.from("crm_tasks").select(TASK_COLS).eq("project_id", id).is("archived_at", null).order("rok", { nullsFirst: false }),
    supabase.rpc("crm_can_edit_project", { p_id: id }),
    getTaskRefs(),
  ]);
  await supabase.rpc("crm_log", { p_action: "pregled", p_entity: "crm_projects", p_entity_id: id, p_label: project.naziv });

  return (
    <ProjectDetail
      project={project}
      items={(items ?? []) as Item[]}
      activities={(acts ?? []) as Activity[]}
      tasks={(tasks ?? []) as unknown as Task[]}
      refs={refs}
      me={{ id: me.id, role: me.role, isSuperadmin: me.isSuperadmin }}
      canEdit={!!canEdit}
      today={todayZg()}
    />
  );
}
