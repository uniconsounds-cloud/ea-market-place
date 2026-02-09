-- MASTER FIX FOR ADMIN ACCESS
-- This script fixes RLS policies for Profiles, Orders, and Licenses to ensure Admins can view ALL data.

-- 1. Ensure is_admin() function exists and is secure (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  -- Check if the user has the 'admin' role in the profiles table
  -- We use a direct query here. Since this is SECURITY DEFINER, it bypasses RLS.
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix PROFILES Policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Restore standard user policy
CREATE POLICY "Users can view own profile" ON profiles
FOR SELECT USING (auth.uid() = id);

-- Create Admin policy using the secure function
CREATE POLICY "Admins can view all profiles" ON profiles
FOR SELECT TO authenticated
USING (is_admin());

-- 3. Fix ORDERS Policy
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;

-- Restore standard user policy
CREATE POLICY "Users can view own orders" ON orders
FOR SELECT USING (auth.uid() = user_id);

-- Create Admin policy
CREATE POLICY "Admins can view all orders" ON orders
FOR SELECT TO authenticated
USING (is_admin());

-- 4. Fix LICENSES Policy
DROP POLICY IF EXISTS "Admins can view all licenses" ON licenses;
DROP POLICY IF EXISTS "Users can view own licenses" ON licenses;

-- Restore standard user policy
CREATE POLICY "Users can view own licenses" ON licenses
FOR SELECT USING (auth.uid() = user_id);

-- Create Admin policy
CREATE POLICY "Admins can view all licenses" ON licenses
FOR SELECT TO authenticated
USING (is_admin());

-- 5. Grant Permissions (Just in case)
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON licenses TO authenticated;

-- Grant Update/Insert for Admins on Licenses/Products (as needed)
DROP POLICY IF EXISTS "Admins can insert/update licenses" ON licenses;
CREATE POLICY "Admins can insert/update licenses" ON licenses
FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "Admins can update orders" ON orders
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

