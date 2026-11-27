'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, RefreshCw, RotateCcw } from 'lucide-react';
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
    bets_opened?: number;
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
    todayProfit?: number | null;
    targetProfit: number;
    baseTargetProfit?: number;
    freezeStopLoss: number;
    spacingPoints: number;
    initialLot: number;
    lotIncrement: number;
    chart?: SmartChartData | null;
    voteCouncil?: VoteCouncilOverview | null;
    roundHistory?: RoundHistoryTuple[] | null;
    isOnline?: boolean;
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
    todayProfit: todayProfitProp,
    targetProfit,
    baseTargetProfit,
    freezeStopLoss,
    spacingPoints,
    initialLot,
    lotIncrement,
    chart,
    voteCouncil,
    roundHistory,
    isOnline = true,
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

        // Elapsed time since first open order of current round (in HH:MM, using MT5 server time)
        let roundElapsedLabel = '--:--';
        if (totalTrades > 0) {
            const orderTimes = orders.map((o) => o.tm || 0).filter((t) => t > 0);
            const earliestOrderTm = orderTimes.length > 0 ? Math.min(...orderTimes) : 0;
            const roundStartUnix =
                earliestOrderTm > 0
                    ? earliestOrderTm
                    : Number(chart?.round_started || 0) > 0
                    ? Number(chart?.round_started)
                    : 0;
            const candles = chart?.candles || [];
            const latestCandleTime =
                candles.length > 0 ? Number(candles[candles.length - 1][0]) || 0 : 0;

            if (roundStartUnix > 0) {
                const refNowUnix =
                    latestCandleTime >= roundStartUnix
                        ? latestCandleTime
                        : Math.floor(Date.now() / 1000);
                const elapsedSec = Math.max(0, refNowUnix - roundStartUnix);
                const totalMins = Math.floor(elapsedSec / 60);
                const hh = Math.floor(totalMins / 60);
                const mm = totalMins % 60;
                roundElapsedLabel = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
            }
        }

        const hasExactSidePnl =
            typeof chart?.buy_pnl === 'number' && typeof chart?.sell_pnl === 'number';
        const buyPnl = hasExactSidePnl ? (chart?.buy_pnl ?? 0) : sumBuyOrderPnl;
        const sellPnl = hasExactSidePnl ? (chart?.sell_pnl ?? 0) : sumSellOrderPnl;

        // Today's real closed profit from MT5 (falls back to roundHistory if older EA doesn't send today_profit)
        let todayProfit = 0;
        if (typeof todayProfitProp === 'number' && !Number.isNaN(todayProfitProp)) {
            todayProfit = todayProfitProp;
        } else {
            const now = new Date();
            const bkkNowMs = now.getTime() + 7 * 3600 * 1000;
            const bkkDate = new Date(bkkNowMs);
            const minsSince0500 = ((bkkDate.getUTCHours() * 60 + bkkDate.getUTCMinutes()) - 300 + 1440) % 1440;
            const startOfTradingDayUnix = Math.floor((now.getTime() - minsSince0500 * 60 * 1000) / 1000);

            if (Array.isArray(roundHistory)) {
                for (const r of roundHistory) {
                    if (Array.isArray(r) && Number(r[0]) >= startOfTradingDayUnix) {
                        todayProfit += Number(r[2]) || 0;
                    }
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
            roundElapsedLabel,
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

    // Smooth step-by-step VU bar animation (1 bar at a time instead of jumping abruptly)
    const [animOpenBuy, setAnimOpenBuy] = useState<number>(openBuy);
    const [animOpenSell, setAnimOpenSell] = useState<number>(openSell);

    useEffect(() => {
        if (animOpenBuy === openBuy) return;
        const diff = Math.abs(openBuy - animOpenBuy);
        const stepMs = Math.max(55, Math.min(130, Math.floor(650 / diff)));
        const timer = setTimeout(() => {
            setAnimOpenBuy((prev) => (prev < openBuy ? prev + 1 : prev - 1));
        }, stepMs);
        return () => clearTimeout(timer);
    }, [animOpenBuy, openBuy]);

    useEffect(() => {
        if (animOpenSell === openSell) return;
        const diff = Math.abs(openSell - animOpenSell);
        const stepMs = Math.max(55, Math.min(130, Math.floor(650 / diff)));
        const timer = setTimeout(() => {
            setAnimOpenSell((prev) => (prev < openSell ? prev + 1 : prev - 1));
        }, stepMs);
        return () => clearTimeout(timer);
    }, [animOpenSell, openSell]);

    // Clamped display slots for Section 2 (1..30)
    const clampedTpSlot =
        metrics.tpTradeLevel !== null ? Math.min(FIXED_VU_SLOTS, Math.max(1, metrics.tpTradeLevel)) : null;
    const clampedBeSlot =
        metrics.beTradeLevel !== null ? Math.min(FIXED_VU_SLOTS, Math.max(1, metrics.beTradeLevel)) : null;
    const sec2BuyLabelSlot = animOpenBuy <= 0 ? 1 : Math.min(FIXED_VU_SLOTS, animOpenBuy + 1);
    const sec2SellLabelSlot = animOpenSell <= 0 ? 1 : Math.min(FIXED_VU_SLOTS, animOpenSell + 1);

    // =========================================================================
    // SYNCHRONIZED 1-SECOND LIVE TICK + 3-SECOND TIME-LAPSE CLOSE REPLAY (1-3m)
    // =========================================================================
    const [tickOffset, setTickOffset] = useState(0);
    const [closeReplay, setCloseReplay] = useState<{
        progress: number; // 0..1 over 3000ms
        profit: number;
        trades: number;
        durationSec: number;
        closes: number[];
        tpPrice: number;
        tpMoney: number;
        minP: number;
        maxP: number;
        openBuyCount: number;
        openSellCount: number;
        startPnl: number;
        orders: { t: 'B' | 'S'; p: number }[];
    } | null>(null);

    const lastSeenCloseTsRef = useRef<number | null>(null);
    const replayRafRef = useRef<number | null>(null);
    const preCloseBufferRef = useRef<
        { ts: number; bid: number; openBuy: number; openSell: number; cyclePnl: number }[]
    >([]);

    // Reset live tick offset whenever a real MT5 snapshot arrives
    useEffect(() => {
        setTickOffset(0);
    }, [chart?.bid, chart?.candles?.length, lastPing]);

    // Every ~900ms micro-tick for live market feel (synchronized between Line Chart & PnL Bar)
    useEffect(() => {
        if (!isOnline || isWaitingFreshData || closeReplay || !chart?.bid || chart.bid <= 0) {
            setTickOffset(0);
            return;
        }
        const step = pointSize * (digits <= 2 ? 12 : 6);
        const timer = setInterval(() => {
            setTickOffset((prev) => {
                const delta = (Math.random() - 0.49) * step * 1.9;
                const next = prev + delta;
                const maxDrift = step * 5;
                if (next > maxDrift) return maxDrift * 0.8;
                if (next < -maxDrift) return -maxDrift * 0.8;
                return next;
            });
        }, 900);
        return () => clearInterval(timer);
    }, [isOnline, isWaitingFreshData, closeReplay, chart?.bid, pointSize, digits]);

    const latestClosedRound = useMemo(() => {
        if (!Array.isArray(roundHistory) || roundHistory.length === 0) return null;
        let best: RoundHistoryTuple | null = null;
        for (const r of roundHistory) {
            if (Array.isArray(r) && Number(r[0]) > (best ? Number(best[0]) : 0)) {
                best = r;
            }
        }
        return best;
    }, [roundHistory]);

    // Record rolling 3-minute snapshots & active chart state while a round is open
    useEffect(() => {
        if (!port || openBuy + openSell <= 0 || !chart?.candles?.length) return;
        const nowSec = Math.floor(Date.now() / 1000);
        const bid = chart.bid > 0 ? chart.bid : chart.candles[chart.candles.length - 1][4] || 0;
        if (bid > 0) {
            const buf = preCloseBufferRef.current;
            const last = buf[buf.length - 1];
            if (!last || nowSec - last.ts >= 5) {
                buf.push({ ts: nowSec, bid, openBuy, openSell, cyclePnl: liveCyclePnl });
                // Keep last ~4 minutes of snapshots
                while (buf.length > 0 && nowSec - buf[0].ts > 240) {
                    buf.shift();
                }
            }
        }

        const estTp = chart.est_tp_price > 0 ? chart.est_tp_price : bid;
        const rawOrders = (chart.orders || [])
            .filter((o) => (o.t === 'B' || o.t === 'S') && o.p > 0)
            .map((o) => ({ t: o.t as 'B' | 'S', p: o.p }));
        const startSnap = preCloseBufferRef.current[0];

        try {
            localStorage.setItem(
                `sv_last_active_chart_${port}`,
                JSON.stringify({
                    candles: chart.candles.slice(-20),
                    estTp,
                    effTp: targetProfit,
                    bid,
                    openBuy,
                    openSell,
                    startPnl: startSnap ? startSnap.cyclePnl : liveCyclePnl,
                    orders: rawOrders,
                    trailBids: preCloseBufferRef.current.slice(-18).map((s) => s.bid),
                })
            );
        } catch {
            // ignore storage errors
        }
    }, [port, openBuy, openSell, chart, targetProfit, liveCyclePnl]);

    const startCloseReplay = useCallback(
        (roundTuple: RoundHistoryTuple) => {
            if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);

            const closeTime = Number(roundTuple[0]) || 0;
            const trades = Number(roundTuple[1]) || 0;
            const profit = Number(roundTuple[2]) || 0;
            const durationSec = Number(roundTuple[3]) || 0;

            let replayRecord: any = null;
            try {
                const exactRaw = port ? localStorage.getItem(`sv_last_close_replay_v2_${port}`) : null;
                if (exactRaw) {
                    const parsed = JSON.parse(exactRaw);
                    if (parsed && Number(parsed.closeTime) === closeTime) {
                        replayRecord = parsed;
                    }
                }
                if (!replayRecord) {
                    const activeRaw = port ? localStorage.getItem(`sv_last_active_chart_${port}`) : null;
                    if (activeRaw) {
                        replayRecord = JSON.parse(activeRaw);
                    }
                }
            } catch {
                // ignore
            }

            // Pick real candles from the last 1-3 minutes before close (or full short round)
            const windowSec = Math.min(180, Math.max(60, durationSec || 120));
            const srcCandles: [number, number, number, number, number][] =
                (Array.isArray(replayRecord?.candles) && replayRecord.candles.length > 0
                    ? replayRecord.candles
                    : chart?.candles) || [];

            let recentCloses: number[] = [];
            if (srcCandles.length > 0 && closeTime > 0) {
                const inWindow = srcCandles.filter(
                    (c) => Number(c[0]) <= closeTime + 60 && Number(c[0]) >= closeTime - windowSec
                );
                if (inWindow.length >= 2) {
                    recentCloses = inWindow.map((c) => c[4]);
                }
            }
            if (recentCloses.length < 3 && Array.isArray(replayRecord?.trailBids) && replayRecord.trailBids.length >= 3) {
                recentCloses = replayRecord.trailBids.map(Number).filter((n: number) => n > 0);
            }
            if (recentCloses.length < 3 && srcCandles.length > 0) {
                // Use last 3-6 real candles (~3 mins)
                recentCloses = srcCandles.slice(-Math.min(6, srcCandles.length)).map((c) => c[4]);
            }
            if (recentCloses.length < 2) {
                const base = chart?.bid && chart.bid > 0 ? chart.bid : 3500;
                recentCloses = [base - pointSize * 40, base - pointSize * 15, base];
            }

            let tpPrice = Number(replayRecord?.estTp || 0);
            if (tpPrice <= 0 && chart?.est_tp_price && chart.est_tp_price > 0) {
                tpPrice = chart.est_tp_price;
            }
            const lastReal = recentCloses[recentCloses.length - 1];
            if (tpPrice <= 0) {
                tpPrice = lastReal;
            }

            // Interpolate smoothly between real pre-close points so 1-3 min history plays smoothly in 3s
            const interpCloses: number[] = [];
            const rawPts = [...recentCloses, tpPrice];
            for (let i = 0; i < rawPts.length - 1; i++) {
                const a = rawPts[i];
                const b = rawPts[i + 1];
                const steps = 4;
                for (let s = 0; s < steps; s++) {
                    interpCloses.push(a + ((b - a) * s) / steps);
                }
            }
            interpCloses.push(tpPrice);

            const replayOrders: { t: 'B' | 'S'; p: number }[] = Array.isArray(replayRecord?.orders)
                ? replayRecord.orders
                : [];
            const cMin = Math.min(...interpCloses);
            const cMax = Math.max(...interpCloses);
            const pad = Math.max((cMax - cMin) * 0.16, pointSize * 25);

            const recBuy = Number(replayRecord?.openBuy || 0);
            const recSell = Number(replayRecord?.openSell || 0);
            const fallbackHalf = Math.max(1, Math.floor(trades / 2));
            const openBuyCount = recBuy + recSell > 0 ? recBuy : Math.max(1, trades - fallbackHalf);
            const openSellCount = recBuy + recSell > 0 ? recSell : Math.max(0, fallbackHalf);
            const startPnl =
                typeof replayRecord?.startPnl === 'number'
                    ? replayRecord.startPnl
                    : profit > 0
                    ? -Math.max(10, profit * 0.6)
                    : profit * 1.2;

            const startTime = performance.now();
            const durationMs = 3000;

            const stepFrame = (now: number) => {
                const p = Math.min(1, (now - startTime) / durationMs);
                setCloseReplay({
                    progress: p,
                    profit,
                    trades,
                    durationSec,
                    closes: interpCloses,
                    tpPrice,
                    tpMoney: typeof replayRecord?.effTp === 'number' ? replayRecord.effTp : targetProfit,
                    minP: cMin - pad,
                    maxP: cMax + pad,
                    openBuyCount,
                    openSellCount,
                    startPnl,
                    orders: replayOrders,
                });
                if (p < 1) {
                    replayRafRef.current = requestAnimationFrame(stepFrame);
                } else {
                    setCloseReplay(null);
                    replayRafRef.current = null;
                }
            };

            replayRafRef.current = requestAnimationFrame(stepFrame);
        },
        [chart, port, targetProfit, pointSize]
    );

    // Auto-trigger 3-second Close-Moment Animation & lock in real pre-close snapshot whenever a new round closes
    useEffect(() => {
        const ts = latestClosedRound ? Number(latestClosedRound[0]) || 0 : 0;
        if (lastSeenCloseTsRef.current === null) {
            lastSeenCloseTsRef.current = ts;
            return;
        }
        if (ts > lastSeenCloseTsRef.current && latestClosedRound) {
            lastSeenCloseTsRef.current = ts;
            try {
                const activeRaw = port ? localStorage.getItem(`sv_last_active_chart_${port}`) : null;
                if (activeRaw && port) {
                    const parsed = JSON.parse(activeRaw);
                    localStorage.setItem(
                        `sv_last_close_replay_v2_${port}`,
                        JSON.stringify({ ...parsed, closeTime: ts })
                    );
                }
            } catch {
                // ignore
            }
            preCloseBufferRef.current = [];
            startCloseReplay(latestClosedRound);
        }
    }, [latestClosedRound, port, startCloseReplay]);

    useEffect(() => {
        return () => {
            if (replayRafRef.current) cancelAnimationFrame(replayRafRef.current);
        };
    }, []);

    // Synchronized PnL driven by live tickOffset (or interpolated from real pre-close PnL during 3s Close Replay)
    const syncedCyclePnl = useMemo(() => {
        if (closeReplay) {
            const moveP = Math.min(1, closeReplay.progress / 0.72);
            const eased = 1 - Math.pow(1 - moveP, 2.0);
            return closeReplay.startPnl + (closeReplay.profit - closeReplay.startPnl) * eased;
        }
        if (!tickOffset) return liveCyclePnl;
        const netLot = metrics.buyLot - metrics.sellLot;
        const tickPts = tickOffset / pointSize;
        const deltaUsd = (netLot / 0.01) * tickPts * 0.01;
        return liveCyclePnl + deltaUsd;
    }, [closeReplay, liveCyclePnl, tickOffset, metrics.buyLot, metrics.sellLot, pointSize]);

    // =========================================================================
    // SECTION 3: Mini Price Sparkline (Full candle history window, 50% width)
    // =========================================================================
    const spark = useMemo(() => {
        const candles = chart?.candles || [];
        const baseCloses = candles.map((c) => c[4]);
        const highs = candles.map((c) => c[2]);
        const lows = candles.map((c) => c[3]);
        const rawBid = chart?.bid && chart.bid > 0 ? chart.bid : baseCloses[baseCloses.length - 1] || 0;
        const bid = rawBid > 0 ? rawBid + tickOffset : 0;
        const closes = baseCloses.slice();
        if (closes.length === 0 && bid > 0) {
            closes.push(bid);
        } else if (closes.length > 0 && tickOffset !== 0) {
            closes[closes.length - 1] = closes[closes.length - 1] + tickOffset;
        }

        let minP = lows.length > 0 ? Math.min(...lows) : bid - 1;
        let maxP = highs.length > 0 ? Math.max(...highs) : bid + 1;
        if (bid > 0) {
            minP = Math.min(minP, bid);
            maxP = Math.max(maxP, bid);
        }

        let estTp = chart?.est_tp_price && chart.est_tp_price > 0 ? chart.est_tp_price : 0;
        const hasEffectiveTp = typeof (chart as any)?.effective_tp === 'number';
        const rescueOpenedForTp = Boolean(
            voteCouncil &&
                ((voteCouncil.bets_opened ?? 0) > 0 ||
                    voteCouncil.mode === 'BET_ACTIVE' ||
                    voteCouncil.mode === 'SL_DONE')
        );
        const effTpMoney = hasEffectiveTp
            ? Number((chart as any).effective_tp)
            : rescueOpenedForTp
            ? Math.min(targetProfit, -300)
            : targetProfit;

        // If EA hasn't sent effective_tp yet while Rescue is open, scale estTp from baseTargetProfit -> effTpMoney
        const scaleBaseTp = baseTargetProfit ?? targetProfit;
        if (!hasEffectiveTp && rescueOpenedForTp && estTp > 0 && bid > 0 && Math.abs(scaleBaseTp - liveCyclePnl) > 0.01) {
            const dTp = estTp - bid;
            const ratio = (effTpMoney - liveCyclePnl) / (scaleBaseTp - liveCyclePnl);
            estTp = bid + dTp * ratio;
        }

        let estSl = (chart as any)?.est_sl_price > 0 ? (chart as any).est_sl_price : 0;
        if (estSl <= 0 && freezeStopLoss < 0 && estTp > 0 && bid > 0 && Math.abs(targetProfit - liveCyclePnl) > 0.01) {
            const dTp = estTp - bid;
            const ratio = (freezeStopLoss - liveCyclePnl) / (targetProfit - liveCyclePnl);
            estSl = bid + dTp * ratio;
        }

        const hasRescueEntry = Boolean(
            (isBuyFrozen || isSellFrozen) &&
                voteCouncil &&
                (voteCouncil.mode === 'BET_ACTIVE' || (voteCouncil.bets_opened ?? 0) > 0) &&
                (voteCouncil.entry_px ?? 0) > 0
        );
        const rcEntryPx = hasRescueEntry ? Number(voteCouncil?.entry_px || 0) : 0;

        const rcPrice =
            isBuyFrozen || isSellFrozen
                ? hasRescueEntry
                    ? rcEntryPx
                    : voteCouncil?.trigger_px && voteCouncil.trigger_px > 0
                    ? voteCouncil.trigger_px
                    : voteCouncil?.mirror_px && voteCouncil.mirror_px > 0
                    ? voteCouncil.mirror_px
                    : chart?.freeze_price && chart.freeze_price > 0
                    ? chart.freeze_price
                    : 0
                : 0;

        const openOrders = (chart?.orders || []).filter((o) => (o.t === 'B' || o.t === 'S') && o.p > 0);

        const pad = Math.max((maxP - minP) * 0.12, pointSize * 20);
        minP -= pad;
        maxP += pad;

        return { closes, bid, minP, maxP, estTp, effTpMoney, estSl, rcPrice, rcEntryPx, openOrders };
    }, [chart, tickOffset, voteCouncil, isBuyFrozen, isSellFrozen, pointSize, freezeStopLoss, targetProfit, baseTargetProfit, liveCyclePnl]);

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
                            const vuBuyVal = closeReplay
                                ? closeReplay.progress < 0.72
                                    ? closeReplay.openBuyCount
                                    : 0
                                : animOpenBuy;
                            const vuSellVal = closeReplay
                                ? closeReplay.progress < 0.72
                                    ? closeReplay.openSellCount
                                    : 0
                                : animOpenSell;
                            const clampedOpenBuy = Math.min(maxBuySlots, vuBuyVal);
                            const clampedOpenSell = Math.min(maxSellSlots, vuSellVal);

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
                                                {animOpenBuy}
                                            </span>
                                        ) : (
                                            <div
                                                className={`w-full h-full max-h-[5px] rounded-[1px] transition-all duration-150 ${
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
                                                {animOpenSell}
                                            </span>
                                        ) : (
                                            <div
                                                className={`w-full h-full max-h-[5px] rounded-[1px] transition-all duration-150 ${
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
                            const vuBuyVal2 = closeReplay
                                ? closeReplay.progress < 0.72
                                    ? closeReplay.openBuyCount
                                    : 0
                                : animOpenBuy;
                            const vuSellVal2 = closeReplay
                                ? closeReplay.progress < 0.72
                                    ? closeReplay.openSellCount
                                    : 0
                                : animOpenSell;
                            const buyLit = vuBuyVal2 >= lv;
                            const sellLit = vuSellVal2 >= lv;
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
                                                {animOpenBuy}
                                            </span>
                                        )}
                                        <div
                                            className={`w-full h-full max-h-[5px] rounded-[1px] transition-colors duration-150 ${
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
                                                {animOpenSell}
                                            </span>
                                        )}
                                        <div
                                            className={`w-full h-full max-h-[5px] rounded-[1px] transition-colors duration-150 ${
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
                            {latestClosedRound && (
                                <button
                                    type="button"
                                    onClick={() => startCloseReplay(latestClosedRound)}
                                    title={`Replay จังหวะปิดรวบรอบล่าสุด (${Number(latestClosedRound[2]) >= 0 ? '+' : ''}${Number(latestClosedRound[2]).toFixed(1)} ${currency})`}
                                    className={`p-0.5 rounded transition-colors ${
                                        closeReplay
                                            ? 'text-emerald-300 bg-emerald-500/20 animate-spin'
                                            : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80'
                                    }`}
                                >
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            )}
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
                            const isReplaying = Boolean(closeReplay);
                            const activeCloses = closeReplay
                                ? (() => {
                                      const moveP = Math.min(1, closeReplay.progress / 0.72);
                                      const baseLen = Math.max(4, closeReplay.closes.length - 8);
                                      const visibleCount = Math.max(
                                          baseLen,
                                          Math.round(baseLen + (closeReplay.closes.length - baseLen) * moveP)
                                      );
                                      return closeReplay.closes.slice(0, visibleCount);
                                  })()
                                : spark.closes;
                            const activeMinP = closeReplay ? closeReplay.minP : spark.minP;
                            const activeMaxP = closeReplay ? closeReplay.maxP : spark.maxP;
                            const activeBid = closeReplay
                                ? activeCloses[activeCloses.length - 1] || spark.bid
                                : spark.bid;
                            const activeEstTp = closeReplay ? closeReplay.tpPrice : spark.estTp;

                            const span = Math.max(pointSize * 10, activeMaxP - activeMinP);
                            const pctOf = (p: number) => {
                                const clamped = Math.max(activeMinP, Math.min(activeMaxP, p));
                                return 3 + ((activeMaxP - clamped) / span) * 94;
                            };

                            const pts = activeCloses
                                .map((c, i) => {
                                    const x = activeCloses.length > 1 ? (i / (activeCloses.length - 1)) * 216 + 2 : 110;
                                    return `${x.toFixed(1)},${pctOf(c).toFixed(1)}`;
                                })
                                .join(' ');

                            const areaPts =
                                activeCloses.length > 1
                                    ? `2,99 ${pts} 218,99`
                                    : '';

                            const bidPct = activeBid > 0 ? pctOf(activeBid) : 50;
                            const tpPct = activeEstTp > 0 ? pctOf(activeEstTp) : null;
                            const slPct = !isReplaying && spark.estSl > 0 && freezeStopLoss < 0 ? pctOf(spark.estSl) : null;
                            const rcPct = !isReplaying && (isBuyFrozen || isSellFrozen) && spark.rcPrice > 0 ? pctOf(spark.rcPrice) : null;
                            const replayHitPhase = closeReplay && closeReplay.progress >= 0.72
                                ? (closeReplay.progress - 0.72) / 0.28
                                : 0;

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

                                        {/* Open Order Level Lines (Center -> Far Right, thin Buy/Sell colored lines; cleared on close hit!) */}
                                        {(isReplaying
                                            ? replayHitPhase <= 0
                                                ? closeReplay!.orders
                                                : []
                                            : spark.openOrders
                                        ).map((o, idx) => {
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
                                                    opacity="0.35"
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
                                        {activeCloses.length > 1 && (
                                            <polyline
                                                fill="none"
                                                stroke={isReplaying && replayHitPhase > 0 ? '#34d399' : '#22d3ee'}
                                                strokeWidth={isReplaying ? '2.1' : '1.6'}
                                                vectorEffect="non-scaling-stroke"
                                                points={pts}
                                            />
                                        )}
                                    </svg>

                                    {/* Crisp Non-Stretched HTML Markers & Labels */}
                                    <div className="pointer-events-none absolute inset-0">
                                        {/* TP Label (sitting on top of TP line, or just below if pinned at top edge) */}
                                        {tpPct !== null && (() => {
                                            const effTpVal = Math.round(spark.effTpMoney);
                                            const tpLabel =
                                                effTpVal > 0
                                                    ? `TP+${effTpVal}`
                                                    : effTpVal < 0
                                                    ? `TP${effTpVal}`
                                                    : 'TP 0';
                                            return (
                                                <div
                                                    style={{ top: `${tpPct}%` }}
                                                    className={`absolute left-0.5 ${
                                                        tpPct <= 14 ? 'translate-y-[1px]' : '-translate-y-full pb-[1px]'
                                                    }`}
                                                >
                                                    <span className="font-mono text-[8px] sm:text-[9px] font-bold text-emerald-400 leading-none bg-[#030710]/80 px-0.5 rounded block">
                                                        {tpLabel}
                                                    </span>
                                                </div>
                                            );
                                        })()}

                                        {/* SL Label (sitting on top of SL line, or just below if pinned at top edge) */}
                                        {slPct !== null && (
                                            <div
                                                style={{ top: `${slPct}%` }}
                                                className={`absolute left-0.5 ${
                                                    slPct <= 14 ? 'translate-y-[1px]' : '-translate-y-full pb-[1px]'
                                                }`}
                                            >
                                                <span className="font-mono text-[8px] sm:text-[9px] font-bold text-amber-400 leading-none bg-[#030710]/85 px-0.5 rounded block">
                                                    SL
                                                </span>
                                            </div>
                                        )}

                                        {/* Rescue (RC) Label + 3 Vote Signal Circles (40% smaller) */}
                                        {rcPct !== null && (
                                            <div
                                                style={{ top: `${rcPct}%` }}
                                                className={`absolute left-0.5 flex items-center gap-1 ${
                                                    rcPct <= 14 ? 'translate-y-[1px]' : '-translate-y-full pb-[1px]'
                                                }`}
                                            >
                                                <span className="font-mono text-[8px] sm:text-[9px] font-extrabold text-rose-300 leading-none bg-[#030710]/90 px-0.5 rounded">
                                                    RC
                                                </span>
                                                <div className="flex items-center gap-0.5">
                                                    {rcSignals.map((sig, idx) => {
                                                        const vote = sig?.vote || 'WAIT';
                                                        const isYes = vote === 'YES';
                                                        const isNo = vote === 'NO';
                                                        return (
                                                            <span
                                                                key={`rc-sig-${idx}`}
                                                                title={sig ? `${sig.id}: ${vote}` : 'Signal'}
                                                                className={`w-[7.5px] h-[7.5px] rounded-full border flex items-center justify-center shadow-sm ${
                                                                    isYes
                                                                        ? 'bg-emerald-500/90 border-emerald-300 text-white shadow-[0_0_4px_rgba(16,185,129,0.7)]'
                                                                        : isNo
                                                                        ? 'bg-rose-500/90 border-rose-300 text-white shadow-[0_0_4px_rgba(244,63,94,0.6)]'
                                                                        : 'bg-slate-700/90 border-slate-500 text-slate-300'
                                                                }`}
                                                            >
                                                                {isYes ? (
                                                                    <svg viewBox="0 0 10 10" className="w-[5px] h-[5px]">
                                                                        <path
                                                                            d="M2 5.2 L4.2 7.4 L8.2 2.8"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                            strokeLinejoin="round"
                                                                        />
                                                                    </svg>
                                                                ) : isNo ? (
                                                                    <svg viewBox="0 0 10 10" className="w-[5px] h-[5px]">
                                                                        <path
                                                                            d="M2.5 2.5 L7.5 7.5 M7.5 2.5 L2.5 7.5"
                                                                            fill="none"
                                                                            stroke="currentColor"
                                                                            strokeWidth="2"
                                                                            strokeLinecap="round"
                                                                        />
                                                                    </svg>
                                                                ) : (
                                                                    <span className="w-[2.5px] h-[2.5px] rounded-full bg-current" />
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Current Price (Now) Label (sitting on top of Now line) + Trend Direction Triangle (2x) & 5 Level Dots */}
                                        <div
                                            style={{ top: `${bidPct}%` }}
                                            className="absolute left-0.5 -translate-y-full pb-[1px] flex items-center gap-1"
                                        >
                                            <span className="font-mono text-[8px] sm:text-[9px] font-bold text-sky-400 leading-none bg-[#030710]/85 px-0.5 rounded">
                                                Now
                                            </span>
                                            {trendDir === 'BUY' && (
                                                <div className="flex items-center gap-[1.5px] bg-[#030710]/70 px-0.5 rounded">
                                                    <svg viewBox="0 0 8 7" className="w-3 h-3 text-emerald-400 shrink-0">
                                                        <polygon points="4,0 8,7 0,7" fill="currentColor" />
                                                    </svg>
                                                    <div className="flex items-center gap-[1.5px]">
                                                        {[1, 2, 3, 4, 5].map((lv) => (
                                                            <span
                                                                key={`t-dot-${lv}`}
                                                                className={`w-[3.5px] h-[3.5px] rounded-full ${
                                                                    lv <= trendLevel
                                                                        ? 'bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.75)]'
                                                                        : 'bg-slate-600/80'
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {trendDir === 'SELL' && (
                                                <div className="flex items-center gap-[1.5px] translate-y-[calc(100%+2px)] bg-[#030710]/70 px-0.5 rounded">
                                                    <svg viewBox="0 0 8 7" className="w-3 h-3 text-rose-400 shrink-0">
                                                        <polygon points="0,0 8,0 4,7" fill="currentColor" />
                                                    </svg>
                                                    <div className="flex items-center gap-[1.5px]">
                                                        {[1, 2, 3, 4, 5].map((lv) => (
                                                            <span
                                                                key={`t-dot-${lv}`}
                                                                className={`w-[3.5px] h-[3.5px] rounded-full ${
                                                                    lv <= trendLevel
                                                                        ? 'bg-rose-400 shadow-[0_0_3px_rgba(251,113,133,0.75)]'
                                                                        : 'bg-slate-600/80'
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Current Bid Dot (or Close-Moment Burst Effect during 3s Replay) */}
                                        {isReplaying && replayHitPhase > 0 && closeReplay ? (
                                            <div
                                                style={{ top: `${bidPct}%`, right: '2px' }}
                                                className="absolute -translate-y-1/2 flex items-center justify-end"
                                            >
                                                {/* Expanding Shockwave Rings */}
                                                <span
                                                    style={{
                                                        transform: `scale(${1 + replayHitPhase * 3.4})`,
                                                        opacity: Math.max(0, 1 - replayHitPhase * 0.9),
                                                    }}
                                                    className={`absolute right-0 w-4 h-4 rounded-full border-2 ${
                                                        closeReplay.profit >= 0 ? 'border-emerald-300' : 'border-rose-400'
                                                    }`}
                                                />
                                                <span
                                                    style={{
                                                        transform: `scale(${1 + replayHitPhase * 2.1})`,
                                                        opacity: Math.max(0, 0.9 - replayHitPhase * 0.8),
                                                    }}
                                                    className={`absolute right-0 w-3 h-3 rounded-full ${
                                                        closeReplay.profit >= 0 ? 'bg-emerald-400/50' : 'bg-rose-400/50'
                                                    }`}
                                                />
                                                {/* Floating Close-Moment Badge */}
                                                <span
                                                    className={`mr-3 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-extrabold shadow-lg whitespace-nowrap ${
                                                        closeReplay.profit >= 0
                                                            ? 'border-emerald-300 bg-emerald-500/90 text-slate-950 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                                                            : 'border-rose-300 bg-rose-500/90 text-white shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                                                    }`}
                                                >
                                                    ✓ ปิดรวบ {closeReplay.profit >= 0 ? '+' : ''}
                                                    {closeReplay.profit.toFixed(1)} ({closeReplay.trades} ไม้)
                                                </span>
                                                <span
                                                    className={`w-2.5 h-2.5 rounded-full border-2 border-white ${
                                                        closeReplay.profit >= 0
                                                            ? 'bg-emerald-400 shadow-[0_0_10px_#34d399]'
                                                            : 'bg-rose-400 shadow-[0_0_10px_#fb7185]'
                                                    }`}
                                                />
                                            </div>
                                        ) : (
                                            <span
                                                style={{ top: `${bidPct}%`, right: '1px' }}
                                                className="absolute -translate-y-1/2 w-[6px] h-[6px] rounded-full bg-white border-[1.5px] border-cyan-400 shadow-[0_0_5px_#22d3ee] transition-[top] duration-300"
                                            />
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    <div className="flex items-center justify-between font-mono text-[8px] text-slate-400 leading-none shrink-0 z-10">
                        <span className="text-emerald-400">
                            TP:{spark.estTp > 0 ? spark.estTp.toFixed(digits) : '--'}
                        </span>
                        {spark.rcEntryPx > 0 && (
                            <span className="text-rose-300 font-bold">
                                RC:{spark.rcEntryPx.toFixed(digits)}
                            </span>
                        )}
                        <span className={freezeStopLoss < 0 ? 'text-amber-400' : 'text-slate-600'}>
                            SL:{freezeStopLoss < 0 && spark.estSl > 0 ? spark.estSl.toFixed(digits) : '-'}
                        </span>
                    </div>
                </div>

                {/* =========================================================
                    SECTION 4 (1/6 width): Vertical PnL Bar + Bottom PnL Number + Per-Round Peak Tick
                   ========================================================= */}
                <div className="col-span-1 flex flex-col justify-between rounded-lg border border-slate-800/90 bg-[#030710]/90 p-1 sm:p-1.5">
                    <div className="text-center">
                        <div className="text-[8px] sm:text-[9px] font-mono font-bold text-slate-400 uppercase leading-none">PnL</div>
                    </div>

                    {/* Vertical Bar + Per-Round Peak Tick */}
                    <div className="my-0.5 flex-1 flex items-center justify-center gap-1 min-h-0">
                        <div className="relative h-full w-3.5 sm:w-4 rounded bg-slate-900 border border-slate-800 overflow-hidden flex flex-col justify-end">
                            {(() => {
                                const curRatio = Math.min(100, Math.round((Math.abs(syncedCyclePnl) / pnlScaleMax) * 100));
                                const peakRatio = Math.min(97, Math.max(4, Math.round((Math.abs(peakPnlRound) / pnlScaleMax) * 100)));

                                return (
                                    <>
                                        <div
                                            style={{ height: `${curRatio}%` }}
                                            className={`w-full transition-all duration-300 ${
                                                syncedCyclePnl >= 0
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

                        <div className="flex flex-col justify-start h-full font-mono text-[7.5px] sm:text-[8.5px] text-left leading-none py-0.5">
                            <div>
                                <div className="text-amber-300/90 font-bold" title="Peak สูงสุดของรอบปัจจุบัน">
                                    Peak
                                </div>
                                <div className="text-amber-200 tabular-nums mt-0.5">
                                    {peakPnlRound >= 0 ? '+' : ''}
                                    {peakPnlRound.toFixed(0)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        className={`text-center font-mono text-sm sm:text-lg font-extrabold leading-tight tabular-nums truncate ${
                            syncedCyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                    >
                        {syncedCyclePnl >= 0 ? '+' : ''}
                        {Math.abs(syncedCyclePnl) >= 100 ? syncedCyclePnl.toFixed(0) : syncedCyclePnl.toFixed(1)}
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

                {/* 3. Total Open Trades + Round Elapsed Time (HH:MM) */}
                <div className="flex flex-col items-center justify-center gap-0.5 border-l border-slate-800 pl-1 sm:pl-2 min-w-0">
                    <div className="flex items-baseline justify-center gap-1 leading-tight">
                        <span className="text-[8px] sm:text-[10px] text-slate-400 truncate">ไม้รวม</span>
                        <span className="text-xs sm:text-base font-extrabold text-white leading-tight tabular-nums">
                            {metrics.totalTrades}
                        </span>
                    </div>
                    <div
                        title="ระยะเวลาตั้งแต่เปิดไม้แรกของรอบนี้ (ชั่วโมง:นาที)"
                        className={`text-xs sm:text-base font-extrabold leading-tight tabular-nums ${
                            metrics.totalTrades > 0 ? 'text-slate-200' : 'text-slate-500'
                        }`}
                    >
                        {metrics.roundElapsedLabel}
                    </div>
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
