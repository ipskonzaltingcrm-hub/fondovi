"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCrmMe, dbMessage, requestOrigin, type ActionResult } from "@/lib/crm/session";
import type { TriageSettings } from "@/lib/crm/triage-shared";

/** Postavke AI procjene natječaja (administrator): uključenost, profil, ključne riječi, mjesečni limit. */
export async function saveTriageSettings(s: TriageSettings): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Postavke AI procjene mijenja administrator." };
  const profile = (s.profile ?? "").trim();
  if (profile.length < 50) return { ok: false, error: "Opis (profil) neka ima barem 50 znakova — AI prema njemu procjenjuje natječaje." };
  if (profile.length > 6000) return { ok: false, error: "Opis je predug (najviše 6000 znakova)." };
  const keywords = [...new Set((s.keywords ?? []).map((k) => k.trim().toLowerCase()).filter(Boolean))].sort().slice(0, 300);
  const value: TriageSettings = {
    enabled: !!s.enabled,
    profile,
    keywords,
    limit_usd: Math.max(1, Math.min(500, Math.round(Number(s.limit_usd) || 15))),
  };
  const supabase = await createClient();
  const { error, count } = await supabase.from("crm_settings").update({ value }, { count: "exact" }).eq("key", "call_triage");
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Postavke nisu spremljene (ovlasti)." };
  revalidatePath("/crm/natjecaji");
  return { ok: true, message: value.enabled ? "Spremljeno. Novi natječaji procjenjuju se pri sljedećoj provjeri." : "Spremljeno (AI procjena je isključena)." };
}

/**
 * „Provjeri sada“ (konzultant i više): odmah prikuplja natječaje iz HR izvora (ruta /api/ingest u Frankfurtu),
 * a zatim AI procjenjuje nove. Radi u pozadini; stanje se vidi u zapisu pokretanja (osvježi stranicu).
 */
export async function runCheckNow(): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  if (me.role === "suradnik") return { ok: false, error: "Provjeru pokreću konzultanti i administratori." };
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, error: "Na serveru nije postavljen CRON_SECRET." };
  const admin = createAdminClient();
  const { data: running } = await admin
    .from("crm_triage_runs")
    .select("id")
    .eq("status", "u_tijeku")
    .gte("started_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .limit(1)
    .maybeSingle();
  if (running) return { ok: false, error: "Provjera je već u tijeku. Pričekajte nekoliko minuta." };
  const { data: run, error } = await admin.from("crm_triage_runs").insert({ trigger: "rucno", started_by: me.id }).select("id").single();
  if (error) return { ok: false, error: dbMessage(error) };
  const origin = await requestOrigin();
  const auth = { authorization: `Bearer ${secret}` };

  after(async () => {
    try {
      const res = await fetch(`${origin}/api/ingest`, { headers: auth, signal: AbortSignal.timeout(58_000) });
      const j = (await res.json().catch(() => null)) as { total?: number; failures?: number; results?: { inserted?: number; updated?: number }[] } | null;
      const results = j?.results ?? [];
      await admin
        .from("crm_triage_runs")
        .update({
          ingest: {
            sources: j?.total ?? 0,
            failures: j?.failures ?? 0,
            inserted: results.reduce((s, r) => s + (r.inserted ?? 0), 0),
            updated: results.reduce((s, r) => s + (r.updated ?? 0), 0),
          },
        })
        .eq("id", run.id);
    } catch {
      await admin.from("crm_triage_runs").update({ ingest: { error: "Prikupljanje nije završilo na vrijeme." } }).eq("id", run.id);
    }
    try {
      await fetch(`${origin}/api/cron/crm?only=triage`, { headers: auth, signal: AbortSignal.timeout(5000) });
    } catch {
      /* trijažu nastavlja raspored (svakih 10 min) */
    }
  });
  revalidatePath("/crm/natjecaji");
  return { ok: true, message: "Provjera je pokrenuta. Prikupljanje i AI procjena traju nekoliko minuta — osvježite stranicu." };
}
