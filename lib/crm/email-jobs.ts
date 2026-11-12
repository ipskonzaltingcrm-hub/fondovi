import type { SupabaseClient } from "@supabase/supabase-js";
import { button, esc, fromAddress, hasEmailKey, isEmail, layout, sendBatch, type OutEmail } from "@/lib/email";
import { matchCall } from "@/lib/domain";
import type { ApplicantType, FundingCall, Jls } from "@/lib/types";
import { addDays, dayOfWeek, fmtDay, todayZg, weekStart } from "./dates";

/**
 * Automatski e-mailovi (Faza 6), pokreće ih /api/cron/crm:
 *  - dnevni podsjetnik timu (07:00, radni dani): zadaci za danas/kasne, rokovi projekata, prioritetni natječaji, ponude pred istekom;
 *  - tjedni pregled natječaja korisnicima EU Radara (ponedjeljak 08:00): novi natječaji za njihove klijente + rokovi uskoro.
 * Svaki posao ima ključ (dan/tjedan) i bilježi primatelje u crm_email_log, pa se nitko ne dobije dvaput.
 */

export type EmailSettings = { enabled: boolean; tjedni_pregled: boolean; podsjetnici_tim: boolean; dani_unaprijed: number };
export const DEFAULT_EMAIL: EmailSettings = { enabled: false, tjedni_pregled: true, podsjetnici_tim: true, dani_unaprijed: 7 };

export async function loadEmailSettings(admin: SupabaseClient): Promise<EmailSettings> {
  const { data } = await admin.from("crm_settings").select("value").eq("key", "email").maybeSingle();
  return { ...DEFAULT_EMAIL, ...((data?.value as Partial<EmailSettings>) ?? {}) };
}

export async function appUrl(admin: SupabaseClient): Promise<string> {
  const { data } = await admin.from("crm_settings").select("value").eq("key", "app").maybeSingle();
  const url = (data?.value as { url?: string } | null)?.url ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://fondovi-ips-b26c.vercel.app";
  return url.replace(/\/$/, "");
}

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zagreb", hour: "2-digit", hourCycle: "h23" });
export function hourZg(now: Date = new Date()): number {
  return Number(hourFmt.format(now));
}

