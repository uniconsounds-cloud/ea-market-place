-- ==========================================
-- EasyGold Farm Database Setup Script
-- Run this script in your Supabase SQL Editor
-- ==========================================

-- 1. Create farm_active_orders table
CREATE TABLE IF NOT EXISTS public.farm_active_orders (
    ticket_id BIGINT PRIMARY KEY,
    port_number TEXT NOT NULL,
    type TEXT NOT NULL, -- 'BUY' or 'SELL'
    status TEXT NOT NULL, -- 'OPEN', 'CLOSED_TP', 'CLOSED_SL', 'CLOSED_MANUAL'
    current_pnl DOUBLE PRECISION NOT NULL,
    sl_risk_percent DOUBLE PRECISION NOT NULL,
    raw_lot_size DOUBLE PRECISION NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by port_number quickly
CREATE INDEX IF NOT EXISTS idx_farm_port ON public.farm_active_orders(port_number);

-- Enable RLS logic allows public read (for frontend subscribing)
ALTER TABLE public.farm_active_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to farm orders"
    ON public.farm_active_orders
    FOR SELECT
    USING (true);

-- API backend role (Service Role) bypasses RLS naturally for Inserts/Updates.

-- 2. Create farm_monthly_history table
CREATE TABLE IF NOT EXISTS public.farm_monthly_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    port_number TEXT NOT NULL,
    month_year TEXT NOT NULL, -- 'YYYY-MM'
    total_profit DOUBLE PRECISION DEFAULT 0.0,
    golden_fruits_count INTEGER DEFAULT 0,
    dead_flowers_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying history
CREATE INDEX IF NOT EXISTS idx_farm_history_port ON public.farm_monthly_history(port_number);

-- Enable RLS logic
ALTER TABLE public.farm_monthly_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to farm history"
    ON public.farm_monthly_history
    FOR SELECT
    USING (true);

-- 3. Enable Realtime replication for farm_active_orders so the WebApp can subscribe to live EA changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.farm_active_orders;
