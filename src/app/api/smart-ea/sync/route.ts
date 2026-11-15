import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mfrspvzxmpksqnzcrysz.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
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

        // 1. Persist latest EA live state in farm_port_status under sv_state_<port>
        const statePayload = {
            port_number: port,
            ea_name: body.ea_name || 'Smart Vortex',
            ea_version: body.ea_version || '1.00',
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
            conn_status: 'CONNECTED',
            config_status: body.config_status || 'MT5_DEFAULT',
            trade_status: body.trade_status || 'RUNNING',
            ea_status: body.ea_status || 'Running',
            last_ack_seq: Number(body.last_ack_seq || 0),
            active_config: body.active_config || {},
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

        // 2. Fetch latest Web Command config from sv_cmd_<port>
        const { data: cmdRow } = await supabase
            .from('farm_port_status')
            .select('system_code')
            .eq('port_number', `sv_cmd_${port}`)
            .maybeSingle();

        let webConfig: any = null;
        if (cmdRow?.system_code) {
            try {
                webConfig = JSON.parse(cmdRow.system_code);
            } catch {
                webConfig = null;
            }
        }

        // If EA already acknowledged close_all, clear close_all flag on next command read if needed
        return NextResponse.json({
            success: true,
            sync_interval: 3, // Fast 3-second polling for responsive 2-way Smart EA control
            timestamp: nowIso,
            web_config: webConfig,
        });
    } catch (err: any) {
        console.error('[SmartEA Sync] Error:', err);
        return NextResponse.json({ success: false, error: err?.message || 'Internal Error' }, { status: 500 });
    }
}
