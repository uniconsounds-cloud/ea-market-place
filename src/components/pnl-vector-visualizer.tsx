'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Radar, GitCommitHorizontal } from 'lucide-react';
import type { SmartChartData } from './smart-vortex-chart';

interface PnlVectorVisualizerProps {
    currency: string;
    cyclePnl: number;
    targetProfit: number;
    pnlJitter: number;
    chart: SmartChartData | null | undefined;
}

export function PnlVectorVisualizer({
    currency,
    cyclePnl,
    targetProfit,
    pnlJitter,
    chart,
}: PnlVectorVisualizerProps) {
    const data = useMemo(() => {
        const orders = (chart?.orders || []).filter((o) => o.t === 'B' || o.t === 'S');
        const buyOrders = orders.filter((o) => o.t === 'B').sort((a, b) => a.tm - b.tm);
        const sellOrders = orders.filter((o) => o.t === 'S').sort((a, b) => a.tm - b.tm);

        const hasExactSidePnl =
            typeof chart?.buy_pnl === 'number' && typeof chart?.sell_pnl === 'number';

        const buySum = hasExactSidePnl
            ? (chart?.buy_pnl ?? 0)
            : buyOrders.reduce((acc, o) => acc + (o.u ?? 0), 0);
        const sellSum = hasExactSidePnl
            ? (chart?.sell_pnl ?? 0)
            : sellOrders.reduce((acc, o) => acc + (o.u ?? 0), 0);

        const netSum = hasExactSidePnl ? buySum + sellSum + pnlJitter : cyclePnl + pnlJitter;
        const maxMag = Math.max(
            20,
            Math.abs(buySum),
            Math.abs(sellSum),
            Math.abs(targetProfit)
        );
        const maxOrderMag = Math.max(
            2,
            ...orders.map((o) => Math.abs(o.u ?? 0))
        );

        return {
            buyOrders,
            sellOrders,
            buySum,
            sellSum,
            netSum,
            maxMag,
            maxOrderMag,
        };
    }, [chart, cyclePnl, targetProfit, pnlJitter]);

    if (!chart) return null;

    const { buyOrders, sellOrders, buySum, sellSum, netSum, maxMag, maxOrderMag } = data;

    // SVG Model A: Unified Stack
    // Top-to-bottom: [Bn ... B1] -> BUY TOTAL -> NET (CENTER) -> SELL TOTAL -> [S1 ... Sn]
    const W = 440;
    const CX = W / 2;
    const HALF_SPAN = 148;
    const ROW_STEP = 16;

    const buyStackCount = buyOrders.length;
    const sellStackCount = sellOrders.length;
    const TOP_PAD = 24;
    const Y_BUY = TOP_PAD + buyStackCount * ROW_STEP + (buyStackCount > 0 ? 12 : 8);
    const Y_NET = Y_BUY + 38;
    const Y_SELL = Y_NET + 38;
    const SELL_STACK_START = Y_SELL + 20;
    const H_MODEL_A = SELL_STACK_START + sellStackCount * ROW_STEP + 18;

    const clampRatio = (v: number, scale: number) => Math.max(-1, Math.min(1, v / scale));
    const buyX = CX + clampRatio(buySum, maxMag) * HALF_SPAN;
    const sellX = CX - clampRatio(sellSum, maxMag) * HALF_SPAN;

    const oppositeSign = (buySum > 0 && sellSum < 0) || (buySum < 0 && sellSum > 0);
    const netStartX = buyX;
    const netEndX = sellX;

    // SVG Model B: Dual-Arc Radar + Balance Needle (280 x 185)
    const RW = 280;
    const RCX = RW / 2;
    const RCY = 148;
    const RAD = 104;
    const netRatio = Math.max(-1, Math.min(1, netSum / maxMag));
    const needleDeg = netRatio * 78;
    const buyArcRatio = Math.min(1, Math.abs(buySum) / maxMag);
    const sellArcRatio = Math.min(1, Math.abs(sellSum) / maxMag);
    const quarterArcLen = (Math.PI * RAD) / 2;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* ===================================================== */}
            {/* MODEL A: Integrated Buy Stack -> BUY -> NET -> SELL -> Sell Stack */}
            {/* ===================================================== */}
            <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3.5 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
                <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
                        <GitCommitHorizontal className="w-4 h-4 text-cyan-400" />
                        MODEL A // UNIFIED PNL STACK
                    </span>
                    <Badge className="bg-slate-900 text-slate-300 border-slate-700 font-mono text-[10px]">
                        {buyOrders.length}B / {sellOrders.length}S
                    </Badge>
                </div>

                <svg viewBox={`0 0 ${W} ${H_MODEL_A}`} className="w-full h-auto font-mono select-none">
                    {/* Center Zero Axis */}
                    <line x1={CX} y1={16} x2={CX} y2={H_MODEL_A - 8} stroke="#334155" strokeWidth="1.2" strokeDasharray="3 3" />
                    <text x={CX} y={11} textAnchor="middle" fontSize="8.5" fill="#64748b">
                        0.00
                    </text>
                    <text x={CX - HALF_SPAN} y={11} textAnchor="start" fontSize="8" fill="#64748b">
                        B(-) / S(+)
                    </text>
                    <text x={CX + HALF_SPAN} y={11} textAnchor="end" fontSize="8" fill="#64748b">
                        B(+) / S(-)
                    </text>

                    {/* Individual BUY Orders stacked UPWARD above BUY TOTAL (B1 closest to BUY TOTAL) */}
                    {buyOrders.map((o, idx) => {
                        const u = o.u ?? 0;
                        const y = Y_BUY - 18 - idx * ROW_STEP;
                        const xEnd = CX + clampRatio(u, maxOrderMag) * HALF_SPAN;
                        return (
                            <g key={`b-ord-${idx}`}>
                                <line x1={CX - HALF_SPAN} y1={y} x2={CX + HALF_SPAN} y2={y} stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
                                <line
                                    x1={CX}
                                    y1={y}
                                    x2={xEnd}
                                    y2={y}
                                    stroke={u >= 0 ? '#22d3ee' : '#f43f5e'}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    opacity="0.85"
                                />
                                <text x={8} y={y + 3} fontSize="8.5" fill="#38bdf8">
                                    B{idx + 1} <tspan fill="#64748b">{o.l.toFixed(2)}</tspan>
                                </text>
                                <text x={W - 8} y={y + 3} textAnchor="end" fontSize="8.5" fontWeight="bold" fill={u >= 0 ? '#34d399' : '#fb7185'}>
                                    {u >= 0 ? `+${u.toFixed(2)}` : u.toFixed(2)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Connector Guides from BUY Tip & SELL Tip into Center NET Line */}
                    <line x1={buyX} y1={Y_BUY + 5} x2={buyX} y2={Y_NET} stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />
                    <line x1={sellX} y1={Y_SELL - 5} x2={sellX} y2={Y_NET} stroke="#fb923c" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.7" />

                    {/* BUY TOTAL (- Left | + Right) */}
                    <line x1={CX - HALF_SPAN} y1={Y_BUY} x2={CX + HALF_SPAN} y2={Y_BUY} stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                    <line
                        x1={CX}
                        y1={Y_BUY}
                        x2={buyX}
                        y2={Y_BUY}
                        stroke={buySum >= 0 ? '#22d3ee' : '#f43f5e'}
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    <circle cx={buyX} cy={Y_BUY} r="5" fill={buySum >= 0 ? '#22d3ee' : '#f43f5e'} stroke="#050811" strokeWidth="1.5" />
                    <text x={8} y={Y_BUY + 3} fontSize="9.5" fontWeight="bold" fill="#22d3ee">
                        BUY ∑
                    </text>
                    <text x={W - 8} y={Y_BUY + 3} textAnchor="end" fontSize="9.5" fontWeight="bold" fill={buySum >= 0 ? '#34d399' : '#fb7185'}>
                        {buySum >= 0 ? `+${buySum.toFixed(2)}` : buySum.toFixed(2)}
                    </text>

                    {/* NET TOTAL IN THE MIDDLE (Span between buyX and sellX) */}
                    <line x1={CX - HALF_SPAN} y1={Y_NET} x2={CX + HALF_SPAN} y2={Y_NET} stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
                    <line
                        x1={netStartX}
                        y1={Y_NET}
                        x2={netEndX}
                        y2={Y_NET}
                        stroke={netSum >= 0 ? '#10b981' : '#f43f5e'}
                        strokeWidth="10"
                        strokeLinecap="round"
                    />
                    <circle cx={netStartX} cy={Y_NET} r="4.5" fill="#e2e8f0" stroke="#050811" strokeWidth="1.2" />
                    <circle cx={netEndX} cy={Y_NET} r="6.5" fill={netSum >= 0 ? '#10b981' : '#f43f5e'} stroke="#ffffff" strokeWidth="1.5" />
                    <text x={8} y={Y_NET + 3} fontSize="10" fontWeight="bold" fill="#f8fafc">
                        NET
                    </text>
                    <text x={W - 8} y={Y_NET + 4} textAnchor="end" fontSize="10.5" fontWeight="bold" fill={netSum >= 0 ? '#34d399' : '#fb7185'}>
                        {netSum >= 0 ? `+${netSum.toFixed(2)}` : netSum.toFixed(2)}
                    </text>

                    {/* SELL TOTAL (+ Left | - Right, mirrored) */}
                    <line x1={CX - HALF_SPAN} y1={Y_SELL} x2={CX + HALF_SPAN} y2={Y_SELL} stroke="#1e293b" strokeWidth="8" strokeLinecap="round" />
                    <line
                        x1={CX}
                        y1={Y_SELL}
                        x2={sellX}
                        y2={Y_SELL}
                        stroke={sellSum >= 0 ? '#10b981' : '#fb923c'}
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    <circle cx={sellX} cy={Y_SELL} r="5" fill={sellSum >= 0 ? '#10b981' : '#fb923c'} stroke="#050811" strokeWidth="1.5" />
                    <text x={8} y={Y_SELL + 3} fontSize="9.5" fontWeight="bold" fill="#fb923c">
                        SELL ∑
                    </text>
                    <text x={W - 8} y={Y_SELL + 3} textAnchor="end" fontSize="9.5" fontWeight="bold" fill={sellSum >= 0 ? '#34d399' : '#fb7185'}>
                        {sellSum >= 0 ? `+${sellSum.toFixed(2)}` : sellSum.toFixed(2)}
                    </text>

                    {/* Individual SELL Orders stacked DOWNWARD below SELL TOTAL (S1 at top closest to SELL TOTAL) */}
                    {sellOrders.map((o, idx) => {
                        const u = o.u ?? 0;
                        const y = SELL_STACK_START + idx * ROW_STEP;
                        const xEnd = CX - clampRatio(u, maxOrderMag) * HALF_SPAN;
                        return (
                            <g key={`s-ord-${idx}`}>
                                <line x1={CX - HALF_SPAN} y1={y} x2={CX + HALF_SPAN} y2={y} stroke="#0f172a" strokeWidth="4" strokeLinecap="round" />
                                <line
                                    x1={CX}
                                    y1={y}
                                    x2={xEnd}
                                    y2={y}
                                    stroke={u >= 0 ? '#10b981' : '#fb923c'}
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    opacity="0.85"
                                />
                                <text x={8} y={y + 3} fontSize="8.5" fill="#fb923c">
                                    S{idx + 1} <tspan fill="#64748b">{o.l.toFixed(2)}</tspan>
                                </text>
                                <text x={W - 8} y={y + 3} textAnchor="end" fontSize="8.5" fontWeight="bold" fill={u >= 0 ? '#34d399' : '#fb7185'}>
                                    {u >= 0 ? `+${u.toFixed(2)}` : u.toFixed(2)}
                                </text>
                            </g>
                        );
                    })}

                    <text x={CX} y={H_MODEL_A - 4} textAnchor="middle" fontSize="8" fill="#475569">
                        {oppositeSign ? 'CENTER NET = DIFF SPAN' : 'CENTER NET = COMBINED SPAN'}
                    </text>
                </svg>
            </div>

            {/* ===================================================== */}
            {/* MODEL B: Dual-Arc Radar + Central Balance Needle       */}
            {/* ===================================================== */}
            <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3.5 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
                <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
                        <Radar className="w-4 h-4 text-cyan-400" />
                        MODEL B // RADAR NEEDLE
                    </span>
                    <Badge className="bg-slate-900 text-slate-300 border-slate-700 font-mono text-[10px]">
                        {currency}
                    </Badge>
                </div>

                <svg viewBox={`0 0 ${RW} 185`} className="w-full h-auto font-mono select-none">
                    {/* Radar Concentric Rings */}
                    <path
                        d={`M ${RCX - RAD} ${RCY} A ${RAD} ${RAD} 0 0 1 ${RCX + RAD} ${RCY}`}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="10"
                        strokeLinecap="round"
                    />
                    <path
                        d={`M ${RCX - 72} ${RCY} A 72 72 0 0 1 ${RCX + 72} ${RCY}`}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                    />

                    {/* Left Quadrant Arc: BUY */}
                    <path
                        d={`M ${RCX - RAD} ${RCY} A ${RAD} ${RAD} 0 0 1 ${RCX} ${RCY - RAD}`}
                        fill="none"
                        stroke={buySum >= 0 ? '#22d3ee' : '#f43f5e'}
                        strokeWidth="10"
                        strokeDasharray={`${buyArcRatio * quarterArcLen} ${quarterArcLen * 2}`}
                        strokeLinecap="round"
                        opacity="0.9"
                    />
                    {/* Right Quadrant Arc: SELL */}
                    <path
                        d={`M ${RCX + RAD} ${RCY} A ${RAD} ${RAD} 0 0 0 ${RCX} ${RCY - RAD}`}
                        fill="none"
                        stroke={sellSum >= 0 ? '#fb923c' : '#f43f5e'}
                        strokeWidth="10"
                        strokeDasharray={`${sellArcRatio * quarterArcLen} ${quarterArcLen * 2}`}
                        strokeLinecap="round"
                        opacity="0.9"
                    />

                    {/* Labels for Left (BUY) & Right (SELL) */}
                    <text x={24} y={32} fontSize="10" fontWeight="bold" fill="#22d3ee">
                        BUY
                    </text>
                    <text x={24} y={45} fontSize="11" fontWeight="bold" fill={buySum >= 0 ? '#34d399' : '#fb7185'}>
                        {buySum >= 0 ? `+${buySum.toFixed(2)}` : buySum.toFixed(2)}
                    </text>

                    <text x={RW - 24} y={32} textAnchor="end" fontSize="10" fontWeight="bold" fill="#fb923c">
                        SELL
                    </text>
                    <text x={RW - 24} y={45} textAnchor="end" fontSize="11" fontWeight="bold" fill={sellSum >= 0 ? '#34d399' : '#fb7185'}>
                        {sellSum >= 0 ? `+${sellSum.toFixed(2)}` : sellSum.toFixed(2)}
                    </text>

                    {/* Center Zero Tick */}
                    <line x1={RCX} y1={RCY - RAD - 9} x2={RCX} y2={RCY - RAD + 9} stroke="#64748b" strokeWidth="1.5" />

                    {/* Rotating Net Balance Needle */}
                    <g transform={`rotate(${needleDeg} ${RCX} ${RCY})`}>
                        <line
                            x1={RCX}
                            y1={RCY}
                            x2={RCX}
                            y2={RCY - RAD + 16}
                            stroke={netSum >= 0 ? '#10b981' : '#f43f5e'}
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                        <circle cx={RCX} cy={RCY - RAD + 16} r="4" fill={netSum >= 0 ? '#34d399' : '#fb7185'} />
                    </g>
                    <circle cx={RCX} cy={RCY} r="7" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />

                    {/* Digital NET Readout */}
                    <text x={RCX} y={RCY + 20} textAnchor="middle" fontSize="9" fill="#94a3b8">
                        NET SUM
                    </text>
                    <text
                        x={RCX}
                        y={RCY + 34}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="bold"
                        fill={netSum >= 0 ? '#34d399' : '#fb7185'}
                    >
                        {netSum >= 0 ? `+${netSum.toFixed(2)}` : netSum.toFixed(2)} {currency}
                    </text>
                </svg>
            </div>
        </div>
    );
}
