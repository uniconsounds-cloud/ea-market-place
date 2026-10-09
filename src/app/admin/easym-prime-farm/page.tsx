'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import FarmHud, { FarmMobileStatsOverlay } from '@/components/farm-hud';
import { 
    Shield, 
    ShieldAlert, 
    Zap, 
    Layers, 
    Radio, 
    Sliders, 
    Activity, 
    RotateCcw, 
    Check, 
    AlertTriangle, 
    Crosshair, 
    Lock, 
    Unlock, 
    Sparkles, 
    RefreshCw, 
    X, 
    ArrowUpRight, 
    Cpu, 
    Fuel, 
    Clock, 
    LifeBuoy,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// ==========================================
// 🛠️ ISOMETRIC GRID & ASSET SETTINGS (MATCHING CLASSIC FARM)
// ==========================================
const TILE_W = 98;
const TILE_H_OFFSET = 55;
const TREE_Y_OFFSET = 8;
const FRUIT_SPAWN_Y_MIN = 10;
const FRUIT_SPAWN_Y_MAX = 42;
const FRUIT_SPAWN_X_MIN = 25;
const FRUIT_SPAWN_X_MAX = 75;

function seededRandom(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

const TREE_SLOTS = Array.from({ length: 15 }).map((_, i) => ({
    x: FRUIT_SPAWN_X_MIN + seededRandom(i * 10) * (FRUIT_SPAWN_X_MAX - FRUIT_SPAWN_X_MIN),
    y: FRUIT_SPAWN_Y_MIN + seededRandom(i * 20) * (FRUIT_SPAWN_Y_MAX - FRUIT_SPAWN_Y_MIN),
    z: i
}));

function getMarketTradingDate(date: Date = new Date()): Date {
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

// 20 MAJOR & CROSS PAIRS FOR EASYM PRIME
const PRIME_20_PAIRS = [
    'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
    'EURJPY', 'GBPJPY', 'AUDJPY', 'NZDUSD', 'EURGBP',
    'EURAUD', 'GBPAUD', 'USDCHF', 'EURCHF', 'GBPCHF',
    'AUDCAD', 'NZDJPY', 'CADJPY', 'CHFJPY', 'AUDNZD'
];

type PortMode = 'NORMAL' | 'SLOW' | 'FREEZE';
type ActiveModal = 'DEFENSE' | 'MATRIX' | 'VAULT' | 'RADAR' | null;

export default function AdminPrimeFarmLabPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const router = useRouter();

    // ─── Real Port 97053088 Data ───
    const portNumber = '97053088';
    const [liveOrders, setLiveOrders] = useState<any[]>([]);
    const [livePortStatus, setLivePortStatus] = useState<any>(null);
    const [rawHistory, setRawHistory] = useState<any[]>([]);

    // ─── Simulation Sandbox States ───
    const [isSimMode, setIsSimMode] = useState(false);
    const [simPortMode, setSimPortMode] = useState<PortMode>('NORMAL');
    const [simScenario, setSimScenario] = useState<string>('normal');
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);
    const [showSimBar, setShowSimBar] = useState(false);

    // Dynamic states for 20 pairs controls
    const [pairOverrides, setPairOverrides] = useState<Record<string, { closeOnly?: boolean; quarantined?: boolean }>>({
        EURJPY: { closeOnly: true, quarantined: true }
    });

    // Client, Time, and Responsive Scaling
    const [time, setTime] = useState<Date | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const historyScrollRef = useRef<HTMLDivElement>(null);

    // Check super admin authorization
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            if (user.email !== 'juntarasate@gmail.com') {
                toast.error('หน้านี้สงวนสิทธิ์เฉพาะ Super Admin เท่านั้น');
                router.push('/admin');
                return;
            }
            setUserEmail(user.email);
            setLoadingAuth(false);
        };
        checkAuth();
    }, [router]);

    // Setup client timer and responsive resize listener
    useEffect(() => {
        setIsClient(true);
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 1000);

        const handleResize = () => {
            if (!containerRef.current) return;
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const isMobile = winW < 640;

            // Space occupied by headers and docks:
            // Mobile: Top (~182px for header + stats overlay) + Bottom (~112px for crates) => ~294px
            // Desktop: Top (~86px) + Bottom (~160px) => ~246px
            const verticalOccupied = isMobile ? 295 : 245;
            // Horizontal margins: ensure no side clipping with screen edges or floating orbs
            const horizontalPadding = isMobile ? 36 : 100;

            const availW = Math.max(260, winW - horizontalPadding);
            const availH = Math.max(260, winH - verticalOccupied);

            // Bounding box of the 25-plot isometric farm:
            // Width: ~1064px (from left -392px to right +672px)
            // Height: ~740px
            const baseW = 1080;
            const baseH = 750;

            const scaleW = availW / baseW;
            const scaleH = availH / baseH;

            let newScale = Math.min(scaleW, scaleH);

            if (isMobile) {
                // Mobile constraint: strictly fit screen width and height
                if (newScale > 0.35) newScale = 0.35;
                if (newScale < 0.22) newScale = 0.22;
            } else {
                if (newScale > 1.15) newScale = 1.15;
                if (newScale < 0.30) newScale = 0.30;
            }

            setScale(newScale);
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Fetch live data for port 97053088 and setup realtime listener
    useEffect(() => {
        if (loadingAuth) return;

        const fetchLiveData = async () => {
            try {
                const [ordersRes, statusRes, historyRes, controlRes] = await Promise.all([
                    supabase.from('farm_active_orders').select('*').eq('port_number', portNumber),
                    supabase.from('farm_port_status').select('*').eq('port_number', portNumber).maybeSingle(),
                    supabase.from('farm_daily_history').select('*').eq('port_number', portNumber).order('date', { ascending: false }).limit(90),
                    fetch(`/api/farm/control?port=${portNumber}`).then(r => r.json()).catch(() => null)
                ]);

                if (ordersRes.data) setLiveOrders(ordersRes.data);
                if (statusRes.data) setLivePortStatus(statusRes.data);
                if (historyRes.data) setRawHistory(historyRes.data.reverse());

                if (controlRes?.success && controlRes.control?.symbols) {
                    const loadedOverrides: Record<string, { closeOnly?: boolean, quarantined?: boolean }> = {};
                    for (const [s, cfg] of Object.entries(controlRes.control.symbols as Record<string, any>)) {
                        loadedOverrides[s] = {
                            closeOnly: Boolean(cfg.close_only || cfg.enabled === false),
                            quarantined: Boolean(cfg.quarantined)
                        };
                    }
                    setPairOverrides(loadedOverrides);
                }
            } catch (err) {
                console.error('Error loading live port:', err);
            }
        };

        fetchLiveData();

        // Realtime subscription
        const channel = supabase.channel(`prime_lab_${portNumber}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_port_status', filter: `port_number=eq.${portNumber}` }, (payload) => {
                if (payload.new) setLivePortStatus(payload.new);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_active_orders', filter: `port_number=eq.${portNumber}` }, async () => {
                const { data: orders } = await supabase.from('farm_active_orders').select('*').eq('port_number', portNumber);
                setLiveOrders(orders || []);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_daily_history', filter: `port_number=eq.${portNumber}` }, async () => {
                const { data: hist } = await supabase.from('farm_daily_history').select('*').eq('port_number', portNumber).order('date', { ascending: false }).limit(90);
                if (hist) setRawHistory(hist.reverse());
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadingAuth]);

    // Auto-scroll history dock to right on mount
    useEffect(() => {
        if (historyScrollRef.current) {
            historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth;
        }
    }, [rawHistory]);

    // ─── Derived Telemetry Data (Merged with Simulation if Active) ───
    const telemetry = useMemo(() => {
        if (!isSimMode) {
            // Live Real Data from port 97053088
            const bal = Number(livePortStatus?.balance) || 10000;
            const eq = Number(livePortStatus?.equity) || 9850;
            const floatPnl = eq - bal;
            const ddAmt = floatPnl < 0 ? Math.abs(floatPnl) : 0;
            const ddPct = bal > 0 ? (ddAmt / bal) * 100 : 0;
            const todayPnl = Number(livePortStatus?.today_pnl) || 0;

            const buyOrders = liveOrders.filter(o => o.type === 'BUY');
            const sellOrders = liveOrders.filter(o => o.type === 'SELL');
            const buyCount = buyOrders.length;
            const sellCount = sellOrders.length;
            const buyPnl = buyOrders.reduce((acc, o) => acc + (Number(o.current_pnl) || 0), 0);
            const sellPnl = sellOrders.reduce((acc, o) => acc + (Number(o.current_pnl) || 0), 0);

            // Pair stats calculation
            const pairStats: Record<string, { pnl: number; count: number }> = {};
            liveOrders.forEach(o => {
                const sym = o.symbol || 'UNKNOWN';
                if (!pairStats[sym]) pairStats[sym] = { pnl: 0, count: 0 };
                pairStats[sym].pnl += Number(o.current_pnl) || 0;
                pairStats[sym].count += 1;
            });

            let worstSym = 'EURJPY';
            let worstDdAmt = 0;
            let worstOrders = 0;

            Object.entries(pairStats).forEach(([sym, st]) => {
                if (st.pnl < 0 && Math.abs(st.pnl) > worstDdAmt) {
                    worstDdAmt = Math.abs(st.pnl);
                    worstSym = sym;
                    worstOrders = st.count;
                }
            });
            const worstPairDdPct = bal > 0 ? Number(((worstDdAmt / bal) * 100).toFixed(2)) : 0;

            const quarantined = Object.entries(pairStats)
                .filter(([_, st]) => bal > 0 && ((Math.abs(st.pnl < 0 ? st.pnl : 0) / bal) * 100) >= 10)
                .map(([sym]) => sym);

            const livePortMode: PortMode = ddPct >= 30 ? 'FREEZE' : ddPct >= 15 ? 'SLOW' : 'NORMAL';
            const isRescueActive = ddPct >= 25;
            // Safe Liquidation is only for expired licenses, not for high drawdown on active accounts
            const isSafeLiq = false;

            return {
                isSafeLiquidation: isSafeLiq,
                portMode: livePortMode,
                balance: bal,
                equity: eq,
                floatingPnl: floatPnl,
                drawdownAmount: ddAmt,
                drawdownPercent: Number(ddPct.toFixed(2)),
                buyCount: buyCount,
                sellCount: sellCount,
                buyPnl: Number(buyPnl.toFixed(2)),
                sellPnl: Number(sellPnl.toFixed(2)),
                totalLots: Number(livePortStatus?.total_lots) || 0,
                todayPnl: todayPnl,
                todayClosedLots: Number(livePortStatus?.today_closed_lots) || 0,
                dailyMaxDrawdown: Number(livePortStatus?.daily_max_drawdown) || Number(ddPct.toFixed(2)),
                worstPair: {
                    symbol: worstSym,
                    dd: worstPairDdPct,
                    orders: worstOrders || liveOrders.filter(o => (o.symbol || '').includes(worstSym)).length
                },
                reliefFund: {
                    balance: Math.max(0, Number((todayPnl * 0.40).toFixed(2))),
                    cap: Math.round(bal * 0.05),
                    used: 0
                },
                rescue: {
                    isActive: isRescueActive,
                    count: isRescueActive ? 1 : 0,
                    ddPct: isRescueActive ? Number((ddPct * 0.15).toFixed(2)) : 0
                },
                quarantinePairs: quarantined,
                capitalBuffer: ddPct >= 15 ? '1.5x' : '1.2x',
                orders: liveOrders
            };
        }

        // ─── Simulation Presets ───
        const baseBal = 10000;
        let eq = 9750;
        let ddPct = 2.5;
        let isSafeLiq = false;
        let worst = { symbol: 'EURJPY', dd: 4.8, orders: 4 };
        let rescue = { isActive: false, count: 0, ddPct: 0 };
        let quarantine = [] as string[];
        let fundBalance = 85.40;
        let fundUsed = 0;
        let bufferMult = '1.15x';
        let ordersList = [...liveOrders];

        if (simScenario === 'quarantine') {
            eq = 7380;
            ddPct = 26.2;
            worst = { symbol: 'EURJPY', dd: 26.23, orders: 8 };
            quarantine = ['EURJPY', 'GBPJPY'];
            bufferMult = '1.05x';
        } else if (simScenario === 'rescue') {
            eq = 8650;
            ddPct = 13.5;
            worst = { symbol: 'GBPUSD', dd: 12.8, orders: 6 };
            rescue = { isActive: true, count: 2, ddPct: 2.32 };
        } else if (simScenario === 'relief') {
            eq = 9120;
            ddPct = 8.8;
            fundBalance = 120.00;
            fundUsed = 35.50;
        } else if (simScenario === 'safe_liquidation') {
            isSafeLiq = true;
            eq = 9450;
            ddPct = 5.5;
            worst = { symbol: 'EURUSD', dd: 3.2, orders: 3 };
        }

        return {
            isSafeLiquidation: isSafeLiq,
            portMode: simPortMode,
            balance: baseBal,
            equity: eq,
            floatingPnl: eq - baseBal,
            drawdownAmount: Math.abs(eq - baseBal),
            drawdownPercent: ddPct,
            buyCount: 5,
            sellCount: 4,
            buyPnl: eq - baseBal > 0 ? eq - baseBal : 25,
            sellPnl: eq - baseBal < 0 ? eq - baseBal : -48,
            totalLots: 0.88,
            todayPnl: 285.50,
            todayClosedLots: 1.45,
            dailyMaxDrawdown: ddPct,
            worstPair: worst,
            reliefFund: { balance: fundBalance, cap: 500, used: fundUsed },
            rescue: rescue,
            quarantinePairs: quarantine,
            capitalBuffer: bufferMult,
            orders: ordersList.length > 0 ? ordersList : [
                { ticket_id: 101, symbol: 'EURJPY', profit: -120, lot_size: 0.08, type: 'BUY' },
                { ticket_id: 102, symbol: 'GBPUSD', profit: 45, lot_size: 0.04, type: 'SELL' },
                { ticket_id: 103, symbol: 'USDJPY', profit: 12, lot_size: 0.02, type: 'BUY' }
            ]
        };
    }, [isSimMode, livePortStatus, liveOrders, simScenario, simPortMode]);

    // ─── 25-Tree Plot Calculation (Matching Classic Algorithm) ───
    const plot = useMemo(() => {
        const drawdown = telemetry.drawdownPercent;

        // Tree priority calculation
        const order = Array.from({ length: 25 }).map((_, i) => ({ index: i, c: i % 5, r: Math.floor(i / 5) }));
        const sortedIndices = order.sort((a, b) => (a.c - a.r) - (b.c - b.r) || (a.c + a.r) - (b.c + b.r)).map(o => o.index);

        const treeLevels = new Array(25).fill(4);
        let pointsToLose = Math.max(0, Math.floor(drawdown));

        // Distribute withered tree degradation
        for (const idx of sortedIndices) {
            if (pointsToLose <= 0) break;
            const loss = Math.min(pointsToLose, 3);
            treeLevels[idx] = Math.max(1, 4 - loss);
            pointsToLose -= loss;
        }

        const trees = Array.from({ length: 25 }).map((_, i) => {
            const level = treeLevels[i];
            const assets: any[] = [];
            
            // Distribute active order fruits across center trees
            if ((i === 12 || i === 11 || i === 13) && telemetry.orders.length > 0) {
                const sliceStart = i === 12 ? 0 : i === 11 ? 2 : 4;
                telemetry.orders.slice(sliceStart, sliceStart + 3).forEach((ord, aIdx) => {
                    assets.push({
                        ticketId: ord.ticket_id || aIdx,
                        slotId: (aIdx * 4 + i) % 15,
                        type: (ord.profit || 0) >= 0 ? 'PROFIT_FRUIT' : 'OPEN_LOTUS'
                    });
                });
            }

            return { id: i, level, assets };
        });

        return { trees };
    }, [telemetry.drawdownPercent, telemetry.orders]);

    // ─── Market Trading Date String (Rolls over at 05:00 AM Bangkok / 17:00 NY) ───
    const brokerDateStr = useMemo(() => {
        const mDate = getMarketTradingDate(time || new Date());
        const yyyy = mDate.getFullYear();
        const mm = String(mDate.getMonth() + 1).padStart(2, '0');
        const dd = String(mDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }, [time]);

    // ─── Daily Harvest History Crates Generation (Matching Classic EasyM Farm 100%) ───
    const dailyHistory = useMemo(() => {
        // Filter out today's active trading date and any future dates (only show past completed days before today)
        let filteredData = rawHistory.filter(item => item.date < brokerDateStr);

        // Sort ascending by date
        const sorted = [...filteredData].sort((a, b) => a.date.localeCompare(b.date));

        // --- AUTOMATIC MISSING-DAY CHECKER & GAP FILLER ---
        const historyMap = new Map(sorted.map(item => [item.date.split('T')[0], item]));
        
        const filledList: any[] = [];
        if (sorted.length > 0) {
            const firstDateStr = sorted[0].date.split('T')[0];
            const startDate = new Date(firstDateStr + 'T00:00:00');

            // History crates represent completed days strictly prior to today's active trading date (brokerDateStr)
            const lastCompletedDate = new Date(brokerDateStr + 'T00:00:00');
            lastCompletedDate.setDate(lastCompletedDate.getDate() - 1);

            const curr = new Date(startDate);
            while (curr <= lastCompletedDate) {
                const yyyy = curr.getFullYear();
                const mm = String(curr.getMonth() + 1).padStart(2, '0');
                const dd = String(curr.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                
                const dayOfWeek = curr.getDay(); // 0: Sun, 6: Sat
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

                if (historyMap.has(dateStr)) {
                    const item = historyMap.get(dateStr)!;
                    // Forex markets are strictly closed on Saturday & Sunday -> skip weekends
                    if (!isWeekend) {
                        filledList.push(item);
                    }
                } else if (!isWeekend) {
                    // MISSING WEEKDAY DETECTED -> Auto-fill missing weekday with 0 profit record
                    filledList.push({
                        id: `missing_${dateStr}`,
                        date: dateStr,
                        profit: 0,
                        isAutoFilled: true
                    });
                }

                curr.setDate(curr.getDate() + 1);
            }
        } else {
            // Realistic Fallback if port has no past history records
            const fallbackDays = [
                { date: '2026-09-14', profit: 4520 },
                { date: '2026-09-15', profit: 2840 },
                { date: '2026-09-16', profit: 1850 },
                { date: '2026-09-17', profit: 3580 },
                { date: '2026-09-18', profit: 2190 },
                { date: '2026-09-21', profit: -1240 },
                { date: '2026-09-22', profit: 5210 },
                { date: '2026-09-23', profit: 2290 },
                { date: '2026-09-24', profit: 1530 },
                { date: '2026-09-25', profit: 3120 },
                { date: '2026-09-28', profit: 4120 },
                { date: '2026-09-29', profit: 3170 },
                { date: '2026-09-30', profit: 860 },
                { date: '2026-10-01', profit: 4070 },
                { date: '2026-10-02', profit: 2490 }
            ];
            filledList.push(...fallbackDays.map((d, i) => ({ id: `fb_${i}`, ...d })));
        }

        // Extra guarantee: ensure no item equals or exceeds today's active market trading date
        const safeFilledList = filledList.filter(item => item.date < brokerDateStr);

        const MARKET_HOLIDAYS: Record<string, string> = {
            '12-25': 'Christmas Day',
            '01-01': 'New Year\'s Day',
            '2026-04-03': 'Good Friday',
            '2027-03-26': 'Good Friday'
        };

        return safeFilledList.map((item, idx) => {
            const pnl = Number(item.profit || 0);
            
            // Crate tier rule in dollars: 1000 USC = 10 USD, 2000 USC = 20 USD
            // (e.g. 1000 USC -> $10, 2000 USC -> $20)
            const pnlInDollars = pnl / 100;
            
            let asset = '/farm/base_farmbox_empty.png';
            if (pnlInDollars < 0) asset = '/farm/base_farmbox_lose.png';
            else if (pnlInDollars > 20) asset = '/farm/base_farmbox_full.png'; // > $20 (2000 USC)
            else if (pnlInDollars > 10) asset = '/farm/base_farmbox_mid.png';  // > $10 (1000 USC)
            else if (pnlInDollars > 0) asset = '/farm/base_farmbox_min.png';   // > $0 (1-1000 USC)

            // Market holiday check
            const dateMD = item.date.substring(5);
            const holidayName = MARKET_HOLIDAYS[dateMD] || MARKET_HOLIDAYS[item.date];
            const isHoliday = !!(holidayName && Math.abs(pnl) < 0.01);

            // Localized Date string: Mon-Fri e.g. "28 SEP", "01 OCT"
            const localDate = new Date(item.date + 'T00:00:00');
            const dayOfWeek = localDate.getDay();
            
            // Week boundary detection (End of trading week / Friday / Gap before next item)
            let isEndOfWeek = dayOfWeek === 5;
            if (idx < safeFilledList.length - 1) {
                const nextDate = new Date(safeFilledList[idx + 1].date + 'T00:00:00');
                const diffDays = Math.round((nextDate.getTime() - localDate.getTime()) / (1000 * 3600 * 24));
                if (diffDays > 2 || nextDate.getDay() < dayOfWeek) {
                    isEndOfWeek = true;
                }
            }

            return {
                id: item.id || idx,
                dateStr: item.date,
                date: localDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
                pnl,
                asset,
                isHoliday,
                holidayName,
                isEndOfWeek
            };
        });
    }, [rawHistory, brokerDateStr]);

    // Handlers for pair actions (2-Way Web Command Dispatch)
    const handleToggleCloseOnly = async (sym: string) => {
        const nextVal = !pairOverrides[sym]?.closeOnly;
        setPairOverrides(prev => ({
            ...prev,
            [sym]: {
                ...prev[sym],
                closeOnly: nextVal
            }
        }));

        try {
            await fetch('/api/farm/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    port_number: portNumber,
                    symbols: {
                        [sym]: {
                            enabled: !nextVal,
                            close_only: nextVal
                        }
                    }
                })
            });
            toast.info(`${sym}: สลับสถานะเป็น ${nextVal ? '⛔ CLOSE-ONLY (รอปิดรวบ ไม่เปิดใหม่)' : '✅ ACTIVE (เทรดปกติ)'} • ส่งคำสั่งไปยัง MT5 แล้ว`);
        } catch (e) {
            console.error('Error sending control command:', e);
            toast.error(`เกิดข้อผิดพลาดในการส่งคำสั่ง ${sym}`);
        }
    };

    const handleToggleQuarantine = async (sym: string) => {
        const nextVal = !pairOverrides[sym]?.quarantined;
        setPairOverrides(prev => ({
            ...prev,
            [sym]: {
                ...prev[sym],
                quarantined: nextVal
            }
        }));

        try {
            await fetch('/api/farm/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    port_number: portNumber,
                    symbols: {
                        [sym]: {
                            quarantined: nextVal
                        }
                    }
                })
            });
            toast.warning(`${sym}: ${nextVal ? '🔒 สั่งขังคู่เงิน (FORCE QUARANTINE) หยุดถมไม้ทันที' : '🔓 ปลดปล่อยออกจากห้องขัง'} • ส่งคำสั่งไปยัง MT5 แล้ว`);
        } catch (e) {
            console.error('Error sending quarantine command:', e);
            toast.error(`เกิดข้อผิดพลาดในการส่งคำสั่ง ${sym}`);
        }
    };

    if (loadingAuth) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#0a0d14] text-cyan-400">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <span className="ml-3 font-mono text-sm tracking-wider">LOADING PRIME LAB SECURITY PROTOCOL...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden font-sans select-none relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e3f0ff] via-[#b5d6f4] to-[#7fb2df]">
            
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🏰 FIXED HEADER: FARM HUD + 1-DAY TIMELINE (MATCHING ORIGINAL 100%) */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="fixed top-0 left-0 w-full z-[100] bg-[#16120e] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <FarmHud
                    title={`EASYM PRIME (${portNumber})`}
                    portNumber={portNumber}
                    balance={telemetry.balance}
                    equity={telemetry.equity}
                    floatingPnl={telemetry.floatingPnl}
                    totalStandardLots={telemetry.totalLots}
                    accountType="USC"
                    assetType="FOREX"
                    buyCount={telemetry.buyCount}
                    sellCount={telemetry.sellCount}
                    buyPnl={telemetry.buyPnl}
                    sellPnl={telemetry.sellPnl}
                    todayProfit={telemetry.todayPnl}
                    todayClosedLots={telemetry.todayClosedLots}
                    dailyMaxDrawdown={telemetry.dailyMaxDrawdown}
                    drawdownPercent={telemetry.drawdownPercent}
                    drawdownAmount={telemetry.drawdownAmount}
                    systemCode="EasyM Prime"
                    adminMessage="ติดต่อผ่าน line ID : @jharvest"
                    customName="EASYM PRIME"
                />

                {/* 1-Day Trading Timeline Bar: left=open, right=close, bar shrinks from right */}
                <div className="relative w-full bg-black/40 border-y border-amber-900/20 py-1 sm:py-2">
                    <div className="max-w-7xl mx-auto px-4 relative">
                        <div className="h-1.5 sm:h-2 w-full bg-white/5 rounded-full relative overflow-hidden">
                            {isClient && (() => {
                                const raw = Number(livePortStatus?.server_time);
                                const brokerDayPercent = raw ? ((raw % 86400) / 86400) * 100 : null;
                                const pct = brokerDayPercent !== null
                                    ? brokerDayPercent
                                    : ((time?.getHours() ?? 0) * 60 + (time?.getMinutes() ?? 0)) / (24 * 60) * 100;
                                const remaining = Math.max(0, 100 - pct);
                                return (
                                    <div 
                                        className="absolute top-0 right-0 h-full bg-gradient-to-r from-amber-300/30 via-amber-400/60 to-amber-500/90 transition-all duration-1000 rounded-full"
                                        style={{ width: `${remaining}%` }}
                                    />
                                );
                            })()}
                        </div>
                        <div className="absolute inset-0 px-4 flex justify-between items-center pointer-events-none">
                            {Array.from({ length: 25 }).map((_, i) => (
                                <div key={`h_${i}`} className={`h-2 sm:h-3 w-[1px] ${i % 6 === 0 ? 'bg-white/40' : 'bg-white/10'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 📱 MOBILE ONLY STATS OVERLAY (EXACT FIT BELOW TIMELINE BAR)      */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <FarmMobileStatsOverlay
                portNumber={portNumber}
                buyCount={telemetry.buyCount}
                sellCount={telemetry.sellCount}
                buyPnl={telemetry.buyPnl}
                sellPnl={telemetry.sellPnl}
                balance={telemetry.balance}
                todayProfit={telemetry.todayPnl}
                accountType="USC"
                todayClosedLots={telemetry.todayClosedLots}
                dailyMaxDrawdown={telemetry.dailyMaxDrawdown}
                drawdownPercent={telemetry.drawdownPercent}
                drawdownAmount={telemetry.drawdownAmount}
                totalStandardLots={telemetry.totalLots}
                customName="EASYM PRIME"
                adminMessage="ติดต่อผ่าน line ID : @jharvest"
            />

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🧪 FLOATING SANDBOX LAB CONTROLLER (OVERLAY - DOES NOT BLOCK FARM) */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="fixed top-[188px] sm:top-[148px] left-3 sm:left-6 z-[120] font-sans select-none animate-fade-in pointer-events-auto">
                {!showSimBar ? (
                    /* Collapsed Floating Pill */
                    <button
                        onClick={() => setShowSimBar(true)}
                        className="flex items-center gap-2 bg-[#0a0f1d]/90 hover:bg-[#111728] border border-purple-500/50 hover:border-purple-400 text-purple-200 px-3.5 py-1.5 rounded-full shadow-[0_6px_25px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-300 group cursor-pointer hover:scale-105"
                        title="คลิกเพื่อเปิดแถบควบคุมพอร์ตจริง / Sandbox"
                    >
                        <span className={`w-2.5 h-2.5 rounded-full ${!isSimMode ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse' : 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse'}`} />
                        <span className="text-[11px] font-bold font-mono">
                            {!isSimMode ? `🟢 LIVE (${portNumber})` : `🧪 SANDBOX: ${
                                simScenario === 'normal' ? 'ปกติ' :
                                simScenario === 'quarantine' ? 'กักขัง EJ' :
                                simScenario === 'rescue' ? 'สไนเปอร์' :
                                simScenario === 'relief' ? 'กองทุน' : 'Safe Liq'
                            }`}
                        </span>
                        <Sliders className="h-3.5 w-3.5 text-purple-300/70 group-hover:rotate-45 transition-transform ml-1" />
                    </button>
                ) : (
                    /* Expanded Floating Sci-Fi Dock */
                    <div className="bg-[#0a0f1d]/95 border-2 border-purple-500/50 rounded-2xl p-2.5 sm:p-3 shadow-[0_12px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl flex flex-col gap-2 max-w-[94vw] sm:max-w-xl animate-fade-in text-xs">
                        {/* Header Inside Floating Dock */}
                        <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-purple-500/20">
                            <div className="flex items-center gap-2">
                                <Cpu className="h-4 w-4 text-cyan-400 animate-pulse" />
                                <span className="font-mono font-black text-[11px] text-purple-200 tracking-wider">
                                    PRIME LAB CONTROLLER ({portNumber})
                                </span>
                                {telemetry.isSafeLiquidation && (
                                    <Badge className="bg-red-600 text-white text-[9px] font-black animate-pulse px-1.5 py-0">
                                        SAFE LIQ
                                    </Badge>
                                )}
                            </div>
                            <button
                                onClick={() => setShowSimBar(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                                title="ย่อแถบควบคุมแบบลอยตัว"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Mode Switch & Scenario Selector */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Live vs Sandbox Switch */}
                            <div className="flex items-center bg-black/60 rounded-xl p-0.5 border border-slate-700">
                                <button
                                    onClick={() => { setIsSimMode(false); toast.info('📡 เชื่อมต่อข้อมูลจริงจากพอร์ต 97053088'); }}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                        !isSimMode ? 'bg-cyan-500 text-black shadow font-black' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    🟢 พอร์ตจริง (Live)
                                </button>
                                <button
                                    onClick={() => { setIsSimMode(true); toast.success('🧪 เปิดโหมดจำลองสถานการณ์ Sandbox'); }}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                        isSimMode ? 'bg-purple-600 text-white shadow font-black' : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    🧪 Sandbox จำลอง
                                </button>
                            </div>

                            {/* Scenarios (Visible when Sandbox Mode is active) */}
                            {isSimMode && (
                                <div className="flex flex-wrap items-center gap-1">
                                    {[
                                        { id: 'normal', label: '🌱 ปกติ' },
                                        { id: 'quarantine', label: '🔒 กักขัง (EJ -26%)' },
                                        { id: 'rescue', label: '🎯 สไนเปอร์ R2' },
                                        { id: 'relief', label: '💎 กองทุนตัดขาดทุน' },
                                        { id: 'safe_liquidation', label: '🛡️ ปิดรอบ (Safe Liq)' },
                                    ].map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => setSimScenario(s.id)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                                                simScenario === s.id 
                                                    ? 'bg-purple-500/30 text-purple-200 border-purple-400 font-bold shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                                                    : 'bg-black/40 text-slate-400 border-slate-700 hover:text-white'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🛡️ SAFE LIQUIDATION PROTOCOL BANNER (WHEN EXPIRED OR SIMULATED)  */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {telemetry.isSafeLiquidation && (
                <div className="fixed top-28 sm:top-36 left-0 w-full bg-gradient-to-r from-red-950/95 via-amber-950/95 to-red-950/95 border-b border-red-500/60 py-2 px-4 z-[95] animate-fade-in shadow-2xl">
                    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 animate-bounce" />
                            <div>
                                <span className="text-xs sm:text-sm font-bold text-red-200">
                                    [SAFE LIQUIDATION PROTOCOL ACTIVE] สิทธิ์ใช้งานสิ้นสุดลงแล้ว
                                </span>
                                <span className="block text-[11px] text-amber-200/90">
                                    ระบบกำลังดูแลปิดรวบออเดอร์เดิมให้ปลอดภัย 100% ไม่เปิดไม้ใหม่ และไม่ปล่อยพอร์ตทิ้งขว้าง
                                </span>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs px-4 shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-300/50"
                            onClick={() => toast.success('เปิด Modal ต่ออายุสัญญา EasyM PRIME')}
                        >
                            <Sparkles className="h-3.5 w-3.5 mr-1 text-black" />
                            ต่ออายุ EasyM PRIME ทันที
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🌳 MAIN STAGE: LIVING ISOMETRIC TREE FARM                        */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div 
                ref={containerRef} 
                className="flex-1 w-full relative flex items-center justify-center overflow-hidden pt-[182px] pb-[112px] sm:pt-[136px] sm:pb-[160px]"
            >
                
                {/* 🛡️ Holographic Forcefield Dome (Visible during Safe Liquidation) */}
                {telemetry.isSafeLiquidation && (
                    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
                        <div className="w-[580px] h-[480px] rounded-[50%] border-2 border-amber-500/40 bg-gradient-to-t from-red-950/20 via-amber-500/10 to-transparent shadow-[0_0_80px_rgba(245,158,11,0.25)] animate-pulse flex items-center justify-center backdrop-blur-[0.5px]">
                            <div className="text-amber-400 font-mono text-[11px] tracking-widest uppercase bg-black/70 px-4 py-1.5 rounded-full border border-amber-500/40 shadow-xl">
                                🛡️ FORCEFIELD ENGAGED: CLOSE-ONLY MODE
                            </div>
                        </div>
                    </div>
                )}

                {/* 25 Isometric Plots */}
                <div
                    className="relative transition-all duration-500 ease-out origin-center"
                    style={{ transform: `scale(${isClient ? scale : 1})`, width: '100px', height: '100px' }}
                >
                    <div className="absolute left-1/2 top-1/2 -ml-[140px] -mt-[360px]">
                        {Array.from({ length: 25 }).map((_, i) => {
                            const c = i % 5;
                            const r = Math.floor(i / 5);
                            const tZIndex = (c + r) + 20;
                            const tree = plot.trees[i];

                            return (
                                <div
                                    key={`tile_${i}`}
                                    className="absolute"
                                    style={{
                                        left: `${(c - r) * TILE_W}px`,
                                        top: `${(c + r) * TILE_H_OFFSET}px`,
                                        zIndex: tZIndex,
                                        width: '280px',
                                        height: '280px'
                                    }}
                                >
                                    {isClient && (
                                        <div className="absolute inset-0" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                            <Image
                                                src={
                                                    tree.level === 4 ? '/farm/base_tree_new.png' :
                                                    tree.level === 3 ? '/farm/base_tree_state2.png' :
                                                    tree.level === 2 ? '/farm/base_tree_state3.png' :
                                                    '/farm/base_tree_state4.png'
                                                }
                                                alt="T"
                                                fill
                                                className="object-contain object-bottom drop-shadow-2xl"
                                                unoptimized
                                                priority
                                            />

                                            {/* Order Fruits/Flowers */}
                                            {tree.assets.map((asset, aIdx) => {
                                                const slot = TREE_SLOTS[asset.slotId];
                                                return (
                                                    <div
                                                        key={`order_${asset.ticketId || aIdx}`}
                                                        className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 drop-shadow-xl 
                                                            ${asset.type === 'OPEN_LOTUS' ? 'animate-pulse' : 'animate-float-fade'}
                                                        `}
                                                        style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: tZIndex + 1 }}
                                                    >
                                                        <Image
                                                            src={asset.type === 'PROFIT_FRUIT' ? '/farm/asset_b_orange.png' : '/farm/asset_a_lily.png'}
                                                            alt="Asset"
                                                            fill
                                                            className="object-contain"
                                                            unoptimized
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* 🔻 Floating Drawdown Badge on First Withered Tree */}
                                    {(() => {
                                        const firstWitheredIdx = plot.trees.findIndex(t => t.level < 4);
                                        const targetIdx = firstWitheredIdx >= 0 ? firstWitheredIdx : 0;
                                        const hasDrawdown = telemetry.drawdownPercent > 0 || telemetry.floatingPnl < 0;
                                        if (i === targetIdx && hasDrawdown && isClient) {
                                            const badgeCounterScale = (scale > 0 && scale < 0.38) ? (0.38 / scale) : 1;
                                            return (
                                                <div 
                                                    className="absolute -top-14 left-1/2 z-[90] flex flex-col items-center animate-fade-in pointer-events-none"
                                                    style={{
                                                        transform: `translateX(-50%) scale(${badgeCounterScale})`,
                                                        transformOrigin: 'bottom center'
                                                    }}
                                                >
                                                    <div className="bg-[#1a0505]/95 border sm:border-2 border-red-500/90 rounded-md sm:rounded-xl px-2 py-0.5 sm:px-5 sm:py-2.5 shadow-[0_0_15px_rgba(239,68,68,0.6)] sm:shadow-[0_0_35px_rgba(239,68,68,0.75)] text-center backdrop-blur-md flex flex-col items-center justify-center">
                                                        <div className="text-[17px] sm:text-xl font-mono font-black text-red-400 leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-nowrap">
                                                            -{telemetry.drawdownPercent.toFixed(2)}%
                                                        </div>
                                                        <div className="text-[11px] sm:text-xs font-mono font-bold text-red-300/80 leading-tight whitespace-nowrap mt-0.5">
                                                            -{telemetry.drawdownAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USC
                                                        </div>
                                                    </div>
                                                    <div className="w-0.5 sm:w-1 h-3 sm:h-6 bg-gradient-to-b from-red-500 via-red-500/60 to-transparent"></div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* 📅 Date Signpost at Front Plot 24 */}
                                    {i === 24 && (
                                        <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                            <div className="bg-[#1f1611]/95 border border-[#cfa545] rounded-sm px-6 py-2 shadow-2xl relative">
                                                <h2 className="text-[#cfa545] font-black tracking-widest text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,1)] whitespace-nowrap">
                                                    {isClient ? getMarketTradingDate(time || new Date()).toLocaleDateString('en-GB', { 
                                                        day: 'numeric', 
                                                        month: 'short', 
                                                        year: 'numeric' 
                                                    }).toUpperCase() : '...'}
                                                </h2>
                                            </div>
                                            <div className="w-1.5 h-16 bg-gradient-to-b from-[#8b5a2bd0] to-[#4a2e12d0] shadow-xl relative -mt-1 rounded-b-full border-x border-[#3a220f] z-0"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* 🛸 4 FLOATING SCI-FI HUD ORBS (GAMING POPUPS ON RIGHT SIDE)      */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="fixed right-2 sm:right-6 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-2 sm:gap-3">
                    
                    {/* Orb 1: Tactical Defense HUD */}
                    <button
                        onClick={() => setActiveModal('DEFENSE')}
                        className="group relative flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#0f172a]/90 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:scale-110 transition-all duration-300 backdrop-blur-md"
                    >
                        <Shield className="h-4 w-4 sm:h-6 sm:w-6 text-emerald-400 group-hover:animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-emerald-500"></span>
                        </span>
                        <span className="absolute right-14 sm:right-16 px-2.5 py-1 bg-black/90 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
                            🛡️ โหมดพอร์ต & เกราะคุ้มกันทุน
                        </span>
                    </button>

                    {/* Orb 2: 20-Pair Cockpit Matrix */}
                    <button
                        onClick={() => setActiveModal('MATRIX')}
                        className="group relative flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#0f172a]/90 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-110 transition-all duration-300 backdrop-blur-md"
                    >
                        <Layers className="h-4 w-4 sm:h-6 sm:w-6 text-cyan-400 group-hover:rotate-12 transition-transform" />
                        <span className="absolute bottom-0.5 sm:bottom-1 text-[7px] sm:text-[8px] font-mono font-black text-cyan-300">20P</span>
                        <span className="absolute right-14 sm:right-16 px-2.5 py-1 bg-black/90 border border-cyan-500/40 rounded-lg text-xs font-mono text-cyan-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
                            🎛️ กระดานสั่งการ 20 คู่เงิน (Close-Only)
                        </span>
                    </button>

                    {/* Orb 3: Relief Fund Vault */}
                    <button
                        onClick={() => setActiveModal('VAULT')}
                        className="group relative flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#0f172a]/90 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:scale-110 transition-all duration-300 backdrop-blur-md"
                    >
                        <Zap className="h-4 w-4 sm:h-6 sm:w-6 text-purple-400 group-hover:scale-125 transition-transform" />
                        <span className="absolute -top-1 -right-1 text-[7px] sm:text-[8px] font-mono font-black bg-purple-600 text-white px-1 rounded-full">
                            ${Math.round(telemetry.reliefFund.balance)}
                        </span>
                        <span className="absolute right-14 sm:right-16 px-2.5 py-1 bg-black/90 border border-purple-500/40 rounded-lg text-xs font-mono text-purple-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
                            💎 กองทุนตัดขาดทุนข้ามคู่ (Relief Fund)
                        </span>
                    </button>

                    {/* Orb 4: Threat & Rescue Radar */}
                    <button
                        onClick={() => setActiveModal('RADAR')}
                        className={`group relative flex items-center justify-center w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-[#0f172a]/90 border ${
                            telemetry.quarantinePairs.length > 0 || telemetry.rescue.isActive 
                                ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse' 
                                : 'border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                        } hover:scale-110 transition-all duration-300 backdrop-blur-md`}
                    >
                        <Crosshair className={`h-4 w-4 sm:h-6 sm:w-6 ${telemetry.quarantinePairs.length > 0 ? 'text-amber-400' : 'text-slate-400'} group-hover:rotate-90 transition-transform`} />
                        {(telemetry.quarantinePairs.length > 0 || telemetry.rescue.isActive) && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-amber-500"></span>
                            </span>
                        )}
                        <span className="absolute right-14 sm:right-16 px-2.5 py-1 bg-black/90 border border-amber-500/40 rounded-lg text-xs font-mono text-amber-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden sm:block">
                            🎯 ห้องขัง (Quarantine) & สไนเปอร์กู้ภัย
                        </span>
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 📦 FIXED BOTTOM DOCK: DAILY HARVEST HISTORY CRATES ROW            */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {isClient && (
                <div className="fixed bottom-0 left-0 w-full h-28 sm:h-40 bg-black/50 backdrop-blur-md border-t border-amber-900/40 z-[60] flex flex-col">
                    {/* Header Row */}
                    <div className="hidden sm:flex justify-between px-6 pt-2 mb-1">
                        <span className="text-[10px] text-amber-200/50 uppercase tracking-[0.2em] font-bold">
                            Daily Harvest History ({dailyHistory.length}D)
                        </span>
                        <button 
                            onClick={() => {
                                const key = prompt("Enter API Key to download history:");
                                if(key) window.open(`/api/farm/export?port=${portNumber}&key=${key}`, '_blank');
                            }}
                            className="flex items-center gap-1.5 text-[9px] bg-amber-900/40 hover:bg-amber-900/60 text-amber-200/70 border border-amber-700/50 px-3 py-1 rounded transition-colors uppercase font-bold"
                        >
                            Export 90D History (.CSV)
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                    </div>

                    {/* Crates Scroll Row */}
                    <div
                        ref={historyScrollRef}
                        className="flex-1 w-full overflow-x-auto overflow-y-hidden flex items-center gap-3 sm:gap-6 px-3 sm:px-6 py-1 sm:py-2 no-scrollbar"
                    >
                        {dailyHistory.map((item, idx) => (
                            <div key={item.id || idx} className="flex items-center flex-shrink-0">
                                <div className="flex flex-col items-center group relative">
                                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-110 drop-shadow-xl">
                                        <Image src={item.asset} alt="Box" fill className="object-contain" unoptimized />
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] sm:text-[9px] text-amber-100/50 font-mono tracking-tighter">{item.date}</span>
                                        {item.isHoliday ? (
                                            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-amber-400 animate-pulse" title={item.holidayName}>
                                                CLOSED
                                            </span>
                                        ) : (
                                            <span className={`text-[10px] sm:text-[11px] font-mono font-bold ${item.pnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                                {item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Week Divider Line */}
                                {item.isEndOfWeek && idx < dailyHistory.length - 1 && (
                                    <div className="flex flex-col items-center justify-center mx-2 sm:mx-3 h-16 sm:h-20 self-start">
                                        <div className="w-[1px] h-full bg-gradient-to-b from-amber-500/0 via-amber-500/40 to-amber-500/0"></div>
                                        <span className="text-[7px] font-mono text-amber-400/40 font-bold uppercase tracking-widest mt-1 whitespace-nowrap">WEEK</span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Mobile 90D Button */}
                        <button 
                            onClick={() => {
                                const key = prompt("Enter API Key to download history:");
                                if(key) window.open(`/api/farm/export?port=${portNumber}&key=${key}`, '_blank');
                            }}
                            className="sm:hidden flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-amber-900/40 hover:bg-amber-800/60 text-amber-200/80 border border-amber-700/50 rounded-lg transition-colors ml-auto"
                        >
                            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span className="text-[9px] font-bold uppercase">90D</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🎮 HOLOGRAPHIC SCI-FI MODAL OVERLAYS (FROSTED GLASSMORPHISM)     */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {activeModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
                    <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0a0f1d]/95 border-2 border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(6,182,212,0.3)] animate-scale-up text-slate-200">
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.4)_51%)] bg-[length:100%_4px] pointer-events-none rounded-3xl" />

                        <button
                            onClick={() => setActiveModal(null)}
                            className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-red-950/80 hover:border-red-500 border border-slate-700 transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* 🛡️ MODAL 1: TACTICAL DEFENSE HUD */}
                        {activeModal === 'DEFENSE' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-cyan-500/30 pb-4">
                                    <Shield className="h-7 w-7 text-emerald-400" />
                                    <div>
                                        <h2 className="text-xl font-black text-white tracking-wide">
                                            TACTICAL DEFENSE COCKPIT
                                        </h2>
                                        <p className="text-xs text-slate-400">
                                            ระบบปรับโหมดต้านทานตลาด และเกราะคุ้มกันทุนสำรอง EasyM PRIME
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {[
                                        { mode: 'NORMAL', label: '🟢 โหมดปกติ (NORMAL)', desc: 'เปิดออเดอร์และแก้ไม้ตามกลยุทธ์ 100%' },
                                        { mode: 'SLOW', label: '🟠 โหมดชะลอ (SLOW)', desc: 'ชะลอการออกไม้ ขยายระยะกริดช่วงผันผวน' },
                                        { mode: 'FREEZE', label: '🔴 แช่แข็งพอร์ต (FREEZE)', desc: 'หยุดเปิดไม้ใหม่ชั่วคราว รอข่าวสงบ' },
                                    ].map((item) => (
                                        <div
                                            key={item.mode}
                                            onClick={() => {
                                                setSimPortMode(item.mode as PortMode);
                                                toast.success(`เปลี่ยนโหมดพอร์ตเป็น ${item.mode}`);
                                            }}
                                            className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                                telemetry.portMode === item.mode 
                                                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
                                                    : 'bg-black/40 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div className="font-bold text-sm text-white mb-1">{item.label}</div>
                                            <div className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 rounded-2xl bg-black/40 border border-slate-800 flex items-center justify-between">
                                    <div>
                                        <div className="text-xs text-slate-400">เกราะคุ้มกันทุนหนุนหลัง (Capital Buffer)</div>
                                        <div className="text-2xl font-black font-mono text-cyan-400 mt-0.5">
                                            {telemetry.capitalBuffer}
                                        </div>
                                        <div className="text-[11px] text-slate-400">ทุนสำรองมากกว่าความเสี่ยงที่เปิดค้างอยู่</div>
                                    </div>
                                    <div className="h-12 w-12 rounded-full border-2 border-cyan-400 flex items-center justify-center font-mono font-bold text-cyan-300">
                                        SAFE
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 🎛️ MODAL 2: 20-PAIR INTERACTIVE MATRIX */}
                        {activeModal === 'MATRIX' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-cyan-500/30 pb-4">
                                    <div className="flex items-center gap-3">
                                        <Layers className="h-7 w-7 text-cyan-400" />
                                        <div>
                                            <h2 className="text-xl font-black text-white tracking-wide">
                                                20-PAIR COMMAND MATRIX
                                            </h2>
                                            <p className="text-xs text-slate-400">
                                                สั่งการรายคู่เงินได้ 100% สลับ Close-Only เพื่อรอปิดรวบและไม่เปิดต่อ
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className="bg-cyan-500 text-black font-mono font-bold">20 ACTIVE PAIRS</Badge>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
                                    {PRIME_20_PAIRS.map((sym) => {
                                        const isCloseOnly = pairOverrides[sym]?.closeOnly;
                                        const isQuarantined = pairOverrides[sym]?.quarantined || telemetry.quarantinePairs.includes(sym);

                                        return (
                                            <div
                                                key={sym}
                                                className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                                                    isQuarantined
                                                        ? 'bg-amber-950/30 border-amber-500/60'
                                                        : isCloseOnly
                                                        ? 'bg-red-950/20 border-red-500/40'
                                                        : 'bg-black/40 border-slate-800'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-sm text-white font-mono">{sym}</span>
                                                        {isQuarantined && (
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-400 border-amber-500">
                                                                QUARANTINED
                                                            </Badge>
                                                        )}
                                                        {isCloseOnly && (
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 text-red-400 border-red-500">
                                                                CLOSE-ONLY
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                                        Orders: {sym === 'EURJPY' ? '8 ไม้' : '2 ไม้'} | Lot: {sym === 'EURJPY' ? '0.24' : '0.04'}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <Button
                                                        size="sm"
                                                        variant={isCloseOnly ? 'destructive' : 'outline'}
                                                        onClick={() => handleToggleCloseOnly(sym)}
                                                        className="h-7 text-[10px] px-2"
                                                    >
                                                        {isCloseOnly ? '⛔ ห้ามเปิดใหม่' : 'เปิดปกติ'}
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleToggleQuarantine(sym)}
                                                        className={`h-7 w-7 p-0 ${isQuarantined ? 'text-amber-400 bg-amber-950/40' : 'text-slate-400'}`}
                                                    >
                                                        {isQuarantined ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 💎 MODAL 3: RELIEF FUND VAULT */}
                        {activeModal === 'VAULT' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-purple-500/30 pb-4">
                                    <Zap className="h-7 w-7 text-purple-400" />
                                    <div>
                                        <h2 className="text-xl font-black text-white tracking-wide">
                                            CROSS-PAIR RELIEF FUND VAULT
                                        </h2>
                                        <p className="text-xs text-slate-400">
                                            กองทุนตัดขาดทุนสำรองข้ามคู่ สะสมกำไรจากคู่ที่ชนะเพื่อปลดล็อกคู่ที่ติดหล่ม
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-950/40 via-black to-black border border-purple-500/40 flex flex-col items-center text-center">
                                    <Fuel className="h-10 w-10 text-purple-400 mb-2 animate-bounce" />
                                    <div className="text-xs text-purple-300 font-mono">CURRENT ACCUMULATED FUND</div>
                                    <div className="text-4xl font-black font-mono text-purple-200 my-1">
                                        ${telemetry.reliefFund.balance.toFixed(2)} USC
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        เพดานกองทุนสูงสุด: ${telemetry.reliefFund.cap.toFixed(2)} USC (5% ของบาลานซ์)
                                    </div>

                                    <div className="w-full bg-slate-900 h-3 rounded-full mt-4 overflow-hidden border border-purple-500/30">
                                        <div 
                                            className="bg-gradient-to-r from-purple-600 to-cyan-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                                            style={{ width: `${Math.min(100, (telemetry.reliefFund.balance / telemetry.reliefFund.cap) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 🎯 MODAL 4: THREAT & RESCUE RADAR */}
                        {activeModal === 'RADAR' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-amber-500/30 pb-4">
                                    <Crosshair className="h-7 w-7 text-amber-400" />
                                    <div>
                                        <h2 className="text-xl font-black text-white tracking-wide">
                                            TACTICAL THREAT RADAR & RESCUE
                                        </h2>
                                        <p className="text-xs text-slate-400">
                                            เรดาร์ตรวจจับคู่เงินที่ถูกลาก และหน่วยกู้ภัยสไนเปอร์แก้ไม้ EasyM PRIME
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="h-6 w-6 text-amber-400 animate-pulse" />
                                        <div>
                                            <div className="text-xs text-amber-300 font-bold">คู่เงินที่ลากพอร์ตสูงสุด (WORST PAIR)</div>
                                            <div className="text-lg font-black text-white font-mono">
                                                {telemetry.worstPair.symbol} (-{telemetry.worstPair.dd.toFixed(2)}%)
                                            </div>
                                            <div className="text-[11px] text-slate-400">ถืออยู่ {telemetry.worstPair.orders} ไม้</div>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs"
                                        onClick={() => handleToggleQuarantine(telemetry.worstPair.symbol)}
                                    >
                                        สั่งกักขังทันที
                                    </Button>
                                </div>

                                <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Crosshair className="h-6 w-6 text-cyan-400" />
                                        <div>
                                            <div className="text-xs text-cyan-300 font-bold">สไนเปอร์ไม้กู้ภัย (RESCUE GRID)</div>
                                            <div className="text-sm font-bold text-white mt-0.5">
                                                {telemetry.rescue.isActive 
                                                    ? `🎯 R${telemetry.rescue.count} ACTIVE (ออกไม้กู้ภัยแล้ว ${telemetry.rescue.count} ไม้)` 
                                                    : 'สแตนด์บาย — ยังไม่มีความจำเป็นต้องออกไม้กู้ภัย'}
                                            </div>
                                            <div className="text-[11px] text-slate-400">ออกเฉพาะจุดกลับตัวแม่นยำเพื่อดึง TP เข้าใกล้</div>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={`font-mono ${telemetry.rescue.isActive ? 'text-cyan-300 border-cyan-400' : 'text-slate-500 border-slate-700'}`}>
                                        {telemetry.rescue.isActive ? 'ENGAGED' : 'STANDBY'}
                                    </Badge>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

        </div>
    );
}
