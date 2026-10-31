'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { X, RefreshCw, Layers, TrendingUp, Clock, CheckCircle2, ShieldAlert, Sparkles, Filter, ChevronRight } from 'lucide-react';

export interface BasketClosureEvent {
    id: string;
    symbol: string;
    side: string;
    exit_type: string;
    orders: number;
    lots: number;
    profit: number;
    duration_sec: number;
    max_dd_pct: number;
    closed_at: number;
    ea_name?: string;
    ea_build?: string;
}

export interface PairSummary {
    symbol: string;
    totalProfit: number;
    totalLots: number;
    totalOrders: number;
    basketsCount: number;
    profitSharePct: number;
    color: string;
    exitTypes: string[];
    maxDd: number;
}

export interface TodayHarvestData {
    success: boolean;
    port_number: string;
    today_profit: number;
    today_closed_lots: number;
    daily_max_drawdown: number;
    balance: number;
    equity: number;
    account_type: string;
    currency: string;
    updated_at: string;
    events_count: number;
    pair_summary: PairSummary[];
    events: BasketClosureEvent[];
}

interface TodayHarvestModalProps {
    isOpen: boolean;
    onClose: () => void;
    portNumber: string;
    initialTodayProfit?: number;
    initialTodayLots?: number;
    initialMaxDd?: number;
    accountType?: string;
}

