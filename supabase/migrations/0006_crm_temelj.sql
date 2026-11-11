-- EU Radar CRM — Faza 0 (temelj): uloge tima, pozivnice, dnevnik izmjena, prijave tima.
-- Tim je podskup korisnika EU Radara: profiles.staff_role IS NOT NULL. Pretplatnici (klijenti) nemaju staff_role.
-- Sve izmjene uloga idu kroz SECURITY DEFINER funkcije (korisnik smije mijenjati samo svoje ime, vidi 0005).

-- ------------------------------------------------------------------
-- Uloge tima
-- ------------------------------------------------------------------
create type public.staff_role as enum ('superadmin','admin','konzultant','suradnik');

alter table public.profiles
  add column staff_role   public.staff_role,
  add column staff_active boolean not null default true,
  add column short_name   text,
  add column job_title    text,
  add column phone        text,
  add column staff_since  timestamptz;

-- Vlasnica (is_superadmin) je i superadmin CRM-a.
update public.profiles set staff_role = 'superadmin', staff_since = now() where is_superadmin;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner boolean := lower(new.email) = 'ams@ips-konzalting.hr';
begin
  insert into public.profiles (id, email, full_name, is_superadmin, staff_role, staff_since)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_owner,
    case when v_owner then 'superadmin'::public.staff_role end,
    case when v_owner then now() end
  )
  on conflict (id) do nothing;
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Uloga prijavljenog člana tima (null = nije u timu ili je deaktiviran).
create or replace function public.crm_role()
returns public.staff_role language sql stable security definer set search_path = public as $$
  select staff_role from public.profiles
  where id = auth.uid() and staff_active and staff_role is not null;
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.crm_role() is not null;
$$;

create or replace function public.is_crm_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.crm_role() in ('superadmin','admin'), false);
$$;

-- Članovi tima vide profile ostalih članova tima (klijente ne).
create policy profiles_staff_read on public.profiles
  for select to authenticated using (staff_role is not null and public.is_staff());

-- ------------------------------------------------------------------
-- Dnevnik izmjena
-- ------------------------------------------------------------------
create table public.crm_audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid references public.profiles(id) on delete set null,
  actor_name  text,
  action      text not null check (action in ('pregled','novo','izmjena','brisanje','izvoz','prijava')),
  entity      text not null,
  entity_id   text,
  label       text,
  changes     jsonb not null default '{}'
);
create index crm_audit_at_idx     on public.crm_audit_log (at desc);
create index crm_audit_actor_idx  on public.crm_audit_log (actor, at desc);
create index crm_audit_entity_idx on public.crm_audit_log (entity, entity_id);
alter table public.crm_audit_log enable row level security;
create policy crm_audit_read on public.crm_audit_log
  for select to authenticated using (public.is_crm_admin());
-- Nema politika za pisanje: upisuju isključivo okidači i funkcije ispod. Zapisi se ne brišu iz aplikacije.

create or replace function public.crm_actor_name(p_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(full_name, ''), email) from public.profiles where id = p_id;
$$;

-- Generički okidač: bilježi novo / izmjena / brisanje s razlikom polja {"polje": [staro, novo]}.
create or replace function public.crm_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_row jsonb; v_diff jsonb := '{}'; v_action text; k text;
  v_skip text[] := array['updated_at','token','content_hash'];
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
    v_row->>'id',
    coalesce(v_row->>'naziv', nullif(v_row->>'full_name', ''), v_row->>'email', v_row->>'slug'),
    v_diff
  );
  return null;
end; $$;

