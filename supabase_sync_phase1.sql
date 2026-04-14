-- Phase 1: Database Security & Scalability Updates

-- 1. Create API Keys Table for Partner-Base Security
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_value TEXT UNIQUE NOT NULL,
    partner_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'revoked'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_value ON public.api_keys(key_value);

-- Enable RLS on api_keys (Keep it private to service role mostly)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 2. Update Port Status table for better identification
ALTER TABLE public.farm_port_status 
ADD COLUMN IF NOT EXISTS system_code TEXT DEFAULT 'EAE_GENERIC',
ADD COLUMN IF NOT EXISTS ea_version TEXT DEFAULT 'v1.0';

-- 3. Data Retention: 90-Day Cleanup Function
-- This function can be called by a cron job or manually during heavy syncs
CREATE OR REPLACE FUNCTION public.cleanup_old_farm_data()
RETURNS void AS $$
BEGIN
    DELETE FROM public.farm_batch_events
    WHERE event_timestamp < NOW() - INTERVAL '90 days';
    
    -- Optional: also cleanup history aggregation if it grows too large (e.g. keep 1 year)
    DELETE FROM public.farm_daily_history
    WHERE date < (CURRENT_DATE - INTERVAL '365 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Seed Legacy Key for Backward Compatibility
-- Assuming "KHUCHAI_SUPHAKORN" is the current global key based on EA files
INSERT INTO public.api_keys (key_value, partner_name, status)
VALUES ('KHUCHAI_SUPHAKORN', 'Legacy_Admin_Global', 'active')
ON CONFLICT (key_value) DO NOTHING;

-- 5. Seed Initial Admin Key for New Systems
INSERT INTO public.api_keys (key_value, partner_name, status)
VALUES ('EAEZE_ADMIN_001', 'Admin_Primary', 'active')
ON CONFLICT (key_value) DO NOTHING;
