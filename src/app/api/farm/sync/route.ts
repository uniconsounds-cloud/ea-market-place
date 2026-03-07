import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Initialize Supabase admin client to bypass RLS for inserting raw EA data
    // Placed inside handler to prevent static build crash if ENV is missing during build eval
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    try {
        // Enforce basic API key security
        const apiKey = req.headers.get('x-api-key');
        if (apiKey !== process.env.LICENSE_API_KEY) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { port_number, orders, summary } = payload;

        if (!port_number || !Array.isArray(orders)) {
            return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
        }

        // Process orders for upsertion
        const upsertData = orders.map((o: any) => ({
            ticket_id: o.ticket_id,
            port_number: port_number,
            type: o.type || 'BUY', // Fallback if missing on closed
            status: o.status,
            current_pnl: typeof o.current_pnl === 'number' ? o.current_pnl : 0,
            sl_risk_percent: typeof o.sl_risk_percent === 'number' ? o.sl_risk_percent : 0,
            raw_lot_size: typeof o.raw_lot_size === 'number' ? o.raw_lot_size : 0,
            updated_at: new Date().toISOString()
        }));

        if (upsertData.length > 0) {
            // Upsert into farm_active_orders
            const { error: upsertError } = await supabaseAdmin
                .from('farm_active_orders')
                .upsert(upsertData, { onConflict: 'ticket_id' });

            if (upsertError) {
                console.error('Farm Sync Error:', upsertError);
                return NextResponse.json({ error: 'Failed to sync orders' }, { status: 500 });
            }

            // --- Note: Historical aggregation for CLOSED_TP and CLOSED_SL ---
            // In a highly optimized system, we would calculate deltas here.
            // For now, we rely on the continuous upsert so the front-end always has the latest state.
        }

        return NextResponse.json({ success: true, message: 'Farm synced successfully' });

    } catch (error: any) {
        console.error('Farm Endpoint Panic:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
