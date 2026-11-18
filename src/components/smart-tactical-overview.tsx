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
        const activeSide: 'BUY' | 'SELL' = isBuyFrozen
            ? 'SELL'
            : isSellFrozen
            ? 'BUY'
            : openBuy >= openSell
            ? 'BUY'
            : 'SELL';

        const activeCount = activeSide === 'BUY' ? openBuy : openSell;
        const spc = Math.max(10, spacingPoints || 100);
        const valPerPtPer001 = 0.01;

        let beTradeLevel: number | null = null;
        let tpTradeLevel: number | null = null;

        if (totalTrades > 0) {
            let simPnl = liveCyclePnl;
            let curActiveLot = activeSide === 'BUY' ? buyLot : sellLot;
            const curOppLot = activeSide === 'BUY' ? sellLot : buyLot;

            for (let m = Math.max(1, activeCount); m <= 45; m++) {
                if (m > activeCount) {
                    const newLot = initialLot + (m - 1) * lotIncrement;
                    const netLotBeforeStep = curActiveLot - curOppLot;
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
    const sec1MinY = Math.min(1, safeCap + 1 - Math.max(safeCap, openSell));
    const sec1MaxY = Math.max(safeCap, openBuy);
    const sec1Rows: number[] = [];
    for (let y = sec1MaxY; y >= sec1MinY; y--) {
        sec1Rows.push(y);
    }

    // =========================================================================
    // SECTION 2: Parallel Bottom-Up VU Meter + Lock + TP Triangle + TP=0 Line
    // Always extend up to tpTradeLevel / beTradeLevel / openBuy / openSell so the arrow points at the exact bar!
    // =========================================================================
    const sec2MaxLevel = Math.max(
        safeCap + 2,
        openBuy,
        openSell,
        metrics.tpTradeLevel ?? 0,
        metrics.beTradeLevel ?? 0,
        10
    );
    const sec2Levels: number[] = [];
    for (let lv = sec2MaxLevel; lv >= 1; lv--) {
        sec2Levels.push(lv);
    }

    // =========================================================================
    // SECTION 3: Mini Price Sparkline (Full candle history window, 50% width)
    // =========================================================================
    const spark = useMemo(() => {
        const candles = chart?.candles || [];
        // Use ALL candles fetched for the candlestick chart so the line chart mirrors the full time window
        const closes = candles.map((c) => c[4]);
        const highs = candles.map((c) => c[2]);
        const lows = candles.map((c) => c[3]);
        const bid = chart?.bid && chart.bid > 0 ? chart.bid : closes[closes.length - 1] || 0;
        if (closes.length === 0 && bid > 0) closes.push(bid);

        let minP = lows.length > 0 ? Math.min(...lows) : bid - 1;
        let maxP = highs.length > 0 ? Math.max(...highs) : bid + 1;
        if (bid > 0) {
            minP = Math.min(minP, bid);
            maxP = Math.max(maxP, bid);
        }
        const pad = Math.max((maxP - minP) * 0.18, pointSize * 35);
        minP -= pad;
        maxP += pad;

        const estTp = chart?.est_tp_price && chart.est_tp_price > 0 ? chart.est_tp_price : 0;
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
        <div className="rounded-xl border border-cyan-500/30 bg-[#050b14]/95 p-2 sm:p-3 shadow-[0_0_28px_rgba(6,182,212,0.1)] backdrop-blur-md space-y-2">
            {/* Upper 4-Section Visual Deck: 6-col grid -> Sec 1 (1), Sec 2 (1), Sec 3 (3 = 50%), Sec 4 (1) */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2 items-stretch h-[168px] sm:h-[184px]">
                {/* =========================================================
                    SECTION 1 (1/6 width): Interlocked Freeze VU
                    - 1..Cap same color; >Cap distinct color
                    - Sell count on top of Sell column, Buy count on bottom of Buy column (numbers only, large)
                    - Freeze Cap number in a circle overlaid at exact center between both bars
                   ========================================================= */}
                <div className="col-span-1 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1 sm:p-1.5 relative overflow-hidden">
                    {/* Top row: empty left (Buy), large Sell count on right */}
                    <div className="grid grid-cols-2 gap-1 items-center">
                        <div />
                        <div className="text-center font-mono text-base sm:text-xl font-extrabold text-orange-400 leading-none tabular-nums">
                            {openSell}
                        </div>
                    </div>

                    {/* VU Columns + Center Freeze Circle Overlay */}
                    <div className="my-0.5 flex-1 flex flex-col justify-between gap-[1.5px] px-0.5 relative min-h-0">
                        {sec1Rows.map((y) => {
                            const buyIdx = y; // 1..N bottom-up
                            const sellIdx = safeCap + 1 - y; // 1..N top-down
                            const hasBuySlot = buyIdx >= 1;
                            const hasSellSlot = sellIdx >= 1;
                            const buyLit = hasBuySlot && openBuy >= buyIdx;
                            const sellLit = hasSellSlot && openSell >= sellIdx;
                            const isFreezeZone = y >= 1 && y <= safeCap;

                            return (
                                <div key={`s1-${y}`} className="grid grid-cols-2 gap-1.5 items-center flex-1 min-h-[1.5px]">
                                    {/* Left: Buy segment (1..Cap = sky-400, >Cap = emerald-300) */}
                                    <div
                                        className={`h-full max-h-[5px] rounded-[1px] transition-all ${
                                            !hasBuySlot
                                                ? 'bg-transparent'
                                                : buyLit
                                                ? buyIdx <= safeCap
                                                    ? 'bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.45)]'
                                                    : 'bg-emerald-300 shadow-[0_0_5px_#6ee7b7]'
                                                : isFreezeZone
                                                ? 'bg-sky-950/60'
                                                : 'bg-slate-900/40'
                                        }`}
                                    />
                                    {/* Right: Sell segment (1..Cap = orange-400, >Cap = rose-400) */}
                                    <div
                                        className={`h-full max-h-[5px] rounded-[1px] transition-all ${
                                            !hasSellSlot
                                                ? 'bg-transparent'
                                                : sellLit
                                                ? sellIdx <= safeCap
                                                    ? 'bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.45)]'
                                                    : 'bg-rose-400 shadow-[0_0_5px_#fb7185]'
                                                : isFreezeZone
                                                ? 'bg-orange-950/60'
                                                : 'bg-slate-900/40'
                                        }`}
                                    />
                                </div>
                            );
                        })}

                        {/* Center Freeze Number inside Circle Overlay */}
                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border border-cyan-400/70 bg-[#050b14]/95 shadow-[0_0_10px_rgba(34,211,238,0.45)]">
                            <span className="font-mono text-sm sm:text-lg font-extrabold text-cyan-200 leading-none tabular-nums">
                                {safeCap}
                            </span>
                        </div>
                    </div>

                    {/* Bottom row: large Buy count on left, empty right */}
                    <div className="grid grid-cols-2 gap-1 items-center">
                        <div className="text-center font-mono text-base sm:text-xl font-extrabold text-sky-400 leading-none tabular-nums">
                            {openBuy}
                        </div>
                        <div />
                    </div>
                </div>

                {/* =========================================================
                    SECTION 2 (1/6 width): Parallel Bottom-Up VU
                    - Large counts on top of both columns
                    - Bars extend all the way to tpTradeLevel with triangle pointing directly at that bar
                    - Circular Lock badge with frozen trade count overlaid at bottom of frozen column
                   ========================================================= */}
                <div className="col-span-1 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1 sm:p-1.5 relative overflow-hidden">
                    {/* Top Counts */}
                    <div className="grid grid-cols-2 gap-1 items-center text-center font-mono">
                        <span className="text-base sm:text-xl font-extrabold text-sky-400 leading-none tabular-nums">
                            {openBuy}
                        </span>
                        <span className="text-base sm:text-xl font-extrabold text-orange-400 leading-none tabular-nums">
                            {openSell}
                        </span>
                    </div>

                    {/* Parallel VU Bars extending up to sec2MaxLevel */}
                    <div className="my-0.5 flex-1 flex flex-col justify-between gap-[1px] px-1.5 relative min-h-0">
                        {sec2Levels.map((lv) => {
                            const buyLit = openBuy >= lv;
                            const sellLit = openSell >= lv;
                            const isTpRow = metrics.tpTradeLevel === lv;
                            const isBeRow = metrics.beTradeLevel === lv;

                            return (
                                <div key={`s2-${lv}`} className="relative grid grid-cols-2 gap-1.5 items-center flex-1 min-h-[1.5px]">
                                    {/* Thin faint TP=0 (BE) horizontal line */}
                                    {isBeRow && (
                                        <div
                                            title={`TP=0 ที่ไม้ ${lv}`}
                                            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-sky-200/50 pointer-events-none z-10"
                                        />
                                    )}

                                    {/* Small Triangle Pointer (no tail) pointing at the exact TP bar */}
                                    {isTpRow && (
                                        <svg
                                            viewBox="0 0 6 6"
                                            className={`w-2 h-2 text-emerald-400 absolute top-1/2 -translate-y-1/2 z-20 drop-shadow-[0_0_3px_#10b981] ${
                                                metrics.activeSide === 'BUY' ? '-left-2' : '-right-2'
                                            }`}
                                        >
                                            {metrics.activeSide === 'BUY' ? (
                                                <polygon points="0,0 6,3 0,6" fill="currentColor" />
                                            ) : (
                                                <polygon points="6,0 0,3 6,6" fill="currentColor" />
                                            )}
                                        </svg>
                                    )}

                                    {/* Buy Segment */}
                                    <div
                                        className={`h-full max-h-[5px] rounded-[1px] ${
                                            buyLit
                                                ? isBuyFrozen
                                                    ? 'bg-rose-500/80'
                                                    : 'bg-sky-400'
                                                : isTpRow && metrics.activeSide === 'BUY'
                                                ? 'bg-emerald-500/35'
                                                : 'bg-slate-900/75'
                                        }`}
                                    />
                                    {/* Sell Segment */}
                                    <div
                                        className={`h-full max-h-[5px] rounded-[1px] ${
                                            sellLit
                                                ? isSellFrozen
                                                    ? 'bg-rose-500/80'
                                                    : 'bg-orange-400'
                                                : isTpRow && metrics.activeSide === 'SELL'
                                                ? 'bg-emerald-500/35'
                                                : 'bg-slate-900/75'
                                        }`}
                                    />
                                </div>
                            );
                        })}

                        {/* Circular Lock with Number overlaid at bottom of the frozen bar */}
                        {isBuyFrozen && (
                            <div className="pointer-events-none absolute bottom-0.5 left-1/4 -translate-x-1/2 z-20 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border border-rose-400/80 bg-[#080d1a]/95 shadow-[0_0_8px_rgba(244,63,94,0.5)]">
                                <Lock className="w-3.5 h-3.5 text-rose-400/45 absolute" />
                                <span className="relative z-10 font-mono text-[10px] sm:text-xs font-extrabold text-rose-200 leading-none">
                                    {openBuy}
                                </span>
                            </div>
                        )}
                        {isSellFrozen && (
                            <div className="pointer-events-none absolute bottom-0.5 left-3/4 -translate-x-1/2 z-20 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border border-rose-400/80 bg-[#080d1a]/95 shadow-[0_0_8px_rgba(244,63,94,0.5)]">
                                <Lock className="w-3.5 h-3.5 text-rose-400/45 absolute" />
                                <span className="relative z-10 font-mono text-[10px] sm:text-xs font-extrabold text-rose-200 leading-none">
                                    {openSell}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between font-mono text-[8px] text-slate-400 leading-none">
                        <span className="text-emerald-400">▲{metrics.tpTradeLevel ?? '-'}</span>
                        <span className="text-sky-300/70">BE:{metrics.beTradeLevel ?? '-'}</span>
                    </div>
                </div>

                {/* =========================================================
                    SECTION 3 (3/6 = 50% width): Full-Window Price Line Chart
                   ========================================================= */}
                <div className="col-span-3 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1.5 sm:p-2 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono">
                        <span className="text-cyan-300 font-bold">
                            {symbol} {spark.bid > 0 ? spark.bid.toFixed(digits) : ''}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[8px] text-slate-500">{spark.closes.length}M</span>
                            {(isBuyFrozen || isSellFrozen) && (
                                <span className="flex items-center gap-0.5 rounded bg-rose-500/15 border border-rose-500/40 px-1 py-0.2 text-[8px] text-rose-300 font-bold">
                                    <Lock className="w-2.5 h-2.5" />
                                    {frozenSide}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* SVG Full-Window Price Line */}
                    <div className="my-0.5 flex-1 flex items-center justify-center min-h-0">
                        <svg viewBox="0 0 220 96" className="w-full h-full overflow-visible">
                            {(() => {
                                const span = Math.max(pointSize * 10, spark.maxP - spark.minP);
                                const yOf = (p: number) => {
                                    const clamped = Math.max(spark.minP, Math.min(spark.maxP, p));
                                    return 8 + ((spark.maxP - clamped) / span) * 80;
                                };

                                const pts = spark.closes
                                    .map((c, i) => {
                                        const x = spark.closes.length > 1 ? (i / (spark.closes.length - 1)) * 212 + 4 : 110;
                                        return `${x.toFixed(1)},${yOf(c).toFixed(1)}`;
                                    })
                                    .join(' ');

                                const areaPts =
                                    spark.closes.length > 1
                                        ? `4,88 ${pts} 216,88`
                                        : '';

                                const bidY = spark.bid > 0 ? yOf(spark.bid) : 48;
                                const tpY = spark.estTp > 0 ? yOf(spark.estTp) : null;
                                const slY = spark.estSl > 0 ? yOf(spark.estSl) : null;

                                return (
                                    <>
                                        <defs>
                                            <linearGradient id="svSparkGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
                                                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>

                                        {/* Frozen side lock zone + icon */}
                                        {isBuyFrozen && (
                                            <g>
                                                <rect x="0" y="0" width="220" height="12" fill="rgba(244,63,94,0.14)" />
                                                <text x="110" y="9" fill="#fda4af" fontSize="7.5" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                                                    🔒 BUY FROZEN
                                                </text>
                                            </g>
                                        )}
                                        {isSellFrozen && (
                                            <g>
                                                <rect x="0" y="84" width="220" height="12" fill="rgba(244,63,94,0.14)" />
                                                <text x="110" y="93" fill="#fda4af" fontSize="7.5" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                                                    🔒 SELL FROZEN
                                                </text>
                                            </g>
                                        )}

                                        {/* Area fill under price curve */}
                                        {areaPts && <polygon points={areaPts} fill="url(#svSparkGrad)" />}

                                        {/* TP Line */}
                                        {tpY !== null && (
                                            <g>
                                                <line x1="0" y1={tpY} x2="220" y2={tpY} stroke="#10b981" strokeWidth="1" strokeDasharray="3 2" />
                                                <text x="3" y={Math.max(9, tpY - 2)} fill="#34d399" fontSize="8" fontFamily="monospace" fontWeight="bold">
                                                    TP {spark.estTp.toFixed(digits)}
                                                </text>
                                            </g>
                                        )}

                                        {/* SL Line */}
                                        {slY !== null && freezeStopLoss < 0 && (
                                            <g>
                                                <line x1="0" y1={slY} x2="220" y2={slY} stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                                                <text x="3" y={Math.min(92, slY + 8)} fill="#fbbf24" fontSize="8" fontFamily="monospace" fontWeight="bold">
                                                    SL {spark.estSl.toFixed(digits)}
                                                </text>
                                            </g>
                                        )}

                                        {/* Current Price Line */}
                                        <line x1="0" y1={bidY} x2="220" y2={bidY} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />

                                        {/* Full Price Polyline */}
                                        {spark.closes.length > 1 && (
                                            <polyline fill="none" stroke="#22d3ee" strokeWidth="1.6" points={pts} />
                                        )}

                                        {/* Current Bid Dot */}
                                        <circle cx="216" cy={bidY} r="2.8" fill="#ffffff" stroke="#22d3ee" strokeWidth="1.4" />
                                    </>
                                );
                            })()}
                        </svg>
                    </div>

                    <div className="flex items-center justify-between font-mono text-[8px] text-slate-400 leading-none">
                        <span className="text-emerald-400">
                            TP:{spark.estTp > 0 ? spark.estTp.toFixed(digits) : '--'}
                        </span>
                        <span className={freezeStopLoss < 0 ? 'text-amber-400' : 'text-slate-600'}>
                            SL:{freezeStopLoss < 0 && spark.estSl > 0 ? spark.estSl.toFixed(digits) : '-'}
                        </span>
                    </div>
                </div>

                {/* =========================================================
                    SECTION 4 (1/6 width): Vertical PnL Bar + Big Number + Peak Tick
                   ========================================================= */}
                <div className="col-span-1 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1 sm:p-1.5">
                    <div className="text-center">
                        <div className="text-[8px] font-mono text-slate-400 uppercase leading-none">PnL</div>
                        <div
                            className={`font-mono text-sm sm:text-lg font-extrabold leading-tight tabular-nums truncate ${
                                liveCyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                        >
                            {liveCyclePnl >= 0 ? '+' : ''}
                            {Math.abs(liveCyclePnl) >= 100 ? liveCyclePnl.toFixed(0) : liveCyclePnl.toFixed(1)}
                        </div>
                    </div>

                    {/* Vertical Bar + Peak Tick */}
                    <div className="my-0.5 flex-1 flex items-center justify-center gap-1 min-h-0">
                        <div className="relative h-full w-3.5 sm:w-4 rounded bg-slate-900 border border-slate-800 overflow-hidden flex flex-col justify-end">
                            {(() => {
                                const curRatio = Math.min(100, Math.round((Math.abs(liveCyclePnl) / pnlScaleMax) * 100));
                                const peakRatio = Math.min(97, Math.max(4, Math.round((Math.abs(peakPnlToday) / pnlScaleMax) * 100)));

                                return (
                                    <>
                                        <div
                                            style={{ height: `${curRatio}%` }}
                                            className={`w-full transition-all duration-300 ${
                                                liveCyclePnl >= 0
                                                    ? 'bg-gradient-to-t from-emerald-600 to-cyan-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                    : 'bg-gradient-to-t from-rose-700 to-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                                            }`}
                                        />
                                        <div
                                            style={{ bottom: `${peakRatio}%` }}
                                            className="absolute inset-x-0 h-[2px] bg-amber-300 shadow-[0_0_4px_#fcd34d] z-10"
                                        />
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex flex-col justify-between h-full font-mono text-[7.5px] sm:text-[8.5px] text-left leading-none py-0.5">
                            <div>
                                <div className="text-amber-300/90 font-bold">PK</div>
                                <div className="text-amber-200 tabular-nums">
                                    {peakPnlToday >= 0 ? '+' : ''}
                                    {peakPnlToday.toFixed(0)}
                                </div>
                            </div>
                            <div className="text-slate-500">0</div>
                        </div>
                    </div>

                    <div className="text-center font-mono text-[8px] text-slate-400 leading-none">
                        {currency}
                    </div>
                </div>
            </div>

            {/* =========================================================
                SECTION 5: 5 Key Metrics Bottom Strip (Numbers doubled in size, labels unchanged)
               ========================================================= */}
            <div className="grid grid-cols-5 gap-1 sm:gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/80 px-1.5 py-2 sm:px-2.5 sm:py-2.5 font-mono text-center">
                {/* 1. Today's Profit */}
                <div className="flex flex-col justify-center gap-0.5">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">กำไรวันนี้</span>
                    <span
                        className={`text-base sm:text-2xl font-extrabold leading-none tabular-nums truncate ${
                            metrics.todayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                    >
                        {metrics.todayProfit >= 0 ? '+' : ''}
                        {Math.abs(metrics.todayProfit) >= 100 ? metrics.todayProfit.toFixed(0) : metrics.todayProfit.toFixed(1)}
                    </span>
                </div>

                {/* 2. Target Profit */}
                <div className="flex flex-col justify-center gap-0.5 border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ตั้ง TP</span>
                    <span className="text-base sm:text-2xl font-extrabold text-cyan-300 leading-none tabular-nums truncate">
                        {targetProfit >= 0 ? `+${targetProfit}` : targetProfit}
                    </span>
                </div>

                {/* 3. Total Open Trades */}
                <div className="flex flex-col justify-center gap-0.5 border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ไม้ออกรวม</span>
                    <span className="text-base sm:text-2xl font-extrabold text-white leading-none tabular-nums">
                        {metrics.totalTrades}
                    </span>
                </div>

                {/* 4. Total Lots */}
                <div className="flex flex-col justify-center gap-0.5 border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ลอตรวม</span>
                    <span className="text-base sm:text-2xl font-extrabold text-sky-300 leading-none tabular-nums">
                        {metrics.totalLot.toFixed(2)}
                    </span>
                </div>

                {/* 5. Freeze SL */}
                <div className="flex flex-col justify-center gap-0.5 border-l border-slate-800">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ตั้ง SL</span>
                    <span
                        className={`text-base sm:text-2xl font-extrabold leading-none tabular-nums truncate ${
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
