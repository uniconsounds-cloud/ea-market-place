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

        // Compute active order aggregates
        let totalLots = 0;
        let floatingPnl = 0;
        let buyCount = 0;
        let sellCount = 0;
        orders.forEach((o: any) => {
            totalLots += Number(o.raw_lot_size || o.lot || 0);
            floatingPnl += Number(o.current_pnl || 0);
            const oType = String(o.type || '').toUpperCase();
            if (oType === 'BUY') buyCount++;
            else if (oType === 'SELL') sellCount++;
        });

        // --- Process Port Status ---
        const { data: existingStatus } = await supabaseAdmin
            .from('farm_port_status')
            .select('balance, equity, daily_max_drawdown, account_type, system_code, ea_version, today_pnl')
            .eq('port_number', String(port_number))
            .maybeSingle();

        const rawBal = Number(port_status?.balance) || Number(existingStatus?.balance) || 0;
        const resolvedFloating = Number(floatingPnl.toFixed(2));
        const resolvedEquity = (port_status?.equity && Number(port_status.equity) > 0)
            ? Number(port_status.equity)
            : (rawBal > 0 ? Number((rawBal + resolvedFloating).toFixed(2)) : (Number(existingStatus?.equity) || 0));

        let calculatedDD = 0;
        if (rawBal > 0 && resolvedEquity < rawBal) {
            calculatedDD = Number((((rawBal - resolvedEquity) / rawBal) * 100).toFixed(1));
        }
        const existingDD = Number(existingStatus?.daily_max_drawdown) || 0;
        const resolvedDD = Math.max(existingDD, port_status?.max_drawdown || 0, port_status?.daily_max_drawdown || 0, calculatedDD);

        const resolvedTodayPnl = (port_status?.today_profit !== undefined && port_status?.today_profit !== null && !isNaN(Number(port_status.today_profit)))
            ? Number(port_status.today_profit)
            : (port_status?.today_pnl !== undefined && port_status?.today_pnl !== null && !isNaN(Number(port_status.today_pnl)))
                ? Number(port_status.today_pnl)
                : (summary?.today_profit !== undefined && summary?.today_profit !== null && !isNaN(Number(summary.today_profit)))
                    ? Number(summary.today_profit)
                    : (existingStatus?.today_pnl !== undefined ? Number(existingStatus.today_pnl) : 0);

        const { error: portStatusError } = await supabaseAdmin
            .from('farm_port_status')
            .upsert({
                port_number: String(port_number),
                balance: rawBal,
                equity: resolvedEquity,
                floating_pnl: resolvedFloating,
                buy_count: buyCount,
                sell_count: sellCount,
                total_lots: Number(totalLots.toFixed(2)),
                margin_level: port_status?.margin_level || 0,
                account_type: port_status?.account_type || existingStatus?.account_type || 'USC',
                system_code: port_status?.system_code || existingStatus?.system_code || 'EasyM',
                ea_version: port_status?.ea_version || existingStatus?.ea_version || 'v1.16',
                today_pnl: resolvedTodayPnl,
                daily_max_drawdown: resolvedDD,
                server_time: Math.floor(Date.now() / 1000),
                is_online: true,
                last_ping: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'port_number' });

        if (portStatusError) {
            console.error('Farm Sync Error (Port Status):', portStatusError);
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
