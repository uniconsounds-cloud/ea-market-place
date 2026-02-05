-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. CREATE TABLES (IF NOT EXISTS)

-- PROFILES
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Add role column safely
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'role') then
    alter table profiles add column role text default 'user';
  end if;
end $$;


-- PRODUCTS
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price_monthly numeric,
  price_lifetime numeric,
  image_url text,
  file_url text,
  version text default '1.0',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ORDERS
create table if not exists orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  product_id uuid references products(id) not null,
  amount numeric not null,
  payment_method text, 
  status text default 'pending', 
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- LICENSES
create table if not exists licenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  product_id uuid references products(id) not null,
  order_id uuid references orders(id),
  account_number text, 
  license_key text default uuid_generate_v4()::text,
  type text check (type in ('monthly', 'lifetime')),
  expiry_date timestamp with time zone, 
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. TRIGGERS (Safe creation)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. POLICIES (Admin & Storage)

-- Enable RLS on Products
alter table products enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Enable read access for all users" on products;
drop policy if exists "Enable insert for admins" on products;
drop policy if exists "Enable update for admins" on products;
drop policy if exists "Enable delete for admins" on products;

-- Create Policies
create policy "Enable read access for all users" on products for select using (true);

create policy "Enable insert for admins" on products for insert 
with check (auth.uid() in (select id from profiles where role = 'admin'));

create policy "Enable update for admins" on products for update 
using (auth.uid() in (select id from profiles where role = 'admin'));

create policy "Enable delete for admins" on products for delete 
using (auth.uid() in (select id from profiles where role = 'admin'));

-- Storage Policies (Best effort)
-- Note: Must create 'products' bucket in UI first!

drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'products' );

drop policy if exists "Authenticated users can upload images" on storage.objects;
create policy "Authenticated users can upload images" on storage.objects for insert 
with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

drop policy if exists "Authenticated users can update images" on storage.objects;
create policy "Authenticated users can update images" on storage.objects for update 
with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- 5. SAMPLE DATA (Insert only if empty)
insert into products (name, description, price_monthly, price_lifetime, image_url, is_active)
select 'Gold Scalper Pro', 'Advanced EA for Gold trading. High Winrate.', 990.00, 9900.00, '/images/ea1.jpg', true
where not exists (select 1 from products where name = 'Gold Scalper Pro');

insert into products (name, description, price_monthly, price_lifetime, image_url, is_active)
select 'Forex Grid Master', 'Grid trading strategy for major pairs.', 690.00, 6900.00, '/images/ea2.jpg', true
where not exists (select 1 from products where name = 'Forex Grid Master');

insert into products (name, description, price_monthly, price_lifetime, image_url, is_active)
select 'Trend Hunter', 'Follow the trend with AI precision.', 850.00, 8500.00, '/images/ea3.jpg', true
where not exists (select 1 from products where name = 'Trend Hunter');