export default function TodayHarvestModal({
    isOpen,
    onClose,
    portNumber,
    initialTodayProfit = 0,
    initialTodayLots = 0,
    initialMaxDd = 0,
    accountType = 'USC'
}: TodayHarvestModalProps) {
    const [data, setData] = useState<TodayHarvestData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [selectedPairFilter, setSelectedPairFilter] = useState<string | null>(null);
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

    const isUSC = accountType.toUpperCase().trim() === 'USC' || accountType.toUpperCase().trim() === 'CENT';

    // Format currency
    const formatProfit = useCallback((val: number, isCents = isUSC) => {
        const sign = val >= 0 ? '+' : '';
        if (isCents) {
            const usd = val / 100;
            return {
                main: `${sign}${val.toFixed(2)} USC`,
                usd: `≈ ${sign}$${usd.toFixed(2)} USD`
            };
        }
        return {
            main: `${sign}$${val.toFixed(2)} USD`,
            usd: `≈ ${sign}${(val * 100).toFixed(2)} USC`
        };
    }, [isUSC]);

    const formatTime = (unixSec: number) => {
        if (!unixSec) return '--:--:--';
        const d = new Date(unixSec * 1000);
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDuration = (sec: number) => {
        if (!sec || sec <= 0) return '< 1 นาที';
        if (sec < 60) return `${sec} วิ`;
        const mins = Math.floor(sec / 60);
        if (mins < 60) return `${mins} นาที`;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs} ชม. ${remMins} น.`;
    };

    const getExitTypeInfo = (exitType: string) => {
        switch (exitType) {
            case 'FULL_BASKET_TP':
                return {
                    label: 'FULL BASKET TP',
                    badge: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300',
                    dot: 'bg-emerald-400',
                    tag: 'TP'
                };
            case 'RESCUE_T1_SCALP_TP':
                return {
                    label: 'RESCUE T1 TP',
                    badge: 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300',
                    dot: 'bg-cyan-400',
                    tag: 'RESCUE T1'
                };
            case 'RESCUE_T2_SCALP_TP':
                return {
                    label: 'RESCUE T2 TP',
                    badge: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200',
                    dot: 'bg-cyan-400',
                    tag: 'RESCUE T2'
                };
            case 'RESCUE_ALL_SCALP_TP':
                return {
                    label: 'RESCUE ALL TP',
                    badge: 'bg-sky-500/20 border-sky-400/60 text-sky-200',
                    dot: 'bg-sky-400',
                    tag: 'RESCUE ALL'
                };
            case 'QUARANTINE_FULL_EXIT':
                return {
                    label: 'QUAR EXIT',
                    badge: 'bg-amber-500/15 border-amber-400/50 text-amber-300',
                    dot: 'bg-amber-400',
                    tag: 'QUAR EXIT'
                };
            case 'RELIEF_TRIM':
                return {
                    label: 'RELIEF TRIM',
                    badge: 'bg-purple-500/15 border-purple-400/50 text-purple-300',
                    dot: 'bg-purple-400',
                    tag: 'TRIM'
                };
            default:
                return {
                    label: exitType.replace(/_/g, ' '),
                    badge: 'bg-slate-500/15 border-slate-400/40 text-slate-300',
                    dot: 'bg-slate-400',
                    tag: 'CLOSE'
                };
        }
    };

    // Fetch data from API
    const fetchData = useCallback(async (isManual = false) => {
        if (isManual) setIsRefreshing(true);
        try {
            const res = await fetch(`/api/farm/today-harvest?port=${encodeURIComponent(portNumber)}`);
            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    setData(json);
                }
            }
        } catch (err) {
            console.warn('[TodayHarvestModal] Fetch error:', err);
        } finally {
            setIsLoading(false);
            if (isManual) {
                setTimeout(() => setIsRefreshing(false), 400);
            }
        }
    }, [portNumber]);

    // Initial load and polling every 15 seconds while open
    useEffect(() => {
        if (!isOpen) return;
        fetchData();
        const interval = setInterval(() => {
            fetchData();
        }, 15000);
        return () => clearInterval(interval);
    }, [isOpen, fetchData]);

    // Handle ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Filter events
    const filteredEvents = useMemo(() => {
        if (!data?.events) return [];
        if (!selectedPairFilter) return data.events;
        return data.events.filter(e => e.symbol === selectedPairFilter);
    }, [data?.events, selectedPairFilter]);

    // SVG Donut Slices calculation
    const donutSlices = useMemo(() => {
        if (!data?.pair_summary || data.pair_summary.length === 0) return [];
        const summary = data.pair_summary;
        let cumulativePct = 0;

        return summary.map(pair => {
            const startPct = cumulativePct;
            const slicePct = Math.max(2, pair.profitSharePct);
            cumulativePct += slicePct;

            const startAngle = (startPct / 100) * 360 - 90;
            const endAngle = (cumulativePct / 100) * 360 - 90;

            const rInner = 56;
            const rOuter = 82;
            const cx = 100;
            const cy = 100;

            const toRad = (deg: number) => (deg * Math.PI) / 180;
            const x1Inner = cx + rInner * Math.cos(toRad(startAngle));
            const y1Inner = cy + rInner * Math.sin(toRad(startAngle));
            const x2Inner = cx + rInner * Math.cos(toRad(endAngle));
            const y2Inner = cy + rInner * Math.sin(toRad(endAngle));

            const x1Outer = cx + rOuter * Math.cos(toRad(startAngle));
            const y1Outer = cy + rOuter * Math.sin(toRad(endAngle));
            const x2Outer = cx + rOuter * Math.cos(toRad(endAngle));
            const y2Outer = cy + rOuter * Math.sin(toRad(endAngle));

            const largeArcFlag = slicePct > 50 ? 1 : 0;

            const path = `
                M ${x1Inner} ${y1Inner}
                L ${cx + rOuter * Math.cos(toRad(startAngle))} ${cy + rOuter * Math.sin(toRad(startAngle))}
                A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}
                L ${x2Inner} ${y2Inner}
                A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}
                Z
            `;

            return {
                ...pair,
                path,
                startAngle,
                endAngle
            };
        });
    }, [data?.pair_summary]);

    if (!isOpen) return null;

    const displayProfit = data?.today_profit ?? initialTodayProfit;
    const displayLots = data?.today_closed_lots ?? initialTodayLots;
    const displayMaxDd = data?.daily_max_drawdown ?? initialMaxDd;
    const pnlFormatted = formatProfit(displayProfit);

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[1000001] flex items-center justify-center p-2 sm:p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-2xl sm:rounded-3xl bg-[#090b11]/95 border-2 border-amber-500/50 shadow-[0_0_60px_rgba(245,158,11,0.25)] overflow-hidden backdrop-blur-2xl text-white select-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 🌟 Top Ambient Glow Bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-amber-400 to-emerald-500 pointer-events-none" />

                {/* 🏷️ Header */}
                <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3.5 border-b border-white/10 shrink-0 bg-black/40">
                    <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
                        <div className="relative w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                            <Image 
                                src="/farm/base_farmbox_full.webp" 
                                alt="Crate" 
                                fill 
                                className="object-contain" 
                                unoptimized 
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                                <h2 className="text-sm sm:text-base font-black font-mono tracking-wider text-amber-300 drop-shadow whitespace-nowrap">
                                    🌾 TODAY HARVEST
                                </h2>
                                <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded-full border border-cyan-500/30 whitespace-nowrap">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                    <span>LIVE</span>
                                </span>
                            </div>
                            <p className="text-[9.5px] sm:text-xs text-white/60 font-mono mt-0.5 whitespace-nowrap truncate">
                                PORT: <span className="text-amber-200 font-bold">{portNumber}</span> • MT5 Live Telemetry
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <button
                            onClick={() => fetchData(true)}
                            disabled={isRefreshing}
                            className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            title="รีเฟรชข้อมูลล่าสุด"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-white/70 hover:text-rose-300 transition-all cursor-pointer active:scale-95"
                            aria-label="Close"
                        >
                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                    </div>
                </div>

                {/* 📊 Today Hero Summary Badges Row */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-2 sm:py-2.5 bg-black/60 border-b border-white/5 shrink-0 text-center font-mono">
                    <div className="bg-[#051c14]/80 border border-emerald-500/30 rounded-xl p-1.5 sm:p-2 flex flex-col items-center justify-center min-w-0">
                        <span className="text-[8.5px] sm:text-[10px] text-emerald-400/80 font-bold tracking-wider uppercase whitespace-nowrap">
                            NET PROFIT
                        </span>
                        <span className="text-[11px] sm:text-base font-black text-emerald-400 leading-tight mt-0.5 whitespace-nowrap">
                            {pnlFormatted.main}
                        </span>
                        <span className="text-[7.5px] sm:text-[9.5px] text-emerald-300/60 leading-tight whitespace-nowrap">
                            {pnlFormatted.usd}
                        </span>
                    </div>

                    <div className="bg-[#05141f]/80 border border-cyan-500/30 rounded-xl p-1.5 sm:p-2 flex flex-col items-center justify-center min-w-0">
                        <span className="text-[8.5px] sm:text-[10px] text-cyan-400/80 font-bold tracking-wider uppercase whitespace-nowrap">
                            CLOSED LOTS
                        </span>
                        <span className="text-[11px] sm:text-base font-black text-cyan-300 leading-tight mt-0.5 whitespace-nowrap">
                            {displayLots.toFixed(2)} Lots
                        </span>
                        <span className="text-[7.5px] sm:text-[9.5px] text-cyan-400/60 leading-tight whitespace-nowrap">
                            {data?.events_count ?? 0} Baskets
                        </span>
                    </div>

                    <div className="bg-[#1f0d05]/80 border border-amber-500/30 rounded-xl p-1.5 sm:p-2 flex flex-col items-center justify-center min-w-0">
                        <span className="text-[8.5px] sm:text-[10px] text-amber-400/80 font-bold tracking-wider uppercase whitespace-nowrap">
                            MAX DRAWDOWN
                        </span>
                        <span className="text-[11px] sm:text-base font-black text-amber-300 leading-tight mt-0.5 whitespace-nowrap">
                            -{Math.abs(displayMaxDd).toFixed(2)}%
                        </span>
                        <span className="text-[7.5px] sm:text-[9.5px] text-amber-400/60 leading-tight whitespace-nowrap">
                            Daily Peak
                        </span>
                    </div>
                </div>

                {/* 📜 Scrollable Main Content */}
                <div className="overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 flex-1 no-scrollbar">

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* 1. UPPER SECTION: DONUT CHART + PAIR GROUPED SUMMARY           */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="bg-black/50 border border-white/10 rounded-2xl p-3 sm:p-5 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-2.5 sm:mb-3 border-b border-white/5 pb-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                                <h3 className="text-xs sm:text-sm font-bold font-mono text-white/90 uppercase tracking-wider whitespace-nowrap truncate">
                                    PROFIT BY PAIRS
                                </h3>
                            </div>
                            {selectedPairFilter && (
                                <button
                                    onClick={() => setSelectedPairFilter(null)}
                                    className="text-[9px] sm:text-xs font-mono text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/30 flex items-center gap-1 transition-all shrink-0 whitespace-nowrap"
                                >
                                    <span>RESET ({selectedPairFilter})</span>
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                                <span className="ml-2 font-mono text-xs text-white/60">กำลังดึงข้อมูล Telemetry...</span>
                            </div>
                        ) : !data?.pair_summary || data.pair_summary.length === 0 ? (
                            <div className="text-center py-8 text-white/40 font-mono text-xs">
                                ยังไม่มีข้อมูลการปิดรวบกำไรในวันนี้
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                                {/* Left: Interactive SVG Donut Chart */}
                                <div className="md:col-span-5 flex flex-col items-center justify-center relative">
                                    <div className="relative w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center">
                                        <svg 
                                            className="w-full h-full transform transition-transform" 
                                            viewBox="0 0 200 200"
                                        >
                                            {/* Glow filter definition */}
                                            <defs>
                                                <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
                                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                                </filter>
                                            </defs>

                                            {/* Background ring */}
                                            <circle
                                                cx="100"
                                                cy="100"
                                                r="69"
                                                fill="none"
                                                stroke="rgba(255,255,255,0.05)"
                                                strokeWidth="26"
                                            />

                                            {/* Donut Slices */}
                                            {donutSlices.map((slice) => {
                                                const isSelected = selectedPairFilter === slice.symbol;
                                                const isHovered = hoveredSlice === slice.symbol;
                                                return (
                                                    <path
                                                        key={`slice_${slice.symbol}`}
                                                        d={slice.path}
                                                        fill={slice.color}
                                                        stroke="#090b11"
                                                        strokeWidth="2.5"
                                                        className={`transition-all duration-300 cursor-pointer ${
                                                            isSelected || isHovered 
                                                                ? 'opacity-100 scale-105 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]' 
                                                                : 'opacity-85 hover:opacity-100'
                                                        }`}
                                                        onMouseEnter={() => setHoveredSlice(slice.symbol)}
                                                        onMouseLeave={() => setHoveredSlice(null)}
                                                        onClick={() => {
                                                            setSelectedPairFilter(prev => prev === slice.symbol ? null : slice.symbol);
                                                        }}
                                                    />
                                                );
                                            })}
                                        </svg>

                                        {/* Center Content of Donut */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none leading-none">
                                            <span className="text-[8px] sm:text-[9px] font-mono font-bold tracking-widest text-white/40 uppercase mb-1">
                                                {hoveredSlice || selectedPairFilter || 'TOTAL HARVEST'}
                                            </span>
                                            <span className="text-xs sm:text-base font-mono font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                                                {(() => {
                                                    const targetSym = hoveredSlice || selectedPairFilter;
                                                    if (targetSym) {
                                                        const p = data.pair_summary.find(s => s.symbol === targetSym);
                                                        return p ? `+${p.totalProfit.toFixed(1)}` : `+${displayProfit.toFixed(1)}`;
                                                    }
                                                    return `+${displayProfit.toFixed(1)}`;
                                                })()}
                                                <span className="text-[9px] font-normal text-white/50 ml-0.5">USC</span>
                                            </span>
                                            <span className="text-[8px] sm:text-[9.5px] font-mono text-cyan-300 font-bold mt-1">
                                                {(() => {
                                                    const targetSym = hoveredSlice || selectedPairFilter;
                                                    if (targetSym) {
                                                        const p = data.pair_summary.find(s => s.symbol === targetSym);
                                                        return p ? `${p.profitSharePct}% (${p.totalLots.toFixed(1)}L)` : `${displayLots.toFixed(2)} LOTS`;
                                                    }
                                                    return `${displayLots.toFixed(2)} LOTS`;
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[8px] sm:text-[9px] text-white/40 font-mono mt-1 text-center whitespace-nowrap">
                                        💡 แตะกราฟเพื่อกรองคู่เงิน (Tap slice to filter)
                                    </span>
                                </div>

                                {/* Right: Grouped Summary Cards */}
                                <div className="md:col-span-7 space-y-1.5 sm:space-y-2">
                                    {data.pair_summary.map((pair, idx) => {
                                        const isSelected = selectedPairFilter === pair.symbol;
                                        return (
                                            <div
                                                key={`pair_card_${pair.symbol}`}
                                                onClick={() => {
                                                    setSelectedPairFilter(prev => prev === pair.symbol ? null : pair.symbol);
                                                }}
                                                className={`p-2 sm:p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                                    isSelected 
                                                        ? 'bg-amber-500/15 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.01]' 
                                                        : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/5'
                                                }`}
                                            >
                                                {/* Left: Indicator & Symbol */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[9px] font-mono font-bold text-white/30 w-3 shrink-0">
                                                        #{idx + 1}
                                                    </span>
                                                    <span 
                                                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                                                        style={{ backgroundColor: pair.color }}
                                                    />
                                                    <div className="truncate">
                                                        <span className="font-mono font-black text-xs sm:text-sm text-white tracking-wider whitespace-nowrap">
                                                            {pair.symbol}
                                                        </span>
                                                        <div className="flex items-center gap-1.5 text-[8px] sm:text-[9.5px] font-mono text-white/40 whitespace-nowrap">
                                                            <span>{pair.basketsCount} Baskets</span>
                                                            <span>•</span>
                                                            <span className="text-cyan-400 font-bold">{pair.totalLots.toFixed(2)}L</span>
                                                            <span>•</span>
                                                            <span>{pair.totalOrders} Orders</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Right: Profit & Progress bar */}
                                                <div className="flex flex-col items-end shrink-0 min-w-[85px] sm:min-w-[120px]">
                                                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                        <span className="text-xs sm:text-sm font-mono font-black text-emerald-400">
                                                            +{pair.totalProfit.toFixed(2)} <span className="text-[8.5px] font-normal text-white/50">USC</span>
                                                        </span>
                                                        <span className="text-[8.5px] sm:text-[10px] font-mono font-bold text-white/60 bg-white/5 px-1.5 py-0.2 rounded border border-white/10">
                                                            {pair.profitSharePct}%
                                                        </span>
                                                    </div>
                                                    {/* Mini bar */}
                                                    <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                                                        <div 
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ 
                                                                width: `${pair.profitSharePct}%`,
                                                                backgroundColor: pair.color 
                                                             }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* 2. LOWER SECTION: DETAILED BASKET EVENTS FROM MT5              */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="bg-black/50 border border-white/10 rounded-2xl p-3 sm:p-5 backdrop-blur-md">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" />
                                <h3 className="text-xs sm:text-sm font-bold font-mono text-white/90 uppercase tracking-wider whitespace-nowrap truncate">
                                    MT5 BASKET CLOSURES ({filteredEvents.length})
                                </h3>
                            </div>

                            {/* Quick Symbol Pills Filter */}
                            {data?.pair_summary && data.pair_summary.length > 1 && (
                                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                                    <button
                                        onClick={() => setSelectedPairFilter(null)}
                                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border transition-all whitespace-nowrap ${
                                            selectedPairFilter === null 
                                                ? 'bg-white/20 border-white text-white' 
                                                : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                                        }`}
                                    >
                                        ALL ({data.events.length})
                                    </button>
                                    {data.pair_summary.map(p => (
                                        <button
                                            key={`pill_${p.symbol}`}
                                            onClick={() => setSelectedPairFilter(prev => prev === p.symbol ? null : p.symbol)}
                                            className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border transition-all whitespace-nowrap ${
                                                selectedPairFilter === p.symbol 
                                                    ? 'border-amber-400 text-amber-200 bg-amber-500/20' 
                                                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                                            }`}
                                        >
                                            {p.symbol}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Events Table / Card List */}
                        {filteredEvents.length === 0 ? (
                            <div className="text-center py-8 text-white/40 font-mono text-xs">
                                {selectedPairFilter ? `ไม่มีรายการปิดรวบของ ${selectedPairFilter}` : 'ยังไม่มีรายการปิดรวบในวันนี้'}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredEvents.map((ev, idx) => {
                                    const exitInfo = getExitTypeInfo(ev.exit_type);
                                    const isBuy = ev.side.toUpperCase() === 'BUY';
                                    return (
                                        <div
                                            key={ev.id || `ev_${idx}`}
                                            className="p-2 sm:p-2.5 rounded-xl bg-black/40 hover:bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                        >
                                            {/* Left Block: Time, Symbol, Side, Exit Type */}
                                            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap min-w-0">
                                                <div className="flex items-center gap-1 text-white/40 text-[9px] sm:text-xs whitespace-nowrap">
                                                    <Clock className="w-3 h-3 text-white/30" />
                                                    <span>{formatTime(ev.closed_at)}</span>
                                                </div>

                                                <span className="px-1.5 py-0.5 rounded-md font-black text-[11px] sm:text-xs bg-white/10 text-white border border-white/15 whitespace-nowrap">
                                                    {ev.symbol}
                                                </span>

                                                <span className={`px-1.5 py-0.2 rounded text-[8.5px] sm:text-[9.5px] font-black border whitespace-nowrap ${
                                                    isBuy 
                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                                }`}>
                                                    {ev.side}
                                                </span>

                                                <span className={`px-1.5 py-0.5 rounded-md text-[8.5px] sm:text-[9.5px] font-bold border flex items-center gap-1 whitespace-nowrap ${exitInfo.badge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${exitInfo.dot}`} />
                                                    <span>{exitInfo.label}</span>
                                                </span>
                                            </div>

                                            {/* Right Block: Orders, Lots, Profit, Max DD */}
                                            <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-4 text-right shrink-0">
                                                <div className="flex flex-col items-start sm:items-end leading-tight whitespace-nowrap">
                                                    <span className="text-[9.5px] sm:text-xs text-white/70">
                                                        <span className="text-white font-bold">{ev.orders}</span> Orders
                                                        <span className="text-white/30 mx-1">•</span>
                                                        <span className="text-cyan-300 font-bold">{ev.lots.toFixed(2)}</span>L
                                                    </span>
                                                    <span className="text-[8px] sm:text-[9px] text-white/40 mt-0.5">
                                                        DD: <span className="text-amber-400 font-bold">-{ev.max_dd_pct.toFixed(1)}%</span>
                                                    </span>
                                                </div>

                                                <div className="flex flex-col items-end leading-tight min-w-[75px] sm:min-w-[95px] whitespace-nowrap">
                                                    <span className={`text-[11px] sm:text-sm font-black ${
                                                        ev.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                                    }`}>
                                                        {ev.profit >= 0 ? '+' : ''}{ev.profit.toFixed(2)} <span className="text-[8px] font-normal text-white/50">USC</span>
                                                    </span>
                                                    <span className="text-[8px] sm:text-[9px] text-white/40 mt-0.5">
                                                        {ev.profit >= 0 ? '+' : ''}${(ev.profit / 100).toFixed(2)} USD
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>

                {/* 📌 Footer */}
                <div className="px-3.5 sm:px-6 py-2 sm:py-2.5 border-t border-white/10 bg-black/70 flex items-center justify-between text-[9px] sm:text-xs font-mono text-white/40 shrink-0 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 truncate">
                        <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">EasyM Prime Telemetry v2.10</span>
                    </div>
                    <span className="shrink-0 text-white/50">Auto-poll: 15s</span>
                </div>
            </div>
        </div>
    );
}
