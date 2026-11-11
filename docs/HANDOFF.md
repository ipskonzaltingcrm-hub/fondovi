# EU Radar — Handoff (živi kontekst)

> **Svrha:** jedini izvor istine o projektu. Novi chat/agent prvo pročita ovaj dokument i ima potpun kontekst.
> **Održavanje:** ažurira se nakon svake značajne promjene (nova faza, nova infra, promjena odluke).
> Zadnje ažurirano: **2026-11-11** (**EU Radar CRM — Faza 0 gotova**: `/crm`, uloge tima, Tim i uloge, Sigurnost, Dnevnik izmjena; **sigurnosna zakrpa `profiles`** — vidi §13).

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

> **Opseg (ažurirano 2026-11-09): TRI vrste pretplatnika/klijenata** — (1) JLS (gradovi/općine/županije),
> (2) **poduzeća** (SME + velika), (3) **znanstveno-istraživačke institucije** (fakulteti/instituti).
> Ingestion i matching pokrivaju sve tri skupine (`prihvatljivi` uključuje `tvrtka` i `ustanova`).
> Faza C (klijenti) → profil klijenta ima **tip** (JLS / poduzeće / institucija).

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
  - **Produkcija je JAVNA (od 2026-11-10, odluka vlasnice):** Vercel SSO zaštita sužena na `deploymentType: "preview"` —
    produkcijski URL svatko može otvoriti (vidi stranicu za prijavu), preview deployi ostaju zaštićeni.
    Mijenja se preko Vercel MCP `update_project` (ssoProtection) ili u dashboardu.
    ⚠️ Prijava je otvorena (`shouldCreateUser: true`) — svatko s linkom može napraviti račun i vidjeti katalog natječaja
    (klijenti su zaštićeni RLS-om). Prije pravih pretplatnika odlučiti o pozivnicama / ograničenju registracije.
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

### ⏳ Faza 2 — Pravi podaci + produkcijski email + domena (U TIJEKU, vidi §9 i §12)
- **Ingestion (GOTOVO, prošireno na 3 skupine):** ✅ framework + raspored + **9 adaptera** → **201 poziv** u bazi.
  Pokrivenost: JLS ~66, poduzeća ~180, institucije ~37. Demo seed očišćen (jls_profiles ostavljeni za demo matchinga).
  - Po izvoru: ruralnirazvoj 55, euribarstvo 42, FZOEU 29, SEDIA 28, HAMAG-BICRO 22, eufondovi 12, esf 10, HRZZ 3, interreg-si-hr 0*.
  - **SEDIA (EU F&T)** — `global`, **GitHub Actions**, dnevno ~07h. Filtar: lokalne vlasti + SME + istraživanje (~300 → dedup ~40).
  - **8 HR izvora** — `hr`, **Vercel Cron** (`/api/ingest`), dnevno ~07h. Ručni test (?key) uspješan.
    (*interreg: si-hr.eu u maintenanceu → 0; hvata 2 poziva kad proradi.)
  - Novi izvori za proširene skupine: **HAMAG-BICRO** (SME/inovacije), **HRZZ** (znanstveni projekti).
  - Vercel env `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET` postavljeni.
  - **GEO-IP (ispravka):** blokada NIJE čisto geografska — HR portali blokiraju **GitHub/Azure IP-eve**, ali **Vercelovi
    IP-evi prolaze** (test se izvršio u iad1/US i uspio). Zato: SEDIA→GitHub, HR izvori→Vercel. `egress` razdvajanje stoji.
    (Pozor: pretjerano lokalno testiranje ruralnirazvoj.hr može okinuti privremenu blokadu tvog HR IP-a; u produkciji 1×/6h — nije problem.)
- ✅ Custom SMTP (Resend, poddomena `radar.ips-konzalting.hr`) — vidi §6.
- Spajanje custom domene `fondovi.ips-konzalting.hr` + isključivanje Vercel zaštite.

### ✅ Faza B — Matching po JLS (GOTOVO)
- `scripts/ingest/classify.ts` iz teksta (naslov+sažetak+program) + izvora izvodi **`sektori`**
  (rječnik JLS profila, HR+EN) i **`prihvatljivi`** (grad/opcina/zupanija/lag/ustanova/tvrtka/ngo).
  Ruralni/ribarstvo → JLS samo za infrastrukturu, inače gospodarstvo; javni-sektor izvori → JLS.
