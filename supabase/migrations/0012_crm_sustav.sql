-- EU Radar CRM — Faza 5: fiksni troškovi, trošak AI-ja, chatbot (javni AI asistent → lead), postavke sigurnosti (2FA).

insert into public.crm_settings (key, value) values
  ('chatbot', '{"enabled":false,"ime":"Ana","pozdrav":"Bok! Ja sam Ana, AI asistentica EU Radara. Pitajte me o natječajima i bespovratnim sredstvima za vašu općinu, tvrtku ili instituciju.","max_pitanja":12,"kontakt_od":4,"limit_usd":20}'),
  ('chatbot_brain', '{"o_nama":"","usluge":"","cijene":"","ton":"","pravila":"","kontakt":"","faq":"","dodatno":""}'),
  ('claude_credit', '{"usd":null}'),
  ('security', '{"mfa_required":false}');

alter table public.crm_leads drop constraint crm_leads_izvor_check;
alter table public.crm_leads add constraint crm_leads_izvor_check
  check (izvor in ('web','preporuka','telefon','email','sajam','linkedin','eu_radar','partner','upitnik','jls_prodaja','ai_asistent','ostalo'));

-- ------------------------------------------------------------------
-- Fiksni troškovi (administratori)
-- ------------------------------------------------------------------
create table public.crm_fixed_costs (
  id           uuid primary key default gen_random_uuid(),
  naziv        text not null check (length(trim(naziv)) > 0),
  kategorija   text not null default 'ostalo',
  dobavljac    text,
  iznos        numeric(12,2) not null check (iznos >= 0),
  ucestalost   text not null default 'mjesecno' check (ucestalost in ('mjesecno','kvartalno','polugodisnje','godisnje')),
  od           date,
  "do"         date,
  dan_placanja smallint check (dan_placanja between 1 and 31),
  napomena     text,
  archived_at  timestamptz,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger crm_fixed_costs_touch before update on public.crm_fixed_costs for each row execute function public.crm_touch_row();
create trigger crm_audit after insert or update or delete on public.crm_fixed_costs for each row execute function public.crm_audit_row();

-- ------------------------------------------------------------------
-- Trošak AI-ja: svaka plaćena AI stavka (chatbot, buduće module)
-- ------------------------------------------------------------------
create table public.crm_ai_usage (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  modul         text not null,
  opis          text,
  model         text,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd      numeric(12,6) not null default 0,
  ref           text
);
create index crm_ai_usage_at_idx on public.crm_ai_usage (at desc);

-- ------------------------------------------------------------------
-- Chatbot: razgovori i poruke (pisanje samo serverom — service role u /api/chat)
-- ------------------------------------------------------------------
create table public.crm_chat_conversations (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  last_at        timestamptz not null default now(),
  izvor          text,
  ip_hash        text,
  test           boolean not null default false,
  pitanja        integer not null default 0,
  cost_usd       numeric(12,6) not null default 0,
  kontakt        jsonb,
  lead_id        uuid references public.crm_leads(id) on delete set null,
  reviewed_at    timestamptz,
  reviewed_by    uuid references public.profiles(id) on delete set null
);
create index crm_chat_conv_idx on public.crm_chat_conversations (created_at desc);
create index crm_chat_conv_ip_idx on public.crm_chat_conversations (ip_hash, created_at desc);

create table public.crm_chat_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.crm_chat_conversations(id) on delete cascade,
  at              timestamptz not null default now(),
  role            text not null check (role in ('user','assistant')),
  content         text not null
);
create index crm_chat_msg_idx on public.crm_chat_messages (conversation_id, id);

-- Vlasnik automatskog leada (upitnici, chatbot): konzultant/administrator koji je najdulje bez automatskog leada;
-- ako u timu još nema nikoga takvog, superadmin (inače lead ostaje bez vlasnika i bez zadatka „Nazovi“).
create or replace function public.crm_next_lead_owner()
returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.profiles p
  where p.staff_active and p.staff_role in ('admin','konzultant','superadmin')
  order by (p.staff_role = 'superadmin'),
           (select max(l.created_at) from public.crm_leads l where l.owner = p.id and l.created_by is null) nulls first,
           p.created_at
  limit 1;
$$;

