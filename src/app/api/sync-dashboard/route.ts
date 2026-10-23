import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { getPortControlAsync, updatePortControlAsync, saveLiveOrders, isViewerActiveForPort } from '@/lib/farm-control/store';
import { sweepAndDeactivateExpiredLicenses } from '@/lib/license-audit';

export const dynamic = 'force-dynamic';

interface PortTelemetryStat {
    portNumber: string;
    reqsToday: number;
    lastPingMs: number;
    lastIntervalSec: number;
    avgIntervalSec: number;
    assignedIntervalSec: number;
    mode: 'LIVE_20S' | 'SLEEP_180S' | 'ANOMALY_FAST';
    eaVersion: string;
    systemCode: string;
}

interface TrafficTelemetryState {
    dateKey: string;
    hourlyReqs: number[];
    hourlyPeakReqs: number[];
    totalReqsToday: number;
    byModel: Record<string, number>;
    ports: Record<string, PortTelemetryStat>;
    lastFlushMs: number;
    hydrated: boolean;
}

function getBangkokDateAndHour(nowMs: number = Date.now()): { dateKey: string; hour: number } {
    const bkk = new Date(nowMs + 7 * 3600 * 1000);
    return {
        dateKey: bkk.toISOString().slice(0, 10),
        hour: bkk.getUTCHours()
    };
}

const initBkk = getBangkokDateAndHour();
const trafficState: TrafficTelemetryState = {
    dateKey: initBkk.dateKey,
    hourlyReqs: Array(24).fill(0),
    hourlyPeakReqs: Array(24).fill(0),
    totalReqsToday: 0,
    byModel: {},
    ports: {},
    lastFlushMs: 0,
    hydrated: false
};

async function hydrateTrafficStateIfNeeded() {
    if (trafficState.hydrated) return;
    trafficState.hydrated = true;
    try {
        const { data } = await supabase
            .from('fleet_capital_snapshots')
            .select('snapshot_meta')
            .eq('period_key', 'mt5_traffic_telemetry')
            .maybeSingle();

        const meta = data?.snapshot_meta as any;
        if (meta && typeof meta === 'object') {
            const { dateKey } = getBangkokDateAndHour();
            if (Array.isArray(meta.hourlyPeakReqs) && meta.hourlyPeakReqs.length === 24) {
                for (let h = 0; h < 24; h++) {
                    trafficState.hourlyPeakReqs[h] = Math.max(trafficState.hourlyPeakReqs[h], Number(meta.hourlyPeakReqs[h] || 0));
                }
            }
            if (meta.dateKey === dateKey) {
                if (Array.isArray(meta.hourlyReqs) && meta.hourlyReqs.length === 24) {
                    for (let h = 0; h < 24; h++) {
                        trafficState.hourlyReqs[h] += Number(meta.hourlyReqs[h] || 0);
                        trafficState.hourlyPeakReqs[h] = Math.max(trafficState.hourlyPeakReqs[h], trafficState.hourlyReqs[h]);
                    }
                }
                trafficState.totalReqsToday += Number(meta.totalReqsToday || 0);
                if (meta.byModel && typeof meta.byModel === 'object') {
                    for (const [k, v] of Object.entries(meta.byModel)) {
                        trafficState.byModel[k] = (trafficState.byModel[k] || 0) + Number(v || 0);
                    }
                }
                if (meta.ports && typeof meta.ports === 'object') {
                    for (const [pKey, pVal] of Object.entries(meta.ports as Record<string, PortTelemetryStat>)) {
                        if (!trafficState.ports[pKey]) {
                            trafficState.ports[pKey] = pVal;
                        } else {
                            trafficState.ports[pKey].reqsToday += Number(pVal.reqsToday || 0);
                        }
                    }
                }
            }
        }
    } catch (e) {
        // Ignore hydration errors
    }
}