-- Ručni upis (pregled zapisa, izvoz) iz aplikacije. Isti pregled unutar 10 minuta bilježi se jednom.
create or replace function public.crm_log(p_action text, p_entity text, p_entity_id text, p_label text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Nemate pristup CRM-u.'; end if;
  if p_action not in ('pregled','izvoz') then raise exception 'Nepoznata radnja u dnevniku.'; end if;
  if p_action = 'pregled' and exists (
    select 1 from public.crm_audit_log
    where actor = auth.uid() and action = 'pregled' and entity = p_entity
      and entity_id is not distinct from p_entity_id and at > now() - interval '10 minutes'
  ) then return; end if;
  insert into public.crm_audit_log (actor, actor_name, action, entity, entity_id, label)
  values (auth.uid(), public.crm_actor_name(auth.uid()), p_action, p_entity, p_entity_id, p_label);
end; $$;

-- ------------------------------------------------------------------
-- Pozivnice za tim
-- ------------------------------------------------------------------
create table public.crm_invitations (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  full_name    text,
  role         public.staff_role not null check (role <> 'superadmin'),
  token        text not null unique
               default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id) on delete set null,
  revoked_at   timestamptz
);
create index crm_invitations_email_idx on public.crm_invitations (lower(email));
alter table public.crm_invitations enable row level security;
create policy crm_inv_read on public.crm_invitations
  for select to authenticated using (public.is_crm_admin());

