-- AUTO-CREATE PROFILE ON SIGNUP
-- This ensures every new user in auth.users automatically gets a row in public.profiles

-- 1. Create Function to handle new user checks
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

-- 2. Create Trigger (Fires after INSERT on auth.users)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. BACKFILL EXISTING USERS (Fix missing profiles)
-- Insert missing profiles for existing users who don't have one
insert into public.profiles (id, email, full_name, role)
select id, email, raw_user_meta_data->>'full_name', 'user'
from auth.users
where id not in (select id from public.profiles);
