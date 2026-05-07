-- ==========================================
-- EAEZE History Batch Sync (Self-Healing)
-- Run this script in your Supabase SQL Editor
-- ==========================================

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
    -- 1. Validate API Key
    SELECT EXISTS (
        SELECT 1 FROM public.api_keys WHERE key_value = p_api_key
    ) INTO v_is_valid;

    IF NOT v_is_valid THEN
        RAISE EXCEPTION 'Invalid API Key';
    END IF;

    -- 2. Process the JSON array
    -- Expected format: [{"date": "YYYY-MM-DD", "profit": 10.5, "lots": 0.5, "max_dd": 2.0}, ...]
    IF jsonb_typeof(p_history_array) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_history_array)
        LOOP
            -- 3. Upsert into farm_daily_history
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
                profit = EXCLUDED.profit,
                max_drawdown = EXCLUDED.max_drawdown,
                closed_lots = EXCLUDED.closed_lots;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Batch history synced successfully');
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
