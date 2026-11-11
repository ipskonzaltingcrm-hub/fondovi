import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { CLIENT_COLS, LEAD_COLS, TASK_COLS, getTaskRefs, type Activity, type ClientRow, type Lead, type Task } from "@/lib/crm/data";
import { one, toJls } from "@/lib/crm/clients-util";
import { getCalls } from "@/lib/data";
import { matchesForJls } from "@/lib/domain";
import { todayZg } from "@/lib/crm/dates";
import { ClientDetail, type Contact, type MatchItem } from "./client-detail";

export const metadata = { title: "Klijent" };

export default async function KlijentPage({ params }: PageProps<"/crm/klijenti/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("jls_profiles").select(CLIENT_COLS).eq("id", id).maybeSingle();
  if (!row) notFound();
  const client = { ...(row as unknown as ClientRow), crm: one((row as unknown as ClientRow).crm) };

  const [{ data: contacts }, { data: acts }, { data: tasks }, { data: leads }, calls, refs] = await Promise.all([
    supabase.from("crm_contacts").select("id,ime,uloga,email,telefon,primarni").eq("jls_profile_id", id).order("primarni", { ascending: false }).order("ime"),
    supabase
      .from("crm_activities")
      .select("id,at,actor_name,vrsta,body,lead_id,jls_profile_id,task_id")
      .eq("jls_profile_id", id)
      .order("at", { ascending: false })
      .limit(200),
    supabase.from("crm_tasks").select(TASK_COLS).eq("jls_profile_id", id).is("archived_at", null).order("rok", { nullsFirst: false }),
    supabase.from("crm_leads").select(LEAD_COLS).eq("jls_profile_id", id).order("created_at", { ascending: false }),
    getCalls(),
    getTaskRefs(),
  ]);
  await supabase.rpc("crm_log", { p_action: "pregled", p_entity: "jls_profiles", p_entity_id: id, p_label: client.naziv });

  const matches: MatchItem[] = matchesForJls(calls, toJls(client))
    .filter((m) => m.call.status !== "zatvoren")
    .slice(0, 40)
    .map((m) => ({
      slug: m.call.id,
      naslov: m.call.naslov,
      davatelj: m.call.davatelj,
      status: m.call.status,
      rok: m.call.rokPrijave,
      score: m.score,
      reasons: m.reasons,
    }));

  return (
    <ClientDetail
      client={client}
      contacts={(contacts ?? []) as Contact[]}
      activities={(acts ?? []) as Activity[]}
      tasks={(tasks ?? []) as unknown as Task[]}
      leads={(leads ?? []) as Lead[]}
      matches={matches}
      refs={refs}
      me={{ id: me.id, role: me.role }}
      today={todayZg()}
    />
  );
}
