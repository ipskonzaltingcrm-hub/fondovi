-- Sigurnosna zakrpa (2026-11-11): korisnik je preko pravila profiles_upd mogao sam sebi
-- postaviti is_superadmin = true (ovlast UPDATE nad svim stupcima). Od sada korisnik smije
-- mijenjati samo svoje ime; profil stvara isključivo okidač handle_new_user, a uloge
-- mijenjaju samo SECURITY DEFINER funkcije.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;