-- Kontakt iz chatbota: lead (izvor „AI asistent“) + zadatak „Nazovi“ + transkript. Poziva samo server (service role).
create or replace function public.crm_chat_contact(p_conv uuid, p_ime text, p_telefon text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.crm_chat_conversations; v_lead uuid; v_owner uuid; v_tr text; v_ime text := left(nullif(trim(p_ime), ''), 200);
  v_tel text := left(nullif(trim(p_telefon), ''), 50); v_email text := lower(left(nullif(trim(p_email), ''), 200));
begin
  select * into c from public.crm_chat_conversations where id = p_conv for update;
  if not found then raise exception 'Razgovor ne postoji.'; end if;
  if v_ime is null or (v_tel is null and v_email is null) then raise exception 'Upišite ime i telefon ili e-mail.'; end if;
  update public.crm_chat_conversations set kontakt = jsonb_build_object('ime', v_ime, 'telefon', v_tel, 'email', v_email), last_at = now()
   where id = p_conv;
  if c.test then return null; end if;
  select string_agg(case role when 'user' then 'Posjetitelj: ' else 'Ana: ' end || content, E'\n\n' order by id)
    into v_tr from public.crm_chat_messages where conversation_id = p_conv;

  select id into v_lead from public.crm_leads
   where archived_at is null and status not in ('pretvoren','izgubljen')
     and ((v_email is not null and lower(email) = v_email)
          or (v_tel is not null and length(regexp_replace(v_tel, '\D', '', 'g')) >= 8
              and right(regexp_replace(telefon, '\D', '', 'g'), 8) = right(regexp_replace(v_tel, '\D', '', 'g'), 8)))
   order by created_at desc limit 1;
  if v_lead is null then
    v_owner := public.crm_next_lead_owner();
    insert into public.crm_leads (naziv, kontakt_ime, telefon, email, izvor, interes, owner)
    values (v_ime, v_ime, v_tel, v_email, 'ai_asistent', 'Razgovor s AI asistentom EU Radara', v_owner)
    returning id into v_lead;
  else
    select owner into v_owner from public.crm_leads where id = v_lead;
  end if;
  insert into public.crm_activities (vrsta, body, lead_id)
  values ('biljeska', 'Kontakt iz AI asistenta. Transkript:' || E'\n\n' || left(coalesce(v_tr, '—'), 8000), v_lead);
  if v_owner is not null then
    insert into public.crm_tasks (naslov, vrsta, prioritet, rok, owner, lead_id)
    values ('Nazovi: ' || v_ime || ' (chatbot)', 'poziv', 'visok', public.crm_today(), v_owner, v_lead);
  end if;
  update public.crm_chat_conversations set lead_id = v_lead where id = p_conv;
  return v_lead;
end; $$;

create or replace function public.crm_chat_mark_reviewed(p_conv uuid)
returns void language sql security definer set search_path = public as $$
  update public.crm_chat_conversations set reviewed_at = coalesce(reviewed_at, now()), reviewed_by = coalesce(reviewed_by, auth.uid())
  where id = p_conv and public.is_staff();
$$;

-- ------------------------------------------------------------------
-- Brojke u izborniku: + chatbot (zahtjevi za kontakt koje još nitko nije otvorio)
-- ------------------------------------------------------------------
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
                   (select count(*) from public.profiles p, s where p.staff_role is null and p.created_at > s.korisnici) else 0 end,
    'chatbot', case when public.crm_is_konzultant() then
                 (select count(*) from public.crm_chat_conversations c where c.kontakt is not null and not c.test and c.reviewed_at is null) else 0 end
  ) end;
$$;

-- ------------------------------------------------------------------
-- RLS i ovlasti
-- ------------------------------------------------------------------
alter table public.crm_fixed_costs        enable row level security;
alter table public.crm_ai_usage           enable row level security;
alter table public.crm_chat_conversations enable row level security;
alter table public.crm_chat_messages      enable row level security;

create policy crm_fixed_costs_all on public.crm_fixed_costs for all to authenticated
  using (public.is_crm_admin()) with check (public.is_crm_admin());
create policy crm_ai_usage_read on public.crm_ai_usage for select to authenticated using (public.is_crm_admin());
create policy crm_chat_conv_read on public.crm_chat_conversations for select to authenticated using (public.is_staff());
create policy crm_chat_conv_delete on public.crm_chat_conversations for delete to authenticated using (public.is_crm_admin());
create policy crm_chat_msg_read on public.crm_chat_messages for select to authenticated using (public.is_staff());

revoke all on public.crm_fixed_costs, public.crm_ai_usage, public.crm_chat_conversations, public.crm_chat_messages from anon, authenticated;
grant select, insert, update on public.crm_fixed_costs to authenticated;
grant select on public.crm_ai_usage, public.crm_chat_messages to authenticated;
grant select, delete on public.crm_chat_conversations to authenticated;

revoke execute on function public.crm_chat_contact(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.crm_chat_contact(uuid, text, text, text) to service_role;
revoke execute on function public.crm_chat_mark_reviewed(uuid), public.crm_nav_counts() from public, anon;
grant execute on function public.crm_chat_mark_reviewed(uuid), public.crm_nav_counts() to authenticated;
-- Server (service role) treba vlasnika automatskog leada.
grant execute on function public.crm_next_lead_owner() to service_role;
