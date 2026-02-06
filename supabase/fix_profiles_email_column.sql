-- FIX: ADD MISSING EMAIL COLUMN & BACKFILL
-- 1. Add 'email' column to profiles
alter table public.profiles add column if not exists email text;

-- 2. Update the Trigger Function (Now checking email properly)
create or replace function public.handle_new_user() 
returns trigger 
language plpgsql 
security definer 
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email, 'user');
  return new;
end;
$$;

-- 3. Re-apply Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Backfill Missing Profiles (Safe Insert)
-- This takes users from Auth system and puts them into Profiles
insert into public.profiles (id, email, full_name, role)
select id, email, raw_user_meta_data->>'full_name', 'user'
from auth.users
where id not in (select id from public.profiles);
