-- Create Admin Test Ports Table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.admin_test_ports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number TEXT UNIQUE NOT NULL,
    owner_email TEXT NOT NULL DEFAULT 'juntarasate@gmail.com',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_admin_test_ports_account ON public.admin_test_ports(account_number);

-- Enable RLS (Row Level Security)
ALTER TABLE public.admin_test_ports ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated admins and verify-license API
CREATE POLICY "Allow read for everyone" ON public.admin_test_ports
    FOR SELECT USING (true);

-- Allow full access only to the primary admin juntarasate@gmail.com
CREATE POLICY "Allow full access for juntarasate@gmail.com only" ON public.admin_test_ports
    FOR ALL USING (auth.jwt() ->> 'email' = 'juntarasate@gmail.com');
