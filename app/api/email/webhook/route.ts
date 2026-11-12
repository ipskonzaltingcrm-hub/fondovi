import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhook } from "@/lib/email";

/**
 * Resend webhook (neobavezno): dostava, otvaranje, klik, odbijanje — ažurira dnevnik e-mailova.
 * Aktivan tek kad je u Vercelu postavljen RESEND_WEBHOOK_SECRET (potpis se provjerava).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  "email.delivered": "dostavljeno",
  "email.opened": "otvoreno",
  "email.clicked": "kliknuto",
  "email.bounced": "odbijeno",
  "email.complained": "prituzba",
  "email.failed": "greska",
};
const RANK: Record<string, number> = { poslano: 0, dostavljeno: 1, otvoreno: 2, kliknuto: 3, odbijeno: 4, prituzba: 4, greska: 4 };

export async function POST(req: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) return new Response("Not configured", { status: 404 });
  const body = await req.text();
  if (!verifyWebhook(body, req.headers)) return new Response("Invalid signature", { status: 401 });
  let ev: { type?: string; created_at?: string; data?: { email_id?: string } };
  try {
    ev = JSON.parse(body);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const status = ev.type ? STATUS[ev.type] : undefined;
  const id = ev.data?.email_id;
  if (!status || !id) return new Response("Ignored");
  const admin = createAdminClient();
  const { data: row } = await admin.from("crm_email_log").select("id,status,opened_at,clicked_at").eq("provider_id", id).maybeSingle();
  if (!row) return new Response("Unknown");
  const at = ev.created_at ?? new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ((RANK[status] ?? 0) >= (RANK[row.status as string] ?? 0)) patch.status = status;
  if (status === "otvoreno" && !row.opened_at) patch.opened_at = at;
  if (status === "kliknuto" && !row.clicked_at) patch.clicked_at = at;
  await admin.from("crm_email_log").update(patch).eq("id", row.id);
  return new Response("OK");
}
