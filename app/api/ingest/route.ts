import { runIngest } from "@/scripts/ingest/run";

// Vrti se u Frankfurtu (EU IP) — HR portali blokiraju strane/datacentar IP-eve.
export const runtime = "nodejs";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // bez tajne ništa ne pokrećemo (sprječava javno okidanje)
  // Vercel Cron šalje Bearer; za ručni/test poziv prihvaćamo i ?key=<CRON_SECRET>.
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

// Vercel Cron okida GET i automatski šalje 'Authorization: Bearer ${CRON_SECRET}'.
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  try {
    const summary = await runIngest({ egress: "hr" });
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
