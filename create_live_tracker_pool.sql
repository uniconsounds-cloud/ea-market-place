-- ==============================================================================
-- EasyM Live Tracker - Synthetic Model Pool & Swap Logs Schema
-- Run this in Supabase SQL Editor if you wish to migrate from JSON to dedicated tables
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.live_tracker_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    port_number TEXT UNIQUE NOT NULL,
    pool_type TEXT NOT NULL CHECK (pool_type IN ('active', 'reserve')),
    priority_order INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'ejected')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_tracker_pool_type ON public.live_tracker_pool(pool_type);
CREATE INDEX IF NOT EXISTS idx_live_tracker_pool_port ON public.live_tracker_pool(port_number);

CREATE TABLE IF NOT EXISTS public.live_tracker_swap_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    out_port_number TEXT,
    in_port_number TEXT,
    reason TEXT NOT NULL,
    details JSONB,
    swapped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_tracker_swap_time ON public.live_tracker_swap_logs(swapped_at DESC);
