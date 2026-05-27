-- ===================================================================
-- SQL Patch to fix LOTS and MAX DD not showing in Farm HUD
-- Run this script in your Supabase SQL Editor
-- ===================================================================

-- 1. Ensure columns exist in public.farm_port_status
ALTER TABLE public.farm_port_status ADD COLUMN IF NOT EXISTS daily_max_drawdown DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.farm_port_status ADD COLUMN IF NOT EXISTS today_closed_lots DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.farm_port_status ADD COLUMN IF NOT EXISTS today_pnl DOUBLE PRECISION NOT NULL DEFAULT 0;

-- 2. Ensure columns exist in public.farm_daily_history (covering both naming styles)
ALTER TABLE public.farm_daily_history ADD COLUMN IF NOT EXISTS max_drawdown DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.farm_daily_history ADD COLUMN IF NOT EXISTS closed_lots DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.farm_daily_history ADD COLUMN IF NOT EXISTS max_dd DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.farm_daily_history ADD COLUMN IF NOT EXISTS lots DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE public.farm_daily_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Re-create sync_ea_data RPC to extract and upsert these values in real-time
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
BEGIN
    -- Extract info from payload
    v_port_number        := p_payload->>'port_number';
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

    -- If ping only, return early
    IF (p_payload->>'ping_only') = 'true' THEN
        RETURN jsonb_build_object(
            'success', true,
            'sync_date', v_sync_date,
            'should_sync_full', v_should_sync_full
        );
    END IF;

    -- 4. Upsert farm_port_status with drawdown and closed lots
    INSERT INTO public.farm_port_status (
        port_number, balance, equity, floating_pnl, today_pnl,
        buy_count, sell_count, buy_pnl, sell_pnl, total_lots,
        account_type, asset_type, system_code, ea_version,
        server_time, daily_max_drawdown, today_closed_lots, updated_at
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
        NOW()
    )
    ON CONFLICT (port_number) DO UPDATE SET
        balance            = EXCLUDED.balance,
        equity             = EXCLUDED.equity,
        floating_pnl       = EXCLUDED.floating_pnl,
        today_pnl          = EXCLUDED.today_pnl,
        buy_count          = EXCLUDED.buy_count,
        sell_count         = EXCLUDED.sell_count,
        buy_pnl            = EXCLUDED.buy_pnl,
        sell_pnl           = EXCLUDED.sell_pnl,
        total_lots         = EXCLUDED.total_lots,
        account_type       = EXCLUDED.account_type,
        asset_type         = EXCLUDED.asset_type,
        system_code        = EXCLUDED.system_code,
        ea_version         = EXCLUDED.ea_version,
        server_time        = EXCLUDED.server_time,
        daily_max_drawdown = EXCLUDED.daily_max_drawdown,
        today_closed_lots  = EXCLUDED.today_closed_lots,
        updated_at         = NOW();

    -- 5. Manage Active Orders via Smart UPSERT
    IF v_should_sync_full AND (p_payload->>'is_heartbeat') IS DISTINCT FROM 'true' THEN
        IF p_payload->'orders' IS NOT NULL AND jsonb_array_length(p_payload->'orders') > 0 THEN
            -- Delete orders that are NO LONGER in the EA's report
            DELETE FROM public.farm_active_orders 
            WHERE port_number = v_port_number 
              AND ticket_id NOT IN (
                  SELECT (ord->>'ticket_id')::BIGINT 
                  FROM jsonb_array_elements(p_payload->'orders') AS ord
              );

            -- Upsert active orders
            INSERT INTO public.farm_active_orders (port_number, ticket_id, type, status, current_pnl, raw_lot_size)
            SELECT
                v_port_number,
                (ord->>'ticket_id')::BIGINT,
                ord->>'type',
                ord->>'status',
                (ord->>'current_pnl')::NUMERIC,
                (ord->>'raw_lot_size')::NUMERIC
            FROM jsonb_array_elements(p_payload->'orders') AS ord
            ON CONFLICT (ticket_id) DO UPDATE SET
                type = EXCLUDED.type,
                status = EXCLUDED.status,
                current_pnl = EXCLUDED.current_pnl,
                raw_lot_size = EXCLUDED.raw_lot_size,
                updated_at = NOW();
        ELSE
            -- Clear all active orders if empty array passed
            DELETE FROM public.farm_active_orders WHERE port_number = v_port_number;
        END IF;
    END IF;

    -- 6. Save Daily History Profit and Stats
    IF v_today_profit IS NOT NULL THEN
        INSERT INTO public.farm_daily_history (port_number, date, profit, max_drawdown, closed_lots, max_dd, lots, updated_at)
        VALUES (
            v_port_number, 
            v_sync_date, 
            v_today_profit, 
            COALESCE(v_daily_max_drawdown, 0), 
            COALESCE(v_today_closed_lots, 0),
            COALESCE(v_daily_max_drawdown, 0),
            COALESCE(v_today_closed_lots, 0),
            NOW()
        )
        ON CONFLICT (port_number, date) DO UPDATE SET
            profit       = EXCLUDED.profit,
            max_drawdown = EXCLUDED.max_drawdown,
            closed_lots  = EXCLUDED.closed_lots,
            max_dd       = EXCLUDED.max_dd,
            lots         = EXCLUDED.lots,
            updated_at   = NOW();
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sync_date', v_sync_date,
        'should_sync_full', v_should_sync_full
    );
END;
$$;
