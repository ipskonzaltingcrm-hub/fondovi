# JLS Radar — Projektni zadatak

> Radar EU natječaja i poticaja za jedinice lokalne samouprave (gradovi, općine, županije)
> Multitenant SaaS · GitHub + Supabase + Vercel · poddomena `fondovi.ips-konzalting.hr`
> Verzija dokumenta: v1.0 · Datum: 2026-11-06 · Status: **prijedlog za usvajanje**

---

## 0. Sažetak (TL;DR)

**JLS Radar** je web-aplikacija koja na jednom mjestu objedinjuje sve natječaje i pozive za
bespovratna sredstva i poticaje relevantne za jedinice lokalne samouprave (JLS) u Hrvatskoj —
na **lokalnoj, regionalnoj, nacionalnoj i EU razini**. Automatski prati ključne službene izvore,
filtrira pozive gdje su JLS prihvatljivi prijavitelji, vodi na **izvorni tekst poziva** (ne na vijest),
i daje timu alat za praćenje rokova, dodjelu zaduženja i obavijesti.

Aplikacija je **multitenant**: jedna instalacija poslužuje više organizacija (IPS Konzalting kao
matični tenant + budući klijenti — pojedini gradovi/općine/županije ili druge konzultantske kuće).
Katalog natječaja je **zajednički (globalni)** za sve; svaki tenant povrh njega gradi vlastiti
radni tok (praćenja, bilješke, zadaci, obavijesti). Superadmin: **ams@ips-konzalting.hr**.

Cilj kvalitete: SaaS razine svjetskih rješenja — čist, brz, pristupačan (WCAG AA) i vizualno
prepoznatljiv u IPS bojama. Cijeli stack u **besplatnim razinama** (free tier) za start.

Prvi korak nakon usvajanja ovog dokumenta: **lokalni frontend (Faza 0)** s dizajnom i mock
podacima — da zajedno vidimo izgled prije spajanja na backend.

---

## 1. Ciljevi i mjerila uspjeha

| # | Cilj | Mjerilo uspjeha |
|---|------|-----------------|
| C1 | Jedno mjesto za sve relevantne pozive za JLS | ≥ 6 ključnih izvora automatski praćeno |
| C2 | Nikad propušten rok | Obavijest o novom pozivu i o isteku roka (email + dashboard) |
| C3 | Brz dolazak do izvornog dokumenta | Svaki poziv vodi na izvorni URL poziva, ne na vijest |
| C4 | Timski rad | Dodjela zaduženja, bilješke, statusi unutar tenanta |
| C5 | Multitenant SaaS | Više organizacija, izolacija podataka (RLS), role i dozvole |
| C6 | Svjetska razina izrade | Lighthouse ≥ 95, WCAG AA, < 1 s učitavanje liste, moderan UI |

**Nije cilj (za sada / izvan opsega MVP-a):** sam proces online-prijave na natječaj,
knjigovodstvo projekta, javni registar za građane. Ostaje kao moguće buduće proširenje.

---

## 2. Korisnici i uloge

**Persone**
- **Konzultant (IPS)** — svakodnevno prati pozive, filtrira po JLS/tematici, dodjeljuje zaduženja kolegama, priprema klijentu pregled prilika.
- **Voditelj / tenant admin** — upravlja korisnicima svoje organizacije, postavlja filtere i obavijesti na razini tima.
- **Klijent (JLS)** — opcijski, kasniji scenarij: grad/općina dobiva svoj pogled na relevantne pozive.
- **Superadmin (ams@ips-konzalting.hr)** — upravlja izvorima, globalnim katalogom, tenantima i korisnicima; vidi sve.

**Model uloga (role)**

| Uloga | Doseg | Ključne ovlasti |
|-------|-------|-----------------|
| `superadmin` | cijela platforma | izvori, scraping, globalni katalog, tenanti, svi korisnici |
| `tenant_admin` | jedan tenant | korisnici tenanta, timski filteri, obavijesti, postavke |
| `member` | jedan tenant | praćenja, bilješke, zadaci, osobni filteri |
| `viewer` | jedan tenant | samo pregled (read-only) |

