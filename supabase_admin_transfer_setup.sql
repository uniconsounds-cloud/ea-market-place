-- Create transfer requests table
CREATE TABLE IF NOT EXISTS public.admin_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    source_admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Null if customer has no current referrer
    target_admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    source_approved BOOLEAN DEFAULT FALSE NOT NULL,
    target_approved BOOLEAN DEFAULT FALSE NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'completed', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_transfer_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (who are admins) to perform actions
CREATE POLICY "Admins can do everything on transfer requests" 
ON public.admin_transfer_requests
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Trigger function to process transfer upon double approval
CREATE OR REPLACE FUNCTION public.process_admin_transfer()
RETURNS TRIGGER AS $$
DECLARE
    target_ref_code TEXT;
BEGIN
    -- If there is no current referrer, auto-approve the source side
    IF NEW.source_admin_id IS NULL THEN
        NEW.source_approved := TRUE;
    END IF;

    -- If both sides approved, and status is pending, perform the transfer
    IF NEW.source_approved = TRUE AND NEW.target_approved = TRUE AND NEW.status = 'pending' THEN
        -- Get target admin's referral code
        SELECT referral_code INTO target_ref_code FROM public.profiles WHERE id = NEW.target_admin_id;

        -- 1. Update profiles table
        UPDATE public.profiles 
        SET 
            referred_by = NEW.target_admin_id,
            referred_by_code = target_ref_code
        WHERE id = NEW.customer_id;

        -- 2. Update demo_challenges table (if exists)
        UPDATE public.demo_challenges
        SET referrer_id = NEW.target_admin_id
        WHERE user_id = NEW.customer_id;

        -- 3. Mark as completed
        NEW.status := 'completed';
    END IF;

    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_process_admin_transfer ON public.admin_transfer_requests;
CREATE TRIGGER trigger_process_admin_transfer
BEFORE INSERT OR UPDATE ON public.admin_transfer_requests
FOR EACH ROW
EXECUTE FUNCTION public.process_admin_transfer();
