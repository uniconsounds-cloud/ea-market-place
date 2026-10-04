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
    CheckCircle2, 
    Fuel, 
    TrendingUp, 
    Clock, 
    Eye,
    LifeBuoy
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
    const [loadingLive, setLoadingLive] = useState(true);

    // ─── Simulation Sandbox States ───
    const [isSimMode, setIsSimMode] = useState(false);
    const [simPortMode, setSimPortMode] = useState<PortMode>('NORMAL');
    const [simScenario, setSimScenario] = useState<string>('normal');
    const [activeModal, setActiveModal] = useState<ActiveModal>(null);

    // Dynamic states for 20 pairs controls
    const [pairOverrides, setPairOverrides] = useState<Record<string, { closeOnly?: boolean; quarantined?: boolean }>>({
        EURJPY: { closeOnly: true, quarantined: true }
    });

    // Confirmation modal for extreme actions
    const [confirmCloseBasket, setConfirmCloseBasket] = useState<string | null>(null);

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

    // Fetch live data for port 97053088 and setup realtime listener
    useEffect(() => {
        if (loadingAuth) return;

        const fetchLiveData = async () => {
            setLoadingLive(true);
            try {
                const { data: orders } = await supabase
                    .from('farm_active_orders')
                    .select('*')
                    .eq('port_number', portNumber);

                const { data: status } = await supabase
                    .from('farm_port_status')
                    .select('*')
                    .eq('port_number', portNumber)
                    .single();

                setLiveOrders(orders || []);
                setLivePortStatus(status || {
                    balance: 10000,
                    equity: 9850,
                    account_type: 'USC',
                    daily_max_drawdown: 1.5,
                    today_pnl: 145.20,
                    today_closed_lots: 0.85
                });
            } catch (err) {
                console.error('Error loading live port:', err);
            } finally {
                setLoadingLive(false);
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadingAuth]);

    // ─── Derived Telemetry Data (Merged with Simulation if Active) ───
    const telemetry = useMemo(() => {
        if (!isSimMode) {
            // Live Real Data from port 97053088
            const bal = Number(livePortStatus?.balance) || 10000;
            const eq = Number(livePortStatus?.equity) || 9850;
            const floatPnl = eq - bal;
            const ddPct = bal > 0 ? Math.max(0, ((bal - eq) / bal) * 100) : 0;
            const todayPnl = Number(livePortStatus?.today_pnl) || 0;

            return {
                isSafeLiquidation: false,
                portMode: 'NORMAL' as PortMode,
                balance: bal,
                equity: eq,
                floatingPnl: floatPnl,
                drawdownPercent: ddPct,
                todayPnl: todayPnl,
                todayClosedLots: Number(livePortStatus?.today_closed_lots) || 0,
                dailyMaxDrawdown: Number(livePortStatus?.daily_max_drawdown) || 0,
                worstPair: { symbol: 'EURJPY', dd: 1.85, orders: liveOrders.filter(o => (o.symbol || '').includes('EURJPY')).length || 2 },
                reliefFund: { balance: 42.50, cap: Math.round(bal * 0.05), used: 0 },
                rescue: { isActive: false, count: 0, ddPct: 0 },
                quarantinePairs: [] as string[],
                capitalBuffer: '1.2x',
                orders: liveOrders
            };
        }

        // ─── Simulation Presets ───
        const baseBal = 10000;
        let eq = 9750;
        let dd = 2.5;
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
            dd = 26.2;
            worst = { symbol: 'EURJPY', dd: 26.23, orders: 8 };
            quarantine = ['EURJPY', 'GBPJPY'];
            bufferMult = '1.05x';
        } else if (simScenario === 'rescue') {
            eq = 8650;
            dd = 13.5;
            worst = { symbol: 'GBPUSD', dd: 12.8, orders: 6 };
            rescue = { isActive: true, count: 2, ddPct: 2.32 };
        } else if (simScenario === 'relief') {
            eq = 9120;
            dd = 8.8;
            fundBalance = 120.00;
            fundUsed = 35.50;
        } else if (simScenario === 'safe_liquidation') {
            isSafeLiq = true;
            eq = 9450;
            dd = 5.5;
            worst = { symbol: 'EURUSD', dd: 3.2, orders: 3 };
        }

        return {
            isSafeLiquidation: isSafeLiq,
            portMode: simPortMode,
            balance: baseBal,
            equity: eq,
            floatingPnl: eq - baseBal,
            drawdownPercent: dd,
            todayPnl: 285.50,
            todayClosedLots: 1.45,
            dailyMaxDrawdown: dd,
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

    // ─── 25-Tree Plot Calculation ───
    const plot = useMemo(() => {
        const trees = Array.from({ length: 25 }).map((_, i) => {
            const row = Math.floor(i / 5);
            const col = i % 5;
            let level = 4;
            if (telemetry.drawdownPercent > 20) {
                if (row >= 3) level = 1;
                else if (row >= 2) level = 2;
                else level = 3;
            } else if (telemetry.drawdownPercent > 10) {
                if (row >= 3) level = 2;
                else level = 3;
            } else if (telemetry.drawdownPercent > 3) {
                if (row === 4) level = 3;
            }

            const assets: any[] = [];
            if (i === 12 && telemetry.orders.length > 0) {
                telemetry.orders.slice(0, 5).forEach((ord, aIdx) => {
                    assets.push({
                        ticketId: ord.ticket_id || aIdx,
                        slotId: aIdx % 15,
                        type: ord.profit >= 0 ? 'PROFIT_FRUIT' : 'OPEN_LOTUS'
                    });
                });
            }

            return { id: i, level, assets };
        });

        return { trees };
    }, [telemetry.drawdownPercent, telemetry.orders]);

    // Handlers for pair actions
    const handleToggleCloseOnly = (sym: string) => {
        setPairOverrides(prev => ({
            ...prev,
            [sym]: {
                ...prev[sym],
                closeOnly: !prev[sym]?.closeOnly
            }
        }));
        const nextVal = !pairOverrides[sym]?.closeOnly;
        toast.info(`${sym}: สลับสถานะเป็น ${nextVal ? '⛔ CLOSE-ONLY (รอปิดรวบ ไม่เปิดใหม่)' : '✅ ACTIVE (เทรดปกติ)'}`);
    };

    const handleToggleQuarantine = (sym: string) => {
        setPairOverrides(prev => ({
            ...prev,
            [sym]: {
                ...prev[sym],
                quarantined: !prev[sym]?.quarantined
            }
        }));
        const nextVal = !pairOverrides[sym]?.quarantined;
        toast.warning(`${sym}: ${nextVal ? '🔒 สั่งขังคู่เงิน (FORCE QUARANTINE) หยุดถมไม้ทันที' : '🔓 ปลดปล่อยออกจากห้องขัง'}`);
    };

    const handleCloseBasket = (sym: string) => {
        setConfirmCloseBasket(null);
        toast.success(`⚡ ส่งคำสั่งปิดรวบทุกไม้ของ ${sym} สำเร็จ! EA กำลังดำเนินการ`);
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
        <div className="flex flex-col min-h-screen w-full bg-[#07090e] text-[#e2e8f0] font-sans select-none relative overflow-x-hidden">
            
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🚀 TOP SIMULATOR & CONTROL BAR (ADMIN LAB EXCLUSIVE)             */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <header className="sticky top-0 z-[120] w-full bg-[#0d121d]/95 backdrop-blur-xl border-b border-cyan-500/20 px-3 sm:px-6 py-2 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
                    
                    {/* Left: Branding & Port Status */}
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 p-[1.5px] shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                            <div className="h-full w-full bg-[#0d121d] rounded-[10px] flex items-center justify-center">
                                <Cpu className="h-5 w-5 text-cyan-400 animate-pulse" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-black text-sm tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-cyan-200 to-amber-200">
                                    EASYM PRIME LAB
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-purple-500/40 text-purple-300 bg-purple-950/30">
                                    V2.0-PRIME
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500/40 text-cyan-300 bg-cyan-950/30 font-mono">
                                    PORT: {portNumber}
                                </Badge>
                            </div>
                            <p className="text-[11px] text-slate-400">
                                โหมดทดสอบแดชบอร์ดเฉพาะ <span className="text-amber-400 font-mono">juntarasate@gmail.com</span>
                            </p>
                        </div>
                    </div>

                    {/* Middle: Mode Switch (Live vs Simulator) */}
                    <div className="flex items-center bg-black/50 p-1 rounded-xl border border-slate-800">
                        <button
                            onClick={() => { setIsSimMode(false); toast.info('📡 เชื่อมต่อข้อมูลสดเรียลไทม์จากพอร์ต 97053088'); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                !isSimMode 
                                    ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.6)] font-black' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <span className="relative flex h-2 w-2">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${!isSimMode ? 'bg-black' : 'bg-green-400'} opacity-75`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${!isSimMode ? 'bg-black' : 'bg-green-500'}`}></span>
                            </span>
                            พอร์ตจริง 97053088 (Live)
                        </button>
                        <button
                            onClick={() => { setIsSimMode(true); toast.success('🧪 เปิดโหมดจำลองสถานการณ์ Sandbox'); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                isSimMode 
                                    ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.6)] font-black' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Sliders className="h-3.5 w-3.5" />
                            โหมดจำลอง (Simulator Sandbox)
                        </button>
                    </div>

                    {/* Right: Quick Scenario Selector (Visible in Sim Mode) */}
                    {isSimMode && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-mono text-purple-300 mr-1">SCENARIOS:</span>
                            <Button
                                size="sm"
                                variant={simScenario === 'normal' ? 'default' : 'outline'}
                                onClick={() => setSimScenario('normal')}
                                className="h-7 text-xs bg-slate-800 border-slate-700 hover:bg-slate-700"
                            >
                                🌱 ปกติ
                            </Button>
                            <Button
                                size="sm"
                                variant={simScenario === 'quarantine' ? 'default' : 'outline'}
                                onClick={() => setSimScenario('quarantine')}
                                className="h-7 text-xs bg-amber-950/50 text-amber-300 border-amber-800 hover:bg-amber-900/50"
                            >
                                🔒 กักขัง (EJ -26%)
                            </Button>
                            <Button
                                size="sm"
                                variant={simScenario === 'rescue' ? 'default' : 'outline'}
                                onClick={() => setSimScenario('rescue')}
                                className="h-7 text-xs bg-cyan-950/50 text-cyan-300 border-cyan-800 hover:bg-cyan-900/50"
                            >
                                🎯 สไนเปอร์ R2
                            </Button>
                            <Button
                                size="sm"
                                variant={simScenario === 'relief' ? 'default' : 'outline'}
                                onClick={() => setSimScenario('relief')}
                                className="h-7 text-xs bg-emerald-950/50 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50"
                            >
                                💎 กองทุนตัดขาดทุน
                            </Button>
                            <Button
                                size="sm"
                                variant={simScenario === 'safe_liquidation' ? 'default' : 'outline'}
                                onClick={() => setSimScenario('safe_liquidation')}
                                className="h-7 text-xs bg-red-950/80 text-red-300 border-red-600 hover:bg-red-900 font-bold animate-pulse"
                            >
                                🛡️ หมดอายุ (Safe Liq)
                            </Button>
                        </div>
                    )}
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🛡️ SAFE LIQUIDATION PROTOCOL FORCEFIELD ALERT BANNER             */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {telemetry.isSafeLiquidation && (
                <div className="w-full bg-gradient-to-r from-red-950/90 via-amber-950/90 to-red-950/90 border-b border-red-500/50 py-2.5 px-4 text-center z-50 animate-fade-in shadow-[0_0_25px_rgba(239,68,68,0.4)]">
                    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <ShieldAlert className="h-5 w-5 text-red-400 animate-bounce" />
                            <div className="text-left">
                                <div className="text-xs sm:text-sm font-bold text-red-200">
                                    [SAFE LIQUIDATION PROTOCOL ACTIVE] สัญญา EasyM PRIME หมดอายุแล้ว
                                </div>
                                <div className="text-[11px] text-amber-200/90">
                                    ระบบกางเกราะป้องกัน ดูแลเฝ้าปิดรวบออเดอร์เดิมให้ปลอดภัย ไม่เปิดไม้ใหม่ และไม่ปล่อยพอร์ตทิ้งขว้าง
                                </div>
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
            {/* 🌳 MAIN STAGE: CLASSIC LIVING TREE FARM CANVAS                   */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <div className="flex-1 w-full relative flex items-center justify-center min-h-[640px] select-none">
                
                {/* Background: Cybernetic Sky & Grid Atmosphere */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#131b2e] via-[#0c111d] to-[#06080d] pointer-events-none" />
                
                {/* Cyber Perspective Grid Overlay */}
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#06b6d415_1px,transparent_1px),linear-gradient(to_bottom,#06b6d415_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

                {/* Top Farm HUD Bar (Reusing Classic Luxury Analog HUD) */}
                <div className="absolute top-0 left-0 w-full z-40">
                    <FarmHud
                        title={`EASYM PRIME COMMAND CENTER (${portNumber})`}
                        portNumber={portNumber}
                        balance={telemetry.balance}
                        equity={telemetry.equity}
                        floatingPnl={telemetry.floatingPnl}
                        totalStandardLots={0.88}
                        accountType="USC"
                        assetType="FOREX"
                        buyCount={5}
                        sellCount={3}
                        buyPnl={telemetry.floatingPnl > 0 ? telemetry.floatingPnl : 15}
                        sellPnl={telemetry.floatingPnl < 0 ? telemetry.floatingPnl : -45}
                        todayProfit={telemetry.todayPnl}
                        todayClosedLots={telemetry.todayClosedLots}
                        dailyMaxDrawdown={telemetry.dailyMaxDrawdown}
                        drawdownPercent={telemetry.drawdownPercent}
                        drawdownAmount={Math.abs(telemetry.floatingPnl)}
                        systemCode="EASYM_PRIME_V2"
                    />
                </div>

                {/* 🛡️ Holographic Forcefield Dome (Visible during Safe Liquidation) */}
                {telemetry.isSafeLiquidation && (
                    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
                        <div className="w-[580px] h-[480px] rounded-[50%] border-2 border-amber-500/40 bg-gradient-to-t from-red-950/20 via-amber-500/10 to-transparent shadow-[0_0_80px_rgba(245,158,11,0.25)] animate-pulse flex items-center justify-center backdrop-blur-[0.5px]">
                            <div className="text-amber-400 font-mono text-[11px] tracking-widest uppercase bg-black/60 px-4 py-1 rounded-full border border-amber-500/40 shadow-lg">
                                🛡️ FORCEFIELD ACTIVE: CLOSE-ONLY ENGAGED
                            </div>
                        </div>
                    </div>
                )}

                {/* 25 Isometric Plots (Classic Tree Farm Engine) */}
                <div className="relative transition-all duration-500 ease-out origin-center mt-20" style={{ transform: 'scale(0.85)', width: '100px', height: '100px' }}>
                    <div className="absolute left-1/2 top-1/2 -ml-[140px] -mt-[360px]">
                        {Array.from({ length: 25 }).map((_, i) => {
                            const c = i % 5;
                            const r = Math.floor(i / 5);
                            const tZIndex = (c + r) + 20;
                            const tree = plot.trees[i];

                            return (
                                <div
                                    key={`tile_${i}`}
                                    className="absolute transition-all duration-300"
                                    style={{
                                        left: `${(c - r) * TILE_W}px`,
                                        top: `${(c + r) * TILE_H_OFFSET}px`,
                                        zIndex: tZIndex,
                                        width: '280px',
                                        height: '280px'
                                    }}
                                >
                                    <div className="absolute inset-0" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                        {/* Tree Image based on health/drawdown */}
                                        <Image
                                            src={
                                                tree.level === 4 ? '/farm/base_tree_new.png' :
                                                tree.level === 3 ? '/farm/base_tree_state2.png' :
                                                tree.level === 2 ? '/farm/base_tree_state3.png' :
                                                '/farm/base_tree_state4.png'
                                            }
                                            alt="Tree"
                                            fill
                                            className="object-contain object-bottom drop-shadow-2xl"
                                            unoptimized
                                            priority
                                        />

                                        {/* Fruits / Flowers */}
                                        {tree.assets.map((asset, aIdx) => {
                                            const slot = TREE_SLOTS[asset.slotId];
                                            return (
                                                <div
                                                    key={`asset_${aIdx}`}
                                                    className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 drop-shadow-xl animate-float-fade"
                                                    style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: tZIndex + 1 }}
                                                >
                                                    <Image
                                                        src={asset.type === 'PROFIT_FRUIT' ? '/farm/asset_b_orange.png' : '/farm/asset_a_lily.png'}
                                                        alt="Fruit"
                                                        fill
                                                        className="object-contain"
                                                        unoptimized
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* 🛸 4 FLOATING SCI-FI HUD ORBS (GAMING POPUP TRIGGERS)            */}
                {/* ═══════════════════════════════════════════════════════════════════ */}
                <div className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-4">
                    
                    {/* Orb 1: Tactical Defense HUD */}
                    <button
                        onClick={() => setActiveModal('DEFENSE')}
                        className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0f172a]/90 border border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] hover:scale-110 transition-all duration-300 backdrop-blur-md"
                    >
                        <Shield className="h-6 w-6 text-emerald-400 group-hover:animate-pulse" />
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                        </span>
                        {/* Tooltip */}
                        <span className="absolute right-16 px-2.5 py-1 bg-black/90 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            🛡️ โหมดพอร์ต & เกราะคุ้มกันทุน
                        </span>
                    </button>

                    {/* Orb 2: 20-Pair Cockpit Matrix */}
                    <button
                        onClick={() => setActiveModal('MATRIX')}
                        className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0f172a]/90 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-110 transition-all duration-300 backdrop-blur-md"
                    >
                        <Layers className="h-6 w-6 text-cyan-400 group-hover:rotate-12 transition-transform" />
                        <span className="absolute bottom-1 text-[8px] font-mono font-black text-cyan-300">20P</span>
                        {/* Tooltip */}
                        <span className="absolute right-16 px-2.5 py-1 bg-black/90 border border-cyan-500/40 rounded-lg text-xs font-mono text-cyan-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            🎛️ กระดานสั่งการ 20 คู่เงิน (Close-Only)
                        </span>
                    </button>

                    {/* Orb 3: Relief Fund Vault */}
                    <button
                        onClick={() => setActiveModal('VAULT')}
                        className="group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0f172a]/90 border border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] hover:scale-110 transition-all duration-300 backdrop-blur-md"
                    >
                        <Zap className="h-6 w-6 text-purple-400 group-hover:scale-125 transition-transform" />
                        <span className="absolute -top-1 -right-1 text-[9px] font-mono font-black bg-purple-600 text-white px-1 rounded-full">
                            ${Math.round(telemetry.reliefFund.balance)}
                        </span>
                        {/* Tooltip */}
                        <span className="absolute right-16 px-2.5 py-1 bg-black/90 border border-purple-500/40 rounded-lg text-xs font-mono text-purple-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            💎 กองทุนตัดขาดทุนข้ามคู่ (Relief Fund)
                        </span>
                    </button>

                    {/* Orb 4: Threat & Rescue Radar */}
                    <button
                        onClick={() => setActiveModal('RADAR')}
                        className={`group relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0f172a]/90 border ${
                            telemetry.quarantinePairs.length > 0 || telemetry.rescue.isActive 
                                ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse' 
                                : 'border-slate-700 shadow-[0_0_15px_rgba(0,0,0,0.5)]'
                        } hover:scale-110 transition-all duration-300 backdrop-blur-md`}
                    >
                        <Crosshair className={`h-6 w-6 ${telemetry.quarantinePairs.length > 0 ? 'text-amber-400' : 'text-slate-400'} group-hover:rotate-90 transition-transform`} />
                        {(telemetry.quarantinePairs.length > 0 || telemetry.rescue.isActive) && (
                            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                            </span>
                        )}
                        {/* Tooltip */}
                        <span className="absolute right-16 px-2.5 py-1 bg-black/90 border border-amber-500/40 rounded-lg text-xs font-mono text-amber-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            🎯 ห้องขัง (Quarantine) & สไนเปอร์กู้ภัย
                        </span>
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🎮 HOLOGRAPHIC SCI-FI MODAL OVERLAYS (FROSTED GLASSMORPHISM)     */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {activeModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
                    
                    {/* Modal Window Container */}
                    <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0a0f1d]/95 border-2 border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(6,182,212,0.3)] animate-scale-up text-slate-200">
                        
                        {/* Sci-Fi Scanline Glow Effect */}
                        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.4)_51%)] bg-[length:100%_4px] pointer-events-none rounded-3xl" />

                        {/* Top Close Button */}
                        <button
                            onClick={() => setActiveModal(null)}
                            className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-red-950/80 hover:border-red-500 border border-slate-700 transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {/* ───────────────────────────────────────────────────────── */}
                        {/* 🛡️ MODAL 1: TACTICAL DEFENSE HUD                          */}
                        {/* ───────────────────────────────────────────────────────── */}
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

                                {/* Defense Mode Switcher */}
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

                                {/* Capital Buffer Gauge */}
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

                        {/* ───────────────────────────────────────────────────────── */}
                        {/* 🎛️ MODAL 2: 20-PAIR INTERACTIVE MATRIX                    */}
                        {/* ───────────────────────────────────────────────────────── */}
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

                                {/* Pair Matrix Grid */}
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
                                                    {/* Close-Only Toggle */}
                                                    <Button
                                                        size="sm"
                                                        variant={isCloseOnly ? 'destructive' : 'outline'}
                                                        onClick={() => handleToggleCloseOnly(sym)}
                                                        className="h-7 text-[10px] px-2"
                                                    >
                                                        {isCloseOnly ? '⛔ ห้ามเปิดใหม่' : 'เปิดปกติ'}
                                                    </Button>

                                                    {/* Quarantine Button */}
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

                        {/* ───────────────────────────────────────────────────────── */}
                        {/* 💎 MODAL 3: RELIEF FUND VAULT                             */}
                        {/* ───────────────────────────────────────────────────────── */}
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

                                    {/* Progress Gauge */}
                                    <div className="w-full bg-slate-900 h-3 rounded-full mt-4 overflow-hidden border border-purple-500/30">
                                        <div 
                                            className="bg-gradient-to-r from-purple-600 to-cyan-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                                            style={{ width: `${Math.min(100, (telemetry.reliefFund.balance / telemetry.reliefFund.cap) * 100)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="p-4 rounded-2xl bg-black/40 border border-slate-800">
                                    <div className="text-xs font-bold text-white mb-2">ประวัติการปล่อยพลังงานกู้พอร์ต (Relief Cuts)</div>
                                    <div className="text-xs text-slate-400 leading-relaxed">
                                        {telemetry.reliefFund.used > 0 
                                            ? `ระบบเคยนำเงินกองทุนไปช่วยเฉือนไม้ที่ติดลบไปแล้ว ${telemetry.reliefFund.used.toFixed(2)} USC ช่วยดึง Margin คืนสำเร็จ` 
                                            : 'ยังไม่มีประวัติการตัดขาดทุนฉุกเฉิน พอร์ตกำลังทำงานอย่างราบรื่น'}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ───────────────────────────────────────────────────────── */}
                        {/* 🎯 MODAL 4: THREAT & RESCUE RADAR                         */}
                        {/* ───────────────────────────────────────────────────────── */}
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

                                {/* Worst Pair Radar Alert */}
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

                                {/* Sniper Rescue Grid Status */}
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