- Ugrađeno u `toCallRow`; svi pozivi u bazi obogaćeni. Matching (`lib/domain.ts matchesForJls`) sad radi:
  po demo JLS-u 63–66 prihvatljivih poziva, 5–14 otvorenih s preklapanjem sektora.
- Heuristika (prihvatljivost iz naslova je približna — za točno vrijedi tekst poziva); profinjivanje po potrebi kasnije.

### ✅ Faza C — Upravljanje klijentima (GOTOVO)
- Migracija 0004: `klijent_tip` enum (jls/poduzece/institucija) + `velicina`; `tip` (grad/opcina/zupanija) nullable.
- Model (`Jls` → ima `tipKlijenta`), data layer i matching generalizirani: `applicantTypesForClient`
  (poduzeće→tvrtka, institucija→ustanova, JLS→grad/opcina/zupanija).
- UI: popis klijenata grupiran po tipu (JLS/poduzeća/institucije) s oznakama; detalj klijenta prikazuje
  atribute ovisno o tipu; **unos klijenta** `/klijenti/novi` (forma + server akcija `createKlijent`,
  provjera superadmina → service-role upis tenant+profil u `lib/supabase/admin.ts`).
- 2 demo klijenta (poduzeće, institucija) uz demo JLS-ove. Napomena: unos/prijava se mogu testirati tek nakon SMTP-a (prijava).

### ✅ Dodatne funkcije (2026-11-10)
- **Natječaji — pretraga + filtri** (`components/pozivi/calls-explorer.tsx`): tekst, status, razina, **sektor**,
  **prijavitelj za sve tipove** (gradovi/općine/županije/LAG/poduzeća/institucije/udruge), sortiranje.
- **Izvještaj po klijentu**: `/izvjestaj/[id]` — brendiran, printabilan (Ispis → Spremi kao PDF) popis natječaja
  na koje se klijent može prijaviti (rangirano); `/izvjestaj/[id]/csv` — CSV izvoz (Excel). Gumb na profilu klijenta.
  Alat za IPS-ovu prodaju/isporuku.

### 🔜 Otvoreno / sljedeće
- ✅ **SMTP** riješen (2026-11-10): Resend → Supabase custom SMTP; testni kod stigao u inbox. Prijava radi na
  produkcijskom URL-u, koji je od 2026-11-10 javno dostupan.
- Custom domena `fondovi.ips-konzalting.hr`.
- Moguće dalje: Obavijesti (novi + rokovi), Praćenje (watchlist), email-digest (ovisi o SMTP-u), deduplikacija poziva.

### 🔜 Faza 3+ — Pravi pretplatnici (kasnije)
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
    (Datoteka je 2026-11-11 vraćena u repo iz `supabase_migrations.schema_migrations`.)
  - `0004_klijent_tip` — tip klijenta (jls/poduzece/institucija).
  - `0005_zakrpa_profiles` — **sigurnosna zakrpa** (2026-11-11): korisnik smije mijenjati samo `profiles.full_name`.
  - `0006_crm_temelj` — EU Radar CRM Faza 0 (uloge tima, pozivnice, dnevnik, prijave) — vidi §13.
  - `0007_revoke_public_helpers` — `is_superadmin/is_member/is_tenant_admin` samo za prijavljene (advisor 0028).
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
- **Email dostava — custom SMTP (RIJEŠENO 2026-11-10):** Resend (EU regija) na **poddomeni `radar.ips-konzalting.hr`**.
  - Supabase SMTP: host `smtp.resend.com`, port `465`, user `resend`, pass = Resend API ključ (samo u Supabaseu, nigdje u repou),
    pošiljatelj `EU Radar <no-reply@radar.ips-konzalting.hr>`. Rate limit slanja podignut s 2/h na 30/h.
  - Cloudflare DNS (zona `ips-konzalting.hr`) — dodana SAMO 3 nova zapisa: TXT `resend._domainkey.radar` (DKIM),
    CNAME `send.radar` i `rsend.radar` (→ `*.forge.rmta.net`, **DNS only**).
  - **DMARC namjerno NIJE dodan:** Resend ga nudi na rootu (`_dmarc`), a to bi diralo M365. Ako zatreba (spam),
    dodati izolirano kao `_dmarc.radar` (`v=DMARC1; p=none;`).
  - ⛔ **M365 pošta IPS-a je kritična — ne dirati** root MX/SPF, `selector1/2._domainkey`, autodiscover i ostale M365 zapise.
  - Ostaci starog pokušaja s MailerSendom (`litesrv._domainkey`, pogrešno Proxied) — nekorišteno, može se počistiti.
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

