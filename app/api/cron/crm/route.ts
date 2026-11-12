import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTriage } from "@/lib/crm/triage";
import { runTeamReminders, runWeeklyDigest } from "@/lib/crm/email-jobs";
import { todayZg } from "@/lib/crm/dates";

/**
 * Raspored CRM-a (Faza 6). Poziva ga pg_cron u bazi svakih 10 min (token iz Vaulta) ili gumb „Provjeri sada“ (CRON_SECRET).
 * Redom: AI trijaža novih natječaja, dnevni podsjetnik timu (07:00), tjedni pregled natječaja (ponedjeljak 08:00).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorized(req: Request, admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const secret = process.env.CRON_SECRET;
  if (secret && token === secret) return true;
  const { data } = await admin.rpc("crm_cron_token_ok", { p_token: token });
  return data === true;
}

export async function GET(req: Request) {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return new Response("Not configured", { status: 503 });
  }
  if (!(await authorized(req, admin))) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const only = url.searchParams.get("only"); // "triage" kod „Provjeri sada“
  const hop = Number(url.searchParams.get("hop") ?? "0");
  const today = todayZg();
  const out: Record<string, unknown> = {};

  // Zaglavljena pokretanja (> 2 h) zatvaraju se kao greška.
  await admin
    .from("crm_triage_runs")
    .update({ status: "greska", error: "Prekinuto (isteklo vrijeme).", finished_at: new Date().toISOString() })
    .eq("status", "u_tijeku")
    .lt("started_at", new Date(Date.now() - 2 * 3600_000).toISOString());

  // 1) AI trijaža — pripisuje se ručnom pokretanju u tijeku ili novom zapisu rasporeda.
  const { data: open } = await admin.from("crm_triage_runs").select("id,assessed,relevant,cost_usd").eq("status", "u_tijeku").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const t = await runTriage(admin, today, { runId: open?.id ?? null, budgetMs: only === "triage" ? 35_000 : 25_000 });
  out.triage = t;
  if (open) {
    const done = !t.error && (t.remaining === 0 || !!t.skipped || hop >= 8);
    await admin
      .from("crm_triage_runs")
      .update({
        assessed: open.assessed + t.assessed,
        relevant: open.relevant + t.relevant,
        cost_usd: Number(open.cost_usd) + t.cost,
        ...(t.error ? { status: "greska", error: t.error.slice(0, 500), finished_at: new Date().toISOString() } : {}),
        ...(done && !t.error ? { status: "ok", error: t.skipped ?? null, finished_at: new Date().toISOString() } : {}),
      })
      .eq("id", open.id);
  } else if (t.assessed > 0 || t.error) {
    await admin.from("crm_triage_runs").insert({
      trigger: "raspored",
      status: t.error ? "greska" : "ok",
      assessed: t.assessed,
      relevant: t.relevant,
      cost_usd: t.cost,
      error: t.error?.slice(0, 500) ?? null,
      finished_at: new Date().toISOString(),
    });
  }

  // Ručna provjera: ako je ostalo neprocijenjenih, nastavi odmah u novom pozivu (najviše 8 puta).
  if (only === "triage" && open && t.remaining > 0 && !t.error && !t.skipped && hop < 8) {
    const next = new URL(req.url);
    next.searchParams.set("hop", String(hop + 1));
    after(async () => {
      try {
        await fetch(next, { headers: { authorization: req.headers.get("authorization") ?? "" }, signal: AbortSignal.timeout(5000) });
      } catch {
        /* nastavlja raspored za 10 min */
      }
    });
  }

  if (only !== "triage") {
    // 2) i 3) e-mailovi (svaki posao sam provjerava vrijeme, postavke i tko je već dobio poruku).
    out.podsjetnici = await runTeamReminders(admin);
    out.tjedni = await runWeeklyDigest(admin);
  }
  return Response.json({ ok: true, ...out });
}
