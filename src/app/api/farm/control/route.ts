import { NextResponse } from 'next/server';
import { getPortControlAsync, updatePortControlAsync } from '@/lib/farm-control/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const rawPort = searchParams.get('port') || searchParams.get('port_number');
        let port = String(rawPort || '').trim();
        if (port === '3088') port = '97053088';
        if (port === '2434') port = '21692434';
        if (!port) {
            return NextResponse.json({ success: false, message: 'Missing port parameter' }, { status: 400 });
        }

        const control = await getPortControlAsync(port);
        return NextResponse.json({
            success: true,
            port_number: port,
            control
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        let port = String(body.port_number || body.port || '').trim();
        if (port === '3088') port = '97053088';
        if (port === '2434') port = '21692434';

        if (!port) {
            return NextResponse.json({ success: false, message: 'Missing port_number' }, { status: 400 });
        }

        const partialUpdate: any = {};

        if (body.control_mode) partialUpdate.control_mode = body.control_mode;
        if (body.port_mode) partialUpdate.port_mode = body.port_mode;
        if (typeof body.pause_new_orders === 'boolean') partialUpdate.pause_new_orders = body.pause_new_orders;
        if (typeof body.max_dd_limit === 'number') partialUpdate.max_dd_limit = body.max_dd_limit;
        if (body.symbols && typeof body.symbols === 'object') partialUpdate.symbols = body.symbols;

        const updated = await updatePortControlAsync(port, partialUpdate);

        return NextResponse.json({
            success: true,
            message: 'Port control settings updated successfully',
            port_number: port,
            control: updated
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, message: err.message }, { status: 500 });
    }
}
