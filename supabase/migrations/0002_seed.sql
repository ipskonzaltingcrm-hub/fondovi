-- JLS Radar — seed podaci (Faza 1). Zamjenjuju se stvarnim scrape-om u Fazi 2.

-- Operator tenant (IPS) + demo JLS pretplatnici
insert into public.tenants (slug, naziv, tip, status) values
  ('ips', 'IPS Konzalting', 'operator', 'aktivan')
on conflict (slug) do nothing;

-- Izvori
insert into public.sources (slug, naziv, url, tip, status, prioritet, zadnje_povlacenje, poziva_ukupno) values
 ('eufondovi','eufondovi.gov.hr — Pozivi','https://eufondovi.gov.hr/pozivi','HTML','aktivan','jezgra', now(), 4),
 ('fzoeu','FZOEU — nacionalni javni pozivi','https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji','HTML','aktivan','jezgra', now(), 4),
 ('ruralnirazvoj','ruralnirazvoj.hr / APPRRR','https://ruralnirazvoj.hr/natjecaji/','HTML','aktivan','jezgra', now(), 1),
 ('esf','esf.hr — ULJP / ESF+','https://www.esf.hr/natjecaji/','HTML','aktivan','jezgra', now(), 2),
 ('interreg-si-hr','Interreg SI-HR','https://si-hr.eu/','HTML','aktivan','jezgra', now(), 1),
 ('razvoj-gov','razvoj.gov.hr — najave','https://razvoj.gov.hr/','HTML','greska','dodatni', now() - interval '1 day', 1),
 ('euribarstvo','euribarstvo.hr','https://euribarstvo.hr/','HTML','aktivan','dodatni', now(), 1)
on conflict (slug) do nothing;

-- JLS profili (klijenti pod IPS tenantom)
insert into public.jls_profiles (tenant_id, slug, naziv, tip, zupanija, stanovnika, ruralno, lag, sektori_interesa, kontakt_osoba, status)
select t.id, v.slug, v.naziv, v.tip::jls_type, v.zupanija, v.stanovnika, v.ruralno, v.lag, v.sektori, v.kontakt, v.status
from public.tenants t,
(values
  ('grad-koprivnica','Grad Koprivnica','grad','Koprivničko-križevačka',30291,false,null,array['Energetika','Digitalizacija','Promet','Obrazovanje'],'Ivana Horvat, pročelnica UO za razvoj','aktivan'),
  ('opcina-nedelisce','Općina Nedelišće','opcina','Međimurska',11040,true,'LAG Međimurski doli i bregi',array['Komunalno','Ruralni razvoj','Socijalna skrb'],'Marko Novak, načelnik','aktivan'),
  ('zagrebacka-zupanija','Zagrebačka županija','zupanija','Zagrebačka',299985,false,null,array['Urbani razvoj','Obrazovanje','Okoliš','Promet'],'Petra Kovač, viša savjetnica za EU fondove','aktivan'),
  ('grad-cakovec','Grad Čakovec','grad','Međimurska',26615,false,null,array['Digitalizacija','Zgrade','Socijalna skrb'],'Tomislav Jurić, voditelj projekata','trial'),
  ('opcina-sveti-filip-jakov','Općina Sv. Filip i Jakov','opcina','Zadarska',4606,true,'LAG Mareta',array['Turizam','More','Ribarstvo','Komunalno'],'Ana Marić, pročelnica','aktivan')
) as v(slug,naziv,tip,zupanija,stanovnika,ruralno,lag,sektori,kontakt,status)
where t.slug = 'ips'
on conflict (tenant_id, slug) do nothing;

-- Pozivi (globalni katalog)
insert into public.calls
 (slug, naslov, davatelj, program, level, status, datum_objave, rok_prijave, iznos_min, iznos_max, ukupna_alokacija, intenzitet, prihvatljivi, sektori, sazetak, izvor, url, source_id)
select v.slug, v.naslov, v.davatelj, v.program, v.level::call_level, v.status::call_status,
       v.datum_objave::date, v.rok_prijave::date, v.iznos_min, v.iznos_max, v.alok, v.intenzitet,
       v.prihvatljivi::applicant_type[], v.sektori, v.sazetak, v.izvor, v.url, s.id
