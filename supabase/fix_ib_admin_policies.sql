-- SQL Script to fix IB Request and Brokers permissions for Admins
-- Please run this directly in the Supabase Dashboard > SQL Editor

-- 1. Ensure the is_admin() helper function is available
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Brokers Table: Give Admins full Insert, Update, Delete access
DROP POLICY IF EXISTS "Brokers can be managed by admins" ON public.brokers;
DROP POLICY IF EXISTS "Admins can manage brokers" ON public.brokers;

CREATE POLICY "Admins can manage brokers" 
ON public.brokers 
FOR ALL TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 3. Profiles Table: Give Admins permission to UPDATE profiles
-- (This is required so they can change the ib_status and ib_expiry_date)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
