import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getBasketEvents, recordBasketEvent, BasketEvent } from '@/lib/farm-control/store';

export const dynamic = 'force-dynamic';

const PAIR_COLORS: Record<string, string> = {
    'EURJPY': '#a855f7', // Purple
    'GBPJPY': '#06b6d4', // Cyan
    'EURCAD': '#10b981', // Emerald
    'USDCAD': '#f59e0b', // Amber
    'GBPAUD': '#ec4899', // Pink
    'EURAUD': '#8b5cf6', // Violet
    'NZDJPY': '#14b8a6', // Teal
    'AUDJPY': '#f97316', // Orange
    'EURUSD': '#3b82f6', // Blue
    'GBPUSD': '#6366f1', // Indigo
};

const DEFAULT_COLORS = ['#06b6d4', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#f97316'];

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const rawPort = searchParams.get('port') || searchParams.get('port_number') || '3088';
        let portNumber = String(rawPort).trim();

        if (portNumber === '3088') {
            portNumber = '97053088';
        }

        const period = (searchParams.get('period') || 'today').toLowerCase(); // 'today' | 'daily' | 'weekly' | 'monthly'
        const reqDate = searchParams.get('date')?.trim() || '';
        const tradingDateParam = searchParams.get('trading_date')?.trim() || '';

        // 1. Fetch current live port status from database
        const { data: status } = await supabase
            .from('farm_port_status')
            .select('*')
            .eq('port_number', portNumber)
            .maybeSingle();

        const balance = Number(status?.balance || 0);
        const equity = Number(status?.equity || balance);
        const accountType = status?.account_type || 'USC';
        const updatedAt = status?.updated_at || new Date().toISOString();

        // 2. Fetch full daily history from farm_daily_history
        const { data: rawHistory } = await supabase
            .from('farm_daily_history')
            .select('date, profit, closed_lots, lots, max_drawdown, max_dd')
            .eq('port_number', portNumber)
            .order('date', { ascending: false })
            .limit(60);

        const historyList = (rawHistory || []).map((h: any) => ({
            date: String(h.date || ''),
            profit: Number(h.profit || 0),
            lots: Number(h.closed_lots ?? h.lots ?? 0),
            max_dd: Number(h.max_drawdown ?? h.max_dd ?? 0)
        }));

        // Determine active trading date from client or server_time
        let activeTradingDate = tradingDateParam || reqDate;
        if (!activeTradingDate) {
            if (status?.server_time && Number(status.server_time) > 0) {
                const sDate = new Date(Number(status.server_time) * 1000);
                const y = sDate.getUTCFullYear();
                const m = String(sDate.getUTCMonth() + 1).padStart(2, '0');
                const d = String(sDate.getUTCDate()).padStart(2, '0');
                activeTradingDate = `${y}-${m}-${d}`;
            } else {
                const now = new Date();
                const y = now.getFullYear();
                const m = String(now.getMonth() + 1).padStart(2, '0');
                const d = String(now.getDate()).padStart(2, '0');
                activeTradingDate = `${y}-${m}-${d}`;
            }
        }

        // 3. Extract any real incoming basket events from system_code & memory store
        const realEvents: BasketEvent[] = [];

        // Parse system_code if present
        if (status?.system_code && status.system_code.includes(':::')) {
            try {
                const parts = status.system_code.split(':::');
                const pData = JSON.parse(parts.slice(1).join(':::'));
                
                // Real last_basket from EA
                if (pData?.last_basket && typeof pData.last_basket === 'object') {
                    const lb = pData.last_basket;
                    if (lb.symbol) {
                        const cleanSym = String(lb.symbol).replace(/\.v$/i, '').toUpperCase();
                        realEvents.push({
                            id: lb.event_id || `lb_${lb.closed_at}_${cleanSym}`,
                            port_number: portNumber,
                            symbol: cleanSym,
                            side: String(lb.side || 'BUY').toUpperCase(),
                            exit_type: String(lb.exit_type || 'FULL_BASKET_TP'),
                            orders: Number(lb.orders || 1),
                            lots: Number(lb.lots || 0),
                            profit: Number(lb.profit || 0),
                            duration_sec: Number(lb.duration_sec || 0),
                            max_dd_pct: Number(lb.max_dd || 0),
                            closed_at: Number(lb.closed_at || Math.floor(Date.now() / 1000)),
                            ea_name: 'EasyM Prime',
                            ea_build: pData.build_id || 'B261031.1'
                        });
                    }
                }

                // Real harvest_events array from EA (B261031.1+)
                if (Array.isArray(pData?.harvest_events)) {
                    for (const ev of pData.harvest_events) {
                        if (ev && ev.symbol) {
                            const cleanSym = String(ev.symbol).replace(/\.v$/i, '').toUpperCase();
                            const exists = realEvents.some(e => e.id === ev.event_id || (e.symbol === cleanSym && e.closed_at === Number(ev.closed_at)));
                            if (!exists) {
                                realEvents.push({
                                    id: ev.event_id || `ev_${ev.closed_at}_${cleanSym}`,
                                    port_number: portNumber,
                                    symbol: cleanSym,
                                    side: String(ev.side || 'BUY').toUpperCase(),
                                    exit_type: String(ev.exit_type || 'FULL_BASKET_TP'),
                                    orders: Number(ev.orders || 1),
                                    lots: Number(ev.lots || 0),
                                    profit: Number(ev.profit || 0),
                                    duration_sec: Number(ev.duration_sec || 0),
                                    max_dd_pct: Number(ev.max_dd || 0),
                                    closed_at: Number(ev.closed_at || Math.floor(Date.now() / 1000)),
                                    ea_name: 'EasyM Prime',
                                    ea_build: pData.build_id || 'B261031.1'
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                // Ignore parse error
            }
        }

        // Also check memory store
        const memEvents = getBasketEvents(portNumber);
        for (const me of memEvents) {
            const cleanSym = String(me.symbol || '').replace(/\.v$/i, '').toUpperCase();
            const exists = realEvents.some(e => e.id === me.id || (e.symbol === cleanSym && e.closed_at === me.closed_at));
            if (!exists && cleanSym) {
                realEvents.push({
                    ...me,
                    symbol: cleanSym
                });
            }
        }

        // Check persistent farm_batch_events table in Supabase
        try {
            const { data: dbBatchEvents } = await supabase
                .from('farm_batch_events')
                .select('*')
                .eq('port_number', portNumber)
                .order('event_timestamp', { ascending: false })
                .limit(100);

            if (dbBatchEvents && dbBatchEvents.length > 0) {
                for (const row of dbBatchEvents) {
                    const cleanSym = String(row.symbol || '').replace(/\.v$/i, '').toUpperCase();
                    const closedAtSec = Math.floor(new Date(row.event_timestamp).getTime() / 1000);
                    const rowId = row.event_id || row.id || `db_${closedAtSec}_${cleanSym}`;
                    const exists = realEvents.some(e => e.id === rowId || (e.symbol === cleanSym && e.closed_at === closedAtSec));
                    if (!exists && cleanSym) {
                        realEvents.push({
                            id: rowId,
                            port_number: row.port_number,
                            symbol: cleanSym,
                            side: (row.side || 'BUY').toUpperCase(),
                            exit_type: row.exit_type || 'FULL_BASKET_TP',
                            orders: Number(row.total_orders || 1),
                            lots: Number(row.total_lots || 0),
                            profit: Number(row.total_profit || 0),
                            duration_sec: Number(row.duration_sec || 0),
                            max_dd_pct: Number(row.max_dd_pct || 0),
                            closed_at: closedAtSec,
                            ea_name: row.ea_name || 'EasyM Prime',
                            ea_build: row.ea_build || 'B261031.1'
                        });
                    }
                }
            }
        } catch (dbErr) {
            // Non-blocking
        }

        // 4. Calculate stats and events according to selected period
        let displayProfit = 0;
        let displayLots = 0;
        let displayMaxDd = 0;
        let filteredEvents: BasketEvent[] = [];

        if (period === 'today') {
            // Find today in historyList or fallback to live port status
            const histToday = historyList.find(h => h.date === activeTradingDate);
            const livePnl = Number(status?.today_pnl || 0);
            const liveLots = Number(status?.today_closed_lots || 0);
            const liveDd = Number(status?.daily_max_drawdown || 0);

            displayProfit = livePnl !== 0 ? livePnl : Number(histToday?.profit || 0);
            displayLots = liveLots !== 0 ? liveLots : Number(histToday?.lots || 0);
            displayMaxDd = liveDd !== 0 ? liveDd : Number(histToday?.max_dd || 0);

            // Filter real events to only those occurring on today's trading date
            filteredEvents = realEvents.filter(ev => {
                if (!ev.closed_at) return false;
                const evDate = new Date(ev.closed_at * 1000);
                const evDateStr = `${evDate.getUTCFullYear()}-${String(evDate.getUTCMonth() + 1).padStart(2, '0')}-${String(evDate.getUTCDate()).padStart(2, '0')}`;
                return evDateStr === activeTradingDate || Math.abs(Date.now() / 1000 - ev.closed_at) < 86400;
            });
        } else if (period === 'daily') {
            // Specific selected date or most recent completed day
            const targetDate = reqDate || tradingDateParam || historyList[0]?.date || activeTradingDate;
            const targetHist = historyList.find(h => h.date === targetDate) || historyList[0];
            if (targetHist) {
                displayProfit = targetHist.profit;
                displayLots = targetHist.lots;
                displayMaxDd = targetHist.max_dd;
            }
            // Filter real events for that day
            filteredEvents = realEvents.filter(ev => {
                if (!ev.closed_at) return false;
                const evDate = new Date(ev.closed_at * 1000);
                const evDateStr = `${evDate.getUTCFullYear()}-${String(evDate.getUTCMonth() + 1).padStart(2, '0')}-${String(evDate.getUTCDate()).padStart(2, '0')}`;
                return evDateStr === targetDate;
            });
        } else if (period === 'weekly') {
            // Past 7 active trading days
            const weekHistory = historyList.slice(0, 7);
            displayProfit = Number(weekHistory.reduce((s, h) => s + h.profit, 0).toFixed(2));
            displayLots = Number(weekHistory.reduce((s, h) => s + h.lots, 0).toFixed(2));
            displayMaxDd = Number(Math.max(0, ...weekHistory.map(h => h.max_dd)).toFixed(2));
            
            // Events from past 7 days
            const sevenDaysAgoSec = Math.floor(Date.now() / 1000) - 7 * 86400;
            filteredEvents = realEvents.filter(ev => (ev.closed_at || 0) >= sevenDaysAgoSec);
        } else if (period === 'monthly') {
            // Past 30 active trading days
            const monthHistory = historyList.slice(0, 30);
            displayProfit = Number(monthHistory.reduce((s, h) => s + h.profit, 0).toFixed(2));
            displayLots = Number(monthHistory.reduce((s, h) => s + h.lots, 0).toFixed(2));
            displayMaxDd = Number(Math.max(0, ...monthHistory.map(h => h.max_dd)).toFixed(2));

            // Events from past 30 days
            const thirtyDaysAgoSec = Math.floor(Date.now() / 1000) - 30 * 86400;
            filteredEvents = realEvents.filter(ev => (ev.closed_at || 0) >= thirtyDaysAgoSec);
        }

        // Sort events newest first
        filteredEvents.sort((a, b) => (b.closed_at || 0) - (a.closed_at || 0));

        // 5. Compute Pair Aggregated Summary from REAL events only
        const pairMap: Record<string, {
            symbol: string;
            totalProfit: number;
            totalLots: number;
            totalOrders: number;
            basketsCount: number;
            exitTypes: Set<string>;
            maxDd: number;
        }> = {};

        for (const ev of filteredEvents) {
            const sym = ev.symbol || 'UNKNOWN';
            if (!pairMap[sym]) {
                pairMap[sym] = {
                    symbol: sym,
                    totalProfit: 0,
                    totalLots: 0,
                    totalOrders: 0,
                    basketsCount: 0,
                    exitTypes: new Set<string>(),
                    maxDd: 0
                };
            }
            pairMap[sym].totalProfit += Number(ev.profit || 0);
            pairMap[sym].totalLots += Number(ev.lots || 0);
            pairMap[sym].totalOrders += Number(ev.orders || 0);
            pairMap[sym].basketsCount += 1;
            if (ev.exit_type) pairMap[sym].exitTypes.add(ev.exit_type);
            if (ev.max_dd_pct && ev.max_dd_pct > pairMap[sym].maxDd) {
                pairMap[sym].maxDd = ev.max_dd_pct;
            }
        }

        const effectiveTotalProfit = Math.max(0.01, Object.values(pairMap).reduce((sum, p) => sum + (p.totalProfit > 0 ? p.totalProfit : 0), 0));

        const pairSummary = Object.values(pairMap)
            .map((p, idx) => {
                const profitPositive = Math.max(0, p.totalProfit);
                const sharePct = Number(((profitPositive / effectiveTotalProfit) * 100).toFixed(1));
                const color = PAIR_COLORS[p.symbol] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
                return {
                    symbol: p.symbol,
                    totalProfit: Number(p.totalProfit.toFixed(2)),
                    totalLots: Number(p.totalLots.toFixed(2)),
                    totalOrders: p.totalOrders,
                    basketsCount: p.basketsCount,
                    profitSharePct: sharePct,
                    color,
                    exitTypes: Array.from(p.exitTypes),
                    maxDd: Number(p.maxDd.toFixed(2))
                };
            })
            .sort((a, b) => b.totalProfit - a.totalProfit);

        return NextResponse.json({
            success: true,
            period,
            active_date: activeTradingDate,
            port_number: portNumber,
            today_profit: displayProfit,
            today_closed_lots: displayLots,
            daily_max_drawdown: displayMaxDd,
            balance,
            equity,
            account_type: accountType,
            currency: accountType === 'USC' ? 'USC' : 'USD',
            updated_at: updatedAt,
            events_count: filteredEvents.length,
            pair_summary: pairSummary,
            events: filteredEvents,
            history_list: historyList
        });

    } catch (err: any) {
        console.error('Failed to get harvest telemetry data:', err);
        return NextResponse.json({ success: false, message: err.message || 'Internal error' }, { status: 500 });
    }
}
