'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartVortexChart, SmartChartData } from '@/components/smart-vortex-chart';
import { PnlVectorVisualizer } from '@/components/pnl-vector-visualizer';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import {
    Activity,
    ArrowLeft,
    CheckCircle2,
    Loader2,
    PauseCircle,
    PlayCircle,
    RefreshCw,
    Send,
    ShieldAlert,
    Sliders,
    Wifi,
    WifiOff,
    XCircle,
} from 'lucide-react';

interface ActiveConfig {
    first_distance: number;
    spacing: number;
    pending_per_side: number;
    initial_lot: number;
    lot_increment: number;
    target_profit: number;
    enable_cap_freeze?: boolean;
    max_both_sides_cap?: number;
    freeze_flip_max_extra?: number;
    freeze_flip_continuous?: boolean;
    stop_mode: string;
}

interface EAState {
    port_number: string;
    ea_name: string;
    ea_version: string;
    symbol: string;
    currency: string;
    balance: number;
    equity: number;
    cycle_pnl: number;
    anchor: number;
    open_pos: number;
    open_buy: number;
    open_sell: number;
    pending_buy: number;
    pending_sell: number;
    protection_frozen?: boolean;
    frozen_side?: string;
    freeze_flip_count?: number;
    conn_status: string;
    config_status: string;
    trade_status: string;
    ea_status: string;
    last_ack_seq: number;
    active_config: ActiveConfig;
    chart?: SmartChartData | null;
    last_ping: string;
}