---

## 3. Model multitenancy-ja

> **Poslovni model (potvrđeno):** IPS Konzalting prodaje **pretplatu (subscription)** na JLS Radar
> jedinicama lokalne samouprave. Svaki **JLS pretplatnik = tenant**. Dodatna srž vrijednosti: IPS
> konzultant za svaki razgovor s konkretnim JLS-om odmah vidi **na koje se natječaje baš taj JLS
> može prijaviti** (matching poziva prema profilu JLS-a). Drugim konzultantima (konkurencija) se ne prodaje.

- **Tenant = organizacija.** Operator/matični tenant: *IPS Konzalting* (superadmin). Pretplatnici: pojedini JLS-ovi.
- **Profil JLS-a** (tip: grad/općina/županija, županija, broj stanovnika, ruralno/urbano, LAG, sektori interesa)
  koristi se za **matching** — rangiranje i filtriranje poziva po prihvatljivosti baš za taj JLS.
- **Multitenancy od starta** (potvrđeno): shema i RLS odmah predviđaju više tenanata, ne naknadno.
- **Zajednička shema + `tenant_id` + Row Level Security (RLS)** u Supabaseu. Svaki red radnog toka
  nosi `tenant_id`; RLS politika osigurava da korisnik vidi samo podatke svog tenanta.
- **Katalog natječaja je globalan** (nema `tenant_id`) — scrape-a se jednom, vidljiv svima.
  Per-tenant su: praćenja, spremljeni filteri, bilješke, zadaci, obavijesti, korisnici.
- **Rezolucija tenanta (MVP):** nakon prijave — korisnik pripada tenantu (tablica `memberships`).
  Jedan korisnik može kasnije pripadati i više tenanata (prebacivanje organizacije u sučelju).
- **Poddomene po tenantu** (npr. `grad-x.fondovi.ips-konzalting.hr`) — opcija za kasnije; u MVP-u
  jedna aplikacija na `fondovi.ips-konzalting.hr` s rezolucijom tenanta nakon logina.

---

## 4. Tehnička arhitektura

```
                 ┌───────────────────────────────────────────────┐
   Korisnik ───▶ │  Vercel  ·  Next.js 15 (App Router, RSC, TS)   │
  (preglednik)   │  fondovi.ips-konzalting.hr                       │
                 └───────────────┬───────────────────────────────┘
                                 │ Supabase JS (Auth + RLS)
                                 ▼
                 ┌───────────────────────────────────────────────┐
                 │  Supabase  ·  Postgres · Auth · Storage · RLS  │
                 │  globalni katalog poziva + per-tenant podaci   │
                 └───────────────┬───────────────────────────────┘
                                 ▲ service role (upis)
                                 │
                 ┌───────────────┴───────────────────────────────┐
                 │  GitHub Actions (cron)  ·  Scraperi / ingestion│
                 │  eufondovi, fzoeu, ruralnirazvoj, esf, Interreg│
                 └───────────────────────────────────────────────┘
```

**Preporučeni stack (odluke seniora, uz obrazloženje)**

| Sloj | Izbor | Zašto |
|------|-------|-------|
| Frontend | **Next.js 15** (App Router, React Server Components), **TypeScript** | industrijski standard, native na Vercelu, SSR za brzinu i SEO landinga |
| UI | **Tailwind CSS v4 + shadcn/ui + Lucide ikone + Framer Motion** | brz, konzistentan dizajn-sustav; vlastiti tokeni u IPS bojama |
| Baza / Auth | **Supabase** (Postgres, Auth, RLS, Storage, Edge Functions) | besplatan start, Postgres + RLS idealan za multitenancy |
| Hosting | **Vercel** | native Next.js, besplatan start, automatski deploy iz GitHuba |
| Ingestion | **GitHub Actions (scheduled)** + Supabase service role | štedi Vercel/Supabase kvote; besplatne minute; Playwright/Cheerio po potrebi |
| AI (kasnije) | **Claude API** (Opus/Sonnet) | sažeci poziva, klasifikacija prihvatljivosti JLS, semantičko pretraživanje |
| Repo / CI | **GitHub** | izvor istine; Vercel + Actions se vežu na repo |

