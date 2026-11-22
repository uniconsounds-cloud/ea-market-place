import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mfrspvzxmpksqnzcrysz.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
}

function getLatestClosedRoundTimeFromArr(roundHistory: any): number {
    if (!Array.isArray(roundHistory) || roundHistory.length === 0) return 0;
    let maxT = 0;
    for (const r of roundHistory) {
        const t = Array.isArray(r) ? Number(r[0]) || 0 : 0;
        if (t > maxT) maxT = t;
    }
    return maxT;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const port = String(body.port_number || '').trim();
        if (!port) {
            return NextResponse.json({ success: false, error: 'Missing port_number' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const nowIso = new Date().toISOString();

        // Check if a viewer is currently active on /smart-ea (last_viewed_at within 60s)
        const [{ data: existingStateRow }, { data: cmdRow }] = await Promise.all([
            supabase
                .from('farm_port_status')
                .select('last_viewed_at, system_code')
                .eq('port_number', `sv_state_${port}`)
                .maybeSingle(),
            supabase
                .from('farm_port_status')
                .select('system_code')
                .eq('port_number', `sv_cmd_${port}`)
                .maybeSingle(),
        ]);

        let existingRoundHistory: unknown = null;
        if (body.round_history == null && existingStateRow?.system_code) {
            try {
                const prev = JSON.parse(existingStateRow.system_code);
                if (Array.isArray(prev?.round_history)) {
                    existingRoundHistory = prev.round_history;
                }
            } catch {
                // ignore malformed JSON
            }
        }

        const lastViewedMs = existingStateRow?.last_viewed_at
            ? new Date(existingStateRow.last_viewed_at).getTime()
            : 0;
        const hasActiveViewer = lastViewedMs > 0 && (Date.now() - lastViewedMs) < 60000;

        // Prime-style Adaptive Sync: 15s when viewer is open, 180s (3 min) in Standby
        const adaptiveInterval = hasActiveViewer ? 15 : 180;
        const resolvedRoundHistory = body.round_history ?? existingRoundHistory ?? null;

        const statePayload = {
            port_number: port,
            ea_name: body.ea_name || 'Smart Vortex',
            ea_version: body.ea_version || '1.00',
            ea_build: body.ea_build || '',
            symbol: body.symbol || 'XAUUSD',
            currency: body.currency || 'USD',
            balance: Number(body.balance || 0),
            equity: Number(body.equity || 0),
            cycle_pnl: Number(body.cycle_pnl || 0),
            anchor: Number(body.anchor || 0),
            open_pos: Number(body.open_pos || 0),
            open_buy: Number(body.open_buy || 0),
            open_sell: Number(body.open_sell || 0),
            pending_buy: Number(body.pending_buy || 0),
            pending_sell: Number(body.pending_sell || 0),
            protection_frozen: Boolean(body.protection_frozen),
            frozen_side: body.frozen_side || 'NONE',
            freeze_flip_count: Number(body.freeze_flip_count || 0),
            freeze_base_count: Number(body.freeze_base_count || 0),
            streak_unlocked: Boolean(body.streak_unlocked),
            hedge_active: Boolean(body.hedge_active),
            hedge_side: body.hedge_side || 'NONE',
            sync_interval_sec: Number(body.sync_interval_sec || adaptiveInterval),
            conn_status: 'CONNECTED',
            config_status: body.config_status || 'MT5_DEFAULT',
            trade_status: body.trade_status || 'RUNNING',
            ea_status: body.ea_status || 'Running',
            last_ack_seq: Number(body.last_ack_seq || 0),
            active_config: body.active_config || {},
            chart: body.chart || null,
            round_history: resolvedRoundHistory,
            last_ping: nowIso,
        };

        await supabase
            .from('farm_port_status')
            .upsert({
                port_number: `sv_state_${port}`,
                balance: statePayload.balance,
                equity: statePayload.equity,
                floating_pnl: statePayload.cycle_pnl,
                buy_count: statePayload.open_buy,
                sell_count: statePayload.open_sell,
                system_code: JSON.stringify(statePayload),
                ea_version: statePayload.ea_version,
                is_online: true,
                last_ping: nowIso,
                updated_at: nowIso,
            }, { onConflict: 'port_number' });

        let webConfig: any = null;
        if (cmdRow?.system_code) {
            try {
                webConfig = JSON.parse(cmdRow.system_code);
            } catch {
                webConfig = null;
            }
        }

        // Offline-safe Auto-Reset: if an Exit Planner override was active and the round has closed,
        // automatically revert sv_cmd_<port> back to base_target_profit & base_freeze_stop_loss
        if (webConfig && webConfig.exit_override_active) {
            const latestClosedTime = getLatestClosedRoundTimeFromArr(resolvedRoundHistory);
            const overrideClosedTime = Number(webConfig.override_last_closed_time || 0);
            const ackSeq = Number(statePayload.last_ack_seq || 0);
            const cmdSeq = Number(webConfig.command_seq || 0);
            const openPos = statePayload.open_pos;
            const eaAlreadyReset =
                ackSeq >= cmdSeq && statePayload.active_config?.exit_override_active === false;
            const roundClosedAfterOverride =
                (overrideClosedTime > 0 && latestClosedTime > overrideClosedTime) ||
                (ackSeq >= cmdSeq && openPos === 0);

            if (eaAlreadyReset || roundClosedAfterOverride) {
                const restoredTp =
                    Number(webConfig.base_target_profit) > 0
                        ? Number(webConfig.base_target_profit)
                        : Number(statePayload.active_config?.base_target_profit) > 0
                        ? Number(statePayload.active_config.base_target_profit)
                        : 20.0;
                const restoredFsl =
                    webConfig.base_freeze_stop_loss !== undefined
                        ? Number(webConfig.base_freeze_stop_loss)
                        : Number(statePayload.active_config?.base_freeze_stop_loss || 0.0);
                const restoredHdd =
                    Number(webConfig.base_hedge_dd_percent) >= 1
                        ? Number(webConfig.base_hedge_dd_percent)
                        : Number(statePayload.active_config?.base_hedge_dd_percent || 20.0);

                webConfig = {
                    ...webConfig,
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
                            system_code: JSON.stringify(webConfig),
                            updated_at: nowIso,
                        },
                        { onConflict: 'port_number' }
                    );
            }
        }

        return NextResponse.json({
            success: true,
            sync_interval: adaptiveInterval,
            viewer_active: hasActiveViewer,
            timestamp: nowIso,
            web_config: webConfig,
        });
    } catch (err: any) {
        console.error('[SmartEA Sync] Error:', err);
        return NextResponse.json({ success: false, error: err?.message || 'Internal Error' }, { status: 500 });
    }
}
