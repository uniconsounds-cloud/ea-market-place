'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import type { SmartChartData } from '@/components/smart-vortex-chart';
import type { RoundHistoryTuple } from '@/components/round-history-bar';

interface VoteCouncilVoterOverview {
    id: string;
    label: string;
    weight: number;
    vote: 'YES' | 'NO' | 'WAIT' | 'OFF' | string;
}

interface VoteCouncilOverview {
    enabled: boolean;
    mode?: string;
    direction?: string;
    mirror_px?: number;
    trigger_px?: number;
    entry_px?: number;
    stop_px?: number;
    score_pct?: number;
    pass_pct?: number;
    voters?: VoteCouncilVoterOverview[];
    trend_council?: {
        direction: string;
        yes_w: number;
        total_w: number;
        voters?: VoteCouncilVoterOverview[];
    } | null;
}

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
    voteCouncil?: VoteCouncilOverview | null;
    roundHistory?: RoundHistoryTuple[] | null;
    isWaitingFreshData?: boolean;
    lastPing?: string;
}

const FIXED_VU_SLOTS = 30;

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
    voteCouncil,
    roundHistory,
    isWaitingFreshData = false,
    lastPing,
}: SmartTacticalOverviewProps) {
    const safeCap = Math.max(1, Math.min(20, cap || 7));
    const isBuyFrozen = protectionFrozen && frozenSide === 'BUY';
    const isSellFrozen = protectionFrozen && frozenSide === 'SELL';
    const digits = chart?.digits ?? 2;
    const pointSize = Math.pow(10, -digits);

    // =========================================================================
    // ROUND PEAK PnL TRACKER (Per-Round Peak: persists while round is open,
    // even if user closes the web page, and resets only when the round ends)
    // =========================================================================
    const currentRoundKey = useMemo(() => {
        const latestClosedTime =
            Array.isArray(roundHistory) && roundHistory.length > 0
                ? Math.max(...roundHistory.map((r) => (Array.isArray(r) ? Number(r[0]) || 0 : 0)))
                : 0;
        const roundStarted = Number(chart?.round_started || 0);
        // Keyed by latest closed round timestamp (invariant throughout the active cycle)
        // If round_started is available and > latestClosedTime, include it for extra precision
        if (openBuy + openSell === 0) {
            return `idle_${latestClosedTime}`;
        }
        return `active_${latestClosedTime}_${roundStarted > latestClosedTime ? roundStarted : 0}`;
    }, [roundHistory, chart?.round_started, openBuy, openSell]);

    // Reconstruct any intra-round peak excursion from candle highs/lows & open orders
    // in case price spiked while user had the web browser closed
    const candleEstimatedPeak = useMemo(() => {
        if (openBuy + openSell === 0) return 0;
        const orders = (chart?.orders || []).filter((o) => o.t === 'B' || o.t === 'S');
        const candles = chart?.candles || [];
        const bid = chart?.bid || 0;
        if (orders.length === 0 || candles.length === 0 || bid <= 0) return liveCyclePnl;

        // Calibrate point value from current orders if possible
        let calcDiffPointsX001 = 0;
        let sumOrderU = 0;
        for (const o of orders) {
            const diffPts = ((o.t === 'B' ? bid - o.p : o.p - bid) / pointSize) * (o.l / 0.01);
            calcDiffPointsX001 += diffPts;
            sumOrderU += o.u ?? 0;
        }
        const valPerPtPer001 =
            Math.abs(calcDiffPointsX001) > 10 && Math.abs(sumOrderU) > 0.1
                ? Math.max(0.001, Math.min(1, Math.abs(sumOrderU / calcDiffPointsX001)))
                : 0.01;

        const latestClosedTime =
            Array.isArray(roundHistory) && roundHistory.length > 0
                ? Math.max(...roundHistory.map((r) => (Array.isArray(r) ? Number(r[0]) || 0 : 0)))
                : 0;
        const roundStartUnix = Math.max(
            latestClosedTime,
            Number(chart?.round_started || 0) > 0
                ? Number(chart?.round_started)
                : Math.min(...orders.map((o) => o.tm || Infinity))
        );

        let extremePnl = liveCyclePnl;
        for (const c of candles) {
            const cTime = Number(c[0]) || 0;
            if (roundStartUnix > 0 && cTime + 900 < roundStartUnix) continue;
            const activeAtCandle = orders.filter((o) => !o.tm || o.tm <= cTime + 900);
            if (activeAtCandle.length === 0) continue;

            for (const testPrice of [c[2], c[3]]) {
                let pnlAtPrice = 0;
                for (const o of activeAtCandle) {
                    const pts = (o.t === 'B' ? testPrice - o.p : o.p - testPrice) / pointSize;
                    pnlAtPrice += pts * (o.l / 0.01) * valPerPtPer001;
                }
                if (Math.abs(pnlAtPrice) > Math.abs(extremePnl)) {
                    extremePnl = pnlAtPrice;
                }
            }
        }
        return extremePnl;
    }, [openBuy, openSell, chart, roundHistory, liveCyclePnl, pointSize]);

    const [peakPnlRound, setPeakPnlRound] = useState<number>(liveCyclePnl);

    useEffect(() => {
        if (!port) return;
        const storageKey = `sv_round_peak_v2_${port}`;
        if (openBuy + openSell === 0) {
            setPeakPnlRound(0);
            try {
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({ roundKey: currentRoundKey, peakPnl: 0, updatedAt: Date.now() })
                );
            } catch {
                // ignore storage error
            }
            return;
        }

        try {
            const raw = localStorage.getItem(storageKey);
            let savedPeak = NaN;
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.roundKey === currentRoundKey && typeof parsed.peakPnl === 'number') {
                    savedPeak = parsed.peakPnl;
                }
            }

            // Pick the largest magnitude excursion among savedPeak, liveCyclePnl, and candleEstimatedPeak
            let nextPeak = liveCyclePnl;
            if (!isNaN(savedPeak) && Math.abs(savedPeak) > Math.abs(nextPeak)) {
                nextPeak = savedPeak;
            }
            if (Math.abs(candleEstimatedPeak) > Math.abs(nextPeak)) {
                nextPeak = candleEstimatedPeak;
            }

            setPeakPnlRound(nextPeak);
            localStorage.setItem(
                storageKey,
                JSON.stringify({ roundKey: currentRoundKey, peakPnl: nextPeak, updatedAt: Date.now() })
            );
        } catch {
            setPeakPnlRound(liveCyclePnl);
        }
    }, [port, currentRoundKey, openBuy, openSell, liveCyclePnl, candleEstimatedPeak]);

    // Compute Total Lots, Buy/Sell Lots, Buy/Sell PnL, Today's Profit, and Trade Level where TP=0 and TP=targetProfit occur
    const metrics = useMemo(() => {
        const orders = (chart?.orders || []).filter((o) => o.t === 'B' || o.t === 'S');
        let buyLot = 0;
        let sellLot = 0;
        let sumBuyOrderPnl = 0;
        let sumSellOrderPnl = 0;

        for (const o of orders) {
            if (o.t === 'B') {
                buyLot += o.l;
                sumBuyOrderPnl += o.u ?? 0;
            } else if (o.t === 'S') {
                sellLot += o.l;
                sumSellOrderPnl += o.u ?? 0;
            }
        }
        if (buyLot === 0 && openBuy > 0) {
            buyLot = openBuy * initialLot + ((openBuy * (openBuy - 1)) / 2) * lotIncrement;
        }
        if (sellLot === 0 && openSell > 0) {
            sellLot = openSell * initialLot + ((openSell * (openSell - 1)) / 2) * lotIncrement;
        }
        const totalLot = buyLot + sellLot;
        const totalTrades = openBuy + openSell;

        const hasExactSidePnl =
            typeof chart?.buy_pnl === 'number' && typeof chart?.sell_pnl === 'number';
        const buyPnl = hasExactSidePnl ? (chart?.buy_pnl ?? 0) : sumBuyOrderPnl;
        const sellPnl = hasExactSidePnl ? (chart?.sell_pnl ?? 0) : sumSellOrderPnl;

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

            for (let m = Math.max(1, activeCount); m <= 99; m++) {
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
            buyPnl,
            sellPnl,
            totalTrades,
            todayProfit,
            activeSide,
            beTradeLevel,
            tpTradeLevel,
        };
    }, [chart, openBuy, openSell, initialLot, lotIncrement, roundHistory, isBuyFrozen, isSellFrozen, spacingPoints, liveCyclePnl, targetProfit]);

    // =========================================================================
    // SECTION 1 & SECTION 2: Fixed 30-Slot VU Geometry
    // Both Section 1 and Section 2 render strictly 30 fixed slots (FIXED_VU_SLOTS = 30)
    // so all 4 VU columns have identical bar height, gap, and 30 visible slots.
    // =========================================================================
    const sec2Levels = useMemo(() => {
        const arr: number[] = [];
        for (let lv = FIXED_VU_SLOTS; lv >= 1; lv--) {
            arr.push(lv);
        }
        return arr;
    }, []);

    // Section 1: 30 fixed rows centered around the Freeze zone (y = 1 .. safeCap)
    // Buy slots run bottom-up (buyIdx = y >= 1); Sell slots run top-down (sellIdx = safeCap + 1 - y >= 1)
    const { sec1Rows, sec1TopY, sec1BotY, freezeCenterPct } = useMemo(() => {
        const remaining = Math.max(0, FIXED_VU_SLOTS - safeCap);
        const topExtra = Math.floor(remaining / 2);
        const botExtra = remaining - topExtra;
        const topY = safeCap + topExtra; // e.g. for cap=7 -> 7 + 11 = 18
        const botY = 1 - botExtra; // e.g. for cap=7 -> 1 - 12 = -11 (18 - (-11) + 1 = 30 rows)
        const rows: number[] = [];
        for (let y = topY; y >= botY; y--) {
            rows.push(y);
        }
        const fCenterY = (safeCap + 1) / 2;
        const fCenterPct = ((topY - fCenterY + 0.5) / FIXED_VU_SLOTS) * 100;
        return {
            sec1Rows: rows,
            sec1TopY: topY,
            sec1BotY: botY,
            freezeCenterPct: fCenterPct,
        };
    }, [safeCap]);

    // Clamped display slots for Section 2 (1..30)
    const clampedTpSlot =
        metrics.tpTradeLevel !== null ? Math.min(FIXED_VU_SLOTS, Math.max(1, metrics.tpTradeLevel)) : null;
    const clampedBeSlot =
        metrics.beTradeLevel !== null ? Math.min(FIXED_VU_SLOTS, Math.max(1, metrics.beTradeLevel)) : null;
    const sec2BuyLabelSlot = openBuy <= 0 ? 1 : Math.min(FIXED_VU_SLOTS, openBuy + 1);
    const sec2SellLabelSlot = openSell <= 0 ? 1 : Math.min(FIXED_VU_SLOTS, openSell + 1);

    // =========================================================================
    // SECTION 3: Mini Price Sparkline (Full candle history window, 50% width)
    // =========================================================================
    const spark = useMemo(() => {
        const candles = chart?.candles || [];
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

        const estTp = chart?.est_tp_price && chart.est_tp_price > 0 ? chart.est_tp_price : 0;
        let estSl = (chart as any)?.est_sl_price > 0 ? (chart as any).est_sl_price : 0;
        if (estSl <= 0 && freezeStopLoss < 0 && estTp > 0 && bid > 0 && Math.abs(targetProfit - liveCyclePnl) > 0.01) {
            const dTp = estTp - bid;
            const ratio = (freezeStopLoss - liveCyclePnl) / (targetProfit - liveCyclePnl);
            estSl = bid + dTp * ratio;
        }

        const rcPrice =
            isBuyFrozen || isSellFrozen
                ? voteCouncil?.trigger_px && voteCouncil.trigger_px > 0
                    ? voteCouncil.trigger_px
                    : voteCouncil?.mirror_px && voteCouncil.mirror_px > 0
                    ? voteCouncil.mirror_px
                    : chart?.freeze_price && chart.freeze_price > 0
                    ? chart.freeze_price
                    : 0
                : 0;

        const openOrders = (chart?.orders || []).filter((o) => (o.t === 'B' || o.t === 'S') && o.p > 0);

        if (estTp > 0) {
            minP = Math.min(minP, estTp);
            maxP = Math.max(maxP, estTp);
        }
        if (rcPrice > 0) {
            minP = Math.min(minP, rcPrice);
            maxP = Math.max(maxP, rcPrice);
        }
        if (estSl > 0 && freezeStopLoss < 0) {
            minP = Math.min(minP, estSl);
            maxP = Math.max(maxP, estSl);
        }
        for (const o of openOrders) {
            minP = Math.min(minP, o.p);
            maxP = Math.max(maxP, o.p);
        }

        const pad = Math.max((maxP - minP) * 0.08, pointSize * 20);
        minP -= pad;
        maxP += pad;

        return { closes, bid, minP, maxP, estTp, estSl, rcPrice, openOrders };
    }, [chart, voteCouncil, isBuyFrozen, isSellFrozen, pointSize, freezeStopLoss, targetProfit, liveCyclePnl]);

    // =========================================================================
    // SECTION 4: Vertical PnL Bar + Per-Round Peak Excursion Marker
    // =========================================================================
    const pnlScaleMax = useMemo(() => {
        return Math.max(
            50,
            Math.abs(liveCyclePnl) * 1.25,
            Math.abs(peakPnlRound) * 1.2,
            Math.abs(targetProfit) * 1.5,
            freezeStopLoss < 0 ? Math.abs(freezeStopLoss) * 1.15 : 50
        );
    }, [liveCyclePnl, peakPnlRound, targetProfit, freezeStopLoss]);

    // How long ago the displayed snapshot was recorded
    const snapshotAgeLabel = useMemo(() => {
        if (!lastPing) return null;
        const diffSec = Math.max(0, Math.floor((Date.now() - new Date(lastPing).getTime()) / 1000));
        if (diffSec < 60) return `${diffSec} วินาทีก่อน`;
        const mins = Math.floor(diffSec / 60);
        if (mins < 60) return `${mins} นาทีก่อน`;
        const hrs = Math.floor(mins / 60);
        return `${hrs} ชม. ${mins % 60} นาทีก่อน`;
    }, [lastPing]);

    return (
        <div
            className={`rounded-xl border border-cyan-500/30 bg-[#050b14]/95 p-2 sm:p-3 shadow-[0_0_28px_rgba(6,182,212,0.1)] backdrop-blur-md space-y-2 transition-all duration-500 ${
                isWaitingFreshData ? 'opacity-70 grayscale animate-pulse' : ''
            }`}
        >
            {/* Waiting for Sync Banner when displaying cached / 10-min pre-recorded snapshot */}
            {isWaitingFreshData && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] sm:text-[11px] text-amber-300">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                        <span className="font-bold truncate">
                            รอ Sync ข้อมูลรอบใหม่จาก MT5...
                        </span>
                    </div>
                    {snapshotAgeLabel && (
                        <span className="text-[9px] sm:text-[10px] text-amber-200/80 shrink-0">
                            ข้อมูลล่าสุด: {snapshotAgeLabel}
                        </span>
                    )}
                </div>
            )}

            {/* Upper 4-Section Visual Deck: 6-col grid -> Sec 1 (1), Sec 2 (1), Sec 3 (3 = 50%), Sec 4 (1) */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2 items-stretch h-[176px] sm:h-[192px]">
                {/* =========================================================
                    SECTION 1 (1/6 width): Interlocked Freeze VU (30 Fixed Slots)
                   ========================================================= */}
                <div className="col-span-1 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1.5 relative overflow-hidden">
                    <div className="flex-1 flex flex-col justify-between gap-[1px] px-1 relative min-h-0">
                        {sec1Rows.map((y) => {
                            const buyIdx = y; // 1..topY bottom-up
                            const sellIdx = safeCap + 1 - y; // 1..maxSell top-down
                            const maxBuySlots = sec1TopY;
                            const maxSellSlots = safeCap + 1 - sec1BotY;
                            const clampedOpenBuy = Math.min(maxBuySlots, openBuy);
                            const clampedOpenSell = Math.min(maxSellSlots, openSell);

                            const hasBuySlot = buyIdx >= 1;
                            const hasSellSlot = sellIdx >= 1;
                            const buyLit = hasBuySlot && clampedOpenBuy >= buyIdx;
                            const sellLit = hasSellSlot && clampedOpenSell >= sellIdx;
                            const isFreezeZone = y >= 1 && y <= safeCap;
                            const isBuyLabelRow = y === 0;
                            const isSellLabelRow = y === safeCap + 1;

                            return (
                                <div key={`s1-${y}`} className="grid grid-cols-2 gap-1.5 items-center flex-1 min-h-[1.5px] relative">
                                    {/* Left: Buy segment (30-slot grid) OR Buy count directly below bar #1 */}
                                    <div className="relative h-full flex items-center justify-center">
                                        {isBuyLabelRow ? (
                                            <span className="absolute top-0 z-20 font-mono text-[10px] sm:text-xs font-extrabold text-sky-400 leading-none tabular-nums">
                                                {openBuy}
                                            </span>
                                        ) : (
                                            <div
                                                className={`w-full h-full max-h-[5px] rounded-[1px] transition-all ${
                                                    !hasBuySlot
                                                        ? 'bg-transparent'
                                                        : buyLit
                                                        ? buyIdx <= safeCap
                                                            ? 'bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.45)]'
                                                            : 'bg-emerald-300 shadow-[0_0_5px_#6ee7b7]'
                                                        : isFreezeZone
                                                        ? 'bg-sky-950/65'
                                                        : 'bg-slate-800/55'
                                                }`}
                                            />
                                        )}
                                    </div>

                                    {/* Right: Sell segment (30-slot grid) OR Sell count directly above bar #1 */}
                                    <div className="relative h-full flex items-center justify-center">
                                        {isSellLabelRow ? (
                                            <span className="absolute bottom-0 z-20 font-mono text-[10px] sm:text-xs font-extrabold text-orange-400 leading-none tabular-nums">
                                                {openSell}
                                            </span>
                                        ) : (
                                            <div
                                                className={`w-full h-full max-h-[5px] rounded-[1px] transition-all ${
                                                    !hasSellSlot
                                                        ? 'bg-transparent'
                                                        : sellLit
                                                        ? sellIdx <= safeCap
                                                            ? 'bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.45)]'
                                                            : 'bg-rose-400 shadow-[0_0_5px_#fb7185]'
                                                        : isFreezeZone
                                                        ? 'bg-orange-950/65'
                                                        : 'bg-slate-800/55'
                                                }`}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Center Freeze Number inside Circle Overlay — centered on the 1..Cap Freeze zone */}
                        <div
                            style={{ top: `${freezeCenterPct}%` }}
                            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border border-cyan-400/75 bg-[#050b14]/95 shadow-[0_0_8px_rgba(34,211,238,0.45)]"
                        >
                            <span className="font-mono text-[10px] sm:text-xs font-extrabold text-cyan-200 leading-none tabular-nums">
                                {safeCap}
                            </span>
                        </div>
                    </div>
                </div>

                {/* =========================================================
                    SECTION 2 (1/6 width): Parallel Bottom-Up VU (30 Fixed Slots)
                    - Always 30 fixed slots (1..30 from bottom to top)
                    - Lit from 1..openBuy and 1..openSell, empty slots above
                    - If TP > 30, points at slot 30 and shows the true TP number
                   ========================================================= */}
                <div className="col-span-1 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1.5 relative overflow-hidden">
                    <div className="flex-1 flex flex-col justify-between gap-[1px] px-1 relative min-h-0">
                        {sec2Levels.map((lv) => {
                            const buyLit = openBuy >= lv;
                            const sellLit = openSell >= lv;
                            const isBuyTopLabel = lv === sec2BuyLabelSlot;
                            const isSellTopLabel = lv === sec2SellLabelSlot;
                            const isTpRow = clampedTpSlot === lv;
                            const isBeRow = clampedBeSlot === lv;

                            return (
                                <div key={`s2-${lv}`} className="relative grid grid-cols-2 gap-1.5 items-center flex-1 min-h-[1.5px]">
                                    {/* Thin faint TP=0 (BE) horizontal line */}
                                    {isBeRow && (
                                        <div
                                            title={`TP=0 ที่ไม้ ${metrics.beTradeLevel}`}
                                            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-sky-200/50 pointer-events-none z-10"
                                        />
                                    )}

                                    {/* Small Triangle Pointer + true TP bar number right at the TP row (clamped at 30 if >30) */}
                                    {isTpRow && metrics.tpTradeLevel !== null && (
                                        <div
                                            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-30 flex items-center gap-[1px] ${
                                                metrics.activeSide === 'BUY' ? '-left-1' : '-right-1 flex-row-reverse'
                                            }`}
                                        >
                                            <svg
                                                viewBox="0 0 6 6"
                                                className="w-1.5 h-1.5 text-emerald-400 drop-shadow-[0_0_3px_#10b981] shrink-0"
                                            >
                                                {metrics.activeSide === 'BUY' ? (
                                                    <polygon points="0,0 6,3 0,6" fill="currentColor" />
                                                ) : (
                                                    <polygon points="6,0 0,3 6,6" fill="currentColor" />
                                                )}
                                            </svg>
                                            <span className="font-mono text-[8px] sm:text-[9px] font-extrabold text-emerald-300 leading-none bg-[#030710]/90 px-0.5 rounded">
                                                {metrics.tpTradeLevel}
                                            </span>
                                        </div>
                                    )}

                                    {/* Buy Segment (1..30) or Buy Top Number */}
                                    <div className="relative h-full flex items-center justify-center">
                                        {isBuyTopLabel && (
                                            <span className="absolute bottom-0 z-20 font-mono text-[10px] sm:text-xs font-extrabold text-sky-400 leading-none tabular-nums bg-[#030710]/80 px-0.5 rounded">
                                                {openBuy}
                                            </span>
                                        )}
                                        <div
                                            className={`w-full h-full max-h-[5px] rounded-[1px] ${
                                                buyLit
                                                    ? isBuyFrozen
                                                        ? 'bg-rose-500/80'
                                                        : 'bg-sky-400'
                                                    : isTpRow && metrics.activeSide === 'BUY'
                                                    ? 'bg-emerald-500/45'
                                                    : 'bg-slate-800/55'
                                            }`}
                                        />
                                    </div>

                                    {/* Sell Segment (1..30) or Sell Top Number */}
                                    <div className="relative h-full flex items-center justify-center">
                                        {isSellTopLabel && (
                                            <span className="absolute bottom-0 z-20 font-mono text-[10px] sm:text-xs font-extrabold text-orange-400 leading-none tabular-nums bg-[#030710]/80 px-0.5 rounded">
                                                {openSell}
                                            </span>
                                        )}
                                        <div
                                            className={`w-full h-full max-h-[5px] rounded-[1px] ${
                                                sellLit
                                                    ? isSellFrozen
                                                        ? 'bg-rose-500/80'
                                                        : 'bg-orange-400'
                                                    : isTpRow && metrics.activeSide === 'SELL'
                                                    ? 'bg-emerald-500/45'
                                                    : 'bg-slate-800/55'
                                            }`}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Circular Lock icon (no number) centered horizontally at bottom of frozen column */}
                        <div className="pointer-events-none absolute inset-x-1 bottom-0.5 grid grid-cols-2 gap-1.5 z-20">
                            <div className="flex justify-center">
                                {isBuyFrozen && (
                                    <div className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-rose-400/80 bg-[#080d1a]/95 shadow-[0_0_8px_rgba(244,63,94,0.5)]">
                                        <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-300" />
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-center">
                                {isSellFrozen && (
                                    <div className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full border border-rose-400/80 bg-[#080d1a]/95 shadow-[0_0_8px_rgba(244,63,94,0.5)]">
                                        <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-rose-300" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* =========================================================
                    SECTION 3 (3/6 = 50% width): Full-Window Price Line Chart
                   ========================================================= */}
                <div className="col-span-3 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 px-1.5 py-1 sm:px-2 sm:py-1.5 relative overflow-hidden">
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono leading-none shrink-0 z-10">
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

                    {/* Full-Height Stretched Price Line + Crisp HTML Overlay */}
                    <div className="relative my-0.5 flex-1 min-h-0 w-full">
                        {(() => {
                            const span = Math.max(pointSize * 10, spark.maxP - spark.minP);
                            const pctOf = (p: number) => {
                                const clamped = Math.max(spark.minP, Math.min(spark.maxP, p));
                                return 3 + ((spark.maxP - clamped) / span) * 94;
                            };

                            const pts = spark.closes
                                .map((c, i) => {
                                    const x = spark.closes.length > 1 ? (i / (spark.closes.length - 1)) * 216 + 2 : 110;
                                    return `${x.toFixed(1)},${pctOf(c).toFixed(1)}`;
                                })
                                .join(' ');

                            const areaPts =
                                spark.closes.length > 1
                                    ? `2,99 ${pts} 218,99`
                                    : '';

                            const bidPct = spark.bid > 0 ? pctOf(spark.bid) : 50;
                            const tpPct = spark.estTp > 0 ? pctOf(spark.estTp) : null;
                            const slPct = spark.estSl > 0 && freezeStopLoss < 0 ? pctOf(spark.estSl) : null;
                            const rcPct = (isBuyFrozen || isSellFrozen) && spark.rcPrice > 0 ? pctOf(spark.rcPrice) : null;

                            const tc = voteCouncil?.trend_council;
                            const trendDir = tc?.direction === 'BUY' || tc?.direction === 'SELL' ? tc.direction : 'NONE';
                            const trendLevel = Math.max(0, Math.min(5, tc?.yes_w ?? 0));

                            const activeEntryVoters = (voteCouncil?.voters || []).filter((v) => v.weight > 0).slice(0, 3);
                            const rcSignals = [0, 1, 2].map((idx) => activeEntryVoters[idx] || null);

                            return (
                                <>
                                    <svg
                                        viewBox="0 0 220 100"
                                        preserveAspectRatio="none"
                                        className="absolute inset-0 w-full h-full overflow-visible"
                                    >
                                        <defs>
                                            <linearGradient id="svSparkGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
                                                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>

                                        {/* Area fill under price curve */}
                                        {areaPts && <polygon points={areaPts} fill="url(#svSparkGrad)" />}

                                        {/* Open Order Level Lines (Center -> Far Right, thin Buy/Sell colored lines) */}
                                        {spark.openOrders.map((o, idx) => {
                                            const oy = pctOf(o.p);
                                            const isBuy = o.t === 'B';
                                            return (
                                                <line
                                                    key={`ord-${idx}`}
                                                    x1="110"
                                                    y1={oy}
                                                    x2="220"
                                                    y2={oy}
                                                    stroke={isBuy ? '#38bdf8' : '#fb923c'}
                                                    strokeWidth="0.7"
                                                    vectorEffect="non-scaling-stroke"
                                                    opacity="0.7"
                                                />
                                            );
                                        })}

                                        {/* TP Line */}
                                        {tpPct !== null && (
                                            <line
                                                x1="0"
                                                y1={tpPct}
                                                x2="220"
                                                y2={tpPct}
                                                stroke="#10b981"
                                                strokeWidth="1"
                                                strokeDasharray="3 2"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}

                                        {/* SL Line (only if SL is configured) */}
                                        {slPct !== null && (
                                            <line
                                                x1="0"
                                                y1={slPct}
                                                x2="220"
                                                y2={slPct}
                                                stroke="#f59e0b"
                                                strokeWidth="1"
                                                strokeDasharray="2 2"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}

                                        {/* Rescue (RC) Line (only when Frozen) */}
                                        {rcPct !== null && (
                                            <line
                                                x1="0"
                                                y1={rcPct}
                                                x2="220"
                                                y2={rcPct}
                                                stroke="#fb7185"
                                                strokeWidth="1"
                                                strokeDasharray="3 2"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        )}

                                        {/* Current Price (Now) Line */}
                                        <line
                                            x1="0"
                                            y1={bidPct}
                                            x2="220"
                                            y2={bidPct}
                                            stroke="#38bdf8"
                                            strokeWidth="0.8"
                                            strokeDasharray="2 2"
                                            vectorEffect="non-scaling-stroke"
                                            opacity="0.75"
                                        />

                                        {/* Full Price Polyline */}
                                        {spark.closes.length > 1 && (
                                            <polyline
                                                fill="none"
                                                stroke="#22d3ee"
                                                strokeWidth="1.6"
                                                vectorEffect="non-scaling-stroke"
                                                points={pts}
                                            />
                                        )}
                                    </svg>

                                    {/* Crisp Non-Stretched HTML Markers & Labels */}
                                    <div className="pointer-events-none absolute inset-0">
                                        {/* TP Label + Trend Direction Triangle + 5 Level Dots */}
                                        {tpPct !== null && (
                                            <div
                                                style={{ top: `${tpPct}%` }}
                                                className="absolute left-0.5 flex items-center gap-1 -translate-y-1/2"
                                            >
                                                <span className="font-mono text-[8px] sm:text-[9px] font-bold text-emerald-400 leading-none bg-[#030710]/80 px-0.5 rounded">
                                                    TP
                                                </span>
                                                {trendDir === 'BUY' && (
                                                    <div className="flex items-center gap-[2px] -translate-y-[5px] bg-[#030710]/70 px-0.5 rounded">
                                                        <svg viewBox="0 0 8 7" className="w-2 h-2 text-emerald-400 shrink-0">
                                                            <polygon points="4,0 8,7 0,7" fill="currentColor" />
                                                        </svg>
                                                        <div className="flex items-center gap-[2px]">
                                                            {[1, 2, 3, 4, 5].map((lv) => (
                                                                <span
                                                                    key={`t-dot-${lv}`}
                                                                    className={`w-[5px] h-[5px] rounded-full ${
                                                                        lv <= trendLevel
                                                                            ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.75)]'
                                                                            : 'bg-slate-600/80'
                                                                    }`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {trendDir === 'SELL' && (
                                                    <div className="flex items-center gap-[2px] translate-y-[6px] bg-[#030710]/70 px-0.5 rounded">
                                                        <svg viewBox="0 0 8 7" className="w-2 h-2 text-rose-400 shrink-0">
                                                            <polygon points="0,0 8,0 4,7" fill="currentColor" />
                                                        </svg>
                                                        <div className="flex items-center gap-[2px]">
                                                            {[1, 2, 3, 4, 5].map((lv) => (
                                                                <span
                                                                    key={`t-dot-${lv}`}
                                                                    className={`w-[5px] h-[5px] rounded-full ${
                                                                        lv <= trendLevel
                                                                            ? 'bg-rose-400 shadow-[0_0_4px_rgba(251,113,133,0.75)]'
                                                                            : 'bg-slate-600/80'
                                                                    }`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* SL Label (only when SL is set) */}
                                        {slPct !== null && (
                                            <div
                                                style={{ top: `${slPct}%` }}
                                                className="absolute left-0.5 -translate-y-1/2"
                                            >
                                                <span className="font-mono text-[8px] sm:text-[9px] font-bold text-amber-400 leading-none bg-[#030710]/85 px-0.5 rounded">
                                                    SL
                                                </span>
                                            </div>
                                        )}

                                        {/* Rescue (RC) Label + 3 Larger Vote Signal Circles */}
                                        {rcPct !== null && (
                                            <div
                                                style={{ top: `${rcPct}%` }}
                                                className="absolute left-0.5 -translate-y-1/2 flex items-center gap-1"
                                            >
                                                <span className="font-mono text-[8px] sm:text-[9px] font-extrabold text-rose-300 leading-none bg-[#030710]/90 px-0.5 rounded">
                                                    RC
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {rcSignals.map((sig, idx) => {
                                                        const vote = sig?.vote || 'WAIT';
                                                        const isYes = vote === 'YES';
                                                        const isNo = vote === 'NO';
                                                        return (
                                                            <span
                                                                key={`rc-sig-${idx}`}
                                                                title={sig ? `${sig.id}: ${vote}` : 'Signal'}
                                                                className={`w-3 h-3 rounded-full border flex items-center justify-center shadow-sm ${
                                                                    isYes
                                                                        ? 'bg-emerald-500/90 border-emerald-300 text-white shadow-[0_0_5px_rgba(16,185,129,0.7)]'
                                                                        : isNo
                                                                        ? 'bg-rose-500/90 border-rose-300 text-white shadow-[0_0_5px_rgba(244,63,94,0.6)]'
                                                                        : 'bg-slate-700/90 border-slate-500 text-slate-300'
                                                                }`}
                                                            >
                                                                {isYes ? (
                                                                    <svg viewBox="0 0 10 10" className="w-2 h-2">
                                                                        <path
                                                                            d="M2 5.2 L4.2 7.4 L8.2 2.8"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="1.6"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        />
                                                                    </svg>
                                                                ) : isNo ? (
                                                                    <svg viewBox="0 0 10 10" className="w-2 h-2">
                                                                        <path
                                                                            d="M2.6 2.6 L7.4 7.4 M7.4 2.6 L2.6 7.4"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="1.6"
                                                                            strokeLinecap="round"
                                                                        />
                                                                    </svg>
                                                                ) : (
                                                                    <span className="w-1 h-1 rounded-full bg-current" />
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Current Price (Now) Label */}
                                        <div
                                            style={{ top: `${bidPct}%` }}
                                            className="absolute left-0.5 -translate-y-1/2"
                                        >
                                            <span className="font-mono text-[8px] sm:text-[9px] font-bold text-sky-400 leading-none bg-[#030710]/85 px-0.5 rounded">
                                                Now
                                            </span>
                                        </div>

                                        {/* Current Bid Dot */}
                                        <span
                                            style={{ top: `${bidPct}%`, right: '1px' }}
                                            className="absolute -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-white border-[1.5px] border-cyan-400 shadow-[0_0_5px_#22d3ee]"
                                        />
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <div className="flex items-center justify-between font-mono text-[8px] text-slate-400 leading-none shrink-0 z-10">
                        <span className="text-emerald-400">
                            TP:{spark.estTp > 0 ? spark.estTp.toFixed(digits) : '--'}
                        </span>
                        <span className={freezeStopLoss < 0 ? 'text-amber-400' : 'text-slate-600'}>
                            SL:{freezeStopLoss < 0 && spark.estSl > 0 ? spark.estSl.toFixed(digits) : '-'}
                        </span>
                    </div>
                </div>

                {/* =========================================================
                    SECTION 4 (1/6 width): Vertical PnL Bar + Big Number + Per-Round Peak Tick
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

                    {/* Vertical Bar + Per-Round Peak Tick */}
                    <div className="my-0.5 flex-1 flex items-center justify-center gap-1 min-h-0">
                        <div className="relative h-full w-3.5 sm:w-4 rounded bg-slate-900 border border-slate-800 overflow-hidden flex flex-col justify-end">
                            {(() => {
                                const curRatio = Math.min(100, Math.round((Math.abs(liveCyclePnl) / pnlScaleMax) * 100));
                                const peakRatio = Math.min(97, Math.max(4, Math.round((Math.abs(peakPnlRound) / pnlScaleMax) * 100)));

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
                                            title={`Peak ของรอบนี้: ${peakPnlRound >= 0 ? '+' : ''}${peakPnlRound.toFixed(1)} ${currency}`}
                                            className="absolute inset-x-0 h-[2px] bg-amber-300 shadow-[0_0_4px_#fcd34d] z-10"
                                        />
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex flex-col justify-between h-full font-mono text-[7.5px] sm:text-[8.5px] text-left leading-none py-0.5">
                            <div>
                                <div className="text-amber-300/90 font-bold" title="Peak สูงสุดของรอบปัจจุบัน">
                                    PK
                                </div>
                                <div className="text-amber-200 tabular-nums">
                                    {peakPnlRound >= 0 ? '+' : ''}
                                    {peakPnlRound.toFixed(0)}
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
                SECTION 5: 5 Key Metrics Bottom Strip
                1. กำไรวันนี้
                2. ตั้ง TP / SL (รวมในช่องเดียวกัน ขนาดตัวเลขลดลงครึ่งนึง)
                3. ไม้ออกรวม
                4. ลอตรวม (ขนาดตัวเลขลดลงครึ่งนึง + เส้นแนวนอนซ้อนกันสองเส้น Buy/Sell)
                5. PnL Buy / Sell (เส้นแนวนอนสองเส้น บน=Buy ล่าง=Sell บวก/ลบซ้ายขวาต่อเนื่องบนเส้นเดียวกัน จัดวางกลางช่อง พร้อมตัวเลขกำกับ)
               ========================================================= */}
            <div className="grid grid-cols-5 gap-1 sm:gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/80 px-1.5 py-1.5 sm:px-2.5 sm:py-2 font-mono text-center items-center">
                {/* 1. Today's Profit */}
                <div className="flex flex-col justify-center gap-0.5 min-w-0">
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

                {/* 2. Combined TP & SL (2 lines only: TP +20 and SL -, maximized number size) */}
                <div className="flex flex-col items-center justify-center gap-0.5 border-l border-slate-800 pl-1 sm:pl-2 min-w-0">
                    <div className="flex items-baseline justify-center gap-1 leading-tight">
                        <span className="text-[9px] sm:text-xs font-bold text-slate-400">TP</span>
                        <span className="text-xs sm:text-base font-extrabold text-cyan-300 leading-tight tabular-nums truncate">
                            {targetProfit >= 0 ? `+${targetProfit}` : targetProfit}
                        </span>
                    </div>
                    <div className="flex items-baseline justify-center gap-1 leading-tight">
                        <span className="text-[9px] sm:text-xs font-bold text-slate-400">SL</span>
                        <span
                            className={`text-xs sm:text-base font-extrabold leading-tight tabular-nums truncate ${
                                freezeStopLoss < 0 ? 'text-amber-300' : 'text-slate-500'
                            }`}
                        >
                            {freezeStopLoss < 0 ? freezeStopLoss : '-'}
                        </span>
                    </div>
                </div>

                {/* 3. Total Open Trades */}
                <div className="flex flex-col justify-center gap-0.5 border-l border-slate-800 pl-1 sm:pl-2 min-w-0">
                    <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ไม้ออกรวม</span>
                    <span className="text-base sm:text-2xl font-extrabold text-white leading-none tabular-nums">
                        {metrics.totalTrades}
                    </span>
                </div>

                {/* 4. Total Lots (Same number size as TP/SL + 2 stacked horizontal bars for Buy & Sell Lots) */}
                <div className="flex flex-col justify-center gap-0.5 border-l border-slate-800 pl-1 sm:pl-2 min-w-0">
                    <div className="flex items-baseline justify-center gap-1 leading-tight">
                        <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ลอต</span>
                        <span className="text-xs sm:text-base font-extrabold text-sky-300 leading-tight tabular-nums">
                            {metrics.totalLot.toFixed(2)}
                        </span>
                    </div>
                    {(() => {
                        const maxSideLot = Math.max(0.01, metrics.buyLot, metrics.sellLot);
                        const buyLotPct = Math.min(100, Math.round((metrics.buyLot / maxSideLot) * 100));
                        const sellLotPct = Math.min(100, Math.round((metrics.sellLot / maxSideLot) * 100));
                        return (
                            <div className="flex flex-col justify-center gap-0.5 w-full px-0.5">
                                {/* Top Horizontal Line: Buy Lot */}
                                <div className="flex items-center gap-1 w-full">
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-950 border border-slate-800/90 overflow-hidden">
                                        <div
                                            style={{ width: `${buyLotPct}%` }}
                                            className="h-full bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.45)] rounded-full transition-all"
                                        />
                                    </div>
                                    <span className="text-[7.5px] sm:text-[9px] font-bold text-sky-300 leading-none tabular-nums shrink-0">
                                        {metrics.buyLot.toFixed(2)}
                                    </span>
                                </div>
                                {/* Bottom Horizontal Line: Sell Lot */}
                                <div className="flex items-center gap-1 w-full">
                                    <div className="flex-1 h-1.5 rounded-full bg-slate-950 border border-slate-800/90 overflow-hidden">
                                        <div
                                            style={{ width: `${sellLotPct}%` }}
                                            className="h-full bg-orange-400 shadow-[0_0_4px_rgba(251,146,60,0.45)] rounded-full transition-all"
                                        />
                                    </div>
                                    <span className="text-[7.5px] sm:text-[9px] font-bold text-orange-300 leading-none tabular-nums shrink-0">
                                        {metrics.sellLot.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* 5. Rightmost Box: 2 Horizontal PnL Lines (Top = Buy, Bottom = Sell, Continuous Left(-) / Right(+) on same line, centered with labels) */}
                <div className="flex flex-col justify-center gap-1 border-l border-slate-800 pl-1 sm:pl-2 min-w-0 h-full">
                    {(() => {
                        const bPnl = metrics.buyPnl;
                        const sPnl = metrics.sellPnl;
                        const maxAbsSidePnl = Math.max(10, Math.abs(bPnl), Math.abs(sPnl));
                        const bHalfPct = Math.min(50, Math.round((Math.abs(bPnl) / maxAbsSidePnl) * 50));
                        const sHalfPct = Math.min(50, Math.round((Math.abs(sPnl) / maxAbsSidePnl) * 50));

                        const fmtPnl = (v: number) => {
                            const sign = v > 0 ? '+' : '';
                            return `${sign}${Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)}`;
                        };

                        return (
                            <div className="flex flex-col justify-center gap-1 w-full px-0.5 my-auto">
                                {/* Top Line: Buy PnL (Left = -, Right = + continuous on same line) */}
                                <div className="flex flex-col gap-[2px] w-full">
                                    <div className="flex items-center justify-between text-[7.5px] sm:text-[9px] leading-none px-0.5">
                                        <span className="font-bold text-sky-400">B</span>
                                        <span
                                            className={`font-extrabold tabular-nums truncate ${
                                                bPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                        >
                                            {fmtPnl(bPnl)}
                                        </span>
                                    </div>
                                    <div className="relative h-1.5 w-full rounded-full bg-slate-950 border border-slate-800/90 overflow-hidden">
                                        {/* Center 0 Axis */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-500/80 z-10" />
                                        {bPnl < 0 ? (
                                            <div
                                                style={{ width: `${bHalfPct}%`, right: '50%' }}
                                                className="absolute top-0 bottom-0 bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.5)] rounded-l-full transition-all"
                                            />
                                        ) : bPnl > 0 ? (
                                            <div
                                                style={{ width: `${bHalfPct}%`, left: '50%' }}
                                                className="absolute top-0 bottom-0 bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)] rounded-r-full transition-all"
                                            />
                                        ) : null}
                                    </div>
                                </div>

                                {/* Bottom Line: Sell PnL (Left = -, Right = + continuous on same line) */}
                                <div className="flex flex-col gap-[2px] w-full">
                                    <div className="flex items-center justify-between text-[7.5px] sm:text-[9px] leading-none px-0.5">
                                        <span className="font-bold text-orange-400">S</span>
                                        <span
                                            className={`font-extrabold tabular-nums truncate ${
                                                sPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                            }`}
                                        >
                                            {fmtPnl(sPnl)}
                                        </span>
                                    </div>
                                    <div className="relative h-1.5 w-full rounded-full bg-slate-950 border border-slate-800/90 overflow-hidden">
                                        {/* Center 0 Axis */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-500/80 z-10" />
                                        {sPnl < 0 ? (
                                            <div
                                                style={{ width: `${sHalfPct}%`, right: '50%' }}
                                                className="absolute top-0 bottom-0 bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.5)] rounded-l-full transition-all"
                                            />
                                        ) : sPnl > 0 ? (
                                            <div
                                                style={{ width: `${sHalfPct}%`, left: '50%' }}
                                                className="absolute top-0 bottom-0 bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)] rounded-r-full transition-all"
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}
