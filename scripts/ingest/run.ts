/* ------------------------------------------------------------------ */
/*  Ingestion runner — povlači pozive iz svih adaptera i upisuje u DB.  */
/*  Pokretanje: `npm run ingest` (lokalno s .env) ili GitHub Actions.   */
/* ------------------------------------------------------------------ */
import { createServiceClient } from "./supabase";
import { adapters } from "./sources";
import { toCallRow } from "./util";
import type { CallRow, SourceAdapter } from "./types";

// Polja čije promjene bilježimo u call_changes (za "što se promijenilo").
const TRACKED: (keyof CallRow)[] = ["status", "rok_prijave", "iznos_max", "naslov"];

type ExistingRow = {
  id: string;
  slug: string;
  content_hash: string | null;
  status: string;
  rok_prijave: string | null;
  iznos_max: number | null;
  naslov: string;
};

async function ensureSource(
  supabase: ReturnType<typeof createServiceClient>,
  adapter: SourceAdapter,
): Promise<string> {
  const { data, error } = await supabase
    .from("sources")
    .upsert(
      {
        slug: adapter.slug,
        naziv: adapter.naziv,
        url: adapter.url,
        tip: adapter.tip ?? "HTML",
        prioritet: adapter.prioritet ?? "dodatni",
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`ensureSource(${adapter.slug}): ${error.message}`);
  return data.id as string;
}

async function runAdapter(
  supabase: ReturnType<typeof createServiceClient>,
  adapter: SourceAdapter,
): Promise<{ slug: string; fetched: number; inserted: number; updated: number }> {
  const sourceId = await ensureSource(supabase, adapter);

  // 1) Dohvati sirove pozive s izvora
  const raw = await adapter.fetchCalls();

  // 2) Normaliziraj + dedupe po slug-u (zadnji pobjeđuje)
  const bySlug = new Map<string, CallRow>();
  for (const r of raw) {
    const row = { ...toCallRow(adapter, r), source_id: sourceId } as CallRow;
    bySlug.set(row.slug, row);
  }
  const rows = [...bySlug.values()];

  // 3) Postojeći redci ovog izvora
  const { data: existingData, error: exErr } = await supabase
    .from("calls")
    .select("id,slug,content_hash,status,rok_prijave,iznos_max,naslov")
    .eq("source_id", sourceId);
  if (exErr) throw new Error(`select existing (${adapter.slug}): ${exErr.message}`);
  const existing = new Map<string, ExistingRow>(
    (existingData as ExistingRow[]).map((e) => [e.slug, e]),
  );

  // 4) Razvrstaj na nove / promijenjene
  const toUpsert: CallRow[] = [];
  const changes: { call_id: string; field: string; old_value: string | null; new_value: string | null }[] = [];
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const prev = existing.get(row.slug);
    if (!prev) {
      toUpsert.push(row);
      inserted++;
    } else if (prev.content_hash !== row.content_hash) {
      toUpsert.push(row);
      updated++;
      for (const f of TRACKED) {
        const oldV = (prev as never)[f] ?? null;
        const newV = (row as never)[f] ?? null;
        if (String(oldV) !== String(newV)) {
          changes.push({
            call_id: prev.id,
            field: f,
            old_value: oldV === null ? null : String(oldV),
            new_value: newV === null ? null : String(newV),
          });
        }
      }
    }
  }

  // 5) Upsert izmjena (po slug-u)
  if (toUpsert.length) {
    const { error } = await supabase.from("calls").upsert(toUpsert, { onConflict: "slug" });
    if (error) throw new Error(`upsert calls (${adapter.slug}): ${error.message}`);
  }
  if (changes.length) {
    const { error } = await supabase.from("call_changes").insert(changes);
    if (error) console.warn(`  ⚠︎ call_changes insert: ${error.message}`);
  }

  // 6) Ukupan broj poziva ovog izvora + oznaka uspjeha
  const { count } = await supabase
    .from("calls")
    .select("id", { count: "exact", head: true })
    .eq("source_id", sourceId);
  await supabase
    .from("sources")
    .update({
      zadnje_povlacenje: new Date().toISOString(),
      poziva_ukupno: count ?? rows.length,
      status: "aktivan",
    })
    .eq("id", sourceId);

  return { slug: adapter.slug, fetched: rows.length, inserted, updated };
}

async function main() {
  const supabase = createServiceClient();
  if (!adapters.length) {
    console.log("Nema registriranih adaptera. Dodaj ih u scripts/ingest/sources/index.ts.");
    return;
  }

  console.log(`Ingestion start — ${adapters.length} izvor(a)\n`);
  let failures = 0;

  for (const adapter of adapters) {
    try {
      const r = await runAdapter(supabase, adapter);
      console.log(
        `✓ ${r.slug.padEnd(24)} dohvaćeno ${r.fetched}, novih ${r.inserted}, promijenjenih ${r.updated}`,
      );
    } catch (e) {
      failures++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`✗ ${adapter.slug.padEnd(24)} GREŠKA: ${msg}`);
      // Označi izvor kao 'greska' (best-effort)
      await supabase.from("sources").update({ status: "greska" }).eq("slug", adapter.slug);
    }
  }

  console.log(`\nGotovo. Neuspjelih izvora: ${failures}/${adapters.length}`);
  if (failures === adapters.length) process.exit(1); // svi pali → fail CI
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
