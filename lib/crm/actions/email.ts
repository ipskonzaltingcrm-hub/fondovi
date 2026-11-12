"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCrmMe, dbMessage, type ActionResult } from "@/lib/crm/session";
import { button, esc, fromAddress, hasEmailKey, isEmail, layout, sendEmail, textToHtml } from "@/lib/email";
import { appUrl, runTeamReminders, type EmailSettings } from "@/lib/crm/email-jobs";

export type OfferEmailInput = { to: string; cc?: string; subject: string; body: string; bccSelf: boolean };

/**
 * Slanje ponude e-mailom iz CRM-a. Pošiljatelj: „Ime | IPS Konzalting <ponude@radar.ips-konzalting.hr>“,
 * odgovori idu konzultantu (reply-to). Poruka sadrži poveznicu na ponudu (pregled i spremanje PDF-a);
 * prvo otvaranje poveznice bilježi se u povijesti. Ponuda postaje Poslana, a lead prelazi u „Ponuda“.
 */
export async function sendOfferEmail(offerId: string, input: OfferEmailInput): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  if (!hasEmailKey()) return { ok: false, error: "Slanje e-maila nije spojeno (u Vercelu nedostaje RESEND_API_KEY)." };
  const to = input.to.trim().toLowerCase();
  const cc = (input.cc ?? "")
    .split(/[,;\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!isEmail(to)) return { ok: false, error: "Upišite ispravnu adresu primatelja." };
  if (cc.some((x) => !isEmail(x))) return { ok: false, error: "Neka adresa u kopiji nije ispravna." };
  if (cc.length > 5) return { ok: false, error: "Najviše 5 adresa u kopiji." };
  if (!input.subject.trim() || !input.body.trim()) return { ok: false, error: "Upišite naslov i tekst poruke." };

  const supabase = await createClient();
  const { data: o } = await supabase
    .from("crm_offers")
    .select("id,broj,predmet,status,owner,public_token,lead_id,jls_profile_id,vrijedi_do,iznos_ukupno")
    .eq("id", offerId)
    .maybeSingle();
  if (!o) return { ok: false, error: "Ponuda ne postoji ili nemate pristup." };
  if (o.status !== "nacrt" && o.status !== "poslana") return { ok: false, error: "E-mailom se šalje nacrt ili već poslana ponuda." };
  if (me.role === "suradnik" && o.owner !== me.id) return { ok: false, error: "Suradnik šalje samo svoje ponude." };
  const { count } = await supabase.from("crm_offer_items").select("id", { count: "exact", head: true }).eq("offer_id", offerId);
  if (!count) return { ok: false, error: "Ponuda nema nijednu stavku." };

  const admin = createAdminClient();
  const base = await appUrl(admin);
  const link = `${base}/ponuda/${o.public_token}`;
  const html = layout({
    title: `Ponuda ${o.broj}`,
    preheader: `${o.predmet}`,
    bodyHtml:
      textToHtml(input.body) +
      button(link, `Pogledaj ponudu ${o.broj}`) +
      `<p style="margin:0;font-size:13px;color:#64748b">Na poveznici je ponuda koju možete pregledati, ispisati ili spremiti kao PDF.</p>`,
    footerHtml: `${esc(me.name)} · IPS Konzalting d.o.o.${isEmail(me.email) ? ` · <a href="mailto:${esc(me.email)}" style="color:#64748b">${esc(me.email)}</a>` : ""}`,
  });
  const text = `${input.body.trim()}\n\nPonuda ${o.broj}: ${link}\n\n${me.name} · IPS Konzalting d.o.o.`;
  const res = await sendEmail({
    to,
    cc,
    from: fromAddress(`${me.name} | IPS Konzalting`, "ponude"),
    replyTo: isEmail(me.email) ? me.email : null,
    subject: input.subject.trim(),
    html,
    text,
    bcc: input.bccSelf && isEmail(me.email) && me.email.toLowerCase() !== to ? [me.email] : undefined,
    tags: [{ name: "vrsta", value: "ponuda" }],
  });
  await admin.from("crm_email_log").insert({
    vrsta: "ponuda",
    to_email: [to, ...cc].join(", ").slice(0, 400),
    subject: input.subject.trim().slice(0, 250),
    status: res.ok ? "poslano" : "greska",
    error: res.ok ? null : res.error.slice(0, 500),
    provider_id: res.ok ? res.id : null,
    offer_id: offerId,
    sent_by: me.id,
  });
  if (!res.ok) return { ok: false, error: `E-mail nije poslan: ${res.error}` };

  if (o.status === "nacrt") {
    const { error } = await supabase.rpc("crm_set_offer_status", { p_id: offerId, p_status: "poslana", p_razlog: null });
    if (error) return { ok: false, error: `E-mail je poslan, ali status nije promijenjen: ${dbMessage(error)}` };
  }
  await supabase.from("crm_activities").insert({
    vrsta: "email",
    body: `Ponuda ${o.broj} poslana e-mailom na ${[to, ...cc].join(", ")}.\nNaslov: ${input.subject.trim()}`,
    lead_id: o.lead_id,
    jls_profile_id: o.jls_profile_id,
  });
  revalidatePath("/crm", "layout");
  revalidatePath(`/crm/ponude/${offerId}`);
  return { ok: true, message: `Ponuda je poslana na ${to}.` };
}

