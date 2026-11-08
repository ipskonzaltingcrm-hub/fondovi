# EU Radar — Handoff (živi kontekst)

> **Svrha:** jedini izvor istine o projektu. Novi chat/agent prvo pročita ovaj dokument i ima potpun kontekst.
> **Održavanje:** ažurira se nakon svake značajne promjene (nova faza, nova infra, promjena odluke).
> Zadnje ažurirano: **2026-11-08**.

---

## 1. Proizvod

**EU Radar** (interni naziv projekta/repoa: `fondovi`; raniji naziv proizvoda: "JLS Radar") — web-aplikacija (SaaS)
koja na jednom mjestu objedinjuje **EU i nacionalne natječaje** (pozive na bespovratna sredstva) relevantne
za **jedinice lokalne samouprave (JLS)** u Hrvatskoj: gradove, općine, županije.

**Ključna vrijednost:** za svaki pojedini JLS pokazati **na koje se natječaje baš taj JLS može prijaviti**
(profil JLS-a + matching), uz praćenje rokova i vođenje na izvorni tekst poziva (ne samo na vijest).

**Poslovni model:** IPS Konzalting prodaje **pretplatu** JLS-ovima (gradovi/općine/županije).
Nije namijenjeno prodaji konkurentskim konzultantima. IPS = operator/superadmin; svaki JLS pretplatnik = tenant.

- Vlasnik/operator: **IPS Konzalting**
- Superadmin (vidi sve): **ams@ips-konzalting.hr**
- Jezik sučelja i komunikacije: **hrvatski**
- Planirana domena: **fondovi.ips-konzalting.hr** (još nije spojena na Vercel)

> Napomena o opsegu: jedan dizajnerski predložak spominjao je širu publiku (SME + JLS + istraživačke institucije).
> Trenutna odluka: **ostajemo fokusirani na JLS**. Širenje publike je otvoreno pitanje za kasnije (vidi §9).

---

## 2. Stack i infrastruktura

