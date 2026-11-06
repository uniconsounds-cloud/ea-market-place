import { NextResponse } from 'next/server';
import { getLiveOrders } from '@/lib/farm-control/store';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

function normalizePort(port: string): string {
    const p = String(port).trim();
    if (p === '3088') return '97053088';
    if (p === '2434') return '21692434';
    return p;
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const rawPort = searchParams.get('port') || searchParams.get('port_number') || '';
        const cleanPort = normalizePort(rawPort);

        if (!cleanPort) {
            return NextResponse.json({ success: false, message: 'Missing port parameter' }, { status: 400 });
        }

        // 1. Check in-memory store
        const data = getLiveOrders(cleanPort);
        let orders = Array.isArray(data?.orders) ? data.orders : [];
        let updatedAt = data?.updated_at || 0;

        // 2. If in-memory is empty (due to serverless stateless instances or direct Supabase sync),
        // fallback to querying farm_port_status in Supabase where EA stores live_orders
        if (orders.length === 0) {
            const { data: status } = await supabase
                .from('farm_port_status')
                .select('system_code, updated_at')
                .eq('port_number', cleanPort)
                .maybeSingle();

            if (status?.system_code && status.system_code.includes(':::')) {
                try {
                    const parsed = JSON.parse(status.system_code.split(':::')[1]);
                    if (Array.isArray(parsed.live_orders) && parsed.live_orders.length > 0) {
                        orders = parsed.live_orders;
                        updatedAt = status.updated_at ? Math.floor(new Date(status.updated_at).getTime() / 1000) : Math.floor(Date.now() / 1000);
                    }
                } catch (e) {
                    // Ignore JSON parse errors
                }
            }

            // 3. Fallback to farm_active_orders table if system_code had no orders
            if (orders.length === 0) {
                const { data: dbOrders } = await supabase
                    .from('farm_active_orders')
                    .select('*')
                    .eq('port_number', cleanPort);

                if (dbOrders && dbOrders.length > 0) {
                    orders = dbOrders.map(o => ({
                        ticket: Number(o.ticket_id || o.ticket || 0),
                        symbol: o.symbol || '',
                        type: o.type || 'BUY',
                        lots: Number(o.raw_lot_size || o.lots || 0),
                        open_price: Number(o.open_price || 0),
                        current_price: Number(o.current_price || 0),
                        sl: Number(o.sl || 0),
                        tp: Number(o.tp || 0),
                        profit: Number(o.current_pnl || o.profit || 0),
                        comment: o.comment || '',
                        magic: Number(o.magic || 0),
                        is_external: Boolean(o.is_external)
                    }));
                    updatedAt = Math.floor(Date.now() / 1000);
                }
            }
        }

        return NextResponse.json({
            success: true,
            port_number: cleanPort,
            updated_at: updatedAt,
            count: orders.length,
            orders
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
