-- EU Radar CRM — Faza 1: prodajna jezgra
-- Leadovi, hot grupe (natječaji), zadaci, povijest aktivnosti, CRM podaci i kontakti klijenta,
-- brojke u izborniku. Klijent = postojeći jls_profiles (EU Radar), natječaj = calls.
-- Vidljivost: konzultant i više vide sve; suradnik samo svoje (vlasnik ili autor).

-- ------------------------------------------------------------------
-- Pomoćne funkcije
-- ------------------------------------------------------------------
create or replace function public.crm_today()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'Europe/Zagreb')::date;
$$;

-- Vidi li prijavljeni član zapis s ovim vlasnikom / autorom.
create or replace function public.crm_can_see(p_owner uuid, p_creator uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    r is not null and (r <> 'suradnik' or p_owner = auth.uid() or p_creator = auth.uid()),
    false)
  from (select public.crm_role() as r) x;
$$;

-- Smije li prijavljeni član raditi s CRM-om "punom snagom" (konzultant i više).
create or replace function public.crm_is_konzultant()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.crm_role() in ('superadmin','admin','konzultant'), false);
$$;

create or replace function public.crm_slugify(p text)
returns text language sql immutable set search_path = public as $$
  select left(trim(both '-' from regexp_replace(
    lower(translate(coalesce(p, ''), 'čćžšđČĆŽŠĐ', 'cczsdcczsd')), '[^a-z0-9]+', '-', 'g')), 50);
$$;

-- ------------------------------------------------------------------
-- CRM podaci klijenta (proširenje jls_profiles) i kontakti
-- ------------------------------------------------------------------
create table public.crm_clients (
  jls_profile_id uuid primary key references public.jls_profiles(id) on delete cascade,
  owner          uuid references public.profiles(id) on delete set null,
  oib            text,
  email          text,
  telefon        text,
  adresa         text,
  web            text,
  napomena       text,
  updated_at     timestamptz not null default now()
);

