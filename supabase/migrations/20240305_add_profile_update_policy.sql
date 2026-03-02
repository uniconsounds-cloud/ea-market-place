-- Fix Profiles UPDATE permissions
-- Drop any existing conflicting policy first
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create policy allowing users to update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);
