import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Slanje e-maila iz aplikacije preko Resenda (REST API, bez dodatnog paketa).
 *
 * Pošiljatelj je UVIJEK na poddomeni `radar.ips-konzalting.hr` (verificirana u Resendu, vlastiti SPF/DKIM),
 * nikad na `ips-konzalting.hr` — M365 pošta tvrtke ostaje netaknuta. Odgovori idu na `reply_to`
 * (npr. adresa konzultanta), što je samo zaglavlje poruke i ne traži nikakvu DNS promjenu.
 *
 * Ključ: env `RESEND_API_KEY` (Vercel → Environment Variables). Bez ključa ništa se ne šalje.
 */

export const EMAIL_DOMAIN = "radar.ips-konzalting.hr";
const DEFAULT_FROM = `EU Radar <no-reply@${EMAIL_DOMAIN}>`;

export function hasEmailKey(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Adresa pošiljatelja; dopušta samo adrese na poddomeni radar. (zaštita od pogrešne konfiguracije). */
export function fromAddress(name?: string, local = "no-reply"): string {
  const safeLocal = /^[a-z0-9._-]{1,40}$/i.test(local) ? local : "no-reply";
  const safeName = (name ?? "").replace(/[<>"\r\n]/g, "").trim().slice(0, 80);
  return safeName ? `${safeName} <${safeLocal}@${EMAIL_DOMAIN}>` : DEFAULT_FROM;
}

export function isEmail(s: string | null | undefined): s is string {
  return !!s && s.length <= 200 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]{2,}$/.test(s);
}

export type OutEmail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string | null;
  cc?: string[];
  bcc?: string[];
  /** Zaglavlja, npr. List-Unsubscribe za tjedni pregled. */
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

async function call(path: string, body: unknown): Promise<Response> {
  return fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

function payload(m: OutEmail) {
  return {
    from: m.from ?? DEFAULT_FROM,
    to: Array.isArray(m.to) ? m.to : [m.to],
    subject: m.subject.slice(0, 250),
    html: m.html,
    text: m.text,
    reply_to: m.replyTo || undefined,
    cc: m.cc?.length ? m.cc : undefined,
    bcc: m.bcc?.length ? m.bcc : undefined,
    headers: m.headers,
    tags: m.tags,
  };
}

async function errorText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string };
    return j.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function sendEmail(m: OutEmail): Promise<SendResult> {
  if (!hasEmailKey()) return { ok: false, error: "E-mail nije spojen (nema RESEND_API_KEY)." };
  try {
    const res = await call("/emails", payload(m));
    if (!res.ok) return { ok: false, error: await errorText(res) };
    const j = (await res.json()) as { id: string };
    return { ok: true, id: j.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Do 100 poruka jednim pozivom (Resend batch). Vraća rezultat po poruci, istim redom. */
export async function sendBatch(list: OutEmail[]): Promise<SendResult[]> {
  if (!list.length) return [];
  if (!hasEmailKey()) return list.map(() => ({ ok: false, error: "E-mail nije spojen (nema RESEND_API_KEY)." }));
  const out: SendResult[] = [];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    try {
      const res = await call("/emails/batch", chunk.map(payload));
      if (!res.ok) {
        const err = await errorText(res);
        out.push(...chunk.map(() => ({ ok: false as const, error: err })));
        continue;
      }
      const j = (await res.json()) as { data?: { id: string }[] };
      const ids = j.data ?? [];
      out.push(...chunk.map((_, k) => (ids[k]?.id ? { ok: true as const, id: ids[k].id } : { ok: false as const, error: "Bez potvrde." })));
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      out.push(...chunk.map(() => ({ ok: false as const, error: err })));
    }
  }
  return out;
}

/**
 * Provjera potpisa Resend webhooka (Svix): HMAC-SHA256 nad `${id}.${timestamp}.${body}`
 * ključem iz `RESEND_WEBHOOK_SECRET` (whsec_…). Odbija poruke starije od 5 min.
 */
export function verifyWebhook(body: string, h: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = h.get("svix-id");
  const ts = h.get("svix-timestamp");
  const sig = h.get("svix-signature");
  if (!secret || !id || !ts || !sig) return false;
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sig.split(" ").some((part) => {
    const [, value] = part.split(",");
    if (!value) return false;
    const got = Buffer.from(value, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

// ------------------------------------------------------------------ HTML predložak

export function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Običan tekst → HTML odlomci (prazni redovi dijele odlomke, \n postaje <br>). */
export function textToHtml(t: string): string {
  return t
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${esc(href)}" style="display:inline-block;background:#0b1f4d;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600">${esc(label)}</a></p>`;
}

/** Jednostavan, siguran okvir poruke (tablice + inline stilovi zbog Outlooka). */
export function layout(opts: { title: string; bodyHtml: string; footerHtml?: string; preheader?: string }): string {
  return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="background:#0b1f4d;color:#ffffff;padding:16px 24px;font-size:18px;font-weight:700">EU Radar</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.55">${opts.bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5">${
    opts.footerHtml ?? "IPS Konzalting d.o.o. · EU Radar"
  }</td></tr>
</table></td></tr></table></body></html>`;
}
