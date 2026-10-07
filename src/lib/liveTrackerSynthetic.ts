import { SupabaseClient } from '@supabase/supabase-js';

export interface SwapLogItem {
    id: string;
    date: string;
    outPort: string | null;
    inPort: string | null;
    reason: string;
    swappedAt: string;
}

export interface LiveTrackerPoolConfig {
    mode: 'synthetic_10' | 'single_master';
    startDate: string; // '2026-06-22'
    activePorts: string[]; // 10 ports
    reservePorts: string[]; // 10 ports
    swapLogs: SwapLogItem[];
}

export const DEFAULT_LIVE_TRACKER_CONFIG: LiveTrackerPoolConfig = {
    mode: 'synthetic_10',
    startDate: '2026-06-22',
    activePorts: [
        '97043077',
        '97064918',
        '97063720',
        '97008494',
        '97057831',
        '97057650',
        '97082233',
        '97072175',
        '97073247',
        '97064907'
    ],
    reservePorts: [
        '97059212',
        '97078729',
        '97099998',
        '97100967',
        '97101366',
        '97037173',
        '97105630',
        '97105263',
        '97098008',
        '97097723'
    ],
    swapLogs: [
        {
            id: 'swap-init-20260622',
            date: '2026-06-22',
            outPort: '21692434',
            inPort: 'ACTIVE_POOL_10',
            reason: 'เริ่มต้นใช้งานระบบค่าเฉลี่ย 10 พอร์ตต้นแบบ (สเปกทุน $1,000 - $2,000 รันปกติ)',
            swappedAt: '2026-06-22T00:00:00.000Z'
        }
    ]
};

/**
 * Parses raw demo_master_port string from profiles into a full LiveTrackerPoolConfig
 */
export function parsePoolConfig(rawVal?: string | null): LiveTrackerPoolConfig {
    if (!rawVal) return { ...DEFAULT_LIVE_TRACKER_CONFIG };

    try {
        if (rawVal.trim().startsWith('{')) {
            const parsed = JSON.parse(rawVal);
            if (parsed.activePorts && Array.isArray(parsed.activePorts)) {
                return {
                    mode: parsed.mode || 'synthetic_10',
                    startDate: parsed.startDate || '2026-06-22',
                    activePorts: parsed.activePorts.length > 0 ? parsed.activePorts : DEFAULT_LIVE_TRACKER_CONFIG.activePorts,
                    reservePorts: Array.isArray(parsed.reservePorts) ? parsed.reservePorts : DEFAULT_LIVE_TRACKER_CONFIG.reservePorts,
                    swapLogs: Array.isArray(parsed.swapLogs) ? parsed.swapLogs : DEFAULT_LIVE_TRACKER_CONFIG.swapLogs
                };
            }
        }
    } catch (e) {
        console.error('Error parsing demo_master_port config:', e);
    }

    // If it's a legacy plain account number like '21692434', return default with that as outPort
    return { ...DEFAULT_LIVE_TRACKER_CONFIG };
}

/**
 * Checks health of active ports and automatically swaps with reserve ports if needed
 */
export async function evaluateAndAutoSwap(
    supabase: SupabaseClient,
    config: LiveTrackerPoolConfig
): Promise<{ updatedConfig: LiveTrackerPoolConfig; swappedCount: number }> {
    const allPorts = Array.from(new Set([...config.activePorts, ...config.reservePorts]));
    const { data: statuses } = await supabase
        .from('farm_port_status')
        .select('port_number, balance, account_type, is_online, last_ping, updated_at, system_code')
        .in('port_number', allPorts);

    const statusMap = new Map<string, any>();
    (statuses || []).forEach(s => statusMap.set(s.port_number, s));

    const now = Date.now();
    const newActive = [...config.activePorts];
    const newReserve = [...config.reservePorts];
    const newLogs = [...config.swapLogs];
    let swappedCount = 0;

    const isHealthy = (portNum: string) => {
        const s = statusMap.get(portNum);
        if (!s) return false;
        const balUSC = s.account_type === 'USD' ? Number(s.balance) * 100 : Number(s.balance);
        if (balUSC < 100000) return false; // Capital < $1,000 (100,000 USC)
        const pingTime = s.last_ping ? new Date(s.last_ping).getTime() : 0;
        if (now - pingTime > 48 * 60 * 60 * 1000) return false; // Offline > 48h
        return true;
    };

    for (let i = 0; i < newActive.length; i++) {
        const port = newActive[i];
        const s = statusMap.get(port);
        let failureReason = '';

        if (!s) {
            failureReason = 'ไม่พบข้อมูลสถานะพอร์ตในระบบ';
        } else {
            const balUSC = s.account_type === 'USD' ? Number(s.balance) * 100 : Number(s.balance);
            const pingTime = s.last_ping ? new Date(s.last_ping).getTime() : 0;
            const hoursSincePing = (now - pingTime) / (1000 * 60 * 60);

            if (balUSC < 100000) {
                failureReason = `ทุนต่ำกว่าเกณฑ์ (${balUSC.toLocaleString()} / 100,000 USC)`;
            } else if (hoursSincePing > 48) {
                failureReason = `ขาดการติดต่อเกิน 48 ชม. (สื่อสารล่าสุด ${Math.round(hoursSincePing)} ชม. ที่แล้ว)`;
            }
        }

        if (failureReason) {
            // Find first healthy reserve port
            const reserveIndex = newReserve.findIndex(rp => isHealthy(rp));
            if (reserveIndex !== -1) {
                const replacementPort = newReserve.splice(reserveIndex, 1)[0];
                newActive[i] = replacementPort;
                newReserve.push(port); // Move troubled port to end of reserve list

                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
                newLogs.unshift({
                    id: `swap-${Date.now()}-${i}`,
                    date: todayStr,
                    outPort: port,
                    inPort: replacementPort,
                    reason: `สลับอัตโนมัติ: พอร์ต #${port} ${failureReason} -> ดึงพอร์ต #${replacementPort} เข้ามาแทน`,
                    swappedAt: new Date().toISOString()
                });
                swappedCount++;
            }
        }
    }

    return {
        updatedConfig: {
            ...config,
            activePorts: newActive,
            reservePorts: newReserve,
            swapLogs: newLogs
        },
        swappedCount
    };
}