create or replace function public.crm_can_see_client(p_jls uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.crm_can_see((select owner from public.crm_clients where jls_profile_id = p_jls));
$$;

create table public.crm_contacts (
  id             uuid primary key default gen_random_uuid(),
  jls_profile_id uuid not null references public.jls_profiles(id) on delete cascade,
  ime            text not null check (length(trim(ime)) > 0),
  uloga          text,
  email          text,
  telefon        text,
  primarni       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index crm_contacts_client_idx on public.crm_contacts (jls_profile_id);

-- Novi primarni kontakt skida oznaku s ostalih.
create or replace function public.crm_contact_primary()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.primarni then
    update public.crm_contacts set primarni = false
     where jls_profile_id = new.jls_profile_id and id <> new.id and primarni;
  end if;
  return null;
end; $$;
create trigger crm_contacts_primary after insert or update of primarni on public.crm_contacts
  for each row execute function public.crm_contact_primary();

-- ------------------------------------------------------------------
-- Hot grupe (natječaji za hot leadove)
-- ------------------------------------------------------------------
create table public.crm_hot_groups (
  id            uuid primary key default gen_random_uuid(),
  naziv         text not null check (length(trim(naziv)) > 0),
  sifra         text,
  podnaslov     text,
  call_id       uuid references public.calls(id) on delete set null,
  deadline_on   date,
  deadline_note text check (deadline_note is null or length(deadline_note) <= 40),
  position      integer not null default 0,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Leadovi
-- ------------------------------------------------------------------
create table public.crm_leads (
  id               uuid primary key default gen_random_uuid(),
  broj             integer generated always as identity unique,
  naziv            text not null check (length(trim(naziv)) > 0),
  klijent_tip      public.klijent_tip not null default 'poduzece',
  jls_tip          public.jls_type,
  kontakt_ime      text,
  email            text,
  telefon          text,
  oib              text,
  zupanija         text,
  izvor            text not null default 'ostalo'
                   check (izvor in ('web','preporuka','telefon','email','sajam','linkedin','eu_radar','partner','ostalo')),
  interes          text,
  sektori          text[] not null default '{}',
  status           text not null default 'novi'
                   check (status in ('novi','kontaktiran','u_razgovoru','ponuda','pretvoren','izgubljen')),
  razlog_gubitka   text,
  owner            uuid references public.profiles(id) on delete set null default auth.uid(),
  t_prihvatljivost smallint check (t_prihvatljivost between 0 and 100),
  t_dokumentacija  smallint check (t_dokumentacija between 0 and 100),
  t_financije      smallint check (t_financije between 0 and 100),
  -- Trijaža: 50 % prihvatljivost · 25 % dokumentacija · 25 % financije (kao IPS Hub).
  trijaza          smallint generated always as (
                     case when t_prihvatljivost is null and t_dokumentacija is null and t_financije is null then null
                     else round(0.5 * coalesce(t_prihvatljivost, 0) + 0.25 * coalesce(t_dokumentacija, 0)
                                + 0.25 * coalesce(t_financije, 0))::smallint end) stored,
  napomena         text,
  hot_at           timestamptz,
  hot_group_id     uuid references public.crm_hot_groups(id) on delete set null,
  hot_note         text,
  hot_stage        text check (hot_stage in ('zeleno','zuto','crveno','sivo')),
  hot_position     integer not null default 0,
  jls_profile_id   uuid references public.jls_profiles(id) on delete set null,
  converted_at     timestamptz,
  archived_at      timestamptz,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index crm_leads_owner_idx  on public.crm_leads (owner);
create index crm_leads_hot_idx    on public.crm_leads (hot_group_id) where hot_at is not null;
create index crm_leads_client_idx on public.crm_leads (jls_profile_id);
create index crm_leads_email_idx  on public.crm_leads (lower(email));

-- ------------------------------------------------------------------
-- Zadaci
-- ------------------------------------------------------------------
create table public.crm_tasks (
  id             uuid primary key default gen_random_uuid(),
  naslov         text not null check (length(trim(naslov)) > 0),
  opis           text,
  vrsta          text not null default 'ostalo'
                 check (vrsta in ('poziv','dokument','ponuda','sastanak','odobrenje','objava','ostalo')),
  prioritet      text not null default 'srednji' check (prioritet in ('nizak','srednji','visok')),
  rok            date,
  vrijeme        time,
  owner          uuid references public.profiles(id) on delete set null default auth.uid(),
  lead_id        uuid references public.crm_leads(id) on delete set null,
  jls_profile_id uuid references public.jls_profiles(id) on delete set null,
  call_id        uuid references public.calls(id) on delete set null,
  done_at        timestamptz,
  archived_at    timestamptz,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index crm_tasks_owner_idx  on public.crm_tasks (owner, done_at);
create index crm_tasks_lead_idx   on public.crm_tasks (lead_id);
create index crm_tasks_client_idx on public.crm_tasks (jls_profile_id);

-- ------------------------------------------------------------------
-- Povijest aktivnosti (pozivi, bilješke, komentari, automatske promjene)
-- ------------------------------------------------------------------
create table public.crm_activities (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  actor          uuid references public.profiles(id) on delete set null default auth.uid(),
  actor_name     text,
  vrsta          text not null check (vrsta in ('poziv','biljeska','email','sastanak','komentar','promjena','zadatak')),
  body           text not null check (length(trim(body)) > 0),
  lead_id        uuid references public.crm_leads(id) on delete cascade,
  jls_profile_id uuid references public.jls_profiles(id) on delete cascade,
  task_id        uuid references public.crm_tasks(id) on delete cascade,
  meta           jsonb not null default '{}',
  check (lead_id is not null or jls_profile_id is not null or task_id is not null)
);
create index crm_act_lead_idx   on public.crm_activities (lead_id, at desc);
create index crm_act_client_idx on public.crm_activities (jls_profile_id, at desc);
create index crm_act_task_idx   on public.crm_activities (task_id, at desc);

create or replace function public.crm_can_see_activity(p_lead uuid, p_jls uuid, p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() and (
    (p_lead is not null and exists (select 1 from public.crm_leads l where l.id = p_lead and public.crm_can_see(l.owner, l.created_by)))
    or (p_jls is not null and public.crm_can_see_client(p_jls))
    or (p_task is not null and exists (select 1 from public.crm_tasks t where t.id = p_task and public.crm_can_see(t.owner, t.created_by)))
  );
$$;

-- Interni upis automatske stavke povijesti.
create or replace function public.crm_add_activity(p_vrsta text, p_body text, p_lead uuid, p_jls uuid, p_task uuid, p_meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.crm_activities (actor, actor_name, vrsta, body, lead_id, jls_profile_id, task_id, meta)
  values (auth.uid(), public.crm_actor_name(auth.uid()), p_vrsta, p_body, p_lead, p_jls, p_task, coalesce(p_meta, '{}'));
$$;

-- Ručni unos: autor je uvijek prijavljeni član; aktivnost osvježava "zadnju aktivnost" leada.
create or replace function public.crm_activity_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.at := now();
  new.actor := auth.uid();
  new.actor_name := public.crm_actor_name(auth.uid());
  return new;
end; $$;
create trigger crm_activities_before before insert on public.crm_activities
  for each row execute function public.crm_activity_before();

create or replace function public.crm_activity_after()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.vrsta <> 'promjena' then
    update public.crm_leads set last_activity_at = new.at where id = new.lead_id;
  end if;
  return null;
end; $$;
create trigger crm_activities_after after insert on public.crm_activities
  for each row execute function public.crm_activity_after();

-- ------------------------------------------------------------------
-- Okidači: updated_at, autor, pravila
-- ------------------------------------------------------------------
create or replace function public.crm_touch_row()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end; $$;
create trigger crm_clients_touch    before update on public.crm_clients    for each row execute function public.crm_touch_row();
create trigger crm_hot_groups_touch before update on public.crm_hot_groups for each row execute function public.crm_touch_row();
create trigger crm_leads_touch      before update on public.crm_leads      for each row execute function public.crm_touch_row();
create trigger crm_tasks_touch      before update on public.crm_tasks      for each row execute function public.crm_touch_row();

create or replace function public.crm_lead_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  if new.status = 'pretvoren' and new.jls_profile_id is null then
    raise exception 'Lead se pretvara u klijenta gumbom „Pretvori u klijenta“.';
  end if;
  if new.status <> 'izgubljen' then new.razlog_gubitka := null; end if;
  if new.hot_at is null then
    new.hot_group_id := null; new.hot_stage := null;
  end if;
  return new;
end; $$;
create trigger crm_leads_before before insert or update on public.crm_leads
  for each row execute function public.crm_lead_before();

-- Promjene na leadu upisuju se u njegovu povijest.
create or replace function public.crm_lead_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  st constant jsonb := '{"novi":"Novi","kontaktiran":"Kontaktiran","u_razgovoru":"U razgovoru","ponuda":"Ponuda","pretvoren":"Pretvoren u klijenta","izgubljen":"Izgubljen"}';
  v_old_g text; v_new_g text;
begin
  if tg_op = 'INSERT' then
    perform public.crm_add_activity('promjena', 'Lead je otvoren', new.id, null, null);
    return null;
  end if;
  if new.status is distinct from old.status then
    perform public.crm_add_activity('promjena',
      'Status: ' || coalesce(st->>old.status, old.status) || ' → ' || coalesce(st->>new.status, new.status)
      || case when new.status = 'izgubljen' and new.razlog_gubitka is not null then ' (' || new.razlog_gubitka || ')' else '' end,
      new.id, null, null);
  end if;
  if new.owner is distinct from old.owner then
    perform public.crm_add_activity('promjena',
      'Vlasnik: ' || coalesce(public.crm_actor_name(old.owner), 'nitko') || ' → ' || coalesce(public.crm_actor_name(new.owner), 'nitko'),
      new.id, null, null);
  end if;
  if new.trijaza is distinct from old.trijaza then
    perform public.crm_add_activity('promjena',
      'Trijaža: ' || coalesce(old.trijaza::text, '—') || ' → ' || coalesce(new.trijaza::text, '—'), new.id, null, null);
  end if;
  select naziv into v_old_g from public.crm_hot_groups where id = old.hot_group_id;
  select naziv into v_new_g from public.crm_hot_groups where id = new.hot_group_id;
  if old.hot_at is null and new.hot_at is not null then
    perform public.crm_add_activity('promjena', 'Označen kao hot lead' || coalesce(' · ' || v_new_g, ''), new.id, null, null);
  elsif old.hot_at is not null and new.hot_at is null then
    perform public.crm_add_activity('promjena', 'Maknut iz hot leadova', new.id, null, null);
  elsif new.hot_at is not null and new.hot_group_id is distinct from old.hot_group_id then
    perform public.crm_add_activity('promjena',
      'Hot lead premješten: ' || coalesce(v_old_g, case when old.hot_group_id is not null then 'obrisani natječaj' else 'bez natječaja' end) || ' → ' || coalesce(v_new_g, 'bez natječaja'), new.id, null, null);
  end if;
  if new.archived_at is not null and old.archived_at is null then
    perform public.crm_add_activity('promjena', 'Lead je arhiviran', new.id, null, null);
  elsif new.archived_at is null and old.archived_at is not null then
    perform public.crm_add_activity('promjena', 'Lead je vraćen iz arhive', new.id, null, null);
  end if;
  return null;
end; $$;
create trigger crm_leads_history after insert or update on public.crm_leads
  for each row execute function public.crm_lead_history();

create or replace function public.crm_task_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    if new.rok is not null and new.rok < public.crm_today() then
      raise exception 'Rok ne može biti u prošlosti.';
    end if;
  else
    if new.rok is distinct from old.rok and new.rok is not null and new.rok < public.crm_today() then
      raise exception 'Rok ne može biti u prošlosti.';
    end if;
    if new.archived_at is distinct from old.archived_at and public.crm_role() = 'suradnik'
       and old.created_by is distinct from auth.uid() then
      raise exception 'Suradnik smije arhivirati samo zadatak koji je sam napravio.';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.owner is distinct from old.owner) and new.owner is not null and not exists (
    select 1 from public.profiles where id = new.owner and staff_role is not null and staff_active
  ) then
    raise exception 'Zadatak se može dodijeliti samo aktivnom članu tima.';
  end if;
  return new;
end; $$;
create trigger crm_tasks_before before insert or update on public.crm_tasks
  for each row execute function public.crm_task_before();

-- Dovršen zadatak upisuje se u povijest povezanog leada / klijenta i samog zadatka.
create or replace function public.crm_task_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.crm_add_activity('promjena', 'Zadatak je otvoren', null, null, new.id);
    return null;
  end if;
  if new.done_at is not null and old.done_at is null then
    perform public.crm_add_activity('promjena', 'Označen kao dovršen', null, null, new.id);
    if new.lead_id is not null or new.jls_profile_id is not null then
      perform public.crm_add_activity('zadatak', 'Zadatak dovršen: ' || new.naslov, new.lead_id, new.jls_profile_id, null,
        jsonb_build_object('task_id', new.id));
    end if;
  elsif new.done_at is null and old.done_at is not null then
    perform public.crm_add_activity('promjena', 'Ponovno otvoren', null, null, new.id);
  end if;
  if new.owner is distinct from old.owner then
    perform public.crm_add_activity('promjena',
      'Vlasnik: ' || coalesce(public.crm_actor_name(old.owner), 'nitko') || ' → ' || coalesce(public.crm_actor_name(new.owner), 'nitko'),
      null, null, new.id);
  end if;
  if new.rok is distinct from old.rok then
    perform public.crm_add_activity('promjena',
      'Rok: ' || coalesce(to_char(old.rok, 'DD. MM. YYYY.'), 'bez roka') || ' → ' || coalesce(to_char(new.rok, 'DD. MM. YYYY.'), 'bez roka'),
      null, null, new.id);
  end if;
  if new.archived_at is not null and old.archived_at is null then
    perform public.crm_add_activity('promjena', 'Zadatak je arhiviran', null, null, new.id);
  end if;
  return null;
end; $$;
create trigger crm_tasks_history after insert or update on public.crm_tasks
  for each row execute function public.crm_task_history();

-- ------------------------------------------------------------------
-- Registracija na EU Radar → lead (izvor "eu_radar"). Nikad ne smije srušiti registraciju.
-- ------------------------------------------------------------------
create or replace function public.crm_lead_from_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.staff_role is null and new.email is not null
       and not exists (select 1 from public.crm_leads where lower(email) = lower(new.email))
       -- pozvani član tima nije lead
       and not exists (select 1 from public.crm_invitations i where lower(i.email) = lower(new.email)
                        and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
    then
      insert into public.crm_leads (naziv, email, izvor, owner, interes)
      values (new.email, new.email, 'eu_radar', null, 'Registracija na EU Radar');
    end if;
  exception when others then
    null;
  end;
  return null;
end; $$;
create trigger crm_profiles_lead after insert on public.profiles
  for each row execute function public.crm_lead_from_signup();

-- Postojeće registracije koje nisu tim → leadovi.
insert into public.crm_leads (naziv, email, izvor, owner, interes, created_at, last_activity_at)
select p.email, p.email, 'eu_radar', null, 'Registracija na EU Radar', p.created_at, p.created_at
from public.profiles p
where p.staff_role is null and p.email is not null
  and not exists (select 1 from public.crm_leads l where lower(l.email) = lower(p.email));

-- ------------------------------------------------------------------
-- Klijent: spremanje (novi / izmjena) i pretvorba leada
-- ------------------------------------------------------------------
create or replace function public.crm_save_client(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.staff_role := public.crm_role();
  v_id uuid := p_id; v_tenant uuid; v_slug text; v_owner uuid;
  v_naziv text := nullif(trim(p->>'naziv'), '');
  v_tip public.klijent_tip := coalesce(nullif(p->>'klijent_tip', ''), 'poduzece')::public.klijent_tip;
  v_status text := coalesce(nullif(p->>'status', ''), 'trial');
begin
  if r is null then raise exception 'Nemate pristup CRM-u.'; end if;
  if v_naziv is null then raise exception 'Naziv klijenta je obavezan.'; end if;
  if v_status not in ('aktivan','trial','pauziran') then raise exception 'Nepoznat status pretplate.'; end if;
  v_owner := nullif(p->>'owner', '')::uuid;

  if v_id is null then
    if r = 'suradnik' then raise exception 'Suradnik ne može dodavati klijente.'; end if;
    v_slug := public.crm_slugify(v_naziv) || '-' || substr(md5(random()::text), 1, 4);
    insert into public.tenants (slug, naziv, tip, status) values (v_slug, v_naziv, 'jls', v_status) returning id into v_tenant;
    insert into public.jls_profiles (tenant_id, slug, naziv, klijent_tip, tip, zupanija, stanovnika, ruralno, velicina,
                                     sektori_interesa, kontakt_osoba, status)
    values (v_tenant, v_slug, v_naziv, v_tip,
            case when v_tip = 'jls' then coalesce(nullif(p->>'tip', ''), 'opcina')::public.jls_type end,
            nullif(p->>'zupanija', ''),
            case when v_tip = 'jls' then nullif(p->>'stanovnika', '')::int end,
            v_tip = 'jls' and coalesce((p->>'ruralno')::boolean, false),
            case when v_tip = 'poduzece' then nullif(p->>'velicina', '') end,
            coalesce(array(select jsonb_array_elements_text(p->'sektori')), '{}'),
            nullif(p->>'kontakt_osoba', ''), v_status)
    returning id into v_id;
    insert into public.crm_clients (jls_profile_id, owner, oib, email, telefon, adresa, web, napomena)
    values (v_id, coalesce(v_owner, auth.uid()), nullif(p->>'oib', ''), nullif(p->>'email', ''), nullif(p->>'telefon', ''),
            nullif(p->>'adresa', ''), nullif(p->>'web', ''), nullif(p->>'napomena', ''));
    perform public.crm_add_activity('promjena', 'Klijent je otvoren u CRM-u', null, v_id, null);
    return v_id;
  end if;

  if not exists (select 1 from public.jls_profiles where id = v_id) or not public.crm_can_see_client(v_id) then
    raise exception 'Klijent ne postoji ili nemate pristup.';
  end if;
  if r = 'suradnik' and v_owner is distinct from (select owner from public.crm_clients where jls_profile_id = v_id) then
    raise exception 'Suradnik ne mijenja vlasnika klijenta.';
  end if;

  update public.jls_profiles set
    naziv = v_naziv,
    klijent_tip = v_tip,
    tip = case when v_tip = 'jls' then coalesce(nullif(p->>'tip', ''), 'opcina')::public.jls_type end,
    zupanija = nullif(p->>'zupanija', ''),
    stanovnika = case when v_tip = 'jls' then nullif(p->>'stanovnika', '')::int end,
    ruralno = v_tip = 'jls' and coalesce((p->>'ruralno')::boolean, false),
    velicina = case when v_tip = 'poduzece' then nullif(p->>'velicina', '') end,
    sektori_interesa = case when p ? 'sektori' then coalesce(array(select jsonb_array_elements_text(p->'sektori')), '{}') else sektori_interesa end,
    kontakt_osoba = nullif(p->>'kontakt_osoba', ''),
    status = v_status
  where id = v_id
  returning tenant_id into v_tenant;
  update public.tenants set naziv = v_naziv, status = v_status where id = v_tenant;

  insert into public.crm_clients (jls_profile_id, owner, oib, email, telefon, adresa, web, napomena)
  values (v_id, v_owner, nullif(p->>'oib', ''), nullif(p->>'email', ''), nullif(p->>'telefon', ''),
          nullif(p->>'adresa', ''), nullif(p->>'web', ''), nullif(p->>'napomena', ''))
  on conflict (jls_profile_id) do update set
    owner = excluded.owner, oib = excluded.oib, email = excluded.email, telefon = excluded.telefon,
    adresa = excluded.adresa, web = excluded.web, napomena = excluded.napomena;
  return v_id;
end; $$;

-- Pretvorba leada: novi klijent (EU Radar tenant + profil) ili povezivanje s postojećim.
create or replace function public.crm_convert_lead(p_lead uuid, p_existing uuid default null, p_status text default 'trial')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  l public.crm_leads; v_jls uuid; v_naziv text;
begin
  if public.crm_role() is null then raise exception 'Nemate pristup CRM-u.'; end if;
  select * into l from public.crm_leads where id = p_lead for update;
  if not found or not public.crm_can_see(l.owner, l.created_by) then raise exception 'Lead ne postoji ili nemate pristup.'; end if;
  if l.jls_profile_id is not null then raise exception 'Lead je već povezan s klijentom.'; end if;

  if p_existing is not null then
    if not exists (select 1 from public.jls_profiles where id = p_existing) or not public.crm_can_see_client(p_existing) then
      raise exception 'Odabrani klijent ne postoji ili nemate pristup.';
    end if;
    v_jls := p_existing;
  else
    if p_status not in ('aktivan','trial','pauziran') then raise exception 'Nepoznat status pretplate.'; end if;
    -- crm_save_client traži konzultanta za novog klijenta; vlasnik leada (i suradnik) smije pretvoriti svoj lead.
    v_naziv := l.naziv;
    declare v_tenant uuid; v_slug text := public.crm_slugify(v_naziv) || '-' || substr(md5(random()::text), 1, 4);
    begin
      insert into public.tenants (slug, naziv, tip, status) values (v_slug, v_naziv, 'jls', p_status) returning id into v_tenant;
      insert into public.jls_profiles (tenant_id, slug, naziv, klijent_tip, tip, zupanija, ruralno, sektori_interesa, kontakt_osoba, status)
      values (v_tenant, v_slug, v_naziv, l.klijent_tip,
              case when l.klijent_tip = 'jls' then coalesce(l.jls_tip, 'opcina') end,
              l.zupanija, false, l.sektori, l.kontakt_ime, p_status)
      returning id into v_jls;
    end;
    insert into public.crm_clients (jls_profile_id, owner, oib, email, telefon)
    values (v_jls, coalesce(l.owner, auth.uid()), l.oib, l.email, l.telefon);
    if coalesce(trim(l.kontakt_ime), '') <> '' then
      insert into public.crm_contacts (jls_profile_id, ime, email, telefon, primarni)
      values (v_jls, l.kontakt_ime, l.email, l.telefon, true);
    end if;
    perform public.crm_add_activity('promjena', 'Klijent je nastao iz leada L-' || l.broj, null, v_jls, null,
      jsonb_build_object('lead_id', l.id));
  end if;

  update public.crm_leads set jls_profile_id = v_jls, converted_at = now(), status = 'pretvoren' where id = p_lead;
  if p_existing is not null then
    perform public.crm_add_activity('promjena', 'Povezan lead L-' || l.broj || ' (' || l.naziv || ')', null, v_jls, null,
      jsonb_build_object('lead_id', l.id));
  end if;
  return v_jls;
end; $$;

-- ------------------------------------------------------------------
-- Brojke u izborniku ("novo od tvog zadnjeg posjeta")
-- ------------------------------------------------------------------
create table public.crm_nav_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key     text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, key)
);

create or replace function public.crm_mark_seen(p_key text)
returns void language sql security definer set search_path = public as $$
  insert into public.crm_nav_seen (user_id, key, seen_at)
  select auth.uid(), p_key, now() where public.is_staff() and p_key in ('leadovi','hot')
  on conflict (user_id, key) do update set seen_at = excluded.seen_at;
$$;

create or replace function public.crm_nav_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'leadovi'), now() - interval '7 days') as leadovi,
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'hot'), now() - interval '7 days') as hot
  )
  select case when not public.is_staff() then '{}'::jsonb else jsonb_build_object(
    'leadovi', (select count(*) from public.crm_leads l, s
                 where l.archived_at is null and l.created_at > s.leadovi and public.crm_can_see(l.owner, l.created_by)),
    'hot',     (select count(*) from public.crm_leads l, s
                 where l.archived_at is null and l.hot_at > s.hot and l.status not in ('pretvoren','izgubljen')
                   and public.crm_can_see(l.owner, l.created_by)),
    'zadaci',  (select count(*) from public.crm_tasks t
                 where t.owner = auth.uid() and t.done_at is null and t.archived_at is null and t.rok <= public.crm_today())
  ) end;
$$;

-- ------------------------------------------------------------------
-- Dnevnik: novi zapisi i natpis po zapisu
-- ------------------------------------------------------------------
create or replace function public.crm_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_row jsonb; v_diff jsonb := '{}'; v_action text; k text;
  v_skip text[] := array['updated_at','token','content_hash','last_activity_at','trijaza'];
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new); v_row := v_new; v_action := 'novo';
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any(v_skip)) and k <> 'id' and jsonb_typeof(v_new->k) <> 'null' then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_array(null, v_new->k));
      end if;
    end loop;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old); v_new := to_jsonb(new); v_row := v_new; v_action := 'izmjena';
    for k in select jsonb_object_keys(v_new) loop
      if not (k = any(v_skip)) and (v_old->k) is distinct from (v_new->k) then
        v_diff := v_diff || jsonb_build_object(k, jsonb_build_array(v_old->k, v_new->k));
      end if;
    end loop;
    if v_diff = '{}'::jsonb then return null; end if;
  else
    v_old := to_jsonb(old); v_row := v_old; v_action := 'brisanje';
  end if;

  insert into public.crm_audit_log (actor, actor_name, action, entity, entity_id, label, changes)
  values (
    auth.uid(),
    public.crm_actor_name(auth.uid()),
    v_action,
    tg_table_name,
    coalesce(v_row->>'id', v_row->>'jls_profile_id'),
    coalesce(v_row->>'naziv', v_row->>'naslov', v_row->>'ime', nullif(v_row->>'full_name', ''), v_row->>'email',
             v_row->>'slug', (select naziv from public.jls_profiles where id = (v_row->>'jls_profile_id')::uuid)),
    v_diff
  );
  return null;
