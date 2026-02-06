-- Fix ORDERS policies
alter table orders enable row level security;

-- Drop existing policies to avoid conflicts
drop policy if exists "Users can create their own orders" on orders;
drop policy if exists "Users can view their own orders" on orders;
drop policy if exists "Admins can view all orders" on orders;
drop policy if exists "Admins can update orders" on orders;

-- 1. INSERT: Allow authenticated users to create orders
create policy "Users can create their own orders"
on orders for insert
with check ( auth.uid() = user_id );

-- 2. SELECT: Users see their own, Admins see all
create policy "Users can view their own orders"
on orders for select
using ( auth.uid() = user_id );

create policy "Admins can view all orders"
on orders for select
using ( 
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

-- 3. UPDATE: Admins can update status (approve/reject)
create policy "Admins can update orders"
on orders for update
using ( 
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

-- Fix LICENSES policies (Ensure Admins can create them)
alter table licenses enable row level security;

drop policy if exists "Users can view their own licenses" on licenses;
drop policy if exists "Admins can create licenses" on licenses;

create policy "Users can view their own licenses"
on licenses for select
using ( auth.uid() = user_id );

create policy "Admins can create licenses"
on licenses for insert
with check ( 
  exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);
