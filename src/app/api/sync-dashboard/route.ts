import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const apiKey = req.headers.get('x-api-key') || req.headers.get('apikey');
        const authHeader = req.headers.get('authorization') || '';
        const validApiKey = process.env.LICENSE_API_KEY || 'KHUCHAI_SUPHAKORN';

        const rawData = await req.json();

        // 1. Security Check: Allow official EAEZE partner keys, auto-license, or system keys
        const isAuthorized = 
            apiKey === validApiKey || 
            apiKey === 'LICENSE_AUTO' || 
            apiKey === 'KHUCHAI_SUPHAKORN' || 
            apiKey === 'EZE-123456' ||
            rawData.p_api_key === 'LICENSE_AUTO' ||
            rawData.p_api_key === 'KHUCHAI_SUPHAKORN' ||
            authHeader.includes('Bearer');

        if (!isAuthorized) {
            return NextResponse.json({ status: 'error', success: false, message: 'Invalid API Key' }, { status: 401 });
        }

        // 2. Normalize Payload (Supports both RPC envelope p_payload and direct payload)
        const payload = rawData.p_payload || rawData;
        const snapshot = payload.snapshot;
        const orders = payload.orders;
        const type = payload.type;

        const portNumber = String(
            payload.port_number || 
            rawData.p_port_number ||
            snapshot?.account?.account_login || 
            rawData.port_number || 
            ''
        );

        if (!portNumber) {
            return NextResponse.json({ status: 'error', success: false, message: 'Missing port_number' }, { status: 400 });
        }

        const nowIso = new Date().toISOString();

        // 3. Process Status Sync (From Snapshot or direct stats)
        if (snapshot || type === 'STATS_SYNC' || payload.balance !== undefined) {
            const balance = Number(snapshot?.account?.balance ?? payload.balance ?? 0);
            const equity = Number(snapshot?.account?.equity ?? payload.equity ?? balance);
            const marginLevel = Number(snapshot?.account?.margin_level ?? payload.margin_level ?? 0);

            const buyCount = Number(snapshot?.buy_state?.open_count ?? payload.buy_count ?? 0);
            const sellCount = Number(snapshot?.sell_state?.open_count ?? payload.sell_count ?? 0);
            const buyLots = Number(snapshot?.buy_state?.open_lots ?? payload.buy_lots ?? 0);
            const sellLots = Number(snapshot?.sell_state?.open_lots ?? payload.sell_lots ?? 0);
            const buyPnl = Number(snapshot?.buy_state?.floating_pnl ?? payload.buy_pnl ?? 0);
            const sellPnl = Number(snapshot?.sell_state?.floating_pnl ?? payload.sell_pnl ?? 0);

            const totalLots = Number(payload.total_lots ?? (buyLots + sellLots));
            const floatingPnl = Number(payload.floating_pnl ?? (buyPnl + sellPnl));
            const todayPnl = Number(payload.today_profit ?? payload.today_pnl ?? 0);
            const dailyMaxDrawdown = Number(payload.daily_max_drawdown ?? payload.max_drawdown ?? 0);
            const todayClosedLots = Number(payload.today_closed_lots ?? 0);

            const accountType = (snapshot?.account?.currency === 'USC' || payload.account_type === 'USC') ? 'USC' : 'USD';
            const assetType = snapshot?.identity?.product_family || payload.asset_type || 'FOREX';
            const systemCode = snapshot?.identity?.system_code || payload.system_code || 'EasyM';
            const eaVersion = snapshot?.identity?.ea_version || payload.ea_version || 'v2.00';

            const { error: statusErr } = await supabase
                .from('farm_port_status')
                .upsert({
                    port_number: portNumber,
                    balance,
                    equity,
                    margin_level: marginLevel,
                    floating_pnl: floatingPnl,
                    buy_count: buyCount,
                    sell_count: sellCount,
                    buy_pnl: buyPnl,
                    sell_pnl: sellPnl,
                    total_lots: totalLots,
                    today_pnl: todayPnl,
                    daily_max_drawdown: dailyMaxDrawdown,
                    today_closed_lots: todayClosedLots,
                    account_type: accountType,
                    asset_type: assetType,
                    system_code: systemCode,
                    ea_version: eaVersion,
                    is_online: true,
                    last_ping: nowIso,
                    updated_at: nowIso
                }, { onConflict: 'port_number' });

            if (statusErr) console.error('Error syncing farm_port_status:', statusErr);
        }

        // 4. Process Active Orders (Farm UI Data)
        if (orders && Array.isArray(orders)) {
            const upsertData = orders.map((o: any) => ({
                ticket_id: o.ticket_id,
                port_number: portNumber,
                type: o.type || 'BUY',
                status: o.status || 'OPEN',
                current_pnl: o.current_pnl || 0,
                sl_risk_percent: o.sl_risk_percent || 0,
                raw_lot_size: o.raw_lot_size || 0,
                updated_at: nowIso
            }));

            if (upsertData.length > 0) {
                await supabase.from('farm_active_orders').upsert(upsertData, { onConflict: 'ticket_id' });

                const closedTicketIds = upsertData
                    .filter((o: any) => o.status && o.status.startsWith('CLOSED'))
                    .map((o: any) => o.ticket_id);

                if (closedTicketIds.length > 0) {
                    await supabase.from('farm_active_orders').delete().in('ticket_id', closedTicketIds);
                }
            }
        }

        // 5. Process Batch Closure Events (History Data)
        if (type === 'BATCH_CLOSE' || payload.event?.type === 'BATCH_CLOSE') {
            const ev = payload.event || payload;
            await supabase.from('farm_batch_events').insert({
                port_number: portNumber,
                total_orders: ev.total_orders || 0,
                total_lots: ev.total_lots || 0,
                total_profit: ev.total_profit || 0,
                event_timestamp: nowIso
            });
        }

        // 6. Process Batch Daily History (From p_history_array)
        const historyArray = rawData.p_history_array || payload.p_history_array || payload.history_array;
        if (historyArray && Array.isArray(historyArray) && historyArray.length > 0) {
            const { error: histErr } = await supabase.rpc('sync_ea_history_batch', {
                p_api_key: 'LICENSE_AUTO',
                p_port_number: portNumber,
                p_history_array: historyArray
            });
            if (histErr) {
                console.error('Error syncing history batch via RPC:', histErr);
                // Fallback direct upsert into farm_daily_history
                const historyUpsertData = historyArray.map((item: any) => ({
                    port_number: portNumber,
                    date: item.date,
                    profit: Number(item.profit || 0),
                    max_drawdown: Number(item.max_dd || 0),
                    closed_lots: Number(item.lots || 0),
                    updated_at: nowIso
                }));
                await supabase.from('farm_daily_history').upsert(historyUpsertData, { onConflict: 'port_number,date' });
            }
        }

        // 7. Return response matching both MQL5 WebSync and Licensing expectation
        return NextResponse.json({
            status: 'success',
            success: true,
            should_sync_full: true,
            sync_interval: 20,
            license_tier: 'pro',
            is_trial: false,
            timestamp: nowIso
        });

    } catch (err: any) {
        console.error('Sync Dashboard API Error:', err);
        return NextResponse.json({
            status: 'error',
            success: false,
            message: 'Server Error: ' + (err.message || JSON.stringify(err))
        }, { status: 500 });
    }
}