from (values
 ('fzoeu-energetska-obnova-2026','Energetska obnova zgrada javne namjene u vlasništvu JLS-a','Fond za zaštitu okoliša i energetsku učinkovitost','FZOEU — nacionalni javni poziv','nacionalna','otvoren','2026-09-15','2026-12-15',40000,1200000,35000000,'do 80%',array['grad','opcina','zupanija','ustanova'],array['Energetika','Zgrade','Klima'],'Sufinanciranje energetske obnove škola, vrtića, domova i upravnih zgrada u vlasništvu JLS-a.','fzoeu.hr','https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji','fzoeu'),
 ('fzoeu-komunalna-vozila-2026','Nabava komunalnih vozila na alternativna goriva','Fond za zaštitu okoliša i energetsku učinkovitost','FZOEU — nacionalni javni poziv','nacionalna','otvoren','2026-10-01','2026-11-28',20000,400000,8000000,'do 60%',array['grad','opcina'],array['Promet','Komunalno','Klima'],'Potpora za nabavu električnih i plinskih komunalnih vozila te radnih strojeva.','fzoeu.hr','https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji','fzoeu'),
 ('fzoeu-punionice-ev-2026','Izgradnja punionica za električna vozila','Fond za zaštitu okoliša i energetsku učinkovitost','FZOEU — nacionalni javni poziv','nacionalna','otvoren','2026-09-20','2026-11-20',10000,150000,4000000,'do 50%',array['grad','opcina','zupanija'],array['Promet','Energetika'],'Sufinanciranje javno dostupnih punionica za električna vozila na površinama JLS-a.','fzoeu.hr','https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji','fzoeu'),
 ('pkk-pametni-gradovi-2027','Razvoj pametnih gradova i općina (digitalizacija usluga)','Ministarstvo regionalnoga razvoja i fondova EU','Konkurentnost i kohezija (PKK) 2021.–2027.','nacionalna','najava','2026-10-28',null,100000,2000000,50000000,'do 85%',array['grad','opcina','zupanija'],array['Digitalizacija','Javna uprava'],'Najava poziva za digitalizaciju javnih usluga i upravljanje podacima na razini JLS-a.','eufondovi.gov.hr','https://eufondovi.gov.hr/pozivi','eufondovi'),
 ('itp-urbana-podrucja-2026','Integrirana teritorijalna ulaganja urbanih područja','Ministarstvo regionalnoga razvoja i fondova EU','Integrirani teritorijalni program (ITP)','regionalna','otvoren','2026-08-10','2027-01-31',200000,5000000,120000000,'do 85%',array['grad','opcina','zupanija','ustanova'],array['Urbani razvoj','Promet','Zgrade'],'Ulaganja unutar urbanih aglomeracija i područja (Zagreb, Rijeka, Osijek, Split i dr.).','eufondovi.gov.hr','https://eufondovi.gov.hr/pozivi','eufondovi'),
 ('uljp-socijalne-usluge-2026','Razvoj i širenje socijalnih usluga u zajednici','Ministarstvo rada, mirovinskoga sustava, obitelji i socijalne politike','Učinkoviti ljudski potencijali (ULJP) / ESF+','nacionalna','otvoren','2026-09-05','2026-12-05',50000,600000,22000000,'do 100%',array['grad','opcina','zupanija','ustanova','ngo'],array['Socijalna skrb','Zapošljavanje'],'Potpora JLS-ovima i ustanovama za usluge pomoći u kući, dnevne boravke i usluge za ranjive skupine.','esf.hr','https://www.esf.hr/natjecaji/','esf'),
 ('eafrd-ruralna-infrastruktura-2026','Ulaganja u temeljnu komunalnu infrastrukturu ruralnih općina','Agencija za plaćanja u poljoprivredi (APPRRR)','Ruralni razvoj — LAG / LEADER','lokalna','otvoren','2026-10-12','2026-12-20',15000,300000,18000000,'do 80%',array['opcina','lag'],array['Komunalno','Ruralni razvoj'],'Nerazvrstane ceste, javna rasvjeta, društveni domovi i vodoopskrba u ruralnim općinama.','ruralnirazvoj.hr','https://ruralnirazvoj.hr/natjecaji/','ruralnirazvoj'),
 ('interreg-slo-hr-zelena-2027','Prekogranična suradnja za zelenu tranziciju (SLO-HR)','Interreg Slovenija – Hrvatska','Interreg VI-A SI-HR','eu','otvoren','2026-07-01','2027-02-15',100000,1500000,40000000,'do 80%',array['grad','opcina','zupanija','ustanova','ngo'],array['Okoliš','Turizam','Klima'],'Zajednički projekti JLS-ova i institucija iz pograničnog područja.','si-hr.eu','https://si-hr.eu/','interreg-si-hr'),
 ('eufondovi-djecji-vrtici-2026','Izgradnja i opremanje dječjih vrtića','Ministarstvo znanosti, obrazovanja i mladih','Konkurentnost i kohezija (PKK) 2021.–2027.','nacionalna','otvoren','2026-09-25','2026-12-01',150000,3000000,90000000,'do 90%',array['grad','opcina'],array['Obrazovanje','Zgrade'],'Povećanje kapaciteta ranog i predškolskog odgoja — gradnja i opremanje vrtića.','eufondovi.gov.hr','https://eufondovi.gov.hr/pozivi','eufondovi'),
 ('interreg-it-hr-turizam-2027','Održivi turizam priobalnih zajednica (IT-HR)','Interreg Italija – Hrvatska','Interreg VI-A IT-HR','eu','otvoren','2026-08-20','2027-01-20',120000,1800000,35000000,'do 80%',array['grad','opcina','zupanija'],array['Turizam','Kultura','More'],'Projekti priobalnih i otočnih JLS-ova za upravljanje posjetiteljima i plavu ekonomiju.','italy-croatia.eu','https://www.italy-croatia.eu/','interreg-si-hr'),
 ('efpra-ribarska-infrastruktura-2026','Ribarska lučka infrastruktura i iskrcajna mjesta','Ministarstvo poljoprivrede, šumarstva i ribarstva','EFPRA — ribarstvo','nacionalna','otvoren','2026-10-05','2026-12-30',50000,900000,15000000,'do 75%',array['grad','opcina'],array['Ribarstvo','More','Infrastruktura'],'Ulaganja primorskih i otočnih JLS-ova u ribarske luke i iskrcajna mjesta.','euribarstvo.hr','https://euribarstvo.hr/','euribarstvo'),
 ('mingor-zelena-infrastruktura-2027','Zelena infrastruktura i prilagodba klimatskim promjenama','Ministarstvo zaštite okoliša i zelene tranzicije','Konkurentnost i kohezija (PKK) 2021.–2027.','nacionalna','najava','2026-11-01',null,80000,2500000,60000000,'do 85%',array['grad','opcina','zupanija'],array['Okoliš','Klima','Urbani razvoj'],'Najava poziva za zelene gradske površine, održivu odvodnju i urbano pošumljavanje.','razvoj.gov.hr','https://razvoj.gov.hr/','razvoj-gov'),
 ('fzoeu-sanacija-odlagalista-2026','Sanacija i zatvaranje odlagališta otpada','Fond za zaštitu okoliša i energetsku učinkovitost','FZOEU — nacionalni javni poziv','nacionalna','zatvoren','2026-03-01','2026-06-30',100000,2000000,25000000,'do 90%',array['grad','opcina','zupanija'],array['Otpad','Okoliš'],'Zatvoreni poziv za sanaciju neusklađenih odlagališta komunalnog otpada.','fzoeu.hr','https://www.fzoeu.hr/hr/nacionalni-javni-pozivi-i-natjecaji','fzoeu'),
 ('uljp-mladi-zaposljavanje-2026','Zapošljavanje mladih u lokalnoj zajednici','Hrvatski zavod za zapošljavanje','Učinkoviti ljudski potencijali (ULJP) / ESF+','nacionalna','zatvoren','2026-02-15','2026-05-15',20000,250000,12000000,'do 100%',array['grad','opcina','zupanija','ngo'],array['Zapošljavanje','Mladi'],'Zatvoreni poziv za stručno osposobljavanje i zapošljavanje mladih u JLS-ovima.','esf.hr','https://www.esf.hr/natjecaji/','esf')
) as v(slug,naslov,davatelj,program,level,status,datum_objave,rok_prijave,iznos_min,iznos_max,alok,intenzitet,prihvatljivi,sektori,sazetak,izvor,url,source_slug)
left join public.sources s on s.slug = v.source_slug
on conflict (slug) do nothing;
