import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const apiKey = req.headers.get('x-api-key');
        const validApiKey = process.env.LICENSE_API_KEY || 'KHUCHAI_SUPHAKORN'; // Fallback for dev

        if (apiKey !== validApiKey) {
            return NextResponse.json({ status: 'error', message: 'Invalid API Key' }, { status: 401 });
        }

        const data = await req.json();
        const { type, port_number } = data;

        if (!port_number) {
            return NextResponse.json({ status: 'error', message: 'Missing port_number' }, { status: 400 });
        }

        if (type === 'STATS_SYNC') {
            // Upsert into farm_port_status
            const { error } = await supabase
                .from('farm_port_status')
                .upsert({
                    port_number,
                    balance: data.balance,
                    equity: data.equity,
                    floating_pnl: data.floating_pnl,
                    max_drawdown: data.max_drawdown,
                    total_lots: data.total_lots,
                    buy_count: data.buy_count,
                    sell_count: data.sell_count,
                    buy_pnl: data.buy_pnl,
                    sell_pnl: data.sell_pnl,
                    account_type: data.account_type,
                    asset_type: data.asset_type,
                    is_online: data.is_online,
                    last_ping: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'port_number' });

            if (error) throw error;
        } 
        else if (type === 'BATCH_CLOSE') {
            // Insert into farm_batch_events
            const { error } = await supabase
                .from('farm_batch_events')
                .insert({
                    port_number,
                    total_orders: data.total_orders,
                    total_lots: data.total_lots,
                    total_profit: data.total_profit,
                    event_timestamp: new Date().toISOString()
                });

            if (error) throw error;
        }
        else if (type === 'HISTORY_INIT') {
            // Handle 30-day history init (This could be more complex, but for now we just log it)
            console.log(`History init requested for port ${port_number}`);
        }

        return NextResponse.json({ status: 'success' });

    } catch (err: any) {
        console.error('Sync API Error:', err);
        return NextResponse.json({
            status: 'error',
            message: 'Server Error: ' + (err.message || JSON.stringify(err))
        }, { status: 500 });
    }
}
