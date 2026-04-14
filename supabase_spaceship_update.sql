-- ==========================================
-- EAEZE Spaceship Dashboard & Realtime Sync
-- Run this script in your Supabase SQL Editor
-- ==========================================

-- 1. Create farm_port_status table (Account Summary)
CREATE TABLE IF NOT EXISTS public.farm_port_status (
    port_number TEXT PRIMARY KEY,
    balance DOUBLE PRECISION NOT NULL DEFAULT 0,
    equity DOUBLE PRECISION NOT NULL DEFAULT 0,
    floating_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_drawdown DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_lots DOUBLE PRECISION NOT NULL DEFAULT 0,
    buy_count INTEGER NOT NULL DEFAULT 0,
    sell_count INTEGER NOT NULL DEFAULT 0,
    buy_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
    sell_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
    account_type TEXT DEFAULT 'USD', -- 'USD' or 'USC'
    asset_type TEXT DEFAULT 'GOLD', -- 'GOLD', 'FOREX', 'CRYPTO'
    is_online BOOLEAN DEFAULT FALSE,
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_port_status_number ON public.farm_port_status(port_number);

-- Enable RLS
ALTER TABLE public.farm_port_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to port status"
    ON public.farm_port_status FOR SELECT USING (true);

-- 2. Create farm_batch_events table (Group Closures)
CREATE TABLE IF NOT EXISTS public.farm_batch_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    port_number TEXT NOT NULL,
    total_orders INTEGER NOT NULL,
    total_lots DOUBLE PRECISION NOT NULL,
    total_profit DOUBLE PRECISION NOT NULL,
    event_timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.farm_batch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to batch events"
    ON public.farm_batch_events FOR SELECT USING (true);

-- 3. Enable Realtime replication for these tables
-- Run these individually if the combined script fails
ALTER PUBLICATION supabase_realtime ADD TABLE public.farm_port_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.farm_batch_events;

-- 4. Create farm_daily_history if not exists (30-day view)
CREATE TABLE IF NOT EXISTS public.farm_daily_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    port_number TEXT NOT NULL,
    date DATE NOT NULL,
    profit DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_dd DOUBLE PRECISION NOT NULL DEFAULT 0,
    lots DOUBLE PRECISION NOT NULL DEFAULT 0,
    UNIQUE(port_number, date)
);

-- Enable RLS
ALTER TABLE public.farm_daily_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to daily history"
    ON public.farm_daily_history FOR SELECT USING (true);