end; $$;

create trigger crm_audit after insert or update or delete on public.crm_leads      for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_tasks      for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_hot_groups for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_clients    for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_contacts   for each row execute function public.crm_audit_row();

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------
alter table public.crm_clients    enable row level security;
alter table public.crm_contacts   enable row level security;
alter table public.crm_hot_groups enable row level security;
alter table public.crm_leads      enable row level security;
alter table public.crm_tasks      enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_nav_seen   enable row level security;

-- Tim vidi klijente EU Radara (suradnik samo svoje) — za CRM i za EU Radar sučelje.
create policy jls_staff_read on public.jls_profiles for select to authenticated
  using (public.crm_can_see_client(id));

create policy crm_clients_read on public.crm_clients for select to authenticated
  using (public.crm_can_see(owner));
-- Pisanje u crm_clients samo kroz crm_save_client / crm_convert_lead.

create policy crm_contacts_read on public.crm_contacts for select to authenticated
  using (public.crm_can_see_client(jls_profile_id));
create policy crm_contacts_write on public.crm_contacts for all to authenticated
  using (public.crm_can_see_client(jls_profile_id)) with check (public.crm_can_see_client(jls_profile_id));

create policy crm_hot_groups_read on public.crm_hot_groups for select to authenticated
  using (public.is_staff());