- [x] **Custom SMTP** za email — Resend, `radar.ips-konzalting.hr` (2026-11-10).
- [ ] **Selidba na novu tvrtku (kad bude osnovana):** novi Supabase (pustiti migracije + prebaciti podatke),
  novi Vercel (spojiti repo, prepisati env), GitHub transfer po želji. Do tada sve radimo ovdje.
  Uz selidbu: ažurirati Supabase Site/Redirect URL-ove i ponovno upisati SMTP postavke u novi Supabase.
- [x] **Vercel Deployment Protection** isključena za produkciju (2026-11-10); preview ostaje zaštićen.
- [ ] **Ograničiti registraciju** (pozivnice / allowlist) prije pravih pretplatnika — sad se može prijaviti bilo koji email.
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

---

## 12. Ingestion (automatsko povlačenje natječaja)

**Kod:** `scripts/ingest/` · **raspored:** `.github/workflows/ingest.yml` (cron svakih 6 h + ručno).

### Arhitektura
- `types.ts` — `RawCall` (što adapter vrati) i `SourceAdapter` (ugovor izvora).
- `util.ts` — `slugify`, `parseDate` (ISO + HR "dd.mm.yyyy" i "13. 10. 2026"), `statusFromDeadline`,
  `contentHash` (sha1 nad značajnim poljima), `toCallRow`, `httpGet` (timeout + pristojan User-Agent).
- `supabase.ts` — **service-role** klijent (zaobilazi RLS; samo CI/lokalno, nikad u pregledniku).
- `run.ts` — za svaki adapter: `ensureSource` → `fetchCalls` → normaliziraj → **upsert po `slug`** →
  promjene (`status/rok_prijave/iznos_max/naslov`) u `call_changes` → ažuriraj `sources`
  (`zadnje_povlacenje`, `poziva_ukupno`, `status`). Greška jednog izvora ne ruši ostale.
- `sources/index.ts` — registar adaptera.

### Dodavanje novog izvora
1. Napravi `scripts/ingest/sources/<slug>.ts` koji izvozi `SourceAdapter` s `fetchCalls()`.
2. `slug` mora odgovarati `sources.slug` u bazi (postojeći: `esf`, `eufondovi`, `euribarstvo`,
   `fzoeu`, `interreg-si-hr`, `razvoj-gov`, `ruralnirazvoj`).
3. Uvezi ga u `sources/index.ts`.
4. `npm run typecheck:ingest`; po potrebi test parse pa `npm run ingest`.

### Pokretanje i egress (gdje se vrti)
- Svaki adapter ima `egress`: **`global`** (dostupno s GitHub IP-a) ili **`hr`** (treba HR/EU IP).
  `run.ts` filtrira po env `INGEST_EGRESS` (nije postavljen → svi izvori).
- **GitHub Actions** (`.github/workflows/ingest.yml`, cron `0 6 * * *` = dnevno ~07h) postavlja `INGEST_EGRESS=global` → SEDIA i druge globalne.
- **HR izvori** (`egress: "hr"`) se NE mogu vrtjeti s GitHuba (geo-IP) → **Vercel Cron u regiji fra1 (Frankfurt)**.
  ✅ RADI: Next API ruta `app/api/ingest/route.ts` (`runtime nodejs`, egress='hr', zaštita `CRON_SECRET`;
  prihvaća i `?key=<CRON_SECRET>` za ručni/test poziv) + `vercel.json` cron (`/api/ingest`, `5 6 * * *` = dnevno ~07h) + proxy pušta `/api`.
  Vercel env postavljeni. Ručni test (preko `?key`) uspješan: fetched 55+29, 0 grešaka, izvori označeni `aktivan`.
  NAPOMENA: `preferredRegion 'fra1'` se nije primijenio (izvršilo se u iad1) — nebitno jer Vercelov IP prolazi.
  Ručno pokretanje: Vercel → Crons → Run, ili GET `/api/ingest?key=<CRON_SECRET>`.
- Lokalno: u `.env.local` dodaj `SUPABASE_SERVICE_ROLE_KEY=…` pa `npm run ingest` (ili `INGEST_EGRESS=global npm run ingest`).
- Ključ = Supabase → Settings → API Keys → **Secret keys** → `sb_secret_...` (novi naziv za service_role; TAJNO).

