'use client';

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crosshair, TrendingDown, TrendingUp } from 'lucide-react';
import type { SmartChartData } from './smart-vortex-chart';

interface BasketRiskAnalyzerProps {
    currency: string;
    cyclePnl: number;
    targetProfit: number;
    openPos: number;
    frozenSide?: string;
    sending: boolean;
    chart: SmartChartData | null | undefined;
    onQuickSetTp: (newTp: number) => void;
}

export function BasketRiskAnalyzer({
    currency,
    cyclePnl,
    targetProfit,
    openPos,
    frozenSide,
    sending,
    chart,
    onQuickSetTp,
}: BasketRiskAnalyzerProps) {
    const analysis = useMemo(() => {
        if (!chart || openPos <= 0) return null;

        const digits = chart.digits ?? 2;
        const pointScale = Math.pow(10, digits);
        const orders = (chart.orders || []).filter((o) => o.t === 'B' || o.t === 'S');

        let buyLot = 0;
        let sellLot = 0;
        for (const o of orders) {
            if (o.t === 'B') buyLot += o.l;
            else if (o.t === 'S') sellLot += o.l;
        }

        const totalLot = buyLot + sellLot;
        const netLot = buyLot - sellLot;
        const isBalanced = Math.abs(netLot) < 0.0001;
        const refPrice = netLot >= 0 ? chart.bid : (chart.ask || chart.bid);

        let pnlPerPriceUnit: number | null = null;
        if (!isBalanced && chart.est_tp_price > 0 && refPrice > 0) {
            const deltaPrice = chart.est_tp_price - refPrice;
            const deltaUsd = targetProfit - cyclePnl;
            if (Math.abs(deltaPrice) > 1e-7 && Math.abs(deltaUsd) > 1e-4) {
                pnlPerPriceUnit = deltaUsd / deltaPrice;
            }
        }

        const breakevenPrice =
            pnlPerPriceUnit !== null && Math.abs(pnlPerPriceUnit) > 1e-9
                ? refPrice + (0 - cyclePnl) / pnlPerPriceUnit
                : null;

        const pointsToBreakeven =
            breakevenPrice !== null
                ? Math.round(Math.abs(breakevenPrice - refPrice) * pointScale)
                : null;

        const pnlAtFreeze =
            chart.freeze_price > 0 && pnlPerPriceUnit !== null
                ? cyclePnl + pnlPerPriceUnit * (chart.freeze_price - refPrice)
                : isBalanced && chart.freeze_price > 0
                ? cyclePnl
                : null;

        const halfLossTp = cyclePnl < -2 ? Math.round(cyclePnl * 0.5) : null;
        const buyRatio = totalLot > 0 ? (buyLot / totalLot) * 100 : 50;

        return {
            digits,
            buyLot,
            sellLot,
            netLot,
            buyRatio,
            isBalanced,
            breakevenPrice,
            pointsToBreakeven,
            pnlAtFreeze,
            halfLossTp,
        };
    }, [chart, openPos, targetProfit, cyclePnl]);

    if (!analysis) return null;

    const {
        digits,
        buyLot,
        sellLot,
        netLot,
        buyRatio,
        isBalanced,
        breakevenPrice,
        pointsToBreakeven,
        pnlAtFreeze,
        halfLossTp,
    } = analysis;

    return (
        <div className="relative rounded-xl border border-cyan-500/25 bg-[#070b16]/90 p-3.5 sm:p-4 shadow-[0_0_24px_rgba(6,182,212,0.06)]">
            {/* Header Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-mono font-bold tracking-widest text-cyan-300 uppercase">
                        EQUILIBRIUM // RISK VECTOR
                    </span>
                </div>
                {isBalanced ? (
                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 font-mono text-[10px]">
                        LOCKED 0.00 LOT
                    </Badge>
                ) : netLot > 0 ? (
                    <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-mono text-[10px] gap-1">
                        <TrendingUp className="w-3 h-3" /> NET +{netLot.toFixed(2)} BUY
                    </Badge>
                ) : (
                    <Badge className="bg-orange-500/15 text-orange-300 border-orange-500/30 font-mono text-[10px] gap-1">
                        <TrendingDown className="w-3 h-3" /> NET {Math.abs(netLot).toFixed(2)} SELL
                    </Badge>
                )}
            </div>

            {/* Dual-Side Lot Equilibrium Bar */}
            <div className="mb-3 space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-cyan-400">BUY {buyLot.toFixed(2)}L</span>
                    <span className="text-slate-500">BALANCE</span>
                    <span className="text-orange-400">SELL {sellLot.toFixed(2)}L</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden flex">
                    <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
                        style={{ width: `${buyRatio}%` }}
                    />
                    <div
                        className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                        style={{ width: `${100 - buyRatio}%` }}
                    />
                </div>
            </div>

            {/* Compact Telemetry Grid */}
            <div className="grid grid-cols-3 gap-2 font-mono">
                <div className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-2.5">
                    <div className="text-[10px] text-slate-400">NET LOT</div>
                    <div className="text-sm font-bold text-slate-100 mt-0.5">
                        {netLot >= 0 ? `+${netLot.toFixed(2)}` : netLot.toFixed(2)}
                    </div>
                </div>

                <div className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-2.5">
                    <div className="text-[10px] text-slate-400">BE // TP 0</div>
                    {isBalanced ? (
                        <div className="text-sm font-bold text-amber-400 mt-0.5">
                            {cyclePnl.toFixed(1)} {currency}
                        </div>
                    ) : breakevenPrice !== null ? (
                        <div className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5">
                            {breakevenPrice.toFixed(digits)}{' '}
                            <span className="text-[10px] text-slate-400">({pointsToBreakeven}p)</span>
                        </div>
                    ) : (
                        <div className="text-sm font-bold text-slate-500 mt-0.5">---</div>
                    )}
                </div>

                <div className="rounded-lg border border-slate-800/90 bg-slate-950/70 p-2.5">
                    <div className="text-[10px] text-slate-400">
                        FLIP DD {frozenSide && frozenSide !== 'NONE' ? `(${frozenSide})` : ''}
                    </div>
                    {pnlAtFreeze !== null && chart?.freeze_price ? (
                        <div
                            className={`text-sm font-bold mt-0.5 ${
                                pnlAtFreeze >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                        >
                            {pnlAtFreeze >= 0 ? '+' : ''}
                            {pnlAtFreeze.toFixed(1)} {currency}
                        </div>
                    ) : (
                        <div className="text-sm font-bold text-slate-500 mt-0.5">---</div>
                    )}
                </div>
            </div>

            {/* Quick Tactical TP Chips */}
            {cyclePnl < 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-400 mr-1">SMART EXIT:</span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={sending}
                        className="h-6 px-2.5 text-[11px] font-mono border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
                        onClick={() => onQuickSetTp(0)}
                    >
                        TP 0
                    </Button>
                    {halfLossTp !== null && (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={sending}
                            className="h-6 px-2.5 text-[11px] font-mono border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                            onClick={() => onQuickSetTp(halfLossTp)}
                        >
                            50% ({halfLossTp})
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={sending}
                        className="h-6 px-2.5 text-[11px] font-mono border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                        onClick={() => onQuickSetTp(20)}
                    >
                        TP +20
                    </Button>
                </div>
            )}
        </div>
    );
}
