'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

export type RoundHistoryTuple = [number, number, number]; // [closeTimeUnix, tradesCount, netProfit]

interface RoundHistoryBarProps {
    rounds?: RoundHistoryTuple[] | null;
    currency?: string;
}

interface ParsedRound {
    idx: number; // 1 = newest (rightmost)
    time: number;
    trades: number;
    pnl: number;
}

function formatTimeShort(unixSec: number): string {
    if (!unixSec) return '--:--';
    const d = new Date(unixSec * 1000);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${mi}`;
}

export default function RoundHistoryBar({ rounds, currency = 'USD' }: RoundHistoryBarProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Sort chronologically ascending (oldest on left -> newest on right), max 50
    const items: ParsedRound[] = useMemo(() => {
        if (!Array.isArray(rounds) || rounds.length === 0) return [];
        const sorted = [...rounds]
            .filter((r) => Array.isArray(r) && r.length >= 3)
            .slice(-50)
            .sort((a, b) => Number(a[0]) - Number(b[0]));

        const total = sorted.length;
        return sorted.map((r, i) => ({
            idx: total - i, // 1 = latest (rightmost), N = oldest (leftmost)
            time: Number(r[0]) || 0,
            trades: Math.max(0, Math.round(Number(r[1]) || 0)),
            pnl: Number(r[2]) || 0,
        }));
    }, [rounds]);

    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    // Auto-scroll to the rightmost (latest) bar whenever data updates
    useEffect(() => {
        if (scrollRef.current && items.length > 0) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [items.length]);

    const stats = useMemo(() => {
        let totalPnl = 0;
        let totalTrades = 0;
        let maxAbsPnl = 1;
        let hasNegative = false;

        for (const it of items) {
            totalPnl += it.pnl;
            totalTrades += it.trades;
            if (Math.abs(it.pnl) > maxAbsPnl) maxAbsPnl = Math.abs(it.pnl);
            if (it.pnl < 0) hasNegative = true;
        }

        return { totalPnl, totalTrades, maxAbsPnl, hasNegative };
    }, [items]);

    const activeItem = useMemo(() => {
        if (items.length === 0) return null;
        if (selectedIdx !== null) {
            const found = items.find((it) => it.idx === selectedIdx);
            if (found) return found;
        }
        return items[items.length - 1]; // Default to latest (rightmost)
    }, [items, selectedIdx]);

    return (
        <div className="mb-3 rounded-xl border border-cyan-500/25 bg-[#050b14]/90 p-3 shadow-[0_0_24px_rgba(6,182,212,0.08)] backdrop-blur-md">
            {/* Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-500/15">
                <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                    <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300 uppercase">
                        CYCLE HISTORY // {items.length}/50R
                    </span>
                    <span className="hidden sm:inline font-mono text-[10px] text-slate-400">
                        (ขวา = ล่าสุด → ซ้าย = ย้อนหลัง)
                    </span>
                </div>

                {/* Summary Badges */}
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span className="rounded border border-slate-700/80 bg-slate-900/80 px-1.5 py-0.5 text-slate-300">
                        {stats.totalTrades} ไม้
                    </span>
                    <span
                        className={`rounded border px-1.5 py-0.5 font-bold ${
                            stats.totalPnl >= 0
                                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                                : 'border-rose-500/35 bg-rose-500/10 text-rose-300'
                        }`}
                    >
                        SUM {stats.totalPnl >= 0 ? '+' : ''}
                        {stats.totalPnl.toFixed(2)} {currency}
                    </span>
                </div>
            </div>

            {items.length === 0 ? (
                <div className="py-4 text-center font-mono text-[11px] text-slate-400">
                    ยังไม่มีประวัติการรวบปิดรอบ (รอ EA รวบปิดรอบแรก หรือรอ Live Sync 15s)
                </div>
            ) : (
                <>
                    {/* Active / Selected Round Inspector */}
                    {activeItem && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/70 px-2.5 py-1.5 font-mono text-[11px]">
                            <div className="flex items-center gap-2">
                                <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                                    {activeItem.idx === 1 ? 'LATEST' : `-${activeItem.idx - 1}R`}
                                </span>
                                <span className="text-slate-300">{formatTimeShort(activeItem.time)}</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <span className="text-sky-300">{activeItem.trades} ไม้</span>
                                <span
                                    className={`font-bold ${
                                        activeItem.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                >
                                    {activeItem.pnl >= 0 ? '+' : ''}
                                    {activeItem.pnl.toFixed(2)} {currency}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Horizontal Right-to-Left Bar Chart */}
                    <div
                        ref={scrollRef}
                        className="mt-2.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent"
                    >
                        <div
                            className={`flex items-end gap-1.5 min-w-max px-1 ${
                                items.length < 18 ? 'justify-end w-full' : ''
                            }`}
                        >
                            {items.map((item) => {
                                const ratio = Math.max(0.12, Math.min(1, Math.abs(item.pnl) / stats.maxAbsPnl));
                                const isPos = item.pnl >= 0;
                                const isSelected = activeItem?.idx === item.idx;
                                const barHeightPx = Math.round(ratio * 44);

                                return (
                                    <button
                                        key={`${item.time}-${item.idx}`}
                                        type="button"
                                        onClick={() => setSelectedIdx(item.idx)}
                                        onMouseEnter={() => setSelectedIdx(item.idx)}
                                        title={`รอบที่ -${item.idx - 1} | ${formatTimeShort(item.time)} | ${item.trades} ไม้ | ${
                                            isPos ? '+' : ''
                                        }${item.pnl.toFixed(2)} ${currency}`}
                                        className={`group flex flex-col items-center justify-end w-[22px] sm:w-[24px] pt-1 pb-0.5 rounded transition-all focus:outline-none ${
                                            isSelected
                                                ? 'bg-cyan-500/15 ring-1 ring-cyan-400/60'
                                                : 'hover:bg-slate-800/60'
                                        }`}
                                    >
                                        {/* Profit mini label */}
                                        <span
                                            className={`font-mono text-[8px] leading-none mb-1 tabular-nums ${
                                                isPos ? 'text-emerald-300/90' : 'text-rose-300/90'
                                            }`}
                                        >
                                            {Math.abs(item.pnl) >= 100
                                                ? Math.round(item.pnl)
                                                : item.pnl.toFixed(0)}
                                        </span>

                                        {/* Bar container */}
                                        <div className="flex h-[46px] w-full items-end justify-center px-1">
                                            <div
                                                style={{ height: `${barHeightPx}px` }}
                                                className={`w-full rounded-t-sm transition-all ${
                                                    isPos
                                                        ? isSelected
                                                            ? 'bg-gradient-to-t from-cyan-500 to-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.55)]'
                                                            : 'bg-gradient-to-t from-cyan-600/80 to-emerald-400/90 group-hover:from-cyan-500 group-hover:to-emerald-300'
                                                        : isSelected
                                                            ? 'bg-gradient-to-t from-rose-600 to-amber-400 shadow-[0_0_10px_rgba(244,63,94,0.55)]'
                                                            : 'bg-gradient-to-t from-rose-700/80 to-rose-400/90 group-hover:from-rose-600 group-hover:to-rose-300'
                                                }`}
                                            />
                                        </div>

                                        {/* Trade count pill */}
                                        <span className="mt-1 font-mono text-[8px] leading-none text-sky-300/85 tabular-nums">
                                            {item.trades}
                                        </span>

                                        {/* Latest marker */}
                                        <span
                                            className={`mt-0.5 font-mono text-[7px] leading-none ${
                                                item.idx === 1 ? 'text-cyan-300 font-bold' : 'text-slate-500'
                                            }`}
                                        >
                                            {item.idx === 1 ? 'NOW' : item.idx}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
