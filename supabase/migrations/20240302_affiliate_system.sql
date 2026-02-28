-- 1. Add Affiliate fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 2.00,
ADD COLUMN IF NOT EXISTS accumulated_commission DECIMAL(10,2) DEFAULT 0.00;

-- 1.5 Add Ownership to Brokers Table
ALTER TABLE public.brokers
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id);

-- 2. Create commission_history table
CREATE TABLE IF NOT EXISTS public.commission_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    affiliate_id UUID REFERENCES public.profiles(id) NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) NOT NULL,
    order_id UUID REFERENCES public.orders(id) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Enable RLS on commission_history
ALTER TABLE public.commission_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for commission_history
-- Users can view their own commission history
CREATE POLICY "Users can view their own commissions" 
ON public.commission_history FOR SELECT 
USING (auth.uid() = affiliate_id);

-- Admins can view all commission history
CREATE POLICY "Admins can view all commissions" 
ON public.commission_history FOR SELECT 
USING (is_admin());

-- Admins can insert/update commission history
CREATE POLICY "Admins can manage commissions" 
ON public.commission_history FOR ALL 
USING (is_admin())
WITH CHECK (is_admin());

-- 5. Update Policies for profiles (ensure admins can update referral fields)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- 6. Trigger to auto-generate referral code for new users and assign uplines
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  generated_code TEXT;
  referrer_id UUID := NULL;
  admin1_id UUID;
  admin2_id UUID;
  incoming_ref_code TEXT;
BEGIN
  -- Generate a random 6-character uppercase alphanumeric code
  generated_code := 'REF-' || upper(substring(md5(random()::text) from 1 for 6));
  
  -- Check for referral code in metadata
  incoming_ref_code := new.raw_user_meta_data->>'referred_by_code';
  
  IF incoming_ref_code IS NOT NULL THEN
    -- Try to find the profile with this code
    SELECT id INTO referrer_id FROM public.profiles WHERE referral_code = incoming_ref_code LIMIT 1;
  END IF;

  -- Default Fallback: If no valid referrer, randomly pick between the 2 root admins
  IF referrer_id IS NULL THEN
    SELECT id INTO admin1_id FROM public.profiles WHERE email = 'juntarasate@gmail.com' LIMIT 1;
    SELECT id INTO admin2_id FROM public.profiles WHERE email = 'bctutor123@gmail.com' LIMIT 1;
    
    -- Using a simple random to alternate
    IF random() > 0.5 THEN
        referrer_id := COALESCE(admin1_id, admin2_id); -- Fallback safely if one is missing
    ELSE
        referrer_id := COALESCE(admin2_id, admin1_id);
    END IF;
  END IF;
  
  -- Insert into profiles table
  INSERT INTO public.profiles (id, email, full_name, avatar_url, referral_code, referred_by)
  VALUES (
    new.id, 
    new.email,
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    generated_code,
    referrer_id
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We do not need to recreate the trigger, just replacing the function updates its behavior

-- 7. Backfill existing profiles with referral codes
DO $$
DECLARE
    prof record;
    new_code text;
BEGIN
    FOR prof IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
        new_code := 'REF-' || upper(substring(md5(random()::text) from 1 for 6));
        UPDATE public.profiles SET referral_code = new_code WHERE id = prof.id;
    END LOOP;
END;
$$;
