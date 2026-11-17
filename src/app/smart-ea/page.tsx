'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SmartVortexChart, SmartChartData } from '@/components/smart-vortex-chart';
import { BasketRiskAnalyzer } from '@/components/basket-risk-analyzer';
import { PnlVectorVisualizer } from '@/components/pnl-vector-visualizer';
import { toast } from 'sonner';
import {
    Activity,
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
        if (!initialPortParam) {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('smart_ea_port') : '';
            if (saved) {
                setPortInput(saved);
                setActivePort(saved);
            }
        }
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

    const cur = eaState?.currency || 'USD';
    const liveCyclePnl = (eaState?.cycle_pnl || 0) + pnlJitter;
    const liveEquity = (eaState?.equity || 0) + pnlJitter;
    const activeTp = eaState?.active_config?.target_profit ?? (parseFloat(targetProfit) || 20);
    const activeCap = eaState?.active_config?.max_both_sides_cap ?? (parseInt(maxBothSidesCap, 10) || 7);
    const eqRatio = eaState && eaState.balance > 0 ? Math.max(0, Math.min(130, (liveEquity / eaState.balance) * 100)) : 100;
    const tpProgress = activeTp > 0 ? Math.max(0, Math.min(100, (liveCyclePnl / activeTp) * 100)) : (liveCyclePnl >= activeTp ? 100 : 0);

    return (
        <div className="min-h-screen bg-[#040711] text-slate-100">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl space-y-4">
            {/* Starship Bridge Header & Port Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-[#070b16]/95 p-3.5 sm:p-4 shadow-[0_0_24px_rgba(6,182,212,0.08)]">
                <div className="flex items-center justify-between md:justify-start gap-2.5">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <h1 className="text-lg sm:text-xl font-mono font-bold tracking-widest uppercase text-cyan-300">
                                VORTEX // BRIDGE
                            </h1>
                            <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-mono text-[10px]">
                                SMART EA
                            </Badge>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5 hidden sm:block">
                            2-WAY TELEMETRY & TACTICAL GRID COMMAND
                        </p>
                    </div>
                </div>

                <form onSubmit={handleConnectPort} className="flex items-center gap-2 w-full md:w-auto">
                    <Input
                        placeholder="PORT # (e.g. 58013626)"
                        value={portInput}
                        onChange={(e) => setPortInput(e.target.value)}
                        className="w-full md:w-48 font-mono text-xs bg-slate-950/90 border-cyan-500/30 text-cyan-100"
                    />
                    <Button
                        type="submit"
                        disabled={loading}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs shrink-0"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'LINK'}
                    </Button>
                </form>
            </div>

            {!activePort ? (
                <Card className="border-dashed">
                    <CardContent className="py-16 text-center space-y-3">
                        <Activity className="w-10 h-10 mx-auto text-muted-foreground" />
                        <h3 className="text-lg font-semibold">กรุณาระบุเลขพอร์ต MT5 ที่ต้องการควบคุม</h3>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            ติดตั้ง EA Smart Vortex บน MT5 ของคุณ และเพิ่ม URL https://eaeze.com ใน MT5 WebRequest จากนั้นกรอกเลขพอร์ตด้านบนเพื่อเริ่มใช้งาน
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Version Update Alert Banner */}
                    {eaState?.ea_version && eaState.ea_version !== latestVersion && (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-amber-500 text-slate-950 font-semibold">
                                        มีอัปเดตเวอร์ชันใหม่ v{latestVersion}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        พอร์ตของคุณกำลังรัน v{eaState.ea_version}
                                    </span>
                                </div>
                                <p className="text-xs text-amber-200/90">
                                    สามารถดาวน์โหลดไฟล์ .ex5 เวอร์ชันใหม่ไปวางทับบนกราฟเดิมได้เลยโดยไม่ต้องลบออเดอร์เก่า ระบบจะกู้รอบเทรดเดิมต่อทันที
                                </p>
                            </div>
                            {downloadUrl && (
                                <a
                                    href={downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold shrink-0 text-center"
                                >
                                    ดาวน์โหลด v{latestVersion}
                                </a>
                            )}
                        </div>
                    )}

                    {/* One-Side Cap Freeze Banner + Quick TP Rescue */}
                    {(eaState?.trade_status === 'FROZEN_BUY' || eaState?.trade_status === 'FROZEN_SELL' || eaState?.trade_status === 'FROZEN_7X7' || eaState?.protection_frozen) && (
                        <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                                    <h3 className="font-bold text-rose-300 text-sm sm:text-base">
                                        {eaState?.frozen_side === 'BUY' || eaState?.trade_status === 'FROZEN_BUY'
                                            ? `One-Side Freeze (${eaState?.active_config?.max_both_sides_cap ?? 7}x${eaState?.active_config?.max_both_sides_cap ?? 7}): ฝั่ง Buy ถูกหยุด • ฝั่ง Sell ออกต่อได้`
                                            : eaState?.frozen_side === 'SELL' || eaState?.trade_status === 'FROZEN_SELL'
                                            ? `One-Side Freeze (${eaState?.active_config?.max_both_sides_cap ?? 7}x${eaState?.active_config?.max_both_sides_cap ?? 7}): ฝั่ง Sell ถูกหยุด • ฝั่ง Buy ออกต่อได้`
                                            : `ระบบป้องกัน ${eaState?.active_config?.max_both_sides_cap ?? 7}x${eaState?.active_config?.max_both_sides_cap ?? 7} ทำงาน: เข้าสู่สถานะ Freeze`}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(eaState?.freeze_flip_count ?? 0) > 0 && (
                                        <Badge variant="outline" className="border-amber-400/50 text-amber-300 font-mono">
                                            Flipped x{eaState?.freeze_flip_count}
                                        </Badge>
                                    )}
                                    <Badge variant="destructive" className="w-fit font-mono">
                                        Buy {eaState?.open_buy ?? 0} / Sell {eaState?.open_sell ?? 0}
                                    </Badge>
                                </div>
                            </div>
                            <p className="text-xs text-rose-200/90 leading-relaxed">
                                ทั้งสองฝั่งเปิดครบเกณฑ์แล้ว EA จึงลบ Pending ของฝั่งตรงข้ามออก (ห้ามออกเพิ่มแม้ราคาย้อนกลับ) ส่วนฝั่งที่เพิ่งนับครบยังออกไม้ต่อได้เรื่อยๆ เพื่อลุ้นปิดรวบ หรือปรับ <strong>Target Profit เป็น 0 / ค่าติดลบ</strong> เพื่อปิดอัตโนมัติ
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-muted-foreground mr-1">ตั้งเป้าปิดรวบด่วน:</span>
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
                                        className="h-7 text-xs border-rose-500/40 hover:bg-rose-500/20"
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

                    {/* Waiting for Fresh Data Banner (when waking from Standby or Offline) */}
                    {isWaitingFreshData && (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3.5 py-2.5 flex items-center justify-between gap-3 font-mono">
                            <div className="flex items-center gap-2.5 text-xs text-slate-300">
                                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                                <span>
                                    {!isOnline
                                        ? 'กำลังรอสัญญาณจาก MT5 (ตัวเลขด้านล่างเป็นค่าล่าสุดก่อนออฟไลน์)...'
                                        : 'กำลังรอข้อมูลรอบใหม่จาก MT5 (กำลังปลุกจากโหมดประหยัด 180s → 15s)...'}
                                </span>
                            </div>
                            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] shrink-0 animate-pulse">
                                WAIT DATA
                            </Badge>
                        </div>
                    )}

                    {/* Compact Tactical Status Rail */}
                    <div className="grid grid-cols-3 gap-2 font-mono">
                        <div className="rounded-lg border border-slate-800 bg-[#070b16]/90 px-3 py-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">LINK</span>
                            {isWaitingFreshData ? (
                                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 animate-pulse">
                                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" /> WAIT
                                </span>
                            ) : isOnline ? (
                                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                                    <Wifi className="w-3.5 h-3.5" /> ONLINE
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400">
                                    <WifiOff className="w-3.5 h-3.5" /> OFFLINE
                                </span>
                            )}
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-[#070b16]/90 px-3 py-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">CFG</span>
                            {isPendingAck ? (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> SYNCING
                                </span>
                            ) : eaState?.config_status === 'WEB_LOADED' ? (
                                <span className="flex items-center gap-1 text-[11px] font-bold text-cyan-400">
                                    <CheckCircle2 className="w-3 h-3" /> WEB
                                </span>
                            ) : (
                                <span className="text-[11px] font-bold text-slate-300">MT5</span>
                            )}
                        </div>

                        <div className="rounded-lg border border-slate-800 bg-[#070b16]/90 px-3 py-2 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">MODE</span>
                            <span
                                className={`text-[11px] font-bold ${
                                    eaState?.trade_status === 'RUNNING'
                                        ? 'text-emerald-400'
                                        : eaState?.trade_status === 'PAUSED_NEXT'
                                        ? 'text-amber-400'
                                        : 'text-rose-400'
                                }`}
                            >
                                {eaState?.trade_status || 'WAIT'}
                            </span>
                        </div>
                    </div>

                    {/* Sci-Fi HUD Gauges & Dual-Side Radar Cluster */}
                    <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono transition-all duration-500 ${isWaitingFreshData ? 'opacity-55 grayscale animate-pulse' : ''}`}>
                        {/* Gauge 1: Balance & Equity Arc */}
                        <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3 flex items-center gap-3">
                            <svg viewBox="0 0 44 44" className="w-12 h-12 shrink-0 -rotate-90">
                                <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4" />
                                <circle
                                    cx="22"
                                    cy="22"
                                    r="18"
                                    fill="none"
                                    stroke={eqRatio >= 100 ? '#10b981' : '#38bdf8'}
                                    strokeWidth="4"
                                    strokeDasharray={`${(Math.min(100, eqRatio) / 100) * 113.1} 113.1`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="min-w-0">
                                <div className="text-[10px] text-slate-400">BAL // EQ ({cur})</div>
                                <div className="text-sm font-bold text-slate-100 truncate tabular-nums">
                                    {eaState ? eaState.balance.toFixed(2) : '---'}
                                </div>
                                <div className="text-[11px] text-cyan-300 truncate tabular-nums">
                                    EQ {eaState ? liveEquity.toFixed(2) : '---'}
                                </div>
                            </div>
                        </div>

                        {/* Gauge 2: Cycle Net & Target Progress Arc */}
                        <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3 flex items-center gap-3">
                            <svg viewBox="0 0 44 44" className="w-12 h-12 shrink-0 -rotate-90">
                                <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4" />
                                <circle
                                    cx="22"
                                    cy="22"
                                    r="18"
                                    fill="none"
                                    stroke={liveCyclePnl >= 0 ? '#22c55e' : '#f43f5e'}
                                    strokeWidth="4"
                                    strokeDasharray={`${(tpProgress / 100) * 113.1} 113.1`}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="min-w-0">
                                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    CYCLE NET
                                    {isOnline && (eaState?.open_pos || 0) > 0 && (
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    )}
                                </div>
                                <div
                                    className={`text-sm font-bold truncate tabular-nums ${
                                        liveCyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                >
                                    {eaState ? `${liveCyclePnl >= 0 ? '+' : ''}${liveCyclePnl.toFixed(2)}` : '---'}
                                </div>
                                <div className="text-[11px] text-slate-400 truncate tabular-nums">
                                    TP {activeTp} {cur}
                                </div>
                            </div>
                        </div>

                        {/* Gauge 3: Dual-Side Cap Radar */}
                        <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>RADAR B // S</span>
                                <span className="text-cyan-400">CAP {activeCap}</span>
                            </div>
                            <div className="space-y-1.5 my-1">
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-4 text-cyan-400 font-bold">B</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                                        <div
                                            className="h-full bg-cyan-400 transition-all"
                                            style={{ width: `${Math.min(100, ((eaState?.open_buy || 0) / Math.max(1, activeCap)) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-slate-200 tabular-nums">{eaState?.open_buy ?? 0}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-4 text-orange-400 font-bold">S</span>
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                                        <div
                                            className="h-full bg-orange-400 transition-all"
                                            style={{ width: `${Math.min(100, ((eaState?.open_sell || 0) / Math.max(1, activeCap)) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-slate-200 tabular-nums">{eaState?.open_sell ?? 0}</span>
                                </div>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                                PEND B:{eaState?.pending_buy ?? 0} S:{eaState?.pending_sell ?? 0}
                            </div>
                        </div>

                        {/* Gauge 4: Anchor & Telemetry Sync */}
                        <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>{eaState?.symbol || 'XAUUSD'}</span>
                                <span className="text-emerald-400">v{eaState?.ea_version || '1.10'}</span>
                            </div>
                            <div className="text-sm font-bold text-amber-400 truncate tabular-nums">
                                {eaState?.anchor ? eaState.anchor.toFixed(2) : 'WAIT'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                                ANCHOR // SYNC {(eaState as any)?.sync_interval_sec || 15}s
                            </div>
                        </div>
                    </div>

                    {/* Live M1 Candlestick Chart with TP & Freeze Overlays */}
                    <div className={`space-y-4 transition-all duration-500 ${isWaitingFreshData ? 'opacity-55 grayscale animate-pulse' : ''}`}>
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
                        chart={eaState?.chart}
                    />

                    {/* Basket Risk & Recovery Analyzer */}
                    <BasketRiskAnalyzer
                        currency={cur}
                        cyclePnl={eaState?.cycle_pnl || 0}
                        targetProfit={eaState?.active_config?.target_profit ?? (parseFloat(targetProfit) || 20)}
                        openPos={eaState?.open_pos || 0}
                        frozenSide={eaState?.frozen_side}
                        sending={sending}
                        chart={eaState?.chart}
                        onQuickSetTp={(newTp) => {
                            setTargetProfit(String(newTp));
                            sendCommand(
                                { target_profit: newTp, close_all: false },
                                `ตั้งเป้า Target Profit = ${newTp} ${cur} เรียบร้อย`
                            );
                        }}
                    />

                    {/* Dual Comparison: Model A (Vector Axis) & Model B (Radar Needle) */}
                    <PnlVectorVisualizer
                        currency={cur}
                        cyclePnl={eaState?.cycle_pnl || 0}
                        targetProfit={activeTp}
                        pnlJitter={pnlJitter}
                        isOnline={isOnline && !isWaitingFreshData}
                        chart={eaState?.chart}
                    />
                    </div>

                    {/* Control & Settings Split */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Left: 2-Way Execution Controls */}
                        <Card className="lg:col-span-5 border-cyan-500/25 bg-[#070b16]/95 text-slate-100">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-cyan-300">
                                    <Activity className="w-4 h-4 text-cyan-400" /> FLIGHT CONTROL // MODE
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2.5 font-mono">
                                <Button
                                    className="w-full justify-between bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs"
                                    disabled={sending}
                                    onClick={() =>
                                        sendCommand(
                                            { stop_mode: 'RUN', close_all: false },
                                            'สั่งเริ่มเทรด (RUN) ไปยัง EA แล้ว'
                                        )
                                    }
                                >
                                    <span className="flex items-center gap-2">
                                        <PlayCircle className="w-4 h-4" /> ENGAGE // RUN
                                    </span>
                                    <span className="text-[10px] opacity-80">START</span>
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                                    disabled={sending}
                                    onClick={() =>
                                        sendCommand(
                                            { stop_mode: 'PAUSE_NEXT', close_all: false },
                                            'สั่งหยุดหลังจบรอบปัจจุบัน (Pause Next Cycle) แล้ว'
                                        )
                                    }
                                >
                                    <PauseCircle className="w-4 h-4" />
                                    หยุดหลังจบรอบนี้ (Pause Next Cycle)
                                </Button>

                                <Button
                                    variant="outline"
                                    className="w-full justify-start gap-2 border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
                                    disabled={sending}
                                    onClick={() =>
                                        sendCommand(
                                            { stop_mode: 'FREEZE_STOP', close_all: false },
                                            'สั่งหยุดกางไม้และลบ Pending ทันทีแล้ว'
                                        )
                                    }
                                >
                                    <XCircle className="w-4 h-4" />
                                    หยุดกางไม้ & ลบ Pending ทันที (Freeze Stop)
                                </Button>

                                <div className="pt-3 border-t">
                                    {!confirmCloseAll ? (
                                        <Button
                                            variant="destructive"
                                            className="w-full justify-start gap-2"
                                            disabled={sending}
                                            onClick={() => setConfirmCloseAll(true)}
                                        >
                                            <ShieldAlert className="w-4 h-4" />
                                            ปิดรวบออเดอร์ทั้งหมดทันที (Close All Now)
                                        </Button>
                                    ) : (
                                        <div className="p-3 rounded-lg border border-destructive/50 bg-destructive/10 space-y-2">
                                            <p className="text-xs font-medium text-destructive">
                                                ยืนยันปิดรวบทุกไม้และลบ Pending ทั้งหมดทันที?
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="flex-1"
                                                    disabled={sending}
                                                    onClick={() => {
                                                        setConfirmCloseAll(false);
                                                        sendCommand(
                                                            { stop_mode: 'PAUSE_NEXT', close_all: true },
                                                            'ส่งคำสั่ง Close All Now ไปยัง EA แล้ว!'
                                                        );
                                                    }}
                                                >
                                                    ยืนยันปิดทันที
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1"
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
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-cyan-300">
                                    <Sliders className="w-4 h-4 text-cyan-400" /> GRID MATRIX // PARAMS
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleUpdateSettings} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3 font-mono">
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
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="flex-1">
                <Suspense fallback={<div className="p-12 text-center">Loading Smart EA Cockpit...</div>}>
                    <SmartEACockpitContent />
                </Suspense>
            </div>
            <Footer />
        </main>
    );
}