function recordIncomingSyncTelemetry(
    portNumber: string,
    rawSystemCode: string,
    eaVersion: string,
    isViewerActive: boolean,
    assignedIntervalSec: number
) {
    const nowMs = Date.now();
    const { dateKey, hour } = getBangkokDateAndHour(nowMs);

    if (trafficState.dateKey !== dateKey) {
        trafficState.dateKey = dateKey;
        trafficState.hourlyReqs = Array(24).fill(0);
        trafficState.totalReqsToday = 0;
        trafficState.byModel = {};
        trafficState.ports = {};
    }

    trafficState.hourlyReqs[hour] = (trafficState.hourlyReqs[hour] || 0) + 1;
    if (trafficState.hourlyReqs[hour] > (trafficState.hourlyPeakReqs[hour] || 0)) {
        trafficState.hourlyPeakReqs[hour] = trafficState.hourlyReqs[hour];
    }
    trafficState.totalReqsToday += 1;

    const cleanSys = String(rawSystemCode || 'EasyM').split(':::')[0].trim();
    const modelLabel = cleanSys.toLowerCase().includes('prime')
        ? 'EasyM Prime'
        : cleanSys.toLowerCase().includes('max') || eaVersion.includes('2.00')
            ? `EasyM Max (${eaVersion})`
            : `${cleanSys} (${eaVersion})`;

    trafficState.byModel[modelLabel] = (trafficState.byModel[modelLabel] || 0) + 1;

    const prev = trafficState.ports[portNumber];
    let lastIntervalSec = assignedIntervalSec;
    let avgIntervalSec = assignedIntervalSec;

    if (prev && prev.lastPingMs > 0 && prev.assignedIntervalSec === assignedIntervalSec) {
        const diffSec = Math.max(1, Math.round((nowMs - prev.lastPingMs) / 1000));
        if (diffSec < 3600) {
            lastIntervalSec = diffSec;
            avgIntervalSec = Math.round(prev.avgIntervalSec * 0.6 + diffSec * 0.4);
        }
    }

    const reqsToday = (prev?.reqsToday || 0) + 1;
    let mode: 'LIVE_20S' | 'SLEEP_180S' | 'ANOMALY_FAST' = isViewerActive ? 'LIVE_20S' : 'SLEEP_180S';
    if (reqsToday >= 3 && avgIntervalSec <= 15 && !isViewerActive) {
        mode = 'ANOMALY_FAST';
    } else if (isViewerActive) {
        mode = 'LIVE_20S';
    } else {
        mode = 'SLEEP_180S';
    }

    trafficState.ports[portNumber] = {
        portNumber,
        reqsToday,
        lastPingMs: nowMs,
        lastIntervalSec,
        avgIntervalSec,
        assignedIntervalSec,
        mode,
        eaVersion,
        systemCode: cleanSys
    };

    // Throttled flush to Supabase once every 60 seconds (at most 1 write/minute across the entire fleet)
    if (nowMs - trafficState.lastFlushMs > 60000) {
        trafficState.lastFlushMs = nowMs;
        void (async () => {
            try {
                await hydrateTrafficStateIfNeeded();
                await sweepAndDeactivateExpiredLicenses(supabase);
                await supabase.from('fleet_capital_snapshots').upsert({
                    period_key: 'mt5_traffic_telemetry',
                    period_type: 'telemetry',
                    active_ports_count: Object.keys(trafficState.ports).length,
                    snapshot_meta: {
                        dateKey: trafficState.dateKey,
                        hourlyReqs: trafficState.hourlyReqs,
                        hourlyPeakReqs: trafficState.hourlyPeakReqs,
                        totalReqsToday: trafficState.totalReqsToday,
                        byModel: trafficState.byModel,
                        ports: trafficState.ports,
                        updated_at: new Date(nowMs).toISOString()
                    }
                }, { onConflict: 'period_key' });
            } catch (e) {
                // Non-critical background telemetry flush
            }
        })();
    }
}

