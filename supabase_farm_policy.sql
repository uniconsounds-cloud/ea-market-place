-- ==============================================================
-- EasyGold Farm - Additional RLS Security Policy Script
-- Run this script in your Supabase SQL Editor if your backend
-- is inserting data using the public ANON_KEY.
-- ==============================================================

-- Allow API Server to INSERT/UPDATE farm_active_orders
CREATE POLICY "Allow ALL on farm orders for API Syncer"
    ON public.farm_active_orders
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Allow API Server to INSERT/UPDATE farm_monthly_history
CREATE POLICY "Allow ALL on farm history for API Syncer"
    ON public.farm_monthly_history
    FOR ALL
    USING (true)
    WITH CHECK (true);
