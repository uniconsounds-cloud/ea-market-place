'use client';

import React, { useMemo, useState } from 'react';
import { Shield, Lock, Unlock, Scissors, Play, CheckCircle2, AlertTriangle, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ChartOrderItem, SmartChartData } from '@/components/smart-vortex-chart';

interface ExtendedOrderItem extends ChartOrderItem {
    tk?: number;
    h?: boolean;
}

interface HedgeShieldPanelProps {
    currency: string;
    balance: number;
    cyclePnl: number;
    openPos: number;
    hedgeActive: boolean;
    hedgeSide: string;
    hedgeLot: number;
    hedgePnl: number;
    hedgeEntryPx: number;
    hedgeCycleLocked: boolean;
    enableAutoHedge: boolean;
    hedgeDdPercent: number;
    pauseAfterHedge: boolean;
    chart?: SmartChartData | null;
    sending?: boolean;
    isPendingAck?: boolean;
    onUpdateSettings: (enable: boolean, ddPct: number, pauseAfter: boolean) => void;
    onHedgeAction: (payload: Record<string, any>, successMsg: string) => void;
}

export default function HedgeShieldPanel({
    currency,
    balance,
    cyclePnl,
    openPos,
    hedgeActive,
    hedgeSide,
    hedgeLot,
    hedgePnl,
    hedgeEntryPx,
    hedgeCycleLocked,
    enableAutoHedge,
    hedgeDdPercent,
    pauseAfterHedge,
    chart,
    sending = false,
    isPendingAck = false,
    onUpdateSettings,
    onHedgeAction,
}: HedgeShieldPanelProps) {
    const [expanded, setExpanded] = useState(false);
    const [draftDd, setDraftDd] = useState<number>(hedgeDdPercent || 15);
    const [customLot, setCustomLot] = useState<string>('0.05');
    const [cutWithMatchHedge, setCutWithMatchHedge] = useState<boolean>(true);
    const [showOrderList, setShowOrderList] = useState<boolean>(false);

    const isWaitingEa = sending || isPendingAck;
    const isOpen = expanded || hedgeActive || hedgeCycleLocked;
    const digits = chart?.digits ?? 2;
    const ddTriggerMoney = balance > 0 ? -(balance * (hedgeDdPercent / 100)) : 0;
    const currentDdPct = balance > 0 && cyclePnl < 0 ? (Math.abs(cyclePnl) / balance) * 100 : 0;

    // Open Grid/Rescue orders sorted from worst losing to best
    const stuckOrders = useMemo(() => {
        const list = ((chart?.orders || []) as ExtendedOrderItem[]).filter(
            (o) => (o.t === 'B' || o.t === 'S') && !o.h
        );
        return [...list].sort((a, b) => (a.u ?? 0) - (b.u ?? 0));
    }, [chart?.orders]);

    const fmtMoney = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} ${currency}`;

    return (
        <div
            className={`rounded-xl border transition-all duration-300 ${
                isWaitingEa
                    ? 'border-amber-400/60 bg-amber-500/10 opacity-80 animate-pulse'
                    : hedgeActive
                    ? 'border-amber-400/60 bg-amber-500/10'
                    : hedgeCycleLocked
                    ? 'border-cyan-400/60 bg-cyan-500/10'
                    : 'border-slate-700/70 bg-slate-900/60'
            }`}
        >
            {/* Compact Rectangular Header (Mobile-First Touch Target) */}
            <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="w-full text-left p-2.5 sm:p-3 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-white/[0.02] rounded-xl transition-colors"
            >
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Shield
                        className={`w-4 h-4 shrink-0 ${
                            hedgeActive
                                ? 'text-amber-400'
                                : hedgeCycleLocked
                                ? 'text-cyan-400'
                                : enableAutoHedge
                                ? 'text-emerald-400'
                                : 'text-slate-500'
                        }`}
                    />
                    <span className="font-bold text-xs sm:text-sm text-slate-100">
                        Hedge Shield (เกราะกันพอร์ต DD)
                    </span>
                    {hedgeActive ? (
                        <Badge className="bg-amber-500/25 border border-amber-400/60 text-amber-200 font-mono text-[10px]">
                            <Lock className="w-2.5 h-2.5 mr-1" />
                            HEDGED {hedgeSide} {hedgeLot.toFixed(2)} ({hedgePnl >= 0 ? '+' : ''}{hedgePnl.toFixed(1)})
                        </Badge>
                    ) : hedgeCycleLocked ? (
                        <Badge className="bg-cyan-500/25 border border-cyan-400/60 text-cyan-200 font-mono text-[10px]">
                            ปลด Hedge แล้ว • พักรอผู้ใช้สั่งต่อ
                        </Badge>
                    ) : (
                        <Badge
                            variant="outline"
                            className={`font-mono text-[10px] ${
                                enableAutoHedge
                                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                                    : 'border-slate-600 text-slate-400'
                            }`}
                        >
                            {enableAutoHedge ? `ON • ล็อกที่ -${hedgeDdPercent}%` : 'OFF'}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {isWaitingEa && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            รอ EA ตอบกลับ...
                        </span>
                    )}
                    {!isWaitingEa && !hedgeActive && enableAutoHedge && ddTriggerMoney < 0 && (
                        <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                            จุดทำงาน: {ddTriggerMoney.toFixed(0)} {currency} (ตอนนี้ -{currentDdPct.toFixed(1)}%)
                        </span>
                    )}
                    <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-cyan-300' : ''
                        }`}
                    />
                </div>
            </button>

            {/* Waiting for EA ACK Banner */}
            {isWaitingEa && (
                <div className="mx-2.5 sm:mx-3 mb-2 flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 font-mono text-[10px] sm:text-[11px] text-amber-300">
                    <div className="flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                        <span className="font-bold">กำลังส่งคำสั่ง & รอ EA ตอบรับ (Sync)...</span>
                    </div>
                </div>
            )}

            {/* Expandable Body */}
            {isOpen && (
                <div className={`px-2.5 sm:px-3 pb-3 pt-2 border-t border-slate-700/50 space-y-3 ${isWaitingEa ? 'pointer-events-none opacity-65' : ''}`}>
                    {/* 1. Simple 2-Setting Bar + Post-Hedge Behavior */}
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-200">1. เปิดใช้งาน Hedge Shield</span>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={sending}
                                    variant={enableAutoHedge ? 'default' : 'outline'}
                                    onClick={() => onUpdateSettings(!enableAutoHedge, draftDd, pauseAfterHedge)}
                                    className={`h-7 px-3 text-xs font-bold ${
                                        enableAutoHedge
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                            : 'border-slate-600 text-slate-300'
                                    }`}
                                >
                                    {enableAutoHedge ? 'เปิด (ON)' : 'ปิด (OFF)'}
                                </Button>
                            </div>

                            {!hedgeActive && openPos > 0 && (
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={sending}
                                    variant="outline"
                                    onClick={() =>
                                        onHedgeAction(
                                            { hedge_action: 'TRIGGER_NOW' },
                                            'สั่งล็อก Hedge Shield ทันทีแล้ว (Net Lot = 0)'
                                        )
                                    }
                                    className="h-7 px-2.5 text-[11px] border-amber-500/50 text-amber-300 hover:bg-amber-500/15"
                                >
                                    <Lock className="w-3 h-3 mr-1" />
                                    ล็อก Hedge ทันที
                                </Button>
                            )}
                        </div>

                        {/* DD% Preset Pills (Mobile-friendly) */}
                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                                <span className="text-slate-300 font-semibold">
                                    2. หยุด DD ที่ (% ของ Balance): <strong className="text-amber-300">{hedgeDdPercent}%</strong>
                                    {ddTriggerMoney < 0 && (
                                        <span className="text-slate-400 ml-1">({ddTriggerMoney.toFixed(0)} {currency})</span>
                                    )}
                                </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                                {[10, 15, 20, 25, 30].map((pct) => (
                                    <button
                                        key={`dd-pct-${pct}`}
                                        type="button"
                                        disabled={sending}
                                        onClick={() => {
                                            setDraftDd(pct);
                                            onUpdateSettings(enableAutoHedge, pct, pauseAfterHedge);
                                        }}
                                        className={`h-8 rounded-lg border font-mono text-xs font-bold transition-colors ${
                                            Math.round(hedgeDdPercent) === pct
                                                ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                                                : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500'
                                        }`}
                                    >
                                        {pct}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Post-Hedge Behavior Toggle */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
                            <span className="text-slate-300">หลังปลด Hedge หมดแล้ว:</span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={sending}
                                    onClick={() => onUpdateSettings(enableAutoHedge, hedgeDdPercent, true)}
                                    className={`px-2.5 py-1 rounded-md border font-bold transition-colors ${
                                        pauseAfterHedge
                                            ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-200'
                                            : 'border-slate-700 bg-slate-900 text-slate-400'
                                    }`}
                                >
                                    หยุดเทรดก่อน (แนะนำ)
                                </button>
                                <button
                                    type="button"
                                    disabled={sending}
                                    onClick={() => onUpdateSettings(enableAutoHedge, hedgeDdPercent, false)}
                                    className={`px-2.5 py-1 rounded-md border font-bold transition-colors ${
                                        !pauseAfterHedge
                                            ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                                            : 'border-slate-700 bg-slate-900 text-slate-400'
                                    }`}
                                >
                                    ทำงานต่อเลย
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. Active Hedge Unwind Panel (shown when Hedge is open) */}
                    {hedgeActive && (
                        <div className="rounded-lg border border-amber-400/40 bg-slate-950/80 p-2.5 sm:p-3 space-y-3">
                            {/* Live Hedge Metrics */}
                            <div className="grid grid-cols-3 gap-2 text-center font-mono">
                                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                                    <div className="text-[10px] text-slate-400">ฝั่ง Hedge</div>
                                    <div className={`text-xs sm:text-sm font-extrabold ${hedgeSide === 'BUY' ? 'text-sky-300' : 'text-orange-300'}`}>
                                        {hedgeSide} {hedgeLot.toFixed(2)}
                                    </div>
                                    {hedgeEntryPx > 0 && (
                                        <div className="text-[9px] text-slate-500">@ {hedgeEntryPx.toFixed(digits)}</div>
                                    )}
                                </div>
                                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                                    <div className="text-[10px] text-slate-400">กำไรไม้ Hedge</div>
                                    <div className={`text-xs sm:text-sm font-extrabold ${hedgePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {hedgePnl >= 0 ? '+' : ''}{hedgePnl.toFixed(1)}
                                    </div>
                                    <div className="text-[9px] text-slate-500">{currency}</div>
                                </div>
                                <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-1.5">
                                    <div className="text-[10px] text-slate-400">พอร์ตรวม</div>
                                    <div className={`text-xs sm:text-sm font-extrabold ${cyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {cyclePnl >= 0 ? '+' : ''}{cyclePnl.toFixed(0)}
                                    </div>
                                    <div className="text-[9px] text-slate-500">Net Lot ≈ 0</div>
                                </div>
                            </div>

                            {/* Method A: Partial / Full Close Hedge */}
                            <div className="space-y-1.5">
                                <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                                    <Unlock className="w-3.5 h-3.5 text-cyan-300" />
                                    วิธีที่ 1: ทยอยปิดไม้ Hedge (เก็บกำไร / ปลดล็อก)
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {[25, 50, 100].map((pct) => (
                                        <Button
                                            key={`close-h-${pct}`}
                                            type="button"
                                            size="sm"
                                            disabled={sending}
                                            variant="outline"
                                            onClick={() =>
                                                onHedgeAction(
                                                    { hedge_action: 'CLOSE_HEDGE_PARTIAL', hedge_action_pct: pct },
                                                    `สั่งปิดไม้ Hedge ${pct}% แล้ว`
                                                )
                                            }
                                            className="h-9 text-xs font-bold border-cyan-500/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                                        >
                                            ปิด {pct}%
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={hedgeLot}
                                        value={customLot}
                                        onChange={(e) => setCustomLot(e.target.value)}
                                        className="h-9 w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 font-mono text-xs text-white"
                                        placeholder="Lot"
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={sending}
                                        variant="outline"
                                        onClick={() => {
                                            const lotVal = parseFloat(customLot) || 0;
                                            if (lotVal <= 0) return;
                                            onHedgeAction(
                                                { hedge_action: 'CLOSE_HEDGE_PARTIAL', hedge_action_lot: lotVal },
                                                `สั่งปิด Hedge จำนวน ${lotVal.toFixed(2)} lot แล้ว`
                                            );
                                        }}
                                        className="h-9 flex-1 text-xs font-bold border-slate-600 text-slate-200"
                                    >
                                        ปิดตาม Lot ที่ระบุ
                                    </Button>
                                </div>
                            </div>

                            {/* Method B: Cut Stuck Order(s) */}
                            <div className="space-y-2 pt-2 border-t border-slate-800">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1">
                                        <Scissors className="w-3.5 h-3.5 text-amber-300" />
                                        วิธีที่ 2: ตัดไม้ที่ค้างอยู่ (ใช้กำไร Hedge หักล้าง)
                                    </span>
                                    <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={cutWithMatchHedge}
                                            onChange={(e) => setCutWithMatchHedge(e.target.checked)}
                                            className="rounded border-slate-600"
                                        />
                                        ปิด Hedge ตาม Lot ไม้นั้นด้วย
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={sending}
                                        variant="outline"
                                        onClick={() =>
                                            onHedgeAction(
                                                {
                                                    hedge_action: 'CUT_STUCK_ORDER',
                                                    hedge_action_ticket: 0,
                                                    hedge_close_match: cutWithMatchHedge,
                                                },
                                                'สั่งตัดไม้ที่ติดลบหนักที่สุดแล้ว'
                                            )
                                        }
                                        className="h-9 text-xs font-bold border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
                                    >
                                        ตัดไม้ที่ติดลบหนักที่สุด
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={sending}
                                        variant="outline"
                                        onClick={() => setShowOrderList((p) => !p)}
                                        className="h-9 text-xs font-bold border-slate-600 text-slate-200"
                                    >
                                        {showOrderList ? 'ซ่อนรายการไม้ค้าง' : `เลือกตัดเองทีละไม้ (${stuckOrders.length})`}
                                    </Button>
                                </div>

                                {showOrderList && stuckOrders.length > 0 && (
                                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                        {stuckOrders.map((ord, idx) => {
                                            const pnl = ord.u ?? 0;
                                            return (
                                                <div
                                                    key={`stuck-${ord.tk || idx}`}
                                                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-mono"
                                                >
                                                    <div className="min-w-0 flex items-center gap-2">
                                                        <span className={`font-bold ${ord.t === 'B' ? 'text-sky-300' : 'text-orange-300'}`}>
                                                            {ord.t === 'B' ? 'BUY' : 'SELL'} {ord.l.toFixed(2)}
                                                        </span>
                                                        <span className="text-slate-400">@ {ord.p.toFixed(digits)}</span>
                                                        <span className={pnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                                            {fmtMoney(pnl)}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={sending || !ord.tk}
                                                        variant="outline"
                                                        onClick={() =>
                                                            onHedgeAction(
                                                                {
                                                                    hedge_action: 'CUT_STUCK_ORDER',
                                                                    hedge_action_ticket: ord.tk,
                                                                    hedge_close_match: cutWithMatchHedge,
                                                                },
                                                                `สั่งตัดไม้ #${ord.tk} (${ord.l.toFixed(2)} lot) แล้ว`
                                                            )
                                                        }
                                                        className="h-7 px-2 text-[10px] border-rose-500/40 text-rose-200 hover:bg-rose-500/20 shrink-0"
                                                    >
                                                        ตัดไม้นี้
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Method C: Close All Basket + Hedge */}
                            <div className="pt-2 border-t border-slate-800">
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={sending}
                                    variant="destructive"
                                    onClick={() =>
                                        onHedgeAction(
                                            { hedge_action: 'CLOSE_ALL_BASKET' },
                                            'สั่งปิดรวบทั้งกริดและไม้ Hedge เพื่อเริ่มรอบใหม่แล้ว'
                                        )
                                    }
                                    className="w-full h-9 text-xs font-bold"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                    วิธีที่ 3: ปิดรวบทั้งหมดทันที ({cyclePnl >= 0 ? '+' : ''}{cyclePnl.toFixed(1)} {currency})
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* 3. Post-Hedge Pause Banner (after Hedge is completely unwound) */}
                    {!hedgeActive && hedgeCycleLocked && (
                        <div className="rounded-lg border border-cyan-400/50 bg-cyan-500/15 p-3 space-y-2.5">
                            <div className="flex items-start gap-2 text-xs text-cyan-100">
                                <CheckCircle2 className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                                <div>
                                    <div className="font-bold">ปลด Hedge ครบแล้ว — ระบบกำลังหยุดเปิดไม้ใหม่ชั่วคราว</div>
                                    <div className="text-[11px] text-cyan-200/80">
                                        เลือกเปิดให้ EA กลับมาเทรดต่อบนกริดเดิม หรือปิดรวบทั้งหมดเพื่อเริ่มรอบใหม่ได้เลยครับ
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={sending}
                                    onClick={() =>
                                        onHedgeAction(
                                            { hedge_action: 'RESUME_TRADING' },
                                            'เปิดระบบกลับมาเทรดต่อเรียบร้อยแล้ว'
                                        )
                                    }
                                    className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                                >
                                    <Play className="w-3.5 h-3.5 mr-1.5" />
                                    เปิดระบบเทรดต่อ (Resume)
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={sending}
                                    variant="destructive"
                                    onClick={() =>
                                        onHedgeAction(
                                            { hedge_action: 'CLOSE_ALL_BASKET' },
                                            'สั่งปิดรวบทั้งหมดเพื่อเริ่มรอบใหม่แล้ว'
                                        )
                                    }
                                    className="h-9 text-xs font-bold"
                                >
                                    ปิดรวบทั้งหมดเริ่มรอบใหม่
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