export async function GET() {
    await hydrateTrafficStateIfNeeded();
    return NextResponse.json({
        success: true,
        telemetry: {
            dateKey: trafficState.dateKey,
            hourlyReqs: trafficState.hourlyReqs,
            hourlyPeakReqs: trafficState.hourlyPeakReqs,
            totalReqsToday: trafficState.totalReqsToday,
            byModel: trafficState.byModel,
            ports: trafficState.ports,
            updatedAt: new Date().toISOString()
        }
    });
}

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
        const rawSystemCode = String(snapshot?.identity?.system_code || payload.system_code || 'EasyM');
        const systemCode = rawSystemCode.includes(':::') ? rawSystemCode.split(':::')[0].trim() : rawSystemCode;
        const eaVersion = snapshot?.identity?.ea_version || payload.ea_version || 'v2.00';

        // Distinguish between:
        // 1. New v2.00 EAs that support 2-URLs but are currently running in 1-URL Fallback mode (explicitly sends sync_mode: 'FALLBACK_1URL')
        // 2. Legacy Classic EAs (older MAX, Farm, Mini, Gold) that natively run on 1-URL without the 2-URL architecture
        const isFallback1UrlEA = payload.sync_mode === 'FALLBACK_1URL' || rawSystemCode.includes('FALLBACK_1URL');

        let incomingPrimeData: any = payload.prime_data || rawData.p_payload?.prime_data;
        if (!incomingPrimeData && rawSystemCode.includes(':::')) {
            try {
                const parts = rawSystemCode.split(':::');
                incomingPrimeData = JSON.parse(parts.slice(1).join(':::'));
            } catch (e) {
                // Ignore parse error
            }
        }

        const primeData = isFallback1UrlEA ? {
            sync_mode: 'FALLBACK_1URL',
            last_10m_sync: nowIso
        } : incomingPrimeData;

        let lastViewedAtStr: string | null = null;

        // 3. Process Status Sync
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

            // Preserve full prime_data inside system_code for real-time farm UI decoding
            const finalSystemCode = primeData ? `${systemCode}:::${JSON.stringify(primeData)}` : rawSystemCode;

            const statusPayload: any = {
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
                system_code: finalSystemCode,
                ea_version: eaVersion,
                server_time: Number(payload.server_time || Math.floor(Date.now() / 1000)),
                is_online: true,
                last_ping: nowIso,
                updated_at: nowIso
            };

            const { data: upsertedStatus, error: statusErr } = await supabase
                .from('farm_port_status')
                .upsert(statusPayload, { onConflict: 'port_number' })
                .select('last_viewed_at')
                .maybeSingle();

            if (upsertedStatus?.last_viewed_at) {
                lastViewedAtStr = upsertedStatus.last_viewed_at;
            }

            if (statusErr) {
                console.error('Error syncing farm_port_status:', statusErr);
            }
        }

        // 4. Process Active Orders & On-Demand Live Trades Stream
        const liveOrders = payload.live_orders || rawData.live_orders || payload.prime_data?.live_orders;
        if (Array.isArray(liveOrders)) {
            saveLiveOrders(portNumber, liveOrders);
        }

        if (isFallback1UrlEA) {
            // New 1-URL Fallback mode does not stream live Farm orders to conserve Vercel bandwidth
            await supabase.from('farm_active_orders').delete().eq('port_number', portNumber);
        } else if (orders && Array.isArray(orders) && orders.length > 0) {
            // Legacy Classic EA: Upsert orders as normal so classic farm flowers/lotuses render correctly
            const upsertData = orders.map((o: any) => ({
                ticket_id: o.ticket_id,
                port_number: portNumber,
                symbol: o.symbol || o.pair || '',
                type: o.type || 'BUY',
                status: o.status || 'OPEN',
                current_pnl: o.current_pnl || 0,
                sl_risk_percent: o.sl_risk_percent || 0,
                raw_lot_size: o.raw_lot_size || 0,
                updated_at: nowIso
            }));

            if (upsertData.length > 0) {
                await supabase.from('farm_active_orders').upsert(upsertData, { onConflict: 'ticket_id' });
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

        // 7. Dynamic Interval policy (Live 20s vs Standby 180s/600s)
        if (!lastViewedAtStr) {
            const { data: vData } = await supabase
                .from('farm_port_status')
                .select('last_viewed_at')
                .eq('port_number', portNumber)
                .maybeSingle();
            lastViewedAtStr = vData?.last_viewed_at || null;
        }

        const nowMs = Date.now();
        const lastViewedMs = lastViewedAtStr ? new Date(lastViewedAtStr).getTime() : 0;
        // Viewer is active if in-memory ping was recorded or last_viewed_at was within 120s
        const isViewerActive = !isFallback1UrlEA && (isViewerActiveForPort(portNumber) || ((nowMs - lastViewedMs) < 120000));

        // Fallback 1-URL = 600s, Live viewer = 20s (10s on dev port 97053088), Sleep standby = 180s (3 minutes)
        const assignedInterval = isFallback1UrlEA ? 600 : (isViewerActive ? (portNumber === '97053088' ? 10 : 20) : 180);

        // Record real-time MT5 request telemetry (in-memory + 60s throttled snapshot flush)
        recordIncomingSyncTelemetry(portNumber, systemCode, eaVersion, isViewerActive, assignedInterval);

        // 8. Retrieve & Harmonize 2-Way Command & Web Control state for this port
        let webConfig = await getPortControlAsync(portNumber);

        // Check if MT5 has already acknowledged the latest web command sequence
        const ackSeq = Number(incomingPrimeData?.ack_command_seq ?? payload.ack_command_seq ?? 0);
        const latestCmdSeq = Number(webConfig.command_seq ?? 0);
        // If web issued commands (latestCmdSeq > 0) and MT5 has not acknowledged yet, command is in flight!
        const isCommandInFlight = latestCmdSeq > 0 && ackSeq < latestCmdSeq;

        // If no web command is in flight, synchronize any manual MT5 chart toggles back into webConfig
        const incomingPairs = incomingPrimeData?.pairs || payload.pairs;
        if (!isCommandInFlight && incomingPairs && typeof incomingPairs === 'object') {
            const currentSymbols = { ...(webConfig.symbols || {}) };
            let hasSymbolChanges = false;

            for (const [sym, pInfo] of Object.entries(incomingPairs as Record<string, any>)) {
                if (pInfo && pInfo.enabled !== undefined) {
                    const cleanSym = sym.toUpperCase().replace(/[^A-Z]/g, '');
                    const isEn = Boolean(pInfo.enabled);
                    const existing = currentSymbols[cleanSym];
                    if (!existing || existing.enabled !== isEn) {
                        currentSymbols[cleanSym] = {
                            enabled: isEn,
                            close_only: !isEn
                        };
                        hasSymbolChanges = true;
                    }
                }
            }

            if (hasSymbolChanges) {
                // When harmonizing manual MT5 chart toggles, keep command_seq unchanged so MT5 doesn't re-apply
                webConfig = await updatePortControlAsync(portNumber, { 
                    symbols: currentSymbols,
                    command_seq: latestCmdSeq
                });
            }
        }

        return NextResponse.json({
            status: 'success',
            success: true,
            should_sync_full: isViewerActive,
            viewer_active: isViewerActive,
            sync_interval: assignedInterval,
            sync_mode: isFallback1UrlEA ? 'FALLBACK_1URL' : (isViewerActive ? 'LIVE_20S' : 'SLEEP_180S'),
            license_tier: isFallback1UrlEA ? 'free' : 'pro',
            is_trial: false,
            timestamp: nowIso,
            web_config: webConfig
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