/**
 * Computes synthetic combined history & status for Live Tracker
 */
export async function getSyntheticLiveTrackerData(
    supabase: SupabaseClient,
    config: LiveTrackerPoolConfig,
    joinDateStr: string = '2026-05-09'
) {
    const startDate = config.startDate || '2026-06-22';
    const activePorts = config.activePorts.length > 0 ? config.activePorts : DEFAULT_LIVE_TRACKER_CONFIG.activePorts;

    // 1. Fetch pre-June 22 history from 21692434
    const [preHistRes, postHistRes, statusesRes, ordersRes] = await Promise.all([
        supabase
            .from('farm_daily_history')
            .select('date, profit')
            .eq('port_number', '21692434')
            .gte('date', joinDateStr)
            .lt('date', startDate)
            .order('date', { ascending: true }),
        supabase
            .from('farm_daily_history')
            .select('port_number, date, profit')
            .in('port_number', activePorts)
            .gte('date', startDate)
            .order('date', { ascending: true }),
        supabase
            .from('farm_port_status')
            .select('*')
            .in('port_number', activePorts),
        // Active orders from leading active ports
        supabase
            .from('farm_active_orders')
            .select('*')
            .in('port_number', activePorts.slice(0, 3))
            .limit(100)
    ]);

    // Group post-June 22 daily profits by date
    const dateMap = new Map<string, number[]>();
    (postHistRes.data || []).forEach(h => {
        if (!dateMap.has(h.date)) dateMap.set(h.date, []);
        dateMap.get(h.date)!.push(Number(h.profit) || 0);
    });

    const combinedDailyHistory: Array<{ id: string; date: string; profit: number }> = [];

    // Add pre-June 22 history
    (preHistRes.data || []).forEach(h => {
        combinedDailyHistory.push({
            id: (h as any).id || `pre-${h.date}`,
            date: h.date,
            profit: Number(Number(h.profit || 0).toFixed(2))
        });
    });

    // Add post-June 22 synthetic average history
    Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, profits]) => {
            const avgProfit = profits.length > 0 ? profits.reduce((a, b) => a + b, 0) / profits.length : 0;
            combinedDailyHistory.push({
                id: `synth-${date}`,
                date,
                profit: Number(avgProfit.toFixed(2))
            });
        });

    // Compute live status
    const statuses = statusesRes.data || [];
    const validCount = Math.max(1, statuses.length);
    const avgTodayProfit = statuses.reduce((sum, s) => sum + (Number(s.today_pnl) || 0), 0) / validCount;
    const avgFloatingPnl = statuses.reduce((sum, s) => sum + (Number(s.floating_pnl) || 0), 0) / validCount;
    const avgDD = statuses.reduce((sum, s) => sum + (Number(s.daily_max_drawdown) || 0), 0) / validCount;
    const avgTotalLots = statuses.reduce((sum, s) => sum + (Number(s.total_lots) || 0), 0) / validCount;
    const avgTodayClosedLots = statuses.reduce((sum, s) => sum + (Number(s.today_closed_lots) || 0), 0) / validCount;
    const avgBuyPnl = statuses.reduce((sum, s) => sum + (Number(s.buy_pnl) || 0), 0) / validCount;
    const avgSellPnl = statuses.reduce((sum, s) => sum + (Number(s.sell_pnl) || 0), 0) / validCount;

    const bkkTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const isTodayRecorded = combinedDailyHistory.some(h => h.date === bkkTodayStr);
    const historyProfitSum = combinedDailyHistory.reduce((sum, h) => sum + h.profit, 0);
    const todayPnlToAdd = isTodayRecorded ? 0 : avgTodayProfit;
    const currentBalance = 100000 + historyProfitSum + todayPnlToAdd;

    const syntheticStatus = {
        port_number: 'SYNTHETIC-MASTER',
        master_balance: 100000,
        balance: Number(currentBalance.toFixed(2)),
        equity: Number((currentBalance + avgFloatingPnl).toFixed(2)),
        floating_pnl: Number(avgFloatingPnl.toFixed(2)),
        today_pnl: Number(avgTodayProfit.toFixed(2)),
        daily_max_drawdown: Number(avgDD.toFixed(2)),
        total_lots: Number(avgTotalLots.toFixed(2)),
        today_closed_lots: Number(avgTodayClosedLots.toFixed(2)),
        buy_pnl: Number(avgBuyPnl.toFixed(2)),
        sell_pnl: Number(avgSellPnl.toFixed(2)),
        account_type: 'USC',
        currency: 'USC',
        system_code: 'EasyM Live Tracker (10-Port Model)',
        ea_version: 'v2.00',
        is_online: true,
        last_ping: new Date().toISOString(),
        server_time: Math.floor(Date.now() / 1000)
    };

    return {
        dailyHistory: combinedDailyHistory,
        portStatus: syntheticStatus,
        activeOrders: ordersRes.data || [],
        activeCount: activePorts.length,
        historyProfitSum
    };
}
