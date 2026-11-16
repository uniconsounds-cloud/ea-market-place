'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CandlestickChart } from 'lucide-react';

export interface ChartOrderItem {
    t: 'B' | 'S' | 'BS' | 'SS';
    p: number;
    l: number;
    tm: number;
}

export interface SmartChartData {
    digits: number;
    bid: number;
    ask: number;
    round_started: number;
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
    chart: SmartChartData | null | undefined;
}

export function SmartVortexChart({
    symbol,
    currency,
    anchor,
    targetProfit,
    frozenSide,
    isOnline = false,
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

    const layout = useMemo(() => {
        if (candles.length === 0) return null;

        let minP = Infinity;
        let maxP = -Infinity;
        for (const [, , h, l] of candles) {
            if (h > maxP) maxP = h;
            if (l < minP) minP = l;
        }

        const includePrice = (p: number) => {
            if (p > 0 && isFinite(p)) {
                // Only expand bounds if reasonably close to current range (within 3x candle span)
                const span = Math.max(maxP - minP, 0.0001);
                if (Math.abs(p - (maxP + minP) / 2) <= span * 3.5) {
                    if (p > maxP) maxP = p;
                    if (p < minP) minP = p;
                }
            }
        };

        if (liveBid > 0) includePrice(liveBid);
        if (anchor > 0) includePrice(anchor);
        if (chart?.est_tp_price && chart.est_tp_price > 0) includePrice(chart.est_tp_price);
        if (chart?.freeze_price && chart.freeze_price > 0) includePrice(chart.freeze_price);
        if (showOrders && chart?.orders) {
            for (const o of chart.orders) {
                if (o.t === 'B' || o.t === 'S') includePrice(o.p);
            }
        }

        const pad = Math.max((maxP - minP) * 0.12, 0.01);
        minP -= pad;
        maxP += pad;

        return { minP, maxP };
    }, [candles, chart, anchor, showOrders]);

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

    const W = 860;
    const H = 320;
    const PAD_L = 12;
    const PAD_R = 82;
    const PAD_T = 16;
    const PAD_B = 26;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const priceToY = (p: number) => {
        const ratio = (p - layout.minP) / Math.max(layout.maxP - layout.minP, 1e-9);
        return PAD_T + plotH - ratio * plotH;
    };

    const barStep = plotW / candles.length;
    const bodyW = Math.max(2, Math.min(8, barStep * 0.62));

    const roundStartIdx = chart.round_started > 0
        ? candles.findIndex((c) => c[0] >= chart.round_started)
        : -1;
    const roundStartX = roundStartIdx >= 0 ? PAD_L + roundStartIdx * barStep : -1;

    const formatTime = (unixSec: number) => {
        const d = new Date(unixSec * 1000);
        return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const hoveredBar = hoverIdx !== null && candles[hoverIdx] ? candles[hoverIdx] : candles[candles.length - 1];

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
                    x={W - PAD_R + 6}
                    y={y + 3.5}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                    fill="#090d16"
                >
                    {price.toFixed(digits)}
                </text>
                <text
                    x={PAD_L + 6}
                    y={y - 4}
                    fontSize="10"
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
        <Card className="border border-cyan-500/25 bg-[#060a14]/95 text-slate-100 shadow-[0_0_28px_rgba(6,182,212,0.08)]">
            <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="flex items-center gap-2 text-xs sm:text-sm font-mono tracking-widest uppercase text-cyan-300">
                        <CandlestickChart className="w-4 h-4 text-cyan-400" />
                        SCANNER // {symbol} M1
                    </CardTitle>
                    {chart.tp_dir === 'UP' || chart.tp_dir === 'DOWN' ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-mono text-[11px]">
                            TP Target ({targetProfit} {currency}): {chart.est_tp_price.toFixed(digits)}
                        </Badge>
                    ) : chart.tp_dir === 'HEDGED' ? (
                        <Badge variant="outline" className="text-amber-300 border-amber-500/30 text-[11px]">
                            Net Lot = 0 (Hedged)
                        </Badge>
                    ) : null}
                    {chart.freeze_price > 0 && frozenSide && frozenSide !== 'NONE' && (
                        <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 font-mono text-[11px]">
                            Freeze {frozenSide} @ {chart.freeze_price.toFixed(digits)}
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
            </CardHeader>

            <CardContent className="pt-0 space-y-2">
                {/* OHLC Bar Info */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 px-1">
                    <span>{formatTime(hoveredBar[0])}</span>
                    <span>O: <strong className="text-slate-200">{hoveredBar[1].toFixed(digits)}</strong></span>
                    <span>H: <strong className="text-emerald-400">{hoveredBar[2].toFixed(digits)}</strong></span>
                    <span>L: <strong className="text-rose-400">{hoveredBar[3].toFixed(digits)}</strong></span>
                    <span>C: <strong className="text-slate-200">{hoveredBar[4].toFixed(digits)}</strong></span>
                    <span className="ml-auto flex items-center gap-1.5 text-cyan-300">
                        {isOnline && (
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        Bid: {liveBid.toFixed(digits)}
                    </span>
                </div>

                <div className="w-full overflow-hidden rounded-lg border border-slate-800 bg-[#0b0f19]">
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        className="w-full h-auto select-none"
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
                                    <text x={W - PAD_R + 6} y={y + 3} fontSize="9" fill="#64748b" fontFamily="monospace">
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

                        {/* Open Positions */}
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
                                            strokeWidth={0.9}
                                            opacity={0.75}
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

                        {/* Key Reference Overlays */}
                        {anchor > 0 && renderPriceLine(anchor, '#f59e0b', 'ANCHOR', true, 1.2)}
                        {chart.freeze_price > 0 && frozenSide && frozenSide !== 'NONE' &&
                            renderPriceLine(chart.freeze_price, '#f43f5e', `FREEZE ${frozenSide}`, false, 1.6)}
                        {(chart.tp_dir === 'UP' || chart.tp_dir === 'DOWN') && chart.est_tp_price > 0 &&
                            renderPriceLine(chart.est_tp_price, '#22c55e', `TP TARGET ($${targetProfit})`, false, 1.8)}
                        {renderPriceLine(liveBid, '#e2e8f0', 'BID', true, 1.0)}

                        {/* X-Axis Time Labels */}
                        {[0, Math.floor(candles.length * 0.33), Math.floor(candles.length * 0.66), candles.length - 1].map((idx) => {
                            if (!candles[idx]) return null;
                            const x = PAD_L + (idx + 0.5) * barStep;
                            return (
                                <text
                                    key={`t-${idx}`}
                                    x={x}
                                    y={H - 8}
                                    fontSize="9"
                                    fill="#64748b"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                >
                                    {formatTime(candles[idx][0])}
                                </text>
                            );
                        })}
                    </svg>
                </div>
            </CardContent>
        </Card>
    );
}
