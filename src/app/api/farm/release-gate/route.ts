import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
}

const CONFIG_PORT_KEY = 'prime_release_gate_config';

export async function GET() {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('farm_port_status')
            .select('system_code, updated_at')
            .eq('port_number', CONFIG_PORT_KEY)
            .maybeSingle();

        if (error) {
            console.warn('[ReleaseGate GET] Error fetching config:', error);
            return NextResponse.json({ success: true, released: false, error: error.message });
        }

        let released = false;
        let phase2_released = false;
        let updatedAt = new Date().toISOString();

        if (data?.system_code && data.system_code.includes(':::')) {
            try {
                const parsed = JSON.parse(data.system_code.split(':::').slice(1).join(':::'));
                released = Boolean(parsed.released);
                phase2_released = Boolean(parsed.phase2_released);
                if (parsed.updated_at) updatedAt = parsed.updated_at;
            } catch (e) {}
        }

        return NextResponse.json({
            success: true,
            released,
            phase2_released,
            updated_at: updatedAt
        });
    } catch (err: any) {
        console.error('[ReleaseGate GET] Server error:', err);
        return NextResponse.json({ success: false, released: false, phase2_released: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const supabase = getSupabaseClient();
        const nowIso = new Date().toISOString();

        // 1. Fetch current config to merge fields
        let currentReleased = true;
        let currentPhase2Released = false;

        const { data: existingData } = await supabase
            .from('farm_port_status')
            .select('system_code')
            .eq('port_number', CONFIG_PORT_KEY)
            .maybeSingle();

        if (existingData?.system_code && existingData.system_code.includes(':::')) {
            try {
                const parsed = JSON.parse(existingData.system_code.split(':::').slice(1).join(':::'));
                if (typeof parsed.released === 'boolean') currentReleased = parsed.released;
                if (typeof parsed.phase2_released === 'boolean') currentPhase2Released = parsed.phase2_released;
            } catch (e) {}
        }

        const nextReleased = typeof body.released === 'boolean' ? body.released : currentReleased;
        const nextPhase2Released = typeof body.phase2_released === 'boolean' ? body.phase2_released : currentPhase2Released;

        const { error: upsertError } = await supabase
            .from('farm_port_status')
            .upsert({
                port_number: CONFIG_PORT_KEY,
                system_code: `RELEASE_GATE:::${JSON.stringify({ 
                    released: nextReleased, 
                    phase2_released: nextPhase2Released, 
                    updated_at: nowIso 
                })}`,
                updated_at: nowIso,
                is_online: true,
                last_ping: nowIso
            }, { onConflict: 'port_number' });

        if (upsertError) {
            console.error('[ReleaseGate POST] Upsert error:', upsertError);
            return NextResponse.json({ success: false, error: upsertError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            released: nextReleased,
            phase2_released: nextPhase2Released,
            message: 'Release gate configuration updated successfully'
        });
    } catch (err: any) {
        console.error('[ReleaseGate POST] Server error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
