import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MODEL, hasApiKey, loadChatConfig, runChat, systemPrompt } from "@/lib/crm/chatbot";

/**
 * Javni AI asistent EU Radara.
 * GET  → stanje (uključen, ime, pozdrav, ima li ključa)
 * POST { action: "message", conversationId?, message, izvor?, test? } → odgovor
 * POST { action: "contact", conversationId, ime, telefon, email, privola } → lead u CRM-u
 * Baza se piše service-role klijentom samo kroz ovu rutu (posjetitelj nema izravan pristup tablicama).
 */

const NEW_CONV_PER_HOUR = 20;

function ipHash(req: NextRequest): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "nepoznat";
  return createHash("sha256").update(`eu-radar-chat:${ip}`).digest("hex").slice(0, 32);
}

async function isStaff(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("staff_role,staff_active").eq("id", user.id).maybeSingle();
  return !!(data?.staff_role && data.staff_active);
}

export async function GET() {
  const admin = createAdminClient();
  const { settings } = await loadChatConfig(admin);
  return NextResponse.json({
    enabled: settings.enabled && hasApiKey(),
    ime: settings.ime,
    pozdrav: settings.pozdrav,
    kontaktOd: settings.kontakt_od,
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }
  const admin = createAdminClient();

  // Razgovor samo za kontakt (asistent isključen ili bez ključa).
  if (body.action === "open") {
    const test = body.test === true && (await isStaff());
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("crm_chat_conversations").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash(req)).gte("created_at", since);
    if ((count ?? 0) >= NEW_CONV_PER_HOUR && !test) return NextResponse.json({ error: "Previše zahtjeva. Pokušajte kasnije." }, { status: 429 });
    const { data, error } = await admin
      .from("crm_chat_conversations")
      .insert({ izvor: typeof body.izvor === "string" ? body.izvor.slice(0, 50) : null, ip_hash: ipHash(req), test })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "Razgovor se ne može otvoriti." }, { status: 500 });
    return NextResponse.json({ conversationId: data.id });
  }

  if (body.action === "contact") {
    const conv = typeof body.conversationId === "string" ? body.conversationId : "";
    if (!body.privola) return NextResponse.json({ error: "Za kontakt je potrebna privola." }, { status: 400 });
    const { error } = await admin.rpc("crm_chat_contact", {
      p_conv: conv,
      p_ime: String(body.ime ?? ""),
      p_telefon: String(body.telefon ?? ""),
      p_email: String(body.email ?? ""),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (!message) return NextResponse.json({ error: "Upišite pitanje." }, { status: 400 });
  const { settings, brain } = await loadChatConfig(admin);
  const test = body.test === true && (await isStaff());
  if (!hasApiKey() || (!settings.enabled && !test)) {
    return NextResponse.json({ reply: null, offerContact: true, unavailable: true });
  }

  // Razgovor: postojeći ili novi (ograničenje novih razgovora po IP-u).
  let convId = typeof body.conversationId === "string" ? body.conversationId : null;
  let pitanja = 0;
  if (convId) {
    const { data } = await admin.from("crm_chat_conversations").select("id,pitanja").eq("id", convId).maybeSingle();
    if (!data) convId = null;
    else pitanja = data.pitanja;
  }
  if (!convId) {
    const hash = ipHash(req);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("crm_chat_conversations").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("created_at", since);
    if ((count ?? 0) >= NEW_CONV_PER_HOUR && !test) {
      return NextResponse.json({ error: "Previše razgovora u kratkom vremenu. Pokušajte kasnije." }, { status: 429 });
    }
    const { data, error } = await admin
      .from("crm_chat_conversations")
      .insert({ izvor: typeof body.izvor === "string" ? body.izvor.slice(0, 50) : null, ip_hash: hash, test })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: "Razgovor se ne može otvoriti." }, { status: 500 });
    convId = data.id as string;
  }

  if (pitanja >= settings.max_pitanja) {
    return NextResponse.json({
      conversationId: convId,
      reply: "Za detaljniji razgovor najbolje je da vas nazove naš konzultant — ostavite kontakt ispod.",
      offerContact: true,
    });
  }

  // Mjesečni limit troška chatbota.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: spent } = await admin.from("crm_ai_usage").select("cost_usd").eq("modul", "chatbot").gte("at", monthStart.toISOString());
  const total = (spent ?? []).reduce((a, r) => a + Number(r.cost_usd), 0);
  if (total >= settings.limit_usd && !test) {
    return NextResponse.json({
      conversationId: convId,
      reply: "Trenutno ne mogu odgovarati. Ostavite kontakt i naš konzultant javit će vam se.",
      offerContact: true,
    });
  }

  await admin.from("crm_chat_messages").insert({ conversation_id: convId, role: "user", content: message });
  const { data: hist } = await admin
    .from("crm_chat_messages")
    .select("role,content")
    .eq("conversation_id", convId)
    .order("id", { ascending: false })
    .limit(20);
  const history = ((hist ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();

  try {
    const r = await runChat(admin, req.nextUrl.origin, systemPrompt(settings, brain), history);
    await admin.from("crm_chat_messages").insert({ conversation_id: convId, role: "assistant", content: r.reply });
    const { data: cur } = await admin.from("crm_chat_conversations").select("cost_usd").eq("id", convId).single();
    await admin
      .from("crm_chat_conversations")
      .update({ pitanja: pitanja + 1, last_at: new Date().toISOString(), cost_usd: Number(cur?.cost_usd ?? 0) + r.costUsd })
      .eq("id", convId);
    await admin.from("crm_ai_usage").insert({
      modul: "chatbot",
      opis: test ? "Testni razgovor" : "Razgovor na webu",
      model: MODEL,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd: r.costUsd,
      ref: convId,
    });
    return NextResponse.json({ conversationId: convId, reply: r.reply, offerContact: pitanja + 1 >= settings.kontakt_od });
  } catch (e) {
    const msg =
      e instanceof Anthropic.AuthenticationError
        ? "AI asistent nije ispravno spojen."
        : e instanceof Anthropic.RateLimitError
          ? "AI asistent je trenutno preopterećen. Pokušajte za minutu."
          : "AI asistent trenutno nije dostupan.";
    return NextResponse.json({ conversationId: convId, reply: `${msg} Ostavite kontakt i javit ćemo vam se.`, offerContact: true });
  }
}
