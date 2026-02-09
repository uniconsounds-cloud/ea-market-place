-- DEBUG: TEMPORARY OPEN ACCESS TO PROFILES
-- Use this if Admin Dashboard is still empty.
-- It helps verify if RLS is the problem.

-- 1. Drop existing policies (TEMPORARY)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Debug: Authenticated can view all" ON profiles;

-- 2. Create OPEN policy for authenticated users
CREATE POLICY "Debug: Authenticated can view all" ON profiles
FOR SELECT TO authenticated
USING (true);

-- 3. Check Current User Role (Will show in output if run in SQL Editor)
-- This helps verify if your user actually has 'admin' role in the DB
SELECT id, email, role FROM profiles WHERE id = auth.uid();