> **Napomena o schedulingu:** umjesto Vercel Cron / Supabase pg_cron (koji troše ograničene free
> kvote), ingestion vrte **GitHub Actions** po rasporedu (npr. svakih 6 h) i upisuju u Supabase
> preko service-role ključa. To čuva besplatne razine Vercela i Supabasea za samu aplikaciju.

---

## 5. Model podataka (jezgra)

**Globalno (zajedničko svim tenantima)**
- `sources` — izvor: naziv, URL, tip (RSS/HTML/API), raspored, selektori/parser, zadnje povlačenje.
- `calls` (**poziv/natječaj** — središnji entitet):
  `naslov`, `davatelj`, `program` (PKK/ITP/ULJP/NPOO/FZOEU/EAFRD/EFPRA/Interreg…),
  `razina` (lokalna/regionalna/nacionalna/EU), `source_id`, `url_izvornog_poziva`,
  `status` (najava/otvoren/zatvoren), `datum_objave`, `rok_prijave`,
  `iznos_min`, `iznos_max`, `ukupna_alokacija`, `intenzitet_potpore`,
  `prihvatljivi_prijavitelji` (oznake: JLS, grad, općina, županija, LAG…),
  `sektor`/`tematika` (oznake), `sazetak`, `content_hash` (detekcija promjena), `created_at`, `updated_at`.
- `call_changes` — povijest promjena poziva (rok, alokacija, status).

**Per-tenant (pod RLS-om, nosi `tenant_id`)**
- `tenants` (JLS pretplatnik ili IPS operator), `memberships` (user ↔ tenant ↔ role), `profiles`.
- `jls_profile` — profil JLS-a: tip (grad/općina/županija), županija, broj stanovnika, ruralno/urbano,
  LAG, sektori interesa → ulaz za **matching** poziva.
- `call_match` (izvedeno) — ocjena prihvatljivosti/relevantnosti poziva za dani JLS profil.
- `watchlist` — praćeni pozivi + status internog praćenja (zainteresirani / u pripremi / odbačeno).
- `saved_filters` — spremljeni filteri (osobni i timski).
- `notes` — bilješke uz poziv.
- `assignments` — tko od tima prati/priprema koji poziv.
- `notification_settings` + `notifications` — pravila i log obavijesti.

---

## 6. Izvori i ingestion (iz istraživanja u HANDOFF.md)

> **Prošireni katalog izvora:** vidi [`IZVORI-JLS.md`](IZVORI-JLS.md) — ~20 dodatnih izvora
> (Fond za sufinanciranje EU projekata na lokalnoj razini, Hrvatske vode, MPGI, MINTS, Min. kulture,
> županijski pozivi, EUCF, EEA/Norway, Švicarski program …), kategorizirano s prioritetima i statusom.

**Jezgra za automatsko praćenje (prioritet):**
`eufondovi.gov.hr` · `fzoeu.hr` (nacionalni pozivi baš za JLS) · `ruralnirazvoj.hr` / `apprrr.hr`
(LAG/LEADER, ruralne općine) · `esf.hr` (ULJP) · Interreg portali (`si-hr.eu`, `italy-croatia.eu`).

**Dodatno / regionalno:** `razvoj.gov.hr` (najave), RRA po županijama (PRIGODA, ZADRA, IDA…),
urbane aglomeracije (ITP: Zagreb, Rijeka, Osijek, Split), `euribarstvo.hr`, EU Funding & Tenders portal.
NPOO (`planoporavka.gov.hr`) — niži prioritet (u završnoj fazi).

**Pipeline:** povuci listu → parsiraj → normaliziraj na model `calls` → dedupliciraj (po URL-u/hashu)
→ detektiraj promjene → označi JLS-prihvatljivost → spremi + logiraj. Svaki izvor dobiva vlastiti
parser/adapter; dodavanje novog izvora = novi adapter + zapis u `sources`.

---

## 7. Dizajn-sustav (IPS identitet)

