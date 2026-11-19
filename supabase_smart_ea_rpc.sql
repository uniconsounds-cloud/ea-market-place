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
    v_port               text;
    v_state_key          text;
    v_cmd_key            text;
    v_last_viewed        timestamptz;
    v_has_viewer         boolean := false;
    v_interval           integer := 180;
    v_cmd_raw            text;
    v_cmd_json           jsonb := NULL;
    v_now                timestamptz := now();
    v_now_iso            text;
    v_state_json         jsonb;
    v_prev_state_raw     text;
    v_prev_hist          jsonb := NULL;
    v_effective_payload  jsonb;
    v_latest_closed_ts   bigint := 0;
    v_override_closed_ts bigint := 0;
    v_ack_seq            bigint := 0;
    v_cmd_seq            bigint := 0;
    v_open_pos           integer := 0;
    v_ea_exo             boolean := true;
    v_restored_tp        double precision := 20.0;
    v_restored_fsl       double precision := 0.0;
BEGIN
    v_port := trim(coalesce(payload->>'port_number', ''));
    IF v_port = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing port_number');
    END IF;

    v_state_key := 'sv_state_' || v_port;
    v_cmd_key   := 'sv_cmd_' || v_port;
    v_now_iso   := to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

    -- Check if /smart-ea cockpit has an active viewer within last 60 seconds & preserve round_history when omitted
    SELECT last_viewed_at, system_code
      INTO v_last_viewed, v_prev_state_raw
      FROM public.farm_port_status
     WHERE port_number = v_state_key
     LIMIT 1;

    IF v_last_viewed IS NOT NULL AND v_last_viewed > (v_now - interval '60 seconds') THEN
        v_has_viewer := true;
        v_interval   := 15;
    END IF;

    v_effective_payload := payload;
    IF (payload->'round_history' IS NULL OR jsonb_typeof(payload->'round_history') = 'null')
       AND v_prev_state_raw IS NOT NULL AND v_prev_state_raw <> '' THEN
        BEGIN
            v_prev_hist := (v_prev_state_raw::jsonb)->'round_history';
            IF v_prev_hist IS NOT NULL AND jsonb_typeof(v_prev_hist) = 'array' THEN
                v_effective_payload := v_effective_payload || jsonb_build_object('round_history', v_prev_hist);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- Stamp server last_ping & conn_status onto payload
    v_state_json := v_effective_payload || jsonb_build_object(
        'conn_status', 'CONNECTED',
        'last_ping', v_now_iso
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
        coalesce(payload->>'ea_version', '1.14'),
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

    -- Offline-safe Auto-Reset of Exit Planner TP/SL override once the round closes
    IF v_cmd_json IS NOT NULL AND coalesce((v_cmd_json->>'exit_override_active')::boolean, false) IS TRUE THEN
        v_ack_seq := coalesce((payload->>'last_ack_seq')::bigint, 0);
        v_cmd_seq := coalesce((v_cmd_json->>'command_seq')::bigint, 0);
        v_open_pos := coalesce((payload->>'open_pos')::integer, 0);
        v_override_closed_ts := coalesce((v_cmd_json->>'override_last_closed_time')::bigint, 0);
        v_ea_exo := coalesce((payload->'active_config'->>'exit_override_active')::boolean, true);

        IF jsonb_typeof(v_effective_payload->'round_history') = 'array' THEN
            SELECT coalesce(max((elem->>0)::bigint), 0)
              INTO v_latest_closed_ts
              FROM jsonb_array_elements(v_effective_payload->'round_history') AS elem;
        END IF;

        IF (v_ack_seq >= v_cmd_seq AND v_ea_exo IS FALSE)
           OR (v_override_closed_ts > 0 AND v_latest_closed_ts > v_override_closed_ts)
           OR (v_ack_seq >= v_cmd_seq AND v_open_pos = 0) THEN

            v_restored_tp := coalesce((v_cmd_json->>'base_target_profit')::double precision, 20.0);
            IF v_restored_tp <= 0 THEN
                v_restored_tp := 20.0;
            END IF;
            v_restored_fsl := coalesce((v_cmd_json->>'base_freeze_stop_loss')::double precision, 0.0);

            v_cmd_json := v_cmd_json || jsonb_build_object(
                'command_seq', v_cmd_seq + 1,
                'target_profit', v_restored_tp,
                'freeze_stop_loss', v_restored_fsl,
                'base_target_profit', v_restored_tp,
                'base_freeze_stop_loss', v_restored_fsl,
                'exit_override_active', false,
                'updated_at', v_now_iso
            );

            UPDATE public.farm_port_status
               SET system_code = v_cmd_json::text,
                   updated_at  = v_now
             WHERE port_number = v_cmd_key;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'sync_interval', v_interval,
        'viewer_active', v_has_viewer,
        'timestamp', v_now_iso,
        'web_config', v_cmd_json
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_smart_ea_data(jsonb) TO anon, authenticated;