function SmartEACockpitContent() {
    const searchParams = useSearchParams();
    const initialPortParam = searchParams.get('port') || '';

    const [portInput, setPortInput] = useState(initialPortParam);
    const [activePort, setActivePort] = useState(initialPortParam);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [eaState, setEaState] = useState<EAState | null>(null);
    const [lastCommand, setLastCommand] = useState<any>(null);
    const [latestVersion, setLatestVersion] = useState<string>('1.10');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [confirmCloseAll, setConfirmCloseAll] = useState(false);
    const [pnlJitter, setPnlJitter] = useState(0);
    const [sessionOpenedAt, setSessionOpenedAt] = useState<number>(() => Date.now());
    const [clockNow, setClockNow] = useState<Date>(() => new Date());

    // Form fields
    const [firstDistance, setFirstDistance] = useState('100');
    const [spacing, setSpacing] = useState('100');
    const [pendingPerSide, setPendingPerSide] = useState('10');
    const [initialLot, setInitialLot] = useState('0.01');
    const [lotIncrement, setLotIncrement] = useState('0.01');
    const [targetProfit, setTargetProfit] = useState('20');
    const [enableCapFreeze, setEnableCapFreeze] = useState(true);
    const [maxBothSidesCap, setMaxBothSidesCap] = useState('7');
    const [freezeFlipMaxExtra, setFreezeFlipMaxExtra] = useState('3');
    const [freezeFlipContinuous, setFreezeFlipContinuous] = useState(true);
    const [formInitialized, setFormInitialized] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setClockNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.title = activePort ? `Smart EA #${activePort}` : 'Smart EA Cockpit';
        }
    }, [activePort]);

    useEffect(() => {
        if (initialPortParam) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('smart_ea_port', initialPortParam);
            }
            return;
        }
        const saved = typeof window !== 'undefined' ? localStorage.getItem('smart_ea_port') : '';
        if (saved) {
            setPortInput(saved);
            setActivePort(saved);
            return;
        }
        // Auto-detect active Smart EA port from logged-in user's licenses
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('account_number, products(product_key, name, strategy)')
                    .eq('user_id', user.id)
                    .eq('is_active', true);
                const smartLic = (licenses || []).find((l: any) => {
                    const key = (l.products?.product_key || '').toUpperCase();
                    const name = (l.products?.name || '').toLowerCase();
                    return key.startsWith('SMART-') || name.includes('smart vortex') || l.products?.strategy === 'Smart EA';
                });
                if (smartLic?.account_number) {
                    setPortInput(smartLic.account_number);
                    setActivePort(smartLic.account_number);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('smart_ea_port', smartLic.account_number);
                    }
                }
            } catch {
                // Ignore auto-detect error
            }
        })();
    }, [initialPortParam]);

    const fetchTelemetry = useCallback(async (portToFetch: string) => {
        if (!portToFetch) return;
        try {
            const res = await fetch(`/api/smart-ea/control?port=${encodeURIComponent(portToFetch)}`, {
                cache: 'no-store',
            });
            const data = await res.json();
            if (data.success) {
                setIsOnline(Boolean(data.is_online));
                setEaState(data.state || null);
                setLastCommand(data.command || null);
                if (data.latest_version) setLatestVersion(String(data.latest_version));
                if (data.download_url) setDownloadUrl(String(data.download_url));

                // Populate form once from live EA or saved command
                if (!formInitialized) {
                    const src = data.command?.command_seq > 0
                        ? data.command
                        : data.state?.active_config;
                    if (src) {
                        if (src.first_distance !== undefined) setFirstDistance(String(src.first_distance));
                        if (src.spacing !== undefined) setSpacing(String(src.spacing));
                        if (src.pending_per_side !== undefined) setPendingPerSide(String(src.pending_per_side));
                        if (src.initial_lot !== undefined) setInitialLot(String(src.initial_lot));
                        if (src.lot_increment !== undefined) setLotIncrement(String(src.lot_increment));
                        if (src.target_profit !== undefined) setTargetProfit(String(src.target_profit));
                        if (src.enable_cap_freeze !== undefined) setEnableCapFreeze(Boolean(src.enable_cap_freeze));
                        if (src.max_both_sides_cap !== undefined) setMaxBothSidesCap(String(src.max_both_sides_cap));
                        if (src.freeze_flip_max_extra !== undefined) setFreezeFlipMaxExtra(String(src.freeze_flip_max_extra));
                        if (src.freeze_flip_continuous !== undefined) setFreezeFlipContinuous(Boolean(src.freeze_flip_continuous));
                        setFormInitialized(true);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to poll Smart EA:', err);
        }
    }, [formInitialized]);

    useEffect(() => {
        if (!activePort) return;
        setSessionOpenedAt(Date.now());
        fetchTelemetry(activePort);
        // Prime-standard 15s polling when cockpit is open (also keeps viewer-ping alive for 15s EA sync)
        const timer = setInterval(() => fetchTelemetry(activePort), 15000);
        return () => clearInterval(timer);
    }, [activePort, fetchTelemetry]);

    const isWaitingFreshData = Boolean(
        activePort &&
        eaState &&
        (
            !isOnline ||
            !eaState.chart ||
            (((eaState as any)?.sync_interval_sec ?? 15) > 30 &&
                new Date(eaState.last_ping).getTime() < sessionOpenedAt)
        )
    );

    // Reset live profit jitter on each real MT5 snapshot & pulse gently when positions are open
    useEffect(() => {
        setPnlJitter(0);
    }, [eaState?.last_ping, eaState?.cycle_pnl]);

    useEffect(() => {
        if (!isOnline || isWaitingFreshData || !eaState || eaState.open_pos <= 0) {
            setPnlJitter(0);
            return;
        }
        const scale = Math.max(0.03, Math.min(0.35, eaState.open_pos * 0.04));
        const timer = setInterval(() => {
            setPnlJitter((prev) => {
                const next = prev + (Math.random() - 0.49) * scale;
                const cap = scale * 4;
                if (next > cap) return cap * 0.8;
                if (next < -cap) return -cap * 0.8;
                return next;
            });
        }, 650);
        return () => clearInterval(timer);
    }, [isOnline, isWaitingFreshData, eaState?.open_pos, eaState?.last_ping]);

    const handleConnectPort = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = portInput.trim();
        if (!clean) {
            toast.error('กรุณากรอกหมายเลขพอร์ต MT5');
            return;
        }
        if (typeof window !== 'undefined') {
            localStorage.setItem('smart_ea_port', clean);
        }
        setFormInitialized(false);
        setActivePort(clean);
        setLoading(true);
        fetchTelemetry(clean).finally(() => setLoading(false));
    };

    const sendCommand = async (payload: Record<string, any>, successMsg: string) => {
        if (!activePort) {
            toast.error('กรุณาเชื่อมต่อหมายเลขพอร์ตก่อน');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/smart-ea/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port_number: activePort, ...payload }),
            });
            const data = await res.json();
            if (data.success) {
                setLastCommand(data.command);
                toast.success(successMsg);
                setTimeout(() => fetchTelemetry(activePort), 1000);
            } else {
                toast.error(data.error || 'ส่งคำสั่งไม่สำเร็จ');
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        } finally {
            setSending(false);
        }
    };

    const handleUpdateSettings = (e: React.FormEvent) => {
        e.preventDefault();
        const fDist = parseInt(firstDistance, 10);
        const spc = parseInt(spacing, 10);
        const pend = parseInt(pendingPerSide, 10);
        const lot = parseFloat(initialLot);
        const inc = parseFloat(lotIncrement);
        const tp = parseFloat(targetProfit);
        const cap = parseInt(maxBothSidesCap, 10);
        const fmax = parseInt(freezeFlipMaxExtra, 10);

        if (isNaN(fDist) || fDist < 10 || isNaN(spc) || spc < 10 || isNaN(pend) || pend < 1 ||
            isNaN(lot) || lot <= 0 || isNaN(inc) || inc < 0 || isNaN(tp) || isNaN(cap) || cap < 0 || cap > 50 ||
            isNaN(fmax) || fmax < 0 || fmax > 50) {
            toast.error('กรุณาตรวจสอบค่าตัวเลขที่กรอกให้ถูกต้อง');
            return;
        }

        sendCommand(
            {
                first_distance: fDist,
                spacing: spc,
                pending_per_side: pend,
                initial_lot: lot,
                lot_increment: inc,
                target_profit: tp,
                enable_cap_freeze: enableCapFreeze,
                max_both_sides_cap: cap,
                freeze_flip_max_extra: fmax,
                freeze_flip_continuous: freezeFlipContinuous,
                close_all: false,
            },
            'ส่งค่าใหม่ไปยัง EA แล้ว! ระบบกำลังลบ Pending เก่าและสร้างระยะใหม่...'
        );
    };

    const isPendingAck = Boolean(
        lastCommand?.command_seq &&
        eaState &&
        Number(lastCommand.command_seq) > Number(eaState.last_ack_seq || 0)
    );

    // Active control state: reflects user's queued command immediately, then synced MT5 state
    const effectiveStopMode = isPendingAck && lastCommand?.stop_mode
        ? String(lastCommand.stop_mode)
        : (eaState?.active_config?.stop_mode || eaState?.trade_status || 'RUN');

    const isPauseNextActive = effectiveStopMode === 'PAUSE_NEXT' || eaState?.trade_status === 'PAUSED_NEXT';
    const isFreezeStopActive = effectiveStopMode === 'FREEZE_STOP' || eaState?.trade_status === 'FREEZE_STOP';
    const isStoppedActive = effectiveStopMode === 'STOPPED' || eaState?.trade_status === 'STOPPED';
    // EA is running unless explicitly paused or stopped (FROZEN_BUY/SELL is active cap protection while EA is running)
    const isRunning = !isPauseNextActive && !isFreezeStopActive && !isStoppedActive;

    const cur = eaState?.currency || 'USD';
    const liveCyclePnl = (eaState?.cycle_pnl || 0) + pnlJitter;
    const liveEquity = (eaState?.equity || 0) + pnlJitter;
    const activeTp = eaState?.active_config?.target_profit ?? (parseFloat(targetProfit) || 20);
    const activeCap = eaState?.active_config?.max_both_sides_cap ?? (parseInt(maxBothSidesCap, 10) || 7);

    // Semantic numeric version comparison: > 0 means latest > current
    const compareVersions = (a: string, b: string) => {
        const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
        const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const diff = (pa[i] || 0) - (pb[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    };
    const needsUpdate = Boolean(eaState?.ea_version && compareVersions(latestVersion, eaState.ea_version) > 0);

    // Prime-style Header calculations (75% Balance Anchor + 05:00 BKK Market Timeline)
    const balanceVal = eaState?.balance || 0;
    const safeBalance = Math.max(1, balanceVal);
    const pnlPct = balanceVal > 0 ? (liveCyclePnl / balanceVal) * 100 : 0;

    // 1-Day Trading Timeline (05:00 AM Bangkok -> 05:00 AM next day): shrinks from left to right
    const bkkStr = clockNow.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const [bkkH, bkkM] = bkkStr.split(':').map((v) => parseInt(v, 10) || 0);
    const minsSince0500 = ((bkkH * 60 + bkkM) - 300 + 1440) % 1440;
    const marketElapsedPct = (minsSince0500 / 1440) * 100;
    const remainingMarketPct = Math.max(0, 100 - marketElapsedPct);

    const secAngle = clockNow.getSeconds() * 6;
    const minAngle = clockNow.getMinutes() * 6 + clockNow.getSeconds() * 0.1;
    const hrAngle = (clockNow.getHours() % 12) * 30 + clockNow.getMinutes() * 0.5;

    return (
        <div className="min-h-screen bg-[#040711] text-slate-100">
        <div className="w-full max-w-6xl mx-auto px-1.5 sm:px-2.5 py-1 sm:py-2 space-y-1.5 sm:space-y-2">
            {/* Minimal Top Cockpit Header: Back to Dashboard & Status Tag */}
            <div className="flex items-center justify-between pb-0.5 pt-0.5">
                <a
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 text-xs font-mono transition-all duration-200 active:scale-95 shadow-sm"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>กลับแดชบอร์ด</span>
                </a>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-[11px] font-mono font-semibold tracking-wider text-cyan-400/90 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        SMART EA COCKPIT
                    </span>
                </div>
            </div>
            {!activePort ? (
                <Card className="border-cyan-500/30 bg-[#070b16]/95 text-slate-100">
                    <CardContent className="py-12 text-center space-y-4">
                        <Activity className="w-10 h-10 mx-auto text-cyan-400" />
                        <h3 className="text-base font-mono font-bold text-cyan-300">CONNECT SMART VORTEX PORT</h3>
                        <form onSubmit={handleConnectPort} className="flex items-center justify-center gap-2 max-w-sm mx-auto">
                            <Input
                                placeholder="PORT # (e.g. 58018897)"
                                value={portInput}
                                onChange={(e) => setPortInput(e.target.value)}
                                className="font-mono text-xs bg-slate-950/90 border-cyan-500/30 text-cyan-100"
                            />
                            <Button type="submit" disabled={loading} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'LINK'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* 🎛️ Unified Top Cockpit Card: Clock + Telemetry + Version + Tactical Status (LINK / CFG / MODE) */}
                    <div className={`rounded-xl border border-cyan-500/30 bg-gradient-to-r from-[#070d1c] via-[#061224] to-[#070d1c] p-2.5 sm:p-3 shadow-[0_0_24px_rgba(6,182,212,0.12)] space-y-2 transition-all duration-500 ${isWaitingFreshData ? 'opacity-70 grayscale animate-pulse' : ''}`}>
                        {/* 1. CLOCK & TELEMETRY ROW */}
                        <div className="flex items-center gap-2.5 sm:gap-3.5">
                            {/* Analog Live Clock */}
                            <svg viewBox="0 0 60 60" className="w-11 h-11 sm:w-13 sm:h-13 shrink-0">
                                <circle cx="30" cy="30" r="27" fill="#050811" stroke="#22d3ee" strokeWidth="1.5" opacity="0.85" />
                                <circle cx="30" cy="30" r="23" fill="none" stroke="#1e293b" strokeWidth="1" />
                                <text x="30" y="13" textAnchor="middle" fontSize="6.5" fill="#22d3ee" fontFamily="monospace">12</text>
                                <text x="30" y="52" textAnchor="middle" fontSize="6.5" fill="#22d3ee" fontFamily="monospace">6</text>
                                <line x1="30" y1="30" x2="30" y2="16" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" transform={`rotate(${hrAngle} 30 30)`} />
                                <line x1="30" y1="30" x2="30" y2="11" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${minAngle} 30 30)`} />
                                <line x1="30" y1="30" x2="30" y2="9" stroke="#f43f5e" strokeWidth="0.9" strokeLinecap="round" transform={`rotate(${secAngle} 30 30)`} />
                                <circle cx="30" cy="30" r="2.2" fill="#22d3ee" />
                            </svg>

                            {/* Left & Right Telemetry */}
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-start justify-between gap-2 font-mono">
                                    <div className="min-w-0">
                                        <div className="text-xs sm:text-sm font-bold tracking-wider text-cyan-300 truncate">
                                            {eaState?.symbol || 'XAUUSD'} | {activePort} | {cur}
                                        </div>
                                        <div className="text-[11px] sm:text-xs text-slate-400">
                                            EQUITY{' '}
                                            <strong className="text-sky-400 tabular-nums">
                                                {eaState ? liveEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="text-[10px] sm:text-xs text-slate-400 tabular-nums">
                                            BALANCE{' '}
                                            <strong className="text-slate-100">
                                                {eaState ? balanceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
                                            </strong>
                                        </div>
                                        <div className={`text-xs sm:text-sm font-bold tabular-nums ${liveCyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {eaState ? `${liveCyclePnl >= 0 ? '+' : ''}${liveCyclePnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)` : '---'}
                                        </div>
                                    </div>
                                </div>

                                {/* THE UNIFIED BAR: Balance as Anchor (75% mark) */}
                                <div className="relative h-2 sm:h-2.5 w-full bg-black/50 rounded-full border border-cyan-500/25 p-0.5 overflow-hidden shadow-inner">
                                    {/* Target Point: Balance Marker (WHITE at 75%) */}
                                    <div className="absolute left-[75%] top-0 bottom-0 w-[1px] bg-white/60 z-20" />

                                    {liveCyclePnl < 0 ? (
                                        <>
                                            <div
                                                className="h-full bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] rounded-l-full transition-all duration-1000"
                                                style={{ width: `${Math.max(0, 75 + (liveCyclePnl / safeBalance) * 75)}%` }}
                                            />
                                            <div
                                                className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-red-600/60 to-red-400 transition-all duration-1000"
                                                style={{
                                                    left: `${Math.max(0, 75 + (liveCyclePnl / safeBalance) * 75)}%`,
                                                    width: `${Math.min(75, Math.abs((liveCyclePnl / safeBalance) * 75))}%`,
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <div
                                                className="h-full bg-gradient-to-r from-[#0284c7] to-[#38bdf8] rounded-l-full transition-all duration-1000"
                                                style={{ width: '75%' }}
                                            />
                                            <div
                                                className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-[#4de180] to-green-300 shadow-[0_0_8px_rgba(77,225,128,0.3)] transition-all duration-1000"
                                                style={{
                                                    left: '75%',
                                                    width: `${Math.min(25, (liveCyclePnl / safeBalance) * 75)}%`,
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* Glowing tip at current Equity */}
                                    <div
                                        className={`absolute top-0 bottom-0 w-1 blur-[2px] z-30 transition-all duration-1000 ${liveCyclePnl >= 0 ? 'bg-[#38bdf8]' : 'bg-red-400'}`}
                                        style={{
                                            left: `${Math.max(0, Math.min(100, 75 + (liveCyclePnl / safeBalance) * 75))}%`,
                                            opacity: 0.6,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. 1-Day Trading Timeline Bar */}
                        <div className="relative w-full bg-black/40 border-y border-cyan-500/20 py-0.5 sm:py-1 rounded">
                            <div className="px-2 relative">
                                <div className="h-1 sm:h-1.5 w-full bg-white/5 rounded-full relative overflow-hidden">
                                    <div
                                        className="absolute top-0 right-0 h-full bg-gradient-to-r from-cyan-300/30 via-cyan-400/60 to-cyan-500/90 transition-all duration-1000 rounded-full"
                                        style={{ width: `${remainingMarketPct}%` }}
                                    />
                                </div>
                                <div className="absolute inset-0 px-2 flex justify-between items-center pointer-events-none">
                                    {Array.from({ length: 25 }).map((_, i) => (
                                        <div key={`h_${i}`} className={`h-1.5 sm:h-2 w-[1px] ${i % 6 === 0 ? 'bg-white/40' : 'bg-white/10'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3. INTEGRATED SUB-BAR: EA VERSION & TACTICAL STATUS RAIL (INSIDE SAME FRAME) */}
                        <div className="pt-1.5 border-t border-cyan-500/20 flex flex-wrap items-center justify-between gap-1.5 font-mono text-[11px] sm:text-xs">
                            {/* Version Info */}
                            <div className="flex items-center gap-1.5 min-w-0">
                                {needsUpdate ? (
                                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-amber-200">
                                        <Badge className="bg-amber-500 text-slate-950 font-bold text-[9px] px-1 py-0 h-3.5">
                                            UPDATE v{latestVersion}
                                        </Badge>
                                        <span className="text-[10px] sm:text-[11px] truncate">
                                            รัน v{eaState?.ea_version || '1.0'}
                                        </span>
                                        {downloadUrl && (
                                            <a
                                                href={downloadUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="ml-1 text-[10px] text-amber-300 hover:text-white underline font-bold"
                                            >
                                                โหลด
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-300">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        <span className="font-bold">Smart Vortex v{eaState?.ea_version || latestVersion}</span>
                                        <span className="text-[10px] text-slate-400 hidden sm:inline">(ล่าสุด)</span>
                                    </div>
                                )}
                                <span className="text-[10px] text-slate-500 hidden md:inline">
                                    • SYNC {(eaState as any)?.sync_interval_sec || 15}s
                                </span>
                            </div>

                            {/* Status Indicators (LINK, CFG, MODE) */}
                            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                <div className="rounded px-2 py-0.5 bg-black/40 border border-slate-800 flex items-center gap-1 text-[10px] sm:text-[11px]">
                                    <span className="text-slate-400">LINK:</span>
                                    {isWaitingFreshData ? (
                                        <span className="text-amber-400 flex items-center gap-1 font-bold animate-pulse">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> WAIT
                                        </span>
                                    ) : isOnline ? (
                                        <span className="text-emerald-400 flex items-center gap-1 font-bold">
                                            <Wifi className="w-2.5 h-2.5" /> ON
                                        </span>
                                    ) : (
                                        <span className="text-rose-400 flex items-center gap-1 font-bold">
                                            <WifiOff className="w-2.5 h-2.5" /> OFF
                                        </span>
                                    )}
                                </div>

                                <div className="rounded px-2 py-0.5 bg-black/40 border border-slate-800 flex items-center gap-1 text-[10px] sm:text-[11px]">
                                    <span className="text-slate-400">CFG:</span>
                                    {isPendingAck ? (
                                        <span className="text-amber-400 font-bold flex items-center gap-0.5">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> SYNC
                                        </span>
                                    ) : eaState?.config_status === 'WEB_LOADED' ? (
                                        <span className="text-cyan-400 font-bold">WEB</span>
                                    ) : (
                                        <span className="text-slate-300 font-bold">MT5</span>
                                    )}
                                </div>

                                <div className="rounded px-2 py-0.5 bg-black/40 border border-slate-800 flex items-center gap-1 text-[10px] sm:text-[11px]">
                                    <span className="text-slate-400">MODE:</span>
                                    <span
                                        className={`font-bold ${
                                            eaState?.trade_status === 'RUNNING'
                                                ? 'text-emerald-400'
                                                : eaState?.trade_status === 'PAUSED_NEXT'
                                                ? 'text-amber-400'
                                                : 'text-rose-400'
                                        }`}
                                    >
                                        {eaState?.trade_status === 'RUNNING' ? 'RUN' : eaState?.trade_status || 'WAIT'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Model B: Triple Balance Radar (Orders / DD-PnL / Lots) - Moved directly after Clock Frame */}
                    <PnlVectorVisualizer
                        mode="modelB"
                        currency={cur}
                        cyclePnl={eaState?.cycle_pnl || 0}
                        targetProfit={activeTp}
                        pnlJitter={pnlJitter}
                        isOnline={isOnline && !isWaitingFreshData}
                        chart={eaState?.chart}
                    />

                    {/* One-Side Cap Freeze Banner + Quick TP Rescue (Emergency Protection) */}
                    {(eaState?.trade_status === 'FROZEN_BUY' || eaState?.trade_status === 'FROZEN_SELL' || eaState?.trade_status === 'FROZEN_7X7' || eaState?.protection_frozen) && (
                        <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-2.5 sm:p-3 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                                    <h3 className="font-bold text-rose-300 text-xs sm:text-sm">
                                        {eaState?.frozen_side === 'BUY' || eaState?.trade_status === 'FROZEN_BUY'
                                            ? `One-Side Freeze (${eaState?.active_config?.max_both_sides_cap ?? 7}x${eaState?.active_config?.max_both_sides_cap ?? 7}): ฝั่ง Buy ถูกหยุด • ฝั่ง Sell ออกต่อได้`
                                            : eaState?.frozen_side === 'SELL' || eaState?.trade_status === 'FROZEN_SELL'
                                            ? `One-Side Freeze (${eaState?.active_config?.max_both_sides_cap ?? 7}x${eaState?.active_config?.max_both_sides_cap ?? 7}): ฝั่ง Sell ถูกหยุด • ฝั่ง Buy ออกต่อได้`
                                            : `ระบบป้องกัน ${eaState?.active_config?.max_both_sides_cap ?? 7}x${eaState?.active_config?.max_both_sides_cap ?? 7} ทำงาน: เข้าสู่สถานะ Freeze`}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {(eaState?.freeze_flip_count ?? 0) > 0 && (
                                        <Badge variant="outline" className="border-amber-400/50 text-amber-300 font-mono text-[10px] py-0">
                                            Flipped x{eaState?.freeze_flip_count}
                                        </Badge>
                                    )}
                                    <Badge variant="destructive" className="w-fit font-mono text-[10px] py-0">
                                        Buy {eaState?.open_buy ?? 0} / Sell {eaState?.open_sell ?? 0}
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-[11px] text-rose-200/90 leading-relaxed">
                                ทั้งสองฝั่งเปิดครบเกณฑ์แล้ว EA ลบ Pending ฝั่งตรงข้ามออก ส่วนฝั่งที่นับครบยังออกไม้ต่อได้เพื่อลุ้นปิดรวบ หรือปรับ <strong>Target Profit</strong> ด้านล่าง
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] text-muted-foreground mr-1">ตั้งเป้าปิดรวบด่วน:</span>
                                {[
                                    { label: 'TP = 0 (เท่าทุน)', val: 0 },
                                    { label: `TP = -20 ${cur}`, val: -20 },
                                    { label: `TP = -50 ${cur}`, val: -50 },
                                ].map((preset) => (
                                    <Button
                                        key={preset.val}
                                        size="sm"
                                        variant="outline"
                                        disabled={sending}
                                        className="h-6 text-[11px] px-2 border-rose-500/40 hover:bg-rose-500/20"
                                        onClick={() => {
                                            setTargetProfit(String(preset.val));
                                            sendCommand(
                                                { target_profit: preset.val, close_all: false },
                                                `ตั้งเป้า Target Profit = ${preset.val} ${cur} แล้ว EA จะรวบปิดอัตโนมัติเมื่อถึงเป้า`
                                            );
                                        }}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Waiting for Fresh Data Banner */}
                    {isWaitingFreshData && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-1.5 flex items-center justify-between gap-2 font-mono text-[11px]">
                            <div className="flex items-center gap-2 text-slate-300">
                                <RefreshCw className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                                <span>
                                    {!isOnline
                                        ? 'รอสัญญาณจาก MT5 (ตัวเลขเป็นค่าล่าสุดก่อนออฟไลน์)...'
                                        : 'กำลังรอข้อมูลรอบใหม่จาก MT5 (ปลุกจากโหมด 180s → 15s)...'}
                                </span>
                            </div>
                            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[9.5px] shrink-0 animate-pulse py-0">
                                WAIT DATA
                            </Badge>
                        </div>
                    )}

                    {/* Live M1 Candlestick Chart with TP & Freeze Overlays */}
                    <div className={`space-y-1.5 sm:space-y-2 transition-all duration-500 ${isWaitingFreshData ? 'opacity-55 grayscale animate-pulse' : ''}`}>
                    <SmartVortexChart
                        symbol={eaState?.symbol || 'XAUUSD'}
                        currency={cur}
                        anchor={eaState?.anchor || 0}
                        targetProfit={eaState?.active_config?.target_profit ?? (parseFloat(targetProfit) || 20)}
                        frozenSide={eaState?.frozen_side}
                        isOnline={isOnline && !isWaitingFreshData}
                        openBuy={eaState?.open_buy ?? 0}
                        openSell={eaState?.open_sell ?? 0}
                        pendBuy={eaState?.pending_buy ?? 0}
                        pendSell={eaState?.pending_sell ?? 0}
                        cap={activeCap}
                        liveCyclePnl={liveCyclePnl}
                        balance={balanceVal}
                        cyclePnl={eaState?.cycle_pnl || 0}
                        chart={eaState?.chart}
                    />

                    {/* Model A: Unified PnL Stack Vector Axis */}
                    <PnlVectorVisualizer
                        mode="modelA"
                        currency={cur}
                        cyclePnl={eaState?.cycle_pnl || 0}
                        targetProfit={activeTp}
                        pnlJitter={pnlJitter}
                        isOnline={isOnline && !isWaitingFreshData}
                        chart={eaState?.chart}
                    />
                    </div>

                    {/* Control & Settings Split */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
                        {/* Left: Flight Control & Tactical Modes */}
                        <Card className="lg:col-span-5 border-cyan-500/25 bg-[#070b16]/95 text-slate-100 shadow-md">
                            <CardHeader className="p-2.5 sm:p-3 pb-2 space-y-1.5 border-b border-cyan-500/15">
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                    <CardTitle className="flex items-center gap-1.5 text-xs sm:text-sm font-mono tracking-widest uppercase text-cyan-300">
                                        <Activity className="w-4 h-4 text-cyan-400" /> FLIGHT CONTROL
                                    </CardTitle>

                                    {/* 🎯 Mode & CFG Status Rail in Header */}
                                    <div className="flex items-center gap-1.5 font-mono text-[10.5px]">
                                        {/* CFG Indicator */}
                                        <div className="rounded px-2 py-0.5 bg-black/60 border border-slate-800 flex items-center gap-1">
                                            <span className="text-slate-400">CFG:</span>
                                            {isPendingAck ? (
                                                <span className="text-amber-400 font-bold flex items-center gap-1 animate-pulse">
                                                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> SYNCING
                                                </span>
                                            ) : eaState?.config_status === 'WEB_LOADED' ? (
                                                <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> WEB
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 font-bold">MT5</span>
                                            )}
                                        </div>

                                        {/* MODE Indicator */}
                                        <div className="rounded px-2 py-0.5 bg-black/60 border border-slate-800 flex items-center gap-1">
                                            <span className="text-slate-400">MODE:</span>
                                            <span
                                                className={`font-bold ${
                                                    isRunning
                                                        ? 'text-emerald-400'
                                                        : isPauseNextActive
                                                        ? 'text-amber-400'
                                                        : 'text-rose-400'
                                                }`}
                                            >
                                                {isRunning
                                                    ? 'RUN'
                                                    : isPauseNextActive
                                                    ? 'PAUSE_NEXT'
                                                    : isFreezeStopActive
                                                    ? 'FREEZE_STOP'
                                                    : eaState?.trade_status || 'WAIT'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-2.5 sm:p-3 pt-2.5 space-y-2 font-mono">
                                {/* 1. ปุ่มเริ่มรันอีเอใหม่ (สีเขียว) - ซ่อนไปเมื่ออีเอกำลังรันอยู่ (isRunning), แสดงขึ้นมาเมื่อสั่งหยุดออกไม้ใหม่/หยุดรัน */}
                                {!isRunning && (
                                    <Button
                                        className="w-full justify-between bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 animate-in fade-in duration-200"
                                        disabled={sending}
                                        onClick={() =>
                                            sendCommand(
                                                { stop_mode: 'RUN', close_all: false },
                                                'สั่งเริ่มรันอีเอใหม่ (RUN) ไปยัง MT5 แล้ว'
                                            )
                                        }
                                    >
                                        <span className="flex items-center gap-2">
                                            <PlayCircle className="w-4 h-4 text-emerald-200" />
                                            <span>เริ่มรันอีเอใหม่ (ENGAGE // RUN)</span>
                                        </span>
                                        <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded font-mono">START</span>
                                    </Button>
                                )}

                                {/* 2. ปุ่มหยุดหลังจบรอบนี้ (Pause Next Cycle) - กดอีกทีเพื่อยกเลิกได้ */}
                                <Button
                                    variant="outline"
                                    className={`w-full justify-between text-xs transition-colors ${
                                        isPauseNextActive
                                            ? 'border-amber-500 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                            : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                                    }`}
                                    disabled={sending}
                                    onClick={() => {
                                        if (isPauseNextActive) {
                                            sendCommand(
                                                { stop_mode: 'RUN', close_all: false },
                                                'ยกเลิกการหยุดหลังจบรอบแล้ว กลับสู่โหมดรันต่อ (RUN)'
                                            );
                                        } else {
                                            sendCommand(
                                                { stop_mode: 'PAUSE_NEXT', close_all: false },
                                                'สั่งหยุดหลังจบรอบปัจจุบัน (Pause Next Cycle) แล้ว'
                                            );
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <PauseCircle className="w-4 h-4 text-amber-400" />
                                        <span>
                                            {isPauseNextActive
                                                ? 'หยุดหลังจบรอบนี้ (กดเพื่อยกเลิก)'
                                                : 'หยุดหลังจบรอบนี้ (Pause Next Cycle)'}
                                        </span>
                                    </span>
                                    {isPauseNextActive && (
                                        <Badge className="bg-amber-500 text-slate-950 font-mono text-[9px] px-1.5 py-0 h-4">
                                            รอจบรอบ
                                        </Badge>
                                    )}
                                </Button>

                                {/* 3. ปุ่มลบ Pending หยุดออกไม้ใหม่ - กดอีกทีเพื่อยกเลิกได้ */}
                                <Button
                                    variant="outline"
                                    className={`w-full justify-between text-xs transition-colors ${
                                        isFreezeStopActive
                                            ? 'border-rose-500 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                            : 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
                                    }`}
                                    disabled={sending}
                                    onClick={() => {
                                        if (isFreezeStopActive) {
                                            sendCommand(
                                                { stop_mode: 'RUN', close_all: false },
                                                'ยกเลิกคำสั่งหยุดแล้ว กลับสู่โหมดรันต่อ (RUN)'
                                            );
                                        } else {
                                            sendCommand(
                                                { stop_mode: 'FREEZE_STOP', close_all: false },
                                                'สั่งลบ Pending และหยุดออกไม้ใหม่ทันทีแล้ว'
                                            );
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-rose-400" />
                                        <span>
                                            {isFreezeStopActive
                                                ? 'ลบ Pending หยุดออกไม้ใหม่ (กดเพื่อยกเลิก)'
                                                : 'ลบ Pending หยุดออกไม้ใหม่'}
                                        </span>
                                    </span>
                                    {isFreezeStopActive && (
                                        <Badge className="bg-rose-500 text-white font-mono text-[9px] px-1.5 py-0 h-4">
                                            หยุดออกไม้
                                        </Badge>
                                    )}
                                </Button>

                                {/* 4. ปุ่มปิดรวบออเดอร์ทั้งหมดทันที - เมื่องดออกไม้ใหม่ */}
                                <div className="pt-2 border-t border-slate-800/80">
                                    {!confirmCloseAll ? (
                                        <Button
                                            variant="destructive"
                                            className="w-full justify-start gap-2 text-xs"
                                            disabled={sending}
                                            onClick={() => setConfirmCloseAll(true)}
                                        >
                                            <ShieldAlert className="w-4 h-4" />
                                            <span>ปิดรวบออเดอร์ทั้งหมดทันที (งดออกไม้ใหม่)</span>
                                        </Button>
                                    ) : (
                                        <div className="p-2.5 rounded-lg border border-destructive/50 bg-destructive/10 space-y-2">
                                            <p className="text-xs font-medium text-destructive">
                                                ยืนยันปิดรวบทุกไม้ ลบ Pending และงดออกไม้ใหม่ทันที?
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="flex-1 text-xs"
                                                    disabled={sending}
                                                    onClick={() => {
                                                        setConfirmCloseAll(false);
                                                        sendCommand(
                                                            { stop_mode: 'FREEZE_STOP', close_all: true },
                                                            'ส่งคำสั่ง Close All Now ปิดรวบทุกไม้และงดออกไม้ใหม่แล้ว!'
                                                        );
                                                    }}
                                                >
                                                    ยืนยันปิดรวบ & หยุด
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 text-xs"
                                                    onClick={() => setConfirmCloseAll(false)}
                                                >
                                                    ยกเลิก
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Right: Live Settings Editor */}
                        <Card className="lg:col-span-7 border-cyan-500/25 bg-[#070b16]/95 text-slate-100">
                            <CardHeader className="p-2.5 sm:p-3 pb-2">
                                <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-cyan-300">
                                    <Sliders className="w-4 h-4 text-cyan-400" /> GRID MATRIX // PARAMS
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-2.5 sm:p-3 pt-0">
                                <form onSubmit={handleUpdateSettings} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2 font-mono">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400">FIRST DIST (PT)</Label>
                                            <Input
                                                type="number"
                                                value={firstDistance}
                                                onChange={(e) => setFirstDistance(e.target.value)}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-100 h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400">SPACING (PT)</Label>
                                            <Input
                                                type="number"
                                                value={spacing}
                                                onChange={(e) => setSpacing(e.target.value)}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-100 h-9"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>จำนวน Pending ต่อฝั่ง (Pending/Side)</Label>
                                            <Input
                                                type="number"
                                                value={pendingPerSide}
                                                onChange={(e) => setPendingPerSide(e.target.value)}
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>เป้ากำไรปิดรวบ (Target Profit {cur})</Label>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                value={targetProfit}
                                                onChange={(e) => setTargetProfit(e.target.value)}
                                                className="font-mono"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                ใส่ 0 (เท่าทุน) หรือค่าติดลบ (เช่น -50) ได้ เพื่อรวบปิดจำกัดขาดทุนอัตโนมัติ
                                            </p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>ล็อตเริ่มต้น (Initial Lot)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={initialLot}
                                                onChange={(e) => setInitialLot(e.target.value)}
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>ล็อตเพิ่มต่อชั้น (Lot Increment)</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={lotIncrement}
                                                onChange={(e) => setLotIncrement(e.target.value)}
                                                className="font-mono"
                                            />
                                        </div>
                                        <div className="space-y-2 sm:col-span-2 rounded-lg border p-3 bg-muted/20">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div>
                                                    <Label className="text-sm font-semibold">ระบบป้องกัน One-Side Freeze (ล็อกฝั่งตรงข้ามเมื่อครบทั้ง 2 ฝั่ง)</Label>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        เมื่อทั้งสองฝั่งเปิดถึง {maxBothSidesCap || 7} ไม้ ฝั่งที่เพิ่งครบยังออกต่อได้ ส่วนฝั่งตรงข้ามจะถูก Freeze ห้ามออกเพิ่ม
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={enableCapFreeze ? 'default' : 'outline'}
                                                    onClick={() => setEnableCapFreeze((v) => !v)}
                                                    className="shrink-0"
                                                >
                                                    {enableCapFreeze ? 'เปิดใช้งาน (ON)' : 'ปิดใช้งาน (OFF)'}
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">จำนวนไม้ที่เริ่ม Freeze (ไม้/ฝั่ง)</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="50"
                                                        disabled={!enableCapFreeze}
                                                        value={maxBothSidesCap}
                                                        onChange={(e) => setMaxBothSidesCap(e.target.value)}
                                                        className="font-mono mt-1"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-muted-foreground">สลับสิทธิ์ถ้าออกเพิ่มไม่ถึง (ไม้, 0 = ไม่สลับ)</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="50"
                                                        disabled={!enableCapFreeze}
                                                        value={freezeFlipMaxExtra}
                                                        onChange={(e) => setFreezeFlipMaxExtra(e.target.value)}
                                                        className="font-mono mt-1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <span className="text-xs text-muted-foreground">รูปแบบการสลับสิทธิ์เมื่อราคาตีกลับ</span>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={!enableCapFreeze}
                                                    onClick={() => setFreezeFlipContinuous((v) => !v)}
                                                    className="h-7 text-xs"
                                                >
                                                    {freezeFlipContinuous ? 'สลับต่อเนื่อง (Continuous)' : 'สลับครั้งเดียว (Once)'}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {eaState?.active_config && (
                                        <div className="p-3 rounded-lg bg-muted/40 border text-xs font-mono text-muted-foreground">
                                            ค่าที่กำลังรันอยู่ใน EA ขณะนี้: Dist={eaState.active_config.first_distance}pt | Spacing={eaState.active_config.spacing}pt | Pend={eaState.active_config.pending_per_side} | Lot={eaState.active_config.initial_lot}+{eaState.active_config.lot_increment} | TP={eaState.active_config.target_profit}
                                        </div>
                                    )}

                                    <Button type="submit" className="w-full gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs" disabled={sending}>
                                        {sending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        UPLOAD & SYNC PARAMS
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
        </div>
    );
}

export default function SmartEACockpitPage() {
    return (
        <main className="min-h-screen bg-[#040711] text-slate-100">
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center p-12 text-center text-cyan-400 font-mono text-sm">
                    <Loader2 className="w-5 h-5 animate-spin mr-2 inline" /> Loading Smart EA Cockpit...
                </div>
            }>
                <SmartEACockpitContent />
            </Suspense>
        </main>
    );
}
