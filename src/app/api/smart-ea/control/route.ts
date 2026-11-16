import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mfrspvzxmpksqnzcrysz.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
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

        const [{ data: stateRow }, { data: cmdRow }, { data: productRow }] = await Promise.all([
            supabase.from('farm_port_status').select('system_code, last_ping').eq('port_number', `sv_state_${port}`).maybeSingle(),
            supabase.from('farm_port_status').select('system_code').eq('port_number', `sv_cmd_${port}`).maybeSingle(),
            supabase.from('products').select('version, file_url').eq('product_key', 'SMART-VORTEX-01').maybeSingle(),
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
        if (cmdRow?.system_code) {
            try { command = JSON.parse(cmdRow.system_code); } catch { command = null; }
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
            latest_version: productRow?.version || '1.10',
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

        // Fetch existing command to preserve fields & increment command_seq
        const { data: existingRow } = await supabase
            .from('farm_port_status')
            .select('system_code')
            .eq('port_number', `sv_cmd_${port}`)
            .maybeSingle();

        let prevCmd: any = {
            command_seq: 0,
            first_distance: 100,
            spacing: 100,
            pending_per_side: 10,
            initial_lot: 0.01,
            lot_increment: 0.01,
            target_profit: 20.0,
            enable_cap_freeze: true,
            max_both_sides_cap: 7,
            freeze_flip_max_extra: 3,
            freeze_flip_continuous: true,
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

        const nextSeq = Number(prevCmd.command_seq || 0) + 1;
        const updatedCmd = {
            command_seq: nextSeq,
            first_distance: body.first_distance !== undefined ? Number(body.first_distance) : prevCmd.first_distance,
            spacing: body.spacing !== undefined ? Number(body.spacing) : prevCmd.spacing,
            pending_per_side: body.pending_per_side !== undefined ? Number(body.pending_per_side) : prevCmd.pending_per_side,
            initial_lot: body.initial_lot !== undefined ? Number(body.initial_lot) : prevCmd.initial_lot,
            lot_increment: body.lot_increment !== undefined ? Number(body.lot_increment) : prevCmd.lot_increment,
            target_profit: body.target_profit !== undefined ? Number(body.target_profit) : prevCmd.target_profit,
            enable_cap_freeze: body.enable_cap_freeze !== undefined ? Boolean(body.enable_cap_freeze) : (prevCmd.enable_cap_freeze ?? true),
            max_both_sides_cap: body.max_both_sides_cap !== undefined ? Number(body.max_both_sides_cap) : (prevCmd.max_both_sides_cap ?? 7),
            freeze_flip_max_extra: body.freeze_flip_max_extra !== undefined ? Number(body.freeze_flip_max_extra) : (prevCmd.freeze_flip_max_extra ?? 3),
            freeze_flip_continuous: body.freeze_flip_continuous !== undefined ? Boolean(body.freeze_flip_continuous) : (prevCmd.freeze_flip_continuous ?? true),
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