**Boje (izvučene s www.ips-konzalting.hr):**

| Token | Hex | Uloga |
|-------|-----|-------|
| `ink` | `#181818` | primarni tekst / tamna pozadina |
| `brand` (primarna zelena) | `#72A335` | glavni naglasak, CTA, aktivna stanja |
| `brand-deep` (šumska zelena) | `#457B43` | sekundarna, dubina, hover |
| `brand-bright` | `#6EBD40` | success / pozitivni signali |
| `info` | `#1863DC` | poveznice / informativni naglasak (štedljivo) |
| `surface` | `#FFFFFF` + neutralne sive | pozadine, kartice, obrubi |

Puni set tokena (uključujući statusne boje za rok: *otvoren / ističe / zatvoren*) definira se u
Fazi 0, sa svijetlom i tamnom temom.

**Tipografija (prijedlog):** display/naslovi — **Space Grotesk** (moderan, tehnički karakter);
tekst/UI — **Inter**; brojevi i rokovi — tabularne znamenke. Sve besplatno (Google Fonts / Fontshare).

**Vizualni jezik:** čist, podatkovno-gust ali zračan; kartice i tablice poziva s jasnim statusnim
oznakama; suptilne animacije (Framer Motion); dosljedan, pristupačan (WCAG AA) kontrast.

---

## 8. Faze projekta

> Svaka faza ima **cilj**, **isporuke** i **definiciju gotovog (DoD)**. Faze se isporučuju redom;
> nakon svake je točka pregleda. Procjene su okvirne (aktivni rad, ne kalendarski dani).

### Faza 0 — Temelji i lokalni frontend  *(prvi korak nakon usvajanja)*
**Cilj:** vidjeti izgled i osjećaj aplikacije lokalno, prije ikakvog backenda.
**Isporuke:**
- Inicijalizacija repo-a (Next.js 15 + TS + Tailwind + shadcn/ui), struktura projekta.
- Dizajn-sustav: IPS tokeni boja, tipografija, osnovne komponente, svijetla/tamna tema.
- Ključni ekrani s **mock podacima (JSON)**: Dashboard, Lista poziva (filteri, pretraga, oznake,
  statusi rokova), Detalj poziva (s poveznicom na izvor), skica Login/Onboarding, skica Admin (izvori).
- Responzivno (desktop + mobilno), pokretanje lokalno (`npm run dev`) za zajednički pregled.
**DoD:** aplikacija se vrti lokalno, klikabilni glavni tokovi na mock podacima, dizajn usuglašen.

### Faza 1 — Infrastruktura i multitenancy
**Cilj:** stvarni backend, sigurnost, produkcijska poddomena.
**Isporuke:** Supabase projekt (shema, RLS, politike), Supabase Auth (email + magic link), uloge,
**superadmin ams@ips-konzalting.hr**, povezivanje frontenda na stvarne podatke (ručno unesen uzorak),
Vercel deploy + GitHub CI/CD, DNS i poddomena `fondovi.ips-konzalting.hr`.
**DoD:** prijava radi, tenant-izolacija dokazana (RLS testovi), aplikacija živi na poddomeni.

### Faza 2 — Ingestion (radar sam)
**Cilj:** automatsko punjenje kataloga iz izvora.
**Isporuke:** adapteri za jezgru izvora, normalizacija + deduplikacija + detekcija promjena,
GitHub Actions raspored, Admin UI za izvore i ručnu kuraciju/ispravke, oznaka JLS-prihvatljivosti.
**DoD:** katalog se puni automatski iz ≥ 4 izvora, promjene (rok/status) se bilježe.

### Faza 3 — Radni tok za timove
**Cilj:** od pregleda do rada na prilici.
**Isporuke:** watchlist/praćenja sa statusima, spremljeni osobni i timski filteri, bilješke,
dodjela zaduženja, timski pogledi unutar tenanta.
**DoD:** tim može pratiti poziv, dodijeliti ga, bilježiti i mijenjati interni status.

