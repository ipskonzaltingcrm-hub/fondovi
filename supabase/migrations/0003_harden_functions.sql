-- Sigurnosno učvršćivanje (odgovor na Supabase advisor upozorenja)
-- (Primijenjeno 2026-11-07 izravno na bazu; datoteka vraćena u repo 2026-11-11.)

-- 1) touch_updated_at: fiksiraj search_path
alter function public.touch_updated_at() set search_path = public;

-- 2) handle_new_user je ISKLJUČIVO trigger funkcija — ne smije biti dostupna kao RPC.
--    (Trigger i dalje okida; revoke ne utječe na okidanje.)
revoke execute on function public.handle_new_user() from anon, authenticated;

-- 3) RLS pomoćne funkcije: anon ih ne treba (sve per-tenant politike su 'to authenticated').
--    'authenticated' zadržava EXECUTE jer ih RLS politike pozivaju pri evaluaciji.
revoke execute on function public.is_superadmin()            from anon;
revoke execute on function public.is_member(uuid)            from anon;
revoke execute on function public.is_tenant_admin(uuid)      from anon;
