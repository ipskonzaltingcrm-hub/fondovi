-- JLS Radar — inicijalna shema (Faza 1)
-- Multitenant: globalni katalog poziva + per-tenant radni tok, izolacija preko RLS-a.

-- ------------------------------------------------------------------
-- Enumi
-- ------------------------------------------------------------------
create type call_level     as enum ('lokalna','regionalna','nacionalna','eu');
create type call_status    as enum ('najava','otvoren','zatvoren');
create type applicant_type as enum ('grad','opcina','zupanija','lag','ustanova','tvrtka','ngo');
create type jls_type       as enum ('grad','opcina','zupanija');
create type member_role    as enum ('superadmin','tenant_admin','member','viewer');
create type source_type    as enum ('HTML','RSS','API');
create type source_status  as enum ('aktivan','greska','pauziran');
create type watch_status   as enum ('zainteresiran','u_pripremi','prijavljeno','odbaceno');

-- ------------------------------------------------------------------
-- Globalne tablice (zajedničke svim tenantima; nema tenant_id)
-- ------------------------------------------------------------------
create table public.sources (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,
  naziv              text not null,
  url                text not null,
  tip                source_type not null default 'HTML',
  status             source_status not null default 'aktivan',
  prioritet          text not null default 'dodatni',   -- 'jezgra' | 'dodatni'
  zadnje_povlacenje  timestamptz,
  poziva_ukupno      integer not null default 0,
  created_at         timestamptz not null default now()
);

create table public.calls (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  naslov            text not null,
  davatelj          text not null,
  program           text not null,
  level             call_level not null,
  status            call_status not null,
  datum_objave      date,
  rok_prijave       date,
  iznos_min         numeric,
  iznos_max         numeric,
  ukupna_alokacija  numeric,
  intenzitet        text,
  prihvatljivi      applicant_type[] not null default '{}',
  sektori           text[] not null default '{}',
  sazetak           text,
  izvor             text,
  url               text not null,
  source_id         uuid references public.sources(id) on delete set null,
  content_hash      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index calls_status_idx on public.calls(status);
create index calls_level_idx  on public.calls(level);
create index calls_rok_idx    on public.calls(rok_prijave);

create table public.call_changes (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid not null references public.calls(id) on delete cascade,
  field       text not null,
  old_value   text,
  new_value   text,
  changed_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Tenant / korisnici
-- ------------------------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  naziv       text not null,
  tip         text not null default 'jls',       -- 'operator' | 'jls'
  status      text not null default 'aktivan',   -- 'aktivan' | 'trial' | 'pauziran'
  created_at  timestamptz not null default now()
);

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text,
  full_name      text,
  is_superadmin  boolean not null default false,
  created_at     timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        member_role not null default 'member',
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

create table public.jls_profiles (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  slug              text not null,
  naziv             text not null,
  tip               jls_type not null,
  zupanija          text,
  stanovnika        integer,
  ruralno           boolean not null default false,
  lag               text,
  sektori_interesa  text[] not null default '{}',
  kontakt_osoba     text,
  status            text not null default 'aktivan',
  created_at        timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.watchlist (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  call_id        uuid not null references public.calls(id) on delete cascade,
  jls_profile_id uuid references public.jls_profiles(id) on delete set null,
  status         watch_status not null default 'zainteresiran',
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (tenant_id, call_id, jls_profile_id)
);

create table public.saved_filters (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  naziv       text not null,
  filter      jsonb not null default '{}',
  is_team     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table public.notes (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  call_id        uuid references public.calls(id) on delete cascade,
  jls_profile_id uuid references public.jls_profiles(id) on delete set null,
  body           text not null,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table public.assignments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  call_id        uuid not null references public.calls(id) on delete cascade,
  jls_profile_id uuid references public.jls_profiles(id) on delete set null,
  assignee       uuid references public.profiles(id) on delete set null,
  status         text not null default 'otvoreno',
  created_at     timestamptz not null default now()
);

create table public.notification_settings (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  channel     text not null default 'email',
  rules       jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Pomoćne funkcije (SECURITY DEFINER da izbjegnemo rekurziju u RLS-u)
-- ------------------------------------------------------------------
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_superadmin);
$$;

create or replace function public.is_member(tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships where user_id = auth.uid() and tenant_id = tenant
  ) or public.is_superadmin();
$$;

create or replace function public.is_tenant_admin(tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and tenant_id = tenant and role in ('tenant_admin','superadmin')
  ) or public.is_superadmin();
$$;

-- Profil se automatski kreira pri registraciji; ams@ips-konzalting.hr dobiva superadmina.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, is_superadmin)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    lower(new.email) = 'ams@ips-konzalting.hr'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------
alter table public.sources               enable row level security;
alter table public.calls                 enable row level security;
alter table public.call_changes          enable row level security;
alter table public.tenants               enable row level security;
alter table public.profiles              enable row level security;
alter table public.memberships           enable row level security;
alter table public.jls_profiles          enable row level security;
alter table public.watchlist             enable row level security;
alter table public.saved_filters         enable row level security;
alter table public.notes                 enable row level security;
alter table public.assignments           enable row level security;
alter table public.notification_settings enable row level security;

-- Globalni katalog: čitanje svim prijavljenima, pisanje samo superadmin
-- (ingestion ide preko service-role ključa koji zaobilazi RLS).
create policy calls_read   on public.calls        for select to authenticated using (true);
create policy calls_write  on public.calls        for all    to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy src_read     on public.sources      for select to authenticated using (true);
create policy src_write    on public.sources      for all    to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy chg_read     on public.call_changes for select to authenticated using (true);
create policy chg_write    on public.call_changes for all    to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

-- Profili: svoj red + superadmin
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_superadmin());
create policy profiles_upd  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Tenanti: članovi vide svoj tenant
create policy tenants_read  on public.tenants for select to authenticated using (public.is_member(id));
create policy tenants_admin on public.tenants for update to authenticated using (public.is_tenant_admin(id)) with check (public.is_tenant_admin(id));

-- Članstva
create policy memb_read  on public.memberships for select to authenticated using (user_id = auth.uid() or public.is_tenant_admin(tenant_id));
create policy memb_write on public.memberships for all    to authenticated using (public.is_tenant_admin(tenant_id)) with check (public.is_tenant_admin(tenant_id));

-- Per-tenant tablice: jedan obrazac — članstvo u tenantu
create policy jls_rw    on public.jls_profiles          for all to authenticated using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy watch_rw  on public.watchlist             for all to authenticated using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy filt_rw   on public.saved_filters         for all to authenticated using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy notes_rw  on public.notes                 for all to authenticated using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy assign_rw on public.assignments           for all to authenticated using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));
create policy notif_rw  on public.notification_settings for all to authenticated using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

-- updated_at trigger za calls
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger calls_touch before update on public.calls
  for each row execute function public.touch_updated_at();
