'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Radar, GitCommitHorizontal } from 'lucide-react';
import type { SmartChartData } from './smart-vortex-chart';

interface PnlVectorVisualizerProps {
    currency: string;
    cyclePnl: number;
    targetProfit: number;
    pnlJitter: number;
    isOnline?: boolean;
    chart: SmartChartData | null | undefined;
}

export function PnlVectorVisualizer({
    currency,
    cyclePnl,
    targetProfit,
    pnlJitter,
    isOnline = false,
    chart,
}: PnlVectorVisualizerProps) {
    const [bidOffset, setBidOffset] = useState(0);
    const digits = chart?.digits ?? 2;
    const rawBid = chart?.bid ?? 0;

    useEffect(() => {
        setBidOffset(0);
    }, [rawBid]);

    useEffect(() => {
        if (!isOnline || !rawBid) {
            setBidOffset(0);
            return;
        }
        const step = Math.pow(10, -digits) * (digits <= 2 ? 8 : 5);
        const timer = setInterval(() => {
            setBidOffset((prev) => {
                const next = prev + (Math.random() - 0.48) * step * 2.0;
                const cap = step * 5;
                if (next > cap) return cap * 0.85;
                if (next < -cap) return -cap * 0.85;
                return next;
            });
        }, 650);
        return () => clearInterval(timer);
    }, [isOnline, rawBid, digits]);

    const liveBid = rawBid > 0 ? rawBid + bidOffset : 0;

    const data = useMemo(() => {
        const orders = (chart?.orders || []).filter((o) => o.t === 'B' || o.t === 'S');
        // Order Buy ascending by price (lowest Buy closest to BUY sum, highest Buy at top)
        const buyOrders = orders.filter((o) => o.t === 'B').sort((a, b) => a.p - b.p);
        // Order Sell descending by price (highest Sell closest to SELL sum, lowest Sell at bottom)
        const sellOrders = orders.filter((o) => o.t === 'S').sort((a, b) => b.p - a.p);

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

        const buyLot = buyOrders.reduce((acc, o) => acc + (o.l || 0), 0);
        const sellLot = sellOrders.reduce((acc, o) => acc + (o.l || 0), 0);

        return {
            buyOrders,
            sellOrders,
            buyLot,
            sellLot,
            buySum,
            sellSum,
            netSum,
            maxMag,
            maxOrderMag,
        };
    }, [chart, cyclePnl, targetProfit, pnlJitter]);

    if (!chart) return null;

    const { buyOrders, sellOrders, buyLot, sellLot, buySum, sellSum, netSum, maxMag, maxOrderMag } = data;

    // SVG Model A: Tightly-spaced 3 center summary bars + Price-ordered Buy/Sell stacks + Floating BID line
    const W = 440;
    const CX = W / 2;
    const HALF_SPAN = 140;
    const ROW_STEP = 15;

    const buyStackCount = buyOrders.length;
    const sellStackCount = sellOrders.length;
    const TOP_PAD = 28;
    const Y_BUY = TOP_PAD + buyStackCount * ROW_STEP + (buyStackCount > 0 ? 16 : 10);
    const Y_NET = Y_BUY + 11;   // Ultra-tight 11px spacing -> unified center core block
    const Y_SELL = Y_NET + 11;
    const SELL_STACK_START = Y_SELL + 22;
    const H_MODEL_A = SELL_STACK_START + sellStackCount * ROW_STEP + 20;

    const clampRatio = (v: number, scale: number) => Math.max(-1, Math.min(1, v / scale));
    const buyX = CX + clampRatio(buySum, maxMag) * HALF_SPAN;
    const sellX = CX - clampRatio(sellSum, maxMag) * HALF_SPAN;

    const oppositeSign = (buySum > 0 && sellSum < 0) || (buySum < 0 && sellSum > 0);
    const netStartX = buyX;
    const netEndX = sellX;

    // Compute floating horizontal BID line Y position based on actual open trade prices
    const computeBidY = () => {
        if (liveBid <= 0) return null;
        const pts: { p: number; y: number }[] = [];
        // Buy orders (idx 0 = lowest Buy near Y_BUY, idx n-1 = highest Buy at top)
        for (let i = buyOrders.length - 1; i >= 0; i--) {
            pts.push({ p: buyOrders[i].p, y: Y_BUY - 16 - i * ROW_STEP });
        }
        // Sell orders (idx 0 = highest Sell near Y_SELL, idx m-1 = lowest Sell at bottom)
        for (let i = 0; i < sellOrders.length; i++) {
            pts.push({ p: sellOrders[i].p, y: SELL_STACK_START + i * ROW_STEP });
        }
        // Sort strictly by price descending (top -> bottom)
        pts.sort((a, b) => b.p - a.p);

        if (pts.length === 0) return Y_NET;
        if (liveBid >= pts[0].p) {
            return Math.max(18, pts[0].y - 10);
        }
        const last = pts[pts.length - 1];
        if (liveBid <= last.p) {
            return Math.min(H_MODEL_A - 10, last.y + 10);
        }
        for (let i = 0; i < pts.length - 1; i++) {
            const hi = pts[i];
            const lo = pts[i + 1];
            if (liveBid <= hi.p && liveBid >= lo.p) {
                const spanP = Math.max(1e-9, hi.p - lo.p);
                const ratio = (hi.p - liveBid) / spanP;
                return hi.y + ratio * (lo.y - hi.y);
            }
        }
        return Y_NET;
    };

    const bidY = computeBidY();

    // Reusable Sci-Fi Semi-Circular Balance Gauge for Model B (Triple Array)
    const renderSemiGauge = (
        title: string,
        buyVal: number,
        sellVal: number,
        buyLabel: string,
        sellLabel: string,
        centerLabel: string,
        centerColor: string,
        useAbsoluteWeight = true
    ) => {
        const GW = 136;
        const GCX = GW / 2;
        const GCY = 74;
        const GRAD = 50;
        const quarterLen = (Math.PI * GRAD) / 2;

        const wBuy = useAbsoluteWeight ? Math.abs(buyVal) : Math.max(0, buyVal);
        const wSell = useAbsoluteWeight ? Math.abs(sellVal) : Math.max(0, sellVal);
        const totalW = wBuy + wSell;

        // Needle tilts LEFT (-72 deg) when Buy dominates, RIGHT (+72 deg) when Sell dominates, 0 deg when balanced
        const balanceRatio = totalW > 0 ? (wSell - wBuy) / totalW : 0;
        const deg = balanceRatio * 74;
        const buyArc = totalW > 0 ? wBuy / totalW : 0;
        const sellArc = totalW > 0 ? wSell / totalW : 0;

        return (
            <div className="rounded-lg border border-cyan-500/20 bg-slate-950/75 p-2 flex flex-col items-center">
                <div className="text-[9px] font-mono font-bold tracking-widest text-cyan-300/90 uppercase mb-0.5">
                    {title}
                </div>
                <svg viewBox={`0 0 ${GW} 104`} className="w-full h-auto font-mono select-none">
                    {/* Outer Track */}
                    <path
                        d={`M ${GCX - GRAD} ${GCY} A ${GRAD} ${GRAD} 0 0 1 ${GCX + GRAD} ${GCY}`}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="6.5"
                        strokeLinecap="round"
                    />
                    {/* Inner Dotted Radar Ring */}
                    <path
                        d={`M ${GCX - 35} ${GCY} A 35 35 0 0 1 ${GCX + 35} ${GCY}`}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="1"
                        strokeDasharray="2 2.5"
                    />
                    {/* Left Arc: BUY Weight (sweeps from TOP CENTER outward to LEFT) */}
                    <path
                        d={`M ${GCX} ${GCY - GRAD} A ${GRAD} ${GRAD} 0 0 0 ${GCX - GRAD} ${GCY}`}
                        fill="none"
                        stroke="#22d3ee"
                        strokeWidth="6.5"
                        strokeDasharray={`${buyArc * quarterLen} ${quarterLen * 2}`}
                        strokeLinecap="round"
                        opacity="0.92"
                    />
                    {/* Right Arc: SELL Weight (sweeps from TOP CENTER outward to RIGHT) */}
                    <path
                        d={`M ${GCX} ${GCY - GRAD} A ${GRAD} ${GRAD} 0 0 1 ${GCX + GRAD} ${GCY}`}
                        fill="none"
                        stroke="#fb923c"
                        strokeWidth="6.5"
                        strokeDasharray={`${sellArc * quarterLen} ${quarterLen * 2}`}
                        strokeLinecap="round"
                        opacity="0.92"
                    />
                    {/* Top Center Tick */}
                    <line x1={GCX} y1={GCY - GRAD - 5} x2={GCX} y2={GCY - GRAD + 5} stroke="#475569" strokeWidth="1.2" />

                    {/* Rotating Balance Needle */}
                    <g transform={`rotate(${deg} ${GCX} ${GCY})`}>
                        <line
                            x1={GCX}
                            y1={GCY}
                            x2={GCX}
                            y2={GCY - GRAD + 9}
                            stroke={centerColor}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                        />
                        <circle cx={GCX} cy={GCY - GRAD + 9} r="2.6" fill={centerColor} />
                    </g>
                    <circle cx={GCX} cy={GCY} r="4.5" fill="#070b16" stroke="#38bdf8" strokeWidth="1.5" />

                    {/* Buy (Left) & Sell (Right) Values */}
                    <text x={4} y={14} fontSize="8" fontWeight="bold" fill="#22d3ee">
                        B {buyLabel}
                    </text>
                    <text x={GW - 4} y={14} textAnchor="end" fontSize="8" fontWeight="bold" fill="#fb923c">
                        S {sellLabel}
                    </text>

                    {/* Center Summary Readout */}
                    <text x={GCX} y={GCY + 18} textAnchor="middle" fontSize="9.5" fontWeight="bold" fill={centerColor}>
                        {centerLabel}
                    </text>
                </svg>
            </div>
        );
    };

    const netLot = buyLot - sellLot;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* ===================================================== */}
            {/* MODEL A: Unified Stack + Floating Live BID Price Line  */}
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

                    {/* Individual BUY Orders stacked UPWARD above BUY TOTAL (sorted by price ascending) */}
                    {buyOrders.map((o, idx) => {
                        const u = o.u ?? 0;
                        const y = Y_BUY - 16 - idx * ROW_STEP;
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
                                <text x={6} y={y + 3} fontSize="8" fill="#38bdf8">
                                    B{idx + 1} <tspan fill="#64748b">{o.p.toFixed(digits)}</tspan>
                                </text>
                                <text x={W - 6} y={y + 3} textAnchor="end" fontSize="8.5" fontWeight="bold" fill={u >= 0 ? '#34d399' : '#fb7185'}>
                                    {u >= 0 ? `+${u.toFixed(2)}` : u.toFixed(2)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Unified Center Core Block Frame (BUY ∑ + NET + SELL ∑) */}
                    <rect
                        x={2}
                        y={Y_BUY - 9}
                        width={W - 4}
                        height={Y_SELL - Y_BUY + 18}
                        rx={6}
                        fill="rgba(15, 23, 42, 0.72)"
                        stroke="rgba(34, 211, 238, 0.28)"
                        strokeWidth="1"
                    />

                    {/* Connector Guides from BUY Tip & SELL Tip into Center NET Line */}
                    <line x1={buyX} y1={Y_BUY + 3} x2={buyX} y2={Y_NET} stroke="#22d3ee" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.75" />
                    <line x1={sellX} y1={Y_SELL - 3} x2={sellX} y2={Y_NET} stroke="#fb923c" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.75" />

                    {/* BUY TOTAL (- Left | + Right) */}
                    <line x1={CX - HALF_SPAN} y1={Y_BUY} x2={CX + HALF_SPAN} y2={Y_BUY} stroke="#1e293b" strokeWidth="5.5" strokeLinecap="round" />
                    <line
                        x1={CX}
                        y1={Y_BUY}
                        x2={buyX}
                        y2={Y_BUY}
                        stroke={buySum >= 0 ? '#22d3ee' : '#f43f5e'}
                        strokeWidth="5.5"
                        strokeLinecap="round"
                    />
                    <circle cx={buyX} cy={Y_BUY} r="3.5" fill={buySum >= 0 ? '#22d3ee' : '#f43f5e'} stroke="#050811" strokeWidth="1" />
                    <text x={8} y={Y_BUY + 2.8} fontSize="8" fontWeight="bold" fill="#22d3ee">
                        BUY ∑
                    </text>
                    <text x={W - 8} y={Y_BUY + 2.8} textAnchor="end" fontSize="8" fontWeight="bold" fill={buySum >= 0 ? '#34d399' : '#fb7185'}>
                        {buySum >= 0 ? `+${buySum.toFixed(2)}` : buySum.toFixed(2)}
                    </text>

                    {/* NET TOTAL IN THE MIDDLE (Ultra-tight 11px spacing) */}
                    <line x1={CX - HALF_SPAN} y1={Y_NET} x2={CX + HALF_SPAN} y2={Y_NET} stroke="#1e293b" strokeWidth="6.5" strokeLinecap="round" />
                    <line
                        x1={netStartX}
                        y1={Y_NET}
                        x2={netEndX}
                        y2={Y_NET}
                        stroke={netSum >= 0 ? '#10b981' : '#f43f5e'}
                        strokeWidth="6.5"
                        strokeLinecap="round"
                    />
                    <circle cx={netStartX} cy={Y_NET} r="3.2" fill="#e2e8f0" stroke="#050811" strokeWidth="1" />
                    <circle cx={netEndX} cy={Y_NET} r="4.5" fill={netSum >= 0 ? '#10b981' : '#f43f5e'} stroke="#ffffff" strokeWidth="1.2" />
                    <text x={8} y={Y_NET + 2.8} fontSize="8.5" fontWeight="bold" fill="#f8fafc">
                        NET
                    </text>
                    <text x={W - 8} y={Y_NET + 2.8} textAnchor="end" fontSize="8.5" fontWeight="bold" fill={netSum >= 0 ? '#34d399' : '#fb7185'}>
                        {netSum >= 0 ? `+${netSum.toFixed(2)}` : netSum.toFixed(2)}
                    </text>

                    {/* SELL TOTAL (+ Left | - Right, mirrored) */}
                    <line x1={CX - HALF_SPAN} y1={Y_SELL} x2={CX + HALF_SPAN} y2={Y_SELL} stroke="#1e293b" strokeWidth="5.5" strokeLinecap="round" />
                    <line
                        x1={CX}
                        y1={Y_SELL}
                        x2={sellX}
                        y2={Y_SELL}
                        stroke={sellSum >= 0 ? '#10b981' : '#fb923c'}
                        strokeWidth="5.5"
                        strokeLinecap="round"
                    />
                    <circle cx={sellX} cy={Y_SELL} r="3.5" fill={sellSum >= 0 ? '#10b981' : '#fb923c'} stroke="#050811" strokeWidth="1" />
                    <text x={8} y={Y_SELL + 2.8} fontSize="8" fontWeight="bold" fill="#fb923c">
                        SELL ∑
                    </text>
                    <text x={W - 8} y={Y_SELL + 2.8} textAnchor="end" fontSize="8" fontWeight="bold" fill={sellSum >= 0 ? '#34d399' : '#fb7185'}>
                        {sellSum >= 0 ? `+${sellSum.toFixed(2)}` : sellSum.toFixed(2)}
                    </text>

                    {/* Individual SELL Orders stacked DOWNWARD below SELL TOTAL (sorted by price descending) */}
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
                                <text x={6} y={y + 3} fontSize="8" fill="#fb923c">
                                    S{idx + 1} <tspan fill="#64748b">{o.p.toFixed(digits)}</tspan>
                                </text>
                                <text x={W - 6} y={y + 3} textAnchor="end" fontSize="8.5" fontWeight="bold" fill={u >= 0 ? '#34d399' : '#fb7185'}>
                                    {u >= 0 ? `+${u.toFixed(2)}` : u.toFixed(2)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Floating Live Market Price Line overlaid at true relative price position */}
                    {bidY !== null && (
                        <g>
                            <line
                                x1={CX - HALF_SPAN}
                                y1={bidY}
                                x2={CX + HALF_SPAN}
                                y2={bidY}
                                stroke="#facc15"
                                strokeWidth="1.6"
                                strokeDasharray="5 3"
                                opacity="0.95"
                            />
                            <rect
                                x={CX - 42}
                                y={bidY - 7.5}
                                width={84}
                                height={15}
                                rx={4}
                                fill="#facc15"
                                stroke="#050811"
                                strokeWidth="1"
                            />
                            <text
                                x={CX}
                                y={bidY + 3}
                                textAnchor="middle"
                                fontSize="8.5"
                                fontWeight="bold"
                                fill="#050811"
                            >
                                BID {liveBid.toFixed(digits)}
                            </text>
                        </g>
                    )}

                    <text x={CX} y={H_MODEL_A - 4} textAnchor="middle" fontSize="8" fill="#475569">
                        {oppositeSign ? 'CENTER NET = DIFF SPAN' : 'CENTER NET = COMBINED SPAN'}
                    </text>
                </svg>
            </div>

            {/* ===================================================== */}
            {/* MODEL B: 3 Sci-Fi Semi-Circular Balance Dials (L -> R) */}
            {/* ===================================================== */}
            <div className="rounded-xl border border-cyan-500/25 bg-[#070b16]/95 p-3.5 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
                <div className="flex items-center justify-between mb-2.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-widest text-cyan-300 uppercase">
                        <Radar className="w-4 h-4 text-cyan-400" />
                        MODEL B // TRIPLE BALANCE RADAR
                    </span>
                    <Badge className="bg-slate-900 text-slate-300 border-slate-700 font-mono text-[10px]">
                        B vs S ({currency})
                    </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    {renderSemiGauge(
                        'ORDERS',
                        buyOrders.length,
                        sellOrders.length,
                        `${buyOrders.length}`,
                        `${sellOrders.length}`,
                        `${buyOrders.length}:${sellOrders.length}`,
                        '#38bdf8',
                        false
                    )}
                    {renderSemiGauge(
                        'DD / PNL',
                        buySum,
                        sellSum,
                        buySum >= 0 ? `+${buySum.toFixed(0)}` : buySum.toFixed(0),
                        sellSum >= 0 ? `+${sellSum.toFixed(0)}` : sellSum.toFixed(0),
                        netSum >= 0 ? `+${netSum.toFixed(1)}` : netSum.toFixed(1),
                        netSum >= 0 ? '#34d399' : '#fb7185',
                        true
                    )}
                    {renderSemiGauge(
                        'LOTS',
                        buyLot,
                        sellLot,
                        buyLot.toFixed(2),
                        sellLot.toFixed(2),
                        `${netLot >= 0 ? '+' : ''}${netLot.toFixed(2)}L`,
                        Math.abs(netLot) < 0.001 ? '#facc15' : netLot > 0 ? '#22d3ee' : '#fb923c',
                        false
                    )}
                </div>
            </div>
        </div>
    );
}
