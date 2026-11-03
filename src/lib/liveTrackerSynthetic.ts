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
 * Fetches all daily history records using range pagination to bypass Supabase 1,000 row limit
 */
async function fetchAllDailyHistory(
    supabase: SupabaseClient,
    ports: string[],
    startDate: string
): Promise<any[]> {
    let allRows: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('farm_daily_history')
            .select('port_number, date, profit')
            .in('port_number', ports)
            .gte('date', startDate)
            .order('date', { ascending: true })
            .range(from, from + step - 1);

        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < step) break;
        from += step;
    }
    return allRows;
}

/**
 * Market trading date helpers (5:00 PM NY rollover / New York timezone)
 */
export function getMarketTradingDate(date: Date = new Date()): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
        partMap[p.type] = p.value;
    }
    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10) - 1;
    const day = parseInt(partMap.day, 10);
    const hour = parseInt(partMap.hour, 10);

    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat

    if (dayOfWeek === 5) {
        return d;
    } else if (dayOfWeek === 6) {
        d.setDate(d.getDate() - 1);
        return d;
    } else if (dayOfWeek === 0) {
        if (hour >= 17) {
            d.setDate(d.getDate() + 1);
        } else {
            d.setDate(d.getDate() - 2);
        }
        return d;
    } else {
        if (hour >= 17) {
            d.setDate(d.getDate() + 1);
        }
        return d;
    }
}

