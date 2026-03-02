CREATE TABLE IF NOT EXISTS public.ib_memberships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    broker_id UUID REFERENCES public.brokers(id) ON DELETE CASCADE,
    verification_data TEXT, 
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, broker_id)
);

ALTER TABLE public.ib_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ib memberships" 
ON public.ib_memberships FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ib memberships" 
ON public.ib_memberships FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage ib memberships" 
ON public.ib_memberships FOR ALL 
TO authenticated 
USING (is_admin())
WITH CHECK (is_admin());

-- Custom trigger to automatically update the `updated_at` column
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ib_memberships_updated_at ON public.ib_memberships;
CREATE TRIGGER set_ib_memberships_updated_at
BEFORE UPDATE ON public.ib_memberships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Migrate existing data from profiles to ib_memberships
INSERT INTO public.ib_memberships (user_id, broker_id, verification_data, status)
SELECT id, ib_broker_id, ib_account_number, ib_status
FROM public.profiles
WHERE ib_broker_id IS NOT NULL 
AND ib_status IN ('pending', 'approved', 'rejected')
ON CONFLICT (user_id, broker_id) DO NOTHING;
