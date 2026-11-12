import { createAdminClient } from "@/lib/supabase/admin";

/** Odjava jednim klikom (RFC 8058, zaglavlje List-Unsubscribe-Post) iz poštanskog programa. */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(t)) return new Response("Bad request", { status: 400 });
  await createAdminClient().rpc("crm_email_unsubscribe", { p_token: t, p_all: false });
  return new Response("OK");
}
