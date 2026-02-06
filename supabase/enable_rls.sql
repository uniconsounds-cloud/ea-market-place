-- RE-ENABLE RLS & APPLY ROBUST POLICIES
-- Run this to secure the database again after debugging.

-- 1. Enable RLS on all tables
alter table orders enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table licenses enable row level security;

-- 2. Ensure the "is_admin" function exists (Vital for policies)
create or replace function public.is_admin()
returns boolean language plpgsql security definer
as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and role = 'admin');
end;
$$;

-- 3. Apply the Clean Admin Policies (Drop old ones first to avoid conflict)

-- ORDERS
drop policy if exists "Admins can view all orders" on orders;
create policy "Admins can view all orders" on orders for select using ( is_admin() );

drop policy if exists "Users can view their own orders" on orders;
create policy "Users can view their own orders" on orders for select using ( auth.uid() = user_id );

drop policy if exists "Users can create their own orders" on orders;
create policy "Users can create their own orders" on orders for insert with check ( auth.uid() = user_id );

drop policy if exists "Admins can update orders" on orders;
create policy "Admins can update orders" on orders for update using ( is_admin() );

-- PROFILES
drop policy if exists "Public profiles are viewable by everyone" on profiles;
create policy "Public profiles are viewable by everyone" on profiles for select using ( true );

-- PRODUCTS
drop policy if exists "Enable read access for all users" on products;
create policy "Enable read access for all users" on products for select using ( true );
