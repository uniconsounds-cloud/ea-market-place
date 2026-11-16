'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scale, TrendingDown, TrendingUp, AlertTriangle, Target } from 'lucide-react';
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

        return {
            digits,
            buyLot,
            sellLot,
            netLot,
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
        isBalanced,
        breakevenPrice,
        pointsToBreakeven,
        pnlAtFreeze,
        halfLossTp,
    } = analysis;

    return (
        <Card className="border bg-card/80">
            <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Scale className="w-4 h-4 text-cyan-400" />
                            วิเคราะห์ความเสี่ยง & ระยะฟื้นตัว (Basket Risk Analyzer)
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                            คำนวณจาก Lot สุทธิและออเดอร์จริงในพอร์ตแบบเรียลไทม์
                        </CardDescription>
                    </div>
                    {isBalanced ? (
                        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 w-fit font-mono">
                            Balanced (Net 0.00 Lot)
                        </Badge>
                    ) : netLot > 0 ? (
                        <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 w-fit font-mono gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            Net Buy +{netLot.toFixed(2)} Lot (ได้เปรียบขาขึ้น)
                        </Badge>
                    ) : (
                        <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 w-fit font-mono gap-1">
                            <TrendingDown className="w-3.5 h-3.5" />
                            Net Sell {Math.abs(netLot).toFixed(2)} Lot (ได้เปรียบขาลง)
                        </Badge>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Box 1: Lot Balance */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                        <div className="text-[11px] text-muted-foreground">สัดส่วน Lot เปิดอยู่</div>
                        <div className="font-mono text-sm font-semibold">
                            Buy {buyLot.toFixed(2)} / Sell {sellLot.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                            {isBalanced
                                ? 'DD ถูกล็อกคงที่ไม่ว่ากราฟไปทางไหน'
                                : netLot > 0
                                ? 'กราฟขึ้น = กำไรไวขึ้น'
                                : 'กราฟลง = กำไรไวขึ้น'}
                        </div>
                    </div>

                    {/* Box 2: Breakeven Distance */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                        <div className="text-[11px] text-muted-foreground">ระยะสู่จุดเท่าทุน (TP = 0)</div>
                        {isBalanced ? (
                            <>
                                <div className="font-mono text-sm font-semibold text-amber-400">
                                    Locked DD: {cyclePnl.toFixed(2)} {currency}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    รอฝั่งที่ได้สิทธิ์เปิดไม้เพิ่มเพื่อทำลายสมดุล
                                </div>
                            </>
                        ) : breakevenPrice !== null && pointsToBreakeven !== null ? (
                            <>
                                <div className="font-mono text-sm font-semibold text-emerald-400">
                                    {breakevenPrice.toFixed(digits)} ({pointsToBreakeven} จุด)
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    คำนวณจาก Net Lot ปัจจุบัน (ยังไม่รวมไม้เพิ่ม)
                                </div>
                            </>
                        ) : (
                            <div className="text-xs text-muted-foreground pt-1">
                                ปัจจุบันกำไรถึงเป้าหรือรอราคาอัปเดต
                            </div>
                        )}
                    </div>

                    {/* Box 3: DD at Freeze / Flip Level */}
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            คาดการณ์ DD ณ จุด Flip ({frozenSide && frozenSide !== 'NONE' ? frozenSide : 'Freeze'})
                        </div>
                        {pnlAtFreeze !== null && chart?.freeze_price ? (
                            <>
                                <div
                                    className={`font-mono text-sm font-semibold ${
                                        pnlAtFreeze >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                >
                                    {pnlAtFreeze >= 0 ? '+' : ''}
                                    {pnlAtFreeze.toFixed(2)} {currency}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    ที่ระดับราคา {chart.freeze_price.toFixed(digits)}
                                </div>
                            </>
                        ) : (
                            <div className="text-xs text-muted-foreground pt-1">
                                จะแสดงเมื่อเข้าสู่โหมด Freeze
                            </div>
                        )}
                    </div>
                </div>

                {/* Smart Exit Quick Helpers when in Drawdown */}
                {cyclePnl < 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
                            <Target className="w-3.5 h-3.5 text-primary" /> ตัวช่วยตั้งเป้าด่วน:
                        </span>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={sending}
                            className="h-7 text-xs"
                            onClick={() => onQuickSetTp(0)}
                        >
                            ปิดเท่าทุน (TP = 0)
                        </Button>
                        {halfLossTp !== null && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={sending}
                                className="h-7 text-xs"
                                onClick={() => onQuickSetTp(halfLossTp)}
                            >
                                ลดขาดทุน 50% (TP = {halfLossTp} {currency})
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={sending}
                            className="h-7 text-xs"
                            onClick={() => onQuickSetTp(20)}
                        >
                            เป้าปกติ (+20 {currency})
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
