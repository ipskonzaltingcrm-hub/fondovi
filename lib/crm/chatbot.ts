import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Javni AI asistent EU Radara (Faza 5). Koristi se samo na serveru (/api/chat) sa service-role klijentom. */

import { DEFAULT_SETTINGS, type ChatBrain, type ChatSettings } from "./chatbot-shared";
export { BRAIN_FIELDS, DEFAULT_SETTINGS, type ChatBrain, type ChatSettings } from "./chatbot-shared";

// Isto kao chatbot u IPS Hubu (odluka vlasnice 2026-10-13): Claude Sonnet 5 — dobar hrvatski i ton, napor „low“.
export const MODEL = "claude-sonnet-5";
export const MODEL_LABEL = "Claude Sonnet 5";
// Cijene modela (USD po milijun tokena): ulaz, izlaz, čitanje i upis predmemorije — samo za prikaz troška i mjesečni limit.
const PRICE = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

export function hasApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function loadChatConfig(admin: SupabaseClient): Promise<{ settings: ChatSettings; brain: ChatBrain }> {
  const { data } = await admin.from("crm_settings").select("key,value").in("key", ["chatbot", "chatbot_brain"]);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value]));
  return {
    settings: { ...DEFAULT_SETTINGS, ...((map.chatbot as Partial<ChatSettings>) ?? {}) },
    brain: { o_nama: "", usluge: "", cijene: "", ton: "", pravila: "", kontakt: "", faq: "", dodatno: "", ...((map.chatbot_brain as Partial<ChatBrain>) ?? {}) },
  };
}

/** Stabilan sustavski tekst (bez datuma i varijabli po zahtjevu — predmemorija ostaje valjana). */
export function systemPrompt(s: ChatSettings, b: ChatBrain): string {
  const sec = (title: string, text: string) => (text.trim() ? `\n\n## ${title}\n${text.trim()}` : "");
  return (
    `Ti si ${s.ime}, AI asistentica servisa EU Radar tvrtke IPS Konzalting (Hrvatska). EU Radar svakodnevno prikuplja EU i nacionalne natječaje ` +
    `(bespovratna sredstva) i pokazuje općinama, gradovima, županijama, poduzećima i institucijama na što se mogu prijaviti.\n\n` +
    `Odgovaraj na hrvatskom, kratko i jasno (najviše nekoliko rečenica ili kratak popis). Za pitanja o konkretnim natječajima obavezno koristi alat ` +
    `trazi_natjecaje i navedi samo ono što alat vrati (naslov, davatelj, rok, poveznica) — ne izmišljaj natječaje, iznose ni rokove. ` +
    `Ne obećavaj odobrenje projekta i ne daj pravne savjete. Ako ne znaš, reci to i predloži razgovor s konzultantom. ` +
    `Kad posjetitelj pokaže stvaran interes (svoj projekt, općinu, tvrtku), ponudi da ostavi kontakt kako bi ga konzultant nazvao.` +
    sec("O nama", b.o_nama) +
    sec("Usluge", b.usluge) +
    sec("Cijene", b.cijene) +
    sec("Ton i stil", b.ton) +
    sec("Pravila", b.pravila) +
    sec("Kontakt i sljedeći korak", b.kontakt) +
    sec("Česta pitanja", b.faq) +
    sec("Dodatno znanje", b.dodatno)
  );
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "trazi_natjecaje",
    description:
      "Pretražuje otvorene i najavljene natječaje u bazi EU Radara. Vrati do 8 natječaja s naslovom, davateljem, rokom, iznosom i poveznicom. " +
      "Koristi kad posjetitelj pita koji natječaji postoje za neku temu, sektor ili vrstu prijavitelja.",
    input_schema: {
      type: "object",
      properties: {
        upit: { type: "string", description: "Ključne riječi teme (npr. 'vrtić', 'energetska obnova', 'poljoprivreda'). Prazno za sve." },
        prijavitelj: {
          type: "string",
          enum: ["opcina", "grad", "zupanija", "tvrtka", "ustanova", "ngo", "lag", "svi"],
          description: "Vrsta prijavitelja; 'svi' ako nije poznato.",
        },
      },
      required: ["upit", "prijavitelj"],
      additionalProperties: false,
    },
  },
];

async function trazi(admin: SupabaseClient, origin: string, input: unknown): Promise<string> {
  const i = (input ?? {}) as { upit?: unknown; prijavitelj?: unknown };
  const upit = typeof i.upit === "string" ? i.upit.trim().slice(0, 100) : "";
  const prijavitelj = typeof i.prijavitelj === "string" ? i.prijavitelj : "svi";
  let q = admin
    .from("calls")
    .select("slug,naslov,davatelj,program,status,rok_prijave,iznos_min,iznos_max,prihvatljivi")
    .neq("status", "zatvoren")
    .order("rok_prijave", { ascending: true, nullsFirst: false })
    .limit(8);
  if (prijavitelj !== "svi") q = q.contains("prihvatljivi", [prijavitelj]);
  if (upit) {
    const like = `%${upit.replace(/[%,()]/g, " ")}%`;
    q = q.or(`naslov.ilike.${like},sazetak.ilike.${like},program.ilike.${like}`);
  }
  const { data, error } = await q;
  if (error) return JSON.stringify({ greska: "Pretraga trenutno nije dostupna." });
  const today = new Date().toISOString().slice(0, 10);
  return JSON.stringify(
    (data ?? [])
      .filter((c) => !c.rok_prijave || c.rok_prijave >= today)
      .map((c) => ({
        naslov: c.naslov,
        davatelj: c.davatelj,
        program: c.program,
        status: c.status,
        rok: c.rok_prijave,
        iznos: c.iznos_min || c.iznos_max ? `${c.iznos_min ?? "?"}–${c.iznos_max ?? "?"} EUR` : null,
        poveznica: `${origin}/pozivi/${c.slug}`,
      })),
  );
}

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type ChatResult = { reply: string; inputTokens: number; outputTokens: number; costUsd: number };

/** Jedan odgovor asistenta (do 4 kruga alata). */
export async function runChat(admin: SupabaseClient, origin: string, system: string, history: ChatTurn[]): Promise<ChatResult> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  let inputTokens = 0;
  let outputTokens = 0;
  let cost = 0;
  let reply = "";

  for (let round = 0; round < 4; round++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // kao u IPS Hubu: automatska predmemorija i za razgovor i rezultate alata; zadnji krug bez alata
      cache_control: { type: "ephemeral" },
      output_config: { effort: "low" },
      system,
      tools: TOOLS,
      tool_choice: { type: round === 3 ? "none" : "auto" },
      messages,
    });
    const u = res.usage;
    inputTokens += u.input_tokens + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    outputTokens += u.output_tokens;
    cost +=
      (u.input_tokens * PRICE.input +
        u.output_tokens * PRICE.output +
        (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
        (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite) /
      1_000_000;

    if (res.stop_reason === "refusal") {
      reply = "Na to pitanje ne mogu odgovoriti. Mogu vam pomoći s natječajima i bespovratnim sredstvima ili vas spojiti s konzultantom.";
      break;
    }
    if (res.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          const content = block.name === "trazi_natjecaje" ? await trazi(admin, origin, block.input) : JSON.stringify({ greska: "Nepoznat alat." });
          results.push({ type: "tool_result", tool_use_id: block.id, content });
        }
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    reply = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    break;
  }
  return {
    reply: reply || "Ispričavam se, trenutno ne mogu odgovoriti. Ostavite kontakt i javit će vam se naš konzultant.",
    inputTokens,
    outputTokens,
    costUsd: Math.round(cost * 1e6) / 1e6,
  };
}
