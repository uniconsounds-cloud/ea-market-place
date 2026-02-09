-- FIX ADMIN ACCESS RECOVERY
-- The previous policy caused infinite recursion on the 'profiles' table.

-- 1. Create a secure function to check admin status
-- "SECURITY DEFINER" allows this function to bypass RLS when reading profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all licenses" ON licenses;
DROP POLICY IF EXISTS "Admins can update all licenses" ON licenses;
DROP POLICY IF EXISTS "Admins can insert licenses" ON licenses;

-- 3. Re-create Profiles Policy (No Recursion)
-- Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Allow Admins to view ALL profiles (using the secure function)
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT USING (is_admin());

-- 4. Re-create Orders Policy (Safe)
CREATE POLICY "Admins can view all orders" ON orders
FOR SELECT TO authenticated USING (is_admin());

-- 5. Re-create Licenses Policy (Safe)
CREATE POLICY "Admins can view all licenses" ON licenses
FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Admins can update all licenses" ON licenses
FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "Admins can insert licenses" ON licenses
FOR INSERT TO authenticated WITH CHECK (is_admin());