/** Oznaka ISO tjedna (npr. 2026-W46) za ključ tjednog posla. */
export function isoWeek(day: string): string {
  const d = new Date(`${weekStart(day)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 3); // četvrtak tog tjedna
  const y = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const w = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

type JobResult = { job: string; sent: number; failed: number; skipped?: string };

async function alreadySent(admin: SupabaseClient, jobKey: string): Promise<Set<string>> {
  const { data } = await admin.from("crm_email_log").select("user_id").eq("job_key", jobKey).neq("status", "greska");
  return new Set((data ?? []).map((r) => r.user_id as string).filter(Boolean));
}

async function deliver(
  admin: SupabaseClient,
  jobKey: string,
  vrsta: "podsjetnik" | "tjedni_pregled",
  list: { userId: string; mail: OutEmail }[],
): Promise<{ sent: number; failed: number }> {
  if (!list.length) return { sent: 0, failed: 0 };
  await admin.from("crm_email_jobs").upsert({ key: jobKey }, { onConflict: "key", ignoreDuplicates: true });
  const results = await sendBatch(list.map((x) => x.mail));
  const rows = list.map((x, k) => {
    const r = results[k];
    return {
      vrsta,
      to_email: String(Array.isArray(x.mail.to) ? x.mail.to[0] : x.mail.to),
      subject: x.mail.subject,
      status: r.ok ? "poslano" : "greska",
      error: r.ok ? null : r.error.slice(0, 500),
      provider_id: r.ok ? r.id : null,
      job_key: jobKey,
      user_id: x.userId,
    };
  });
  await admin.from("crm_email_log").insert(rows);
  const sent = rows.filter((r) => r.status === "poslano").length;
  const failed = rows.length - sent;
  const { data: job } = await admin.from("crm_email_jobs").select("sent,failed").eq("key", jobKey).maybeSingle();
  await admin
    .from("crm_email_jobs")
    .update({ sent: (job?.sent ?? 0) + sent, failed: (job?.failed ?? 0) + failed, finished_at: new Date().toISOString() })
    .eq("key", jobKey);
  return { sent, failed };
}

async function prefsMap(admin: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, { tjedni_pregled: boolean; podsjetnici: boolean; unsub_token: string }>();
  const { data } = await admin.from("crm_email_prefs").select("user_id,tjedni_pregled,podsjetnici,unsub_token").in("user_id", ids);
  return new Map((data ?? []).map((p) => [p.user_id as string, p as { tjedni_pregled: boolean; podsjetnici: boolean; unsub_token: string }]));
}

/** Osigurava redak postavki (i token za odjavu) za svakog primatelja tjednog pregleda. */
async function ensurePrefs(admin: SupabaseClient, ids: string[]) {
  const have = await prefsMap(admin, ids);
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length) await admin.from("crm_email_prefs").upsert(missing.map((user_id) => ({ user_id })), { onConflict: "user_id", ignoreDuplicates: true });
  return missing.length ? prefsMap(admin, ids) : have;
}

// ------------------------------------------------------------------ Dnevni podsjetnik timu

type Line = { text: string; href?: string; meta?: string };

function section(title: string, lines: Line[]): string {
  if (!lines.length) return "";
  return (
    `<h3 style="margin:20px 0 8px;font-size:15px;color:#0b1f4d">${esc(title)}</h3><ul style="margin:0;padding-left:18px">` +
    lines
      .map(
        (l) =>
          `<li style="margin:0 0 6px">${l.href ? `<a href="${esc(l.href)}" style="color:#0b1f4d">${esc(l.text)}</a>` : esc(l.text)}${
            l.meta ? ` <span style="color:#64748b">— ${esc(l.meta)}</span>` : ""
          }</li>`,
      )
      .join("") +
    `</ul>`
  );
}

export async function runTeamReminders(admin: SupabaseClient, now: Date = new Date(), opts: { force?: boolean; onlyUser?: string } = {}): Promise<JobResult> {
  const today = todayZg(now);
  const job = `podsjetnik:${today}`;
  const s = await loadEmailSettings(admin);
  if (!opts.force) {
    if (!s.enabled || !s.podsjetnici_tim) return { job, sent: 0, failed: 0, skipped: "isključeno u postavkama" };
    if (dayOfWeek(today) > 4 || hourZg(now) < 7) return { job, sent: 0, failed: 0, skipped: "nije vrijeme" };
  }
  if (!hasEmailKey()) return { job, sent: 0, failed: 0, skipped: "nema RESEND_API_KEY" };
  const N = Math.max(1, Math.min(30, s.dani_unaprijed || 7));
  const until = addDays(today, N);
  const base = await appUrl(admin);

  let staffQ = admin.from("profiles").select("id,email,full_name,staff_role").not("staff_role", "is", null).eq("staff_active", true);
  if (opts.onlyUser) staffQ = staffQ.eq("id", opts.onlyUser);
  const { data: staff } = await staffQ;
  const people = (staff ?? []).filter((p) => isEmail(p.email as string)) as { id: string; email: string; full_name: string | null; staff_role: string }[];
  if (!people.length) return { job, sent: 0, failed: 0, skipped: "nema primatelja" };
  const prefs = await prefsMap(admin, people.map((p) => p.id));
  const done = opts.force ? new Set<string>() : await alreadySent(admin, job);
  const targets = people.filter((p) => prefs.get(p.id)?.podsjetnici !== false && !done.has(p.id));
  if (!targets.length) return { job, sent: 0, failed: 0, skipped: "svi su već dobili podsjetnik" };
  const ids = targets.map((p) => p.id);

  const [{ data: tasks }, { data: projects }, { data: offers }, { data: calls }] = await Promise.all([
    admin.from("crm_tasks").select("id,naslov,rok,owner").in("owner", ids).is("done_at", null).is("archived_at", null).lte("rok", today).order("rok"),
    admin
      .from("crm_projects")
      .select("id,broj,naziv,rok_prijave,owner,faza")
      .in("owner", ids)
      .is("archived_at", null)
      .in("faza", ["priprema", "dokumentacija"])
      .gte("rok_prijave", today)
      .lte("rok_prijave", until)
      .order("rok_prijave"),
    admin
      .from("crm_offers")
      .select("id,broj,predmet,vrijedi_do,owner")
      .in("owner", ids)
      .eq("status", "poslana")
      .is("archived_at", null)
      .gte("vrijedi_do", today)
      .lte("vrijedi_do", addDays(today, 3)),
    admin
      .from("calls")
      .select("id,naslov,rok_prijave,status,meta:crm_call_meta(relevance,prioritet,archived_at),ai:crm_call_ai(relevance)")
      .neq("status", "zatvoren")
      .gte("rok_prijave", today)
      .lte("rok_prijave", until)
      .order("rok_prijave")
      .limit(300),
  ]);

  type CallR = { id: string; naslov: string; rok_prijave: string; meta: { relevance: string | null; prioritet: boolean; archived_at: string | null } | { relevance: string | null; prioritet: boolean; archived_at: string | null }[] | null; ai: { relevance: string } | { relevance: string }[] | null };
  const first = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const prioCalls: Line[] = ((calls ?? []) as CallR[])
    .filter((c) => {
      const m = first(c.meta);
      if (m?.archived_at) return false;
      const rel = m?.relevance ?? first(c.ai)?.relevance ?? null;
      return !!m?.prioritet || rel === "visoka";
    })
    .slice(0, 15)
    .map((c) => ({ text: c.naslov, href: `${base}/crm/natjecaji?natjecaj=${c.id}`, meta: `rok ${fmtDay(c.rok_prijave)}` }));

  const list: { userId: string; mail: OutEmail }[] = [];
  for (const p of targets) {
    const myTasks = (tasks ?? []).filter((t) => t.owner === p.id);
    const late = myTasks.filter((t) => t.rok && t.rok < today);
    const todayT = myTasks.filter((t) => t.rok === today);
    const myProjects = (projects ?? []).filter((x) => x.owner === p.id);
    const myOffers = (offers ?? []).filter((x) => x.owner === p.id);
    const konz = p.staff_role !== "suradnik";
    const html =
      section(
        `Kasni (${late.length})`,
        late.slice(0, 15).map((t) => ({ text: t.naslov as string, href: `${base}/crm/zadaci`, meta: `rok ${fmtDay(t.rok as string)}` })),
      ) +
      section(
        `Za danas (${todayT.length})`,
        todayT.slice(0, 15).map((t) => ({ text: t.naslov as string, href: `${base}/crm/zadaci` })),
      ) +
      section(
        `Rokovi projekata u sljedećih ${N} dana`,
        myProjects.map((x) => ({ text: `PR-${x.broj} ${x.naziv}`, href: `${base}/crm/projekti/${x.id}`, meta: `rok ${fmtDay(x.rok_prijave as string)}` })),
      ) +
      section(
        "Ponude kojima uskoro istječe valjanost",
        myOffers.map((x) => ({ text: `${x.broj} ${x.predmet}`, href: `${base}/crm/ponude/${x.id}`, meta: `vrijedi do ${fmtDay(x.vrijedi_do as string)}` })),
      ) +
      (konz ? section(`Prioritetni natječaji s rokom u sljedećih ${N} dana`, prioCalls) : "");
    if (!html) continue;
    const ime = (p.full_name ?? "").split(" ")[0];
    list.push({
      userId: p.id,
      mail: {
        to: p.email,
        from: fromAddress("EU Radar CRM"),
        subject: `Podsjetnik za ${fmtDay(today)}: ${late.length + todayT.length} zadataka${myProjects.length ? `, ${myProjects.length} rokova` : ""}`,
        html: layout({
          title: "Dnevni podsjetnik",
          preheader: `Zadaci i rokovi za ${fmtDay(today)}`,
          bodyHtml: `<p style="margin:0 0 12px">Dobro jutro${ime ? `, ${esc(ime)}` : ""}! Ovo vas danas čeka u CRM-u:</p>${html}${button(`${base}/crm`, "Otvori Moj dan")}`,
          footerHtml: `Dnevni podsjetnik EU Radar CRM-a. Isključuje se u CRM-u → Postavke → Moje e-mail obavijesti.`,
        }),
        tags: [{ name: "vrsta", value: "podsjetnik" }],
      },
    });
  }
  if (!list.length) return { job, sent: 0, failed: 0, skipped: "nitko nema stavki za danas" };
  const r = await deliver(admin, job, "podsjetnik", list);
  return { job, ...r };
}

// ------------------------------------------------------------------ Tjedni pregled natječaja (korisnici portala)

type CallRow = {
  id: string;
  slug: string;
  naslov: string;
  davatelj: string;
  program: string;
  level: FundingCall["level"];
  status: FundingCall["status"];
  datum_objave: string | null;
  rok_prijave: string | null;
  iznos_min: number | null;
  iznos_max: number | null;
  ukupna_alokacija: number | null;
  intenzitet: string | null;
  prihvatljivi: ApplicantType[] | null;
  sektori: string[] | null;
  sazetak: string | null;
  izvor: string | null;
  url: string;
  created_at: string;
  updated_at: string;
  ai: { prihvatljivi: ApplicantType[]; sazetak: string | null } | { prihvatljivi: ApplicantType[]; sazetak: string | null }[] | null;
};

function toCall(r: CallRow): FundingCall {
  const ai = Array.isArray(r.ai) ? r.ai[0] : r.ai;
  return {
    id: r.slug,
    naslov: r.naslov,
    davatelj: r.davatelj,
    program: r.program,
    level: r.level,
    status: r.status,
    datumObjave: r.datum_objave ?? r.created_at,
    rokPrijave: r.rok_prijave,
    iznosMin: r.iznos_min,
    iznosMax: r.iznos_max,
    ukupnaAlokacija: r.ukupna_alokacija,
    intenzitet: r.intenzitet ?? "",
    prihvatljivi: ai?.prihvatljivi?.length ? ai.prihvatljivi : r.prihvatljivi ?? [],
    sektori: r.sektori ?? [],
    sazetak: ai?.sazetak || r.sazetak || "",
    izvor: r.izvor ?? "",
    url: r.url,
    azurirano: r.updated_at,
  };
}

function callItem(c: FundingCall, base: string, rok = true): string {
  const iznos = c.iznosMax ? ` · do ${Math.round(c.iznosMax).toLocaleString("hr-HR")} €` : "";
  return `<li style="margin:0 0 12px"><a href="${esc(c.url)}" style="color:#0b1f4d;font-weight:600">${esc(c.naslov)}</a><br><span style="color:#64748b;font-size:13px">${esc(
    c.davatelj,
  )}${rok && c.rokPrijave ? ` · rok ${fmtDay(c.rokPrijave)}` : ""}${iznos}</span>${
    c.sazetak ? `<br><span style="font-size:13px">${esc(c.sazetak.slice(0, 260))}${c.sazetak.length > 260 ? "…" : ""}</span>` : ""
  }</li>`;
}

export async function runWeeklyDigest(
  admin: SupabaseClient,
  now: Date = new Date(),
  opts: { force?: boolean; onlyUser?: string; maxPerRun?: number } = {},
): Promise<JobResult> {
  const today = todayZg(now);
  const job = `tjedni:${isoWeek(today)}`;
  const s = await loadEmailSettings(admin);
  if (!opts.force) {
    if (!s.enabled || !s.tjedni_pregled) return { job, sent: 0, failed: 0, skipped: "isključeno u postavkama" };
    if (dayOfWeek(today) !== 0 || hourZg(now) < 8) return { job, sent: 0, failed: 0, skipped: "nije vrijeme" };
  }
  if (!hasEmailKey()) return { job, sent: 0, failed: 0, skipped: "nema RESEND_API_KEY" };
  const base = await appUrl(admin);

  // Primatelji: korisnici portala (ne tim), nisu blokirani ni označeni kao konkurencija, imaju barem jednog klijenta.
  let usersQ = admin.from("profiles").select("id,email,full_name,portal_blocked_at").is("staff_role", null).is("portal_blocked_at", null);
  if (opts.onlyUser) usersQ = admin.from("profiles").select("id,email,full_name,portal_blocked_at").eq("id", opts.onlyUser);
  const [{ data: users }, { data: metas }, { data: members }] = await Promise.all([
    usersQ,
    admin.from("crm_portal_meta").select("user_id,oznaka"),
    admin.from("memberships").select("user_id,tenant_id"),
  ]);
  const excluded = new Set((metas ?? []).filter((m) => m.oznaka === "konkurencija").map((m) => m.user_id as string));
  const tenantsBy = new Map<string, string[]>();
  for (const m of members ?? []) tenantsBy.set(m.user_id as string, [...(tenantsBy.get(m.user_id as string) ?? []), m.tenant_id as string]);
  const cands = ((users ?? []) as { id: string; email: string | null; full_name: string | null }[]).filter(
    (u) => isEmail(u.email) && (opts.onlyUser ? true : !excluded.has(u.id)) && (tenantsBy.get(u.id)?.length ?? 0) > 0,
  );
  if (!cands.length) return { job, sent: 0, failed: 0, skipped: "nema primatelja s klijentima" };

  const prefs = await ensurePrefs(admin, cands.map((u) => u.id));
  const done = opts.force ? new Set<string>() : await alreadySent(admin, job);
  const targets = cands.filter((u) => prefs.get(u.id)?.tjedni_pregled !== false && !done.has(u.id)).slice(0, opts.maxPerRun ?? 300);
  if (!targets.length) return { job, sent: 0, failed: 0, skipped: "svi su već dobili pregled" };

  const tenantIds = [...new Set(targets.flatMap((u) => tenantsBy.get(u.id) ?? []))];
  const since = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const [{ data: profiles }, { data: calls }] = await Promise.all([
    admin.from("jls_profiles").select("id,tenant_id,slug,naziv,klijent_tip,tip,zupanija,stanovnika,ruralno,velicina,sektori_interesa,kontakt_osoba,status").in("tenant_id", tenantIds),
    admin
      .from("calls")
      .select(
        "id,slug,naslov,davatelj,program,level,status,datum_objave,rok_prijave,iznos_min,iznos_max,ukupna_alokacija,intenzitet,prihvatljivi,sektori,sazetak,izvor,url,created_at,updated_at,ai:crm_call_ai(prihvatljivi,sazetak)",
      )
      .neq("status", "zatvoren")
      .or(`rok_prijave.is.null,rok_prijave.gte.${today}`)
      .order("created_at", { ascending: false })
      .limit(1500),
  ]);
  const allCalls = ((calls ?? []) as CallRow[]).map((r) => ({ row: r, call: toCall(r) }));
  const soon = addDays(today, 14);

  const list: { userId: string; mail: OutEmail }[] = [];
  for (const u of targets) {
    const myProfiles = (profiles ?? []).filter((p) => (tenantsBy.get(u.id) ?? []).includes(p.tenant_id as string));
    if (!myProfiles.length) continue;
    const jlsList: Jls[] = myProfiles.map((c) => ({
      id: c.slug as string,
      naziv: c.naziv as string,
      tipKlijenta: c.klijent_tip as Jls["tipKlijenta"],
      tip: c.tip as Jls["tip"],
      zupanija: (c.zupanija as string) ?? "",
      stanovnika: (c.stanovnika as number) ?? 0,
      ruralno: !!c.ruralno,
      lag: null,
      velicina: c.velicina as Jls["velicina"],
      sektoriInteresa: (c.sektori_interesa as string[]) ?? [],
      kontaktOsoba: (c.kontakt_osoba as string) ?? "",
      status: c.status as Jls["status"],
    }));
    const matched = allCalls
      .map((x) => ({ ...x, m: jlsList.map((j) => matchCall(x.call, j)).sort((a, b) => b.score - a.score)[0] }))
      .filter((x) => x.m?.eligible && x.m.score >= 45);
    const novi = matched.filter((x) => x.row.created_at >= since).sort((a, b) => b.m.score - a.m.score).slice(0, 12);
    const rokovi = matched
      .filter((x) => x.call.rokPrijave && x.call.rokPrijave <= soon && !novi.includes(x))
      .sort((a, b) => (a.call.rokPrijave! < b.call.rokPrijave! ? -1 : 1))
      .slice(0, 10);
    if (!novi.length && !rokovi.length) continue;

    const token = prefs.get(u.id)?.unsub_token;
    const unsubUrl = token ? `${base}/odjava?t=${token}` : `${base}/postavke`;
    const naziv = jlsList.length === 1 ? jlsList[0].naziv : `${jlsList.length} vaših profila`;
    const body =
      `<p style="margin:0 0 12px">Pregled natječaja za <b>${esc(naziv)}</b> u tjednu ${esc(fmtDay(weekStart(today)))}.</p>` +
      (novi.length
        ? `<h3 style="margin:20px 0 8px;font-size:15px;color:#0b1f4d">Novi natječaji ovaj tjedan (${novi.length})</h3><ul style="margin:0;padding-left:18px">${novi
            .map((x) => callItem(x.call, base))
            .join("")}</ul>`
        : "") +
      (rokovi.length
        ? `<h3 style="margin:20px 0 8px;font-size:15px;color:#0b1f4d">Rok uskoro (sljedećih 14 dana)</h3><ul style="margin:0;padding-left:18px">${rokovi
            .map((x) => callItem(x.call, base))
            .join("")}</ul>`
        : "") +
      button(`${base}/pozivi`, "Svi natječaji u EU Radaru") +
      `<p style="margin:12px 0 0;font-size:13px;color:#64748b">Želite pomoć s prijavom? Odgovorite na ovaj e-mail ili nas nazovite — konzultanti IPS Konzaltinga pripremaju cijelu prijavu.</p>`;
    list.push({
      userId: u.id,
      mail: {
        to: u.email!,
        from: fromAddress("EU Radar"),
        replyTo: null,
        subject: novi.length ? `EU Radar: ${novi.length} novih natječaja za ${naziv}` : `EU Radar: rokovi natječaja uskoro ističu`,
        html: layout({
          title: "Tjedni pregled natječaja",
          preheader: novi[0]?.call.naslov ?? rokovi[0]?.call.naslov,
          bodyHtml: body,
          footerHtml: `Primate ovaj e-mail jer imate račun na EU Radaru. <a href="${esc(unsubUrl)}" style="color:#64748b">Odjava od tjednog pregleda</a> · IPS Konzalting d.o.o.`,
        }),
        headers: token
          ? { "List-Unsubscribe": `<${base}/api/odjava?t=${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
          : undefined,
        tags: [{ name: "vrsta", value: "tjedni_pregled" }],
      },
    });
  }
  if (!list.length) return { job, sent: 0, failed: 0, skipped: "nitko nema novih natječaja" };
  const r = await deliver(admin, job, "tjedni_pregled", list);
  return { job, ...r };
}
