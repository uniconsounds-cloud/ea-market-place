-- =========================================================================
-- EAEZE Data Retention Policy & Auto-Pruning Migration
-- 1. All regular customer ports: Max 1 year (365 days) retention.
-- 2. Master ports (97053088, 21692434): 100% exempt from pruning (Infinite Retention).
-- =========================================================================

-- Function to prune expired records across the entire system
CREATE OR REPLACE FUNCTION public.prune_expired_farm_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_daily_deleted INT := 0;
    v_batch_deleted INT := 0;
    v_cutoff_date DATE := (CURRENT_DATE - INTERVAL '365 days')::DATE;
    v_cutoff_time TIMESTAMPTZ := NOW() - INTERVAL '365 days';
BEGIN
    -- Delete daily history older than 365 days for all regular customer ports
    WITH deleted_daily AS (
        DELETE FROM public.farm_daily_history
        WHERE port_number NOT IN ('97053088', '21692434')
          AND date < v_cutoff_date
        RETURNING port_number
    )
    SELECT COUNT(*) INTO v_daily_deleted FROM deleted_daily;

    -- Delete batch closure events older than 365 days for all regular customer ports
    WITH deleted_batch AS (
        DELETE FROM public.farm_batch_events
        WHERE port_number NOT IN ('97053088', '21692434')
          AND event_timestamp < v_cutoff_time
        RETURNING port_number
    )
    SELECT COUNT(*) INTO v_batch_deleted FROM deleted_batch;

    RETURN jsonb_build_object(
        'success', true,
        'cutoff_date', v_cutoff_date,
        'daily_history_pruned', v_daily_deleted,
        'batch_events_pruned', v_batch_deleted
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.prune_expired_farm_records() TO service_role, authenticated, anon;

-- Update sync_ea_history_batch to enforce auto-pruning per customer port
CREATE OR REPLACE FUNCTION public.sync_ea_history_batch(
    p_api_key TEXT,
    p_port_number TEXT,
    p_history_array JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_valid BOOLEAN;
    v_item JSONB;
BEGIN
    -- 1. Validate API Key OR Fallback to Active License
    SELECT EXISTS (
        SELECT 1 FROM public.api_keys WHERE key_value = p_api_key AND status = 'active'
    ) INTO v_is_valid;

    IF NOT v_is_valid AND p_port_number IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.licenses
            WHERE account_number = p_port_number AND is_active = true
        ) INTO v_is_valid;
    END IF;

    IF NOT v_is_valid AND p_port_number IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.admin_test_ports
            WHERE account_number = p_port_number
        ) INTO v_is_valid;
    END IF;

    IF NOT v_is_valid AND p_port_number IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing port number for history sync');
    END IF;

    -- 2. Process the JSON array
    IF jsonb_typeof(p_history_array) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_history_array)
        LOOP
            INSERT INTO public.farm_daily_history (
                port_number, 
                date, 
                profit, 
                max_drawdown, 
                closed_lots
            )
            VALUES (
                p_port_number,
                (v_item->>'date')::DATE,
                COALESCE((v_item->>'profit')::DOUBLE PRECISION, 0),
                COALESCE((v_item->>'max_dd')::DOUBLE PRECISION, 0),
                COALESCE((v_item->>'lots')::DOUBLE PRECISION, 0)
            )
            ON CONFLICT (port_number, date) DO UPDATE SET
                profit = CASE 
                    WHEN (CURRENT_DATE - EXCLUDED.date) <= 7 THEN EXCLUDED.profit
                    WHEN EXCLUDED.profit <> 0 THEN EXCLUDED.profit 
                    ELSE farm_daily_history.profit 
                END,
                max_drawdown = CASE 
                    WHEN (CURRENT_DATE - EXCLUDED.date) <= 7 THEN EXCLUDED.max_drawdown
                    WHEN EXCLUDED.max_drawdown <> 0 THEN EXCLUDED.max_drawdown 
                    ELSE farm_daily_history.max_drawdown 
                END,
                closed_lots = CASE 
                    WHEN (CURRENT_DATE - EXCLUDED.date) <= 7 THEN EXCLUDED.closed_lots
                    WHEN EXCLUDED.closed_lots <> 0 THEN EXCLUDED.closed_lots 
                    ELSE farm_daily_history.closed_lots 
                END,
                updated_at = NOW();
        END LOOP;
    END IF;

    -- 3. Enforce 1-year retention limit for customer ports (User ports 97053088 and 21692434 are 100% exempt)
    IF p_port_number IS NOT NULL AND p_port_number NOT IN ('97053088', '21692434') THEN
        DELETE FROM public.farm_daily_history
        WHERE port_number = p_port_number
          AND date < (CURRENT_DATE - INTERVAL '365 days')::DATE;

        DELETE FROM public.farm_batch_events
        WHERE port_number = p_port_number
          AND event_timestamp < (NOW() - INTERVAL '365 days');
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Batch history synced and retention enforced');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
