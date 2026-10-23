import { NextResponse } from 'next/server';
import { getLiveOrders } from '@/lib/farm-control/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const port = searchParams.get('port') || searchParams.get('port_number') || '';
        const cleanPort = String(port).trim();

        if (!cleanPort) {
            return NextResponse.json({ success: false, message: 'Missing port parameter' }, { status: 400 });
        }

        const data = getLiveOrders(cleanPort);
        return NextResponse.json({
            success: true,
            port_number: cleanPort,
            updated_at: data.updated_at,
            count: data.orders.length,
            orders: data.orders
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
