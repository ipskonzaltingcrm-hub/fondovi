-- 0004: tip klijenta (JLS / poduzeće / institucija) + generalizacija profila
-- Profil klijenta (jls_profiles) sada pokriva tri vrste pretplatnika:
-- JLS, poduzeća (SME/velika) i znanstveno-istraživačke institucije.

create type klijent_tip as enum ('jls','poduzece','institucija');

alter table public.jls_profiles
  add column klijent_tip klijent_tip not null default 'jls',
  add column velicina text; -- za poduzeća: mikro/malo/srednje/veliko

-- tip (grad/opcina/zupanija) je sada samo JLS-podtip → dopusti null za ostale
alter table public.jls_profiles alter column tip drop not null;

-- Demo klijent: poduzeće
with t as (
  insert into public.tenants (slug, naziv, tip, status)
  values ('demo-poduzece', 'Demo tehnologije d.o.o.', 'jls', 'trial')
  returning id
)
insert into public.jls_profiles
  (tenant_id, slug, naziv, klijent_tip, tip, zupanija, sektori_interesa, kontakt_osoba, velicina, status)
select id, 'demo-tehnologije', 'Demo tehnologije d.o.o.', 'poduzece', null,
       'Grad Zagreb', array['Digitalizacija','Energetika'], 'Ana Anić', 'srednje', 'trial'
from t;

-- Demo klijent: znanstveno-istraživačka institucija
with t as (
  insert into public.tenants (slug, naziv, tip, status)
  values ('demo-institut', 'Institut za istraživanja', 'jls', 'trial')
  returning id
)
insert into public.jls_profiles
  (tenant_id, slug, naziv, klijent_tip, tip, zupanija, sektori_interesa, kontakt_osoba, status)
select id, 'demo-institut', 'Institut za istraživanja', 'institucija', null,
       'Grad Zagreb', array['Okoliš','Digitalizacija','Obrazovanje'], 'Ivan Ivić', 'trial'
from t;
