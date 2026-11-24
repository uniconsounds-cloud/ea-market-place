'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, ChevronDown, ShieldAlert } from 'lucide-react';
import type { SmartChartData } from '@/components/smart-vortex-chart';

export interface FreezeRiskRadarCardProps {
    symbol: string;
    currency: string;
    balance: number;
    cyclePnl: number;
    openBuy: number;
    openSell: number;
    frozenSide?: string;
    armedLockTrigger?: number;
    lockOppositeAt?: number;
    targetProfit: number;
    freezeStopLoss?: number;
    hedgeDDPercent?: number;
    enableAutoHedge?: boolean;
    initialLot?: number;
    lotIncrement?: number;
    stepLotRepeat?: number;
    chart?: SmartChartData | null;
    isOnline?: boolean;
    isScanning?: boolean;
}

function calcStepLotSum(count: number, initLot: number, inc: number, repeat: number): number {
    const r = Math.max(1, repeat);
    let sum = 0;
    for (let idx = 0; idx < count; idx++) {
        const step = Math.floor(idx / r);
        sum += initLot + step * inc;
    }
    return sum;
}

export function FreezeRiskRadarCard({
    symbol,
    currency,
    balance,
    cyclePnl,
    openBuy,
    openSell,
    frozenSide,
    armedLockTrigger = 7,
    targetProfit,
    freezeStopLoss = 0,
    hedgeDDPercent = 20,
    enableAutoHedge = false,
    initialLot = 0.01,
    lotIncrement = 0.01,
    stepLotRepeat = 2,
    chart,
    isOnline = false,
    isScanning = false,
}: FreezeRiskRadarCardProps) {
    const [collapsed, setCollapsed] = useState(false);

    const metrics = useMemo(() => {
        const curPrice = chart?.bid || chart?.ask || 0;
        const digits = chart?.digits ?? 2;

        // Calculate exact Buy/Sell open lots from chart.orders when available
        let buyLots = 0;
        let sellLots = 0;
        let hasOrderLots = false;
        if (chart?.orders && chart.orders.length > 0) {
            for (const o of chart.orders) {
                if (o.t === 'B') {
                    buyLots += o.l;
                    hasOrderLots = true;
                } else if (o.t === 'S') {
                    sellLots += o.l;
                    hasOrderLots = true;
                }
            }
        }
        if (!hasOrderLots && (openBuy > 0 || openSell > 0)) {
            buyLots = calcStepLotSum(openBuy, initialLot, lotIncrement, stepLotRepeat);
            sellLots = calcStepLotSum(openSell, initialLot, lotIncrement, stepLotRepeat);
        }

        const netLot = buyLots - sellLots;
        const absNetLot = Math.abs(netLot);
        // XAUUSD standard = $1/pt/lot (or USC = 100 USC/pt/lot, which matches cyclePnl unit)
        // For USC accounts EA reports balance/pnl in USC, where 1 lot XAUUSD = 100 USC/pt? No, 0.01 lot = $0.01/pt = 1 USC/pt!
        // Wait: 1 lot * 1 pt (0.01) = $1 = 100 USC. Since currency === 'USC', balance is in USC (100x USD).
        const pointValuePerLot = currency === 'USC' ? 100 : 1;
        const ddPer100Pt = absNetLot * pointValuePerLot * 100;

        const riskPct = hedgeDDPercent >= 1 ? hedgeDDPercent : 20;
        const safeBal = Math.max(1, balance);
        const riskLossTarget = -safeBal * (riskPct / 100);
        const currDdPct = cyclePnl < 0 ? (-cyclePnl / safeBal) * 100 : 0;

        // Distances in points (reversal against net exposure)
        const valPerPt = absNetLot * pointValuePerLot;
        const ptsToHedge = valPerPt > 0 ? Math.max(0, (cyclePnl - riskLossTarget) / valPerPt) : null;
        const ptsToFreezeSl =
            freezeStopLoss < 0 && valPerPt > 0 ? Math.max(0, (cyclePnl - freezeStopLoss) / valPerPt) : null;
        const ptsToBe = valPerPt > 0 && cyclePnl < 0 ? -cyclePnl / valPerPt : 0;
        const ptsToTp = valPerPt > 0 ? Math.max(0, (targetProfit - cyclePnl) / valPerPt) : null;

        // Forecast curve points: 0, 250, 500, 1000, 1500, 2000, 3000 pt reversal
        const distances = [0, 250, 500, 1000, 1500, 2000, 3000];
        const curve = distances.map((d) => {
            const pnl = cyclePnl - d * valPerPt;
            const ddPct = pnl < 0 ? (-pnl / safeBal) * 100 : 0;
            return { d, pnl, ddPct };
        });

        const isFrozen = frozenSide === 'BUY' || frozenSide === 'SELL';
        const isArmed = !isFrozen && openBuy >= armedLockTrigger && openSell >= armedLockTrigger;

        return {
            curPrice,
            digits,
            buyLots,
            sellLots,
            netLot,
            absNetLot,
            hasOrderLots,
            ddPer100Pt,
            riskPct,
            riskLossTarget,
            currDdPct,
            ptsToHedge,
            ptsToFreezeSl,
            ptsToBe,
            ptsToTp,
            curve,
            isFrozen,
            isArmed,
        };
    }, [
        chart,
        openBuy,
        openSell,
        initialLot,
        lotIncrement,
        stepLotRepeat,
        currency,
        hedgeDDPercent,
        balance,
        cyclePnl,
        freezeStopLoss,
        targetProfit,
        frozenSide,
        armedLockTrigger,
    ]);

    // SVG chart geometry
    const svgW = 420;
    const svgH = 128;
    const padL = 48;
    const padR = 14;
    const padT = 14;
    const padB = 22;
    const plotW = svgW - padL - padR;
    const plotH = svgH - padT - padB;

    const minPnl = Math.min(
        metrics.riskLossTarget * 1.15,
        ...metrics.curve.map((p) => p.pnl),
        -10
    );
    const maxPnl = Math.max(targetProfit, cyclePnl, 10);
    const yRange = Math.max(1, maxPnl - minPnl);
    const mapX = (d: number) => padL + (d / 3000) * plotW;
    const mapY = (pnl: number) => padT + ((maxPnl - pnl) / yRange) * plotH;

    const pathD = metrics.curve
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.d).toFixed(1)} ${mapY(p.pnl).toFixed(1)}`)
        .join(' ');

    const zeroY = mapY(0);
    const hedgeY = mapY(metrics.riskLossTarget);
    const fslY = freezeStopLoss < 0 ? mapY(freezeStopLoss) : null;

    return (
        <Card className="bg-[#070b16]/95 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.08)]">
            <CardHeader className="py-2.5 px-3 sm:px-4 border-b border-slate-800/80">
                <div className="flex items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={() => setCollapsed((v) => !v)}
                        className="flex items-center gap-2 min-w-0 text-left"
                    >
                        <Activity className="w-4 h-4 text-indigo-400 shrink-0" />
                        <CardTitle className="text-xs sm:text-sm font-mono font-bold text-indigo-200 truncate">
                            Freeze DD Risk Radar ({symbol})
                        </CardTitle>
                        <ChevronDown
                            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                        />
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {metrics.isFrozen ? (
                            <Badge variant="destructive" className="font-mono text-[10px] px-1.5 py-0">
                                FROZEN {frozenSide}
                            </Badge>
                        ) : metrics.isArmed ? (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-mono text-[10px] px-1.5 py-0">
                                ARMED {armedLockTrigger}x{armedLockTrigger}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-emerald-300 border-emerald-500/40 font-mono text-[10px] px-1.5 py-0">
                                {isOnline ? 'NORMAL' : 'OFFLINE'}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            {!collapsed && (
                <CardContent className="p-3 sm:p-4 space-y-3 font-mono">
                    {/* Top 3 KPI boxes */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2">
                            <div className="text-[10px] text-slate-400">Net Exposure</div>
                            <div
                                className={`text-xs sm:text-sm font-bold ${
                                    metrics.absNetLot < 0.001
                                        ? 'text-slate-300'
                                        : metrics.netLot > 0
                                        ? 'text-emerald-300'
                                        : 'text-rose-300'
                                }`}
                            >
                                {metrics.absNetLot < 0.001
                                    ? 'BALANCED'
                                    : `${metrics.netLot > 0 ? 'BUY +' : 'SELL -'}${metrics.absNetLot.toFixed(2)}`}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                                B:{metrics.buyLots.toFixed(2)} / S:{metrics.sellLots.toFixed(2)}
                            </div>
                        </div>

                        <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2">
                            <div className="text-[10px] text-slate-400">อัตราไหล DD / 100pt</div>
                            <div className="text-xs sm:text-sm font-bold text-amber-300">
                                {metrics.absNetLot < 0.001
                                    ? `0 ${currency}`
                                    : `-${metrics.ddPer100Pt.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${currency}`}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                                DD ตอนนี้: {metrics.currDdPct.toFixed(2)}%
                            </div>
                        </div>

                        <div className="rounded-lg bg-slate-950/70 border border-slate-800 p-2">
                            <div className="text-[10px] text-slate-400">
                                {enableAutoHedge ? `ระยะถึง Hedge (${metrics.riskPct}%)` : `ระยะอ้างอิง -${metrics.riskPct}%`}
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-rose-300">
                                {metrics.ptsToHedge !== null ? `${Math.round(metrics.ptsToHedge).toLocaleString()} pt` : '---'}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                                {metrics.ptsToTp !== null
                                    ? `ถึง TP: +${Math.round(metrics.ptsToTp).toLocaleString()} pt`
                                    : 'รอ Net Lot'}
                            </div>
                        </div>
                    </div>

                    {/* DD Forecast Curve */}
                    <div className="relative overflow-hidden rounded-lg bg-slate-950/80 border border-slate-800/90 p-2">
                        {isScanning && <div className="sv-scan-beam" aria-hidden="true" />}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>จำลอง DD หากราคาย้อนกลับเข้าหาฝั่ง Freeze (0 → -3,000 pt)</span>
                            {!metrics.hasOrderLots && (openBuy > 0 || openSell > 0) && (
                                <span className="text-amber-400/90">*ประมาณจาก Step-Lot</span>
                            )}
                        </div>
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-32 overflow-visible">
                            {/* Zero line */}
                            {zeroY >= padT && zeroY <= padT + plotH && (
                                <line
                                    x1={padL}
                                    x2={svgW - padR}
                                    y1={zeroY}
                                    y2={zeroY}
                                    stroke="#475569"
                                    strokeDasharray="3 3"
                                    strokeWidth="1"
                                />
                            )}

                            {/* Hedge / Risk DD% threshold line */}
                            {hedgeY >= padT && hedgeY <= padT + plotH && (
                                <>
                                    <line
                                        x1={padL}
                                        x2={svgW - padR}
                                        y1={hedgeY}
                                        y2={hedgeY}
                                        stroke="#f43f5e"
                                        strokeDasharray="4 3"
                                        strokeWidth="1.2"
                                    />
                                    <text x={padL + 4} y={hedgeY - 3} fill="#fda4af" fontSize="9">
                                        {enableAutoHedge ? `Hedge -${metrics.riskPct}%` : `Risk -${metrics.riskPct}%`} (
                                        {Math.round(metrics.riskLossTarget).toLocaleString()})
                                    </text>
                                </>
                            )}

                            {/* Optional Freeze SL line */}
                            {fslY !== null && fslY >= padT && fslY <= padT + plotH && (
                                <line
                                    x1={padL}
                                    x2={svgW - padR}
                                    y1={fslY}
                                    y2={fslY}
                                    stroke="#f59e0b"
                                    strokeDasharray="2 2"
                                    strokeWidth="1"
                                />
                            )}

                            {/* DD Curve */}
                            <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.2" />

                            {/* Curve dots + X labels */}
                            {metrics.curve.map((p) => (
                                <g key={p.d}>
                                    <circle cx={mapX(p.d)} cy={mapY(p.pnl)} r="2.8" fill="#38bdf8" />
                                    {p.d % 500 === 0 && (
                                        <text
                                            x={mapX(p.d)}
                                            y={svgH - 4}
                                            textAnchor="middle"
                                            fill="#94a3b8"
                                            fontSize="9"
                                        >
                                            {p.d === 0 ? 'ตอนนี้' : `-${p.d}`}
                                        </text>
                                    )}
                                </g>
                            ))}

                            {/* Y-axis min/max labels */}
                            <text x={padL - 4} y={padT + 6} textAnchor="end" fill="#94a3b8" fontSize="9">
                                {Math.round(maxPnl)}
                            </text>
                            <text x={padL - 4} y={padT + plotH} textAnchor="end" fill="#fda4af" fontSize="9">
                                {Math.round(minPnl)}
                            </text>
                        </svg>
                    </div>

                    {metrics.ptsToHedge !== null && metrics.ptsToHedge < 500 && metrics.absNetLot >= 0.01 && (
                        <div className="flex items-center gap-1.5 rounded bg-rose-500/15 border border-rose-500/35 px-2.5 py-1.5 text-[11px] text-rose-200">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>
                                ระวัง: ระยะปลอดภัยเหลือ {Math.round(metrics.ptsToHedge)} pt ก่อนถึงระดับ DD -{metrics.riskPct}%
                            </span>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
