-- Direct Supabase RPC for Smart Vortex EA (eliminates Vercel invocations from EA sync)
-- Matches EasyM Prime 2-URL architecture: EA posts directly to Supabase REST RPC.
-- Run this once in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.sync_smart_ea_data(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_port         text;
    v_state_key    text;
    v_cmd_key      text;
    v_last_viewed  timestamptz;
    v_has_viewer   boolean := false;
    v_interval     integer := 180;
    v_cmd_raw      text;
    v_cmd_json     jsonb := NULL;
    v_now          timestamptz := now();
    v_state_json   jsonb;
BEGIN
    v_port := trim(coalesce(payload->>'port_number', ''));
    IF v_port = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing port_number');
    END IF;

    v_state_key := 'sv_state_' || v_port;
    v_cmd_key   := 'sv_cmd_' || v_port;

    -- Check if /smart-ea cockpit has an active viewer within last 60 seconds
    SELECT last_viewed_at
      INTO v_last_viewed
      FROM public.farm_port_status
     WHERE port_number = v_state_key
     LIMIT 1;

    IF v_last_viewed IS NOT NULL AND v_last_viewed > (v_now - interval '60 seconds') THEN
        v_has_viewer := true;
        v_interval   := 15;
    END IF;

    -- Stamp server last_ping & conn_status onto payload
    v_state_json := payload || jsonb_build_object(
        'conn_status', 'CONNECTED',
        'last_ping', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );

    INSERT INTO public.farm_port_status (
        port_number,
        balance,
        equity,
        floating_pnl,
        buy_count,
        sell_count,
        system_code,
        ea_version,
        is_online,
        last_ping,
        updated_at
    )
    VALUES (
        v_state_key,
        coalesce((payload->>'balance')::double precision, 0),
        coalesce((payload->>'equity')::double precision, 0),
        coalesce((payload->>'cycle_pnl')::double precision, 0),
        coalesce((payload->>'open_buy')::integer, 0),
        coalesce((payload->>'open_sell')::integer, 0),
        v_state_json::text,
        coalesce(payload->>'ea_version', '1.10'),
        true,
        v_now,
        v_now
    )
    ON CONFLICT (port_number) DO UPDATE SET
        balance      = EXCLUDED.balance,
        equity       = EXCLUDED.equity,
        floating_pnl = EXCLUDED.floating_pnl,
        buy_count    = EXCLUDED.buy_count,
        sell_count   = EXCLUDED.sell_count,
        system_code  = EXCLUDED.system_code,
        ea_version   = EXCLUDED.ea_version,
        is_online    = true,
        last_ping    = v_now,
        updated_at   = v_now;

    -- Fetch latest queued Web Command
    SELECT system_code
      INTO v_cmd_raw
      FROM public.farm_port_status
     WHERE port_number = v_cmd_key
     LIMIT 1;

    IF v_cmd_raw IS NOT NULL AND v_cmd_raw <> '' THEN
        BEGIN
            v_cmd_json := v_cmd_raw::jsonb;
        EXCEPTION WHEN OTHERS THEN
            v_cmd_json := NULL;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sync_interval', v_interval,
        'viewer_active', v_has_viewer,
        'timestamp', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'web_config', v_cmd_json
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_smart_ea_data(jsonb) TO anon, authenticated;
