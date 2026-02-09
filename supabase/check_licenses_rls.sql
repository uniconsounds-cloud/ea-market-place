-- Check existing policies on licenses table
select * from pg_policies where tablename = 'licenses';

-- Ensure Admin can UPDATE licenses
-- Assuming there is a policy for users to read their own, but Admins need full access
-- or at least update access.

-- This policy allows anyone to update, which is insecure but good for debugging if RLS is the issue.
-- A better policy would be "auth.uid() in (select user_id from profiles where role = 'admin')"
-- But for now, let's just see what policies exist.
