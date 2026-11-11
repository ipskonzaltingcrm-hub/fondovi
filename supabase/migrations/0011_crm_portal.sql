-- EU Radar CRM — Faza 4: korisnici portala (EU Radar), pozivnice za klijente, kontrola registracije,
-- pretplate i uplate, poruke korisnicima (obavijesti u aplikaciji EU Radar).
-- E-mailove CRM i dalje ne šalje sam: poruke stižu u aplikaciju (Obavijesti), a za e-mail se izvoze adrese.

insert into public.crm_settings (key, value) values ('registration', '{"mode":"otvorena"}');

-- ------------------------------------------------------------------
-- Korisnici portala: oznaka, napomena, blokada
-- ------------------------------------------------------------------
alter table public.profiles add column portal_blocked_at timestamptz;

create table public.crm_portal_meta (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  oznaka     text not null default 'novi' check (oznaka in ('novi','provjeren','sumnjiv','konkurencija','testni')),
  napomena   text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.crm_portal_invites (
  id             uuid primary key default gen_random_uuid(),
  email          text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  jls_profile_id uuid not null references public.jls_profiles(id) on delete cascade,
  role           public.member_role not null default 'member' check (role in ('tenant_admin','member','viewer')),
  token          text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '14 days',
  accepted_at    timestamptz,
  accepted_by    uuid references public.profiles(id) on delete set null,
  revoked_at     timestamptz
);
create index crm_portal_invites_email_idx on public.crm_portal_invites (lower(email));

-- Registracija samo uz pozivnicu (kad je uključeno): blokira stvaranje novog korisnika u auth.users.
create or replace function public.crm_signup_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_mode text;
begin
  select value->>'mode' into v_mode from public.crm_settings where key = 'registration';
  if coalesce(v_mode, 'otvorena') = 'pozivnica' and new.email is not null
     and lower(new.email) <> 'ams@ips-konzalting.hr'
     and not exists (select 1 from public.crm_invitations i where lower(i.email) = lower(new.email)
                      and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
     and not exists (select 1 from public.crm_portal_invites i where lower(i.email) = lower(new.email)
                      and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  then
    raise exception 'Registracija na EU Radar trenutno je moguća samo uz pozivnicu.';
  end if;
  return new;
end; $$;
create trigger crm_signup_guard before insert on auth.users
  for each row execute function public.crm_signup_guard();

-- Pozvani korisnik pri registraciji odmah dobiva pristup klijentu.
create or replace function public.crm_portal_accept_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare i record;
begin
  begin
    for i in select * from public.crm_portal_invites
              where lower(email) = lower(new.email) and accepted_at is null and revoked_at is null and expires_at > now()
    loop
      insert into public.memberships (tenant_id, user_id, role)
      select j.tenant_id, new.id, i.role from public.jls_profiles j where j.id = i.jls_profile_id
      on conflict (tenant_id, user_id) do update set role = excluded.role;
      update public.crm_portal_invites set accepted_at = now(), accepted_by = new.id where id = i.id;
    end loop;
  exception when others then null;
  end;
  return null;
end; $$;
create trigger crm_portal_accept_signup after insert on public.profiles
  for each row execute function public.crm_portal_accept_signup();

-- Registracija → lead: preskače pozvane korisnike klijenata (i članove tima).
create or replace function public.crm_lead_from_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.staff_role is null and new.email is not null
       and not exists (select 1 from public.crm_leads where lower(email) = lower(new.email))
       and not exists (select 1 from public.crm_invitations i where lower(i.email) = lower(new.email)
                        and i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
       and not exists (select 1 from public.crm_portal_invites i where lower(i.email) = lower(new.email) and i.revoked_at is null)
       and not exists (select 1 from public.memberships m where m.user_id = new.id)
    then
      insert into public.crm_leads (naziv, email, izvor, owner, interes)
      values (new.email, new.email, 'eu_radar', null, 'Registracija na EU Radar');
    end if;
  exception when others then
    null;
  end;
  return null;
end; $$;

-- ------------------------------------------------------------------
-- RPC: popis korisnika portala i upravljanje
-- ------------------------------------------------------------------
create or replace function public.crm_portal_users()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.crm_is_konzultant() then raise exception 'Korisnike portala vide konzultanti i administratori.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'email', p.email,
      'full_name', p.full_name,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'blocked_at', p.portal_blocked_at,
      'oznaka', coalesce(m.oznaka, 'novi'),
      'napomena', m.napomena,
      'lead_id', (select l.id from public.crm_leads l where lower(l.email) = lower(p.email) order by l.created_at limit 1),
      'clanstva', coalesce((select jsonb_agg(jsonb_build_object('jls_profile_id', j.id, 'naziv', j.naziv, 'status', j.status, 'role', ms.role))
                             from public.memberships ms join public.jls_profiles j on j.tenant_id = ms.tenant_id
                            where ms.user_id = p.id), '[]'::jsonb)
    ) order by u.created_at desc)
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.crm_portal_meta m on m.user_id = p.id
    where p.staff_role is null
  ), '[]'::jsonb);