### Faza 4 — Obavijesti i izvještaji
**Cilj:** proaktivnost i isporuka klijentu.
**Isporuke:** email obavijesti (novi poziv po filtru, rok koji ističe), dnevni/tjedni digest,
kalendar rokova, export (PDF/CSV/Excel) pregleda za klijenta.
**DoD:** korisnik prima pravovremene obavijesti i može izvesti pregled.

### Faza 5 — Diferencijacija (napredno)
**Cilj:** razina svjetskog SaaS-a.
**Isporuke:** AI sažeci i auto-klasifikacija poziva (prihvatljivost JLS, tematika) putem Claude API,
semantičko pretraživanje, analitika na dashboardu, javni landing + onboarding; opcijski billing ako
se platforma nudi vanjskim plativim klijentima.
**DoD:** definira se na kraju Faze 4 prema prioritetima.

---

## 9. Besplatne razine (free tier) — okviri i strategija

| Servis | Free tier (okvirno) | Strategija da ostanemo unutra |
|--------|---------------------|-------------------------------|
| Vercel Hobby | 1 projekt, dovoljno za app + landing | SSR/ISR cache; scraping NE na Vercelu |
| Supabase Free | 500 MB baza, Auth, Storage, Edge Funcs (uz limite/pauzu na neaktivnost) | kompaktan katalog, arhiva starih poziva; održavati aktivnost |
| GitHub Free | privatni repo + izdašne Actions minute | scraperi kao scheduled Actions |
| Claude API | plaćeno po korištenju (Faza 5) | AI samo na promjenama/novim pozivima, uz cache |

Prelazak na plaćene razine razmatra se tek kad rastu promet/klijenti (jasna granica, bez iznenađenja).

---

## 10. Sigurnost i privatnost
- **RLS na svim per-tenant tablicama** — izolacija podataka među organizacijama.
- Uloge i najmanje potrebne ovlasti; superadmin odvojen od tenant-podataka osim kad je nužno.
- Service-role ključ samo u GitHub Actions/serveru, nikad u pregledniku.
- Pristanak na kolačiće sveden na nužno; nikakvi osobni podaci u URL-ovima.
- Izvori se poštuju (razumna učestalost, bez opterećivanja; poveznica uvijek na izvorni poziv).

---

## 11. Rizici i mjere
| Rizik | Mjera |
|-------|-------|
| Izvori mijenjaju HTML → scraper pukne | adapteri izolirani, health-check + alarm, ručna kuracija kao fallback |
| Supabase Free pauzira projekt na neaktivnost | periodični ping (Actions), nadzor |
| Duplikati / isti poziv na više izvora | deduplikacija po URL-u/hashu + pravila spajanja |
| Netočna JLS-prihvatljivost | oznake + mogućnost ručne korekcije; kasnije AI uz ljudsku provjeru |
| Rast izvan free tiera | praćenje kvota, jasan plan nadogradnje |

---

## 12. Potvrđene odluke (2026-11-07)

1. **Poddomena:** ✅ `fondovi.ips-konzalting.hr`.
2. **Tenant strategija:** ✅ multitenancy **od starta** — shema i RLS odmah predviđaju klijentske (JLS) tenante.
3. **Obavijesti:** ✅ email dovoljan za start (Faza 4); SMS/Slack eventualno kasnije.
4. **Opseg praćenja:** ✅ **sve razine** (lokalna/regionalna/nacionalna/EU) i **svi pozivi** uključujući
   nacionalne (FZOEU i sl.), ne samo EU bespovratna.
5. **Poslovni model:** ✅ IPS prodaje **pretplatu** JLS-ovima; po JLS-u matching „na koje se natječaje može
   prijaviti". Drugim konzultantima (konkurencija) se ne prodaje → billing u Fazi 5 orijentiran na JLS pretplate.

---

## 13. Odmah sljedeći korak

Po tvom usvajanju ovog dokumenta krećem u **Fazu 0**: postavljam Next.js projekt lokalno, izrađujem
dizajn-sustav u IPS bojama i glavne ekrane s mock podacima, te ti javljam kad je spremno za zajednički
pregled na lokalnom poslužitelju.
