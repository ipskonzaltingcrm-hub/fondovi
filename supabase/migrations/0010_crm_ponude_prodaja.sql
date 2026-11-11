-- EU Radar CRM — Faza 3: Ponude (cjenik, opći uvjeti), Prodaja (monitoring, official, ciljevi, tjedni unos),
-- Upitnici (javna forma → lead), JLS prodaja (ciljna skupina, nacrti, signali).
-- CRM nikad sam ne šalje e-mailove: ponude i nacrti šalju se iz vlastite pošte.

-- ------------------------------------------------------------------
-- Postavke CRM-a (opći uvjeti, podaci tvrtke za PDF, rok proračuna JLS-ova)
-- ------------------------------------------------------------------
create table public.crm_settings (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.crm_settings (key, value) values
  ('company', '{"naziv":"IPS Konzalting d.o.o.","oib":"","adresa":"","iban":"","email":"","telefon":"","web":""}'),
  ('offer_terms', '{"text":""}'),
  ('jls_budget_deadline', '{"date":"2026-11-15","label":"Do prijedloga proračuna 2027."}');

-- ------------------------------------------------------------------
-- Cjenik usluga
-- ------------------------------------------------------------------
create table public.crm_services (
  id         uuid primary key default gen_random_uuid(),
  naziv      text not null check (length(trim(naziv)) > 0),
  opis       text,
  kategorija text not null default 'ostalo'
             check (kategorija in ('pretplata','priprema','vodjenje','strategija','savjetovanje','ostalo')),
  jedinica   text not null default 'kom' check (jedinica in ('kom','mjesec','godina','sat','postotak')),
  cijena     numeric(12,2),
  postotak   numeric(6,3),
  pdv        numeric(5,2) not null default 25,
  aktivan    boolean not null default true,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Prijedlog cjenika (cijene upisuje vlasnica u kartici Ponude → Cjenik).
insert into public.crm_services (naziv, kategorija, jedinica, cijena, postotak, position) values
  ('EU Radar — godišnja pretplata (JLS)', 'pretplata', 'godina', null, null, 1),
  ('EU Radar — godišnja pretplata (poduzeće)', 'pretplata', 'godina', null, null, 2),
  ('EU Radar — godišnja pretplata (institucija)', 'pretplata', 'godina', null, null, 3),
  ('Priprema prijave EU projekta (fiksni dio)', 'priprema', 'kom', null, null, 10),
  ('Priprema prijave — naknada za uspjeh (% vrijednosti projekta)', 'priprema', 'postotak', null, null, 11),
  ('Vođenje / provedba EU projekta', 'vodjenje', 'mjesec', null, null, 20),
  ('Strategija razvoja (JLS)', 'strategija', 'kom', null, null, 30),
  ('Savjetovanje', 'savjetovanje', 'sat', null, null, 40);

-- ------------------------------------------------------------------
-- Ponude
-- ------------------------------------------------------------------
create table public.crm_offers (
  id                 uuid primary key default gen_random_uuid(),
  broj               text unique,
  predmet            text not null check (length(trim(predmet)) > 0),
  jls_profile_id     uuid references public.jls_profiles(id) on delete set null,
  lead_id            uuid references public.crm_leads(id) on delete set null,
  project_id         uuid references public.crm_projects(id) on delete set null,
  owner              uuid references public.profiles(id) on delete set null default auth.uid(),
  status             text not null default 'nacrt' check (status in ('nacrt','poslana','prihvacena','odbijena','istekla')),
  datum              date not null default (now() at time zone 'Europe/Zagreb')::date,
  vrijedi_do         date,
  visina_investicije numeric(14,2),
  rate               jsonb not null default '[]',
  napomene           text,
  razlog_odbijanja   text,
  iznos_neto         numeric(14,2) not null default 0,
  iznos_pdv          numeric(14,2) not null default 0,
  iznos_ukupno       numeric(14,2) not null default 0,
  sent_at            timestamptz,
  accepted_at        timestamptz,
  archived_at        timestamptz,
  created_by         uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (jls_profile_id is not null or lead_id is not null)
);
create index crm_offers_client_idx on public.crm_offers (jls_profile_id);
create index crm_offers_lead_idx   on public.crm_offers (lead_id);

create table public.crm_offer_items (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.crm_offers(id) on delete cascade,
  service_id uuid references public.crm_services(id) on delete set null,
  naziv      text not null check (length(trim(naziv)) > 0),
  opis       text,
  kolicina   numeric(12,3) not null default 1,
  jedinica   text not null default 'kom',
  cijena     numeric(14,2) not null default 0,
  postotak   numeric(6,3),
  pdv        numeric(5,2) not null default 25,
  iznos      numeric(14,2) not null default 0,
  position   integer not null default 0
);
create index crm_offer_items_idx on public.crm_offer_items (offer_id, position);

create or replace function public.crm_can_see_offer(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.crm_can_see(owner, created_by) from public.crm_offers where id = p_id), false);
$$;

create or replace function public.crm_offer_is_draft(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'nacrt' from public.crm_offers where id = p_id), false);
$$;

