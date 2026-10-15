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
        let updatedAt = new Date().toISOString();

        if (data?.system_code && data.system_code.includes(':::')) {
            try {
                const parsed = JSON.parse(data.system_code.split(':::').slice(1).join(':::'));
                released = Boolean(parsed.released);
                if (parsed.updated_at) updatedAt = parsed.updated_at;
            } catch (e) {}
        }

        return NextResponse.json({
            success: true,
            released,
            updated_at: updatedAt
        });
    } catch (err: any) {
        console.error('[ReleaseGate GET] Server error:', err);
        return NextResponse.json({ success: false, released: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const released = Boolean(body.released);
        const supabase = getSupabaseClient();
        const nowIso = new Date().toISOString();

        const { error: upsertError } = await supabase
            .from('farm_port_status')
            .upsert({
                port_number: CONFIG_PORT_KEY,
                system_code: `RELEASE_GATE:::${JSON.stringify({ released, updated_at: nowIso })}`,
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
            released,
            message: released 
                ? 'EasyM Prime Farm released to all customers globally' 
                : 'EasyM Prime Farm reverted to private developer mode'
        });
    } catch (err: any) {
        console.error('[ReleaseGate POST] Server error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
