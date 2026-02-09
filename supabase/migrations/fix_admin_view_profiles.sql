-- Create a policy to allow admins to view all profiles
-- This is necessary for the Admin Dashboard > Customers page and Product Details > Users list

-- Drop existing policy if it conflicts (though unlikely to have this specific name)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create the new policy
CREATE POLICY "Admins can view all profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  is_admin() -- Uses the security definer function we likely created in fix_admin_access_recovery.sql
);

-- Note: We assume is_admin() exists. If not, here is a fallback definition:
-- (Uncomment if needed, but better to rely on previous migration)
/*
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
