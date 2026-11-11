import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/crm/session";
import { CLIENT_COLS, LEAD_COLS, type ClientRow, type Lead } from "@/lib/crm/data";
import { one } from "@/lib/crm/clients-util";
import { clientCandidate, leadCandidate } from "@/lib/crm/matching";
import { LEAD_OPEN } from "@/lib/crm/options";
import { getCalls } from "@/lib/data";
import { FilterView, type Hearsay } from "./filter-view";

export const metadata = { title: "EU Filter" };

export default async function EuFilterPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const [calls, { data: clients }, { data: leads }, { data: hearsay }, { data: callIds }] = await Promise.all([
    getCalls(),
    supabase.from("jls_profiles").select(CLIENT_COLS).order("naziv"),
    supabase.from("crm_leads").select(LEAD_COLS).is("archived_at", null).in("status", LEAD_OPEN).order("broj", { ascending: false }),
    supabase
      .from("crm_hearsay")
      .select("id,program,call_id,izjava,izvor,datum,poveznica,status,created_at,created_by")
      .order("created_at", { ascending: false }),
    supabase.from("calls").select("id,slug"),
  ]);
  const slugById = Object.fromEntries((callIds ?? []).map((c) => [c.id as string, c.slug as string]));

  return (
    <>
      <PageHeader
        title="EU Filter"
        description="Provjera prihvatljivosti klijenta ili leada za natječaje iz EU Radara (vrsta prijavitelja, sektori, status), obrnuta provjera po natječaju, pregled programa i neslužbene informacije s radionica („rekla-kazala“)."
      />
      <FilterView
        calls={calls}
        clients={((clients ?? []) as unknown as ClientRow[]).map((c) => {
          const row = { ...c, crm: one(c.crm) };
          return { ...clientCandidate(row), slug: c.slug };
        })}
        leads={((leads ?? []) as Lead[]).map((l) => ({ ...leadCandidate(l), slug: null }))}
        hearsay={((hearsay ?? []) as Hearsay[]).map((h) => ({ ...h, call_slug: h.call_id ? slugById[h.call_id] ?? null : null }))}
        canEdit={me.role !== "suradnik"}
        callUuidBySlug={Object.fromEntries(Object.entries(slugById).map(([id, slug]) => [slug, id]))}
      />
    </>
  );
}
