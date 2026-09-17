-- =======================================================
-- Fleet Capital & Port Lifecycle Snapshots Table
-- Run in Supabase SQL Editor to enable persistent history
-- =======================================================

CREATE TABLE IF NOT EXISTS public.fleet_capital_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_key TEXT NOT NULL UNIQUE, -- e.g. '2026-09' or '2026-09-17'
    period_type TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'daily'
    active_ports_count INTEGER NOT NULL DEFAULT 0,
    new_ports_count INTEGER NOT NULL DEFAULT 0,
    ended_ports_count INTEGER NOT NULL DEFAULT 0,
    net_growth_ports INTEGER NOT NULL DEFAULT 0,
    active_users_count INTEGER NOT NULL DEFAULT 0,
    active_balance_usc NUMERIC NOT NULL DEFAULT 0,
    active_balance_usd NUMERIC NOT NULL DEFAULT 0,
    stale_balance_usc NUMERIC NOT NULL DEFAULT 0,
    stale_balance_usd NUMERIC NOT NULL DEFAULT 0,
    total_floating_pnl NUMERIC NOT NULL DEFAULT 0,
    monthly_profit NUMERIC NOT NULL DEFAULT 0,
    snapshot_meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.fleet_capital_snapshots ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users / admins
CREATE POLICY "Enable read for authenticated users" ON public.fleet_capital_snapshots
    FOR SELECT TO authenticated USING (true);

-- Allow upsert for authenticated admins / service role
CREATE POLICY "Enable all for service role and admins" ON public.fleet_capital_snapshots
    FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_fleet_snapshots_period ON public.fleet_capital_snapshots(period_key);
