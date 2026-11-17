'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CandlestickChart } from 'lucide-react';

export interface ChartOrderItem {
    t: 'B' | 'S' | 'BS' | 'SS';
    p: number;
    l: number;
    u?: number;
    tm: number;
}

export interface SmartChartData {
    digits: number;
    bid: number;
    ask: number;
    round_started: number;
    buy_pnl?: number;
    sell_pnl?: number;
    est_tp_price: number;
    tp_dir: 'UP' | 'DOWN' | 'HEDGED' | 'NONE' | string;
    freeze_price: number;
    candles: [number, number, number, number, number][]; // [time, open, high, low, close]
    orders: ChartOrderItem[];
}

interface SmartVortexChartProps {
    symbol: string;
    currency: string;
    anchor: number;
    targetProfit: number;
    frozenSide?: string;
    isOnline?: boolean;
    openBuy?: number;
    openSell?: number;
    pendBuy?: number;
    pendSell?: number;
    cap?: number;
    liveCyclePnl?: number;
    balance?: number;
    cyclePnl?: number;
    chart: SmartChartData | null | undefined;
}

export function SmartVortexChart({
    symbol,
    currency,
    anchor,
    targetProfit,
    frozenSide,
    isOnline = false,
    openBuy = 0,
    openSell = 0,
    pendBuy = 0,
    pendSell = 0,
    cap = 7,
    liveCyclePnl = 0,
    balance = 0,
    cyclePnl = 0,
    chart,
}: SmartVortexChartProps) {
    const [showOrders, setShowOrders] = useState(true);
    const [showPending, setShowPending] = useState(false);
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const [tickOffset, setTickOffset] = useState(0);

    const digits = chart?.digits ?? 2;
    const rawBid = chart?.bid ?? 0;

    // Reset micro-tick offset whenever a real snapshot arrives from MT5
    useEffect(() => {
        setTickOffset(0);
    }, [rawBid, chart?.candles?.length]);

    // Smooth client-side micro-tick animation between 15s server syncs when online
    useEffect(() => {
        if (!isOnline || !rawBid || !chart?.candles?.length) {
            setTickOffset(0);
            return;
        }
        const step = Math.pow(10, -digits) * (digits <= 2 ? 8 : 5);
        const timer = setInterval(() => {
            setTickOffset((prev) => {
                const delta = (Math.random() - 0.48) * step * 2.2;
                const next = prev + delta;
                const maxDrift = step * 5;
                if (next > maxDrift) return maxDrift * 0.85;
                if (next < -maxDrift) return -maxDrift * 0.85;
                return next;
            });
        }, 650);
        return () => clearInterval(timer);
    }, [isOnline, rawBid, digits, chart?.candles?.length]);

    const liveBid = rawBid > 0 ? rawBid + tickOffset : 0;

    const candles = useMemo(() => {
        const src = chart?.candles || [];
        if (src.length === 0 || tickOffset === 0) return src;
        const copy = src.slice();
        const last = copy[copy.length - 1];
        const newClose = last[4] + tickOffset;
        copy[copy.length - 1] = [
            last[0],
            last[1],
            Math.max(last[2], newClose),
            Math.min(last[3], newClose),
            newClose,
        ];
        return copy;
    }, [chart?.candles, tickOffset]);

    const tpLevels = useMemo(() => {
        if (!chart || (chart.tp_dir !== 'UP' && chart.tp_dir !== 'DOWN') || !chart.est_tp_price) {
            return { priceTp0: 0, priceNeg3: 0, priceNeg6: 0 };
        }
        const refPrice = chart.tp_dir === 'UP' ? chart.bid : (chart.ask || chart.bid);
        const deltaP = chart.est_tp_price - refPrice;
        const deltaUsd = targetProfit - cyclePnl;
        if (!refPrice || Math.abs(deltaP) < 1e-7 || Math.abs(deltaUsd) < 1e-4) {
            return { priceTp0: 0, priceNeg3: 0, priceNeg6: 0 };
        }
        const perUnit = deltaUsd / deltaP;
        if (!isFinite(perUnit) || Math.abs(perUnit) < 1e-9) {
            return { priceTp0: 0, priceNeg3: 0, priceNeg6: 0 };
        }
        const priceTp0 = refPrice + (0 - cyclePnl) / perUnit;
        const priceNeg3 = balance > 0 ? refPrice + (-0.03 * balance - cyclePnl) / perUnit : 0;
        const priceNeg6 = balance > 0 ? refPrice + (-0.06 * balance - cyclePnl) / perUnit : 0;
        return { priceTp0, priceNeg3, priceNeg6 };
    }, [chart, targetProfit, cyclePnl, balance]);

    const layout = useMemo(() => {
        if (candles.length === 0) return null;

        let minP = Infinity;
        let maxP = -Infinity;
        for (const [, , h, l] of candles) {
            if (h > maxP) maxP = h;
            if (l < minP) minP = l;
        }

        // Keep candlesticks full-height: only include liveBid and nearby anchor (< 1.2x candle span)
        const candleSpan = Math.max(maxP - minP, 0.0001);
        if (liveBid > 0) {
            if (liveBid > maxP) maxP = liveBid;
            if (liveBid < minP) minP = liveBid;
        }
        if (anchor > 0 && Math.abs(anchor - (maxP + minP) / 2) <= candleSpan * 1.2) {
            if (anchor > maxP) maxP = anchor;
            if (anchor < minP) minP = anchor;
        }

        const pad = Math.max((maxP - minP) * 0.14, 0.01);
        minP -= pad;
        maxP += pad;

        return { minP, maxP };
    }, [candles, liveBid, anchor]);

    if (!chart || candles.length === 0 || !layout) {
        return (
            <Card className="border bg-card/60">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <CandlestickChart className="w-4 h-4 text-primary" />
                        กราฟ {symbol} (M1 Live Trading View)
                    </CardTitle>
                </CardHeader>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    กำลังรอข้อมูลแท่งเทียน M1 จาก MT5 (จะอัปเดตอัตโนมัติในรอบ Live Sync 15 วินาที)...
                </CardContent>
            </Card>
        );
    }

    const formatTime = (unixSec: number) => {
        const d = new Date(unixSec * 1000);
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const hoveredBar = hoverIdx !== null && candles[hoverIdx] ? candles[hoverIdx] : candles[candles.length - 1];

    const renderChartSvg = (W: number, H: number, isMobileSquare: boolean) => {
        const PAD_L = 8;
        const PAD_R = isMobileSquare ? 64 : 80;
        const PAD_T = 14;
        const PAD_B = 22;
        const plotW = W - PAD_L - PAD_R;
        const plotH = H - PAD_T - PAD_B;

        const priceToY = (p: number) => {
            const ratio = (p - layout.minP) / Math.max(layout.maxP - layout.minP, 1e-9);
            return PAD_T + plotH - ratio * plotH;
        };

        const barStep = plotW / candles.length;
        const bodyW = Math.max(2, Math.min(isMobileSquare ? 5.5 : 8, barStep * 0.65));

        const roundStartIdx = chart.round_started > 0
            ? candles.findIndex((c) => c[0] >= chart.round_started)
            : -1;
        const roundStartX = roundStartIdx >= 0 ? PAD_L + roundStartIdx * barStep : -1;

        const renderPriceLine = (
            price: number,
            color: string,
            label: string,
            dashed = true,
            strokeWidth = 1.2
        ) => {
            if (!price || price < layout.minP || price > layout.maxP) return null;
            const y = priceToY(price);
            return (
                <g key={`${label}-${price}`}>
                    <line
                        x1={PAD_L}
                        x2={W - PAD_R}
                        y1={y}
                        y2={y}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={dashed ? '4 3' : undefined}
                        opacity={0.9}
                    />
                    <rect x={W - PAD_R + 2} y={y - 9} width={PAD_R - 4} height={18} rx={4} fill={color} />
                    <text
                        x={W - PAD_R + 5}
                        y={y + 3.5}
                        fontSize={isMobileSquare ? '9' : '10'}
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill="#090d16"
                    >
                        {price.toFixed(digits)}
                    </text>
                    <text
                        x={PAD_L + 5}
                        y={y - 4}
                        fontSize={isMobileSquare ? '9' : '10'}
                        fontFamily="monospace"
                        fontWeight="bold"
                        fill={color}
                    >
                        {label}
                    </text>
                </g>
            );
        };

        return (
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-full block select-none"
                onMouseLeave={() => setHoverIdx(null)}
            >
                {/* Active Trading Round Shading */}
                {roundStartX >= PAD_L && (
                    <>
                        <rect
                            x={roundStartX}
                            y={PAD_T}
                            width={Math.max(0, W - PAD_R - roundStartX)}
                            height={plotH}
                            fill="rgba(34, 211, 238, 0.05)"
                        />
                        <line
                            x1={roundStartX}
                            x2={roundStartX}
                            y1={PAD_T}
                            y2={H - PAD_B}
                            stroke="#22d3ee"
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            opacity={0.5}
                        />
                        <text x={roundStartX + 4} y={PAD_T + 11} fontSize="9" fill="#22d3ee" fontFamily="monospace">
                            ROUND START
                        </text>
                    </>
                )}

                {/* Subtle Horizontal Grid */}
                {[0.2, 0.4, 0.6, 0.8].map((r) => {
                    const p = layout.minP + (layout.maxP - layout.minP) * r;
                    const y = priceToY(p);
                    return (
                        <g key={r}>
                            <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#1e293b" strokeWidth={0.8} />
                            <text x={W - PAD_R + 5} y={y + 3} fontSize="8.5" fill="#64748b" fontFamily="monospace">
                                {p.toFixed(digits)}
                            </text>
                        </g>
                    );
                })}

                {/* Pending Orders (Optional) */}
                {showPending &&
                    chart.orders
                        ?.filter((o) => o.t === 'BS' || o.t === 'SS')
                        .map((o, idx) => {
                            if (o.p < layout.minP || o.p > layout.maxP) return null;
                            const y = priceToY(o.p);
                            return (
                                <line
                                    key={`pend-${idx}`}
                                    x1={PAD_L}
                                    x2={W - PAD_R}
                                    y1={y}
                                    y2={y}
                                    stroke={o.t === 'BS' ? '#38bdf8' : '#fb923c'}
                                    strokeWidth={0.7}
                                    strokeDasharray="2 3"
                                    opacity={0.45}
                                />
                            );
                        })}

                {/* Open Positions: thin/faint lines when POS checked */}
                {showOrders &&
                    chart.orders
                        ?.filter((o) => o.t === 'B' || o.t === 'S')
                        .map((o, idx) => {
                            if (o.p < layout.minP || o.p > layout.maxP) return null;
                            const y = priceToY(o.p);
                            return (
                                <line
                                    key={`pos-${idx}`}
                                    x1={PAD_L}
                                    x2={W - PAD_R}
                                    y1={y}
                                    y2={y}
                                    stroke={o.t === 'B' ? '#22d3ee' : '#f97316'}
                                    strokeWidth={0.55}
                                    strokeDasharray="2 2"
                                    opacity={0.32}
                                />
                            );
                        })}

                {/* M1 Candlesticks */}
                {candles.map(([tm, o, h, l, c], idx) => {
                    const cx = PAD_L + (idx + 0.5) * barStep;
                    const isBull = c >= o;
                    const clr = isBull ? '#10b981' : '#f43f5e';
                    const yHigh = priceToY(h);
                    const yLow = priceToY(l);
                    const yOpen = priceToY(o);
                    const yClose = priceToY(c);
                    const top = Math.min(yOpen, yClose);
                    const bh = Math.max(1.5, Math.abs(yClose - yOpen));

                    return (
                        <g
                            key={tm}
                            onMouseEnter={() => setHoverIdx(idx)}
                            style={{ cursor: 'crosshair' }}
                        >
                            <rect
                                x={PAD_L + idx * barStep}
                                y={PAD_T}
                                width={barStep}
                                height={plotH}
                                fill="transparent"
                            />
                            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={clr} strokeWidth={1.1} />
                            <rect
                                x={cx - bodyW / 2}
                                y={top}
                                width={bodyW}
                                height={bh}
                                fill={clr}
                                rx={0.5}
                            />
                        </g>
                    );
                })}

                {/* Entry Dots rendered AFTER Candlesticks so they always sit ON TOP of candles */}
                {!showOrders &&
                    chart.orders
                        ?.filter((o) => o.t === 'B' || o.t === 'S')
                        .map((o, idx) => {
                            if (o.p < layout.minP || o.p > layout.maxP) return null;
                            const y = priceToY(o.p);
                            let barIdx = candles.findIndex((c) => o.tm >= c[0] && o.tm < c[0] + 60);
                            if (barIdx < 0) {
                                barIdx = o.tm < candles[0][0] ? 0 : candles.length - 1;
                            }
                            const cx = PAD_L + (barIdx + 0.5) * barStep;
                            return (
                                <circle
                                    key={`pos-dot-${idx}`}
                                    cx={cx}
                                    cy={y}
                                    r={isMobileSquare ? 3.2 : 3.8}
                                    fill={o.t === 'B' ? '#22d3ee' : '#fb923c'}
                                    stroke="#050811"
                                    strokeWidth={1.2}
                                    opacity={0.96}
                                />
                            );
                        })}

                {/* Key Reference Overlays */}
                {anchor > 0 && renderPriceLine(anchor, '#f59e0b', 'ANCHOR', true, 1.2)}
                {chart.freeze_price > 0 && frozenSide && frozenSide !== 'NONE' &&
                    renderPriceLine(chart.freeze_price, '#f43f5e', `FREEZE ${frozenSide}`, false, 1.6)}
                {tpLevels.priceNeg6 > 0 &&
                    renderPriceLine(tpLevels.priceNeg6, '#fb7185', 'TP -6%', true, 1.1)}
                {tpLevels.priceNeg3 > 0 &&
                    renderPriceLine(tpLevels.priceNeg3, '#f59e0b', 'TP -3%', true, 1.1)}
                {tpLevels.priceTp0 > 0 &&
                    renderPriceLine(tpLevels.priceTp0, '#38bdf8', 'TP 0 (BE)', true, 1.2)}
                {(chart.tp_dir === 'UP' || chart.tp_dir === 'DOWN') && chart.est_tp_price > 0 &&
                    renderPriceLine(chart.est_tp_price, '#22c55e', `TP (${targetProfit})`, false, 1.8)}
                {renderPriceLine(liveBid, '#e2e8f0', 'BID', true, 1.0)}

                {/* X-Axis Time Labels */}
                {[0, Math.floor(candles.length * 0.33), Math.floor(candles.length * 0.66), candles.length - 1].map((idx) => {
                    if (!candles[idx]) return null;
                    const x = PAD_L + (idx + 0.5) * barStep;
                    return (
                        <text
                            key={`t-${idx}`}
                            x={x}
                            y={H - 6}
                            fontSize="8.5"
                            fill="#64748b"
                            fontFamily="monospace"
                            textAnchor="middle"
                        >
                            {formatTime(candles[idx][0])}
                        </text>
                    );
                })}
            </svg>
        );
    };

    const allLevels = [
        ...(anchor > 0 ? [{ label: 'ANCHOR', price: anchor, colorClass: 'border-amber-500/40 bg-amber-500/15 text-amber-300' }] : []),
        ...(chart.freeze_price > 0 && frozenSide && frozenSide !== 'NONE'
            ? [{ label: `FRZ ${frozenSide}`, price: chart.freeze_price, colorClass: 'border-rose-500/40 bg-rose-500/15 text-rose-300' }]
            : []),
        ...((chart.tp_dir === 'UP' || chart.tp_dir === 'DOWN') && chart.est_tp_price > 0
            ? [{ label: `TP (${targetProfit})`, price: chart.est_tp_price, colorClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300' }]
            : []),
        ...(tpLevels.priceTp0 > 0 ? [{ label: 'TP 0', price: tpLevels.priceTp0, colorClass: 'border-sky-500/40 bg-sky-500/15 text-sky-300' }] : []),
        ...(tpLevels.priceNeg3 > 0 ? [{ label: '-3%', price: tpLevels.priceNeg3, colorClass: 'border-amber-500/40 bg-amber-500/15 text-amber-300' }] : []),
        ...(tpLevels.priceNeg6 > 0 ? [{ label: '-6%', price: tpLevels.priceNeg6, colorClass: 'border-rose-500/40 bg-rose-500/15 text-rose-300' }] : []),
    ];
    const aboveEdgeLevels = allLevels.filter((lv) => lv.price > layout.maxP).sort((a, b) => b.price - a.price);
    const belowEdgeLevels = allLevels.filter((lv) => lv.price < layout.minP).sort((a, b) => b.price - a.price);

    return (
        <Card className="border border-cyan-500/25 bg-[#060a14]/95 text-slate-100 shadow-[0_0_28px_rgba(6,182,212,0.08)] overflow-hidden">
            {/* Separated Header Section (Info + Controls) */}
            <CardHeader className="p-3 sm:p-4 pb-2.5 border-b border-slate-800/80 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-cyan-300">
                            <CandlestickChart className="w-4 h-4 text-cyan-400" />
                            SCANNER // {symbol} M1
                        </CardTitle>
                        {(chart.tp_dir === 'UP' || chart.tp_dir === 'DOWN') && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono text-[10px]">
                                TP {chart.est_tp_price.toFixed(digits)}
                            </Badge>
                        )}
                        {chart.freeze_price > 0 && frozenSide && frozenSide !== 'NONE' && (
                            <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 font-mono text-[10px]">
                                FRZ {frozenSide} {chart.freeze_price.toFixed(digits)}
                            </Badge>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono">
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                            <input
                                type="checkbox"
                                checked={showOrders}
                                onChange={(e) => setShowOrders(e.target.checked)}
                                className="accent-cyan-400"
                            />
                            POS
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                            <input
                                type="checkbox"
                                checked={showPending}
                                onChange={(e) => setShowPending(e.target.checked)}
                                className="accent-cyan-400"
                            />
                            GRID
                        </label>
                    </div>
                </div>

                {/* Single-line Radar & Floating PnL Strip (never wraps on mobile) */}
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono whitespace-nowrap overflow-hidden">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <span className="text-cyan-400 font-bold">
                            B:{openBuy}/{cap}
                        </span>
                        <span className="text-orange-400 font-bold">
                            S:{openSell}/{cap}
                        </span>
                        <span className="text-slate-400">
                            P:{pendBuy}/{pendSell}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 tabular-nums font-bold">
                        {isOnline && (openBuy + openSell) > 0 && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        <span className="text-slate-400 text-[10px]">PNL</span>
                        <span className={liveCyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {liveCyclePnl >= 0 ? '+' : ''}
                            {liveCyclePnl.toFixed(2)} {currency}
                        </span>
                    </div>
                </div>
            </CardHeader>

            {/* Full-bleed Chart Area: 1:1 Square on Mobile, Wide on Desktop */}
            <CardContent className="p-0">
                <div className="relative w-full aspect-square sm:aspect-auto bg-[#0b0f19]">
                    {/* Out-of-range levels docked neatly at TOP edge */}
                    {aboveEdgeLevels.length > 0 && (
                        <div className="absolute top-1.5 left-1.5 right-1.5 z-10 flex flex-wrap gap-1 pointer-events-none font-mono">
                            {aboveEdgeLevels.map((lv) => (
                                <span
                                    key={`top-${lv.label}`}
                                    className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold backdrop-blur-sm ${lv.colorClass}`}
                                >
                                    ↑ {lv.label} {lv.price.toFixed(digits)}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="w-full h-full sm:hidden">
                        {renderChartSvg(420, 420, true)}
                    </div>
                    <div className="hidden sm:block w-full">
                        {renderChartSvg(860, 320, false)}
                    </div>

                    {/* Out-of-range levels docked neatly at BOTTOM edge */}
                    {belowEdgeLevels.length > 0 && (
                        <div className="absolute bottom-6 left-1.5 right-1.5 z-10 flex flex-wrap gap-1 pointer-events-none font-mono">
                            {belowEdgeLevels.map((lv) => (
                                <span
                                    key={`bot-${lv.label}`}
                                    className={`px-1.5 py-0.5 rounded border text-[9.5px] font-bold backdrop-blur-sm ${lv.colorClass}`}
                                >
                                    ↓ {lv.label} {lv.price.toFixed(digits)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
