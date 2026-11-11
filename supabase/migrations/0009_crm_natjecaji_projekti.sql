-- EU Radar CRM — Faza 2: Natječaji u CRM-u, EU Filter (rekla-kazala), Projekti i prijave.
-- Natječaji = postojeći `calls` iz EU Radara; CRM dodaje timski sloj (procjena, prioritet, arhiva, pročitano).

-- ------------------------------------------------------------------
-- Natječaji: timska procjena i pročitano
-- ------------------------------------------------------------------
create table public.crm_call_meta (
  call_id    uuid primary key references public.calls(id) on delete cascade,
  relevance  text check (relevance in ('visoka','srednja','niska','nebitno')),
  prioritet  boolean not null default false,
  archived_at timestamptz,
  napomena   text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.crm_call_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  call_id uuid not null references public.calls(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, call_id)
);

create or replace function public.crm_call_meta_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end; $$;
create trigger crm_call_meta_before before insert or update on public.crm_call_meta
  for each row execute function public.crm_call_meta_before();

-- Označi pročitanim (jedan ili svi).
create or replace function public.crm_mark_calls_read(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  insert into public.crm_call_reads (user_id, call_id)
  select auth.uid(), x from unnest(p_ids) x where public.is_staff()
  on conflict do nothing;
$$;

-- ------------------------------------------------------------------
-- EU Filter: rekla-kazala (neslužbene informacije s radionica)
-- ------------------------------------------------------------------
create table public.crm_hearsay (
  id         uuid primary key default gen_random_uuid(),
  program    text not null check (length(trim(program)) > 0),
  call_id    uuid references public.calls(id) on delete set null,
  izjava     text not null check (length(trim(izjava)) > 0),
  izvor      text,
  datum      date,
  poveznica  text,
  status     text not null default 'otvoreno' check (status in ('otvoreno','pregledano')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Projekti i prijave
-- ------------------------------------------------------------------
create table public.crm_projects (
  id             uuid primary key default gen_random_uuid(),
  broj           integer generated always as identity unique,
  naziv          text not null check (length(trim(naziv)) > 0),
  jls_profile_id uuid references public.jls_profiles(id) on delete set null,
  lead_id        uuid references public.crm_leads(id) on delete set null,
  call_id        uuid references public.calls(id) on delete set null,
  program        text,
  owner          uuid references public.profiles(id) on delete set null default auth.uid(),
  faza           text not null default 'priprema'
                 check (faza in ('priprema','dokumentacija','predano','evaluacija','odobreno','isplata','zavrseno','odbijeno','odustalo')),
  rok_prijave    date,
  iznos_projekta numeric(14,2),
  iznos_potpore  numeric(14,2),
  predano_at     date,
  odluka_at      date,
  napomena       text,
  archived_at    timestamptz,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (jls_profile_id is not null or lead_id is not null)
);
create index crm_projects_client_idx on public.crm_projects (jls_profile_id);
create index crm_projects_lead_idx   on public.crm_projects (lead_id);

create table public.crm_project_items (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.crm_projects(id) on delete cascade,
  naziv      text not null check (length(trim(naziv)) > 0),
  grupa      text,
  done_at    timestamptz,
  done_by    uuid references public.profiles(id) on delete set null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index crm_project_items_idx on public.crm_project_items (project_id, position);

create or replace function public.crm_can_see_project(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.crm_can_see(owner, created_by) from public.crm_projects where id = p_id), false);
$$;

-- Uređuje konzultant i više ili vlasnik projekta.
create or replace function public.crm_can_edit_project(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.crm_is_konzultant()
      or (public.is_staff() and exists (select 1 from public.crm_projects where id = p_id and owner = auth.uid()));
$$;

-- Zadaci i povijest mogu se vezati i na projekt.
alter table public.crm_tasks add column project_id uuid references public.crm_projects(id) on delete set null;
create index crm_tasks_project_idx on public.crm_tasks (project_id);
grant insert (project_id), update (project_id) on public.crm_tasks to authenticated;

alter table public.crm_activities add column project_id uuid references public.crm_projects(id) on delete cascade;
create index crm_act_project_idx on public.crm_activities (project_id, at desc);
alter table public.crm_activities drop constraint crm_activities_check;
alter table public.crm_activities add constraint crm_activities_check
  check (lead_id is not null or jls_profile_id is not null or task_id is not null or project_id is not null);
grant insert (project_id) on public.crm_activities to authenticated;

drop policy crm_activities_read on public.crm_activities;
drop policy crm_activities_insert on public.crm_activities;
create policy crm_activities_read on public.crm_activities for select to authenticated
  using (public.crm_can_see_activity(lead_id, jls_profile_id, task_id)
         or (project_id is not null and public.is_staff() and public.crm_can_see_project(project_id)));
create policy crm_activities_insert on public.crm_activities for insert to authenticated
  with check (vrsta in ('poziv','biljeska','email','sastanak','komentar')
              and (public.crm_can_see_activity(lead_id, jls_profile_id, task_id)
                   or (project_id is not null and public.is_staff() and public.crm_can_see_project(project_id))));

create or replace function public.crm_project_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  if new.faza = 'predano' and new.predano_at is null then new.predano_at := public.crm_today(); end if;
  if new.faza in ('odobreno','odbijeno') and new.odluka_at is null then new.odluka_at := public.crm_today(); end if;
  if new.jls_profile_id is null and new.lead_id is not null then
    -- Lead koji je postao klijent: projekt prelazi na klijenta.
    new.jls_profile_id := (select jls_profile_id from public.crm_leads where id = new.lead_id);
  end if;
  if (tg_op = 'INSERT' or new.owner is distinct from old.owner) and new.owner is not null and not exists (
    select 1 from public.profiles where id = new.owner and staff_role is not null and staff_active
  ) then
    raise exception 'Vlasnik projekta mora biti aktivan član tima.';
  end if;
  return new;
end; $$;
create trigger crm_projects_before before insert or update on public.crm_projects
  for each row execute function public.crm_project_before();
create trigger crm_projects_touch before update on public.crm_projects
  for each row execute function public.crm_touch_row();

create or replace function public.crm_project_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  f constant jsonb := '{"priprema":"Priprema","dokumentacija":"Dokumentacija","predano":"Predano","evaluacija":"Evaluacija","odobreno":"Odobreno","isplata":"Isplata","zavrseno":"Završeno","odbijeno":"Odbijeno","odustalo":"Klijent odustao"}';
begin
  if tg_op = 'INSERT' then
    insert into public.crm_activities (vrsta, body, project_id) values ('promjena', 'Projekt PR-' || new.broj || ' je otvoren', new.id);
    if new.jls_profile_id is not null then
      insert into public.crm_activities (vrsta, body, jls_profile_id, meta)
      values ('promjena', 'Otvoren projekt PR-' || new.broj || ': ' || new.naziv, new.jls_profile_id, jsonb_build_object('project_id', new.id));
    elsif new.lead_id is not null then
      insert into public.crm_activities (vrsta, body, lead_id, meta)
      values ('promjena', 'Otvoren projekt PR-' || new.broj || ': ' || new.naziv, new.lead_id, jsonb_build_object('project_id', new.id));
    end if;
    return null;
  end if;
  if new.faza is distinct from old.faza then
    insert into public.crm_activities (vrsta, body, project_id)
    values ('promjena', 'Faza: ' || coalesce(f->>old.faza, old.faza) || ' → ' || coalesce(f->>new.faza, new.faza), new.id);
    if new.jls_profile_id is not null and new.faza in ('predano','odobreno','odbijeno','zavrseno') then
      insert into public.crm_activities (vrsta, body, jls_profile_id, meta)
      values ('promjena', 'Projekt PR-' || new.broj || ' (' || new.naziv || '): ' || (f->>new.faza), new.jls_profile_id, jsonb_build_object('project_id', new.id));
    end if;
  end if;
  if new.owner is distinct from old.owner then
    insert into public.crm_activities (vrsta, body, project_id)
    values ('promjena', 'Vlasnik: ' || coalesce(public.crm_actor_name(old.owner), 'nitko') || ' → ' || coalesce(public.crm_actor_name(new.owner), 'nitko'), new.id);
  end if;
  if new.rok_prijave is distinct from old.rok_prijave then
    insert into public.crm_activities (vrsta, body, project_id)
    values ('promjena', 'Rok prijave: ' || coalesce(to_char(old.rok_prijave, 'DD. MM. YYYY.'), '—') || ' → ' || coalesce(to_char(new.rok_prijave, 'DD. MM. YYYY.'), '—'), new.id);
  end if;
  if new.archived_at is not null and old.archived_at is null then
    insert into public.crm_activities (vrsta, body, project_id) values ('promjena', 'Projekt je arhiviran', new.id);
  end if;
  return null;
end; $$;
create trigger crm_projects_history after insert or update on public.crm_projects
  for each row execute function public.crm_project_history();

create or replace function public.crm_project_item_before()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.done_at is distinct from old.done_at then
    new.done_by := case when new.done_at is null then null else auth.uid() end;
  end if;
  return new;
end; $$;
create trigger crm_project_items_before before insert or update on public.crm_project_items
  for each row execute function public.crm_project_item_before();

-- Pretvorba leada: njegovi projekti prelaze na klijenta.
create or replace function public.crm_lead_projects_follow()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.jls_profile_id is not null and old.jls_profile_id is null then
    update public.crm_projects set jls_profile_id = new.jls_profile_id where lead_id = new.id and jls_profile_id is null;
  end if;
  return null;
end; $$;
create trigger crm_leads_projects after update of jls_profile_id on public.crm_leads
  for each row execute function public.crm_lead_projects_follow();

create trigger crm_hearsay_touch before update on public.crm_hearsay for each row execute function public.crm_touch_row();

-- Dnevnik: natpis i za natječaj (crm_call_meta), program (rekla-kazala).
create or replace function public.crm_audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_row jsonb; v_diff jsonb := '{}'; v_action text; k text;
  v_skip text[] := array['updated_at','token','content_hash','last_activity_at','trijaza','updated_by'];
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
    coalesce(v_row->>'id', v_row->>'jls_profile_id', v_row->>'call_id'),
    coalesce(v_row->>'naziv', v_row->>'naslov', v_row->>'ime', nullif(v_row->>'full_name', ''), v_row->>'email',
             v_row->>'slug', v_row->>'program',
             (select naziv from public.jls_profiles where id = (v_row->>'jls_profile_id')::uuid),
             (select naslov from public.calls where id = (v_row->>'call_id')::uuid)),
    v_diff
  );
  return null;
end; $$;

-- Dnevnik
create trigger crm_audit after insert or update or delete on public.crm_projects  for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_call_meta for each row execute function public.crm_audit_row();
create trigger crm_audit after insert or update or delete on public.crm_hearsay   for each row execute function public.crm_audit_row();

-- ------------------------------------------------------------------
-- Brojke u izborniku: + natječaji (novi, neistekli, nisu označeni nebitnim/arhivirani)
-- ------------------------------------------------------------------
create or replace function public.crm_mark_seen(p_key text)
returns void language sql security definer set search_path = public as $$
  insert into public.crm_nav_seen (user_id, key, seen_at)
  select auth.uid(), p_key, now() where public.is_staff() and p_key in ('leadovi','hot','natjecaji')
  on conflict (user_id, key) do update set seen_at = excluded.seen_at;
$$;

create or replace function public.crm_nav_counts()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'leadovi'), now() - interval '7 days') as leadovi,
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'hot'), now() - interval '7 days') as hot,
      coalesce((select seen_at from public.crm_nav_seen where user_id = auth.uid() and key = 'natjecaji'), now() - interval '7 days') as natjecaji
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
                     and m.archived_at is null and coalesce(m.relevance, '') not in ('niska','nebitno'))
  ) end;