**Stack:** Next.js 16 (App Router, RSC, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase (Postgres 17 + Auth + RLS) · hosting Vercel · repo GitHub. Sve odvojeno od postojećeg "e-opg" projekta.

> ⚠️ **Next.js 16 ima breaking changes** u odnosu na starije znanje. Prije pisanja koda pročitati
> relevantni vodič u `node_modules/next/dist/docs/`. Primjer: middleware je preimenovan u **`proxy`**
> (root `proxy.ts`, export `proxy`), što ovaj projekt već koristi.

### Infrastruktura (ID-evi)
- **GitHub:** `ipskonzaltingcrm-hub/fondovi` — https://github.com/ipskonzaltingcrm-hub/fondovi · grana `main`
- **Vercel:** projekt `fondovi` = `prj_oMu8kdGWwiCnjwG0f2XYQpa8447q` · tim `team_GkIICWlRQYDUHv1V4igDAUoQ` (slug `ips-b26c`)
  - Produkcija: **https://fondovi-ips-b26c.vercel.app** (alias `fondovi-alpha.vercel.app`)
  - Git-linked auto-deploy iz `main`
  - **Vercel Deployment Protection (Vercel SSO) je UKLJUČENA** → sajt zasad vidi samo prijavljeni na Vercel
    račun (vlasnica). Pravi JLS korisnici ga ne mogu otvoriti dok se ne isključi. Odluka vlasnice: **zasad držati zaštićeno.**
    Isključuje se preko Vercel MCP `update_project` (ssoProtection) ili u dashboardu.
  - Env postavljene (sve okoline): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
    **`SUPABASE_SERVICE_ROLE_KEY` NIJE postavljen** (treba za Fazu 2 ingestion).
- **Supabase:** projekt `fondovi` = ref **`iwdxcqjpnyzeotanqfkc`** · org `tpswibtedboqcrdmagoi` (IPS konzalting) ·
  regija eu-central-1 (Frankfurt) · Postgres 17 · URL https://iwdxcqjpnyzeotanqfkc.supabase.co
  - Pro plan (svaki projekt = +$10/mj Micro compute).
- **⛔ NE DIRATI:** Supabase `uwzmorfxsyltpivqpmpq` (postojeći CRM/e-opg, eu-west-1).

### Zaostatak za čišćenje
- Stari duplikat `jls-radar` (GitHub repo + Vercel projekt `prj_EvZB93CKopOoKp8GFOvZtQhAAUIc`) od prije pivota — obrisati.

### Lokalni razvoj
- Dev server: `npm run dev` (ili preview config `.claude/launch.json` → "EU Radar (dev)", port 3000).
- Build provjera: `npm run build`.
- `.env.local` (gitignored) sadrži Supabase URL + anon key; service role key prazan.

---

## 3. Stanje po fazama

### ✅ Faza 1 — MVP ljuska + živa baza + prijava + dizajn (GOTOVO)
- App ljuska: sidebar, topbar, stranice Pregled/Natječaji/Klijenti/Izvori/Obavijesti/Postavke.
- **Živi sloj podataka** (`lib/data.ts`) čita iz Supabasea uz poštivanje RLS-a (nema više mock podataka).
- **Prijava bez lozinke preko 6–8-znamenkastog koda** (OTP) — otporno na korporativne email skenere.
- **Multitenancy + RLS** od početka; superadmin vidi sve.
- **Vizualni identitet: EU tamnoplava + zlatna** (dark kao zadano), EU logo (zvjezdice + radar).
- Seed podaci (demo): 14 natječaja, 5 JLS profila, 7 izvora, 1 tenant (ips).

### ⏳ Faza 2 — Pravi podaci + produkcijski email + domena (SLJEDEĆE, vidi §9)
- Automatsko povlačenje (ingestion/scraping) natječaja iz službenih izvora (GitHub Actions, raspored).
- Custom SMTP (slanje s `@ips-konzalting.hr` → bolja dostava, bez malog limita ugrađenog maila).
- Spajanje custom domene `fondovi.ips-konzalting.hr` + isključivanje Vercel zaštite.

### 🔜 Faza 3 — Pravi pretplatnici (kasnije)
- Pozivnice/članstvo za JLS korisnike, admin po tenantu, upravljanje JLS profilima iz UI-a.
- Naplata/pretplata (Stripe ili ručno fakturiranje + ručna aktivacija).
- Finiji matching, obavijesti (email digest) o novim pozivima i rokovima.

---

## 4. Arhitektura koda (ključne datoteke)

- `lib/data.ts` — **server sloj podataka**. Mapira DB (snake_case, hrvatski stupci) → TS tipove (camelCase).
  ⚠️ **`id` u aplikaciji = DB `slug`** (ne uuid) → stabilni URL-ovi (npr. `/pozivi/fzoeu-energetska-obnova-2026`).
  Funkcije: `getCalls`, `getCallBySlug`, `getJlsProfiles`, `getJlsBySlug`, `getSources`.
- `lib/domain.ts` — **čista** poslovna logika (bez I/O): `matchesForJls(calls, jls)`, `dashboardStats`,
  `deadlineState`, `levelLabel/statusLabel/applicantLabel`, `matchCall`.
- `lib/types.ts` — domenski tipovi (`FundingCall`, `Jls`, `IngestSource`).
- `lib/supabase/server.ts` / `client.ts` / `proxy.ts` — Supabase klijenti (@supabase/ssr, cookie-based getAll/setAll).
- `proxy.ts` (root) — Next 16 proxy (ex-middleware); štiti rute, osvježava sesiju. Public prefiksi: `/login`, `/auth`.
- `app/(app)/layout.tsx` — dohvaća usera (server), redirect `/login` ako nema; čita `is_superadmin`; prosljeđuje Topbaru.
- `app/auth/callback/route.ts` — PKCE (`?code=`) i OTP (`?token_hash=&type=`) razmjena; fallback za magic-link.
- `app/auth/signout/route.ts` — odjava (POST → signOut → /login).
- `components/auth/login-form.tsx` — dvokoračna prijava: email → kod (`verifyOtp`, 6–10 znamenki).
- `components/layout/{sidebar,topbar,logo,page-header}.tsx` — ljuska.
- `app/globals.css` — **dizajn tokeni** (vidi §7). Mijenjaj temu ovdje, ne po komponentama.

---

## 5. Baza podataka

- **Migracije** (`supabase/migrations/`), sve primijenjene na živi projekt:
  - `0001_init.sql` — 12 tablica, enumi, RLS, SECURITY DEFINER funkcije
    (`is_superadmin()`, `is_member()`, `is_tenant_admin()`), trigger `handle_new_user()`
    (postavlja `is_superadmin=true` za `lower(email)='ams@ips-konzalting.hr'`), `touch_updated_at`.
  - `0002_seed.sql` — demo podaci (tenant `ips`, 7 izvora, 5 jls_profiles, 14 calls).
  - `0003_harden_functions` — učvršćivanje (search_path, revoke execute za anon) — zatvoreni security advisori.
- **RLS model:** globalni katalog (`calls`, `sources`, `call_changes`) čitljiv svim prijavljenima,
  pisanje samo superadmin. Per-tenant tablice (`jls_profiles` itd.) vidljive članovima (`is_member(tenant_id)`)
  ili superadminu (bypass).
- Novu shemu mijenjati kroz **nove migracije** (`apply_migration`), ne ad-hoc SQL-om.

---

## 6. Autentikacija (važno — poznati problemi)

- **Flow:** `signInWithOtp` šalje kod na email → korisnik upiše kod → `verifyOtp({type:'email'})` → sesija u kolačiću.
- **Zašto kod, a ne magic-link:** poslovni mail gatewayi (koje JLS-ovi imaju) imaju sigurnosne skenere koji
  automatski otvore link u mailu i **potroše token prije korisnika**. Kod se ne može "potrošiti" dohvaćanjem URL-a.
  (Potvrđeno u logovima: skener IP je trošio linkove; zato smo prešli na kod.)
- **Duljina koda:** Supabase generira **8 znamenki** (ne 6); polje prima 6–10.
- **Email predlošci (Supabase → Authentication → Emails):** moraju sadržavati `{{ .Token }}`.
  Uređeni su **Magic Link** i **Confirm signup** (naslovi "… — EU Radar"). URL varijabla se ne koristi.
- **URL Configuration (postavljeno):** Site URL `https://fondovi-ips-b26c.vercel.app`;
  Redirect URLs `https://fondovi-ips-b26c.vercel.app/**` i `http://localhost:3000/**` (dodati custom domenu kasnije).
- **Poznati blocker — email dostava:** ugrađeni Supabase email ima **vrlo nizak limit** (par/sat → "email rate limit exceeded")
  i zna ići u spam. **Rješenje = custom SMTP (Faza 2).** Do tada: slati kod jednom i čekati reset limita.
- Status: auth korisnik `ams@ips-konzalting.hr` kreiran i **jest superadmin** (potvrđeno u bazi).

---

## 7. Dizajn sustav

- **Paleta (EU identitet):** tamnoplava (EU plava) + zlatna (EU zvjezdice). **Dark je zadani izgled**;
  light je usklađena varijanta. Definirano kroz CSS tokene u `app/globals.css` (`:root` + `.dark`) i `@theme inline`.
- Ključni tokeni: `--brand` (zlatna fill), `--brand-contrast` (tamni tekst na zlatnoj),
  `--brand-ink` (zlatna/navy tekst-akcent), `--surface*`, `--border*`, semantički (`info/warning/danger/success`).
- Logo: `components/layout/logo.tsx` — EU plavi badge + prsten 12 zlatnih zvjezdica + radar sweep; "**EU** Radar".
- Font: Space Grotesk (display) + Inter (sans).
- **Pravilo:** boje i temu mijenjati isključivo kroz tokene u `globals.css`; komponente koriste tokene (npr. `bg-brand`, `text-muted`).
- Strukturu/raspored stranica **slaže vlasnica po svojoj logici** — stil (boje/logo) je odvojen od strukture.

---

## 8. Otvorene stavke / blokade

- [ ] **Custom SMTP** za email (uklanja limit + spam) — preduvjet za pravu prijavu i Fazu 2.
- [ ] **Isključiti Vercel Deployment Protection** kad se krene prema pravim korisnicima (sad namjerno uključeno).
- [ ] **Custom domena** `fondovi.ips-konzalting.hr` → Vercel + DNS + dodati u Supabase Redirect URLs.
- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** postaviti u Vercel (Faza 2 ingestion).
- [ ] Očistiti stari `jls-radar` repo + Vercel projekt.
- [ ] Odluka o širini publike (samo JLS vs. + SME/istraživačke) — vidi §1 i §9.

---

## 9. Sljedeća faza — preporuka

**Preporučeni redoslijed za Fazu 2 (prvo najkorisnije):**

1. **Custom SMTP (najprije).** Mali korak, otključava pouzdanu prijavu i buduće email obavijesti.
   Traži SMTP podatke od email providera domene `ips-konzalting.hr` (Google Workspace / Microsoft 365 / cPanel) —
   host, port, korisnik, lozinka → unijeti u Supabase → Authentication → SMTP Settings.
2. **Ingestion pravih natječaja.** Jezgra izvora za scraping (vidi §10): `eufondovi.gov.hr`, `fzoeu.hr`,
   `ruralnirazvoj.hr`, `esf.hr`, Interreg portali. Model poziva već postoji (`calls`). Raspored preko GitHub Actions
   (npr. svakih 6 h) → upis u Supabase preko service role ključa. Svaki poziv mora voditi na **izvorni dokument**.
3. **Custom domena + isključenje Vercel zaštite** → sajt dostupan pravim JLS-ovima.

Nakon toga Faza 3 (pozivnice za JLS korisnike, upravljanje profilima iz UI-a, naplata).

---

## 10. Izvori natječaja (istraživanje, 2026-11-06)

Ne postoji jedan agregator koji pokriva sve → radar ima smisla. Jezgra za scraping/praćenje:

**Središnji/službeni (jezgra):**
- https://eufondovi.gov.hr/ — središnji portal EU fondova 2021.–2027. (PKK, ITP, ULJP).
- https://fondovi.gov.hr/ — eFondovi (obvezujući tekstovi poziva, same prijave).
- https://razvoj.gov.hr/ — Min. regionalnoga razvoja i fondova EU (najave/planovi objave).
- https://planoporavka.gov.hr/ + eNPOO — NPOO (2021.–2026., u završnoj fazi → niži prioritet).

**Sektorske agencije/fondovi:**
- https://ruralnirazvoj.hr/ i https://www.apprrr.hr/ — Agencija za plaćanja; ruralni razvoj, LAG/LEADER (ruralne općine).
- https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji — FZOEU; pozivi baš za JLS
  (energetska obnova, komunalna oprema, prilagodba klimi, pametni gradovi/općine).
- https://www.esf.hr/ — ESF+ / ULJP (socijalne usluge, zapošljavanje, obrazovanje).
- https://euribarstvo.hr/ — ribarstvo (EFPRA), primorske/otočne JLS.

**Teritorijalni/regionalni:**
- Regionalne razvojne agencije (RRA) po županijama (npr. PRIGODA/PGŽ, ZADRA, IDA/Istra).
- Urbane aglomeracije/područja (ITP): Zagreb, Rijeka, Osijek, Split + urbana područja.
- Resorna ministarstva: MPGI (graditeljstvo), MINGOR (okoliš), MMPI (promet).

**Izravni EU programi:**
- Interreg: https://si-hr.eu/, https://www.italy-croatia.eu/, Interreg Europe, Središnja Europa, Jadran-Jonski.
- EU Funding & Tenders portal: https://ec.europa.eu/info/funding-tenders/opportunities/portal/ (URBACT, LIFE, CERV…).
- Kohesio (baza projekata, ne pozivi): https://kohesio.ec.europa.eu/

Filtar "JLS prihvatljiv prijavitelj" — ključne riječi: JLS, JLP(R)S, grad, općina, županija, jedinice lokalne samouprave.

---

## 11. Kako koristiti ovaj dokument

- **Novi chat:** pročitaj ovaj `docs/HANDOFF.md` prvi — daje potpun kontekst (proizvod, infra, stanje, sljedeći koraci).
- Detaljni ID-evi i "ne dirati" također su u Claude memoriji projekta (`infra-ids.md`).
- Projektni zadatak (šira specifikacija): `docs/PROJEKTNI-ZADATAK.md`. Prošireni popis izvora: `docs/IZVORI-JLS.md`.
- **Ažuriraj ovaj dokument** kad se promijeni faza, infrastruktura ili neka ključna odluka; podigni datum na vrhu.