export function getMarketTradingDateStr(date: Date = new Date()): string {
    const d = getMarketTradingDate(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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

    // 1. Fetch pre-June 22 history from 21692434 and active port statuses/orders (including SYNTHETIC-MASTER)
    const [preHistRes, postHistRows, statusesRes, ordersRes] = await Promise.all([
        supabase
            .from('farm_daily_history')
            .select('date, profit')
            .eq('port_number', '21692434')
            .gte('date', joinDateStr)
            .lt('date', startDate)
            .order('date', { ascending: true })
            .limit(1000),
        fetchAllDailyHistory(supabase, activePorts, startDate),
        supabase
            .from('farm_port_status')
            .select('*')
            .in('port_number', [...activePorts, 'SYNTHETIC-MASTER']),
        // Active orders from leading active ports
        supabase
            .from('farm_active_orders')
            .select('*')
            .in('port_number', activePorts.slice(0, 3))
            .limit(100)
    ]);

    // Group post-June 22 daily profits by date
    const dateMap = new Map<string, number[]>();
    postHistRows.forEach(h => {
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

    Array.from(dateMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([date, profits]) => {
            // ไม่เอาพอร์ตที่มีกำไรติดลบมาเฉลี่ยประวัติ
            const positiveProfits = profits.filter(p => p > 0);
            const avgProfit = positiveProfits.length > 0
                ? positiveProfits.reduce((a, b) => a + b, 0) / positiveProfits.length
                : 0;
            combinedDailyHistory.push({
                id: `synth-${date}`,
                date,
                profit: Number(avgProfit.toFixed(2))
            });
        });

    // Compute live status
    const allStatuses = statusesRes.data || [];
    const synthMasterRow = allStatuses.find(s => s.port_number === 'SYNTHETIC-MASTER');
    const statuses = allStatuses.filter(s => s.port_number !== 'SYNTHETIC-MASTER');
    const validCount = Math.max(1, statuses.length);

    // 1) ไม่เอาพอร์ตที่มีกำไรติดลบ (<= 0) มาคำนวณกำไรเฉลี่ยวันนี้
    const positiveStatuses = statuses.filter(s => (Number(s.today_pnl) || 0) > 0);
    const rawAvgTodayProfit = positiveStatuses.length > 0
        ? positiveStatuses.reduce((sum, s) => sum + (Number(s.today_pnl) || 0), 0) / positiveStatuses.length
        : 0;

    // 2) High-Water Mark (Ratchet) ต่อวันเปิดตลาด:
    // ค่าที่แสดงต้องไม่ต่ำกว่าค่าที่แสดงครั้งก่อนหน้าของแต่ละวัน
    // ตัวอย่าง: พอร์ตแรกได้ 100 แสดง 100 ต่อมาพอร์ตที่ 2 ได้ 60 รวมได้เฉลี่ย 80 หน้าฟาร์มยังคงแสดง 100
    // จนกว่าเฉลี่ยจะมากกว่า 100 จึงแสดงค่าใหม่
    const activeMarketDateStr = getMarketTradingDateStr(new Date());
    let effectiveTodayProfit = rawAvgTodayProfit;

    if (synthMasterRow) {
        const lastMarketDateStr = synthMasterRow.system_code?.includes(':::')
            ? synthMasterRow.system_code.split(':::')[1]
            : (synthMasterRow.updated_at ? getMarketTradingDateStr(new Date(synthMasterRow.updated_at)) : '');

        if (lastMarketDateStr === activeMarketDateStr) {
            // วันเปิดตลาดเดียวกัน: ถือยอดสูงสุดที่เคยคำนวณได้ (ไม่ลดลง)
            effectiveTodayProfit = Math.max(Number(synthMasterRow.today_pnl) || 0, rawAvgTodayProfit);
        } else {
            // ข้ามวันเปิดตลาดใหม่: เริ่มต้นตามค่ารอบปัจจุบันของวันใหม่
            effectiveTodayProfit = rawAvgTodayProfit;
        }
    }

    const nonZeroClosedLots = statuses.filter(s => (Number(s.today_closed_lots) || 0) > 0);
    const avgTodayClosedLots = nonZeroClosedLots.length > 0
        ? nonZeroClosedLots.reduce((sum, s) => sum + (Number(s.today_closed_lots) || 0), 0) / nonZeroClosedLots.length
        : 0;

    const avgFloatingPnl = statuses.reduce((sum, s) => sum + (Number(s.floating_pnl) || 0), 0) / validCount;
    const avgDD = statuses.reduce((sum, s) => sum + (Number(s.daily_max_drawdown) || 0), 0) / validCount;
    const avgTotalLots = statuses.reduce((sum, s) => sum + (Number(s.total_lots) || 0), 0) / validCount;
    const avgBuyPnl = statuses.reduce((sum, s) => sum + (Number(s.buy_pnl) || 0), 0) / validCount;
    const avgSellPnl = statuses.reduce((sum, s) => sum + (Number(s.sell_pnl) || 0), 0) / validCount;
    const avgBuyCount = Math.round(statuses.reduce((sum, s) => sum + (Number(s.buy_count) || 0), 0) / validCount);
    const avgSellCount = Math.round(statuses.reduce((sum, s) => sum + (Number(s.sell_count) || 0), 0) / validCount);

    const bkkTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const isTodayRecorded = combinedDailyHistory.some(h => h.date === bkkTodayStr);
    const historyProfitSum = combinedDailyHistory.reduce((sum, h) => sum + h.profit, 0);
    const todayPnlToAdd = isTodayRecorded ? 0 : effectiveTodayProfit;
    const currentBalance = 100000 + historyProfitSum + todayPnlToAdd;

    const syntheticStatus = {
        port_number: 'SYNTHETIC-MASTER',
        master_balance: 100000,
        balance: Number(currentBalance.toFixed(2)),
        equity: Number((currentBalance + avgFloatingPnl).toFixed(2)),
        floating_pnl: Number(avgFloatingPnl.toFixed(2)),
        today_pnl: Number(effectiveTodayProfit.toFixed(2)),
        daily_max_drawdown: Number(avgDD.toFixed(2)),
        total_lots: Number(avgTotalLots.toFixed(2)),
        today_closed_lots: Number(avgTodayClosedLots.toFixed(2)),
        buy_pnl: Number(avgBuyPnl.toFixed(2)),
        sell_pnl: Number(avgSellPnl.toFixed(2)),
        buy_count: avgBuyCount,
        sell_count: avgSellCount,
        asset_type: 'FOREX',
        account_type: 'USC',
        currency: 'USC',
        system_code: `EasyM Live Tracker (10-Port Model):::${activeMarketDateStr}`,
        ea_version: 'v2.00',
        is_online: true,
        last_ping: new Date().toISOString(),
        server_time: Math.floor(Date.now() / 1000)
    };

    // บันทึก High-Water Mark ลงใน DB เพื่อให้ผู้เข้าชมทุกคนได้ค่าที่สม่ำเสมอกัน
    const shouldUpdateDb = !synthMasterRow
        || Number(synthMasterRow.today_pnl) !== Number(effectiveTodayProfit.toFixed(2))
        || !synthMasterRow.system_code?.includes(activeMarketDateStr);

    if (shouldUpdateDb) {
        try {
            await supabase
                .from('farm_port_status')
                .upsert({
                    ...syntheticStatus,
                    updated_at: new Date().toISOString()
                });
        } catch (err) {
            console.error('[liveTrackerSynthetic] Failed to persist high-water mark:', err);
        }
    }

    return {
        dailyHistory: combinedDailyHistory,
        portStatus: syntheticStatus,
        activeOrders: ordersRes.data || [],
        activeCount: activePorts.length,
        historyProfitSum
    };
}
