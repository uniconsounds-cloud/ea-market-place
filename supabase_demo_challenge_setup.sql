-- ==========================================
-- Demo Challenge Database Setup Script
-- Run this script in your Supabase SQL Editor
-- ==========================================

-- 1. Create demo_challenges table
CREATE TABLE IF NOT EXISTS public.demo_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referrer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    risk_level NUMERIC NOT NULL DEFAULT 0.1,
    current_balance NUMERIC NOT NULL DEFAULT 10000.00,
    master_port_number TEXT NOT NULL DEFAULT '100000', -- Replace with actual master port
    join_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id) -- One user can only join one demo challenge at a time
);

-- Index for querying by user_id and referrer_id
CREATE INDEX IF NOT EXISTS idx_demo_challenges_user ON public.demo_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_demo_challenges_referrer ON public.demo_challenges(referrer_id);

-- Enable RLS
ALTER TABLE public.demo_challenges ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies
-- Users can read their own demo challenge
CREATE POLICY "Users can read own demo challenge"
    ON public.demo_challenges
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own demo challenge
CREATE POLICY "Users can join demo challenge"
    ON public.demo_challenges
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own demo challenge (e.g. changing risk level before it locks, or system updates balance)
CREATE POLICY "Users can update own demo challenge"
    ON public.demo_challenges
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Admins can read all demo challenges (for the dashboard)
CREATE POLICY "Admins can read all demo challenges"
    ON public.demo_challenges
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 3. Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_demo_challenges_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_demo_challenges_updated_at ON public.demo_challenges;
CREATE TRIGGER trigger_update_demo_challenges_updated_at
BEFORE UPDATE ON public.demo_challenges
FOR EACH ROW
EXECUTE FUNCTION update_demo_challenges_updated_at();

-- 4. View for Admin Dashboard (Join with Profiles)
-- This view helps the admin dashboard quickly get user details along with their challenge stats
CREATE OR REPLACE VIEW admin_demo_challenges_view AS
SELECT 
    dc.id,
    dc.user_id,
    p.email AS user_email,
    p.full_name AS user_name,
    dc.referrer_id,
    rp.email AS referrer_email,
    rp.full_name AS referrer_name,
    dc.risk_level,
    dc.current_balance,
    dc.join_date,
    dc.created_at
FROM 
    public.demo_challenges dc
JOIN 
    public.profiles p ON dc.user_id = p.id
LEFT JOIN 
    public.profiles rp ON dc.referrer_id = rp.id;

-- Ensure admins can query the view
GRANT SELECT ON admin_demo_challenges_view TO authenticated;
