-- SQL to add port_name to licenses table
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS port_name TEXT;

-- RLS policy to allow users to update their own license details (like port_name)
DROP POLICY IF EXISTS "Users can update own licenses" ON public.licenses;
CREATE POLICY "Users can update own licenses"
    ON public.licenses
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
