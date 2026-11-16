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
        const sameSign = (buySum >= 0 && sellSum >= 0) || (buySum <= 0 && sellSum <= 0);
        const maxMag = Math.max(
            20,
            Math.abs(buySum),
            Math.abs(sellSum),
            sameSign ? Math.abs(buySum) + Math.abs(sellSum) : Math.abs(netSum),
            Math.abs(targetProfit)
        );
        const maxOrderMag = Math.max(
            5,
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

    // SVG Model A: 3 Parallel Differential Axes (420 x 195)
    // BUY:  - Left  | + Right
    // SELL: + Left  | - Right (mirrored so opposite signs align on the same side!)
    // NET:  Span between buyX & sellX when opposite signs; combined sum from 0 when same sign
    const W = 420;
    const CX = W / 2;
    const HALF_SPAN = 158;
    const clampRatio = (v: number) => Math.max(-1, Math.min(1, v / maxMag));
    const buyX = CX + clampRatio(buySum) * HALF_SPAN;
    const sellX = CX - clampRatio(sellSum) * HALF_SPAN;

    const oppositeSign = (buySum > 0 && sellSum < 0) || (buySum < 0 && sellSum > 0);
    const netStartX = oppositeSign ? buyX : CX;
    const netEndX = oppositeSign ? sellX : CX + clampRatio(netSum) * HALF_SPAN;

    const Y_BUY = 46;
    const Y_SELL = 96;
    const Y_NET = 152;

    // SVG Model B: Dual-Arc Radar + Balance Needle (280 x 185)
    const RW = 280;
    const RCX = RW / 2;
    const RCY = 148;
    const RAD = 104;
    // Needle angle: -75 deg (left / negative) to +75 deg (right / positive), 0 deg = straight up
    const netRatio = Math.max(-1, Math.min(1, netSum / maxMag));
    const needleDeg = netRatio * 78;
    const buyArcRatio = Math.min(1, Math.abs(buySum) / maxMag);
    const sellArcRatio = Math.min(1, Math.abs(sellSum) / maxMag);
    const quarterArcLen = (Math.PI * RAD) / 2; // 90 deg arc

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ===================================================== */}
                {/* MODEL A: Bipolar Vector Axis + Net Sum Convergence     */}
                {/* ===================================================== */}
                <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3.5 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
                            <GitCommitHorizontal className="w-4 h-4 text-cyan-400" />
                            MODEL A // DIFFERENTIAL SPAN
                        </span>
                        <Badge className="bg-slate-900 text-slate-300 border-slate-700 font-mono text-[10px]">
                            B(-/+) vs S(+/-) → NET
                        </Badge>
                    </div>

                    <svg viewBox={`0 0 ${W} 185`} className="w-full h-auto font-mono select-none">
                        {/* Center Zero Axis */}
                        <line x1={CX} y1={22} x2={CX} y2={170} stroke="#334155" strokeWidth="1.2" strokeDasharray="3 3" />
                        <text x={CX} y={14} textAnchor="middle" fontSize="9" fill="#64748b">
                            0.00
                        </text>
                        <text x={CX - HALF_SPAN} y={14} textAnchor="start" fontSize="8.5" fill="#94a3b8">
                            B(-) / S(+)
                        </text>
                        <text x={CX + HALF_SPAN} y={14} textAnchor="end" fontSize="8.5" fill="#94a3b8">
                            B(+) / S(-)
                        </text>

                        {/* Vertical Drop Guides from Buy Tip & Sell Tip down to Net Line */}
                        <line
                            x1={buyX}
                            y1={Y_BUY + 5}
                            x2={buyX}
                            y2={Y_NET}
                            stroke="#22d3ee"
                            strokeWidth="1.1"
                            strokeDasharray="3 3"
                            opacity="0.65"
                        />
                        <line
                            x1={sellX}
                            y1={Y_SELL + 5}
                            x2={sellX}
                            y2={Y_NET}
                            stroke="#fb923c"
                            strokeWidth="1.1"
                            strokeDasharray="3 3"
                            opacity="0.65"
                        />

                        {/* Row 1: BUY (- Left | + Right) */}
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
                        <text x={10} y={Y_BUY + 3} fontSize="10" fontWeight="bold" fill="#22d3ee">
                            BUY
                        </text>
                        <text x={W - 8} y={Y_BUY + 3} textAnchor="end" fontSize="10" fontWeight="bold" fill={buySum >= 0 ? '#34d399' : '#fb7185'}>
                            {buySum >= 0 ? `+${buySum.toFixed(2)}` : buySum.toFixed(2)}
                        </text>

                        {/* Row 2: SELL (+ Left | - Right) */}
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
                        <text x={10} y={Y_SELL + 3} fontSize="10" fontWeight="bold" fill="#fb923c">
                            SELL
                        </text>
                        <text x={W - 8} y={Y_SELL + 3} textAnchor="end" fontSize="10" fontWeight="bold" fill={sellSum >= 0 ? '#34d399' : '#fb7185'}>
                            {sellSum >= 0 ? `+${sellSum.toFixed(2)}` : sellSum.toFixed(2)}
                        </text>

                        {/* Row 3: NET SUM (Difference span [buyX..sellX] or Combined sum from 0) */}
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
                        <text x={10} y={Y_NET + 3} fontSize="10" fontWeight="bold" fill="#e2e8f0">
                            NET
                        </text>
                        <text x={W - 8} y={Y_NET + 4} textAnchor="end" fontSize="11" fontWeight="bold" fill={netSum >= 0 ? '#34d399' : '#fb7185'}>
                            {netSum >= 0 ? `+${netSum.toFixed(2)}` : netSum.toFixed(2)}
                        </text>
                        <text x={CX} y={177} textAnchor="middle" fontSize="8.5" fill="#64748b">
                            {oppositeSign ? 'DIFF SPAN (BUY ↔ SELL)' : 'COMBINED SUM (FROM 0)'}
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

            {/* Per-Trade +/- Matrix (Individual Buy & Sell Open Orders) */}
            {(buyOrders.length > 0 || sellOrders.length > 0) && (
                <div className="rounded-xl border border-cyan-500/20 bg-[#070b16]/90 p-3 font-mono">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                            PER-TRADE PNL MATRIX ({buyOrders.length}B / {sellOrders.length}S)
                        </span>
                        <span className="text-[10px] text-slate-500">EXACT MT5 + SWAP</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Buy Trades */}
                        <div className="space-y-1">
                            {buyOrders.map((o, i) => {
                                const u = o.u ?? 0;
                                const pct = Math.min(100, (Math.abs(u) / maxOrderMag) * 100);
                                return (
                                    <div key={`b-${i}`} className="flex items-center gap-2 text-[10px]">
                                        <span className="w-7 text-cyan-400 font-bold">B{i + 1}</span>
                                        <span className="w-10 text-slate-400">{o.l.toFixed(2)}</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                                            <div
                                                className={`h-full ${u >= 0 ? 'bg-emerald-400' : 'bg-rose-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className={`w-14 text-right font-bold tabular-nums ${u >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {u >= 0 ? `+${u.toFixed(2)}` : u.toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Sell Trades */}
                        <div className="space-y-1">
                            {sellOrders.map((o, i) => {
                                const u = o.u ?? 0;
                                const pct = Math.min(100, (Math.abs(u) / maxOrderMag) * 100);
                                return (
                                    <div key={`s-${i}`} className="flex items-center gap-2 text-[10px]">
                                        <span className="w-7 text-orange-400 font-bold">S{i + 1}</span>
                                        <span className="w-10 text-slate-400">{o.l.toFixed(2)}</span>
                                        <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
                                            <div
                                                className={`h-full ${u >= 0 ? 'bg-emerald-400' : 'bg-rose-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className={`w-14 text-right font-bold tabular-nums ${u >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {u >= 0 ? `+${u.toFixed(2)}` : u.toFixed(2)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
