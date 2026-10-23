import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { recordViewerPing } from '@/lib/farm-control/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    return handlePing(req);
}

export async function POST(req: Request) {
    return handlePing(req);
}

async function handlePing(req: Request) {
    try {
        let port = '';
        if (req.method === 'GET') {
            const { searchParams } = new URL(req.url);
            port = searchParams.get('port') || searchParams.get('port_number') || '';
        } else {
            try {
                const body = await req.json();
                port = body.port || body.port_number || '';
            } catch (e) {
                const { searchParams } = new URL(req.url);
                port = searchParams.get('port') || searchParams.get('port_number') || '';
            }
        }

        const cleanPort = String(port).trim();
        if (!cleanPort) {
            return NextResponse.json({ success: false, message: 'Missing port' }, { status: 400 });
        }

        // 1. Record in ultra-fast memory store
        recordViewerPing(cleanPort);

        // 2. Update Supabase asynchronously for redundancy
        const nowIso = new Date().toISOString();
        supabase
            .from('farm_port_status')
            .update({ last_viewed_at: nowIso })
            .eq('port_number', cleanPort)
            .then(
                () => {},
                err => console.warn('Supabase last_viewed_at update notice:', err)
            );

        return NextResponse.json({
            success: true,
            active: true,
            port_number: cleanPort,
            timestamp: nowIso
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
