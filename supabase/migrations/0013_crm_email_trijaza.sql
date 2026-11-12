-- EU Radar CRM — Faza 6: slanje e-mailova (ponude, tjedni pregled natječaja, podsjetnici za rokove) i AI trijaža natječaja.
-- E-mail ide isključivo s poddomene radar.ips-konzalting.hr (Resend); ključ je samo u Vercel env (RESEND_API_KEY).

create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into public.crm_settings (key, value) values
  ('email', '{"enabled":false,"tjedni_pregled":true,"podsjetnici_tim":true,"dani_unaprijed":7}'),
  ('call_triage', jsonb_build_object(
     'enabled', false,
     'limit_usd', 15,
     'keywords', '[]'::jsonb,
     'profile',
     'IPS Konzalting (Hrvatska) priprema projekte za EU i nacionalne bespovratne potpore. Klijenti su: jedinice lokalne i područne samouprave '
     || '(općine, gradovi, županije) i njihove ustanove i komunalna poduzeća; mala, srednja i velika poduzeća (ulaganja, energetska učinkovitost, '
     || 'digitalizacija, istraživanje i razvoj); znanstveno-istraživačke institucije. Visoko su relevantni otvoreni ili najavljeni natječaji i javni '
     || 'pozivi za bespovratna sredstva na koje se ti klijenti mogu prijaviti u Hrvatskoj (ESIF, NPOO, FZOEU, ministarstva, LAG-ovi, Interreg, '
     || 'EU programi s izravnim upravljanjem). Manje su relevantni pozivi uske publike, mali iznosi, izmjene i ispravci. Nebitni su: zapošljavanje, '
     || 'javna nabava roba i usluga, kultura bez potpora, rezultati i obavijesti bez novog poziva.')),
  ('app', '{"url":"https://fondovi-ips-b26c.vercel.app"}')
on conflict (key) do nothing;

-- ------------------------------------------------------------------
-- Ponude: javna poveznica (e-mail) i praćenje otvaranja
-- ------------------------------------------------------------------
alter table public.crm_offers
  add column public_token uuid not null default gen_random_uuid(),
  add column viewed_at    timestamptz,
  add column view_count   integer not null default 0;
create unique index crm_offers_token_idx on public.crm_offers (public_token);

-- ------------------------------------------------------------------
-- E-mail: dnevnik slanja, postavke primatelja, poslovi (tjedni/dnevni)
-- ------------------------------------------------------------------
create table public.crm_email_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  vrsta       text not null check (vrsta in ('ponuda','tjedni_pregled','podsjetnik','test')),
  to_email    text not null,
  subject     text not null,
  status      text not null default 'poslano'
              check (status in ('poslano','dostavljeno','otvoreno','kliknuto','odbijeno','prituzba','greska')),
  error       text,
  provider_id text,
  job_key     text,
  offer_id    uuid references public.crm_offers(id) on delete set null,
  user_id     uuid references public.profiles(id) on delete set null,
  sent_by     uuid references public.profiles(id) on delete set null,
  opened_at   timestamptz,
  clicked_at  timestamptz,
  updated_at  timestamptz not null default now()
);
create index crm_email_log_at_idx on public.crm_email_log (at desc);
create index crm_email_log_offer_idx on public.crm_email_log (offer_id);
create index crm_email_log_job_idx on public.crm_email_log (job_key, user_id);
create unique index crm_email_log_provider_idx on public.crm_email_log (provider_id) where provider_id is not null;

create table public.crm_email_prefs (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  tjedni_pregled boolean not null default true,
  podsjetnici    boolean not null default true,
  unsub_token    uuid not null unique default gen_random_uuid(),
  updated_at     timestamptz not null default now()
);

create table public.crm_email_jobs (
  key         text primary key,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  sent        integer not null default 0,
  failed      integer not null default 0
);

