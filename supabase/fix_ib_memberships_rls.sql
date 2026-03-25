-- SQL Script to fix permissions for ib_memberships to allow re-submission (UPSERT)
-- Please run this directly in the Supabase Dashboard > SQL Editor

-- 1. Allow users to UPDATE their own IB requests
-- This is required for the resubmit feature where an existing "rejected" or "pending" record is updated.
DROP POLICY IF EXISTS "Users can update own ib memberships" ON public.ib_memberships;

CREATE POLICY "Users can update own ib memberships"
ON public.ib_memberships FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Optional: If "Users can insert own ib memberships" doesn't already exist or was dropped
-- DROP POLICY IF EXISTS "Users can insert own ib memberships" ON public.ib_memberships;
-- CREATE POLICY "Users can insert own ib memberships" 
-- ON public.ib_memberships FOR INSERT 
-- TO authenticated 
-- WITH CHECK (auth.uid() = user_id);