create policy crm_hot_groups_write on public.crm_hot_groups for all to authenticated
  using (public.crm_is_konzultant()) with check (public.crm_is_konzultant());

create policy crm_leads_read on public.crm_leads for select to authenticated
  using (public.crm_can_see(owner, created_by));
create policy crm_leads_insert on public.crm_leads for insert to authenticated
  with check (public.is_staff() and public.crm_can_see(owner, auth.uid()));
create policy crm_leads_update on public.crm_leads for update to authenticated
  using (public.crm_can_see(owner, created_by)) with check (public.crm_can_see(owner, created_by));

create policy crm_tasks_read on public.crm_tasks for select to authenticated
  using (public.crm_can_see(owner, created_by));
create policy crm_tasks_insert on public.crm_tasks for insert to authenticated
  with check (public.is_staff() and public.crm_can_see(owner, auth.uid())
              and (lead_id is null or exists (select 1 from public.crm_leads l where l.id = lead_id))
              and (jls_profile_id is null or public.crm_can_see_client(jls_profile_id)));
create policy crm_tasks_update on public.crm_tasks for update to authenticated
  using (public.crm_can_see(owner, created_by)) with check (public.crm_can_see(owner, created_by));

create policy crm_activities_read on public.crm_activities for select to authenticated
  using (public.crm_can_see_activity(lead_id, jls_profile_id, task_id));
