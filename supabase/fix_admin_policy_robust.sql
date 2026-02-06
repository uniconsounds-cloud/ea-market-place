-- 1. Create a secure function to check admin status
-- SECURITY DEFINER means this function runs with the privileges of the creator (postgres/admin)
-- This allows checking the profiles table WITHOUT being blocked by other RLS policies.
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$;

-- 2. Fix ORDERS Policy using this function
alter table orders enable row level security;

-- Viewer Policy (Admins see all)
drop policy if exists "Admins can view all orders" on orders;
create policy "Admins can view all orders"
on orders for select
using ( is_admin() );

-- Update Policy (Admins can approve/reject)
drop policy if exists "Admins can update orders" on orders;
create policy "Admins can update orders"
on orders for update
using ( is_admin() );

-- 3. Fix LICENSES Policy
alter table licenses enable row level security;

drop policy if exists "Admins can create licenses" on licenses;
create policy "Admins can create licenses"
on licenses for insert
with check ( is_admin() );

-- 4. Fix PRODUCTS Policy (Admins can manage products)
alter table products enable row level security;

drop policy if exists "Enable insert for admins" on products;
create policy "Enable insert for admins" on products for insert 
with check ( is_admin() );

drop policy if exists "Enable update for admins" on products;
create policy "Enable update for admins" on products for update 
using ( is_admin() );

drop policy if exists "Enable delete for admins" on products;
create policy "Enable delete for admins" on products for delete 
using ( is_admin() );