### Feasibility izvora (recon 2026-11-08) — redoslijed implementacije
1. **ruralnirazvoj.hr** ✅ ADAPTER GOTOVO (`egress: hr`) — statični HTML, čist (naslov/status/datum/rok). Nacionalni, ruralni (općine/LAG).
   Automatika čeka Vercel fra1 (geo-IP).
2. **EU F&T (SEDIA)** ✅ ADAPTER GOTOVO (`egress: global`, GitHub automatika radi) — jedini pravi JSON API:
   `POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA&text=<upit>` s form-partom `query` (Elasticsearch bool).
   ⚠️ NE slati `languages` part (ruši u 500); **`connection: close`** zaglavlje (undici keep-alive assert); dedupe po `callIdentifier`.
   `type` 1=grants, status 31094501=Forthcoming/502=Open/503=Closed. `metadata.links[].startDate/endDate` = epoch-ms (objava/rok).
   `frameworkProgramme` je samo ŠIFRA (ne ime). Filtrirano na JLS-relevantno preko `text` (lokalne vlasti/gradovi) → ~14 poziva. EU-opseg.
3. **APPRRR (apprrr.hr)** — WP+Elementor HTML (REST ne daje pozive), Open/Closed filter + datumi.
4. **FZOEU** ✅ ADAPTER GOTOVO (`egress: hr`) — akordeon HTML na `/hr/nacionalni-javni-pozivi-i-natjecaji/1367`;
   parsira naslov/status/datum objave + link (nid). **Rok NIJE u listi** (u PDF-u poziva) → `rok_prijave` ostaje prazan.
   Najviše JLS-relevantnih poziva (energetska obnova, komunalno). 29 poziva.
5. **ESF+ (esf.hr)** — HTML lista OK, ali sadržaj zastario/preklapa se s eufondovi. Nizak prioritet.
6. **eufondovi.gov.hr** — WP REST lako dohvatljiv, ali pozivi zakopani kao vijesti (bez call-typea,
   rok/ref u tekstu) → keyword-filter + regex. Najmjerodavniji nacionalni, ali najteži za čist unos.

> Napomena o JLS-relevantnosti: ruralni razvoj je djelomično JLS (ruralna infrastruktura, LAG/LEADER);
> dio poziva cilja OPG/poljoprivrednike. Jezgra JLS vrijednosti je u **FZOEU** i **eufondovi (ITP/urbano)**.
> `prihvatljivi` se iz liste ne može pouzdano iščitati → zasad prazno; profinjivanje matchinga kasnije.

---

## 13. EU Radar CRM (interni CRM tima) — od 2026-11-11

**Odluka vlasnice (2026-11-11):** interni CRM po uzoru na IPS Hub (IPS CRM), **unutar ove aplikacije** (`/crm`)
i na **istoj bazi `fondovi`** — klijent u CRM-u je isti zapis kao EU Radar klijent (`tenants` + `jls_profiles`),
natječaji su `calls`. Potpuno odvojeno od IPS CRM-a: nikakva veza s bazom `uwzmorfxsyltpivqpmpq`, nikakav uvoz
IPS podataka. Kod IPS Huba (`C:\Users\ams\Claude code\CRM\ips-crm`) smije služiti kao predložak (kopija koda).
Kasnije vlastita domena (npr. `crm.radar.ips-konzalting.hr` → `/crm` preko proxyja, kao portal u IPS Hubu).

**23 kartice** (iz PDF-a „IPS Hub — kartice izbornika“), raspored u `lib/crm/nav.ts` (polje `phase`, `live`):
- Faza 0 ✅ temelj: uloge, ljuska, **Tim i uloge**, **Sigurnost**, **Dnevnik izmjena**.
- Faza 1: Klijenti (= EU Radar klijenti), Leadovi, Zadaci, Moj dan, Hot leadovi, Hot pregled.
- Faza 2: Natječaji (CRM pogled na `calls`), EU Filter, Projekti i prijave.
- Faza 3: Ponude, JLS prodaja, Upitnici, Prodajni monitoring, Prodajni official.
- Faza 4: Korisnici portala (korisnici EU Radara, pretplate, **zatvaranje otvorene registracije**), Poruke i newsletter, naplata.
- Faza 5: Chatbot brain, Trošak AI-ja, Fiksni troškovi, 2FA, Postavke (prave, ne prototip).
- Pipeline namjerno izostavljen dok ga vlasnica ne zatraži. Svaka faza završava izvještajem i pregledom vlasnice.

