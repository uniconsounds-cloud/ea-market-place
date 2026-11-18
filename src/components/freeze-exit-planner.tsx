'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Target, ShieldAlert, Sparkles, TrendingUp, RotateCcw } from 'lucide-react';
import type { SmartChartData } from '@/components/smart-vortex-chart';

interface FreezeExitPlannerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    symbol: string;
    currency: string;
    balance: number;
    cyclePnl: number;
    openBuy: number;
    openSell: number;
    frozenSide?: string;
    spacingPoints: number;
    initialLot: number;
    lotIncrement: number;
    currentTp: number;
    currentSl: number;
    chart?: SmartChartData | null;
    sending?: boolean;
    onApply: (newTp: number, newSl: number) => void;
}

interface SimPoint {
    price: number;
    deltaPts: number; // relative to currentPrice
    pnl: number;
    extraTrades: number;
}

export default function FreezeExitPlanner({
    open,
    onOpenChange,
    symbol,
    currency,
    balance,
    cyclePnl,
    openBuy,
    openSell,
    frozenSide = 'NONE',
    spacingPoints,
    initialLot,
    lotIncrement,
    currentTp,
    currentSl,
    chart,
    sending = false,
    onApply,
}: FreezeExitPlannerProps) {
    const [draftTp, setDraftTp] = useState<number>(currentTp);
    const [draftSl, setDraftSl] = useState<number>(currentSl);
    const [activeMode, setActiveMode] = useState<'TP' | 'SL'>('SL');
    const [rangePts, setRangePts] = useState<number>(2000);
    const [showBuyOrders, setShowBuyOrders] = useState<boolean>(true);
    const [showSellOrders, setShowSellOrders] = useState<boolean>(true);

    useEffect(() => {
        if (open) {
            setDraftTp(currentTp);
            setDraftSl(currentSl);
        }
    }, [open, currentTp, currentSl]);

    const digits = chart?.digits ?? 2;
    const pointSize = Math.pow(10, -digits);
    const currentPrice = chart?.bid && chart.bid > 0 ? chart.bid : 0;

    // Calibrate exact broker value per 1.0 price move per 1.0 lot from live orders
    const sim = useMemo(() => {
        const orders = chart?.orders || [];
        const openOrders = orders.filter((o) => o.t === 'B' || o.t === 'S');
        const pendOrders = orders.filter((o) => o.t === 'BS' || o.t === 'SS');

        let buyLot = 0;
        let sellLot = 0;
        let openPnlSum = 0;
        let num = 0;
        let den = 0;

        for (const o of openOrders) {
            if (o.t === 'B') buyLot += o.l;
            else sellLot += o.l;
            if (typeof o.u === 'number') {
                openPnlSum += o.u;
                const dist = currentPrice > 0 ? Math.abs(currentPrice - o.p) : 0;
                if (dist > pointSize * 5 && o.l > 0) {
                    num += Math.abs(o.u);
                    den += dist * o.l;
                }
            }
        }

        let valPerPricePerLot = den > 0 ? num / den : 0;
        if (valPerPricePerLot <= 0 && chart?.est_tp_price && chart.est_tp_price > 0 && currentPrice > 0) {
            const netL = Math.abs(buyLot - sellLot);
            const dPrice = Math.abs(chart.est_tp_price - currentPrice);
            const needed = Math.abs(currentTp - cyclePnl);
            if (netL > 0.0001 && dPrice > pointSize && needed > 0) {
                valPerPricePerLot = needed / (netL * dPrice);
            }
        }
        if (valPerPricePerLot <= 0) {
            valPerPricePerLot = Math.pow(10, digits); // 100 for 2-digit XAUUSD
        }

        const realizedOffset = cyclePnl - openPnlSum;
        const basePrice = currentPrice > 0 ? currentPrice : 3000;
        const stepPts = 50;
        const steps = Math.round(rangePts / stepPts);

        // Build future grid levels for non-frozen side(s)
        const futureBuys: { p: number; l: number }[] = [];
        const futureSells: { p: number; l: number }[] = [];

        if (frozenSide !== 'BUY') {
            for (const o of pendOrders) {
                if (o.t === 'BS') futureBuys.push({ p: o.p, l: o.l });
            }
            futureBuys.sort((a, b) => a.p - b.p);
            const lastBuyP = futureBuys.length > 0
                ? futureBuys[futureBuys.length - 1].p
                : openOrders.filter((o) => o.t === 'B').reduce((m, o) => Math.max(m, o.p), basePrice);
            let idx = openBuy + futureBuys.length;
            const maxUp = basePrice + rangePts * pointSize;
            let p = lastBuyP + spacingPoints * pointSize;
            while (p <= maxUp && futureBuys.length < 40) {
                idx++;
                futureBuys.push({ p, l: initialLot + (idx - 1) * lotIncrement });
                p += spacingPoints * pointSize;
            }
        }

        if (frozenSide !== 'SELL') {
            for (const o of pendOrders) {
                if (o.t === 'SS') futureSells.push({ p: o.p, l: o.l });
            }
            futureSells.sort((a, b) => b.p - a.p);
            const lastSellP = futureSells.length > 0
                ? futureSells[futureSells.length - 1].p
                : openOrders.filter((o) => o.t === 'S').reduce((m, o) => (m === 0 ? o.p : Math.min(m, o.p)), basePrice);
            let idx = openSell + futureSells.length;
            const minDown = basePrice - rangePts * pointSize;
            let p = lastSellP - spacingPoints * pointSize;
            while (p >= minDown && futureSells.length < 40) {
                idx++;
                futureSells.push({ p, l: initialLot + (idx - 1) * lotIncrement });
                p -= spacingPoints * pointSize;
            }
        }

        const evalAt = (targetP: number): { pnl: number; extra: number } => {
            if (openOrders.length === 0) {
                const netTrades = Math.max(1, Math.abs(openBuy - openSell));
                const sign = openBuy >= openSell ? 1 : -1;
                const d = (targetP - basePrice) * sign;
                return { pnl: cyclePnl + d * netTrades * initialLot * valPerPricePerLot, extra: 0 };
            }

            let pnl = realizedOffset;
            for (const o of openOrders) {
                pnl += (o.t === 'B' ? targetP - o.p : o.p - targetP) * o.l * valPerPricePerLot;
            }
            let extra = 0;
            if (targetP > basePrice) {
                for (const fb of futureBuys) {
                    if (targetP >= fb.p) {
                        pnl += (targetP - fb.p) * fb.l * valPerPricePerLot;
                        extra++;
                    }
                }
            } else if (targetP < basePrice) {
                for (const fs of futureSells) {
                    if (targetP <= fs.p) {
                        pnl += (fs.p - targetP) * fs.l * valPerPricePerLot;
                        extra++;
                    }
                }
            }
            return { pnl, extra };
        };

        const points: SimPoint[] = [];
        for (let i = steps; i >= -steps; i--) {
            const deltaPts = i * stepPts;
            const price = basePrice + deltaPts * pointSize;
            const { pnl, extra } = evalAt(price);
            points.push({ price, deltaPts, pnl, extraTrades: extra });
        }

        // Find Max DD point, Break-Even (TP=0) crossing, and min/max PnL
        let maxDdPt = points[0];
        let minPnl = Infinity;
        let maxPnl = -Infinity;
        let bePoint: SimPoint | null = null;

        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            if (pt.pnl < minPnl) {
                minPnl = pt.pnl;
                maxDdPt = pt;
            }
            if (pt.pnl > maxPnl) maxPnl = pt.pnl;

            if (i > 0) {
                const prev = points[i - 1];
                if ((prev.pnl < 0 && pt.pnl >= 0) || (prev.pnl >= 0 && pt.pnl < 0)) {
                    const candidate = Math.abs(pt.pnl) < Math.abs(prev.pnl) ? pt : prev;
                    if (!bePoint || Math.abs(candidate.deltaPts) < Math.abs(bePoint.deltaPts)) {
                        bePoint = candidate;
                    }
                }
            }
        }

        const buyOrderPts: number[] = [];
        const sellOrderPts: number[] = [];
        for (const o of openOrders) {
            const dPts = Math.round((o.p - basePrice) / pointSize);
            if (o.t === 'B') buyOrderPts.push(dPts);
            else if (o.t === 'S') sellOrderPts.push(dPts);
        }

        return {
            points,
            basePrice,
            buyLot,
            sellLot,
            netLot: buyLot - sellLot,
            valPerPricePerLot,
            maxDdPt,
            bePoint,
            buyOrderPts,
            sellOrderPts,
            minPnl: Math.min(minPnl, -100, draftSl < 0 ? draftSl * 1.1 : 0),
            maxPnl: Math.max(maxPnl, 100, draftTp > 0 ? draftTp * 1.2 : 100),
        };
    }, [chart, currentPrice, currentTp, cyclePnl, digits, pointSize, rangePts, frozenSide, openBuy, openSell, spacingPoints, initialLot, lotIncrement, draftSl, draftTp]);

    // SVG dimensions (Portrait-friendly Price-vs-PnL Curve)
    const W = 360;
    const H = 260;
    const PAD_L = 56;
    const PAD_R = 14;
    const PAD_T = 14;
    const PAD_B = 22;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    const xForPnl = (pnl: number) => {
        const span = Math.max(1, sim.maxPnl - sim.minPnl);
        return PAD_L + ((pnl - sim.minPnl) / span) * plotW;
    };
    const yForPts = (deltaPts: number) => {
        return PAD_T + ((rangePts - deltaPts) / (2 * rangePts)) * plotH;
    };

    const zeroX = xForPnl(0);
    const nowY = yForPts(0);
    const nowX = xForPnl(cyclePnl);

    // X-axis PnL Scale ticks
    const xTicks = useMemo(() => {
        const span = sim.maxPnl - sim.minPnl;
        const rawStep = span / 4;
        const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, rawStep))));
        const norm = rawStep / mag;
        const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
        const step = Math.max(50, niceNorm * mag);

        const ticks: number[] = [];
        const start = Math.ceil(sim.minPnl / step) * step;
        for (let v = start; v <= sim.maxPnl; v += step) {
            const rounded = Math.round(v);
            if (Math.abs(rounded) >= step * 0.45) {
                ticks.push(rounded);
            }
        }
        return ticks;
    }, [sim.minPnl, sim.maxPnl]);

    const formatCompactPnl = (v: number) => {
        if (Math.abs(v) >= 1000) {
            const k = v / 1000;
            return `${v > 0 ? '+' : ''}${Number.isInteger(k) ? k : k.toFixed(1)}k`;
        }
        return `${v > 0 ? '+' : ''}${v}`;
    };

    const pathD = sim.points
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xForPnl(pt.pnl).toFixed(1)} ${yForPts(pt.deltaPts).toFixed(1)}`)
        .join(' ');

    // Find closest simulated price/distance for draftTp & draftSl
    const findClosestPoint = (targetPnl: number): SimPoint | null => {
        let best: SimPoint | null = null;
        let bestDiff = Infinity;
        for (const pt of sim.points) {
            const diff = Math.abs(pt.pnl - targetPnl);
            if (diff < bestDiff) {
                bestDiff = diff;
                best = pt;
            }
        }
        return best;
    };

    const tpMatch = useMemo(() => findClosestPoint(draftTp), [sim.points, draftTp]);
    const slMatch = useMemo(() => (draftSl < 0 ? findClosestPoint(draftSl) : null), [sim.points, draftSl]);

    // Smart recommended values
    const recSlBeyondMaxDd = Math.min(-1, Math.round(sim.maxDdPt.pnl * 1.15));
    const recSlMinus3Pct = balance > 0 ? -Math.max(1, Math.round(balance * 0.03)) : -300;
    const recTpHalfDd = cyclePnl < 0 ? Math.round(cyclePnl / 2) : 0;

    const handleChartClick = (e: React.MouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const relY = ((e.clientY - rect.top) / rect.height) * H;
        const clampedY = Math.max(PAD_T, Math.min(H - PAD_B, relY));
        const ratio = (clampedY - PAD_T) / plotH;
        const targetPts = rangePts - ratio * (2 * rangePts);

        let nearest = sim.points[0];
        let bestDist = Infinity;
        for (const pt of sim.points) {
            const d = Math.abs(pt.deltaPts - targetPts);
            if (d < bestDist) {
                bestDist = d;
                nearest = pt;
            }
        }
        const snappedPnl = Math.round(nearest.pnl);
        if (activeMode === 'SL') {
            setDraftSl(snappedPnl < 0 ? snappedPnl : 0);
        } else {
            setDraftTp(snappedPnl);
        }
    };

    const slMin = Math.min(-500, Math.round(sim.minPnl * 1.2), recSlMinus3Pct * 2);
    const tpMin = Math.min(-100, Math.round(sim.minPnl));
    const tpMax = Math.max(100, Math.round(sim.maxPnl));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#060b16] border border-cyan-500/35 text-slate-100 max-w-lg w-[96vw] p-3.5 sm:p-5 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] max-h-[92vh] overflow-y-auto">
                <DialogHeader className="space-y-1 text-left">
                    <DialogTitle className="flex items-center justify-between gap-2 text-sm sm:text-base font-mono text-cyan-300">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            FREEZE EXIT PLANNER
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                                {symbol} | {frozenSide !== 'NONE' ? `FROZEN ${frozenSide}` : 'LIVE SIM'}
                            </span>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] font-mono transition"
                            >
                                ✕ ปิด
                            </button>
                        </div>
                    </DialogTitle>
                    <DialogDescription className="text-[11px] text-slate-400">
                        จำลองเส้นทางกำไร-ขาดทุนจริงตามระยะราคา (±{rangePts} จุด) แตะบนกราฟหรือกดเลือกจุดแนะนำได้เลย
                    </DialogDescription>
                </DialogHeader>

                {/* Live Snapshot Strip */}
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 p-2 font-mono text-[10px] sm:text-[11px]">
                    <div>
                        <div className="text-slate-400">NOW ({currentPrice > 0 ? currentPrice.toFixed(digits) : '--'})</div>
                        <div className={`font-bold ${cyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {cyclePnl >= 0 ? '+' : ''}{cyclePnl.toFixed(1)} {currency}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-400">ไม้ B:{openBuy} / S:{openSell}</div>
                        <div className="font-bold text-sky-300">
                            {sim.netLot >= 0 ? `Net B +${sim.netLot.toFixed(2)}` : `Net S ${sim.netLot.toFixed(2)}`}
                        </div>
                    </div>
                    <div>
                        <div className="text-slate-400">MAX DD SIM</div>
                        <div className="font-bold text-amber-300">
                            {Math.round(sim.maxDdPt.pnl)} ({sim.maxDdPt.deltaPts > 0 ? `+${sim.maxDdPt.deltaPts}` : sim.maxDdPt.deltaPts} pt)
                        </div>
                    </div>
                </div>

                {/* Interactive Mode Selector + Range Zoom */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
                        <button
                            type="button"
                            onClick={() => setActiveMode('SL')}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition ${
                                activeMode === 'SL'
                                    ? 'bg-amber-500/25 text-amber-200 border border-amber-400/60'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            แตะกราฟเลือก SL
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveMode('TP')}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition ${
                                activeMode === 'TP'
                                    ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/60'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            แตะกราฟเลือก TP
                        </button>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[10px]">
                        {[1000, 2000, 3500].map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRangePts(r)}
                                className={`px-1.5 py-1 rounded border ${
                                    rangePts === r
                                        ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                                        : 'border-slate-800 bg-slate-900 text-slate-400'
                                }`}
                            >
                                ±{r}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Order Line Checklist (Toggle Buy / Sell lines) */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 font-mono text-[10px] sm:text-[11px]">
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-sky-300">
                            <input
                                type="checkbox"
                                checked={showBuyOrders}
                                onChange={(e) => setShowBuyOrders(e.target.checked)}
                                className="accent-sky-400 w-3.5 h-3.5 rounded cursor-pointer"
                            />
                            <span>เส้น Buy ({openBuy})</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-orange-300">
                            <input
                                type="checkbox"
                                checked={showSellOrders}
                                onChange={(e) => setShowSellOrders(e.target.checked)}
                                className="accent-orange-400 w-3.5 h-3.5 rounded cursor-pointer"
                            />
                            <span>เส้น Sell ({openSell})</span>
                        </label>
                        {openBuy === 0 && openSell === 0 && (
                            <span className="text-[10px] text-amber-300/80">(พอร์ตว่าง 0 ไม้)</span>
                        )}
                    </div>
                    <span className="text-[10px] text-slate-500">แกนนอน: {currency} | แกนตั้ง: จุด</span>
                </div>

                {/* Price-vs-PnL Simulator SVG */}
                <div className="relative rounded-xl border border-cyan-500/25 bg-[#030710] p-1.5">
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        onClick={handleChartClick}
                        className="w-full h-auto cursor-crosshair select-none touch-manipulation"
                    >
                        {/* Profit Zone Shading (right of 0) */}
                        <rect
                            x={zeroX}
                            y={PAD_T}
                            width={Math.max(0, W - PAD_R - zeroX)}
                            height={plotH}
                            fill="rgba(16, 185, 129, 0.06)"
                        />

                        {/* X-axis PnL Scale Gridlines & Labels */}
                        {xTicks.map((val) => {
                            const tx = xForPnl(val);
                            if (tx < PAD_L + 8 || tx > W - PAD_R - 8) return null;
                            return (
                                <g key={`xt-${val}`}>
                                    <line x1={tx} y1={PAD_T} x2={tx} y2={H - PAD_B} stroke="#1e293b" strokeWidth="0.7" />
                                    <text x={tx} y={H - 6} fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">
                                        {formatCompactPnl(val)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Zero PnL Vertical Line (TP = 0) */}
                        <line x1={zeroX} y1={PAD_T} x2={zeroX} y2={H - PAD_B} stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" opacity="0.65" />
                        <text x={zeroX} y={H - 6} fill="#38bdf8" fontSize="8.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                            0
                        </text>

                        {/* Y-axis Price & Distance Grid */}
                        {[rangePts, Math.round(rangePts / 2), 0, -Math.round(rangePts / 2), -rangePts].map((pts) => {
                            const y = yForPts(pts);
                            return (
                                <g key={pts}>
                                    <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#1e293b" strokeWidth="0.7" />
                                    <text x={PAD_L - 4} y={y + 3} fill={pts === 0 ? '#e2e8f0' : '#64748b'} fontSize="8.5" textAnchor="end" fontFamily="monospace">
                                        {pts === 0 ? 'NOW' : `${pts > 0 ? '+' : ''}${pts}`}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Open Buy Order Lines (Checklist controlled, extending to chart center) */}
                        {showBuyOrders && sim.buyOrderPts.map((dPts, idx) => {
                            if (dPts > rangePts || dPts < -rangePts) return null;
                            const oy = yForPts(dPts);
                            const midX = Math.max(W / 2, PAD_L + plotW * 0.55);
                            return (
                                <line key={`b-${idx}`} x1={PAD_L} y1={oy} x2={midX} y2={oy} stroke="#38bdf8" strokeWidth="0.6" strokeDasharray="3 2" opacity="0.42" />
                            );
                        })}

                        {/* Open Sell Order Lines (Checklist controlled, extending to chart center) */}
                        {showSellOrders && sim.sellOrderPts.map((dPts, idx) => {
                            if (dPts > rangePts || dPts < -rangePts) return null;
                            const oy = yForPts(dPts);
                            const midX = Math.max(W / 2, PAD_L + plotW * 0.55);
                            return (
                                <line key={`s-${idx}`} x1={PAD_L} y1={oy} x2={midX} y2={oy} stroke="#fb923c" strokeWidth="0.6" strokeDasharray="3 2" opacity="0.42" />
                            );
                        })}

                        {/* Simulated PnL Curve */}
                        <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2.2" />

                        {/* Selected SL Horizontal Line */}
                        {draftSl < 0 && slMatch && (
                            <g>
                                <line
                                    x1={PAD_L}
                                    y1={yForPts(slMatch.deltaPts)}
                                    x2={W - PAD_R}
                                    y2={yForPts(slMatch.deltaPts)}
                                    stroke="#f59e0b"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                />
                                <circle cx={xForPnl(slMatch.pnl)} cy={yForPts(slMatch.deltaPts)} r="4" fill="#f59e0b" />
                                <text x={PAD_L + 4} y={yForPts(slMatch.deltaPts) - 4} fill="#fbbf24" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                                    SL {draftSl} ({slMatch.deltaPts > 0 ? `+${slMatch.deltaPts}` : slMatch.deltaPts}pt)
                                </text>
                            </g>
                        )}

                        {/* Selected TP Horizontal Line */}
                        {tpMatch && (
                            <g>
                                <line
                                    x1={PAD_L}
                                    y1={yForPts(tpMatch.deltaPts)}
                                    x2={W - PAD_R}
                                    y2={yForPts(tpMatch.deltaPts)}
                                    stroke="#10b981"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                />
                                <circle cx={xForPnl(tpMatch.pnl)} cy={yForPts(tpMatch.deltaPts)} r="4" fill="#10b981" />
                                <text x={W - PAD_R - 4} y={yForPts(tpMatch.deltaPts) - 4} fill="#34d399" fontSize="8.5" fontWeight="bold" textAnchor="end" fontFamily="monospace">
                                    TP {draftTp >= 0 ? `+${draftTp}` : draftTp} ({tpMatch.deltaPts > 0 ? `+${tpMatch.deltaPts}` : tpMatch.deltaPts}pt)
                                </text>
                            </g>
                        )}

                        {/* Max DD Marker */}
                        <circle cx={xForPnl(sim.maxDdPt.pnl)} cy={yForPts(sim.maxDdPt.deltaPts)} r="3.5" fill="#fb7185" />
                        <text x={xForPnl(sim.maxDdPt.pnl) + 5} y={yForPts(sim.maxDdPt.deltaPts) + 9} fill="#fda4af" fontSize="8" fontFamily="monospace">
                            MAX DD {Math.round(sim.maxDdPt.pnl)}
                        </text>

                        {/* Break-even Marker */}
                        {sim.bePoint && (
                            <g>
                                <circle cx={zeroX} cy={yForPts(sim.bePoint.deltaPts)} r="3.5" fill="#38bdf8" />
                                <text x={zeroX + 5} y={yForPts(sim.bePoint.deltaPts) + 3} fill="#7dd3fc" fontSize="8" fontFamily="monospace">
                                    BE {sim.bePoint.deltaPts > 0 ? `+${sim.bePoint.deltaPts}` : sim.bePoint.deltaPts}pt
                                </text>
                            </g>
                        )}

                        {/* NOW Marker */}
                        <circle cx={nowX} cy={nowY} r="4.5" fill="#ffffff" stroke="#22d3ee" strokeWidth="2" />
                    </svg>
                </div>

                {/* SL Controls */}
                <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="flex items-center gap-1 font-bold text-amber-300">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            FREEZE SL: {draftSl < 0 ? `${draftSl} ${currency}` : 'ปิด (0)'}
                        </span>
                        <span className="text-[10px] text-amber-200/80">
                            {draftSl < 0 && slMatch
                                ? `~${slMatch.price.toFixed(digits)} (${slMatch.deltaPts > 0 ? `+${slMatch.deltaPts}` : slMatch.deltaPts} pt)`
                                : 'ไม่ตัดขาดทุนอัตโนมัติ'}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={slMin}
                        max={0}
                        step={10}
                        value={Math.min(0, draftSl)}
                        onChange={(e) => setDraftSl(Number(e.target.value))}
                        className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftSl(recSlBeyondMaxDd)}
                            className="h-6 text-[10px] px-2 border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
                        >
                            เลย Max DD ({recSlBeyondMaxDd})
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftSl(recSlMinus3Pct)}
                            className="h-6 text-[10px] px-2 border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
                        >
                            -3% พอร์ต ({recSlMinus3Pct})
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftSl(0)}
                            className="h-6 text-[10px] px-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                            ปิด SL (0)
                        </Button>
                    </div>
                </div>

                {/* TP Controls */}
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="flex items-center gap-1 font-bold text-emerald-300">
                            <Target className="w-3.5 h-3.5" />
                            TARGET TP: {draftTp >= 0 ? `+${draftTp}` : draftTp} {currency}
                        </span>
                        <span className="text-[10px] text-emerald-200/80">
                            {tpMatch
                                ? `~${tpMatch.price.toFixed(digits)} (${tpMatch.deltaPts > 0 ? `+${tpMatch.deltaPts}` : tpMatch.deltaPts} pt${tpMatch.extraTrades > 0 ? ` | +${tpMatch.extraTrades} ไม้` : ''})`
                                : ''}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={tpMin}
                        max={tpMax}
                        step={5}
                        value={draftTp}
                        onChange={(e) => setDraftTp(Number(e.target.value))}
                        className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex flex-wrap gap-1.5">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftTp(recTpHalfDd)}
                            className="h-6 text-[10px] px-2 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
                        >
                            DD 50% ({recTpHalfDd})
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftTp(0)}
                            className="h-6 text-[10px] px-2 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/20"
                        >
                            TP = 0 (เท่าทุน)
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftTp(20)}
                            className="h-6 text-[10px] px-2 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/20"
                        >
                            TP +20
                        </Button>
                    </div>
                </div>

                <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs px-3"
                        >
                            ปิด
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setDraftTp(currentTp);
                                setDraftSl(currentSl);
                            }}
                            className="text-slate-400 hover:text-slate-200 text-xs"
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            รีเซ็ต
                        </Button>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        disabled={sending}
                        onClick={() => {
                            onApply(draftTp, draftSl);
                            onOpenChange(false);
                        }}
                        className="bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold hover:opacity-95 text-xs px-4"
                    >
                        <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                        ยืนยันส่ง TP & SL นี้ให้ EA
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
