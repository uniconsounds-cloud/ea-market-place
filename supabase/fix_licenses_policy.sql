-- FIX: ADD MISSING LICENSE POLICY
-- RLS was enabled on 'licenses' but no policy was created, causing Insert to fail.

-- 1. Create Policy for Admins to Insert Licenses
drop policy if exists "Admins can create licenses" on licenses;

create policy "Admins can create licenses"
on licenses for insert
with check ( is_admin() );

-- 2. Also allow Admins to VIEW licenses (for debugging/checking)
drop policy if exists "Admins can view licenses" on licenses;

create policy "Admins can view licenses"
on licenses for select
using ( is_admin() );

-- 3. Allow Users to View their OWN licenses (Essential for their Dashboard)
drop policy if exists "Users can view their own licenses" on licenses;

create policy "Users can view their own licenses"
on licenses for select
using ( auth.uid() = user_id );