create policy crm_activities_insert on public.crm_activities for insert to authenticated
  with check (vrsta in ('poziv','biljeska','email','sastanak','komentar')
              and public.crm_can_see_activity(lead_id, jls_profile_id, task_id));

create policy crm_nav_seen_own on public.crm_nav_seen for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- Ovlasti (bez brisanja leadova/zadataka — arhiviraju se)
-- ------------------------------------------------------------------
revoke all on public.crm_clients, public.crm_contacts, public.crm_hot_groups, public.crm_leads,
              public.crm_tasks, public.crm_activities, public.crm_nav_seen from anon, authenticated;

grant select on public.crm_clients, public.crm_contacts, public.crm_hot_groups, public.crm_leads,
                public.crm_tasks, public.crm_activities, public.crm_nav_seen to authenticated;
grant insert, update, delete on public.crm_contacts to authenticated;
grant insert, update, delete on public.crm_hot_groups to authenticated;
grant insert (naziv, klijent_tip, jls_tip, kontakt_ime, email, telefon, oib, zupanija, izvor, interes, sektori, status,
              razlog_gubitka, owner, t_prihvatljivost, t_dokumentacija, t_financije, napomena,
              hot_at, hot_group_id, hot_note, hot_stage, hot_position)
  on public.crm_leads to authenticated;
