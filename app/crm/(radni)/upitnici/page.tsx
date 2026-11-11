import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requestOrigin, requireStaff } from "@/lib/crm/session";
import { getTeam } from "@/lib/crm/data";
import { addDays, todayZg } from "@/lib/crm/dates";
import { FormsView, type FormRow, type Submission } from "./forms-view";

export const metadata = { title: "Upitnici" };

export default async function UpitniciPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const since = addDays(todayZg(), -30);
  const [{ data: forms }, { data: leads }, { data: subs }, team] = await Promise.all([
    supabase.from("crm_forms").select("id,naziv,uvod,token,owner,create_task,active,created_at").order("created_at"),
    supabase.from("crm_leads").select("form_id,created_at").not("form_id", "is", null),
    me.isAdmin
      ? supabase.from("crm_form_submissions").select("id,form_id,at,outcome,lead_id,error,payload").order("at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    getTeam(),
  ]);
  const rows: FormRow[] = (forms ?? []).map((f) => {
    const l = (leads ?? []).filter((x) => x.form_id === f.id);
    const s = ((subs ?? []) as Submission[]).filter((x) => x.form_id === f.id);
    return {
      ...(f as Omit<FormRow, "leads" | "leads30" | "errors" | "lastAt">),
      leads: l.length,
      leads30: l.filter((x) => x.created_at >= since).length,
      errors: s.filter((x) => x.outcome === "greska").length,
      lastAt: s[0]?.at ?? null,
    };
  });
  return (
    <>
      <PageHeader
        title="Upitnici"
        description="Javne forme EU Radara („provjeri na što se možeš prijaviti“). Svaka predaja postaje lead s vlasnikom i zadatkom „Nazovi u 24 h“, a podnositelj odmah vidi koliko otvorenih natječaja ima."
      />
      <FormsView
        forms={rows}
        submissions={(subs ?? []) as Submission[]}
        team={team.filter((t) => t.active)}
        isAdmin={me.isAdmin}
        origin={await requestOrigin()}
      />
    </>
  );
}
