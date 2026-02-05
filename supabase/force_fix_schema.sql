-- FORCE FIX SCRIPT
-- This script explicitly adds missing columns if they don't exist

-- 1. Fix PROFILES table
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

do $$ 
begin 
  -- Add 'role' if missing
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'role') then
    alter table profiles add column role text default 'user';
  end if;
end $$;

-- 2. Fix PRODUCTS table
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

do $$ 
begin 
  -- Add 'description'
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'description') then
    alter table products add column description text;
  end if;

  -- Add 'price_monthly'
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'price_monthly') then
    alter table products add column price_monthly numeric;
  end if;

  -- Add 'price_lifetime'
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'price_lifetime') then
    alter table products add column price_lifetime numeric;
  end if;

  -- Add 'image_url' (The one causing error)
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'image_url') then
    alter table products add column image_url text;
  end if;

  -- Add 'file_url'
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'file_url') then
    alter table products add column file_url text;
  end if;

  -- Add 'version'
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'version') then
    alter table products add column version text default '1.0';
  end if;

  -- Add 'is_active'
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'is_active') then
    alter table products add column is_active boolean default true;
  end if;
end $$;

-- 3. Re-apply Policies (Safe to run multiple times)
alter table products enable row level security;

drop policy if exists "Enable read access for all users" on products;
create policy "Enable read access for all users" on products for select using (true);

drop policy if exists "Enable insert for admins" on products;
create policy "Enable insert for admins" on products for insert 
with check (auth.uid() in (select id from profiles where role = 'admin'));

drop policy if exists "Enable update for admins" on products;
create policy "Enable update for admins" on products for update 
using (auth.uid() in (select id from profiles where role = 'admin'));

drop policy if exists "Enable delete for admins" on products;
create policy "Enable delete for admins" on products for delete 
using (auth.uid() in (select id from profiles where role = 'admin'));

-- 4. Insert Sample Data (Safe insert)
insert into products (name, description, price_monthly, price_lifetime, image_url, is_active)
select 'Gold Scalper Pro', 'Advanced EA for Gold trading. High Winrate.', 990.00, 9900.00, '/images/ea1.jpg', true
where not exists (select 1 from products where name = 'Gold Scalper Pro');
