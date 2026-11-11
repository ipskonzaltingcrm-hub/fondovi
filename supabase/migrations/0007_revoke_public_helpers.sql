-- 0003 je oduzeo EXECUTE samo ulozi anon, a zadana ovlast PUBLIC je ostala (advisor 0028).
-- RLS pomoćne funkcije trebaju samo prijavljenima.
revoke execute on function public.is_superadmin()        from public, anon;
revoke execute on function public.is_member(uuid)        from public, anon;
revoke execute on function public.is_tenant_admin(uuid)  from public, anon;
grant  execute on function public.is_superadmin(), public.is_member(uuid), public.is_tenant_admin(uuid) to authenticated;
