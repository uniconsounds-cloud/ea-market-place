-- FIX: UPDATE EMAILS FOR EXISTING PROFILES
-- The previous script only inserted NEW rows. This one updates EXISTING rows (like Admin)

update public.profiles
set email = auth.users.email
from auth.users
where public.profiles.id = auth.users.id
and public.profiles.email is null;