$$;

-- ------------------------------------------------------------------
-- RLS i ovlasti
-- ------------------------------------------------------------------
alter table public.crm_call_meta     enable row level security;
alter table public.crm_call_reads    enable row level security;
alter table public.crm_hearsay       enable row level security;
alter table public.crm_projects      enable row level security;
alter table public.crm_project_items enable row level security;

create policy crm_call_meta_read  on public.crm_call_meta for select to authenticated using (public.is_staff());
create policy crm_call_meta_write on public.crm_call_meta for all to authenticated
  using (public.crm_is_konzultant()) with check (public.crm_is_konzultant());

create policy crm_call_reads_own on public.crm_call_reads for all to authenticated
  using (user_id = auth.uid() and public.is_staff()) with check (user_id = auth.uid() and public.is_staff());

create policy crm_hearsay_read  on public.crm_hearsay for select to authenticated using (public.is_staff());
create policy crm_hearsay_write on public.crm_hearsay for all to authenticated
  using (public.crm_is_konzultant()) with check (public.crm_is_konzultant());

create policy crm_projects_read on public.crm_projects for select to authenticated
  using (public.crm_can_see(owner, created_by));
create policy crm_projects_insert on public.crm_projects for insert to authenticated
  with check (public.crm_is_konzultant()
              and (jls_profile_id is null or public.crm_can_see_client(jls_profile_id))
              and (lead_id is null or exists (select 1 from public.crm_leads l where l.id = lead_id)));
