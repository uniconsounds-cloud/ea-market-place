-- Add new columns for Farm HUD to farm_monthly_history (or a new table)
-- We will add them to a new table `farm_port_status` to track real-time port states separately from historical months.

CREATE TABLE IF NOT EXISTS public.farm_port_status (
    port_number TEXT PRIMARY KEY,
    balance NUMERIC DEFAULT 0,
    equity NUMERIC DEFAULT 0,
    margin_level NUMERIC DEFAULT 0,
    account_type TEXT DEFAULT 'USD',
    max_drawdown NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Establish RLS for this table
ALTER TABLE public.farm_port_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.farm_port_status
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role only" ON public.farm_port_status
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for service role only" ON public.farm_port_status
    FOR UPDATE USING (true);
