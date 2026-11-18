'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { SmartChartData } from '@/components/smart-vortex-chart';
import type { RoundHistoryTuple } from '@/components/round-history-bar';

interface SmartTacticalOverviewProps {
    port: string;
    symbol: string;
    currency: string;
    openBuy: number;
    openSell: number;
    cap: number;
    frozenSide?: string;
    protectionFrozen?: boolean;
    liveCyclePnl: number;
    targetProfit: number;
    freezeStopLoss: number;
    spacingPoints: number;
    initialLot: number;
    lotIncrement: number;
    chart?: SmartChartData | null;
    roundHistory?: RoundHistoryTuple[] | null;
}

export default function SmartTacticalOverview({
    port,
    symbol,
    currency,
    openBuy,
    openSell,
    cap,
    frozenSide = 'NONE',
    protectionFrozen = false,
    liveCyclePnl,
    targetProfit,
    freezeStopLoss,
    spacingPoints,
    initialLot,
    lotIncrement,
    chart,
    roundHistory,
}: SmartTacticalOverviewProps) {
    const safeCap = Math.max(1, cap || 7);
    const isBuyFrozen = protectionFrozen && frozenSide === 'BUY';
    const isSellFrozen = protectionFrozen && frozenSide === 'SELL';
    const digits = chart?.digits ?? 2;
    const pointSize = Math.pow(10, -digits);

    // Track highest/extreme PnL of the day in localStorage
    const [peakPnlToday, setPeakPnlToday] = useState<number>(liveCyclePnl);

    const bkkDayKey = useMemo(() => {
        const now = new Date();
        // Trading day starts at 05:00 Bangkok (UTC+7 => 22:00 UTC previous day)
        const shifted = new Date(now.getTime() + (7 - 5) * 3600 * 1000);
        return shifted.toISOString().slice(0, 10);
    }, []);

    useEffect(() => {
        if (!port) return;
        const storageKey = `sv_peak_pnl_${port}_${bkkDayKey}`;
        try {
            const raw = localStorage.getItem(storageKey);
            const prev = raw !== null ? parseFloat(raw) : NaN;
            // Track highest magnitude (or highest positive / deepest excursion)
            const nextPeak = isNaN(prev)
                ? liveCyclePnl
                : liveCyclePnl < 0
                ? Math.min(prev, liveCyclePnl)
                : Math.max(prev, liveCyclePnl);
            setPeakPnlToday(nextPeak);
            localStorage.setItem(storageKey, String(nextPeak));
        } catch {
            setPeakPnlToday(liveCyclePnl);
        }
    }, [port, bkkDayKey, liveCyclePnl]);

    // Compute Total Lots, Today's Profit, and Trade Level where TP=0 and TP=targetProfit occur
    const metrics = useMemo(() => {
        const orders = chart?.orders || [];
        let buyLot = 0;
        let sellLot = 0;
        for (const o of orders) {
            if (o.t === 'B') buyLot += o.l;
            else if (o.t === 'S') sellLot += o.l;
        }
        // Fallback lot calculation from arithmetic progression if chart orders aren't loaded yet
        if (buyLot === 0 && openBuy > 0) {
            buyLot = openBuy * initialLot + ((openBuy * (openBuy - 1)) / 2) * lotIncrement;
        }
        if (sellLot === 0 && openSell > 0) {
            sellLot = openSell * initialLot + ((openSell * (openSell - 1)) / 2) * lotIncrement;
        }
        const totalLot = buyLot + sellLot;
        const totalTrades = openBuy + openSell;

        // Today's closed profit (since 05:00 AM Bangkok time)
        const now = new Date();
        const bkkNowMs = now.getTime() + 7 * 3600 * 1000;
        const bkkDate = new Date(bkkNowMs);
        const minsSince0500 = ((bkkDate.getUTCHours() * 60 + bkkDate.getUTCMinutes()) - 300 + 1440) % 1440;
        const startOfTradingDayUnix = Math.floor((now.getTime() - minsSince0500 * 60 * 1000) / 1000);

        let todayProfit = 0;
        if (Array.isArray(roundHistory)) {
            for (const r of roundHistory) {
                if (Array.isArray(r) && Number(r[0]) >= startOfTradingDayUnix) {
                    todayProfit += Number(r[2]) || 0;
                }
            }
        }

        // Determine active/dominant side for Section 2 TP & TP=0 trade-level markers
        // If Buy is frozen -> Sell is active side; if Sell is frozen -> Buy is active side; else side with more trades
        const activeSide: 'BUY' | 'SELL' = isBuyFrozen
            ? 'SELL'
            : isSellFrozen
            ? 'BUY'
            : openBuy >= openSell
            ? 'BUY'
            : 'SELL';

        const activeCount = activeSide === 'BUY' ? openBuy : openSell;
        const oppCount = activeSide === 'BUY' ? openSell : openBuy;
        const spc = Math.max(10, spacingPoints || 100);
        const valPerPtPer001 = 0.01; // 100 pts * 0.01 lot = 1.00 unit

        // Simulate adding trades m = activeCount .. 30 on activeSide to find where PnL crosses 0 (BE) and targetProfit (TP)
        let beTradeLevel: number | null = null;
        let tpTradeLevel: number | null = null;

        if (totalTrades > 0) {
            let simPnl = liveCyclePnl;
            let curActiveLot = activeSide === 'BUY' ? buyLot : sellLot;
            const curOppLot = activeSide === 'BUY' ? sellLot : buyLot;

            for (let m = Math.max(1, activeCount); m <= 35; m++) {
                if (m > activeCount) {
                    const newLot = initialLot + (m - 1) * lotIncrement;
                    const netLotBeforeStep = curActiveLot - curOppLot;
                    // Moving 1 spacing step in active direction changes PnL by netLot * spc * 100 * valPerPtPer001
                    simPnl += (netLotBeforeStep / 0.01) * spc * valPerPtPer001;
                    curActiveLot += newLot;
                }
                if (beTradeLevel === null && simPnl >= 0) {
                    beTradeLevel = m;
                }
                if (tpTradeLevel === null && simPnl >= targetProfit) {
                    tpTradeLevel = m;
                }
            }
        } else {
            beTradeLevel = 1;
            tpTradeLevel = 2;
        }

        return {
            buyLot,
            sellLot,
            totalLot,
            totalTrades,
            todayProfit,
            activeSide,
            beTradeLevel,
            tpTradeLevel,
        };
    }, [chart?.orders, openBuy, openSell, initialLot, lotIncrement, roundHistory, isBuyFrozen, isSellFrozen, spacingPoints, liveCyclePnl, targetProfit]);

    // =========================================================================
    // SECTION 1: Interlocked Freeze VU Meter (Buy bottom-up, Sell top-down, Buy#1 == Sell#Cap)
    // =========================================================================
    // Row coordinate y where Buy level b is at y = b.
    // Sell level s is at y = safeCap + 1 - s (so s=safeCap is at y=1, s=1 is at y=safeCap).
    const sec1MinY = Math.min(1, safeCap + 1 - Math.max(safeCap, openSell));
    const sec1MaxY = Math.max(safeCap, openBuy);
    const sec1Rows: number[] = [];
    for (let y = sec1MaxY; y >= sec1MinY; y--) {
        sec1Rows.push(y);
    }

    // =========================================================================
    // SECTION 2: Parallel Bottom-Up VU Meter + Lock + TP Triangle + TP=0 Line
    // =========================================================================
    const sec2MaxLevel = Math.min(
        28,
        Math.max(
            safeCap + 3,
            openBuy + 2,
            openSell + 2,
            metrics.tpTradeLevel ?? 0,
            metrics.beTradeLevel ?? 0,
            10
        )
    );
    const sec2Levels: number[] = [];
    for (let lv = sec2MaxLevel; lv >= 1; lv--) {
        sec2Levels.push(lv);
    }

    // =========================================================================
    // SECTION 3: Mini Price Sparkline + Current / TP / SL + Freeze Lock
    // =========================================================================
    const spark = useMemo(() => {
        const candles = chart?.candles || [];
        const closes = candles.slice(-36).map((c) => c[4]);
        const bid = chart?.bid && chart.bid > 0 ? chart.bid : closes[closes.length - 1] || 0;
        if (closes.length === 0 && bid > 0) closes.push(bid);

        let minP = closes.length > 0 ? Math.min(...closes) : bid - 1;
        let maxP = closes.length > 0 ? Math.max(...closes) : bid + 1;
        if (bid > 0) {
            minP = Math.min(minP, bid);
            maxP = Math.max(maxP, bid);
        }
        const pad = Math.max((maxP - minP) * 0.22, pointSize * 40);
        minP -= pad;
        maxP += pad;

        const estTp = chart?.est_tp_price && chart.est_tp_price > 0 ? chart.est_tp_price : 0;
        // Estimate SL price from est_tp_price slope if freezeStopLoss < 0
        let estSl = (chart as any)?.est_sl_price > 0 ? (chart as any).est_sl_price : 0;
        if (estSl <= 0 && freezeStopLoss < 0 && estTp > 0 && bid > 0 && Math.abs(targetProfit - liveCyclePnl) > 0.01) {
            const dTp = estTp - bid;
            const ratio = (freezeStopLoss - liveCyclePnl) / (targetProfit - liveCyclePnl);
            estSl = bid + dTp * ratio;
        }

        return { closes, bid, minP, maxP, estTp, estSl };
    }, [chart, pointSize, freezeStopLoss, targetProfit, liveCyclePnl]);

    // =========================================================================
    // SECTION 4: Vertical PnL Bar + Peak Excursion Marker
    // =========================================================================
    const pnlScaleMax = useMemo(() => {
        return Math.max(
            50,
            Math.abs(liveCyclePnl) * 1.25,
            Math.abs(peakPnlToday) * 1.2,
            Math.abs(targetProfit) * 1.5,
            freezeStopLoss < 0 ? Math.abs(freezeStopLoss) * 1.15 : 50
        );
    }, [liveCyclePnl, peakPnlToday, targetProfit, freezeStopLoss]);

    return (
        <div className="rounded-xl border border-cyan-500/30 bg-[#050b14]/95 p-2.5 sm:p-3 shadow-[0_0_28px_rgba(6,182,212,0.1)] backdrop-blur-md space-y-2">
            {/* Upper 4-Section Visual Deck */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 items-stretch min-h-[158px] sm:min-h-[172px]">
                {/* =========================================================
                    SECTION 1: Interlocked Freeze VU (Buy ↑ vs Sell ↓ aligned at Cap)
                   ========================================================= */}
                <div className="flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1.5 sm:p-2">
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
                        <span className="text-sky-400 font-bold">B:{openBuy}</span>
                        <span className="rounded bg-cyan-500/15 border border-cyan-500/30 px-1 text-[8px] sm:text-[9px] text-cyan-300 font-bold">
                            F:{safeCap}
                        </span>
                        <span className="text-orange-400 font-bold">S:{openSell}</span>
                    </div>

                    {/* VU Columns */}
                    <div className="my-1 flex-1 flex flex-col justify-center gap-[2px] px-0.5 max-h-[118px] overflow-hidden">
                        {sec1Rows.map((y) => {
                            const buyIdx = y; // valid when y >= 1
                            const sellIdx = safeCap + 1 - y; // valid when sellIdx >= 1 (i.e. y <= safeCap)
                            const hasBuySlot = buyIdx >= 1;
                            const hasSellSlot = sellIdx >= 1;
                            const buyLit = hasBuySlot && openBuy >= buyIdx;
                            const sellLit = hasSellSlot && openSell >= sellIdx;
                            const isFreezeZone = y >= 1 && y <= safeCap;

                            return (
                                <div
                                    key={`s1-${y}`}
                                    className={`grid grid-cols-2 gap-1 items-center ${
                                        y === safeCap || y === 1 ? 'py-[0.5px]' : ''
                                    }`}
                                >
                                    {/* Left: Buy segment (bottom-up) */}
                                    <div
                                        className={`h-[4px] sm:h-[5px] rounded-[1px] transition-all ${
                                            !hasBuySlot
                                                ? 'bg-transparent'
                                                : buyLit
                                                ? buyIdx >= safeCap
                                                    ? 'bg-cyan-300 shadow-[0_0_5px_#22d3ee]'
                                                    : 'bg-sky-500'
                                                : isFreezeZone
                                                ? 'bg-sky-950/55'
                                                : 'bg-slate-900/40'
                                        }`}
                                    />
                                    {/* Right: Sell segment (top-down) */}
                                    <div
                                        className={`h-[4px] sm:h-[5px] rounded-[1px] transition-all ${
                                            !hasSellSlot
                                                ? 'bg-transparent'
                                                : sellLit
                                                ? sellIdx >= safeCap
                                                    ? 'bg-amber-300 shadow-[0_0_5px_#f59e0b]'
                                                    : 'bg-orange-500'
                                                : isFreezeZone
                                                ? 'bg-orange-950/55'
                                                : 'bg-slate-900/40'
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="text-center font-mono text-[8px] sm:text-[9px] text-slate-400 truncate">
                        SYNC {safeCap}x{safeCap}
                    </div>
                </div>

                {/* =========================================================
                    SECTION 2: Parallel Bottom-Up VU + Lock + TP Triangle + TP=0 Line
                   ========================================================= */}
                <div className="flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1.5 sm:p-2">
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
                        <span className="flex items-center gap-0.5 text-sky-400 font-bold">
                            {openBuy}
                            {isBuyFrozen && <Lock className="w-2.5 h-2.5 text-rose-400 inline" />}
                        </span>
                        <span className="text-[8px] text-slate-500">VU</span>
                        <span className="flex items-center gap-0.5 text-orange-400 font-bold">
                            {isSellFrozen && <Lock className="w-2.5 h-2.5 text-rose-400 inline" />}
                            {openSell}
                        </span>
                    </div>

                    {/* Parallel VU Bars with TP Triangle & BE Line */}
                    <div className="my-1 flex-1 flex flex-col justify-end gap-[2px] px-1 relative max-h-[118px] overflow-hidden">
                        {sec2Levels.map((lv) => {
                            const buyLit = openBuy >= lv;
                            const sellLit = openSell >= lv;
                            const isTpRow = metrics.tpTradeLevel === lv;
                            const isBeRow = metrics.beTradeLevel === lv;

                            return (
                                <div key={`s2-${lv}`} className="relative grid grid-cols-2 gap-1.5 items-center">
                                    {/* Thin faint TP=0 (BE) horizontal line across both bars */}
                                    {isBeRow && (
                                        <div
                                            title={`TP=0 ที่ไม้ ~${lv}`}
                                            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-sky-300/45 pointer-events-none z-10"
                                        />
                                    )}

                                    {/* Small Triangle Pointer (no tail) at TP trade level */}
                                    {isTpRow && (
                                        <svg
                                            viewBox="0 0 6 6"
                                            className={`w-2 h-2 text-emerald-400 absolute top-1/2 -translate-y-1/2 z-20 drop-shadow-[0_0_3px_#10b981] ${
                                                metrics.activeSide === 'BUY' ? '-left-1.5' : '-right-1.5'
                                            }`}
                                        >
                                            {metrics.activeSide === 'BUY' ? (
                                                <polygon points="0,0 6,3 0,6" fill="currentColor" />
                                            ) : (
                                                <polygon points="6,0 0,3 6,6" fill="currentColor" />
                                            )}
                                        </svg>
                                    )}

                                    {/* Buy Bar Segment */}
                                    <div
                                        className={`h-[4px] sm:h-[5px] rounded-[1px] ${
                                            buyLit
                                                ? isBuyFrozen
                                                    ? 'bg-rose-500/80'
                                                    : 'bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.4)]'
                                                : 'bg-slate-900/70'
                                        }`}
                                    />
                                    {/* Sell Bar Segment */}
                                    <div
                                        className={`h-[4px] sm:h-[5px] rounded-[1px] ${
                                            sellLit
                                                ? isSellFrozen
                                                    ? 'bg-rose-500/80'
                                                    : 'bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.4)]'
                                                : 'bg-slate-900/70'
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-between font-mono text-[8px] sm:text-[9px] text-slate-400">
                        <span className="text-emerald-400/90">▲TP:{metrics.tpTradeLevel ?? '-'}</span>
                        <span className="text-sky-300/70">BE:{metrics.beTradeLevel ?? '-'}</span>
                    </div>
                </div>

                {/* =========================================================
                    SECTION 3: Mini Price Sparkline + NOW / TP / SL + Lock
                   ========================================================= */}
                <div className="flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1.5 sm:p-2 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
                        <span className="text-slate-300 font-bold truncate">
                            {spark.bid > 0 ? spark.bid.toFixed(digits) : symbol}
                        </span>
                        {(isBuyFrozen || isSellFrozen) && (
                            <span className="flex items-center gap-0.5 text-[8px] text-rose-400 font-bold">
                                <Lock className="w-2.5 h-2.5" />
                                {frozenSide === 'BUY' ? 'B' : 'S'}
                            </span>
                        )}
                    </div>

                    {/* SVG Mini Price Line */}
                    <div className="my-0.5 flex-1 flex items-center justify-center">
                        <svg viewBox="0 0 100 90" className="w-full h-[108px] sm:h-[116px] overflow-visible">
                            {(() => {
                                const span = Math.max(pointSize * 10, spark.maxP - spark.minP);
                                const yOf = (p: number) => {
                                    const clamped = Math.max(spark.minP, Math.min(spark.maxP, p));
                                    return 8 + ((spark.maxP - clamped) / span) * 74;
                                };

                                const pts = spark.closes
                                    .map((c, i) => {
                                        const x = spark.closes.length > 1 ? (i / (spark.closes.length - 1)) * 96 + 2 : 50;
                                        return `${x.toFixed(1)},${yOf(c).toFixed(1)}`;
                                    })
                                    .join(' ');

                                const bidY = spark.bid > 0 ? yOf(spark.bid) : 45;
                                const tpY = spark.estTp > 0 ? yOf(spark.estTp) : null;
                                const slY = spark.estSl > 0 ? yOf(spark.estSl) : null;

                                return (
                                    <>
                                        {/* Frozen side indicator band (top if BUY frozen, bottom if SELL frozen) */}
                                        {isBuyFrozen && (
                                            <rect x="0" y="0" width="100" height="10" fill="rgba(244,63,94,0.12)" />
                                        )}
                                        {isSellFrozen && (
                                            <rect x="0" y="80" width="100" height="10" fill="rgba(244,63,94,0.12)" />
                                        )}

                                        {/* TP Line */}
                                        {tpY !== null && (
                                            <g>
                                                <line x1="0" y1={tpY} x2="100" y2={tpY} stroke="#10b981" strokeWidth="1" strokeDasharray="3 2" />
                                                <text x="2" y={Math.max(8, tpY - 2)} fill="#34d399" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                                                    TP
                                                </text>
                                            </g>
                                        )}

                                        {/* SL Line */}
                                        {slY !== null && freezeStopLoss < 0 && (
                                            <g>
                                                <line x1="0" y1={slY} x2="100" y2={slY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                                                <text x="2" y={Math.min(88, slY + 7)} fill="#fbbf24" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                                                    SL
                                                </text>
                                            </g>
                                        )}

                                        {/* Current Price Dashed Line */}
                                        <line x1="0" y1={bidY} x2="100" y2={bidY} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />

                                        {/* Price Polyline */}
                                        {spark.closes.length > 1 && (
                                            <polyline
                                                fill="none"
                                                stroke="#22d3ee"
                                                strokeWidth="1.6"
                                                points={pts}
                                            />
                                        )}

                                        {/* Current Bid Dot */}
                                        <circle cx="98" cy={bidY} r="2.5" fill="#ffffff" stroke="#22d3ee" strokeWidth="1.2" />
                                    </>
                                );
                            })()}
                        </svg>
                    </div>

                    <div className="flex items-center justify-between font-mono text-[8px] sm:text-[9px] text-slate-400">
                        <span className="text-emerald-400">TP</span>
                        {freezeStopLoss < 0 ? (
                            <span className="text-amber-400">SL</span>
                        ) : (
                            <span className="text-slate-600">SL:-</span>
                        )}
                    </div>
                </div>

                {/* =========================================================
                    SECTION 4: Vertical PnL Bar + Big Number + Peak Tick
                   ========================================================= */}
                <div className="flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1.5 sm:p-2">
                    <div className="text-center">
                        <div className="text-[8px] sm:text-[9px] font-mono text-slate-400 uppercase">PnL ปัจจุบัน</div>
                        <div
                            className={`font-mono text-xs sm:text-base font-extrabold leading-tight tabular-nums truncate ${
                                liveCyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                        >
                            {liveCyclePnl >= 0 ? '+' : ''}
                            {Math.abs(liveCyclePnl) >= 100 ? liveCyclePnl.toFixed(0) : liveCyclePnl.toFixed(1)}
                        </div>
                    </div>

                    {/* Vertical Bar with Center 0 or Full Height + Peak Tick */}
                    <div className="my-1 flex-1 flex items-center justify-center gap-1.5">
                        <div className="relative h-[92px] sm:h-[100px] w-4 sm:w-5 rounded bg-slate-900 border border-slate-800 overflow-hidden flex flex-col justify-end">
                            {(() => {
                                const curRatio = Math.min(100, Math.round((Math.abs(liveCyclePnl) / pnlScaleMax) * 100));
                                const peakRatio = Math.min(98, Math.max(4, Math.round((Math.abs(peakPnlToday) / pnlScaleMax) * 100)));

                                return (
                                    <>
                                        {/* Active PnL Fill */}
                                        <div
                                            style={{ height: `${curRatio}%` }}
                                            className={`w-full transition-all duration-300 ${
                                                liveCyclePnl >= 0
                                                    ? 'bg-gradient-to-t from-emerald-600 to-cyan-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                    : 'bg-gradient-to-t from-rose-700 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                            }`}
                                        />

                                        {/* Peak of Day Horizontal Tick */}
                                        <div
                                            style={{ bottom: `${peakRatio}%` }}
                                            className="absolute inset-x-0 h-[2px] bg-amber-300 shadow-[0_0_4px_#fcd34d] z-10"
                                        />
                                    </>
                                );
                            })()}
                        </div>

                        {/* Peak Value Label */}
                        <div className="flex flex-col justify-between h-[92px] sm:h-[100px] font-mono text-[8px] sm:text-[9px] text-left">
                            <div>
                                <div className="text-amber-300/90 font-bold leading-none">PEAK</div>
                                <div className="text-amber-200 tabular-nums">
                                    {peakPnlToday >= 0 ? '+' : ''}
                                    {peakPnlToday.toFixed(0)}
                                </div>
                            </div>
                            <div className="text-slate-500">0</div>
                        </div>
                    </div>

                    <div className="text-center font-mono text-[8px] sm:text-[9px] text-slate-400">
                        {currency}
                    </div>
                </div>
            </div>

            {/* =========================================================
                SECTION 5: 5 Key Metrics Bottom Strip
               ========================================================= */}
            <div className="grid grid-cols-5 gap-1 sm:gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/80 px-1.5 py-1.5 sm:px-2.5 sm:py-2 font-mono text-center">
                {/* 1. Today's Profit */}
                <div className="flex flex-col justify-center">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">กำไรวันนี้</span>
                    <span
                        className={`text-[11px] sm:text-sm font-extrabold tabular-nums truncate ${
                            metrics.todayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                    >
                        {metrics.todayProfit >= 0 ? '+' : ''}
                        {metrics.todayProfit.toFixed(1)}
                    </span>
                </div>

                {/* 2. Target Profit */}
                <div className="flex flex-col justify-center border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ตั้ง TP</span>
                    <span className="text-[11px] sm:text-sm font-extrabold text-cyan-300 tabular-nums truncate">
                        {targetProfit >= 0 ? `+${targetProfit}` : targetProfit}
                    </span>
                </div>

                {/* 3. Total Open Trades */}
                <div className="flex flex-col justify-center border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ไม้ออกรวม</span>
                    <span className="text-[11px] sm:text-sm font-extrabold text-white tabular-nums">
                        {metrics.totalTrades}
                    </span>
                </div>

                {/* 4. Total Lots */}
                <div className="flex flex-col justify-center border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ลอตรวม</span>
                    <span className="text-[11px] sm:text-sm font-extrabold text-sky-300 tabular-nums">
                        {metrics.totalLot.toFixed(2)}
                    </span>
                </div>

                {/* 5. Freeze SL */}
                <div className="flex flex-col justify-center border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ตั้ง SL</span>
                    <span
                        className={`text-[11px] sm:text-sm font-extrabold tabular-nums truncate ${
                            freezeStopLoss < 0 ? 'text-amber-300' : 'text-slate-500'
                        }`}
                    >
                        {freezeStopLoss < 0 ? freezeStopLoss : '-'}
                    </span>
                </div>
            </div>
        </div>
    );
}