end; $$;

create or replace function public.crm_portal_set_membership(p_user uuid, p_jls uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_naziv text;
begin
  if not public.crm_is_konzultant() then raise exception 'Pristup klijentima dodjeljuju konzultanti i administratori.'; end if;
  if exists (select 1 from public.profiles where id = p_user and staff_role is not null) then
    raise exception 'Članovi tima ne dobivaju pristup preko klijenta.';
  end if;
  select tenant_id, naziv into v_tenant, v_naziv from public.jls_profiles where id = p_jls;
  if v_tenant is null then raise exception 'Klijent ne postoji.'; end if;
  if p_role is null then
    delete from public.memberships where tenant_id = v_tenant and user_id = p_user;
    insert into public.crm_activities (vrsta, body, jls_profile_id)
    values ('promjena', 'Uklonjen pristup EU Radaru: ' || coalesce((select email from public.profiles where id = p_user), '?'), p_jls);
  else
    if p_role not in ('tenant_admin','member','viewer') then raise exception 'Nepoznata uloga.'; end if;
    insert into public.memberships (tenant_id, user_id, role) values (v_tenant, p_user, p_role::public.member_role)
    on conflict (tenant_id, user_id) do update set role = excluded.role;
    insert into public.crm_activities (vrsta, body, jls_profile_id)
    values ('promjena', 'Pristup EU Radaru: ' || coalesce((select email from public.profiles where id = p_user), '?'), p_jls);
  end if;
end; $$;

create or replace function public.crm_portal_set_meta(p_user uuid, p_oznaka text, p_napomena text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.crm_is_konzultant() then raise exception 'Nemate ovlast.'; end if;
  if p_oznaka not in ('novi','provjeren','sumnjiv','konkurencija','testni') then raise exception 'Nepoznata oznaka.'; end if;
  insert into public.crm_portal_meta (user_id, oznaka, napomena, updated_by, updated_at)
  values (p_user, p_oznaka, nullif(trim(p_napomena), ''), auth.uid(), now())
  on conflict (user_id) do update set oznaka = excluded.oznaka, napomena = excluded.napomena, updated_by = auth.uid(), updated_at = now();
end; $$;

-- Blokada pristupa EU Radaru (administratori). Blokiranom se brišu prijave.
create or replace function public.crm_portal_block(p_user uuid, p_block boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_crm_admin() then raise exception 'Korisnike blokiraju administratori.'; end if;
  if exists (select 1 from public.profiles where id = p_user and (staff_role is not null or is_superadmin)) then
    raise exception 'Člana tima ne možete blokirati ovdje (Tim i uloge).';
  end if;
  update public.profiles set portal_blocked_at = case when p_block then now() end where id = p_user;
  if p_block then delete from auth.sessions where user_id = p_user; end if;
end; $$;

create or replace function public.crm_portal_invite(p_email text, p_jls uuid, p_role text default 'member')
returns text language plpgsql security definer set search_path = public as $$
declare v_token text; v_email text := lower(trim(p_email));
begin
  if not public.crm_is_konzultant() then raise exception 'Pozivnice šalju konzultanti i administratori.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail adresa nije ispravna.'; end if;
  if not exists (select 1 from public.jls_profiles where id = p_jls) then raise exception 'Klijent ne postoji.'; end if;
  if p_role not in ('tenant_admin','member','viewer') then raise exception 'Nepoznata uloga.'; end if;
  update public.crm_portal_invites set revoked_at = now()
   where lower(email) = v_email and jls_profile_id = p_jls and accepted_at is null and revoked_at is null;
  insert into public.crm_portal_invites (email, jls_profile_id, role) values (v_email, p_jls, p_role::public.member_role)
  returning token into v_token;
  insert into public.crm_activities (vrsta, body, jls_profile_id) values ('promjena', 'Pozivnica u EU Radar: ' || v_email, p_jls);
  return v_token;
end; $$;

create or replace function public.crm_portal_revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.crm_is_konzultant() then raise exception 'Nemate ovlast.'; end if;
  update public.crm_portal_invites set revoked_at = now() where id = p_id and accepted_at is null and revoked_at is null;
end; $$;

create or replace function public.crm_portal_invite_info(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'email', i.email, 'naziv', j.naziv,
    'status', case when i.revoked_at is not null then 'opozvana' when i.accepted_at is not null then 'iskoristena'
                   when i.expires_at < now() then 'istekla' else 'vrijedi' end)
  from public.crm_portal_invites i join public.jls_profiles j on j.id = i.jls_profile_id
  where i.token = p_token;
$$;

create or replace function public.crm_portal_accept(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare i public.crm_portal_invites; v_email text := lower(auth.jwt()->>'email');
begin
  if auth.uid() is null then raise exception 'Prijavite se.'; end if;
  select * into i from public.crm_portal_invites where token = p_token for update;
  if not found then raise exception 'Pozivnica ne postoji.'; end if;
  if i.revoked_at is not null then raise exception 'Pozivnica je opozvana.'; end if;
  if i.accepted_at is not null then
    if i.accepted_by = auth.uid() then return i.jls_profile_id; end if;
    raise exception 'Pozivnica je već iskorištena.';
  end if;
  if i.expires_at < now() then raise exception 'Pozivnica je istekla — zatražite novu.'; end if;
  if lower(i.email) <> v_email then raise exception 'Pozivnica je poslana na drugu e-mail adresu (%).', i.email; end if;
  insert into public.memberships (tenant_id, user_id, role)
  select j.tenant_id, auth.uid(), i.role from public.jls_profiles j where j.id = i.jls_profile_id
  on conflict (tenant_id, user_id) do update set role = excluded.role;
  update public.crm_portal_invites set accepted_at = now(), accepted_by = auth.uid() where id = i.id;
  insert into public.crm_activities (vrsta, body, jls_profile_id) values ('promjena', 'Pozivnicu u EU Radar prihvatio: ' || i.email, i.jls_profile_id);
  return i.jls_profile_id;
end; $$;

-- ------------------------------------------------------------------
-- Pretplate i uplate
-- ------------------------------------------------------------------
create table public.crm_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  jls_profile_id uuid not null references public.jls_profiles(id) on delete cascade,
  service_id     uuid references public.crm_services(id) on delete set null,
  paket          text not null,
  od             date not null,
  "do"           date not null,
  iznos          numeric(14,2),
  status         text not null default 'aktivna' check (status in ('aktivna','otkazana')),
  napomena       text,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  check ("do" >= od)
);
create index crm_subscriptions_client_idx on public.crm_subscriptions (jls_profile_id, "do" desc);

create table public.crm_payments (
  id              uuid primary key default gen_random_uuid(),
  jls_profile_id  uuid not null references public.jls_profiles(id) on delete cascade,
  subscription_id uuid references public.crm_subscriptions(id) on delete set null,
  iznos           numeric(14,2) not null check (iznos > 0),
  datum           date not null default (now() at time zone 'Europe/Zagreb')::date,
  nacin           text not null default 'virman' check (nacin in ('virman','kartica','gotovina','ostalo')),
  napomena        text,
  created_by      uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

-- Evidentiraj uplatu pretplate: nova/produžena pretplata, uplata, prodaja, status klijenta, povijest, zadatak „Izdaj račun“.
create or replace function public.crm_record_payment(
  p_jls uuid, p_iznos numeric, p_datum date, p_nacin text, p_service uuid, p_mjeseci int default 12, p_napomena text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_od date; v_do date; v_sub uuid; v_paket text; v_naziv text; v_tenant uuid;
begin
  if not public.crm_is_konzultant() then raise exception 'Uplate evidentiraju konzultanti i administratori.'; end if;
  if p_iznos is null or p_iznos <= 0 then raise exception 'Upišite iznos uplate.'; end if;
  if p_mjeseci is null or p_mjeseci < 1 or p_mjeseci > 36 then raise exception 'Trajanje pretplate: 1–36 mjeseci.'; end if;
  if p_nacin not in ('virman','kartica','gotovina','ostalo') then raise exception 'Nepoznat način plaćanja.'; end if;
  select naziv, tenant_id into v_naziv, v_tenant from public.jls_profiles where id = p_jls;
  if v_naziv is null then raise exception 'Klijent ne postoji.'; end if;
  v_paket := coalesce((select naziv from public.crm_services where id = p_service), 'Pretplata EU Radar');

  -- Nastavak na aktivnu pretplatu (bez praznine), inače od datuma uplate.
  select max("do") + 1 into v_od from public.crm_subscriptions
   where jls_profile_id = p_jls and status = 'aktivna' and "do" >= coalesce(p_datum, public.crm_today());
  v_od := coalesce(v_od, coalesce(p_datum, public.crm_today()));
  v_do := (v_od + make_interval(months => p_mjeseci))::date - 1;

  insert into public.crm_subscriptions (jls_profile_id, service_id, paket, od, "do", iznos, napomena)
  values (p_jls, p_service, v_paket, v_od, v_do, p_iznos, nullif(trim(p_napomena), ''))
  returning id into v_sub;
  insert into public.crm_payments (jls_profile_id, subscription_id, iznos, datum, nacin, napomena)
  values (p_jls, v_sub, p_iznos, coalesce(p_datum, public.crm_today()), p_nacin, nullif(trim(p_napomena), ''));
  insert into public.crm_sales (datum, member, jls_profile_id, service_id, usluga, iznos, vrsta, napomena)
  values (coalesce(p_datum, public.crm_today()), auth.uid(), p_jls, p_service, v_paket, round(p_iznos / 1.25, 2), 'nova',
          'Uplata pretplate (' || p_nacin || '), iznos bez PDV-a izračunat iz uplaćenog s 25 % PDV-a');
  update public.jls_profiles set status = 'aktivan' where id = p_jls;
  update public.tenants set status = 'aktivan' where id = v_tenant;
  insert into public.crm_activities (vrsta, body, jls_profile_id)
  values ('promjena', 'Uplata ' || p_iznos || ' € — ' || v_paket || ', pretplata ' || to_char(v_od, 'DD. MM. YYYY.') || ' – ' || to_char(v_do, 'DD. MM. YYYY.'), p_jls);
  insert into public.crm_tasks (naslov, vrsta, prioritet, rok, owner, jls_profile_id)
  values ('Izdaj račun: ' || v_naziv || ' (' || p_iznos || ' €)', 'dokument', 'visok', public.crm_today() + 1, auth.uid(), p_jls);
  return v_sub;
end; $$;

create or replace function public.crm_cancel_subscription(p_id uuid, p_pauziraj boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_jls uuid;
begin
  if not public.crm_is_konzultant() then raise exception 'Nemate ovlast.'; end if;
  update public.crm_subscriptions set status = 'otkazana' where id = p_id returning jls_profile_id into v_jls;
  if v_jls is null then raise exception 'Pretplata ne postoji.'; end if;
  insert into public.crm_activities (vrsta, body, jls_profile_id) values ('promjena', 'Pretplata je otkazana', v_jls);
  if p_pauziraj then
    update public.jls_profiles set status = 'pauziran' where id = v_jls;
    update public.tenants set status = 'pauziran' where id = (select tenant_id from public.jls_profiles where id = v_jls);
  end if;
end; $$;

-- ------------------------------------------------------------------
-- Poruke korisnicima (obavijesti u aplikaciji EU Radar)
-- ------------------------------------------------------------------
create table public.crm_messages (
  id          uuid primary key default gen_random_uuid(),
  naslov      text not null check (length(trim(naslov)) > 0),
  tekst       text not null default '',
  link        text,
  vrsta       text not null default 'obavijest' check (vrsta in ('obavijest','natjecaj','podsjetnik')),
  call_id     uuid references public.calls(id) on delete set null,
  audience    jsonb not null default '{"type":"svi"}',
  status      text not null default 'nacrt' check (status in ('nacrt','poslano')),
  sent_at     timestamptz,
  recipients  integer not null default 0,
  archived_at timestamptz,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.crm_message_deliveries (
  message_id uuid not null references public.crm_messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  primary key (message_id, user_id)
);
create index crm_message_deliveries_user_idx on public.crm_message_deliveries (user_id, created_at desc);

-- Primatelji po publici: svi | clanovi | aktivni | probni | bez_klijenta | testni | klijenti {ids}
create or replace function public.crm_message_recipients(p_audience jsonb)
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = public as $$
declare t text := coalesce(p_audience->>'type', 'svi');
begin
  if not public.crm_is_konzultant() then raise exception 'Nemate ovlast.'; end if;
  return query
  select p.id, p.email from public.profiles p
  left join public.crm_portal_meta m on m.user_id = p.id
  where p.staff_role is null and p.portal_blocked_at is null
    and coalesce(m.oznaka, 'novi') <> 'konkurencija'
    and case t
      when 'svi' then true
      when 'testni' then m.oznaka = 'testni'
      when 'clanovi' then exists (select 1 from public.memberships ms where ms.user_id = p.id)
      when 'bez_klijenta' then not exists (select 1 from public.memberships ms where ms.user_id = p.id)
      when 'aktivni' then exists (select 1 from public.memberships ms join public.jls_profiles j on j.tenant_id = ms.tenant_id
                                   where ms.user_id = p.id and j.status = 'aktivan')
      when 'probni' then exists (select 1 from public.memberships ms join public.jls_profiles j on j.tenant_id = ms.tenant_id
                                  where ms.user_id = p.id and j.status = 'trial')
      when 'klijenti' then exists (select 1 from public.memberships ms join public.jls_profiles j on j.tenant_id = ms.tenant_id
                                    where ms.user_id = p.id
                                      and j.id::text in (select jsonb_array_elements_text(coalesce(p_audience->'ids', '[]'::jsonb))))
      else false end;
end; $$;

-- Slanje: probno (samo testni korisnici) ili stvarno (zaključava poruku).
create or replace function public.crm_send_message(p_id uuid, p_test boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare msg public.crm_messages; n int;
begin
  if not public.crm_is_konzultant() then raise exception 'Poruke šalju konzultanti i administratori.'; end if;
  select * into msg from public.crm_messages where id = p_id for update;
  if not found then raise exception 'Poruka ne postoji.'; end if;
  if msg.status = 'poslano' then raise exception 'Poruka je već poslana.'; end if;
  insert into public.crm_message_deliveries (message_id, user_id)
  select p_id, r.user_id from public.crm_message_recipients(case when p_test then '{"type":"testni"}'::jsonb else msg.audience end) r
  on conflict do nothing;
  get diagnostics n = row_count;
  if not p_test then
    update public.crm_messages set status = 'poslano', sent_at = now(),
      recipients = (select count(*) from public.crm_message_deliveries where message_id = p_id) where id = p_id;
  end if;
  return n;
end; $$;

create or replace function public.crm_mark_message_read(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.crm_message_deliveries set read_at = coalesce(read_at, now())
  where message_id = p_id and user_id = auth.uid();
$$;

create trigger crm_messages_touch before update on public.crm_messages for each row execute function public.crm_touch_row();

create or replace function public.crm_message_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.status = 'poslano' and (new.naslov is distinct from old.naslov or new.tekst is distinct from old.tekst
     or new.audience is distinct from old.audience or new.link is distinct from old.link) then
    raise exception 'Poslana poruka se ne mijenja — napravi kopiju.';
  end if;
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  return new;
end; $$;
create trigger crm_messages_before before insert or update on public.crm_messages
  for each row execute function public.crm_message_before();

-- ------------------------------------------------------------------
-- Brojke u izborniku: + korisnici (nove registracije od zadnjeg posjeta, konzultant+)
-- ------------------------------------------------------------------
create or replace function public.crm_mark_seen(p_key text)
returns void language sql security definer set search_path = public as $$
  insert into public.crm_nav_seen (user_id, key, seen_at)
  select auth.uid(), p_key, now() where public.is_staff() and p_key in ('leadovi','hot','natjecaji','korisnici')
  on conflict (user_id, key) do update set seen_at = excluded.seen_at;
$$;

create or replace function public.crm_nav_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'leadovi'), now() - interval '7 days') as leadovi,
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'hot'), now() - interval '7 days') as hot,
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'natjecaji'), now() - interval '7 days') as natjecaji,
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'korisnici'), now() - interval '7 days') as korisnici
  )
  select case when not public.is_staff() then '{}'::jsonb else jsonb_build_object(
    'leadovi', (select count(*) from public.crm_leads l, s
                 where l.archived_at is null and l.created_at > s.leadovi and public.crm_can_see(l.owner, l.created_by)),
    'hot',     (select count(*) from public.crm_leads l, s
                 where l.archived_at is null and l.hot_at > s.hot and l.status not in ('pretvoren','izgubljen')
                   and public.crm_can_see(l.owner, l.created_by)),
    'zadaci',  (select count(*) from public.crm_tasks t
                 where t.owner = auth.uid() and t.done_at is null and t.archived_at is null and t.rok <= public.crm_today()),
    'natjecaji', (select count(*) from public.calls c cross join s
                   left join public.crm_call_meta m on m.call_id = c.id
                   where c.created_at > s.natjecaji and c.status <> 'zatvoren'
                     and (c.rok_prijave is null or c.rok_prijave >= public.crm_today())
                     and m.archived_at is null and coalesce(m.relevance, '') not in ('niska','nebitno')),
    'korisnici', case when public.crm_is_konzultant() then
                   (select count(*) from public.profiles p, s where p.staff_role is null and p.created_at > s.korisnici) else 0 end
  ) end;