-- Broj PON-GGGG-MM-NN, autor, zaključavanje poslanih ponuda.
create or replace function public.crm_offer_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prefix text; v_n int;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    perform pg_advisory_xact_lock(hashtext('crm_offer_broj'));
    v_prefix := 'PON-' || to_char(new.datum, 'YYYY-MM') || '-';
    select coalesce(max(substring(broj from length(v_prefix) + 1)::int), 0) + 1 into v_n
      from public.crm_offers where broj like v_prefix || '%';
    new.broj := v_prefix || lpad(v_n::text, 2, '0');
    new.status := 'nacrt';
  else
    if old.status <> 'nacrt' and new.status = old.status and (
         new.predmet is distinct from old.predmet or new.jls_profile_id is distinct from old.jls_profile_id
      or new.lead_id is distinct from old.lead_id or new.visina_investicije is distinct from old.visina_investicije
      or new.rate is distinct from old.rate or new.napomene is distinct from old.napomene
      or new.datum is distinct from old.datum or new.vrijedi_do is distinct from old.vrijedi_do) then
      raise exception 'Poslana ponuda se ne mijenja — vrati je u nacrt ili napravi kopiju.';
    end if;
    if new.archived_at is not null and old.archived_at is null and new.status <> 'nacrt' then
      raise exception 'Arhivirati se može samo nacrt.';
    end if;
  end if;
  if new.owner is not null and (tg_op = 'INSERT' or new.owner is distinct from old.owner) and not exists (
    select 1 from public.profiles where id = new.owner and staff_role is not null and staff_active) then
    raise exception 'Vlasnik ponude mora biti aktivan član tima.';
  end if;
  return new;
end; $$;
create trigger crm_offers_before before insert or update on public.crm_offers
  for each row execute function public.crm_offer_before();
create trigger crm_offers_touch before update on public.crm_offers
  for each row execute function public.crm_touch_row();

-- Stavka: postotne stavke računaju se iz visine investicije; iznos = količina × cijena.
create or replace function public.crm_offer_item_before()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inv numeric;
begin
  if new.postotak is not null then
    select visina_investicije into v_inv from public.crm_offers where id = new.offer_id;
    new.cijena := round(coalesce(v_inv, 0) * new.postotak / 100, 2);
    new.kolicina := 1;
  end if;
  new.iznos := round(new.kolicina * new.cijena, 2);
  return new;
end; $$;
create trigger crm_offer_items_before before insert or update on public.crm_offer_items
  for each row execute function public.crm_offer_item_before();