create or replace function public.crm_invite(p_email text, p_role public.staff_role, p_full_name text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_me public.staff_role := public.crm_role();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text;
begin
  if v_me is null or v_me not in ('superadmin','admin') then
    raise exception 'Članove tima pozivaju samo administratori.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail adresa nije ispravna.'; end if;
  if p_role = 'superadmin' then raise exception 'Uloga superadmina ne dodjeljuje se pozivnicom.'; end if;
  if p_role = 'admin' and v_me <> 'superadmin' then
    raise exception 'Administratora može pozvati samo superadmin.';
  end if;
  if exists (select 1 from public.profiles
             where lower(email) = v_email and staff_role is not null and staff_active) then
    raise exception 'Ta osoba je već aktivan član tima.';
  end if;
  update public.crm_invitations set revoked_at = now()
   where lower(email) = v_email and accepted_at is null and revoked_at is null;
  insert into public.crm_invitations (email, full_name, role, created_by)
  values (v_email, nullif(trim(coalesce(p_full_name, '')), ''), p_role, auth.uid())
  returning token into v_token;
  return v_token;
end; $$;

create or replace function public.crm_revoke_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_crm_admin() then raise exception 'Pozivnice opoziva samo administrator.'; end if;
  update public.crm_invitations set revoked_at = now()
   where id = p_id and accepted_at is null and revoked_at is null;
  if not found then raise exception 'Pozivnica ne postoji ili više nije aktivna.'; end if;
end; $$;

-- Podaci o pozivnici za stranicu prihvaćanja (vidi je samo onaj tko ima poveznicu).
create or replace function public.crm_invitation_info(p_token text)
returns table (email text, full_name text, role public.staff_role, status text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.email, i.full_name, i.role,
         case when i.revoked_at is not null then 'opozvana'
              when i.accepted_at is not null then 'iskoristena'
              when i.expires_at < now() then 'istekla'
              else 'vrijedi' end,
         i.expires_at
  from public.crm_invitations i where i.token = p_token;
$$;

create or replace function public.crm_accept_invitation(p_token text)
returns public.staff_role language plpgsql security definer set search_path = public as $$
declare
  inv public.crm_invitations;
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then raise exception 'Prijavite se pa ponovno otvorite poveznicu.'; end if;
  select * into inv from public.crm_invitations where token = p_token for update;
  if not found then raise exception 'Pozivnica ne postoji.'; end if;
  if inv.revoked_at is not null then raise exception 'Pozivnica je opozvana.'; end if;
  if inv.accepted_at is not null then raise exception 'Pozivnica je već iskorištena.'; end if;
  if inv.expires_at < now() then raise exception 'Pozivnica je istekla. Zatražite novu.'; end if;
  if lower(inv.email) <> v_email then
    raise exception 'Pozivnica glasi na %. Prijavite se tom adresom.', inv.email;
  end if;
  update public.profiles
     set staff_role = inv.role,
         staff_active = true,
         staff_since = coalesce(staff_since, now()),
         full_name = case when coalesce(full_name, '') = '' then coalesce(inv.full_name, '') else full_name end
   where id = auth.uid();
  update public.crm_invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.role;
end; $$;

-- Uređivanje člana: vlastiti osobni podaci, ili (administrator) uloga i status drugih.
create or replace function public.crm_update_member(
  p_id uuid, p_role public.staff_role, p_active boolean,
  p_full_name text, p_short_name text, p_job_title text, p_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me public.staff_role := public.crm_role();
  t public.profiles;
begin
  if v_me is null then raise exception 'Nemate pristup CRM-u.'; end if;
  select * into t from public.profiles where id = p_id and staff_role is not null;
  if not found then raise exception 'Član tima ne postoji.'; end if;

  if p_id = auth.uid() then
    if p_role is distinct from t.staff_role or p_active is distinct from t.staff_active then
      raise exception 'Vlastitu ulogu i status ne možete mijenjati.';
    end if;
  else
    if v_me not in ('superadmin','admin') then raise exception 'Tuđe podatke mijenjaju samo administratori.'; end if;
    if t.staff_role = 'superadmin' then raise exception 'Superadmina ne može mijenjati drugi član tima.'; end if;
    if p_role = 'superadmin' then raise exception 'Uloga superadmina se ne dodjeljuje.'; end if;
    if v_me = 'admin' and (t.staff_role = 'admin' or p_role = 'admin') then
      raise exception 'Administratore mijenja samo superadmin.';
    end if;
  end if;

  update public.profiles set
    staff_role   = p_role,
    staff_active = p_active,
    full_name    = coalesce(nullif(trim(coalesce(p_full_name, '')), ''), full_name),
    short_name   = nullif(trim(coalesce(p_short_name, '')), ''),
    job_title    = nullif(trim(coalesce(p_job_title, '')), ''),
    phone        = nullif(trim(coalesce(p_phone, '')), '')
  where id = p_id;

  -- Deaktivacija odmah prekida sve prijave tog člana.
  if t.staff_active and not p_active then
    delete from auth.sessions where user_id = p_id;
  end if;
end; $$;

-- ------------------------------------------------------------------
-- Prijave tima (sesije) i sigurnost
-- ------------------------------------------------------------------
create table public.crm_sessions (
  session_id  uuid primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  ip          text,
  user_agent  text
);
create index crm_sessions_user_idx on public.crm_sessions (user_id, last_seen desc);
alter table public.crm_sessions enable row level security;
create policy crm_sessions_read on public.crm_sessions
  for select to authenticated using (user_id = auth.uid() or public.is_crm_admin());

-- Poziva se pri otvaranju CRM-a: prva pojava sesije = nova prijava (bilježi se i u dnevnik).
create or replace function public.crm_touch_session(p_ip text, p_user_agent text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sid uuid;
begin
  if not public.is_staff() then return; end if;
  begin
    v_sid := (auth.jwt()->>'session_id')::uuid;
  exception when others then v_sid := null;
  end;
  if v_sid is null then return; end if;

  insert into public.crm_sessions (session_id, user_id, ip, user_agent)
  values (v_sid, auth.uid(), left(p_ip, 100), left(p_user_agent, 400))
  on conflict (session_id) do update
    set last_seen = now(), ip = excluded.ip
    where public.crm_sessions.last_seen < now() - interval '5 minutes';

  if not exists (select 1 from public.crm_audit_log
                 where actor = auth.uid() and action = 'prijava' and entity_id = v_sid::text) then
    insert into public.crm_audit_log (actor, actor_name, action, entity, entity_id, label)
    values (auth.uid(), public.crm_actor_name(auth.uid()), 'prijava', 'sesija', v_sid::text, left(p_ip, 100));
  end if;
end; $$;

-- Popis prijava člana s oznakom je li sesija još aktivna i je li to trenutni preglednik.
create or replace function public.crm_session_list(p_user uuid default null)
returns table (session_id uuid, first_seen timestamptz, last_seen timestamptz, ip text,
               user_agent text, active boolean, is_current boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_user uuid := coalesce(p_user, auth.uid());
begin
  if v_user <> auth.uid() and not public.is_crm_admin() then
    raise exception 'Tuđe prijave vidi samo administrator.';
  end if;
  return query
    select s.session_id, s.first_seen, s.last_seen, s.ip, s.user_agent,
           exists (select 1 from auth.sessions a where a.id = s.session_id),
           s.session_id::text = coalesce(auth.jwt()->>'session_id', '')
    from public.crm_sessions s
    where s.user_id = v_user
    order by s.last_seen desc
    limit 30;
end; $$;

-- Pregled sigurnosti tima (administrator).
create or replace function public.crm_team_security()
returns table (user_id uuid, full_name text, email text, staff_role public.staff_role,
               staff_active boolean, last_seen timestamptz, active_sessions integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_crm_admin() then raise exception 'Sigurnost tima vidi samo administrator.'; end if;
  return query
    select p.id, p.full_name, p.email, p.staff_role, p.staff_active,
           (select max(s.last_seen) from public.crm_sessions s where s.user_id = p.id),
           (select count(*)::int from auth.sessions a where a.user_id = p.id)
    from public.profiles p
    where p.staff_role is not null
    order by p.staff_active desc, p.full_name;
end; $$;

-- Administrator odjavljuje člana sa svih uređaja.
create or replace function public.crm_sign_out_member(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_target public.staff_role;
begin
  if not public.is_crm_admin() then raise exception 'Članove odjavljuje samo administrator.'; end if;
  select staff_role into v_target from public.profiles where id = p_id;
  if v_target is null then raise exception 'Član tima ne postoji.'; end if;
  if v_target = 'superadmin' and public.crm_role() <> 'superadmin' then
    raise exception 'Superadmina može odjaviti samo superadmin.';
  end if;
  delete from auth.sessions where user_id = p_id;
  insert into public.crm_audit_log (actor, actor_name, action, entity, entity_id, label)
  values (auth.uid(), public.crm_actor_name(auth.uid()), 'izmjena', 'sesija', p_id::text,
          'Odjava sa svih uređaja: ' || coalesce(public.crm_actor_name(p_id), ''));
end; $$;

-- ------------------------------------------------------------------
-- Okidači dnevnika na tablicama koje CRM dira
-- ------------------------------------------------------------------
create trigger crm_audit after insert or update or delete on public.tenants
  for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.jls_profiles
  for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.profiles
  for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_invitations
  for each row execute function public.crm_audit_row();

-- ------------------------------------------------------------------
-- Ovlasti nad funkcijama (advisor: ne izlagati anon/public)
-- ------------------------------------------------------------------
revoke execute on function public.crm_role()                         from public, anon;
revoke execute on function public.is_staff()                         from public, anon;
revoke execute on function public.is_crm_admin()                     from public, anon;
revoke execute on function public.crm_actor_name(uuid)               from public, anon, authenticated;
revoke execute on function public.crm_audit_row()                    from public, anon, authenticated;
revoke execute on function public.crm_log(text, text, text, text)    from public, anon;
revoke execute on function public.crm_invite(text, public.staff_role, text) from public, anon;
revoke execute on function public.crm_revoke_invitation(uuid)        from public, anon;
revoke execute on function public.crm_invitation_info(text)          from public, anon;
revoke execute on function public.crm_accept_invitation(text)        from public, anon;
revoke execute on function public.crm_update_member(uuid, public.staff_role, boolean, text, text, text, text) from public, anon;
revoke execute on function public.crm_touch_session(text, text)      from public, anon;
revoke execute on function public.crm_session_list(uuid)             from public, anon;
revoke execute on function public.crm_team_security()                from public, anon;
revoke execute on function public.crm_sign_out_member(uuid)          from public, anon;

grant execute on function public.crm_role(), public.is_staff(), public.is_crm_admin(),
  public.crm_log(text, text, text, text),
  public.crm_invite(text, public.staff_role, text), public.crm_revoke_invitation(uuid),
  public.crm_invitation_info(text), public.crm_accept_invitation(text),
  public.crm_update_member(uuid, public.staff_role, boolean, text, text, text, text),
  public.crm_touch_session(text, text), public.crm_session_list(uuid),
  public.crm_team_security(), public.crm_sign_out_member(uuid)
  to authenticated;