$$;

-- ------------------------------------------------------------------
-- Dnevnik
-- ------------------------------------------------------------------
create trigger crm_audit after insert or update or delete on public.crm_portal_invites for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_subscriptions  for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_payments       for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_messages       for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_portal_meta    for each row execute function public.crm_audit_row();
create trigger crm_audit_memberships after insert or update or delete on public.memberships for each row execute function public.crm_audit_row();

-- ------------------------------------------------------------------
-- RLS i ovlasti
-- ------------------------------------------------------------------
alter table public.crm_portal_meta        enable row level security;
alter table public.crm_portal_invites     enable row level security;
alter table public.crm_subscriptions      enable row level security;
alter table public.crm_payments           enable row level security;
alter table public.crm_messages           enable row level security;
alter table public.crm_message_deliveries enable row level security;

create policy crm_portal_meta_read    on public.crm_portal_meta    for select to authenticated using (public.crm_is_konzultant());
create policy crm_portal_invites_read on public.crm_portal_invites for select to authenticated using (public.crm_is_konzultant());
create policy crm_subscriptions_read  on public.crm_subscriptions  for select to authenticated
  using (public.crm_is_konzultant() or public.is_member((select tenant_id from public.jls_profiles where id = jls_profile_id)));
create policy crm_payments_read       on public.crm_payments       for select to authenticated using (public.crm_is_konzultant());

