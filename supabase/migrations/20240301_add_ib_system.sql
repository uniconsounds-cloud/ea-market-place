-- Create brokers table
CREATE TABLE IF NOT EXISTS public.brokers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    ib_link TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add IB fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ib_status TEXT DEFAULT 'none' CHECK (ib_status IN ('none', 'pending', 'approved', 'rejected', 'expired')),
ADD COLUMN IF NOT EXISTS ib_broker_id UUID REFERENCES public.brokers(id),
ADD COLUMN IF NOT EXISTS ib_account_number TEXT,
ADD COLUMN IF NOT EXISTS ib_expiry_date TIMESTAMP WITH TIME ZONE;

-- Add IB fields to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS is_ib_request BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES public.brokers(id),
ADD COLUMN IF NOT EXISTS ib_account_number TEXT;

-- Enable RLS for brokers
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

-- Policies for brokers
CREATE POLICY "Brokers are viewable by everyone" 
ON public.brokers FOR SELECT 
USING (true);

CREATE POLICY "Brokers can be managed by admins" 
ON public.brokers FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Insert some default brokers
INSERT INTO public.brokers (name, ib_link, is_active)
VALUES 
    ('Exness', 'https://one.exness-track.com/a/your_ib_code', true),
    ('XM', 'https://clicks.pipaffiliates.com/c?c=your_ib_code', true)
ON CONFLICT DO NOTHING;

