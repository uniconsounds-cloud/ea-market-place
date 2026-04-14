import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * EAEZE Universal Sync API
 * 
 * This endpoint handles multi-modular data from MetaTrader 5 (MQL5).
 * It supports both "Spaceship Dashboard" metrics and "Farm UI" order data.
 * 
 * Features:
 * - Partner-Base Key Validation (Security)
 * - Real-time Port Status Upsert (O(1) per port)
 * - Farming View Order Tracking
 * - Batch Event Logging (History)
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // Initialize Supabase admin client (Service Role) to bypass RLS for EA data ingestion
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );

    try {
        // 1. Validate API Key (Partner-Base Strategy)
        const apiKey = req.headers.get('x-api-key');
        if (!apiKey) {
            return NextResponse.json({ error: 'Missing API Key' }, { status: 401 });
        }

        const { data: keyRecord, error: keyError } = await supabaseAdmin
            .from('api_keys')
            .select('partner_name, status')
            .eq('key_value', apiKey)
            .single();

        if (keyError || !keyRecord || keyRecord.status !== 'active') {
            return NextResponse.json({ error: 'Invalid or revoked API Key' }, { status: 401 });
        }

        // 2. Parse Payload
        const payload = await req.json();
        const { snapshot, orders, event, type, port_number } = payload;

        // Determine port number from modular snapshot or legacy payload
        const activePort = port_number || snapshot?.account?.account_login?.toString();

        if (!activePort) {
            return NextResponse.json({ error: 'Missing port_number' }, { status: 400 });
        }

        // 3. Process Real-time Snapshot (Spaceship Dashboard Data)
        if (snapshot) {
            const { error: portStatusError } = await supabaseAdmin
                .from('farm_port_status')
                .upsert({
                    port_number: activePort,
                    balance: snapshot.account?.balance || 0,
                    equity: snapshot.account?.equity || 0,
                    margin_level: snapshot.account?.margin_level || 0,
                    floating_pnl: (snapshot.buy_state?.floating_pnl || 0) + (snapshot.sell_state?.floating_pnl || 0),
                    max_drawdown: snapshot.account?.max_drawdown || 0, // Should be calculated or passed
                    buy_count: snapshot.buy_state?.open_count || 0,
                    sell_count: snapshot.sell_state?.open_count || 0,
                    buy_pnl: snapshot.buy_state?.floating_pnl || 0,
                    sell_pnl: snapshot.sell_state?.floating_pnl || 0,
                    total_lots: (snapshot.buy_state?.open_lots || 0) + (snapshot.sell_state?.open_lots || 0),
                    account_type: snapshot.account?.currency === 'USC' ? 'USC' : 'USD',
                    asset_type: snapshot.identity?.product_family || 'FOREX',
                    system_code: snapshot.identity?.system_code || 'EAE_GENERIC',
                    ea_version: snapshot.identity?.ea_version || 'v1.0',
                    is_online: true,
                    last_ping: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }, { onConflict: 'port_number' });

            if (portStatusError) console.error('Sync Error (Port Status):', portStatusError);
        }

        // 4. Process Active Orders (Farm UI Data)
        if (orders && Array.isArray(orders)) {
            const upsertData = orders.map((o: any) => ({
                ticket_id: o.ticket_id,
                port_number: activePort,
                type: o.type || 'BUY',
                status: o.status,
                current_pnl: o.current_pnl || 0,
                sl_risk_percent: o.sl_risk_percent || 0,
                raw_lot_size: o.raw_lot_size || 0,
                updated_at: new Date().toISOString()
            }));

            if (upsertData.length > 0) {
                await supabaseAdmin.from('farm_active_orders').upsert(upsertData, { onConflict: 'ticket_id' });

                // Cleanup: If orders are closed, remove them from active tracking
                const closedTicketIds = upsertData
                    .filter(o => o.status.startsWith('CLOSED'))
                    .map(o => o.ticket_id);
                
                if (closedTicketIds.length > 0) {
                    await supabaseAdmin.from('farm_active_orders').delete().in('ticket_id', closedTicketIds);
                }
            }
        }

        // 5. Process Batch Closure Events (History Data)
        if (type === 'BATCH_CLOSE' || (event && event.type === 'BATCH_CLOSE')) {
            const ev = event || payload;
            await supabaseAdmin.from('farm_batch_events').insert({
                port_number: activePort,
                total_orders: ev.total_orders || 0,
                total_lots: ev.total_lots || 0,
                total_profit: ev.total_profit || 0,
                event_timestamp: new Date().toISOString()
            });
        }

        return NextResponse.json({ 
            success: true, 
            partner: keyRecord.partner_name,
            timestamp: new Date().toISOString() 
        });

    } catch (error: any) {
        console.error('Unified Sync Panic:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
