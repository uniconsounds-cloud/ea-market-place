-- Fix PROFILES policies to ensure RLS doesn't block the admin check
alter table profiles enable row level security;

-- Drop to reset
drop policy if exists "Public profiles are viewable by everyone" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

-- Allow everyone to read profiles (needed so the 'exists' subquery in orders policy works, and for admin to see user names)
create policy "Public profiles are viewable by everyone"
on profiles for select
using ( true );

-- Allow users to insert/update their own
create policy "Users can insert their own profile"
on profiles for insert
with check ( auth.uid() = id );

create policy "Users can update own profile"
on profiles for update
using ( auth.uid() = id );

-- ALSO: Double check if products table is readable
alter table products enable row level security;
drop policy if exists "Enable read access for all users" on products;
create policy "Enable read access for all users" on products for select using (true);
