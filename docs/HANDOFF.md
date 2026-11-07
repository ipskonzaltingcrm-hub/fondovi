# JLS Radar — Handoff

> Prenesi ovaj dokument u novi chat da nastavi rad. Sažetak istraživanja + sljedeći koraci.

## Cilj projekta
**JLS radar** = alat za praćenje EU natječaja (poziva na dodjelu bespovratnih sredstava)
relevantnih za **jedinice lokalne samouprave (JLS)** u Hrvatskoj — gradove i općine.
Ideja: automatski pratiti ključne stranice i filtrirati pozive gdje su JLS prihvatljivi prijavitelji,
te voditi na izvorni tekst poziva (ne samo na vijest).

Datum istraživanja: 2026-11-06. Trenutno još **nije napisan nikakav kod** — samo istraživanje izvora.

## Izvori natječaja (rezultat istraživanja)

### 1. Središnji / službeni portali (jezgra)
- **https://eufondovi.gov.hr/** — središnji portal EU fondova 2021.–2027. Dio „Pozivi" objedinjuje
  pozive za 3 operativna programa i upućuje na sektorske portale. (POTVRĐENO direktnim dohvatom.)
  - Konkurentnost i kohezija (PKK), Integrirani teritorijalni program (ITP), Učinkoviti ljudski potencijali (ULJP).
- **https://fondovi.gov.hr/** — eFondovi, sustav za same prijave; obvezujući tekstovi poziva.
- **https://razvoj.gov.hr/** — Ministarstvo regionalnoga razvoja i fondova EU; najave i planovi objave poziva.
- **https://planoporavka.gov.hr/** + eNPOO — NPOO. NAPOMENA: NPOO (2021.–2026.) je u završnoj fazi
  (rok provedbe bio 30.6.2026.), većina poziva zatvorena → niži prioritet.

### 2. Sektorske agencije / fondovi
- **https://ruralnirazvoj.hr/** i **https://www.apprrr.hr/** — Agencija za plaćanja; ruralni razvoj,
  LAG/LEADER natječaji (važno za ruralne općine).
- **https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji** — Fond za zaštitu okoliša i energ. učinkovitost;
  redoviti pozivi baš za JLS (energetska obnova, komunalna oprema, prilagodba klimi, pametni gradovi/općine).
- **https://www.esf.hr/** — ESF+ / ULJP (socijalne usluge, zapošljavanje, obrazovanje).
- **https://euribarstvo.hr/** — ribarstvo (EFPRA), za primorske/otočne JLS.

### 3. Teritorijalni / regionalni izvori
- Regionalne razvojne agencije (RRA) po županijama: npr. PRIGODA (PGŽ), ZADRA, IDA (Istra).
- Urbane aglomeracije/područja (ITP): Zagreb, Rijeka, Osijek, Split + urbana područja — JLS prihvatljivi.
- Resorna ministarstva: MPGI (graditeljstvo), MINGOR (okoliš), MMPI (promet).

### 4. Izravni EU programi
- Interreg: https://si-hr.eu/ (SLO-HR), https://www.italy-croatia.eu/ (IT-HR), Interreg Europe, Središnja Europa, Jadran-Jonski.
- EU Funding & Tenders portal: https://ec.europa.eu/info/funding-tenders/opportunities/portal/ (URBACT, LIFE, CERV…).
- Kohesio (baza projekata, ne pozivi): https://kohesio.ec.europa.eu/

## Zaključak za arhitekturu radara
- Ne postoji jedan agregator koji pokriva sve → radar ima smisla.
- Jezgra za scraping/praćenje (strukturirane liste poziva):
  `eufondovi.gov.hr`, `fzoeu.hr`, `ruralnirazvoj.hr`, `esf.hr`, Interreg portali.
- Datume i prihvatljivost drži pojedini poziv → radar mora voditi na izvorni dokument poziva.

## Sljedeći koraci (prijedlog)
1. Odlučiti tehnologiju (npr. Python scraper + raspored, ili RSS/scheduled task; eventualno baza + jednostavni UI).
2. Za svaki izvor utvrditi ima li RSS/API ili treba HTML scraping; mapirati strukturu liste poziva.
3. Definirati filtar „JLS prihvatljiv prijavitelj" (ključne riječi: JLS, JLP(R)S, grad, općina, jedinice lokalne samouprave).
4. Model podatka o pozivu: naziv, izvor, program, rok, status, iznos, prihvatljivi prijavitelji, URL izvornog poziva.
5. Obavijesti (e-mail/datoteka/dashboard) za nove pozive.

## Otvorena pitanja za korisnika
- Tehnologija i oblik isporuke (lokalna skripta, web dashboard, Excel/CSV izvještaj, e-mail obavijesti?).
- Učestalost provjere (dnevno/tjedno?).
- Fokus: samo EU bespovratna sredstva ili i nacionalni pozivi (FZOEU nacionalni i sl.)?
- Pokrivenost: sve JLS ili specifična županija/aglomeracija?