grant update (naziv, klijent_tip, jls_tip, kontakt_ime, email, telefon, oib, zupanija, izvor, interes, sektori, status,
              razlog_gubitka, owner, t_prihvatljivost, t_dokumentacija, t_financije, napomena,
              hot_at, hot_group_id, hot_note, hot_stage, hot_position, archived_at)
  on public.crm_leads to authenticated;
grant insert (naslov, opis, vrsta, prioritet, rok, vrijeme, owner, lead_id, jls_profile_id, call_id)
  on public.crm_tasks to authenticated;
grant update (naslov, opis, vrsta, prioritet, rok, vrijeme, owner, lead_id, jls_profile_id, call_id, done_at, archived_at)
  on public.crm_tasks to authenticated;
grant insert (vrsta, body, lead_id, jls_profile_id, task_id) on public.crm_activities to authenticated;

-- Funkcije: interne samo za okidače; ostale samo za prijavljene.
revoke execute on function public.crm_contact_primary(), public.crm_activity_before(), public.crm_activity_after(),
  public.crm_lead_before(), public.crm_lead_history(), public.crm_task_before(), public.crm_task_history(),
  public.crm_lead_from_signup(), public.crm_add_activity(text, text, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke execute on function public.crm_today(), public.crm_can_see(uuid, uuid), public.crm_is_konzultant(),
  public.crm_slugify(text), public.crm_can_see_client(uuid), public.crm_can_see_activity(uuid, uuid, uuid),
  public.crm_save_client(uuid, jsonb), public.crm_convert_lead(uuid, uuid, text),
  public.crm_mark_seen(text), public.crm_nav_counts()
  from public, anon;
grant execute on function public.crm_today(), public.crm_can_see(uuid, uuid), public.crm_is_konzultant(),
  public.crm_slugify(text), public.crm_can_see_client(uuid), public.crm_can_see_activity(uuid, uuid, uuid),
  public.crm_save_client(uuid, jsonb), public.crm_convert_lead(uuid, uuid, text),
  public.crm_mark_seen(text), public.crm_nav_counts()
  to authenticated;