create or replace function public.crm_offer_recalc(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.crm_offers o set
    iznos_neto = coalesce(t.neto, 0),
    iznos_pdv = coalesce(t.pdv, 0),
    iznos_ukupno = coalesce(t.neto, 0) + coalesce(t.pdv, 0)
  from (select sum(iznos) neto, round(sum(iznos * pdv / 100), 2) pdv from public.crm_offer_items where offer_id = p_id) t
  where o.id = p_id;
$$;

create or replace function public.crm_offer_items_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.crm_offer_recalc(coalesce(new.offer_id, old.offer_id));
  return null;
end; $$;
create trigger crm_offer_items_after after insert or update or delete on public.crm_offer_items
  for each row execute function public.crm_offer_items_after();

-- Promjena visine investicije preračunava postotne stavke.
create or replace function public.crm_offer_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.visina_investicije is distinct from old.visina_investicije then
    update public.crm_offer_items set postotak = postotak where offer_id = new.id and postotak is not null;
  end if;
  return null;
end; $$;
create trigger crm_offers_after after update on public.crm_offers
  for each row execute function public.crm_offer_after();

-- ------------------------------------------------------------------
-- Prodaja, ciljevi, tjedni unos
-- ------------------------------------------------------------------
create table public.crm_sales (
  id             uuid primary key default gen_random_uuid(),
  datum          date not null default (now() at time zone 'Europe/Zagreb')::date,
  member         uuid references public.profiles(id) on delete set null,
  jls_profile_id uuid references public.jls_profiles(id) on delete set null,
  offer_id       uuid references public.crm_offers(id) on delete set null,
  service_id     uuid references public.crm_services(id) on delete set null,
  usluga         text not null check (length(trim(usluga)) > 0),
  iznos          numeric(14,2) not null check (iznos >= 0),
  vrsta          text not null default 'nova' check (vrsta in ('nova','stara')),
  napomena       text,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index crm_sales_datum_idx on public.crm_sales (datum);

create table public.crm_sales_targets (
  mjesec     date not null check (extract(day from mjesec) = 1),
  member     uuid references public.profiles(id) on delete cascade,
  iznos      numeric(14,2) not null check (iznos >= 0),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (mjesec, member)
);

create table public.crm_week_entries (
  week_start      date not null check (extract(isodow from week_start) = 1),
  member          uuid not null references public.profiles(id) on delete cascade,
  preuzeti        integer check (preuzeti >= 0),
  doneseni        integer check (doneseni >= 0),
  pozivi          integer check (pozivi >= 0),
  ponude_poslane  integer check (ponude_poslane >= 0),
  ponude_ugovorene integer check (ponude_ugovorene >= 0),
  stara_provedba  numeric(14,2) check (stara_provedba >= 0),
  napomena        text,
  updated_by      uuid references public.profiles(id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (week_start, member)
);

create or replace function public.crm_sales_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  if new.member is null then new.member := auth.uid(); end if;
  return new;
end; $$;
create trigger crm_sales_before before insert on public.crm_sales
  for each row execute function public.crm_sales_before();

create or replace function public.crm_week_entry_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end; $$;
create trigger crm_week_entries_before before insert or update on public.crm_week_entries
  for each row execute function public.crm_week_entry_before();

-- Status ponude: prijelazi i posljedice (prodaja, pretvorba leada, povijest).
create or replace function public.crm_set_offer_status(p_id uuid, p_status text, p_razlog text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  o public.crm_offers; v_jls uuid;
  lbl constant jsonb := '{"nacrt":"Nacrt","poslana":"Poslana","prihvacena":"Prihvaćena","odbijena":"Odbijena","istekla":"Istekla"}';
begin
  if public.crm_role() is null then raise exception 'Nemate pristup CRM-u.'; end if;
  select * into o from public.crm_offers where id = p_id for update;
  if not found or not public.crm_can_see(o.owner, o.created_by) then raise exception 'Ponuda ne postoji ili nemate pristup.'; end if;
  if public.crm_role() = 'suradnik' and o.owner is distinct from auth.uid() then
    raise exception 'Suradnik mijenja status samo svojih ponuda.';
  end if;
  if p_status not in ('nacrt','poslana','prihvacena','odbijena','istekla') then raise exception 'Nepoznat status.'; end if;
  if o.status = 'prihvacena' then raise exception 'Prihvaćena ponuda je već u prodaji i ne mijenja se.'; end if;
  if p_status = 'poslana' and o.status not in ('nacrt','poslana') then raise exception 'Poslati se može nacrt (ili ponovno poslana ponuda).'; end if;
  if p_status in ('prihvacena','odbijena') and o.status <> 'poslana' then raise exception 'Najprije označite ponudu kao poslanu.'; end if;
  if p_status = 'poslana' and not exists (select 1 from public.crm_offer_items where offer_id = p_id) then
    raise exception 'Ponuda nema nijednu stavku.';
  end if;

  if p_status = 'prihvacena' then
    v_jls := o.jls_profile_id;
    if v_jls is null and o.lead_id is not null then
      v_jls := (select jls_profile_id from public.crm_leads where id = o.lead_id);
      if v_jls is null then
        v_jls := public.crm_convert_lead(o.lead_id, null, 'aktivan');
      end if;
    end if;
  end if;

  update public.crm_offers set
    jls_profile_id = coalesce(v_jls, jls_profile_id),
    status = p_status,
    sent_at = case when p_status = 'poslana' then now() when p_status = 'nacrt' then null else sent_at end,
    accepted_at = case when p_status = 'prihvacena' then now() else accepted_at end,
    razlog_odbijanja = case when p_status = 'odbijena' then nullif(trim(p_razlog), '') else null end
  where id = p_id;

  if p_status = 'poslana' and o.lead_id is not null then
    update public.crm_leads set status = 'ponuda' where id = o.lead_id and status in ('novi','kontaktiran','u_razgovoru');
  end if;

  if p_status = 'prihvacena' then
    insert into public.crm_sales (datum, member, jls_profile_id, offer_id, service_id, usluga, iznos, vrsta, napomena)
    select public.crm_today(), coalesce(o.owner, auth.uid()), v_jls, o.id, i.service_id, i.naziv, i.iznos, 'nova', 'Iz ponude ' || o.broj
      from public.crm_offer_items i where i.offer_id = o.id and i.iznos > 0;
  end if;

  insert into public.crm_activities (vrsta, body, lead_id, jls_profile_id, meta)
  values ('promjena',
          'Ponuda ' || o.broj || ': ' || (lbl->>o.status) || ' → ' || (lbl->>p_status)
            || case when p_status = 'odbijena' and nullif(trim(p_razlog), '') is not null then ' (' || trim(p_razlog) || ')' else '' end,
          o.lead_id, coalesce(v_jls, o.jls_profile_id), jsonb_build_object('offer_id', o.id));
end; $$;

-- ------------------------------------------------------------------
-- Podaci za Prodajni monitoring / official (cijeli tim; čita svaki član tima)
-- ------------------------------------------------------------------
create or replace function public.crm_sales_events(p_from date, p_to date)
returns table (kind text, member uuid, at date, iznos numeric, ref text, label text, meta jsonb)
language sql stable security definer set search_path = public as $$
  with z as (select p_from as f, p_to as t)
  select * from (
    select 'lead_novi'::text, l.owner, (l.created_at at time zone 'Europe/Zagreb')::date, null::numeric, l.id::text, 'L-' || l.broj || ' ' || l.naziv, null::jsonb
      from public.crm_leads l, z where (l.created_at at time zone 'Europe/Zagreb')::date between z.f and z.t
    union all
    select 'lead_donesen', l.created_by, (l.created_at at time zone 'Europe/Zagreb')::date, null, l.id::text, 'L-' || l.broj || ' ' || l.naziv, null
      from public.crm_leads l, z where l.created_by is not null and (l.created_at at time zone 'Europe/Zagreb')::date between z.f and z.t
    union all
    select 'lead_preuzet', l.owner, (l.created_at at time zone 'Europe/Zagreb')::date, null, l.id::text, 'L-' || l.broj || ' ' || l.naziv, null
      from public.crm_leads l, z where l.owner is not null and l.created_by is distinct from l.owner
       and (l.created_at at time zone 'Europe/Zagreb')::date between z.f and z.t
    union all
    select 'lead_upitnik', l.owner, (l.created_at at time zone 'Europe/Zagreb')::date, null, l.id::text, 'L-' || l.broj || ' ' || l.naziv, null
      from public.crm_leads l, z where l.izvor = 'upitnik' and (l.created_at at time zone 'Europe/Zagreb')::date between z.f and z.t
    union all
    select 'poziv', a.actor, (a.at at time zone 'Europe/Zagreb')::date, null,
           coalesce(a.lead_id::text, a.jls_profile_id::text), left(a.body, 120),
           jsonb_build_object('lead_id', a.lead_id, 'jls_profile_id', a.jls_profile_id, 'vrsta', a.vrsta)
      from public.crm_activities a, z where a.vrsta in ('poziv','sastanak') and (a.at at time zone 'Europe/Zagreb')::date between z.f and z.t
    union all
    select 'ponuda_poslana', o.owner, (o.sent_at at time zone 'Europe/Zagreb')::date, o.iznos_neto, o.id::text, o.broj || ' ' || o.predmet, null
      from public.crm_offers o, z where o.sent_at is not null and (o.sent_at at time zone 'Europe/Zagreb')::date between z.f and z.t
    union all
    select 'ponuda_ugovorena', o.owner, (o.accepted_at at time zone 'Europe/Zagreb')::date, o.iznos_neto, o.id::text, o.broj || ' ' || o.predmet, null
      from public.crm_offers o, z where o.accepted_at is not null and (o.accepted_at at time zone 'Europe/Zagreb')::date between z.f and z.t
    union all
    select case when s.vrsta = 'stara' then 'stara' else 'ugovoreno' end, s.member, s.datum, s.iznos, s.id::text,
           s.usluga || coalesce(' · ' || j.naziv, ''), jsonb_build_object('offer_id', s.offer_id, 'jls_profile_id', s.jls_profile_id, 'service_id', s.service_id, 'created_by', s.created_by)
      from public.crm_sales s left join public.jls_profiles j on j.id = s.jls_profile_id, z where s.datum between z.f and z.t
    union all
    select 'tjedni', w.member, w.week_start, w.stara_provedba, null, w.napomena, to_jsonb(w)
      from public.crm_week_entries w, z where w.week_start between z.f - 6 and z.t
  ) e (kind, member, at, iznos, ref, label, meta)
  where public.is_staff();
$$;

-- ------------------------------------------------------------------
-- Upitnici (javne forme → lead)
-- ------------------------------------------------------------------
alter table public.crm_leads drop constraint crm_leads_izvor_check;
alter table public.crm_leads add constraint crm_leads_izvor_check
  check (izvor in ('web','preporuka','telefon','email','sajam','linkedin','eu_radar','partner','upitnik','jls_prodaja','ostalo'));

create table public.crm_forms (
  id          uuid primary key default gen_random_uuid(),
  naziv       text not null check (length(trim(naziv)) > 0),
  uvod        text,
  token       text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  owner       uuid references public.profiles(id) on delete set null,
  create_task boolean not null default true,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.crm_leads add column form_id uuid references public.crm_forms(id) on delete set null;

create table public.crm_form_submissions (
  id       bigint generated always as identity primary key,
  form_id  uuid references public.crm_forms(id) on delete cascade,
  at       timestamptz not null default now(),
  outcome  text not null check (outcome in ('novi','postojeci','greska')),
  lead_id  uuid references public.crm_leads(id) on delete set null,
  error    text,
  payload  jsonb not null default '{}'
);
create index crm_form_submissions_idx on public.crm_form_submissions (form_id, at desc);

insert into public.crm_forms (naziv, uvod) values
  ('Provjeri na što se možeš prijaviti',
   'Ispunite kratki upitnik — EU Radar pronalazi otvorene natječaje za vašu općinu, tvrtku ili instituciju, a naš konzultant javit će vam se s prijedlogom.');

create or replace function public.crm_form_info(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('naziv', naziv, 'uvod', uvod, 'active', active)
  from public.crm_forms where token = p_token;
$$;

-- Vlasnik automatskog leada: zadani vlasnik upitnika ili član (konzultant/admin) koji je najdulje bez automatskog leada.
create or replace function public.crm_next_lead_owner()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where p.staff_active and p.staff_role in ('admin','konzultant')
  order by (select max(l.created_at) from public.crm_leads l where l.owner = p.id and l.created_by is null) nulls first, p.created_at
  limit 1;
$$;

create or replace function public.crm_form_submit(p_token text, p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f public.crm_forms; v_lead uuid; v_owner uuid; v_email text; v_tel text; v_naziv text; v_tip text; v_sekt text[];
  v_existing uuid; v_body text; v_types text[]; v_matches int;
begin
  select * into f from public.crm_forms where token = p_token;
  if not found or not f.active then raise exception 'Upitnik nije dostupan.'; end if;
  if coalesce(p->>'website', '') <> '' then
    -- honeypot: tiho prihvati, ništa ne upisuj
    return jsonb_build_object('ok', true);
  end if;
  v_naziv := left(nullif(trim(p->>'naziv'), ''), 200);
  v_email := lower(left(nullif(trim(p->>'email'), ''), 200));
  v_tel := left(nullif(trim(p->>'telefon'), ''), 50);
  v_tip := coalesce(nullif(p->>'klijent_tip', ''), 'poduzece');
  if v_naziv is null then raise exception 'Upišite naziv organizacije ili ime.'; end if;
  if v_email is null and v_tel is null then raise exception 'Upišite e-mail ili telefon.'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail adresa nije ispravna.'; end if;
  if v_tip not in ('jls','poduzece','institucija') then v_tip := 'poduzece'; end if;
  if coalesce((p->>'privola')::boolean, false) is not true then raise exception 'Za slanje je potrebna privola za kontakt.'; end if;
  if (select count(*) from public.crm_form_submissions where form_id = f.id and at > now() - interval '1 hour') > 60 then
    raise exception 'Previše upita u kratkom vremenu. Pokušajte kasnije.';
  end if;
  v_sekt := coalesce(array(select jsonb_array_elements_text(p->'sektori') limit 20), '{}');
  v_types := case v_tip when 'poduzece' then array['tvrtka'] when 'institucija' then array['ustanova']
                 else case when coalesce(p->>'jls_tip', '') in ('opcina','grad','zupanija') then array[p->>'jls_tip'] else array['grad','opcina','zupanija'] end end;
  -- Broj otvorenih natječaja za koje je vrsta prijavitelja prihvatljiva (prikaz zahvale).
  select count(*) into v_matches from public.calls c
   where c.status = 'otvoren' and (c.rok_prijave is null or c.rok_prijave >= public.crm_today())
     and c.prihvatljivi::text[] && v_types
     and (cardinality(v_sekt) = 0 or c.sektori && v_sekt);
  v_body := 'Upitnik „' || f.naziv || '“: ' || coalesce(left(nullif(trim(p->>'poruka'), ''), 2000), 'bez poruke');

  select id into v_existing from public.crm_leads
   where archived_at is null and status not in ('pretvoren','izgubljen')
     and ((v_email is not null and lower(email) = v_email)
          or (v_tel is not null and right(regexp_replace(telefon, '\D', '', 'g'), 8) = right(regexp_replace(v_tel, '\D', '', 'g'), 8)
              and length(regexp_replace(v_tel, '\D', '', 'g')) >= 8))
   order by created_at desc limit 1;

  if v_existing is not null then
    insert into public.crm_activities (vrsta, body, lead_id) values ('biljeska', v_body, v_existing);
    insert into public.crm_form_submissions (form_id, outcome, lead_id, payload) values (f.id, 'postojeci', v_existing, p - 'website');
    return jsonb_build_object('ok', true, 'matches', v_matches);
  end if;

  v_owner := coalesce(f.owner, public.crm_next_lead_owner());
  insert into public.crm_leads (naziv, klijent_tip, jls_tip, kontakt_ime, email, telefon, zupanija, izvor, interes, sektori, owner, form_id)
  values (v_naziv, v_tip::public.klijent_tip,
          case when v_tip = 'jls' then coalesce(nullif(p->>'jls_tip', ''), 'opcina')::public.jls_type end,
          left(nullif(trim(p->>'kontakt_ime'), ''), 200), v_email, v_tel, left(nullif(trim(p->>'zupanija'), ''), 100),
          'upitnik', 'Upitnik: ' || f.naziv, v_sekt, v_owner, f.id)
  returning id into v_lead;
  insert into public.crm_activities (vrsta, body, lead_id) values ('biljeska', v_body, v_lead);
  if f.create_task and v_owner is not null then
    insert into public.crm_tasks (naslov, vrsta, prioritet, rok, owner, lead_id)
    values ('Nazovi u 24 h: ' || v_naziv, 'poziv', 'visok', public.crm_today() + 1, v_owner, v_lead);
  end if;
  insert into public.crm_form_submissions (form_id, outcome, lead_id, payload) values (f.id, 'novi', v_lead, p - 'website');
  return jsonb_build_object('ok', true, 'matches', v_matches);
exception when others then
  if f.id is not null then
    insert into public.crm_form_submissions (form_id, outcome, error, payload)
    values (f.id, 'greska', left(sqlerrm, 300), coalesce(p, '{}'::jsonb) - 'website');
  end if;
  return jsonb_build_object('ok', false, 'error', sqlerrm);
end; $$;

-- ------------------------------------------------------------------
-- JLS prodaja (samo administratori)
-- ------------------------------------------------------------------
create table public.crm_jls_targets (
  id             uuid primary key default gen_random_uuid(),
  naziv          text not null check (length(trim(naziv)) > 0),
  tip            public.jls_type not null default 'opcina',
  zupanija       text,
  segment        text check (segment in ('A','B','C')),
  bodovi         integer,
  lag            text,
  stanovnika     integer,
  kontakt_osoba  text,
  email          text,
  telefon        text,
  status         text not null default 'nije_kontaktiran'
                 check (status in ('nije_kontaktiran','mail_poslan','odgovorio','sastanak','ponuda','ugovor','odbio')),
  zadnji_kontakt date,
  napomena       text,
  jls_profile_id uuid references public.jls_profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.crm_jls_drafts (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.crm_jls_targets(id) on delete cascade,
  predlozak  text,
  naslov     text not null,
  tekst      text not null,
  status     text not null default 'nacrt' check (status in ('nacrt','poslano','odgovorio','sastanak','odbaceno')),
  sent_at    timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_jls_signals (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid references public.crm_jls_targets(id) on delete cascade,
  naslov     text not null check (length(trim(naslov)) > 0),
  opis       text,
  url        text,
  datum      date not null default (now() at time zone 'Europe/Zagreb')::date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.crm_activities add column jls_target_id uuid references public.crm_jls_targets(id) on delete cascade;
alter table public.crm_activities drop constraint crm_activities_check;
alter table public.crm_activities add constraint crm_activities_check
  check (lead_id is not null or jls_profile_id is not null or task_id is not null or project_id is not null or jls_target_id is not null);
grant insert (jls_target_id) on public.crm_activities to authenticated;
drop policy crm_activities_read on public.crm_activities;
drop policy crm_activities_insert on public.crm_activities;
create policy crm_activities_read on public.crm_activities for select to authenticated
  using (public.crm_can_see_activity(lead_id, jls_profile_id, task_id)
         or (project_id is not null and public.is_staff() and public.crm_can_see_project(project_id))
         or (jls_target_id is not null and public.is_crm_admin()));
create policy crm_activities_insert on public.crm_activities for insert to authenticated
  with check (vrsta in ('poziv','biljeska','email','sastanak','komentar')
              and (public.crm_can_see_activity(lead_id, jls_profile_id, task_id)
                   or (project_id is not null and public.is_staff() and public.crm_can_see_project(project_id))
                   or (jls_target_id is not null and public.is_crm_admin())));

-- Status nacrta pomiče status JLS-a, samo naprijed.
create or replace function public.crm_jls_draft_effects()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ord constant jsonb := '{"nije_kontaktiran":0,"mail_poslan":1,"odgovorio":2,"sastanak":3,"ponuda":4,"ugovor":5,"odbio":6}';
  v_new text;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'poslano' then new.sent_at := coalesce(new.sent_at, now()); end if;
    v_new := case new.status when 'poslano' then 'mail_poslan' when 'odgovorio' then 'odgovorio' when 'sastanak' then 'sastanak' end;
    if v_new is not null then
      update public.crm_jls_targets t set status = v_new, zadnji_kontakt = public.crm_today()
       where t.id = new.target_id and t.status <> 'odbio' and (ord->>t.status)::int < (ord->>v_new)::int;
    end if;
  end if;
  return new;
end; $$;
create trigger crm_jls_drafts_effects before update on public.crm_jls_drafts
  for each row execute function public.crm_jls_draft_effects();
create trigger crm_jls_targets_touch before update on public.crm_jls_targets
  for each row execute function public.crm_touch_row();

-- Pretvorba JLS-a u klijenta (EU Radar profil + CRM podaci).
create or replace function public.crm_jls_convert(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare t public.crm_jls_targets; v_jls uuid;
begin
  if not public.is_crm_admin() then raise exception 'JLS prodaju vode administratori.'; end if;
  select * into t from public.crm_jls_targets where id = p_id for update;
  if not found then raise exception 'JLS ne postoji.'; end if;
  if t.jls_profile_id is not null then return t.jls_profile_id; end if;
  v_jls := public.crm_save_client(null, jsonb_build_object(
    'naziv', t.naziv, 'klijent_tip', 'jls', 'tip', t.tip, 'zupanija', coalesce(t.zupanija, ''),
    'stanovnika', coalesce(t.stanovnika::text, ''), 'kontakt_osoba', coalesce(t.kontakt_osoba, ''),
    'email', coalesce(t.email, ''), 'telefon', coalesce(t.telefon, ''), 'status', 'trial'));
  update public.jls_profiles set lag = t.lag where id = v_jls;
  if coalesce(trim(t.kontakt_osoba), '') <> '' then
    insert into public.crm_contacts (jls_profile_id, ime, email, telefon, primarni) values (v_jls, t.kontakt_osoba, t.email, t.telefon, true);
  end if;
  update public.crm_jls_targets set jls_profile_id = v_jls, status = case when status in ('ugovor') then status else 'ugovor' end where id = p_id;
  return v_jls;
end; $$;

-- ------------------------------------------------------------------
-- Dnevnik
-- ------------------------------------------------------------------
create trigger crm_audit after insert or update or delete on public.crm_offers        for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_services      for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_sales         for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_sales_targets for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_settings      for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_forms         for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_jls_targets   for each row execute function public.crm_audit_row();
create trigger crm_services_touch before update on public.crm_services for each row execute function public.crm_touch_row();
create trigger crm_forms_touch    before update on public.crm_forms    for each row execute function public.crm_touch_row();

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------
alter table public.crm_settings         enable row level security;
alter table public.crm_services         enable row level security;
alter table public.crm_offers           enable row level security;
alter table public.crm_offer_items      enable row level security;
alter table public.crm_sales            enable row level security;
alter table public.crm_sales_targets    enable row level security;
alter table public.crm_week_entries     enable row level security;
alter table public.crm_forms            enable row level security;
alter table public.crm_form_submissions enable row level security;
alter table public.crm_jls_targets      enable row level security;
alter table public.crm_jls_drafts       enable row level security;
alter table public.crm_jls_signals      enable row level security;

create policy crm_settings_read  on public.crm_settings for select to authenticated using (public.is_staff());
create policy crm_settings_write on public.crm_settings for update to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());

create policy crm_services_read  on public.crm_services for select to authenticated using (public.is_staff());
create policy crm_services_write on public.crm_services for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());

create policy crm_offers_read on public.crm_offers for select to authenticated using (public.crm_can_see(owner, created_by));
create policy crm_offers_insert on public.crm_offers for insert to authenticated
  with check (public.is_staff() and public.crm_can_see(owner, auth.uid())
              and (jls_profile_id is null or public.crm_can_see_client(jls_profile_id))
              and (lead_id is null or exists (select 1 from public.crm_leads l where l.id = lead_id)));
create policy crm_offers_update on public.crm_offers for update to authenticated
  using (public.crm_can_see(owner, created_by)) with check (public.crm_can_see(owner, created_by));

create policy crm_offer_items_read on public.crm_offer_items for select to authenticated using (public.crm_can_see_offer(offer_id));
create policy crm_offer_items_write on public.crm_offer_items for all to authenticated
  using (public.crm_can_see_offer(offer_id) and public.crm_offer_is_draft(offer_id))
  with check (public.crm_can_see_offer(offer_id) and public.crm_offer_is_draft(offer_id));

create policy crm_sales_read on public.crm_sales for select to authenticated
  using (public.is_crm_admin() or (public.is_staff() and (member = auth.uid() or created_by = auth.uid())));
create policy crm_sales_insert on public.crm_sales for insert to authenticated
  with check (public.crm_is_konzultant() and (public.is_crm_admin() or member = auth.uid() or member is null));
create policy crm_sales_delete on public.crm_sales for delete to authenticated
  using (public.is_crm_admin() or (public.is_staff() and created_by = auth.uid()));

create policy crm_sales_targets_read  on public.crm_sales_targets for select to authenticated using (public.is_staff());
create policy crm_sales_targets_write on public.crm_sales_targets for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());

create policy crm_week_entries_read on public.crm_week_entries for select to authenticated
  using (public.is_crm_admin() or (public.is_staff() and member = auth.uid()));
create policy crm_week_entries_write on public.crm_week_entries for all to authenticated
  using (public.is_crm_admin() or (public.crm_is_konzultant() and member = auth.uid()))
  with check (public.is_crm_admin() or (public.crm_is_konzultant() and member = auth.uid()));

create policy crm_forms_read  on public.crm_forms for select to authenticated using (public.is_staff());
create policy crm_forms_write on public.crm_forms for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
create policy crm_form_submissions_read on public.crm_form_submissions for select to authenticated using (public.is_crm_admin());

create policy crm_jls_targets_all on public.crm_jls_targets for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
create policy crm_jls_drafts_all  on public.crm_jls_drafts  for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());
create policy crm_jls_signals_all on public.crm_jls_signals for all to authenticated using (public.is_crm_admin()) with check (public.is_crm_admin());

-- ------------------------------------------------------------------
-- Ovlasti
-- ------------------------------------------------------------------
revoke all on public.crm_settings, public.crm_services, public.crm_offers, public.crm_offer_items, public.crm_sales,
              public.crm_sales_targets, public.crm_week_entries, public.crm_forms, public.crm_form_submissions,
              public.crm_jls_targets, public.crm_jls_drafts, public.crm_jls_signals
  from anon, authenticated;

grant select on public.crm_settings to authenticated;
grant update (value) on public.crm_settings to authenticated;
grant select, insert, update, delete on public.crm_services to authenticated;
grant select on public.crm_offers to authenticated;
grant insert (predmet, jls_profile_id, lead_id, project_id, owner, datum, vrijedi_do, visina_investicije, rate, napomene)
  on public.crm_offers to authenticated;
grant update (predmet, jls_profile_id, lead_id, project_id, owner, datum, vrijedi_do, visina_investicije, rate, napomene, archived_at)
  on public.crm_offers to authenticated;
grant select on public.crm_offer_items to authenticated;
grant insert (offer_id, service_id, naziv, opis, kolicina, jedinica, cijena, postotak, pdv, position),
      update (service_id, naziv, opis, kolicina, jedinica, cijena, postotak, pdv, position), delete
  on public.crm_offer_items to authenticated;
grant select, delete on public.crm_sales to authenticated;
grant insert (datum, member, jls_profile_id, service_id, usluga, iznos, vrsta, napomena) on public.crm_sales to authenticated;
grant select, insert, update, delete on public.crm_sales_targets to authenticated;
grant select, insert, update, delete on public.crm_week_entries to authenticated;
grant select on public.crm_forms to authenticated;
grant insert (naziv, uvod, owner, create_task, active), update (naziv, uvod, owner, create_task, active, token) on public.crm_forms to authenticated;
grant select on public.crm_form_submissions to authenticated;
grant select, insert, update, delete on public.crm_jls_targets, public.crm_jls_drafts, public.crm_jls_signals to authenticated;

revoke execute on function public.crm_offer_before(), public.crm_offer_item_before(), public.crm_offer_items_after(),
  public.crm_offer_after(), public.crm_offer_recalc(uuid), public.crm_sales_before(), public.crm_week_entry_before(),
  public.crm_jls_draft_effects(), public.crm_next_lead_owner()
  from public, anon, authenticated;
revoke execute on function public.crm_can_see_offer(uuid), public.crm_offer_is_draft(uuid), public.crm_set_offer_status(uuid, text, text),
  public.crm_sales_events(date, date), public.crm_jls_convert(uuid), public.crm_form_info(text), public.crm_form_submit(text, jsonb)
  from public;
revoke execute on function public.crm_can_see_offer(uuid), public.crm_offer_is_draft(uuid), public.crm_set_offer_status(uuid, text, text),
  public.crm_sales_events(date, date), public.crm_jls_convert(uuid)
  from anon;
grant execute on function public.crm_can_see_offer(uuid), public.crm_offer_is_draft(uuid), public.crm_set_offer_status(uuid, text, text),
  public.crm_sales_events(date, date), public.crm_jls_convert(uuid)
  to authenticated;
-- Javni upitnik: samo ove dvije funkcije su dostupne bez prijave.
grant execute on function public.crm_form_info(text), public.crm_form_submit(text, jsonb) to anon, authenticated;