create policy crm_messages_read on public.crm_messages for select to authenticated
  using (public.is_staff() or exists (select 1 from public.crm_message_deliveries d where d.message_id = crm_messages.id and d.user_id = auth.uid()));
create policy crm_messages_write on public.crm_messages for all to authenticated
  using (public.crm_is_konzultant()) with check (public.crm_is_konzultant());
create policy crm_message_deliveries_read on public.crm_message_deliveries for select to authenticated
  using (user_id = auth.uid() or public.crm_is_konzultant());

revoke all on public.crm_portal_meta, public.crm_portal_invites, public.crm_subscriptions, public.crm_payments,
              public.crm_messages, public.crm_message_deliveries from anon, authenticated;
grant select on public.crm_portal_meta, public.crm_portal_invites, public.crm_subscriptions, public.crm_payments,
                public.crm_message_deliveries to authenticated;
grant select on public.crm_messages to authenticated;
grant insert (naslov, tekst, link, vrsta, call_id, audience), update (naslov, tekst, link, vrsta, call_id, audience, archived_at)
  on public.crm_messages to authenticated;

revoke execute on function public.crm_signup_guard(), public.crm_portal_accept_signup(), public.crm_message_before()
  from public, anon, authenticated;
revoke execute on function public.crm_portal_users(), public.crm_portal_set_membership(uuid, uuid, text),
  public.crm_portal_set_meta(uuid, text, text), public.crm_portal_block(uuid, boolean),
  public.crm_portal_invite(text, uuid, text), public.crm_portal_revoke_invite(uuid), public.crm_portal_invite_info(text),
  public.crm_portal_accept(text), public.crm_record_payment(uuid, numeric, date, text, uuid, int, text),
  public.crm_cancel_subscription(uuid, boolean), public.crm_message_recipients(jsonb), public.crm_send_message(uuid, boolean),
  public.crm_mark_message_read(uuid), public.crm_mark_seen(text), public.crm_nav_counts()
  from public, anon;
grant execute on function public.crm_portal_users(), public.crm_portal_set_membership(uuid, uuid, text),
  public.crm_portal_set_meta(uuid, text, text), public.crm_portal_block(uuid, boolean),
  public.crm_portal_invite(text, uuid, text), public.crm_portal_revoke_invite(uuid), public.crm_portal_invite_info(text),
  public.crm_portal_accept(text), public.crm_record_payment(uuid, numeric, date, text, uuid, int, text),
  public.crm_cancel_subscription(uuid, boolean), public.crm_message_recipients(jsonb), public.crm_send_message(uuid, boolean),
  public.crm_mark_message_read(uuid), public.crm_mark_seen(text), public.crm_nav_counts()
  to authenticated;
