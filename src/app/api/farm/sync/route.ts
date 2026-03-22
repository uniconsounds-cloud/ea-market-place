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
        const { port_number, orders, summary, port_status } = payload;

        if (!port_number || !Array.isArray(orders)) {
            return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
        }

        // --- Process Port Status if provided ---
        if (port_status) {
            const { error: portStatusError } = await supabaseAdmin
                .from('farm_port_status')
                .upsert({
                    port_number: port_number,
                    balance: port_status.balance || 0,
                    equity: port_status.equity || 0,
                    margin_level: port_status.margin_level || 0,
                    account_type: port_status.account_type || 'USD',
                    max_drawdown: port_status.max_drawdown || 0,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'port_number' });

            if (portStatusError) {
                console.error('Farm Sync Error (Port Status):', portStatusError);
                // We don't fail the whole sync if just status fails, but log it
            }
        }

        // Process orders for upsertion
        const upsertData = orders.map((o: any) => ({
            ticket_id: o.ticket_id,
            port_number: port_number,
            type: o.type || 'BUY', // Fallback if missing on closed
            status: o.status,
            current_pnl: typeof o.current_pnl === 'number' ? o.current_pnl : 0,
            sl_risk_percent: typeof o.sl_risk_percent === 'number' ? o.sl_risk_percent : 0,
            raw_lot_size: typeof o.raw_lot_size === 'number' ? o.raw_lot_size : o.lot || 0,
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

            // --- Historical aggregation for CLOSED_TP and CLOSED_SL ---
            const closedOrders = upsertData.filter(o => o.status === 'CLOSED_TP' || o.status === 'CLOSED_SL');

            if (closedOrders.length > 0) {
                // To safely aggregate without race conditions, we can use an RPC call or simple fetch-update.
                // Since this runs continuously, we will fetch the current month record, add the deltas, and upsert.
                const now = new Date();
                const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                let deltaProfit = 0;
                let deltaFruits = 0;
                let deltaDead = 0;

                closedOrders.forEach(o => {
                    deltaProfit += o.current_pnl;
                    if (o.status === 'CLOSED_TP') {
                        deltaFruits += Math.floor(o.current_pnl * 10); // 1 fruit = 10 cents
                    } else if (o.status === 'CLOSED_SL') {
                        deltaDead += Math.floor(Math.abs(o.current_pnl) * 10); // 1 dead = 10 cents
                    }
                });

                // Fetch existing month record for this port
                const { data: existingMonth, error: fetchErr } = await supabaseAdmin
                    .from('farm_monthly_history')
                    .select('*')
                    .eq('port_number', port_number)
                    .eq('month_year', monthYear)
                    .single();

                const newTotalProfit = (existingMonth?.total_profit || 0) + deltaProfit;
                const newFruitsCount = (existingMonth?.golden_fruits_count || 0) + deltaFruits;
                const newDeadCount = (existingMonth?.dead_flowers_count || 0) + deltaDead;

                // Upsert the new aggregated totals
                const { error: historyUpsertError } = await supabaseAdmin
                    .from('farm_monthly_history')
                    .upsert({
                        id: existingMonth?.id, // If undefined, Supabase generates new UUID
                        port_number: port_number,
                        month_year: monthYear,
                        total_profit: newTotalProfit,
                        golden_fruits_count: newFruitsCount,
                        dead_flowers_count: newDeadCount,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'port_number,month_year' });

                if (historyUpsertError) {
                    console.error('History Aggregation Error:', historyUpsertError);
                }

                // Clean up Active Orders Table: Delete the closed orders so they don't clutter the realtime 'OPEN' state.
                const closedTicketIds = closedOrders.map(o => o.ticket_id);
                await supabaseAdmin
                    .from('farm_active_orders')
                    .delete()
                    .in('ticket_id', closedTicketIds);
            }

        }

        return NextResponse.json({ success: true, message: 'Farm synced successfully' });

    } catch (error: any) {
        console.error('Farm Endpoint Panic:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