create policy crm_projects_update on public.crm_projects for update to authenticated
  using (public.crm_can_edit_project(id) and public.crm_can_see(owner, created_by))
  with check (public.crm_is_konzultant() or owner = auth.uid());
create policy crm_projects_delete on public.crm_projects for delete to authenticated
  using (public.crm_role() = 'superadmin');

create policy crm_project_items_read on public.crm_project_items for select to authenticated
  using (public.crm_can_see_project(project_id));
create policy crm_project_items_write on public.crm_project_items for all to authenticated
  using (public.crm_can_edit_project(project_id) and public.crm_can_see_project(project_id))
  with check (public.crm_can_edit_project(project_id) and public.crm_can_see_project(project_id));

revoke all on public.crm_call_meta, public.crm_call_reads, public.crm_hearsay, public.crm_projects, public.crm_project_items
  from anon, authenticated;
grant select, insert, update on public.crm_call_meta to authenticated;
grant select, insert, delete on public.crm_call_reads to authenticated;
grant select, insert, update, delete on public.crm_hearsay to authenticated;
grant select, delete on public.crm_projects to authenticated;
grant insert (naziv, jls_profile_id, lead_id, call_id, program, owner, faza, rok_prijave, iznos_projekta, iznos_potpore, napomena)
  on public.crm_projects to authenticated;
grant update (naziv, jls_profile_id, lead_id, call_id, program, owner, faza, rok_prijave, iznos_projekta, iznos_potpore,
              predano_at, odluka_at, napomena, archived_at)
  on public.crm_projects to authenticated;
grant select, insert, update, delete on public.crm_project_items to authenticated;

revoke execute on function public.crm_call_meta_before(), public.crm_project_before(), public.crm_project_history(),
  public.crm_project_item_before(), public.crm_lead_projects_follow()
  from public, anon, authenticated;
revoke execute on function public.crm_mark_calls_read(uuid[]), public.crm_can_see_project(uuid), public.crm_can_edit_project(uuid),
  public.crm_mark_seen(text), public.crm_nav_counts()
  from public, anon;
grant execute on function public.crm_mark_calls_read(uuid[]), public.crm_can_see_project(uuid), public.crm_can_edit_project(uuid),
  public.crm_mark_seen(text), public.crm_nav_counts()
  to authenticated;