-- Odjava iz poveznice u e-mailu (bez prijave): isključuje tjedni pregled (ili sve obavijesti).
create or replace function public.crm_email_unsubscribe(p_token uuid, p_all boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  update public.crm_email_prefs set tjedni_pregled = false, podsjetnici = case when p_all then false else podsjetnici end, updated_at = now()
   where unsub_token = p_token;
  if not found then return null; end if;
  select p.email into v_email from public.crm_email_prefs e join public.profiles p on p.id = e.user_id where e.unsub_token = p_token;
  return coalesce(v_email, '');
end; $$;

-- Prvo otvaranje javne poveznice ponude → bilješka u povijesti leada/klijenta.
create or replace function public.crm_offer_viewed(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.crm_offers;
begin
  update public.crm_offers set view_count = view_count + 1, viewed_at = coalesce(viewed_at, now())
   where public_token = p_token and archived_at is null
  returning * into o;
  if not found then return; end if;
  if o.view_count = 1 then
    insert into public.crm_activities (vrsta, body, lead_id, jls_profile_id)
    values ('email', 'Klijent je otvorio ponudu ' || coalesce(o.broj, '') || ' (poveznica iz e-maila).', o.lead_id, o.jls_profile_id);
  end if;
end; $$;

-- ------------------------------------------------------------------
-- AI trijaža natječaja
-- ------------------------------------------------------------------
create table public.crm_call_ai (
  call_id     uuid primary key references public.calls(id) on delete cascade,
  relevance   text not null check (relevance in ('visoka','srednja','niska','nebitno')),
  score       smallint not null check (score between 0 and 100),
  reason      text,
  sazetak     text,
  prihvatljivi text[] not null default '{}',
  model       text,
  input_hash  text,
  run_id      uuid,
  assessed_at timestamptz not null default now()
);

create table public.crm_triage_runs (
  id          uuid primary key default gen_random_uuid(),
  trigger     text not null check (trigger in ('raspored','rucno')),
  status      text not null default 'u_tijeku' check (status in ('u_tijeku','ok','greska')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  started_by  uuid references public.profiles(id) on delete set null,
  ingest      jsonb,
  assessed    integer not null default 0,
  relevant    integer not null default 0,
  cost_usd    numeric(12,6) not null default 0,
  error       text
);
create index crm_triage_runs_idx on public.crm_triage_runs (started_at desc);

-- ------------------------------------------------------------------
-- Raspored: pg_cron svakih 10 min poziva /api/cron/crm (trijaža, podsjetnici, tjedni pregled).
-- Token nastaje u bazi (Vault) i nikad ne izlazi iz nje; ruta ga provjerava preko crm_cron_token_ok (service role).
-- ------------------------------------------------------------------
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'crm_cron_token', 'EU Radar CRM — token za /api/cron/crm');

create or replace function public.crm_cron_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p_token is not null and length(p_token) >= 32
         and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_token' limit 1), false);
$$;

create or replace function public.crm_cron_tick()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text := (select value->>'url' from public.crm_settings where key = 'app');
        v_tok text := (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_token' limit 1);
begin
  if v_url is null or v_tok is null then return; end if;
  perform net.http_get(
    url := v_url || '/api/cron/crm',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_tok),
    timeout_milliseconds := 60000);
end; $$;

select cron.schedule('crm-tick', '*/10 * * * *', 'select public.crm_cron_tick()');

-- ------------------------------------------------------------------
-- RLS i ovlasti
-- ------------------------------------------------------------------
alter table public.crm_email_log    enable row level security;
alter table public.crm_email_prefs  enable row level security;
alter table public.crm_email_jobs   enable row level security;
alter table public.crm_call_ai      enable row level security;
alter table public.crm_triage_runs  enable row level security;

create policy crm_email_log_read on public.crm_email_log for select to authenticated using (public.crm_is_konzultant());
create policy crm_email_prefs_own_read on public.crm_email_prefs for select to authenticated using (user_id = auth.uid());
create policy crm_email_prefs_own_ins on public.crm_email_prefs for insert to authenticated with check (user_id = auth.uid());
create policy crm_email_prefs_own_upd on public.crm_email_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy crm_call_ai_read on public.crm_call_ai for select to authenticated using (public.is_staff());
create policy crm_triage_runs_read on public.crm_triage_runs for select to authenticated using (public.is_staff());

revoke all on public.crm_email_log, public.crm_email_prefs, public.crm_email_jobs, public.crm_call_ai, public.crm_triage_runs from anon, authenticated;
grant select on public.crm_email_log, public.crm_call_ai, public.crm_triage_runs to authenticated;
grant select on public.crm_email_prefs to authenticated;
grant insert (user_id, tjedni_pregled, podsjetnici), update (tjedni_pregled, podsjetnici, updated_at) on public.crm_email_prefs to authenticated;

revoke execute on function public.crm_email_unsubscribe(uuid, boolean), public.crm_offer_viewed(uuid),
  public.crm_cron_token_ok(text), public.crm_cron_tick() from public, anon, authenticated;
grant execute on function public.crm_email_unsubscribe(uuid, boolean), public.crm_offer_viewed(uuid), public.crm_cron_token_ok(text) to service_role;
