-- Allow Admins to SELECT all orders
drop policy if exists "Admins can view all orders" on orders;

create policy "Admins can view all orders"
on orders
for select
to authenticated
using (
  auth.uid() in (
    select id from profiles where role = 'admin'
  )
);

-- Allow Admins to SELECT all licenses
drop policy if exists "Admins can view all licenses" on licenses;

create policy "Admins can view all licenses"
on licenses
for select
to authenticated
using (
  auth.uid() in (
    select id from profiles where role = 'admin'
  )
);

-- Ensure profiles are readable by authenticated users (or at least admins)
-- This is often needed for the subquery `select id from profiles where role = 'admin'` to work if RLS is on for profiles
drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles"
on profiles
for select
to authenticated
using (
  auth.uid() in (
    select id from profiles where role = 'admin'
  )
);