### Model uloga (migracija `0006_crm_temelj`)
- Tim = `profiles.staff_role` (`superadmin|admin|konzultant|suradnik`) + `staff_active`; klijenti imaju `staff_role = null`.
- Superadmin je samo vlasnica (postavlja `handle_new_user` za ams@ i update postojećeg profila); ne dodjeljuje se pozivnicom.
- Pomoćne funkcije: `crm_role()`, `is_staff()`, `is_crm_admin()`; politika `profiles_staff_read` (tim vidi profile tima).
- **Sve izmjene uloga isključivo kroz SECURITY DEFINER RPC-ove** s provjerama: `crm_invite`, `crm_revoke_invitation`,
  `crm_invitation_info`, `crm_accept_invitation`, `crm_update_member` (nitko ne mijenja vlastitu ulogu; admin ne dira
  admine ni superadmina; deaktivacija briše `auth.sessions`), `crm_sign_out_member`.
- Pozivnica: `crm_invitations` (token 64 hex, 7 dana). Admin dobije poveznicu `/crm/pozivnica?token=…` i **sam je pošalje**
  (e-mail se ne šalje automatski). Pozvani se prijavi kodom **istom adresom** i klikne „Prihvati pozivnicu“.
  Proxy sada čuva query u `?next=` i prijava vraća na `next` (samo lokalne putanje).
- Dnevnik: `crm_audit_log` (čita samo admin; pišu samo okidači/funkcije). Okidač `crm_audit_row` na `tenants`,
  `jls_profiles`, `profiles`, `crm_invitations` (diff `{"polje":[staro,novo]}`, bez `token`). `crm_log` za pregled/izvoz
  (pregled istog zapisa unutar 10 min jednom). Upis preko service-role ključa (npr. `createKlijent`) bilježi se kao „Sustav / servis“.
- Prijave: `crm_sessions` (po `session_id` iz JWT-a), `crm_touch_session` iz CRM layouta; `crm_session_list`, `crm_team_security`.

### Kod
- `app/crm/(radni)/layout.tsx` — zaštita (`requireStaff` → `/crm/bez-pristupa`), bilježenje sesije, ljuska.
- `app/crm/(radni)/page.tsx` — početna (karta faza; „Moj dan“ dolazi u Fazi 1); `[...kartica]/page.tsx` — „uskoro“ za kartice iz kasnijih faza.
- `app/crm/(radni)/{tim,sigurnost,dnevnik}/` — kartice Faze 0 (page.tsx server, *-view.tsx klijent, actions.ts).
- `app/crm/pozivnica/`, `app/crm/bez-pristupa/` — izvan zaštićene grupe.
- `lib/crm/{session,roles,nav,format}.ts`, `components/crm/{crm-sidebar,crm-topbar,ui}.tsx`.
- EU Radar topbar: članovi tima imaju „Otvori CRM“.
- Obrasci (kao IPS Hub): čitanje u server `page.tsx`, pisanje kroz server akcije koje zovu RPC (RLS/provjere u bazi),
  `ActionResult`, poruke grešaka iz baze na hrvatskom (`dbMessage`). Nakon promjena ruta: `npx next typegen`.

### Provjereno (2026-11-11)
- tsc, eslint, `npm run build` prolaze.
- Logika u bazi testirana simulacijom korisnika u poništenoj transakciji (14 provjera: pozivnica, ponovno prihvaćanje,
  konzultant ne poziva, nema samopromocije, superadmin nedodirljiv, deaktivacija, vidljivost dnevnika i profila).
- Preusmjeravanje bez prijave čuva token pozivnice. Prikaz stranica nakon prijave nije provjeren automatski
  (prijava traži kod iz vlasničinog e-maila).

### Sigurnosna zakrpa (2026-11-11)
- Od početka je pravilo `profiles_upd` + ovlast UPDATE nad svim stupcima dopuštalo svakom prijavljenom korisniku
  da sam sebi postavi `is_superadmin = true`. Nakon javnog otvaranja produkcije (2026-11-10) to je bilo iskoristivo.
  Provjereno: nitko nije iskoristio (superadmin samo ams@). Zakrpa `0005_zakrpa_profiles` (korisnik mijenja samo `full_name`).
- Otvoreno: registracija je i dalje otvorena svima (`shouldCreateUser: true`) — rješava se u Fazi 4 (Korisnici portala).
