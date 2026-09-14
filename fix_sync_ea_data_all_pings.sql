-- ===================================================================
-- SQL Patch to fix sync_ea_data RPC:
-- Ensure farm_port_status (balance, equity, floating_pnl, drawdown)
-- is updated on EVERY ping (even when ping_only = true),
-- and only skip active orders processing when ping_only = true.
-- ===================================================================

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

    -- Get license tier
    IF v_port_number IS NOT NULL THEN
        SELECT COALESCE(license_tier, 'free') INTO v_license_tier
        FROM public.licenses
        WHERE account_number = v_port_number AND is_active = true
        LIMIT 1;
        
        IF v_license_tier IS NULL THEN
            v_license_tier := 'free';
        END IF;
    END IF;

    -- Check if Pro trial is active
    IF v_port_number IS NOT NULL THEN
        SELECT (pro_trial_expires_at IS NOT NULL AND pro_trial_expires_at > NOW()) INTO v_is_trial
        FROM public.farm_port_status
        WHERE port_number = v_port_number;
    END IF;

    -- Map license tier to sync interval (override with pro if in trial)
    IF v_license_tier = 'max' THEN
        v_sync_interval := 10;
    ELSIF v_license_tier = 'pro' OR COALESCE(v_is_trial, false) = true THEN
        v_sync_interval := 20;
    ELSE
        v_sync_interval := 30;
    END IF;

    -- If free user and NOT in active trial, delete any existing active orders
    IF v_license_tier = 'free' AND NOT COALESCE(v_is_trial, false) THEN
        DELETE FROM public.farm_active_orders WHERE port_number = v_port_number;
    END IF;

    -- 5. Upsert farm_port_status on EVERY ping (including ping_only)
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

    -- 6. Manage Active Orders only when full sync is needed and NOT ping_only
    IF (p_payload->>'ping_only') IS DISTINCT FROM 'true' AND v_should_sync_full AND (p_payload->>'is_heartbeat') IS DISTINCT FROM 'true' THEN
        IF p_payload->'orders' IS NOT NULL AND jsonb_array_length(p_payload->'orders') > 0 THEN
            DELETE FROM public.farm_active_orders 
            WHERE port_number = v_port_number 
              AND ticket_id NOT IN (
                  SELECT (ord->>'ticket_id')::BIGINT 
                  FROM jsonb_array_elements(p_payload->'orders') AS ord
              );

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
            DELETE FROM public.farm_active_orders WHERE port_number = v_port_number;
        END IF;
    END IF;

    -- 7. Save Daily History Profit and Stats
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
        'should_sync_full', v_should_sync_full,
        'sync_interval', v_sync_interval,
        'license_tier', COALESCE(v_license_tier, 'free'),
        'is_trial', COALESCE(v_is_trial, false)
    );
END;
$$;
