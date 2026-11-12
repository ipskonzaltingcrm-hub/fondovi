"use client";

import * as React from "react";
import { Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
type Status = { enabled: boolean; ime: string; pozdrav: string; kontaktOd: number };

const input =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-2 focus:border-brand focus:ring-2 focus:ring-ring/30";

/** Linkovi u odgovoru postaju klikabilni (samo http/https). */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-brand-ink underline">
            {p}
          </a>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export function ChatBox({ izvor, test, embed }: { izvor: string; test: boolean; embed: boolean }) {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [text, setText] = React.useState("");
  const [conv, setConv] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [offer, setOffer] = React.useState(false);
  const [contactOpen, setContactOpen] = React.useState(false);
  const [contactDone, setContactDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((s: Status) => setStatus(s))
      .catch(() => setStatus({ enabled: false, ime: "Ana", pozdrav: "", kontaktOd: 4 }));
  }, []);
  React.useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, contactOpen]);

  async function send() {
    const m = text.trim();
    if (!m || busy) return;
    setText("");
    setError(null);
    setMsgs((p) => [...p, { role: "user", content: m }]);
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", conversationId: conv, message: m, izvor, test }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "Greška.");
      else {
        if (d.conversationId) setConv(d.conversationId);
        if (d.unavailable) {
          setMsgs((p) => [...p, { role: "assistant", content: "AI asistent trenutno nije uključen. Ostavite kontakt i naš konzultant javit će vam se." }]);
          setContactOpen(true);
        } else if (d.reply) setMsgs((p) => [...p, { role: "assistant", content: d.reply }]);
        if (d.offerContact) setOffer(true);
      }
    } catch {
      setError("Veza nije uspjela. Pokušajte ponovno.");
    } finally {
      setBusy(false);
    }
  }

  const ime = status?.ime ?? "Ana";
  const offline = status && !status.enabled && !test;

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface", embed && "rounded-none border-0")}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-contrast">{ime[0]}</span>
        <div>
          <div className="font-display font-semibold">{ime} · EU Radar</div>
          <div className="text-xs text-muted">{test ? "Testni razgovor (ne stvara lead)" : "AI asistentica — natječaji i bespovratna sredstva"}</div>
        </div>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: embed ? undefined : 360 }}>
        {status && (
          <div className="max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm">
            {offline ? "AI asistent trenutno nije uključen. Ostavite kontakt i naš konzultant javit će vam se." : status.pozdrav}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-brand text-brand-contrast" : "bg-surface-2")}>
            {m.role === "assistant" ? <Linkify text={m.content} /> : m.content}
          </div>
        ))}
        {busy && <div className="max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">{ime} piše…</div>}
        {(offer || offline) && !contactOpen && !contactDone && (
          <Button size="sm" variant="secondary" onClick={() => setContactOpen(true)}>
            <UserRound className="h-4 w-4" /> Želim da me nazove konzultant
          </Button>
        )}
        {(contactOpen || (offline && !contactDone)) && !contactDone && (
          <ContactForm
            conv={conv}
            izvor={izvor}
            test={test}
            onDone={() => {
              setContactDone(true);
              setContactOpen(false);
            }}
          />
        )}
        {contactDone && <div className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">Hvala! Konzultant će vas nazvati u radno vrijeme.</div>}
        {error && <div className="text-sm text-danger">{error}</div>}
        <div ref={endRef} />
      </div>
      {!offline && (
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input className={input} value={text} maxLength={2000} placeholder="Npr. Koji su natječaji otvoreni za vrtiće?" onChange={(e) => setText(e.target.value)} />
          <Button type="submit" disabled={busy || !text.trim()} aria-label="Pošalji">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
      <p className="px-4 pb-3 text-[11px] text-muted-2">AI može pogriješiti; konačne uvjete natječaja provjerite u službenom tekstu.</p>
    </div>
  );
}

function ContactForm({ conv, izvor, test, onDone }: { conv: string | null; izvor: string; test: boolean; onDone: () => void }) {
  const [ime, setIme] = React.useState("");
  const [telefon, setTelefon] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [privola, setPrivola] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let id = conv;
      if (!id) {
        // Kontakt bez pitanja (asistent isključen): otvori razgovor da se kontakt ima gdje zabilježiti.
        const r0 = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "open", izvor, test }),
        });
        id = (await r0.json()).conversationId ?? null;
      }
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "contact", conversationId: id, ime, telefon, email, privola }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error ?? "Greška.");
      else onDone();
    } catch {
      setError("Veza nije uspjela.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <input className={input} placeholder="Ime i prezime" value={ime} onChange={(e) => setIme(e.target.value)} />
      <input className={input} placeholder="Telefon" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
      <input className={input} placeholder="E-mail (neobavezno)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={privola} onChange={(e) => setPrivola(e.target.checked)} className="mt-0.5" />
        Pristajem da me IPS Konzalting kontaktira u vezi s ovim upitom.
      </label>
      {error && <div className="text-xs text-danger">{error}</div>}
      <Button size="sm" disabled={busy || !ime.trim() || (!telefon.trim() && !email.trim()) || !privola} onClick={() => void submit()}>
        Pošalji kontakt
      </Button>
    </div>
  );
}
