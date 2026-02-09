-- Policy: Allow Admins to UPDATE licenses
-- adjusting for likely schema (profiles table with role)

-- First, drop existing policy if it conflicts (optional, but good for idempotency if named known)
drop policy if exists "Admins can update all licenses" on licenses;

create policy "Admins can update all licenses"
on licenses
for update
to authenticated
using (
  auth.uid() in (
    select id from profiles where role = 'admin'
  )
);

-- Also allow Insert
drop policy if exists "Admins can insert licenses" on licenses;

create policy "Admins can insert licenses"
on licenses
for insert
to authenticated
with check (
  auth.uid() in (
    select id from profiles where role = 'admin'
  )
);
