'use client';

import React, { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface FreezeWhatIfSimulatorProps {
    currency: string;
    balance: number;
    firstDistance: number;
    spacing: number;
    initialLot: number;
    lotIncrement: number;
    stepLotRepeat: number;
    hedgeDDPercent: number;
}

function buildSideTrades(
    count: number,
    sign: 1 | -1,
    firstDist: number,
    spacing: number,
    initLot: number,
    inc: number,
    repeat: number
) {
    const r = Math.max(1, repeat);
    const trades: { priceOffset: number; lot: number }[] = [];
    for (let i = 0; i < count; i++) {
        const priceOffset = sign * (firstDist + i * spacing);
        const lot = initLot + Math.floor(i / r) * inc;
        trades.push({ priceOffset, lot });
    }
    return trades;
}

export function FreezeWhatIfSimulator({
    currency,
    balance,
    firstDistance,
    spacing,
    initialLot,
    lotIncrement,
    stepLotRepeat,
    hedgeDDPercent,
}: FreezeWhatIfSimulatorProps) {
    const [activeCount, setActiveCount] = useState(12);
    const [frozenCount, setFrozenCount] = useState(7);
    const [reversalPts, setReversalPts] = useState(1000);

    const sim = useMemo(() => {
        const safeDist = Math.max(10, firstDistance || 100);
        const safeSpc = Math.max(10, spacing || 60);
        const safeInit = Math.max(0.01, initialLot || 0.01);
        const safeInc = Math.max(0, lotIncrement ?? 0.01);
        const safeRep = Math.max(1, stepLotRepeat || 2);
        const safeBal = balance > 0 ? balance : currency === 'USC' ? 100000 : 10000;
        const ptVal = currency === 'USC' ? 100 : 1;

        const activeTrades = buildSideTrades(activeCount, 1, safeDist, safeSpc, safeInit, safeInc, safeRep);
        const frozenTrades = buildSideTrades(frozenCount, -1, safeDist, safeSpc, safeInit, safeInc, safeRep);

        const activeLots = activeTrades.reduce((s, t) => s + t.lot, 0);
        const frozenLots = frozenTrades.reduce((s, t) => s + t.lot, 0);
        const netLot = activeLots - frozenLots;

        const lastFrozenOffset = frozenTrades.length > 0 ? frozenTrades[frozenTrades.length - 1].priceOffset : 0;

        const calcPnlAtOffset = (priceOffset: number) => {
            let pnl = 0;
            for (const t of activeTrades) {
                pnl += (priceOffset - t.priceOffset) * t.lot * ptVal;
            }
            for (const t of frozenTrades) {
                pnl += (t.priceOffset - priceOffset) * t.lot * ptVal;
            }
            return pnl;
        };

        const pnlAtLastFrozen = calcPnlAtOffset(lastFrozenOffset);
        const pnlAtSelectedRev = calcPnlAtOffset(lastFrozenOffset - reversalPts);
        const ddPctAtSelected = pnlAtSelectedRev < 0 ? (-pnlAtSelectedRev / safeBal) * 100 : 0;

        const riskPct = hedgeDDPercent >= 1 ? hedgeDDPercent : 20;
        const riskLoss = -safeBal * (riskPct / 100);
        const ddPer100Pt = Math.abs(netLot) * ptVal * 100;

        const ptsFromLastFrozenToHedge =
            netLot > 0.0001 ? Math.max(0, (pnlAtLastFrozen - riskLoss) / (netLot * ptVal)) : null;

        return {
            safeBal,
            activeLots,
            frozenLots,
            netLot,
            ddPer100Pt,
            pnlAtLastFrozen,
            pnlAtSelectedRev,
            ddPctAtSelected,
            riskPct,
            ptsFromLastFrozenToHedge,
        };
    }, [activeCount, frozenCount, reversalPts, firstDistance, spacing, initialLot, lotIncrement, stepLotRepeat, balance, currency, hedgeDDPercent]);

    return (
        <div className="space-y-2.5 col-span-2 rounded-lg border border-violet-500/35 bg-slate-950/55 p-2.5 sm:p-3 font-mono">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                    <span className="text-xs sm:text-sm font-semibold text-violet-300 truncate">
                        จำลอง DD ล่วงหน้า (What-If Simulator)
                    </span>
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                    ทุนอ้างอิง: {sim.safeBal.toLocaleString('en-US', { maximumFractionDigits: 0 })} {currency}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                    <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                        <span>ฝั่งนำวิ่งถึง</span>
                        <span className="text-violet-300 font-bold">{activeCount} ไม้ ({sim.activeLots.toFixed(2)})</span>
                    </div>
                    <input
                        type="range"
                        min={10}
                        max={24}
                        step={1}
                        value={activeCount}
                        onChange={(e) => setActiveCount(Number(e.target.value))}
                        className="w-full accent-violet-400 cursor-pointer"
                    />
                </div>

                <div>
                    <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                        <span>ฝั่งตามโดนล็อกที่</span>
                        <span className="text-amber-300 font-bold">{frozenCount} ไม้ ({sim.frozenLots.toFixed(2)})</span>
                    </div>
                    <input
                        type="range"
                        min={5}
                        max={12}
                        step={1}
                        value={frozenCount}
                        onChange={(e) => setFrozenCount(Number(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                    />
                </div>

                <div>
                    <div className="flex justify-between text-[10px] text-slate-300 mb-1">
                        <span>ย้อนเลยไม้ Freeze</span>
                        <span className="text-rose-300 font-bold">-{reversalPts.toLocaleString()} pt</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={5000}
                        step={100}
                        value={reversalPts}
                        onChange={(e) => setReversalPts(Number(e.target.value))}
                        className="w-full accent-rose-400 cursor-pointer"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                <div className="rounded bg-slate-900/70 border border-slate-800 px-2 py-1.5">
                    <div className="text-[10px] text-slate-400">Net Lot</div>
                    <div className="font-bold text-cyan-200">
                        +{sim.netLot.toFixed(2)} (-{sim.ddPer100Pt.toFixed(0)}/100pt)
                    </div>
                </div>
                <div className="rounded bg-slate-900/70 border border-slate-800 px-2 py-1.5">
                    <div className="text-[10px] text-slate-400">DD @ ไม้สุดท้าย Freeze</div>
                    <div className="font-bold text-amber-300">
                        {Math.round(sim.pnlAtLastFrozen).toLocaleString()} {currency}
                    </div>
                </div>
                <div className="rounded bg-slate-900/70 border border-slate-800 px-2 py-1.5">
                    <div className="text-[10px] text-slate-400">DD @ -{reversalPts} pt</div>
                    <div className="font-bold text-rose-300">
                        {Math.round(sim.pnlAtSelectedRev).toLocaleString()} ({sim.ddPctAtSelected.toFixed(1)}%)
                    </div>
                </div>
                <div className="rounded bg-slate-900/70 border border-slate-800 px-2 py-1.5">
                    <div className="text-[10px] text-slate-400">ชน -{sim.riskPct}% Hedge</div>
                    <div className="font-bold text-emerald-300">
                        {sim.ptsFromLastFrozenToHedge !== null
                            ? `ย้อน ${Math.round(sim.ptsFromLastFrozenToHedge).toLocaleString()} pt`
                            : '---'}
                    </div>
                </div>
            </div>
        </div>
    );
}
