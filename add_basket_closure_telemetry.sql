-- ==========================================================
-- EAEZE Basket Closure Telemetry Migration
-- Adds rich strategy & analytical columns to farm_batch_events
-- ==========================================================

ALTER TABLE public.farm_batch_events
ADD COLUMN IF NOT EXISTS symbol TEXT,
ADD COLUMN IF NOT EXISTS side TEXT,
ADD COLUMN IF NOT EXISTS exit_type TEXT,
ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
ADD COLUMN IF NOT EXISTS ea_name TEXT,
ADD COLUMN IF NOT EXISTS ea_build TEXT,
ADD COLUMN IF NOT EXISTS max_dd_pct DOUBLE PRECISION;

-- Ensure RLS allows public/service insert
DROP POLICY IF EXISTS "Allow public insert to batch events" ON public.farm_batch_events;
CREATE POLICY "Allow public insert to batch events"
    ON public.farm_batch_events FOR INSERT WITH CHECK (true);

-- Update sync_ea_data RPC to also accept and log BATCH_CLOSE directly
-- Run this block if using Direct-to-Supabase RPC for batch closures
CREATE OR REPLACE FUNCTION public.sync_ea_data(p_payload JSONB, p_api_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_port_number TEXT;
    v_today_profit NUMERIC;
    v_today_closed_lots NUMERIC;
    v_daily_max_drawdown NUMERIC;
    v_server_time BIGINT;
    v_sync_date DATE;
    v_key_valid BOOLEAN := false;
    v_should_sync_full BOOLEAN := false;
    v_last_viewed TIMESTAMPTZ;
    v_license_tier VARCHAR(20) := 'free';
    v_sync_interval INT := 30;
    v_is_trial BOOLEAN := false;
BEGIN
    v_port_number := p_payload->>'port_number';

    -- Handle immediate BATCH_CLOSE event
    IF p_payload->>'type' = 'BATCH_CLOSE' THEN
        INSERT INTO public.farm_batch_events (
            port_number, total_orders, total_lots, total_profit,
            symbol, side, exit_type, duration_sec, ea_name, ea_build, max_dd_pct, event_timestamp
        )
        VALUES (
            v_port_number,
            COALESCE((p_payload->>'total_orders')::INTEGER, 0),
            COALESCE((p_payload->>'total_lots')::DOUBLE PRECISION, 0),
            COALESCE((p_payload->>'total_profit')::DOUBLE PRECISION, 0),
            p_payload->>'symbol',
            p_payload->>'side',
            p_payload->>'exit_type',
            COALESCE((p_payload->>'duration_sec')::INTEGER, 0),
            p_payload->>'ea_name',
            p_payload->>'ea_build',
            COALESCE((p_payload->>'max_dd_pct')::DOUBLE PRECISION, 0),
            NOW()
        );
        RETURN jsonb_build_object('success', true, 'message', 'Batch closure recorded successfully');
    END IF;

    -- Extract info for standard heartbeat
    v_today_profit       := (p_payload->>'today_profit')::NUMERIC;
    v_today_closed_lots  := (p_payload->>'today_closed_lots')::NUMERIC;
    v_daily_max_drawdown := (p_payload->>'daily_max_drawdown')::NUMERIC;
    v_server_time        := (p_payload->>'server_time')::BIGINT;

    -- Validate API Key or Active License
    SELECT EXISTS(
        SELECT 1 FROM public.api_keys 
        WHERE key_value = p_api_key AND status = 'active'
    ) INTO v_key_valid;

    IF NOT v_key_valid AND v_port_number IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.licenses
            WHERE account_number = v_port_number AND is_active = true
        ) INTO v_key_valid;
    END IF;

    IF NOT v_key_valid AND v_port_number IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid payload: missing port number');
    END IF;

    -- Calculate broker date
    IF v_server_time IS NOT NULL AND v_server_time > 0 THEN
        v_sync_date := (to_timestamp(v_server_time))::DATE;
    ELSE
        v_sync_date := CURRENT_DATE;
    END IF;

    -- Check if user is actively viewing to enable full sync
    SELECT last_viewed_at INTO v_last_viewed
    FROM public.farm_port_status
    WHERE port_number = v_port_number;

    IF v_last_viewed IS NOT NULL AND (NOW() - v_last_viewed) < INTERVAL '2 minutes' THEN
        v_should_sync_full := true;
    END IF;

    -- Upsert farm_port_status
    INSERT INTO public.farm_port_status (
        port_number, balance, equity, floating_pnl, today_pnl,
        buy_count, sell_count, buy_pnl, sell_pnl, total_lots,
        account_type, asset_type, system_code, ea_version,
        server_time, daily_max_drawdown, today_closed_lots, last_ping, is_online, updated_at
    )
    VALUES (
        v_port_number,
        (p_payload->'snapshot'->'account'->>'balance')::NUMERIC,
        (p_payload->'snapshot'->'account'->>'equity')::NUMERIC,
        ((p_payload->'snapshot'->'buy_state'->>'floating_pnl')::NUMERIC + (p_payload->'snapshot'->'sell_state'->>'floating_pnl')::NUMERIC),
        COALESCE(v_today_profit, 0),
        (p_payload->'snapshot'->'buy_state'->>'open_count')::INTEGER,
        (p_payload->'snapshot'->'sell_state'->>'open_count')::INTEGER,
        (p_payload->'snapshot'->'buy_state'->>'floating_pnl')::NUMERIC,
        (p_payload->'snapshot'->'sell_state'->>'floating_pnl')::NUMERIC,
        ((p_payload->'snapshot'->'buy_state'->>'open_lots')::NUMERIC + (p_payload->'snapshot'->'sell_state'->>'open_lots')::NUMERIC),
        COALESCE(p_payload->'snapshot'->'account'->>'currency', 'USD'),
        COALESCE(p_payload->'snapshot'->'identity'->>'product_family', 'GOLD'),
        p_payload->'snapshot'->'identity'->>'system_code',
        p_payload->'snapshot'->'identity'->>'ea_version',
        v_server_time,
        COALESCE(v_daily_max_drawdown, 0),
        COALESCE(v_today_closed_lots, 0),
        NOW(),
        true,
        NOW()
    )
    ON CONFLICT (port_number) DO UPDATE SET
        balance            = COALESCE(EXCLUDED.balance, farm_port_status.balance),
        equity             = COALESCE(EXCLUDED.equity, farm_port_status.equity),
        floating_pnl       = COALESCE(EXCLUDED.floating_pnl, farm_port_status.floating_pnl),
        today_pnl          = COALESCE(EXCLUDED.today_pnl, farm_port_status.today_pnl),
        buy_count          = COALESCE(EXCLUDED.buy_count, farm_port_status.buy_count),
        sell_count         = COALESCE(EXCLUDED.sell_count, farm_port_status.sell_count),
        buy_pnl            = COALESCE(EXCLUDED.buy_pnl, farm_port_status.buy_pnl),
        sell_pnl           = COALESCE(EXCLUDED.sell_pnl, farm_port_status.sell_pnl),
        total_lots         = COALESCE(EXCLUDED.total_lots, farm_port_status.total_lots),
        account_type       = COALESCE(EXCLUDED.account_type, farm_port_status.account_type),
        asset_type         = COALESCE(EXCLUDED.asset_type, farm_port_status.asset_type),
        system_code        = COALESCE(EXCLUDED.system_code, farm_port_status.system_code),
        ea_version         = COALESCE(EXCLUDED.ea_version, farm_port_status.ea_version),
        server_time        = COALESCE(EXCLUDED.server_time, farm_port_status.server_time),
        daily_max_drawdown = COALESCE(EXCLUDED.daily_max_drawdown, farm_port_status.daily_max_drawdown),
        today_closed_lots  = COALESCE(EXCLUDED.today_closed_lots, farm_port_status.today_closed_lots),
        last_ping          = NOW(),
        is_online          = true,
        updated_at         = NOW();

    RETURN jsonb_build_object('success', true, 'full_sync', v_should_sync_full, 'sync_interval', v_sync_interval);
END;
$$;
