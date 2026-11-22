import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mfrspvzxmpksqnzcrysz.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
}

function getLatestClosedRoundTime(state: any): number {
    if (!Array.isArray(state?.round_history) || state.round_history.length === 0) return 0;
    let maxT = 0;
    for (const r of state.round_history) {
        const t = Array.isArray(r) ? Number(r[0]) || 0 : 0;
        if (t > maxT) maxT = t;
    }
    return maxT;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const port = String(searchParams.get('port') || '').trim();
        if (!port) {
            return NextResponse.json({ success: false, error: 'Missing port parameter' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const nowIso = new Date().toISOString();

        const [{ data: stateRow }, { data: cmdRow }, { data: productRow }, { data: mainPortRow }] = await Promise.all([
            supabase.from('farm_port_status').select('system_code, last_ping').eq('port_number', `sv_state_${port}`).maybeSingle(),
            supabase.from('farm_port_status').select('system_code').eq('port_number', `sv_cmd_${port}`).maybeSingle(),
            supabase.from('products').select('version, file_url').eq('product_key', 'SMART-VORTEX-01').maybeSingle(),
            supabase.from('farm_port_status').select('account_type').eq('port_number', port).maybeSingle(),
        ]);

        // Record active viewer heartbeat so EA switches from 180s Standby to 15s Live mode
        if (stateRow) {
            supabase
                .from('farm_port_status')
                .update({ last_viewed_at: nowIso })
                .eq('port_number', `sv_state_${port}`)
                .then(() => {}, () => {});
        }

        let state: any = null;
        let command: any = null;

        if (stateRow?.system_code) {
            try { state = JSON.parse(stateRow.system_code); } catch { state = null; }
        }
        if (state && mainPortRow?.account_type && (mainPortRow.account_type === 'USC' || mainPortRow.account_type === 'USD')) {
            if (!state.currency || mainPortRow.account_type === 'USC') {
                state.currency = mainPortRow.account_type;
            }
        }
        if (cmdRow?.system_code) {
            try { command = JSON.parse(cmdRow.system_code); } catch { command = null; }
        }

        // Auto-reset Exit Planner temporary TP/SL back to Setting defaults if the round has closed
        if (command && command.exit_override_active && state) {
            const latestClosedTime = getLatestClosedRoundTime(state);
            const overrideClosedTime = Number(command.override_last_closed_time || 0);
            const ackSeq = Number(state.last_ack_seq || 0);
            const cmdSeq = Number(command.command_seq || 0);
            const openPos = Number(state.open_pos ?? (Number(state.open_buy || 0) + Number(state.open_sell || 0)));
            const eaAlreadyReset =
                ackSeq >= cmdSeq && state.active_config?.exit_override_active === false;
            const roundClosedAfterOverride =
                (overrideClosedTime > 0 && latestClosedTime > overrideClosedTime) ||
                (ackSeq >= cmdSeq && openPos === 0);

            if (eaAlreadyReset || roundClosedAfterOverride) {
                const restoredTp =
                    Number(command.base_target_profit) > 0
                        ? Number(command.base_target_profit)
                        : Number(state.active_config?.base_target_profit) > 0
                        ? Number(state.active_config.base_target_profit)
                        : 20.0;
                const restoredFsl =
                    command.base_freeze_stop_loss !== undefined
                        ? Number(command.base_freeze_stop_loss)
                        : Number(state.active_config?.base_freeze_stop_loss || 0.0);
                const restoredHdd =
                    Number(command.base_hedge_dd_percent) >= 1
                        ? Number(command.base_hedge_dd_percent)
                        : Number(state.active_config?.base_hedge_dd_percent || 20.0);

                command = {
                    ...command,
                    command_seq: cmdSeq + 1,
                    target_profit: restoredTp,
                    freeze_stop_loss: restoredFsl,
                    hedge_dd_percent: restoredHdd,
                    base_target_profit: restoredTp,
                    base_freeze_stop_loss: restoredFsl,
                    base_hedge_dd_percent: restoredHdd,
                    exit_override_active: false,
                    updated_at: nowIso,
                };

                await supabase
                    .from('farm_port_status')
                    .upsert(
                        {
                            port_number: `sv_cmd_${port}`,
                            system_code: JSON.stringify(command),
                            updated_at: nowIso,
                        },
                        { onConflict: 'port_number' }
                    );
            }
        }

        const expectedIntervalSec = Number(state?.sync_interval_sec || 20);
        const onlineThresholdMs = Math.max(45000, (expectedIntervalSec + 60) * 1000);
        const isOnline = state?.last_ping
            ? (Date.now() - new Date(state.last_ping).getTime()) < onlineThresholdMs
            : false;

        return NextResponse.json({
            success: true,
            port_number: port,
            is_online: isOnline,
            latest_version: productRow?.version || '1.14',
            download_url: productRow?.file_url || null,
            state,
            command,
        });
    } catch (err: any) {
        console.error('[SmartEA Control GET] Error:', err);
        return NextResponse.json({ success: false, error: err?.message || 'Internal Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const port = String(body.port_number || '').trim();
        if (!port) {
            return NextResponse.json({ success: false, error: 'Missing port_number' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Fetch existing command & state to preserve base settings & snapshot current round
        const [{ data: existingRow }, { data: stateRow }] = await Promise.all([
            supabase
                .from('farm_port_status')
                .select('system_code')
                .eq('port_number', `sv_cmd_${port}`)
                .maybeSingle(),
            supabase
                .from('farm_port_status')
                .select('system_code')
                .eq('port_number', `sv_state_${port}`)
                .maybeSingle(),
        ]);

        let currentState: any = null;
        if (stateRow?.system_code) {
            try { currentState = JSON.parse(stateRow.system_code); } catch { currentState = null; }
        }

        let prevCmd: any = {
            command_seq: 0,
            first_distance: 100,
            spacing: 100,
            pending_per_side: 10,
            initial_lot: 0.01,
            lot_increment: 0.01,
            step_lot_repeat: 2,
            target_profit: 20.0,
            freeze_stop_loss: 0.0,
            base_target_profit: 20.0,
            base_freeze_stop_loss: 0.0,
            exit_override_active: false,
            override_last_closed_time: 0,
            enable_single_side_freeze: true,
            single_side_freeze_trigger: 16,
            max_orders_per_side: 24,
            enable_cap_freeze: false,
            max_both_sides_cap: 7,
            freeze_flip_max_extra: 3,
            freeze_flip_continuous: true,
            enable_streak_unlock: true,
            streak_unlock_trades: 7,
            streak_unlock_candles: 7,
            enable_auto_hedge: false,
            hedge_dd_percent: 20.0,
            base_hedge_dd_percent: 20.0,
            enable_hedge_trailing: true,
            hedge_trail_start_pts: 300,
            hedge_trail_step_pts: 150,
            enable_hedge_partial: true,
            hedge_partial_pct: 50,
            hedge_rebound_pts: 250,
            enable_hedge_offset: true,
            stop_mode: 'RUN',
            close_all: false,
        };

        if (existingRow?.system_code) {
            try {
                prevCmd = { ...prevCmd, ...JSON.parse(existingRow.system_code) };
            } catch {
                // Keep defaults
            }
        }

        const prevBaseTp =
            Number(prevCmd.base_target_profit) > 0
                ? Number(prevCmd.base_target_profit)
                : Number(prevCmd.target_profit) > 0
                ? Number(prevCmd.target_profit)
                : Number(currentState?.active_config?.base_target_profit) > 0
                ? Number(currentState.active_config.base_target_profit)
                : Number(currentState?.active_config?.target_profit) > 0
                ? Number(currentState.active_config.target_profit)
                : 20.0;

        const prevBaseFsl =
            prevCmd.base_freeze_stop_loss !== undefined
                ? Number(prevCmd.base_freeze_stop_loss)
                : Number(currentState?.active_config?.base_freeze_stop_loss ?? 0.0);

        const prevBaseHdd =
            Number(prevCmd.base_hedge_dd_percent) >= 1
                ? Number(prevCmd.base_hedge_dd_percent)
                : Number(currentState?.active_config?.base_hedge_dd_percent ?? prevCmd.hedge_dd_percent ?? 20.0);

        const isExitOverride = Boolean(body.is_exit_override === true);
        const isSettingSave =
            !isExitOverride && (body.target_profit !== undefined || body.base_target_profit !== undefined);

        const nextTp =
            body.target_profit !== undefined ? Number(body.target_profit) : Number(prevCmd.target_profit);
        const nextFsl =
            body.freeze_stop_loss !== undefined
                ? Number(body.freeze_stop_loss)
                : Number(prevCmd.freeze_stop_loss ?? 0.0);
        const nextHdd =
            body.hedge_dd_percent !== undefined
                ? Number(body.hedge_dd_percent)
                : Number(prevCmd.hedge_dd_percent ?? 20.0);

        const nextBaseTp = isSettingSave
            ? (body.base_target_profit !== undefined ? Number(body.base_target_profit) : nextTp)
            : prevBaseTp;
        const nextBaseFsl = isSettingSave
            ? (body.base_freeze_stop_loss !== undefined ? Number(body.base_freeze_stop_loss) : nextFsl)
            : prevBaseFsl;
        const nextBaseHdd = isSettingSave
            ? (body.base_hedge_dd_percent !== undefined ? Number(body.base_hedge_dd_percent) : nextHdd)
            : prevBaseHdd;
        const nextExitOverrideActive = isExitOverride
            ? true
            : isSettingSave
            ? false
            : Boolean(prevCmd.exit_override_active);
        const nextOverrideClosedTime = isExitOverride
            ? getLatestClosedRoundTime(currentState)
            : Number(prevCmd.override_last_closed_time || 0);

        const nextSeq = Number(prevCmd.command_seq || 0) + 1;
        const updatedCmd = {
            command_seq: nextSeq,
            first_distance: body.first_distance !== undefined ? Number(body.first_distance) : prevCmd.first_distance,
            spacing: body.spacing !== undefined ? Number(body.spacing) : prevCmd.spacing,
            pending_per_side: body.pending_per_side !== undefined ? Number(body.pending_per_side) : prevCmd.pending_per_side,
            initial_lot: body.initial_lot !== undefined ? Number(body.initial_lot) : prevCmd.initial_lot,
            lot_increment: body.lot_increment !== undefined ? Number(body.lot_increment) : prevCmd.lot_increment,
            step_lot_repeat: body.step_lot_repeat !== undefined ? Number(body.step_lot_repeat) : (prevCmd.step_lot_repeat ?? 2),
            target_profit: nextTp,
            freeze_stop_loss: nextFsl,
            base_target_profit: nextBaseTp,
            base_freeze_stop_loss: nextBaseFsl,
            exit_override_active: nextExitOverrideActive,
            override_last_closed_time: nextOverrideClosedTime,
            enable_single_side_freeze: body.enable_single_side_freeze !== undefined ? Boolean(body.enable_single_side_freeze) : (prevCmd.enable_single_side_freeze ?? true),
            single_side_freeze_trigger: body.single_side_freeze_trigger !== undefined ? Number(body.single_side_freeze_trigger) : (prevCmd.single_side_freeze_trigger ?? 16),
            max_orders_per_side: body.max_orders_per_side !== undefined ? Number(body.max_orders_per_side) : (prevCmd.max_orders_per_side ?? 24),
            enable_cap_freeze: body.enable_cap_freeze !== undefined ? Boolean(body.enable_cap_freeze) : (prevCmd.enable_cap_freeze ?? false),
            max_both_sides_cap: body.max_both_sides_cap !== undefined ? Number(body.max_both_sides_cap) : (prevCmd.max_both_sides_cap ?? 7),
            freeze_flip_max_extra: body.freeze_flip_max_extra !== undefined ? Number(body.freeze_flip_max_extra) : (prevCmd.freeze_flip_max_extra ?? 3),
            freeze_flip_continuous: body.freeze_flip_continuous !== undefined ? Boolean(body.freeze_flip_continuous) : (prevCmd.freeze_flip_continuous ?? true),
            enable_streak_unlock: body.enable_streak_unlock !== undefined ? Boolean(body.enable_streak_unlock) : (prevCmd.enable_streak_unlock ?? true),
            streak_unlock_trades: body.streak_unlock_trades !== undefined ? Number(body.streak_unlock_trades) : (prevCmd.streak_unlock_trades ?? 7),
            streak_unlock_candles: body.streak_unlock_candles !== undefined ? Number(body.streak_unlock_candles) : (prevCmd.streak_unlock_candles ?? 7),
            enable_auto_hedge: body.enable_auto_hedge !== undefined ? Boolean(body.enable_auto_hedge) : (prevCmd.enable_auto_hedge ?? false),
            hedge_dd_percent: nextHdd,
            base_hedge_dd_percent: nextBaseHdd,
            enable_hedge_trailing: body.enable_hedge_trailing !== undefined ? Boolean(body.enable_hedge_trailing) : (prevCmd.enable_hedge_trailing ?? true),
            hedge_trail_start_pts: body.hedge_trail_start_pts !== undefined ? Number(body.hedge_trail_start_pts) : (prevCmd.hedge_trail_start_pts ?? 300),
            hedge_trail_step_pts: body.hedge_trail_step_pts !== undefined ? Number(body.hedge_trail_step_pts) : (prevCmd.hedge_trail_step_pts ?? 150),
            enable_hedge_partial: body.enable_hedge_partial !== undefined ? Boolean(body.enable_hedge_partial) : (prevCmd.enable_hedge_partial ?? true),
            hedge_partial_pct: body.hedge_partial_pct !== undefined ? Number(body.hedge_partial_pct) : (prevCmd.hedge_partial_pct ?? 50),
            hedge_rebound_pts: body.hedge_rebound_pts !== undefined ? Number(body.hedge_rebound_pts) : (prevCmd.hedge_rebound_pts ?? 250),
            enable_hedge_offset: body.enable_hedge_offset !== undefined ? Boolean(body.enable_hedge_offset) : (prevCmd.enable_hedge_offset ?? true),
            stop_mode: body.stop_mode !== undefined ? String(body.stop_mode) : prevCmd.stop_mode,
            close_all: Boolean(body.close_all === true),
            updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
            .from('farm_port_status')
            .upsert({
                port_number: `sv_cmd_${port}`,
                system_code: JSON.stringify(updatedCmd),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'port_number' });

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: 'Command queued for Smart Vortex EA',
            command: updatedCmd,
        });
    } catch (err: any) {
        console.error('[SmartEA Control POST] Error:', err);
        return NextResponse.json({ success: false, error: err?.message || 'Internal Error' }, { status: 500 });
    }
}