/** Probni e-mail meni (provjera da su ključ i poddomena ispravni). */
export async function sendTestEmail(): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Probni e-mail šalje administrator." };
  if (!isEmail(me.email)) return { ok: false, error: "Vaš račun nema ispravnu e-mail adresu." };
  const admin = createAdminClient();
  const res = await sendEmail({
    to: me.email,
    from: fromAddress("EU Radar CRM"),
    subject: "EU Radar — probni e-mail",
    html: layout({
      title: "Probni e-mail",
      bodyHtml: textToHtml(`Ovo je probni e-mail iz EU Radar CRM-a.\n\nAko ste ga primili, slanje s poddomene radar.ips-konzalting.hr radi.`),
    }),
  });
  await admin.from("crm_email_log").insert({
    vrsta: "test",
    to_email: me.email,
    subject: "EU Radar — probni e-mail",
    status: res.ok ? "poslano" : "greska",
    error: res.ok ? null : res.error.slice(0, 500),
    provider_id: res.ok ? res.id : null,
    sent_by: me.id,
  });
  revalidatePath("/crm/postavke");
  return res.ok ? { ok: true, message: `Probni e-mail je poslan na ${me.email}.` } : { ok: false, error: res.error };
}

/** Današnji podsjetnik odmah, samo meni (probno; ne broji se kao dnevno slanje). */
export async function sendMyReminderNow(): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me) return { ok: false, error: "Nemate pristup CRM-u." };
  const r = await runTeamReminders(createAdminClient(), new Date(), { force: true, onlyUser: me.id });
  revalidatePath("/crm/postavke");
  if (r.sent) return { ok: true, message: `Podsjetnik je poslan na ${me.email}.` };
  return { ok: false, error: r.failed ? "Slanje nije uspjelo (vidi dnevnik e-mailova)." : `Nije poslano: ${r.skipped ?? "nema stavki"}.` };
}

export async function saveEmailSettings(s: EmailSettings): Promise<ActionResult> {
  const me = await getCrmMe();
  if (!me?.isAdmin) return { ok: false, error: "Postavke e-maila mijenja administrator." };
  const value: EmailSettings = {
    enabled: !!s.enabled,
    tjedni_pregled: !!s.tjedni_pregled,
    podsjetnici_tim: !!s.podsjetnici_tim,
    dani_unaprijed: Math.max(1, Math.min(30, Math.round(Number(s.dani_unaprijed) || 7))),
  };
  const supabase = await createClient();
  const { error, count } = await supabase.from("crm_settings").update({ value }, { count: "exact" }).eq("key", "email");
  if (error) return { ok: false, error: dbMessage(error) };
  if (!count) return { ok: false, error: "Postavke nisu spremljene (ovlasti)." };
  revalidatePath("/crm/postavke");
  return { ok: true, message: "Postavke e-maila su spremljene." };
}

/** Moje e-mail obavijesti (član tima ili korisnik portala). */
export async function saveMyEmailPrefs(p: { podsjetnici?: boolean; tjedni_pregled?: boolean }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Niste prijavljeni." };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.podsjetnici !== undefined) patch.podsjetnici = !!p.podsjetnici;
  if (p.tjedni_pregled !== undefined) patch.tjedni_pregled = !!p.tjedni_pregled;
  const { data: cur } = await supabase.from("crm_email_prefs").select("user_id").eq("user_id", user.id).maybeSingle();
  const { error } = cur
    ? await supabase.from("crm_email_prefs").update(patch).eq("user_id", user.id)
    : await supabase.from("crm_email_prefs").insert({ user_id: user.id, ...(p.podsjetnici !== undefined ? { podsjetnici: !!p.podsjetnici } : {}), ...(p.tjedni_pregled !== undefined ? { tjedni_pregled: !!p.tjedni_pregled } : {}) });
  if (error) return { ok: false, error: dbMessage(error) };
  revalidatePath("/postavke");
  revalidatePath("/crm/postavke");
  return { ok: true, message: "Spremljeno." };
}
