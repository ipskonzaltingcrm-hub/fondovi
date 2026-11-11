import { PageHeader } from "@/components/layout/page-header";
import { Empty } from "@/components/crm/ui";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { getSettings } from "@/lib/crm/data";
import { todayZg } from "@/lib/crm/dates";
import { JlsView, type Draft, type Signal, type TargetRow, type TargetNote, type JlsCall } from "./jls-view";

export const metadata = { title: "JLS prodaja" };

export default async function JlsProdajaPage() {
  const me = await requireStaff();
  if (!me.isAdmin) {
    return (
      <>
        <PageHeader title="JLS prodaja" />
        <Empty title="Ovu karticu vide samo administratori" />
      </>
    );
  }
  const supabase = await createClient();
  const today = todayZg();
  const [{ data: targets }, { data: drafts }, { data: signals }, { data: notes }, { data: calls }, settings] = await Promise.all([
    supabase.from("crm_jls_targets").select("*").order("naziv"),
    supabase.from("crm_jls_drafts").select("*").order("created_at", { ascending: false }),
    supabase.from("crm_jls_signals").select("*").order("datum", { ascending: false }).limit(300),
    supabase
      .from("crm_activities")
      .select("id,at,actor_name,vrsta,body,jls_target_id")
      .not("jls_target_id", "is", null)
      .order("at", { ascending: false })
      .limit(1000),
    supabase
      .from("calls")
      .select("id,slug,naslov,davatelj,rok_prijave,status,prihvatljivi")
      .neq("status", "zatvoren")
      .overlaps("prihvatljivi", ["opcina", "grad", "zupanija", "lag"])
      .order("rok_prijave", { ascending: true, nullsFirst: false })
      .limit(200),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="JLS prodaja"
        description="Prodaja EU Radara i usluga općinama, gradovima i županijama: ciljna skupina, nacrti e-mailova, signali i natječaji za JLS. CRM ne šalje e-mailove — šalješ ih iz svoje pošte."
      />
      <JlsView
        targets={(targets ?? []) as TargetRow[]}
        drafts={(drafts ?? []) as Draft[]}
        signals={(signals ?? []) as Signal[]}
        notes={(notes ?? []) as TargetNote[]}
        calls={((calls ?? []) as JlsCall[]).filter((c) => !c.rok_prijave || c.rok_prijave >= today)}
        budget={settings.budgetDeadline}
        signature={`${me.name}\nIPS Konzalting${settings.company.telefon ? `\n${settings.company.telefon}` : ""}`}
        today={today}
      />
    </>
  );
}
