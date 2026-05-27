-- SQL to safeguard non-zero history from being overwritten by zero sync values
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
        -- Fallback: Check if this port number is registered with an active license!
        SELECT EXISTS(
            SELECT 1 FROM public.licenses
            WHERE account_number = p_port_number AND is_active = true
        ) INTO v_is_valid;
    END IF;

    IF NOT v_is_valid AND p_port_number IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing port number for history sync');
    END IF;

    -- 2. Process the JSON array
    IF jsonb_typeof(p_history_array) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_history_array)
        LOOP
            -- 3. Upsert into farm_daily_history (only overwrite if new values are non-zero)
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
                profit = CASE WHEN EXCLUDED.profit <> 0 THEN EXCLUDED.profit ELSE farm_daily_history.profit END,
                max_drawdown = CASE WHEN EXCLUDED.max_drawdown <> 0 THEN EXCLUDED.max_drawdown ELSE farm_daily_history.max_drawdown END,
                closed_lots = CASE WHEN EXCLUDED.closed_lots <> 0 THEN EXCLUDED.closed_lots ELSE farm_daily_history.closed_lots END,
                updated_at = NOW();
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Batch history synced successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
