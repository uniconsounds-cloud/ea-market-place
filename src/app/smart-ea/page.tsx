'use client';

import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { SmartVortexChart, SmartChartData } from '@/components/smart-vortex-chart';
import { FreezeRiskRadarCard } from '@/components/smart-ea/FreezeRiskRadarCard';
import { FreezeWhatIfSimulator } from '@/components/smart-ea/FreezeWhatIfSimulator';
import RoundHistoryBar, { RoundHistoryTuple } from '@/components/round-history-bar';
import FreezeExitPlanner from '@/components/freeze-exit-planner';
import SmartTacticalOverview from '@/components/smart-tactical-overview';
import { PnlVectorVisualizer } from '@/components/pnl-vector-visualizer';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import {
    Activity,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    Loader2,
    PauseCircle,
    PlayCircle,
    RefreshCw,
    Send,
    ShieldAlert,
    Sliders,
    Target,
    Wifi,
    WifiOff,
    XCircle,
} from 'lucide-react';

interface ActiveConfig {
    first_distance: number;
    spacing: number;
    pending_per_side: number;
    initial_lot: number;
    lot_increment: number;
    step_lot_repeat?: number;
    target_profit: number;
    freeze_stop_loss?: number;
    enable_cap_freeze?: boolean;
    max_both_sides_cap?: number;
    freeze_flip_max_extra?: number;
    freeze_flip_continuous?: boolean;
    enable_streak_unlock?: boolean;
    streak_unlock_trades?: number;
    streak_unlock_candles?: number;
    enable_single_side_freeze?: boolean;
    single_side_freeze_trigger?: number;
    max_orders_per_side?: number;
    enable_armed_lock?: boolean;
    armed_lock_trigger?: number;
    lock_opposite_at?: number;
    enable_dual_engine?: boolean;
    park_breakout_pts?: number;
    park_dd_percent?: number;
    enable_instant_pair_cut?: boolean;
    enable_harvest_offset?: boolean;
    enable_auto_hedge?: boolean;
    hedge_dd_percent?: number;
    base_hedge_dd_percent?: number;
    enable_hedge_trailing?: boolean;
    hedge_trail_start_pts?: number;
    hedge_trail_step_pts?: number;
    enable_hedge_partial?: boolean;
    hedge_partial_pct?: number;
    hedge_rebound_pts?: number;
    enable_hedge_offset?: boolean;
    stop_mode: string;
}

interface VoteCouncilVoter {
    id: string;
    label: string;
    weight: number;
    vote: 'YES' | 'NO' | 'WAIT' | 'OFF' | string;
}

interface VoteCouncilState {
    enabled: boolean;
    mode: string;
    direction: string;
    mirror_px: number;
    trigger_px: number;
    entry_px: number;
    stop_px: number;
    bet_lot: number;
    bets_opened: number;
    max_bets: number;
    score_pct: number;
    pass_pct: number;
    yes_w: number;
    total_w: number;
    reached_trigger?: boolean;
    approved?: boolean;
    voters: VoteCouncilVoter[];
    trend_council?: {
        direction: string;
        yes_w: number;
        total_w: number;
        voters: VoteCouncilVoter[];
    } | null;
}

interface EAState {
    port_number: string;
    ea_name: string;
    ea_version: string;
    symbol: string;
    currency: string;
    balance: number;
    equity: number;
    cycle_pnl: number;
    anchor: number;
    open_pos: number;
    open_buy: number;
    open_sell: number;
    pending_buy: number;
    pending_sell: number;
    protection_frozen?: boolean;
    frozen_side?: string;
    freeze_flip_count?: number;
    conn_status: string;
    config_status: string;
    trade_status: string;
    ea_status: string;
    last_ack_seq: number;
    active_config: ActiveConfig;
    chart?: SmartChartData | null;
    vote_council?: VoteCouncilState | null;
    round_history?: RoundHistoryTuple[] | null;
    last_ping: string;
}

function TpScrollWheelPicker({
    value,
    onChange,
    currency,
}: {
    value: number;
    onChange: (val: number) => void;
    currency: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isUserScrollingRef = useRef<boolean>(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const itemHeight = 36; // px

    const baseValues = useMemo(() => {
        const list = [
            20, 10, 5, 0,
            -5, -10, -15, -20, -25, -30, -35, -40, -45, -50,
            -60, -70, -80, -90, -100, -110, -120, -130, -140, -150,
            -160, -170, -180, -190, -200, -225, -250, -275, -300,
            -350, -400, -450, -500, -600, -700, -800, -900, -1000
        ];
        if (!list.includes(value)) {
            list.push(value);
            list.sort((a, b) => b - a); // descending order: 20 down to -1000
        }
        return list;
    }, [value]);

    useEffect(() => {
        if (isUserScrollingRef.current) return;
        const idx = baseValues.indexOf(value);
        if (idx !== -1 && containerRef.current) {
            containerRef.current.scrollTo({
                top: idx * itemHeight,
                behavior: 'smooth',
            });
        }
    }, [value, baseValues]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        isUserScrollingRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        const target = e.currentTarget;
        scrollTimeoutRef.current = setTimeout(() => {
            const top = target.scrollTop;
            const idx = Math.min(
                baseValues.length - 1,
                Math.max(0, Math.round(top / itemHeight))
            );
            if (baseValues[idx] !== undefined && baseValues[idx] !== value) {
                onChange(baseValues[idx]);
            }
            isUserScrollingRef.current = false;
        }, 100);
    };

    const adjustStep = (delta: number) => {
        isUserScrollingRef.current = false;
        onChange(value + delta);
    };

    return (
        <div className="flex flex-col items-center w-full">
            {/* Scroll Wheel Drum */}
            <div className="relative w-full h-[144px] overflow-hidden select-none bg-slate-950/80 rounded-xl border border-cyan-500/25">
                {/* 3D Wheel Mask Vignette */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#0b0f19] via-[#0b0f19]/80 to-transparent z-10" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent z-10" />

                {/* Center target cursor bar */}
                <div className="pointer-events-none absolute top-[54px] inset-x-2 h-[36px] border-y border-cyan-400/50 bg-cyan-500/10 rounded-md z-0 flex items-center justify-between px-3">
                    <span className="text-[10px] text-cyan-400 font-mono">▶</span>
                    <span className="text-[10px] text-cyan-400 font-mono">◀</span>
                </div>

                {/* Scroll container */}
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto snap-y snap-mandatory py-[54px] text-center"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {baseValues.map((v) => {
                        const isSelected = v === value;
                        return (
                            <div
                                key={v}
                                onClick={() => {
                                    isUserScrollingRef.current = false;
                                    onChange(v);
                                }}
                                className={cn(
                                    "h-[36px] flex items-center justify-center font-mono cursor-pointer snap-center transition-all",
                                    isSelected
                                        ? "text-base font-bold text-cyan-300 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                                        : "text-xs text-slate-500 hover:text-slate-300 opacity-60"
                                )}
                            >
                                <span>{v > 0 ? `+${v}` : v} {currency}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Micro Stepper buttons */}
            <div className="grid grid-cols-6 gap-1 w-full mt-2.5">
                {[-50, -10, -1, 1, 10, 50].map((step) => (
                    <Button
                        key={step}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-1 text-[11px] font-mono border-slate-700/80 bg-slate-900/60 hover:bg-cyan-950/40 hover:border-cyan-500/50 text-slate-200"
                        onClick={() => adjustStep(step)}
                    >
                        {step > 0 ? `+${step}` : step}
                    </Button>
                ))}
            </div>
        </div>
    );
}

function ParamWheelPicker({
    value,
    onChange,
    values,
    unit,
    isDecimal,
}: {
    value: number;
    onChange: (val: number) => void;
    values: number[];
    unit?: string;
    isDecimal?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isUserScrollingRef = useRef<boolean>(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const itemHeight = 36; // px

    const sortedValues = useMemo(() => {
        const set = new Set(values);
        set.add(value);
        const arr = Array.from(set);
        arr.sort((a, b) => b - a); // descending
        return arr;
    }, [values, value]);

    useEffect(() => {
        if (isUserScrollingRef.current) return;
        const idx = sortedValues.findIndex((v) => Math.abs(v - value) < (isDecimal ? 0.005 : 0.001));
        if (idx !== -1 && containerRef.current) {
            containerRef.current.scrollTo({
                top: idx * itemHeight,
                behavior: 'smooth',
            });
        }
    }, [value, sortedValues, isDecimal]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        isUserScrollingRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        const target = e.currentTarget;
        scrollTimeoutRef.current = setTimeout(() => {
            const top = target.scrollTop;
            const idx = Math.min(
                sortedValues.length - 1,
                Math.max(0, Math.round(top / itemHeight))
            );
            if (sortedValues[idx] !== undefined && Math.abs(sortedValues[idx] - value) >= (isDecimal ? 0.005 : 0.001)) {
                onChange(sortedValues[idx]);
            }
            isUserScrollingRef.current = false;
        }, 100);
    };

    return (
        <div className="relative w-full h-[144px] overflow-hidden select-none bg-slate-950/80 rounded-xl border border-cyan-500/25">
            {/* 3D Wheel Mask Vignette */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#0b0f19] via-[#0b0f19]/80 to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/80 to-transparent z-10" />

            {/* Center target cursor bar */}
            <div className="pointer-events-none absolute top-[54px] inset-x-2 h-[36px] border-y border-cyan-400/50 bg-cyan-500/10 rounded-md z-0 flex items-center justify-between px-3">
                <span className="text-[10px] text-cyan-400 font-mono">▶</span>
                <span className="text-[10px] text-cyan-400 font-mono">◀</span>
            </div>

            {/* Scroll container */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto snap-y snap-mandatory py-[54px] text-center"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {sortedValues.map((v) => {
                    const isSelected = Math.abs(v - value) < (isDecimal ? 0.005 : 0.001);
                    return (
                        <div
                            key={v}
                            onClick={() => {
                                isUserScrollingRef.current = false;
                                onChange(v);
                            }}
                            className={cn(
                                "h-[36px] flex items-center justify-center font-mono cursor-pointer snap-center transition-all",
                                isSelected
                                    ? "text-base font-bold text-cyan-300 scale-110 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]"
                                    : "text-xs text-slate-500 hover:text-slate-300 opacity-60"
                            )}
                        >
                            <span>
                                {isDecimal ? v.toFixed(2) : v} {unit || ''}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SmartEACockpitContent() {
    const searchParams = useSearchParams();
    const initialPortParam = searchParams.get('port') || '';

    const [portInput, setPortInput] = useState(initialPortParam);
    const [activePort, setActivePort] = useState(initialPortParam);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [eaState, setEaState] = useState<EAState | null>(null);
    const [lastCommand, setLastCommand] = useState<any>(null);
    const [latestVersion, setLatestVersion] = useState<string>('1.14');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [confirmCloseAll, setConfirmCloseAll] = useState(false);
    const [isFreezeVoteExpanded, setIsFreezeVoteExpanded] = useState(false);
    const [pnlJitter, setPnlJitter] = useState(0);
    const [sessionOpenedAt, setSessionOpenedAt] = useState<number>(() => Date.now());
    const [clockNow, setClockNow] = useState<Date>(() => new Date());

    // Form fields
    const [firstDistance, setFirstDistance] = useState('100');
    const [spacing, setSpacing] = useState('100');
    const [pendingPerSide, setPendingPerSide] = useState('10');
    const [initialLot, setInitialLot] = useState('0.01');
    const [lotIncrement, setLotIncrement] = useState('0.01');
    const [stepLotRepeat, setStepLotRepeat] = useState('2');
    const [targetProfit, setTargetProfit] = useState('20');
    const [freezeStopLoss, setFreezeStopLoss] = useState('0');
    const [enableSingleSideFreeze, setEnableSingleSideFreeze] = useState(false);
    const [singleSideFreezeTrigger, setSingleSideFreezeTrigger] = useState('16');
    const [maxOrdersPerSide, setMaxOrdersPerSide] = useState('0');
    const [enableArmedLock, setEnableArmedLock] = useState(true);
    const [armedLockTrigger, setArmedLockTrigger] = useState('7');
    const [lockOppositeAt, setLockOppositeAt] = useState('10');
    const [enableDualEngine, setEnableDualEngine] = useState(false);
    const [parkBreakoutPts, setParkBreakoutPts] = useState('500');
    const [parkDDPercent, setParkDDPercent] = useState('12');
    const [enableInstantPairCut, setEnableInstantPairCut] = useState(false);
    const [enableHarvestOffset, setEnableHarvestOffset] = useState(false);
    const [enableCapFreeze, setEnableCapFreeze] = useState(false);
    const [maxBothSidesCap, setMaxBothSidesCap] = useState('7');
    const [freezeFlipMaxExtra, setFreezeFlipMaxExtra] = useState('3');
    const [freezeFlipContinuous, setFreezeFlipContinuous] = useState(true);
    const [enableStreakUnlock, setEnableStreakUnlock] = useState(false);
    const [streakUnlockTrades, setStreakUnlockTrades] = useState('7');
    const [streakUnlockCandles, setStreakUnlockCandles] = useState('7');
    const [enableAutoHedge, setEnableAutoHedge] = useState(false);
    const [hedgeDDPercent, setHedgeDDPercent] = useState('20');
    const [enableHedgeTrailing, setEnableHedgeTrailing] = useState(true);
    const [hedgeTrailStartPts, setHedgeTrailStartPts] = useState('300');
    const [hedgeTrailStepPts, setHedgeTrailStepPts] = useState('150');
    const [enableHedgePartial, setEnableHedgePartial] = useState(true);
    const [hedgePartialPct, setHedgePartialPct] = useState('50');
    const [hedgeReboundPts, setHedgeReboundPts] = useState('250');
    const [enableHedgeOffset, setEnableHedgeOffset] = useState(true);
    const [formInitialized, setFormInitialized] = useState(false);

    useEffect(() => {
        const t = setInterval(() => setClockNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.title = activePort ? `Monitor & Control #${activePort}` : 'Monitor & Control';
        }
    }, [activePort]);

    useEffect(() => {
        if (initialPortParam) {
            if (typeof window !== 'undefined') {
                localStorage.setItem('smart_ea_port', initialPortParam);
            }
            return;
        }
        const saved = typeof window !== 'undefined' ? localStorage.getItem('smart_ea_port') : '';
        if (saved) {
            setPortInput(saved);
            setActivePort(saved);
            return;
        }
        // Auto-detect active Smart EA port from logged-in user's licenses
        (async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('account_number, products(product_key, name, strategy)')
                    .eq('user_id', user.id)
                    .eq('is_active', true);
                const smartLic = (licenses || []).find((l: any) => {
                    const key = (l.products?.product_key || '').toUpperCase();
                    const name = (l.products?.name || '').toLowerCase();
                    return key.startsWith('SMART-') || name.includes('smart vortex') || l.products?.strategy === 'Smart EA';
                });
                if (smartLic?.account_number) {
                    setPortInput(smartLic.account_number);
                    setActivePort(smartLic.account_number);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('smart_ea_port', smartLic.account_number);
                    }
                }
            } catch {
                // Ignore auto-detect error
            }
        })();
    }, [initialPortParam]);

    const fetchTelemetry = useCallback(async (portToFetch: string) => {
        if (!portToFetch) return;
        try {
            const res = await fetch(`/api/smart-ea/control?port=${encodeURIComponent(portToFetch)}`, {
                cache: 'no-store',
            });
            const data = await res.json();
            if (data.success) {
                setIsOnline(Boolean(data.is_online));
                if (data.state) {
                    setEaState(data.state);
                    try {
                        localStorage.setItem(
                            `sv_last_telemetry_${portToFetch}`,
                            JSON.stringify({
                                state: data.state,
                                command: data.command || null,
                                savedAt: Date.now(),
                            })
                        );
                    } catch {
                        // ignore storage quota errors
                    }
                }
                setLastCommand(data.command || null);
                if (data.latest_version) setLatestVersion(String(data.latest_version));
                if (data.download_url) setDownloadUrl(String(data.download_url));

                // Populate form once from live EA or saved command
                if (!formInitialized) {
                    const src = data.command?.command_seq > 0
                        ? data.command
                        : data.state?.active_config;
                    if (src) {
                        if (src.first_distance !== undefined) setFirstDistance(String(src.first_distance));
                        if (src.spacing !== undefined) setSpacing(String(src.spacing));
                        if (src.pending_per_side !== undefined) setPendingPerSide(String(src.pending_per_side));
                        if (src.initial_lot !== undefined) setInitialLot(String(src.initial_lot));
                        if (src.lot_increment !== undefined) setLotIncrement(String(src.lot_increment));
                        if (src.step_lot_repeat !== undefined) setStepLotRepeat(String(src.step_lot_repeat));
                        if (src.enable_single_side_freeze !== undefined) setEnableSingleSideFreeze(Boolean(src.enable_single_side_freeze));
                        if (src.single_side_freeze_trigger !== undefined) setSingleSideFreezeTrigger(String(src.single_side_freeze_trigger));
                        if (src.max_orders_per_side !== undefined) setMaxOrdersPerSide(String(src.max_orders_per_side));
                        if (src.enable_armed_lock !== undefined) setEnableArmedLock(Boolean(src.enable_armed_lock));
                        if (src.armed_lock_trigger !== undefined) setArmedLockTrigger(String(src.armed_lock_trigger));
                        if (src.lock_opposite_at !== undefined) setLockOppositeAt(String(src.lock_opposite_at));
                        if (src.enable_dual_engine !== undefined) setEnableDualEngine(Boolean(src.enable_dual_engine));
                        if (src.park_breakout_pts !== undefined) setParkBreakoutPts(String(src.park_breakout_pts));
                        if (src.park_dd_percent !== undefined) setParkDDPercent(String(src.park_dd_percent));
                        if (src.enable_instant_pair_cut !== undefined) setEnableInstantPairCut(Boolean(src.enable_instant_pair_cut));
                        if (src.enable_harvest_offset !== undefined) setEnableHarvestOffset(Boolean(src.enable_harvest_offset));
                        const baseTpVal = src.base_target_profit !== undefined ? src.base_target_profit : src.target_profit;
                        const baseFslVal = src.base_freeze_stop_loss !== undefined ? src.base_freeze_stop_loss : src.freeze_stop_loss;
                        if (baseTpVal !== undefined) setTargetProfit(String(baseTpVal));
                        if (baseFslVal !== undefined) setFreezeStopLoss(String(baseFslVal));
                        if (src.enable_cap_freeze !== undefined) setEnableCapFreeze(Boolean(src.enable_cap_freeze));
                        if (src.max_both_sides_cap !== undefined) setMaxBothSidesCap(String(src.max_both_sides_cap));
                        if (src.freeze_flip_max_extra !== undefined) setFreezeFlipMaxExtra(String(src.freeze_flip_max_extra));
                        if (src.freeze_flip_continuous !== undefined) setFreezeFlipContinuous(Boolean(src.freeze_flip_continuous));
                        if (src.enable_streak_unlock !== undefined) setEnableStreakUnlock(Boolean(src.enable_streak_unlock));
                        if (src.streak_unlock_trades !== undefined) setStreakUnlockTrades(String(src.streak_unlock_trades));
                        if (src.streak_unlock_candles !== undefined) setStreakUnlockCandles(String(src.streak_unlock_candles));
                        if (src.enable_auto_hedge !== undefined) setEnableAutoHedge(Boolean(src.enable_auto_hedge));
                        if (src.hedge_dd_percent !== undefined) setHedgeDDPercent(String(src.hedge_dd_percent));
                        if (src.enable_hedge_trailing !== undefined) setEnableHedgeTrailing(Boolean(src.enable_hedge_trailing));
                        if (src.hedge_trail_start_pts !== undefined) setHedgeTrailStartPts(String(src.hedge_trail_start_pts));
                        if (src.hedge_trail_step_pts !== undefined) setHedgeTrailStepPts(String(src.hedge_trail_step_pts));
                        if (src.enable_hedge_partial !== undefined) setEnableHedgePartial(Boolean(src.enable_hedge_partial));
                        if (src.hedge_partial_pct !== undefined) setHedgePartialPct(String(src.hedge_partial_pct));
                        if (src.hedge_rebound_pts !== undefined) setHedgeReboundPts(String(src.hedge_rebound_pts));
                        if (src.enable_hedge_offset !== undefined) setEnableHedgeOffset(Boolean(src.enable_hedge_offset));
                        setFormInitialized(true);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to poll Smart EA:', err);
        }
    }, [formInitialized]);

    // Immediately hydrate cached snapshot on first visit while waiting for next sync round
    useEffect(() => {
        if (!activePort) return;
        setSessionOpenedAt(Date.now());
        try {
            const cachedRaw = localStorage.getItem(`sv_last_telemetry_${activePort}`);
            if (cachedRaw) {
                const cached = JSON.parse(cachedRaw);
                if (cached?.state) {
                    setEaState((prev) => prev || cached.state);
                }
                if (cached?.command) {
                    setLastCommand((prev: any) => prev || cached.command);
                }
            }
        } catch {
            // ignore parse error
        }
        fetchTelemetry(activePort);
    }, [activePort, fetchTelemetry]);

    const isWaitingFreshData = Boolean(
        activePort &&
        eaState &&
        (
            !isOnline ||
            !eaState.chart ||
            !eaState.last_ping ||
            new Date(eaState.last_ping).getTime() < sessionOpenedAt - 20000
        )
    );

    useEffect(() => {
        if (!activePort) return;
        // Poll faster (5s) while waiting for initial fresh sync after opening page, then 15s live mode
        const pollMs = isWaitingFreshData ? 5000 : 15000;
        const timer = setInterval(() => fetchTelemetry(activePort), pollMs);
        return () => clearInterval(timer);
    }, [activePort, isWaitingFreshData, fetchTelemetry]);

    // Reset live profit jitter on each real MT5 snapshot & pulse gently when positions are open
    useEffect(() => {
        setPnlJitter(0);
    }, [eaState?.last_ping, eaState?.cycle_pnl]);

    useEffect(() => {
        if (!isOnline || isWaitingFreshData || !eaState || eaState.open_pos <= 0) {
            setPnlJitter(0);
            return;
        }
        const scale = Math.max(0.03, Math.min(0.35, eaState.open_pos * 0.04));
        const timer = setInterval(() => {
            setPnlJitter((prev) => {
                const next = prev + (Math.random() - 0.49) * scale;
                const cap = scale * 4;
                if (next > cap) return cap * 0.8;
                if (next < -cap) return -cap * 0.8;
                return next;
            });
        }, 650);
        return () => clearInterval(timer);
    }, [isOnline, isWaitingFreshData, eaState?.open_pos, eaState?.last_ping]);

    const handleConnectPort = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = portInput.trim();
        if (!clean) {
            toast.error('กรุณากรอกหมายเลขพอร์ต MT5');
            return;
        }
        if (typeof window !== 'undefined') {
            localStorage.setItem('smart_ea_port', clean);
        }
        setFormInitialized(false);
        setActivePort(clean);
        setLoading(true);
        fetchTelemetry(clean).finally(() => setLoading(false));
    };

    const sendCommand = async (payload: Record<string, any>, successMsg: string) => {
        if (!activePort) {
            toast.error('กรุณาเชื่อมต่อหมายเลขพอร์ตก่อน');
            return;
        }
        setSending(true);
        try {
            const res = await fetch('/api/smart-ea/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ port_number: activePort, ...payload }),
            });
            const data = await res.json();
            if (data.success) {
                setLastCommand(data.command);
                toast.success(successMsg);
                setTimeout(() => fetchTelemetry(activePort), 1000);
            } else {
                toast.error(data.error || 'ส่งคำสั่งไม่สำเร็จ');
            }
        } catch {
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        } finally {
            setSending(false);
        }
    };

    const handleUpdateSettings = (e: React.FormEvent) => {
        e.preventDefault();
        const fDist = parseInt(firstDistance, 10);
        const spc = parseInt(spacing, 10);
        const pend = parseInt(pendingPerSide, 10);
        const lot = parseFloat(initialLot);
        const inc = parseFloat(lotIncrement);
        const slr = parseInt(stepLotRepeat, 10);
        const tp = parseFloat(targetProfit);
        const rawFsl = parseFloat(freezeStopLoss);
        const fsl = isNaN(rawFsl) ? 0 : (rawFsl > 0 ? -rawFsl : rawFsl);
        const ssfTrig = parseInt(singleSideFreezeTrigger, 10);
        const maxSide = parseInt(maxOrdersPerSide, 10);
        const armTrig = parseInt(armedLockTrigger, 10);
        const lckAt = parseInt(lockOppositeAt, 10);
        const prkBo = parseInt(parkBreakoutPts, 10);
        const prkDd = parseFloat(parkDDPercent);
        const cap = parseInt(maxBothSidesCap, 10);
        const fmax = parseInt(freezeFlipMaxExtra, 10);
        const stkTrades = parseInt(streakUnlockTrades, 10);
        const stkCandles = parseInt(streakUnlockCandles, 10);
        const hdgDd = parseFloat(hedgeDDPercent);
        const hdgTStart = parseInt(hedgeTrailStartPts, 10);
        const hdgTStep = parseInt(hedgeTrailStepPts, 10);
        const hdgPartPct = parseFloat(hedgePartialPct);
        const hdgReb = parseInt(hedgeReboundPts, 10);

        if (isNaN(fDist) || fDist < 10 || isNaN(spc) || spc < 10 || isNaN(pend) || pend < 1 ||
            isNaN(lot) || lot <= 0 || isNaN(inc) || inc < 0 || isNaN(slr) || slr < 1 || slr > 20 ||
            isNaN(ssfTrig) || ssfTrig < 0 || ssfTrig > 100 ||
            isNaN(maxSide) || maxSide < 0 || maxSide > 100 ||
            isNaN(armTrig) || armTrig < 1 || armTrig > 50 ||
            isNaN(lckAt) || lckAt < armTrig || lckAt > 100 ||
            isNaN(prkBo) || prkBo < 0 || prkBo > 20000 ||
            isNaN(prkDd) || prkDd < 1 || prkDd > 95 ||
            isNaN(tp) || isNaN(cap) || cap < 0 || cap > 50 ||
            isNaN(fmax) || fmax < 0 || fmax > 50 ||
            isNaN(stkTrades) || stkTrades < 1 || stkTrades > 50 ||
            isNaN(stkCandles) || stkCandles < 1 || stkCandles > 100 ||
            isNaN(hdgDd) || hdgDd < 1 || hdgDd > 95 ||
            isNaN(hdgTStart) || hdgTStart < 10 || isNaN(hdgTStep) || hdgTStep < 10 ||
            isNaN(hdgPartPct) || hdgPartPct < 10 || hdgPartPct > 100 ||
            isNaN(hdgReb) || hdgReb < 10) {
            toast.error('กรุณาตรวจสอบค่าตัวเลขที่กรอกให้ถูกต้อง');
            return;
        }

        sendCommand(
            {
                first_distance: fDist,
                spacing: spc,
                pending_per_side: pend,
                initial_lot: lot,
                lot_increment: inc,
                step_lot_repeat: slr,
                target_profit: tp,
                freeze_stop_loss: fsl,
                base_target_profit: tp,
                base_freeze_stop_loss: fsl,
                is_exit_override: false,
                enable_single_side_freeze: false,
                single_side_freeze_trigger: ssfTrig,
                max_orders_per_side: maxSide,
                enable_armed_lock: enableArmedLock,
                armed_lock_trigger: armTrig,
                lock_opposite_at: lckAt,
                enable_dual_engine: false,
                park_breakout_pts: prkBo,
                park_dd_percent: prkDd,
                enable_instant_pair_cut: false,
                enable_harvest_offset: false,
                enable_cap_freeze: false,
                max_both_sides_cap: cap,
                freeze_flip_max_extra: fmax,
                freeze_flip_continuous: freezeFlipContinuous,
                enable_streak_unlock: false,
                streak_unlock_trades: stkTrades,
                streak_unlock_candles: stkCandles,
                enable_auto_hedge: enableAutoHedge,
                hedge_dd_percent: hdgDd,
                base_hedge_dd_percent: hdgDd,
                enable_hedge_trailing: enableHedgeTrailing,
                hedge_trail_start_pts: hdgTStart,
                hedge_trail_step_pts: hdgTStep,
                enable_hedge_partial: enableHedgePartial,
                hedge_partial_pct: hdgPartPct,
                hedge_rebound_pts: hdgReb,
                enable_hedge_offset: enableHedgeOffset,
                close_all: false,
            },
            'ส่งค่า Setting ใหม่ไปยัง EA แล้ว! ระบบกำลังลบ Pending เก่าและสร้างระยะใหม่...'
        );
    };

    const isPendingAck = Boolean(
        lastCommand?.command_seq &&
        eaState &&
        Number(lastCommand.command_seq) > Number(eaState.last_ack_seq || 0)
    );

    // Active control state: reflects user's queued command immediately, then synced MT5 state
    const effectiveStopMode = isPendingAck && lastCommand?.stop_mode
        ? String(lastCommand.stop_mode)
        : (eaState?.active_config?.stop_mode || eaState?.trade_status || 'RUN');

    const isPauseNextActive = effectiveStopMode === 'PAUSE_NEXT' || eaState?.trade_status === 'PAUSED_NEXT';
    const isFreezeStopActive = effectiveStopMode === 'FREEZE_STOP' || eaState?.trade_status === 'FREEZE_STOP';
    const isStoppedActive = effectiveStopMode === 'STOPPED' || eaState?.trade_status === 'STOPPED';
    // EA is running unless explicitly paused or stopped (FROZEN_BUY/SELL is active cap protection while EA is running)
    const isRunning = !isPauseNextActive && !isFreezeStopActive && !isStoppedActive;

    const cur = eaState?.currency || 'USD';
    const liveCyclePnl = (eaState?.cycle_pnl || 0) + pnlJitter;
    const liveEquity = (eaState?.equity || 0) + pnlJitter;
    const activeTp = isPendingAck && lastCommand?.target_profit !== undefined
        ? Number(lastCommand.target_profit)
        : (eaState?.active_config?.target_profit ?? (parseFloat(targetProfit) || 20));
    const activeFreezeSl = isPendingAck && lastCommand?.freeze_stop_loss !== undefined
        ? Number(lastCommand.freeze_stop_loss)
        : (eaState?.active_config?.freeze_stop_loss ?? (parseFloat(freezeStopLoss) || 0));
    const activeHedgeDdPct = isPendingAck && lastCommand?.hedge_dd_percent !== undefined
        ? Number(lastCommand.hedge_dd_percent)
        : (eaState?.active_config?.hedge_dd_percent ?? (parseFloat(hedgeDDPercent) || 20));
    const activeAutoHedgeEnabled = eaState?.active_config?.enable_auto_hedge ?? enableAutoHedge;
    const activeCap = eaState?.active_config?.max_both_sides_cap ?? (parseInt(maxBothSidesCap, 10) || 7);

    // Semantic numeric version comparison: > 0 means latest > current
    const compareVersions = (a: string, b: string) => {
        const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
        const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
            const diff = (pa[i] || 0) - (pb[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    };
    const needsUpdate = Boolean(eaState?.ea_version && compareVersions(latestVersion, eaState.ea_version) > 0);

    // Prime-style Header calculations (75% Balance Anchor + 05:00 BKK Market Timeline)
    const balanceVal = eaState?.balance || 0;
    const safeBalance = Math.max(1, balanceVal);
    const pnlPct = balanceVal > 0 ? (liveCyclePnl / balanceVal) * 100 : 0;

    // Active Collapsible Drawer under Card 1: 'control' | 'setting' | 'planner' | null
    const [activeDrawer, setActiveDrawer] = useState<'control' | 'setting' | 'planner' | null>(null);
    const toggleDrawer = useCallback((drawer: 'control' | 'setting' | 'planner') => {
        setActiveDrawer((prev) => (prev === drawer ? null : drawer));
    }, []);
    const [customTpModalOpen, setCustomTpModalOpen] = useState(false);
    const [customTpVal, setCustomTpVal] = useState<number>(-100);

    const minusOnePct = balanceVal > 0 ? -Math.max(1, Math.round(balanceVal * 0.01)) : -100;
    const minusTwoPct = balanceVal > 0 ? -Math.max(2, Math.round(balanceVal * 0.02)) : -200;
    const currentDd = Math.round(liveCyclePnl < 0 ? liveCyclePnl : (eaState?.cycle_pnl || 0));

    // Freeze Banner Quick Presets:
    // SL 1: DD from real net lot if price moves 500 points further against basket
    const sl500Val = useMemo(() => {
        const c = eaState?.chart;
        let dd500 = 0;
        if (c && c.est_tp_price > 0 && c.bid > 0) {
            const digits = c.digits ?? 2;
            const pointSize = Math.pow(10, -digits);
            const refPrice = c.tp_dir === 'DOWN' ? (c.ask || c.bid) : c.bid;
            const deltaPrice = Math.abs(c.est_tp_price - refPrice);
            const needed = Math.abs(activeTp - (eaState?.cycle_pnl || 0));
            if (deltaPrice > pointSize * 0.5 && needed > 0) {
                dd500 = (needed / deltaPrice) * pointSize * 500;
            }
        }
        if (dd500 <= 0 && c?.orders?.length) {
            let buyLot = 0;
            let sellLot = 0;
            for (const o of c.orders) {
                if (o.t === 'B') buyLot += o.l;
                else if (o.t === 'S') sellLot += o.l;
            }
            const netLot = Math.abs(buyLot - sellLot);
            dd500 = netLot * 500;
        }
        if (dd500 <= 0) {
            const netTrades = Math.max(1, Math.abs((eaState?.open_buy || 0) - (eaState?.open_sell || 0)));
            dd500 = netTrades * 0.01 * 500;
        }
        return Math.min(-1, Math.round(liveCyclePnl - dd500));
    }, [eaState, activeTp, liveCyclePnl]);

    // SL 2: -3% of Balance
    const slMinus3PctVal = balanceVal > 0 ? -Math.max(1, Math.round(balanceVal * 0.03)) : -300;

    // TP 1: Halfway between current DD and TP = 0
    const tpHalfDdVal = liveCyclePnl < 0 ? Math.round(liveCyclePnl / 2) : 0;

    const openCustomTpModal = useCallback(() => {
        const bal = eaState?.balance || 0;
        const defaultMinusOne = bal > 0 ? -Math.max(1, Math.round(bal * 0.01)) : -100;
        setCustomTpVal(defaultMinusOne);
        setCustomTpModalOpen(true);
    }, [eaState?.balance]);

    const handleConfirmCustomTp = () => {
        sendCommand(
            { target_profit: customTpVal, is_exit_override: true, close_all: false },
            `ตั้งเป้า TP เฉพาะรอบนี้ = ${customTpVal} ${cur} แล้ว (เมื่อจบรอบนี้จะกลับไปใช้ค่า Setting TP = ${targetProfit} ${cur} อัตโนมัติ)`
        );
        setCustomTpModalOpen(false);
    };

    // Parameters Collapsible Accordion & Wheel Picker Modal State
    interface ParamModalConfig {
        title: string;
        unit: string;
        currentVal: number;
        step: number;
        isDecimal?: boolean;
        presetValues: number[];
        quickSteps: number[];
        onApply: (newVal: number) => void;
    }

    const [isParamsOpen, setIsParamsOpen] = useState(false);
    const [paramModalConfig, setParamModalConfig] = useState<ParamModalConfig | null>(null);
    const [paramModalValue, setParamModalValue] = useState<number>(0);

    const openParamModal = useCallback((config: ParamModalConfig) => {
        setParamModalConfig(config);
        setParamModalValue(config.currentVal);
    }, []);

    const applyParamModal = useCallback(() => {
        if (paramModalConfig) {
            paramModalConfig.onApply(paramModalValue);
        }
        setParamModalConfig(null);
    }, [paramModalConfig, paramModalValue]);

    // 1-Day Trading Timeline (05:00 AM Bangkok -> 05:00 AM next day): shrinks from left to right
    const bkkStr = clockNow.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const [bkkH, bkkM] = bkkStr.split(':').map((v) => parseInt(v, 10) || 0);
    const minsSince0500 = ((bkkH * 60 + bkkM) - 300 + 1440) % 1440;
    const marketElapsedPct = (minsSince0500 / 1440) * 100;
    const remainingMarketPct = Math.max(0, 100 - marketElapsedPct);

    const secAngle = clockNow.getSeconds() * 6;
    const minAngle = clockNow.getMinutes() * 6 + clockNow.getSeconds() * 0.1;
    const hrAngle = (clockNow.getHours() % 12) * 30 + clockNow.getMinutes() * 0.5;

    return (
        <div className="min-h-screen bg-[#040711] text-slate-100">
        <div className="w-full max-w-6xl mx-auto px-1.5 sm:px-2.5 py-1 sm:py-2 space-y-1.5 sm:space-y-2">
            {/* Minimal Top Cockpit Header: Back to Dashboard & Status Tag */}
            <div className="flex items-center justify-between pb-0.5 pt-0.5">
                <a
                    href="/dashboard"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 text-xs font-mono transition-all duration-200 active:scale-95 shadow-sm"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>กลับแดชบอร์ด</span>
                </a>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-[11px] font-mono font-semibold tracking-wider text-cyan-400/90 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        Monitor &amp; Control
                    </span>
                </div>
            </div>
            {!activePort ? (
                <Card className="border-cyan-500/30 bg-[#070b16]/95 text-slate-100">
                    <CardContent className="py-12 text-center space-y-4">
                        <Activity className="w-10 h-10 mx-auto text-cyan-400" />
                        <h3 className="text-base font-mono font-bold text-cyan-300">CONNECT SMART VORTEX PORT</h3>
                        <form onSubmit={handleConnectPort} className="flex items-center justify-center gap-2 max-w-sm mx-auto">
                            <Input
                                placeholder="PORT # (e.g. 58018897)"
                                value={portInput}
                                onChange={(e) => setPortInput(e.target.value)}
                                className="font-mono text-xs bg-slate-950/90 border-cyan-500/30 text-cyan-100"
                            />
                            <Button type="submit" disabled={loading} className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'LINK'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* 🎛️ Unified Top Cockpit Card: Clock + Telemetry + Version + Tactical Status (LINK / CFG / MODE) */}
                    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-[#070d1c] via-[#061224] to-[#070d1c] p-2.5 sm:p-3 shadow-[0_0_24px_rgba(6,182,212,0.12)] space-y-2 transition-all duration-500">
                        {/* 1. CLOCK & TELEMETRY ROW */}
                        <div className="flex items-center gap-2.5 sm:gap-3.5">
                            {/* Analog Live Clock */}
                            <svg viewBox="0 0 60 60" className="w-11 h-11 sm:w-13 sm:h-13 shrink-0">
                                <circle cx="30" cy="30" r="27" fill="#050811" stroke="#22d3ee" strokeWidth="1.5" opacity="0.85" />
                                <circle cx="30" cy="30" r="23" fill="none" stroke="#1e293b" strokeWidth="1" />
                                <text x="30" y="13" textAnchor="middle" fontSize="6.5" fill="#22d3ee" fontFamily="monospace">12</text>
                                <text x="30" y="52" textAnchor="middle" fontSize="6.5" fill="#22d3ee" fontFamily="monospace">6</text>
                                <line x1="30" y1="30" x2="30" y2="16" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" transform={`rotate(${hrAngle} 30 30)`} />
                                <line x1="30" y1="30" x2="30" y2="11" stroke="#94a3b8" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${minAngle} 30 30)`} />
                                <line x1="30" y1="30" x2="30" y2="9" stroke="#f43f5e" strokeWidth="0.9" strokeLinecap="round" transform={`rotate(${secAngle} 30 30)`} />
                                <circle cx="30" cy="30" r="2.2" fill="#22d3ee" />
                            </svg>

                            {/* Left & Right Telemetry */}
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-start justify-between gap-2 font-mono">
                                    <div className="min-w-0">
                                        <div className="text-xs sm:text-sm font-bold tracking-wider text-cyan-300 truncate">
                                            {eaState?.symbol || 'XAUUSD'} | {activePort} | {cur}
                                        </div>
                                        <div className="text-[11px] sm:text-xs text-slate-400">
                                            EQUITY{' '}
                                            <strong className="text-sky-400 tabular-nums">
                                                {eaState ? liveEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="text-[10px] sm:text-xs text-slate-400 tabular-nums">
                                            BALANCE{' '}
                                            <strong className="text-slate-100">
                                                {eaState ? balanceVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---'}
                                            </strong>
                                        </div>
                                        <div className={`text-xs sm:text-sm font-bold tabular-nums ${liveCyclePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {eaState ? `${liveCyclePnl >= 0 ? '+' : ''}${liveCyclePnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)` : '---'}
                                        </div>
                                    </div>
                                </div>

                                {/* THE UNIFIED BAR: Balance as Anchor (75% mark) */}
                                <div className="relative h-2 sm:h-2.5 w-full bg-black/50 rounded-full border border-cyan-500/25 p-0.5 overflow-hidden shadow-inner">
                                    {/* Target Point: Balance Marker (WHITE at 75%) */}
                                    <div className="absolute left-[75%] top-0 bottom-0 w-[1px] bg-white/60 z-20" />

                                    {liveCyclePnl < 0 ? (
                                        <>
                                            <div
                                                className="h-full bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] rounded-l-full transition-all duration-1000"
                                                style={{ width: `${Math.max(0, 75 + (liveCyclePnl / safeBalance) * 75)}%` }}
                                            />
                                            <div
                                                className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-red-600/60 to-red-400 transition-all duration-1000"
                                                style={{
                                                    left: `${Math.max(0, 75 + (liveCyclePnl / safeBalance) * 75)}%`,
                                                    width: `${Math.min(75, Math.abs((liveCyclePnl / safeBalance) * 75))}%`,
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <div
                                                className="h-full bg-gradient-to-r from-[#0284c7] to-[#38bdf8] rounded-l-full transition-all duration-1000"
                                                style={{ width: '75%' }}
                                            />
                                            <div
                                                className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-[#4de180] to-green-300 shadow-[0_0_8px_rgba(77,225,128,0.3)] transition-all duration-1000"
                                                style={{
                                                    left: '75%',
                                                    width: `${Math.min(25, (liveCyclePnl / safeBalance) * 75)}%`,
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* Glowing tip at current Equity */}
                                    <div
                                        className={`absolute top-0 bottom-0 w-1 blur-[2px] z-30 transition-all duration-1000 ${liveCyclePnl >= 0 ? 'bg-[#38bdf8]' : 'bg-red-400'}`}
                                        style={{
                                            left: `${Math.max(0, Math.min(100, 75 + (liveCyclePnl / safeBalance) * 75))}%`,
                                            opacity: 0.6,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. 1-Day Trading Timeline Bar */}
                        <div className="relative w-full bg-black/40 border-y border-cyan-500/20 py-0.5 sm:py-1 rounded">
                            <div className="px-2 relative">
                                <div className="h-1 sm:h-1.5 w-full bg-white/5 rounded-full relative overflow-hidden">
                                    <div
                                        className="absolute top-0 right-0 h-full bg-gradient-to-r from-cyan-300/30 via-cyan-400/60 to-cyan-500/90 transition-all duration-1000 rounded-full"
                                        style={{ width: `${remainingMarketPct}%` }}
                                    />
                                </div>
                                <div className="absolute inset-0 px-2 flex justify-between items-center pointer-events-none">
                                    {Array.from({ length: 25 }).map((_, i) => (
                                        <div key={`h_${i}`} className={`h-1.5 sm:h-2 w-[1px] ${i % 6 === 0 ? 'bg-white/40' : 'bg-white/10'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 3. INTEGRATED SUB-BAR: ROW 1 = EA NAME ONLY, ROW 2 = FULL-WIDTH LINK / CFG / MODE */}
                        <div className="pt-1.5 border-t border-cyan-500/20 space-y-1.5 font-mono text-[11px] sm:text-xs">
                            {/* Row 1: EA Name & Version Only */}
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                                {needsUpdate ? (
                                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-amber-200">
                                        <Badge className="bg-amber-500 text-slate-950 font-bold text-[9px] px-1 py-0 h-3.5">
                                            UPDATE v{latestVersion}
                                        </Badge>
                                        <span className="text-[10px] sm:text-[11px] truncate">
                                            Smart Vortex v{eaState?.ea_version || '1.0'}
                                        </span>
                                        {downloadUrl && (
                                            <a
                                                href={downloadUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="ml-1 text-[10px] text-amber-300 hover:text-white underline font-bold"
                                            >
                                                โหลด
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-emerald-300">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                        <span className="font-bold">Smart Vortex v{eaState?.ea_version || latestVersion}</span>
                                        <span className="text-[10px] text-slate-400">(เวอร์ชันล่าสุด)</span>
                                    </div>
                                )}
                                <span className="text-[10px] text-slate-500">
                                    SYNC {(eaState as any)?.sync_interval_sec || 15}s
                                </span>
                            </div>

                            {/* Row 2: 3 Full-Width Status Signals (LINK, CFG, MODE) with clear descriptions */}
                            <div className="grid grid-cols-3 gap-1.5 w-full">
                                {/* LINK */}
                                <div className="rounded-lg px-2 py-1 bg-black/45 border border-slate-800 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] min-w-0">
                                    <span className="text-slate-400 shrink-0">LINK:</span>
                                    {isWaitingFreshData ? (
                                        <span className="text-amber-400 flex items-center gap-1 font-bold truncate" title="แสดงข้อมูลล่าสุดที่บันทึกไว้ และกำลังปลุก EA เข้าโหมด Live 15 วินาที">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin shrink-0" />
                                            <span className="truncate">กำลังปลุก Live</span>
                                        </span>
                                    ) : isOnline ? (
                                        <span className="text-emerald-400 flex items-center gap-1 font-bold truncate">
                                            <Wifi className="w-2.5 h-2.5 shrink-0" />
                                            <span className="truncate">เชื่อมต่อปกติ</span>
                                        </span>
                                    ) : (
                                        <span className="text-rose-400 flex items-center gap-1 font-bold truncate">
                                            <WifiOff className="w-2.5 h-2.5 shrink-0" />
                                            <span className="truncate">ขาดการเชื่อมต่อ</span>
                                        </span>
                                    )}
                                </div>

                                {/* CFG */}
                                <div className="rounded-lg px-2 py-1 bg-black/45 border border-slate-800 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] min-w-0">
                                    <span className="text-slate-400 shrink-0">CFG:</span>
                                    {isPendingAck ? (
                                        <span className="text-amber-400 font-bold flex items-center gap-1 truncate">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin shrink-0" />
                                            <span className="truncate">กำลังส่งค่า</span>
                                        </span>
                                    ) : eaState?.config_status === 'WEB_LOADED' ? (
                                        <span className="text-cyan-400 font-bold truncate">ใช้ค่าจากเว็บ</span>
                                    ) : (
                                        <span className="text-slate-300 font-bold truncate">ใช้ค่าใน MT5</span>
                                    )}
                                </div>

                                {/* MODE */}
                                <div className="rounded-lg px-2 py-1 bg-black/45 border border-slate-800 flex items-center justify-between gap-1 text-[10px] sm:text-[11px] min-w-0">
                                    <span className="text-slate-400 shrink-0">MODE:</span>
                                    <span
                                        className={`font-bold truncate ${
                                            isRunning
                                                ? 'text-emerald-400'
                                                : isPauseNextActive
                                                ? 'text-amber-400'
                                                : 'text-rose-400'
                                        }`}
                                    >
                                        {eaState?.trade_status === 'FROZEN_BUY'
                                            ? 'ล็อกฝั่ง BUY'
                                            : eaState?.trade_status === 'FROZEN_SELL'
                                            ? 'ล็อกฝั่ง SELL'
                                            : isRunning
                                            ? 'ทำงานปกติ'
                                            : isPauseNextActive
                                            ? 'รอหยุดจบรอบ'
                                            : isFreezeStopActive
                                            ? 'หยุดออกไม้ใหม่'
                                            : eaState?.trade_status || 'รอสถานะ'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 🎛️ New 3-Button Collapsible Action Bar under Card 1: Control | Setting | Exit Planner */}
                    <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-[#070b16]/95 shadow-[0_0_20px_rgba(6,182,212,0.08)]">
                        {isWaitingFreshData && <div className="sv-scan-beam" aria-hidden="true" />}
                        <div className="grid grid-cols-3 gap-1.5 p-1.5 sm:p-2 bg-[#050914]">
                            {/* Button 1: Control */}
                            <button
                                type="button"
                                disabled={isWaitingFreshData}
                                onClick={() => !isWaitingFreshData && toggleDrawer('control')}
                                className={cn(
                                    'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-xs sm:text-sm font-bold transition-all border',
                                    isWaitingFreshData
                                        ? 'bg-slate-900/60 border-slate-800/80 text-slate-400 opacity-75 cursor-not-allowed'
                                        : activeDrawer === 'control'
                                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)] active:scale-95'
                                        : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 active:scale-95'
                                )}
                            >
                                <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span className="truncate">Control</span>
                                <ChevronDown
                                    className={cn(
                                        'w-3.5 h-3.5 text-cyan-400/80 transition-transform duration-200 shrink-0',
                                        !isWaitingFreshData && activeDrawer === 'control' && 'rotate-180'
                                    )}
                                />
                            </button>

                            {/* Button 2: Setting */}
                            <button
                                type="button"
                                disabled={isWaitingFreshData}
                                onClick={() => !isWaitingFreshData && toggleDrawer('setting')}
                                className={cn(
                                    'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-xs sm:text-sm font-bold transition-all border',
                                    isWaitingFreshData
                                        ? 'bg-slate-900/60 border-slate-800/80 text-slate-400 opacity-75 cursor-not-allowed'
                                        : activeDrawer === 'setting'
                                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)] active:scale-95'
                                        : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 active:scale-95'
                                )}
                            >
                                <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span className="truncate">Setting</span>
                                <ChevronDown
                                    className={cn(
                                        'w-3.5 h-3.5 text-cyan-400/80 transition-transform duration-200 shrink-0',
                                        !isWaitingFreshData && activeDrawer === 'setting' && 'rotate-180'
                                    )}
                                />
                            </button>

                            {/* Button 3: Exit Planner */}
                            <button
                                type="button"
                                disabled={isWaitingFreshData}
                                onClick={() => !isWaitingFreshData && toggleDrawer('planner')}
                                className={cn(
                                    'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 font-mono text-xs sm:text-sm font-bold transition-all border',
                                    isWaitingFreshData
                                        ? 'bg-slate-900/60 border-slate-800/80 text-slate-400 opacity-75 cursor-not-allowed'
                                        : activeDrawer === 'planner'
                                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)] active:scale-95'
                                        : 'bg-slate-900/80 hover:bg-slate-800/80 border-slate-800 text-slate-300 active:scale-95'
                                )}
                            >
                                <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span className="truncate">Exit Planner</span>
                                <ChevronDown
                                    className={cn(
                                        'w-3.5 h-3.5 text-cyan-400/80 transition-transform duration-200 shrink-0',
                                        !isWaitingFreshData && activeDrawer === 'planner' && 'rotate-180'
                                    )}
                                />
                            </button>
                        </div>

                        {isWaitingFreshData && (
                            <div className="px-2.5 py-1 border-t border-cyan-500/20 bg-cyan-950/25 flex items-center justify-between gap-2 font-mono text-[10px] text-cyan-200/90">
                                <span className="flex items-center gap-1.5 truncate">
                                    <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />
                                    <span className="truncate">กำลังปลุก Live Sync (15s) — ล็อกปุ่มสั่งงานชั่วคราวจนกว่าจะซิงค์ข้อมูลล่าสุด</span>
                                </span>
                                <span className="text-[9.5px] text-amber-300 font-bold shrink-0">LOCKED</span>
                            </div>
                        )}

                        {/* Collapsible Panel 1: Control (Flight Control) */}
                        {!isWaitingFreshData && activeDrawer === 'control' && (
                            <div className="p-2.5 sm:p-3 border-t border-cyan-500/20 space-y-2 font-mono animate-in fade-in-50 duration-200">
                                {!isRunning && (
                                    <Button
                                        className="w-full justify-between bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 animate-in fade-in duration-200"
                                        disabled={sending}
                                        onClick={() =>
                                            sendCommand(
                                                { stop_mode: 'RUN', close_all: false },
                                                'สั่งเริ่มรันอีเอใหม่ (RUN) ไปยัง MT5 แล้ว'
                                            )
                                        }
                                    >
                                        <span className="flex items-center gap-2">
                                            <PlayCircle className="w-4 h-4 text-emerald-200" />
                                            <span>เริ่มรันอีเอใหม่ (ENGAGE // RUN)</span>
                                        </span>
                                        <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded font-mono">START</span>
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    className={`w-full justify-between text-xs transition-colors ${
                                        isPauseNextActive
                                            ? 'border-amber-500 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                            : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                                    }`}
                                    disabled={sending}
                                    onClick={() => {
                                        if (isPauseNextActive) {
                                            sendCommand(
                                                { stop_mode: 'RUN', close_all: false },
                                                'ยกเลิกการหยุดหลังจบรอบแล้ว กลับสู่โหมดรันต่อ (RUN)'
                                            );
                                        } else {
                                            sendCommand(
                                                { stop_mode: 'PAUSE_NEXT', close_all: false },
                                                'สั่งหยุดหลังจบรอบปัจจุบัน (Pause Next Cycle) แล้ว'
                                            );
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <PauseCircle className="w-4 h-4 text-amber-400" />
                                        <span>
                                            {isPauseNextActive
                                                ? 'หยุดหลังจบรอบนี้ (กดเพื่อยกเลิก)'
                                                : 'หยุดหลังจบรอบนี้ (Pause Next Cycle)'}
                                        </span>
                                    </span>
                                    {isPauseNextActive && (
                                        <Badge className="bg-amber-500 text-slate-950 font-mono text-[9px] px-1.5 py-0 h-4">
                                            รอจบรอบ
                                        </Badge>
                                    )}
                                </Button>

                                <Button
                                    variant="outline"
                                    className={`w-full justify-between text-xs transition-colors ${
                                        isFreezeStopActive
                                            ? 'border-rose-500 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                            : 'border-rose-500/40 text-rose-400 hover:bg-rose-500/10'
                                    }`}
                                    disabled={sending}
                                    onClick={() => {
                                        if (isFreezeStopActive) {
                                            sendCommand(
                                                { stop_mode: 'RUN', close_all: false },
                                                'ยกเลิกคำสั่งหยุดแล้ว กลับสู่โหมดรันต่อ (RUN)'
                                            );
                                        } else {
                                            sendCommand(
                                                { stop_mode: 'FREEZE_STOP', close_all: false },
                                                'สั่งลบ Pending และหยุดออกไม้ใหม่ทันทีแล้ว'
                                            );
                                        }
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-rose-400" />
                                        <span>
                                            {isFreezeStopActive
                                                ? 'ลบ Pending หยุดออกไม้ใหม่ (กดเพื่อยกเลิก)'
                                                : 'ลบ Pending หยุดออกไม้ใหม่'}
                                        </span>
                                    </span>
                                    {isFreezeStopActive && (
                                        <Badge className="bg-rose-500 text-white font-mono text-[9px] px-1.5 py-0 h-4">
                                            หยุดออกไม้
                                        </Badge>
                                    )}
                                </Button>

                                <div className="pt-2 border-t border-slate-800/80">
                                    {!confirmCloseAll ? (
                                        <Button
                                            variant="destructive"
                                            className="w-full justify-start gap-2 text-xs"
                                            disabled={sending}
                                            onClick={() => setConfirmCloseAll(true)}
                                        >
                                            <ShieldAlert className="w-4 h-4" />
                                            <span>ปิดรวบออเดอร์ทั้งหมดทันที (งดออกไม้ใหม่)</span>
                                        </Button>
                                    ) : (
                                        <div className="p-2.5 rounded-lg border border-destructive/50 bg-destructive/10 space-y-2">
                                            <p className="text-xs font-medium text-destructive">
                                                ยืนยันปิดรวบทุกไม้ ลบ Pending และงดออกไม้ใหม่ทันที?
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="flex-1 text-xs"
                                                    disabled={sending}
                                                    onClick={() => {
                                                        setConfirmCloseAll(false);
                                                        sendCommand(
                                                            { stop_mode: 'FREEZE_STOP', close_all: true },
                                                            'ส่งคำสั่ง Close All Now ปิดรวบทุกไม้และงดออกไม้ใหม่แล้ว!'
                                                        );
                                                    }}
                                                >
                                                    ยืนยันปิดรวบ & หยุด
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 text-xs"
                                                    onClick={() => setConfirmCloseAll(false)}
                                                >
                                                    ยกเลิก
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Collapsible Panel 2: Setting (Params Setting) */}
                        {!isWaitingFreshData && activeDrawer === 'setting' && (
                            <div className="p-2.5 sm:p-3 border-t border-cyan-500/20 animate-in fade-in-50 duration-200">
                                <form onSubmit={handleUpdateSettings} className="space-y-2.5 sm:space-y-3 font-mono">
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* 1. First Dist */}
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400 font-mono truncate block">
                                                <span className="sm:hidden">First Dist</span>
                                                <span className="hidden sm:inline">FIRST DIST (PT)</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={firstDistance}
                                                onClick={() => openParamModal({
                                                    title: 'FIRST DIST (ระยะแรก)',
                                                    unit: 'PT',
                                                    currentVal: parseFloat(firstDistance) || 100,
                                                    step: 10,
                                                    presetValues: [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 250, 300, 400, 500],
                                                    quickSteps: [-50, -10, 10, 50],
                                                    onApply: (v) => setFirstDistance(String(Math.max(10, Math.round(v)))),
                                                })}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-8 sm:h-9 cursor-pointer hover:border-cyan-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 2. Spacing */}
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400 font-mono truncate block">
                                                <span className="sm:hidden">Spacing</span>
                                                <span className="hidden sm:inline">SPACING (PT)</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={spacing}
                                                onClick={() => openParamModal({
                                                    title: 'SPACING (ระยะห่าง)',
                                                    unit: 'PT',
                                                    currentVal: parseFloat(spacing) || 60,
                                                    step: 10,
                                                    presetValues: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 180, 200, 250, 300, 400, 500],
                                                    quickSteps: [-50, -10, 10, 50],
                                                    onApply: (v) => setSpacing(String(Math.max(5, Math.round(v)))),
                                                })}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-8 sm:h-9 cursor-pointer hover:border-cyan-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 3. Pending Per Side */}
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400 font-mono truncate block">
                                                <span className="sm:hidden">Pending/ฝั่ง</span>
                                                <span className="hidden sm:inline">จำนวน Pending ต่อฝั่ง (Pending/Side)</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={pendingPerSide}
                                                onClick={() => openParamModal({
                                                    title: 'PENDING ต่อฝั่ง',
                                                    unit: 'ไม้',
                                                    currentVal: parseInt(pendingPerSide, 10) || 10,
                                                    step: 1,
                                                    presetValues: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25, 30],
                                                    quickSteps: [-5, -1, 1, 5],
                                                    onApply: (v) => setPendingPerSide(String(Math.max(1, Math.round(v)))),
                                                })}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-8 sm:h-9 cursor-pointer hover:border-cyan-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 4. Target Profit */}
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400 font-mono truncate block">
                                                <span className="sm:hidden">เป้าปิดรวบ (TP)</span>
                                                <span className="hidden sm:inline">เป้ากำไรปิดรวบ (Target Profit {cur})</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={targetProfit}
                                                onClick={() => openParamModal({
                                                    title: `TARGET PROFIT (${cur})`,
                                                    unit: cur,
                                                    currentVal: parseFloat(targetProfit) || 10,
                                                    step: 5,
                                                    presetValues: [100, 50, 40, 30, 25, 20, 15, 10, 5, 0, -5, -10, -15, -20, -25, -30, -40, -50, -60, -70, -80, -90, -100, -150, -200],
                                                    quickSteps: [-50, -10, -1, 1, 10, 50],
                                                    onApply: (v) => setTargetProfit(String(v)),
                                                })}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-8 sm:h-9 cursor-pointer hover:border-cyan-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 4b. Freeze Mode Stop Loss (SL) */}
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-amber-300/90 font-mono truncate block">
                                                <span className="sm:hidden">Freeze SL (0=ปิด)</span>
                                                <span className="hidden sm:inline">SL โหมด Freeze ({cur})</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={Number(freezeStopLoss) < 0 ? freezeStopLoss : '0 (OFF)'}
                                                onClick={() => openParamModal({
                                                    title: `FREEZE STOP LOSS (${cur})`,
                                                    unit: cur,
                                                    currentVal: Math.min(0, parseFloat(freezeStopLoss) || 0),
                                                    step: 50,
                                                    presetValues: [0, -50, -100, -200, -300, -500, -1000, -2000, -3000, -5000, -10000],
                                                    quickSteps: [-500, -100, -10, 10, 100, 500],
                                                    onApply: (v) => setFreezeStopLoss(String(v > 0 ? -v : v)),
                                                })}
                                                className="font-mono bg-slate-950/80 border-amber-500/30 text-amber-200 h-8 sm:h-9 cursor-pointer hover:border-amber-400/60 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 5. Initial Lot */}
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400 font-mono truncate block">
                                                <span className="sm:hidden">Lot เริ่มต้น</span>
                                                <span className="hidden sm:inline">ล็อตเริ่มต้น (Initial Lot)</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={initialLot}
                                                onClick={() => openParamModal({
                                                    title: 'LOT เริ่มต้น (INITIAL LOT)',
                                                    unit: 'Lot',
                                                    currentVal: parseFloat(initialLot) || 0.01,
                                                    step: 0.01,
                                                    isDecimal: true,
                                                    presetValues: [0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50, 1.00],
                                                    quickSteps: [-0.05, -0.01, 0.01, 0.05],
                                                    onApply: (v) => setInitialLot(String(Math.max(0.01, Math.round(v * 100) / 100))),
                                                })}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-8 sm:h-9 cursor-pointer hover:border-cyan-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 6. Lot Increment */}
                                        <div className="space-y-1">
                                            <Label className="text-[11px] text-slate-400 font-mono truncate block">
                                                <span className="sm:hidden">Lot เพิ่ม/ชั้น</span>
                                                <span className="hidden sm:inline">ล็อตเพิ่มต่อชั้น (Lot Increment)</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={lotIncrement}
                                                onClick={() => openParamModal({
                                                    title: 'LOT เพิ่มต่อชั้น (INCREMENT)',
                                                    unit: 'Lot',
                                                    currentVal: parseFloat(lotIncrement) || 0.01,
                                                    step: 0.01,
                                                    isDecimal: true,
                                                    presetValues: [0.00, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.15, 0.20, 0.25, 0.30, 0.50],
                                                    quickSteps: [-0.05, -0.01, 0.01, 0.05],
                                                    onApply: (v) => setLotIncrement(String(Math.max(0, Math.round(v * 100) / 100))),
                                                })}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-8 sm:h-9 cursor-pointer hover:border-cyan-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 6B. Step-Lot Repeat (v1.16) */}
                                        <div className="space-y-1 col-span-2">
                                            <Label className="text-[11px] text-slate-400 font-mono truncate block">
                                                <span className="sm:hidden">Step-Lot (ไม้/ขั้น)</span>
                                                <span className="hidden sm:inline">จำนวนไม้ต่อขั้น Lot (Step-Lot Repeat: 1 = ปกติ, 2 = ขั้นละ 2 ไม้)</span>
                                            </Label>
                                            <Input
                                                readOnly
                                                value={stepLotRepeat}
                                                onClick={() => openParamModal({
                                                    title: 'จำนวนไม้ต่อขั้น LOT (STEP-LOT)',
                                                    unit: 'ไม้/ขั้น',
                                                    currentVal: parseInt(stepLotRepeat, 10) || 2,
                                                    step: 1,
                                                    presetValues: [1, 2, 3, 4, 5],
                                                    quickSteps: [-1, 1],
                                                    onApply: (v) => setStepLotRepeat(String(Math.max(1, Math.min(20, Math.round(v))))),
                                                })}
                                                className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-8 sm:h-9 cursor-pointer hover:border-cyan-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                            />
                                        </div>

                                        {/* 7A0. Unified Armed Lock (7 -> 10) & Dual-Engine Park & Harvest (v1.17) */}
                                        <div className="space-y-2 col-span-2 rounded-lg border border-indigo-500/35 bg-slate-950/45 p-2.5 sm:p-3">
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="min-w-0">
                                                    <span className="text-xs sm:text-sm font-semibold text-indigo-300 truncate block">
                                                        <span className="sm:hidden">Armed Lock (7→10)</span>
                                                        <span className="hidden sm:inline">ระบบล็อกแบบเดียว: ครบ 7 เตรียมล็อก → ทะลุ 10 ล็อกฝั่งตรงข้าม</span>
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={enableArmedLock ? 'default' : 'outline'}
                                                    onClick={() => setEnableArmedLock((v) => !v)}
                                                    className="h-6 sm:h-7 px-2 text-[10px] sm:text-xs shrink-0 font-mono"
                                                >
                                                    <span className="sm:hidden">{enableArmedLock ? 'ON' : 'OFF'}</span>
                                                    <span className="hidden sm:inline">{enableArmedLock ? 'เปิดใช้งาน (ON)' : 'ปิดใช้งาน (OFF)'}</span>
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                                                <div>
                                                    <Label className="text-[11px] text-muted-foreground truncate block mb-1">เตรียมล็อกเมื่อครบ (ไม้/ฝั่ง)</Label>
                                                    <Input
                                                        readOnly
                                                        disabled={!enableArmedLock}
                                                        value={armedLockTrigger}
                                                        onClick={() => enableArmedLock && openParamModal({
                                                            title: 'เตรียมล็อกเมื่อครบ (ไม้/ฝั่ง)',
                                                            unit: 'ไม้',
                                                            currentVal: parseInt(armedLockTrigger, 10) || 7,
                                                            step: 1,
                                                            presetValues: [5, 6, 7, 8, 9, 10, 12],
                                                            quickSteps: [-2, -1, 1, 2],
                                                            onApply: (v) => setArmedLockTrigger(String(Math.max(1, Math.min(50, Math.round(v))))),
                                                        })}
                                                        className="font-mono bg-slate-950/80 border-slate-800 text-indigo-200 h-8 sm:h-9 cursor-pointer text-xs font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[11px] text-muted-foreground truncate block mb-1">ล็อกฝั่งตรงข้ามเมื่อทะลุ (ไม้)</Label>
                                                    <Input
                                                        readOnly
                                                        disabled={!enableArmedLock}
                                                        value={lockOppositeAt}
                                                        onClick={() => enableArmedLock && openParamModal({
                                                            title: 'ล็อกฝั่งตรงข้ามเมื่อฝั่งนำถึง (ไม้)',
                                                            unit: 'ไม้',
                                                            currentVal: parseInt(lockOppositeAt, 10) || 10,
                                                            step: 1,
                                                            presetValues: [8, 9, 10, 11, 12, 14, 16],
                                                            quickSteps: [-2, -1, 1, 2],
                                                            onApply: (v) => setLockOppositeAt(String(Math.max(parseInt(armedLockTrigger, 10) || 7, Math.min(100, Math.round(v))))),
                                                        })}
                                                        className="font-mono bg-slate-950/80 border-slate-800 text-indigo-200 h-8 sm:h-9 cursor-pointer text-xs font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[11px] text-muted-foreground truncate block mb-1">
                                                        <span className="sm:hidden">จำกัดสูงสุด/ฝั่ง (0=ไม่จำกัด)</span>
                                                        <span className="hidden sm:inline">เพดานสูงสุดต่อฝั่ง (0=ไม่จำกัด)</span>
                                                    </Label>
                                                    <Input
                                                        readOnly
                                                        value={maxOrdersPerSide}
                                                        onClick={() => openParamModal({
                                                            title: 'เพดานไม้สูงสุดต่อฝั่ง (MAX/SIDE)',
                                                            unit: 'ไม้',
                                                            currentVal: parseInt(maxOrdersPerSide, 10) || 0,
                                                            step: 1,
                                                            presetValues: [0, 15, 18, 20, 22, 24, 26, 28, 30],
                                                            quickSteps: [-2, -1, 1, 2],
                                                            onApply: (v) => setMaxOrdersPerSide(String(Math.max(0, Math.min(100, Math.round(v))))),
                                                        })}
                                                        className="font-mono bg-slate-950/80 border-slate-800 text-sky-200 h-8 sm:h-9 cursor-pointer hover:border-sky-500/50 select-none text-center sm:text-left font-bold text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 9. Auto Hedge & 3-Mode Unhedge Protection Box */}
                                        <div className="space-y-2.5 col-span-2 rounded-lg border border-emerald-500/30 bg-slate-950/50 p-2.5 sm:p-3">
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="min-w-0">
                                                    <span className="text-xs sm:text-sm font-semibold text-emerald-300 truncate block">
                                                        <span className="sm:hidden">Auto Hedge &amp; Unhedge (DD%)</span>
                                                        <span className="hidden sm:inline">ระบบ Auto Hedge &amp; ปลด Hedge 3 แนวทาง (% DD ของพอร์ต)</span>
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={enableAutoHedge ? 'default' : 'outline'}
                                                    onClick={() => setEnableAutoHedge((v) => !v)}
                                                    className="h-6 sm:h-7 px-2 text-[10px] sm:text-xs shrink-0 font-mono"
                                                >
                                                    <span className="sm:hidden">{enableAutoHedge ? 'ON' : 'OFF'}</span>
                                                    <span className="hidden sm:inline">{enableAutoHedge ? 'เปิดใช้งาน (ON)' : 'ปิดใช้งาน (OFF)'}</span>
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <div>
                                                    <Label className="text-[11px] text-muted-foreground truncate block mb-1">
                                                        <span className="sm:hidden">เข้า Hedge ที่ DD (%)</span>
                                                        <span className="hidden sm:inline">เข้า Hedge เมื่อติดลบถึง (% ของ Balance)</span>
                                                    </Label>
                                                    <Input
                                                        readOnly
                                                        disabled={!enableAutoHedge}
                                                        value={hedgeDDPercent}
                                                        onClick={() => enableAutoHedge && openParamModal({
                                                            title: 'เข้า HEDGE ที่ DD (%)',
                                                            unit: '%',
                                                            currentVal: parseFloat(hedgeDDPercent) || 20,
                                                            step: 1,
                                                            presetValues: [5, 10, 15, 20, 25, 30, 40, 50, 60, 70],
                                                            quickSteps: [-5, -1, 1, 5],
                                                            onApply: (v) => setHedgeDDPercent(String(Math.max(1, Math.min(95, Math.round(v * 10) / 10)))),
                                                        })}
                                                        className="font-mono bg-slate-950/80 border-slate-800 text-emerald-200 h-8 sm:h-9 cursor-pointer hover:border-emerald-500/50 select-none text-center sm:text-left font-bold text-xs sm:text-sm"
                                                    />
                                                </div>

                                                <div className="flex flex-col justify-end">
                                                    <div className="flex items-center justify-between gap-1 rounded border border-slate-800/80 bg-slate-900/40 px-2 h-8 sm:h-9">
                                                        <span className="text-[10px] sm:text-[11px] text-slate-300 truncate">C: ตัดไม้ดอยทีละคู่</span>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant={enableHedgeOffset ? 'default' : 'outline'}
                                                            disabled={!enableAutoHedge}
                                                            onClick={() => setEnableHedgeOffset((v) => !v)}
                                                            className="h-5 sm:h-6 px-1.5 text-[10px] font-mono shrink-0"
                                                        >
                                                            {enableHedgeOffset ? 'ON' : 'OFF'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mode A: Trailing Lock */}
                                            <div className="rounded border border-slate-800/80 bg-slate-900/30 p-2 space-y-1.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-medium text-cyan-300 truncate">A: Trailing Lock บนกำไรไม้ Hedge</span>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={enableHedgeTrailing ? 'default' : 'outline'}
                                                        disabled={!enableAutoHedge}
                                                        onClick={() => setEnableHedgeTrailing((v) => !v)}
                                                        className="h-5 sm:h-6 px-2 text-[10px] font-mono shrink-0"
                                                    >
                                                        {enableHedgeTrailing ? 'ON' : 'OFF'}
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground block mb-0.5">เริ่ม Trail (Points)</Label>
                                                        <Input
                                                            readOnly
                                                            disabled={!enableAutoHedge || !enableHedgeTrailing}
                                                            value={hedgeTrailStartPts}
                                                            onClick={() => enableAutoHedge && enableHedgeTrailing && openParamModal({
                                                                title: 'เริ่ม TRAILING HEDGE (POINTS)',
                                                                unit: 'pt',
                                                                currentVal: parseInt(hedgeTrailStartPts, 10) || 300,
                                                                step: 50,
                                                                presetValues: [100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000],
                                                                quickSteps: [-100, -50, 50, 100],
                                                                onApply: (v) => setHedgeTrailStartPts(String(Math.max(10, Math.round(v)))),
                                                            })}
                                                            className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-7 sm:h-8 cursor-pointer text-xs font-bold"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground block mb-0.5">ระยะ Trail Step (Points)</Label>
                                                        <Input
                                                            readOnly
                                                            disabled={!enableAutoHedge || !enableHedgeTrailing}
                                                            value={hedgeTrailStepPts}
                                                            onClick={() => enableAutoHedge && enableHedgeTrailing && openParamModal({
                                                                title: 'ระยะ TRAIL STEP (POINTS)',
                                                                unit: 'pt',
                                                                currentVal: parseInt(hedgeTrailStepPts, 10) || 150,
                                                                step: 25,
                                                                presetValues: [50, 100, 150, 200, 250, 300, 400, 500],
                                                                quickSteps: [-50, -25, 25, 50],
                                                                onApply: (v) => setHedgeTrailStepPts(String(Math.max(10, Math.round(v)))),
                                                            })}
                                                            className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-7 sm:h-8 cursor-pointer text-xs font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mode B: Partial Unhedge + Re-Hedge Guard */}
                                            <div className="rounded border border-slate-800/80 bg-slate-900/30 p-2 space-y-1.5">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-medium text-amber-300 truncate">B: ทยอยปลดเมื่อเด้ง + Re-Hedge Guard</span>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant={enableHedgePartial ? 'default' : 'outline'}
                                                        disabled={!enableAutoHedge}
                                                        onClick={() => setEnableHedgePartial((v) => !v)}
                                                        className="h-5 sm:h-6 px-2 text-[10px] font-mono shrink-0"
                                                    >
                                                        {enableHedgePartial ? 'ON' : 'OFF'}
                                                    </Button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground block mb-0.5">สัดส่วนปลด (%)</Label>
                                                        <Input
                                                            readOnly
                                                            disabled={!enableAutoHedge || !enableHedgePartial}
                                                            value={hedgePartialPct}
                                                            onClick={() => enableAutoHedge && enableHedgePartial && openParamModal({
                                                                title: 'สัดส่วนปลด HEDGE (%)',
                                                                unit: '%',
                                                                currentVal: parseFloat(hedgePartialPct) || 50,
                                                                step: 10,
                                                                presetValues: [20, 25, 30, 40, 50, 60, 75, 100],
                                                                quickSteps: [-25, -10, 10, 25],
                                                                onApply: (v) => setHedgePartialPct(String(Math.max(10, Math.min(100, Math.round(v))))),
                                                            })}
                                                            className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-7 sm:h-8 cursor-pointer text-xs font-bold"
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[10px] text-muted-foreground block mb-0.5">ระยะเด้งยืนยัน (Points)</Label>
                                                        <Input
                                                            readOnly
                                                            disabled={!enableAutoHedge || !enableHedgePartial}
                                                            value={hedgeReboundPts}
                                                            onClick={() => enableAutoHedge && enableHedgePartial && openParamModal({
                                                                title: 'ระยะเด้งยืนยันปลด HEDGE (POINTS)',
                                                                unit: 'pt',
                                                                currentVal: parseInt(hedgeReboundPts, 10) || 250,
                                                                step: 50,
                                                                presetValues: [100, 150, 200, 250, 300, 400, 500, 750, 1000],
                                                                quickSteps: [-100, -50, 50, 100],
                                                                onApply: (v) => setHedgeReboundPts(String(Math.max(10, Math.round(v)))),
                                                            })}
                                                            className="font-mono bg-slate-950/80 border-slate-800 text-cyan-200 h-7 sm:h-8 cursor-pointer text-xs font-bold"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Modular What-If Simulator (easy to move/remove) */}
                                    <FreezeWhatIfSimulator
                                        currency={cur}
                                        balance={balanceVal}
                                        firstDistance={parseInt(firstDistance, 10) || 100}
                                        spacing={parseInt(spacing, 10) || 100}
                                        initialLot={parseFloat(initialLot) || 0.01}
                                        lotIncrement={parseFloat(lotIncrement) || 0.01}
                                        stepLotRepeat={parseInt(stepLotRepeat, 10) || 2}
                                        hedgeDDPercent={parseFloat(hedgeDDPercent) || 20}
                                    />

                                    {eaState?.active_config && (
                                        <div className="p-2 sm:p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] sm:text-xs font-mono text-slate-400 whitespace-nowrap overflow-x-auto">
                                            EA Active: Dist={eaState.active_config.first_distance}pt | Spacing={eaState.active_config.spacing}pt | Pend={eaState.active_config.pending_per_side} | Lot={eaState.active_config.initial_lot}+{eaState.active_config.lot_increment} | TP={eaState.active_config.target_profit}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full gap-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs h-9 shadow-md"
                                        disabled={sending}
                                    >
                                        {sending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        <span className="sm:hidden">UPLOAD &amp; SYNC</span>
                                        <span className="hidden sm:inline">UPLOAD &amp; SYNC PARAMS</span>
                                    </Button>
                                </form>
                            </div>
                        )}

                        {/* Collapsible Panel 3: Exit Planner */}
                        <FreezeExitPlanner
                            inline
                            open={!isWaitingFreshData && activeDrawer === 'planner'}
                            onOpenChange={(open) => setActiveDrawer(open ? 'planner' : null)}
                            symbol={eaState?.symbol || 'XAUUSD'}
                            currency={cur}
                            balance={balanceVal}
                            cyclePnl={liveCyclePnl}
                            openBuy={eaState?.open_buy ?? 0}
                            openSell={eaState?.open_sell ?? 0}
                            frozenSide={eaState?.frozen_side}
                            spacingPoints={eaState?.active_config?.spacing ?? (parseInt(spacing, 10) || 100)}
                            initialLot={eaState?.active_config?.initial_lot ?? (parseFloat(initialLot) || 0.01)}
                            lotIncrement={eaState?.active_config?.lot_increment ?? (parseFloat(lotIncrement) || 0.01)}
                            stepLotRepeat={eaState?.active_config?.step_lot_repeat ?? (parseInt(stepLotRepeat, 10) || 2)}
                            currentTp={activeTp}
                            currentSl={activeFreezeSl}
                            enableAutoHedge={activeAutoHedgeEnabled}
                            currentHedgeDdPct={activeHedgeDdPct}
                            chart={eaState?.chart}
                            sending={sending}
                            onApply={(newTp, newSl, newHedgeDdPct) => {
                                const payload: Record<string, any> = {
                                    target_profit: newTp,
                                    freeze_stop_loss: newSl,
                                    is_exit_override: true,
                                    close_all: false,
                                };
                                if (newHedgeDdPct !== undefined) {
                                    payload.hedge_dd_percent = newHedgeDdPct;
                                }
                                sendCommand(
                                    payload,
                                    `อัปเดตแผนปิดรอบนี้แล้ว: TP = ${newTp} ${cur} | Freeze SL = ${newSl < 0 ? `${newSl} ${cur}` : 'ปิด'}${newHedgeDdPct !== undefined ? ` | Hedge = -${newHedgeDdPct}%` : ''} (จบรอบนี้จะรีเซ็ตกลับเป็นค่า Setting อัตโนมัติ)`
                                );
                            }}
                        />
                    </div>

                    {/* Unified 5-Part Tactical Overview Card */}
                    <SmartTacticalOverview
                        port={activePort}
                        symbol={eaState?.symbol || 'XAUUSD'}
                        currency={cur}
                        openBuy={eaState?.open_buy ?? 0}
                        openSell={eaState?.open_sell ?? 0}
                        cap={activeCap}
                        frozenSide={eaState?.frozen_side}
                        protectionFrozen={Boolean(eaState?.protection_frozen || eaState?.trade_status?.startsWith('FROZEN_'))}
                        liveCyclePnl={liveCyclePnl}
                        targetProfit={activeTp}
                        freezeStopLoss={activeFreezeSl}
                        spacingPoints={eaState?.active_config?.spacing ?? (parseInt(spacing, 10) || 100)}
                        initialLot={eaState?.active_config?.initial_lot ?? (parseFloat(initialLot) || 0.01)}
                        lotIncrement={eaState?.active_config?.lot_increment ?? (parseFloat(lotIncrement) || 0.01)}
                        chart={eaState?.chart}
                        voteCouncil={eaState?.vote_council}
                        roundHistory={eaState?.round_history}
                        isWaitingFreshData={isWaitingFreshData}
                        lastPing={eaState?.last_ping}
                    />

                    {/* Always-Visible Compact Rectangular Card: Freeze Status + Vote Council (Expandable on Click) */}
                    {(() => {
                        const isFrozenNow = Boolean(
                            eaState?.trade_status === 'FROZEN_BUY' ||
                            eaState?.trade_status === 'FROZEN_SELL' ||
                            eaState?.trade_status === 'FROZEN_7X7' ||
                            eaState?.protection_frozen
                        );
                        const vc = eaState?.vote_council;
                        const vcEnabled = Boolean(vc && vc.enabled);
                        const voters = vc?.voters || [];
                        const activeEntryVoters = voters.filter((v) => v.weight > 0);
                        const displayEntryVoters = activeEntryVoters.length > 0 ? activeEntryVoters : voters;
                        const tc = vc?.trend_council;
                        const tcVoters = tc?.voters || [];
                        const frozenDir = eaState?.frozen_side === 'BUY' || eaState?.trade_status === 'FROZEN_BUY'
                            ? 'BUY'
                            : eaState?.frozen_side === 'SELL' || eaState?.trade_status === 'FROZEN_SELL'
                            ? 'SELL'
                            : 'NONE';
                        const trendHelpsRescue = isFrozenNow && tc && tc.yes_w >= 3 && tc.direction === frozenDir;
                        const trendDragsFreeze = isFrozenNow && tc && tc.yes_w >= 3 && tc.direction !== 'NONE' && tc.direction !== frozenDir;
                        const scorePct = vc?.score_pct ?? 0;
                        const passPct = vc?.pass_pct ?? 70;
                        const passedVote = vcEnabled && scorePct >= passPct;

                        return (
                            <div
                                className={cn(
                                    'rounded-xl border transition-colors',
                                    isFrozenNow
                                        ? 'border-rose-500/50 bg-rose-500/10'
                                        : 'border-cyan-500/30 bg-slate-900/60'
                                )}
                            >
                                {/* Clickable Rectangular Summary Header */}
                                <button
                                    type="button"
                                    onClick={() => setIsFreezeVoteExpanded((prev) => !prev)}
                                    className="w-full text-left p-2.5 sm:p-3 flex flex-col gap-2 cursor-pointer hover:bg-white/[0.02] rounded-xl transition-colors"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {isFrozenNow ? (
                                                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                            )}
                                            <span
                                                className={cn(
                                                    'font-bold text-xs sm:text-sm truncate',
                                                    isFrozenNow ? 'text-rose-300' : 'text-emerald-300'
                                                )}
                                            >
                                                {isFrozenNow
                                                    ? eaState?.frozen_side === 'BUY' || eaState?.trade_status === 'FROZEN_BUY'
                                                        ? `One-Side Freeze: ฝั่ง Buy หยุด • Sell ออกต่อ`
                                                        : eaState?.frozen_side === 'SELL' || eaState?.trade_status === 'FROZEN_SELL'
                                                        ? `One-Side Freeze: ฝั่ง Sell หยุด • Buy ออกต่อ`
                                                        : `สถานะ Freeze (${activeCap}x${activeCap}) ทำงาน`
                                                    : `สถานะปกติ (Armed ${eaState?.active_config?.armed_lock_trigger ?? 7}->${eaState?.active_config?.lock_opposite_at ?? 10})`}
                                            </span>
                                            <Badge
                                                variant={isFrozenNow ? 'destructive' : 'outline'}
                                                className={cn(
                                                    'font-mono text-[10px] py-0 shrink-0',
                                                    !isFrozenNow && 'border-slate-600 text-slate-300'
                                                )}
                                            >
                                                B:{eaState?.open_buy ?? 0} / S:{eaState?.open_sell ?? 0}
                                            </Badge>
                                            {trendHelpsRescue && (
                                                <Badge variant="outline" className="border-emerald-400/60 bg-emerald-500/20 text-emerald-200 text-[10px] py-0 shrink-0">
                                                    เทรนหนุนแก้พอร์ต
                                                </Badge>
                                            )}
                                            {trendDragsFreeze && (
                                                <Badge variant="outline" className="border-amber-400/60 bg-amber-500/20 text-amber-200 text-[10px] py-0 shrink-0">
                                                    เทรนยังลากต่อ (ดูจังหวะ TP/SL)
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {vcEnabled && vc ? (
                                                <>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'font-mono text-[10px] py-0',
                                                            vc.mode === 'BET_ACTIVE'
                                                                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                                                                : vc.mode === 'ARMED'
                                                                ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                                                                : 'border-slate-600 bg-slate-800/70 text-slate-300'
                                                        )}
                                                    >
                                                        {vc.mode === 'BET_ACTIVE'
                                                            ? `BET ${vc.direction} ${vc.bet_lot.toFixed(2)}`
                                                            : vc.mode === 'ARMED'
                                                            ? `ARMED ${vc.direction}`
                                                            : vc.mode === 'SL_DONE'
                                                            ? `MAX ${vc.bets_opened}/${vc.max_bets}`
                                                            : 'WAIT'}
                                                    </Badge>
                                                    <span
                                                        className={cn(
                                                            'font-mono font-extrabold text-[11px] px-2 py-0.5 rounded-md border',
                                                            passedVote
                                                                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                                                                : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                                                        )}
                                                    >
                                                        {vc.yes_w}/{vc.total_w} ({scorePct.toFixed(0)}% / {passPct.toFixed(0)}%)
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-mono text-slate-400">
                                                    Vote Council (v2.01+)
                                                </span>
                                            )}
                                            <ChevronDown
                                                className={cn(
                                                    'w-4 h-4 text-slate-400 transition-transform duration-200',
                                                    isFreezeVoteExpanded && 'rotate-180 text-cyan-300'
                                                )}
                                            />
                                        </div>
                                    </div>

                                    {/* Always-Visible Compact Symbol Row: Live Trend Bias (4) + Entry Vote (3) + Freeze Approval */}
                                    {vcEnabled && vc && voters.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {/* Live 4-Voter Trend Bias Pill */}
                                            {tc ? (
                                                <span
                                                    title={`เทรนหลัก 4 ตัว (HL15, HL5, EMA5, MOM): ${tc.direction} ${tc.yes_w}/${tc.total_w}`}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] font-extrabold',
                                                        tc.direction === 'BUY'
                                                            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                                                            : tc.direction === 'SELL'
                                                            ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                                                            : 'border-slate-600 bg-slate-800/70 text-slate-300'
                                                    )}
                                                >
                                                    <span className="opacity-75 font-normal">เทรน:</span>
                                                    {tc.direction === 'BUY'
                                                        ? `▲ BUY ${tc.yes_w}/${tc.total_w}`
                                                        : tc.direction === 'SELL'
                                                        ? `▼ SELL ${tc.yes_w}/${tc.total_w}`
                                                        : `• NEUTRAL`}
                                                </span>
                                            ) : (
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] font-extrabold',
                                                        vc.direction === 'BUY'
                                                            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                                                            : vc.direction === 'SELL'
                                                            ? 'border-rose-400/60 bg-rose-500/20 text-rose-200'
                                                            : 'border-slate-600 bg-slate-800/70 text-slate-300'
                                                    )}
                                                >
                                                    {vc.direction === 'BUY'
                                                        ? '▲ BUY'
                                                        : vc.direction === 'SELL'
                                                        ? '▼ SELL'
                                                        : '• NEUTRAL'}
                                                </span>
                                            )}
                                            <span className="text-slate-600 text-xs">|</span>
                                            <span className="text-[10px] font-mono text-slate-400">
                                                เปิดไม้ ({vc.direction}):
                                            </span>
                                            {displayEntryVoters.map((v) => {
                                                const isOff = v.vote === 'OFF' || v.weight <= 0;
                                                const isYes = v.vote === 'YES';
                                                const isNo = v.vote === 'NO';
                                                return (
                                                    <span
                                                        key={v.id}
                                                        title={`${v.label} (w${v.weight}): ${v.vote}`}
                                                        className={cn(
                                                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] font-bold',
                                                            isOff
                                                                ? 'border-slate-700/70 bg-slate-900/60 text-slate-500'
                                                                : isYes
                                                                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                                                                : isNo
                                                                ? 'border-rose-500/45 bg-rose-500/15 text-rose-300'
                                                                : 'border-amber-500/45 bg-amber-500/15 text-amber-300'
                                                        )}
                                                    >
                                                        {isOff ? (
                                                            <span className="text-slate-500 font-black">-</span>
                                                        ) : isYes ? (
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                                        ) : isNo ? (
                                                            <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                                        ) : (
                                                            <Activity className="w-3 h-3 text-amber-400 shrink-0" />
                                                        )}
                                                        <span>{v.id}</span>
                                                    </span>
                                                );
                                            })}
                                            {isFrozenNow && (
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-mono text-[10px] font-bold',
                                                        vc.mode === 'BET_ACTIVE'
                                                            ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                                                            : vc.approved
                                                            ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                                                            : vc.reached_trigger
                                                            ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                                                            : 'border-slate-600/70 bg-slate-800/70 text-slate-300'
                                                    )}
                                                >
                                                    {vc.mode === 'BET_ACTIVE'
                                                        ? `ออกไม้ช่วยแล้ว @ ${vc.entry_px > 0 ? vc.entry_px.toFixed(eaState?.chart?.digits ?? 2) : '-'}`
                                                        : vc.approved
                                                        ? `Vote อนุญาตออกไม้ช่วยแล้ว @ ${vc.trigger_px > 0 ? vc.trigger_px.toFixed(eaState?.chart?.digits ?? 2) : '-'}`
                                                        : vc.reached_trigger
                                                        ? `ถึงจุด Mirror แล้ว • รอ Vote`
                                                        : `รอถึง Mirror @ ${vc.trigger_px > 0 ? vc.trigger_px.toFixed(eaState?.chart?.digits ?? 2) : '-'}`}
                                                </span>
                                            )}
                                            <span className="ml-auto text-[10px] text-slate-400 hidden sm:inline">
                                                {isFreezeVoteExpanded ? 'คลิกเพื่อย่อ' : 'คลิกดูรายละเอียด'}
                                            </span>
                                        </div>
                                    )}
                                </button>

                                {/* Expandable Details Panel */}
                                {isFreezeVoteExpanded && (
                                    <div className="px-2.5 sm:px-3 pb-3 pt-2 border-t border-slate-700/50 space-y-2.5">
                                        {/* Detailed Vote Council Grid */}
                                        {vcEnabled && vc ? (
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                                                    <span className="text-cyan-200 font-bold">
                                                        รายละเอียดสภา Vote Council (เกณฑ์ผ่าน {passPct.toFixed(0)}%)
                                                    </span>
                                                    <span className="text-slate-300">
                                                        คะแนนรวม:{' '}
                                                        <strong className={passedVote ? 'text-emerald-300' : 'text-cyan-300'}>
                                                            {vc.yes_w} / {vc.total_w} ({scorePct.toFixed(0)}%)
                                                        </strong>
                                                    </span>
                                                </div>

                                                <div className="relative h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            'h-full transition-all duration-300',
                                                            passedVote ? 'bg-emerald-400' : 'bg-cyan-400'
                                                        )}
                                                        style={{ width: `${Math.min(100, Math.max(0, scorePct))}%` }}
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                                    {voters.map((v) => {
                                                        const isYes = v.vote === 'YES';
                                                        const isNo = v.vote === 'NO';
                                                        const isOff = v.vote === 'OFF' || v.weight <= 0;
                                                        return (
                                                            <div
                                                                key={v.id}
                                                                className={cn(
                                                                    'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1.5 text-[11px]',
                                                                    isOff
                                                                        ? 'border-slate-700/60 bg-slate-900/50 text-slate-400'
                                                                        : isYes
                                                                        ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200'
                                                                        : isNo
                                                                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                                                                        : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                                                                )}
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="font-mono font-bold leading-tight flex items-center gap-1">
                                                                        {isOff ? (
                                                                            <span className="text-slate-500">-</span>
                                                                        ) : isYes ? (
                                                                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                                                        ) : isNo ? (
                                                                            <XCircle className="w-3 h-3 text-rose-400 shrink-0" />
                                                                        ) : (
                                                                            <Activity className="w-3 h-3 text-amber-400 shrink-0" />
                                                                        )}
                                                                        <span>{v.id}</span>
                                                                        <span className="text-[10px] opacity-75">w{v.weight}</span>
                                                                    </div>
                                                                    <div className="text-[10px] opacity-80 truncate">{v.label}</div>
                                                                </div>
                                                                <span
                                                                    className={cn(
                                                                        'font-mono font-extrabold text-[10px] px-1.5 py-0.5 rounded shrink-0',
                                                                        isOff
                                                                            ? 'bg-slate-800 text-slate-400'
                                                                            : isYes
                                                                            ? 'bg-emerald-500/30 text-emerald-200'
                                                                            : isNo
                                                                            ? 'bg-rose-500/25 text-rose-200'
                                                                            : 'bg-amber-500/25 text-amber-200'
                                                                    )}
                                                                >
                                                                    {v.vote}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-slate-300 pt-0.5">
                                                    {vc.mirror_px > 0 && (
                                                        <span>Mirror: <strong className="text-cyan-300">{vc.mirror_px.toFixed(eaState?.chart?.digits ?? 2)}</strong></span>
                                                    )}
                                                    {vc.trigger_px > 0 && (
                                                        <span>Trigger: <strong className="text-amber-300">{vc.trigger_px.toFixed(eaState?.chart?.digits ?? 2)}</strong></span>
                                                    )}
                                                    {vc.entry_px > 0 && vc.mode === 'BET_ACTIVE' && (
                                                        <span>Entry: <strong className="text-emerald-300">{vc.entry_px.toFixed(eaState?.chart?.digits ?? 2)}</strong></span>
                                                    )}
                                                    {vc.stop_px > 0 && vc.mode === 'BET_ACTIVE' && (
                                                        <span>Smart SL: <strong className="text-rose-300">{vc.stop_px.toFixed(eaState?.chart?.digits ?? 2)}</strong></span>
                                                    )}
                                                </div>

                                                {/* Trend Council (4 Trend Voters / BE Hold) */}
                                                {tc && tcVoters.length > 0 && (
                                                    <div className="pt-2 border-t border-slate-700/50 space-y-1.5">
                                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                                                            <span className="text-slate-200 font-bold">
                                                                ตัววัดเทรนหลัก / BE Hold (4 ตัว: {tc.direction})
                                                            </span>
                                                            <span className="text-slate-300">
                                                                คะแนนเทรน:{' '}
                                                                <strong className={tc.yes_w >= 3 ? 'text-emerald-300' : 'text-slate-300'}>
                                                                    {tc.yes_w} / {tc.total_w} ({Math.round((tc.yes_w / Math.max(1, tc.total_w)) * 100)}%)
                                                                </strong>
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                                            {tcVoters.map((tv) => {
                                                                const isYes = tv.vote === 'YES';
                                                                const isNo = tv.vote === 'NO';
                                                                return (
                                                                    <div
                                                                        key={tv.id}
                                                                        className={cn(
                                                                            'flex items-center justify-between gap-1.5 rounded-lg border px-2 py-1 text-[11px]',
                                                                            isYes
                                                                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                                                                : isNo
                                                                                ? 'border-rose-500/35 bg-rose-500/10 text-rose-200'
                                                                                : 'border-slate-700 bg-slate-900/50 text-slate-300'
                                                                        )}
                                                                    >
                                                                        <div className="min-w-0">
                                                                            <div className="font-mono font-bold leading-tight">
                                                                                {tv.id} <span className="text-[10px] opacity-70">w{tv.weight}</span>
                                                                            </div>
                                                                            <div className="text-[10px] opacity-75 truncate">{tv.label}</div>
                                                                        </div>
                                                                        <span className="font-mono font-bold text-[10px] shrink-0">{tv.vote}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-slate-400">
                                                รอรับข้อมูลสภา Vote Council จาก EA (รองรับตั้งแต่เวอร์ชัน v2.01 ขึ้นไป)
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Custom Target Profit Dialog with Interactive Scroll Wheel */}
                    <Dialog open={customTpModalOpen} onOpenChange={setCustomTpModalOpen}>
                        <DialogContent className="bg-[#0b0f19] border border-cyan-500/30 text-slate-100 max-w-sm sm:max-w-md p-5 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.15)]">
                            <DialogHeader className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Target className="w-5 h-5 text-cyan-400" />
                                    <DialogTitle className="text-base sm:text-lg font-bold font-mono text-cyan-300">
                                        ตั้งเป้า TP ปิดรวบเอง (Custom TP)
                                    </DialogTitle>
                                </div>
                                <DialogDescription className="text-xs text-slate-400">
                                    เลือกเป้าหมายกำไร/ตัดขาดทุนด่วน หรือหมุนวงล้อปรับตัวเลขได้ทันทีโดยไม่ต้องพิมพ์
                                </DialogDescription>
                            </DialogHeader>

                            {/* Prominent Display Box for selected value */}
                            <div className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 shadow-inner">
                                <span className="text-[10px] font-mono text-cyan-400/90 uppercase tracking-widest mb-0.5">
                                    Target Profit ที่เลือก
                                </span>
                                <div className="flex items-baseline gap-2 font-mono">
                                    <span
                                        className={cn(
                                            "text-3xl sm:text-4xl font-extrabold tracking-tight",
                                            customTpVal >= 0 ? "text-emerald-400" : "text-rose-400"
                                        )}
                                    >
                                        {customTpVal > 0 ? `+${customTpVal}` : customTpVal}
                                    </span>
                                    <span className="text-slate-400 text-sm font-semibold">{cur}</span>
                                </div>
                                {balanceVal > 0 ? (
                                    <span className="text-[10px] text-slate-400 mt-1 font-mono">
                                        ≈ {((customTpVal / balanceVal) * 100).toFixed(1)}% ของ Balance ({balanceVal.toLocaleString()} {cur})
                                    </span>
                                ) : null}
                            </div>

                            {/* Quick Preset Chips */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-mono text-slate-400">เลือกค่าด่วน (ไม่ต้องพิมพ์):</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        {
                                            label: `-1% (${minusOnePct} ${cur})`,
                                            val: minusOnePct,
                                        },
                                        {
                                            label: `-2% (${minusTwoPct} ${cur})`,
                                            val: minusTwoPct,
                                        },
                                        {
                                            label: `DD ปัจจุบัน (${currentDd} ${cur})`,
                                            val: currentDd,
                                        },
                                        {
                                            label: `เท่าทุน (0 ${cur})`,
                                            val: 0,
                                        },
                                    ].map((chip) => (
                                        <Button
                                            key={chip.label}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className={cn(
                                                "h-7 text-[11px] font-mono px-2.5 rounded-lg transition-all",
                                                customTpVal === chip.val
                                                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-200 font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]"
                                                    : "border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300"
                                            )}
                                            onClick={() => setCustomTpVal(chip.val)}
                                        >
                                            {chip.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Scroll Wheel Picker Section */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] font-mono text-slate-400">หมุนวงล้อขึ้น-ลง เพื่อปรับตัวเลข:</span>
                                <TpScrollWheelPicker
                                    value={customTpVal}
                                    onChange={(val) => setCustomTpVal(val)}
                                    currency={cur}
                                />
                            </div>

                            <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                    onClick={() => setCustomTpModalOpen(false)}
                                >
                                    ยกเลิก / ปิด
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={sending}
                                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-4 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                    onClick={handleConfirmCustomTp}
                                >
                                    {sending ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                    ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                    )}
                                    ตกลง (OK) ตั้งค่า
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Waiting for Fresh Data Banner */}
                    {isWaitingFreshData && (
                        <div className="rounded-xl border border-cyan-500/35 bg-cyan-950/25 px-3 py-1.5 flex items-center justify-between gap-2 font-mono text-[11px]">
                            <div className="flex items-center gap-2 text-cyan-100">
                                <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />
                                <span>
                                    {!isOnline
                                        ? 'แสดงค่าล่าสุดก่อนออฟไลน์ — กำลังรอสัญญาณจาก MT5...'
                                        : 'กำลังปลุก EA เข้าโหมด Live (60s → 15s) — แสดงตัวเลขล่าสุดระหว่างรอซิงค์'}
                                </span>
                            </div>
                            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[9.5px] shrink-0 py-0">
                                WAKING UP
                            </Badge>
                        </div>
                    )}

                    {/* Live M1 Candlestick Chart + Model A + Cycle History at the very bottom */}
                    <div className="space-y-1.5 sm:space-y-2 transition-all duration-500">
                        <SmartVortexChart
                            symbol={eaState?.symbol || 'XAUUSD'}
                            currency={cur}
                            anchor={eaState?.anchor || 0}
                            targetProfit={eaState?.active_config?.target_profit ?? (parseFloat(targetProfit) || 20)}
                            frozenSide={eaState?.frozen_side}
                            isOnline={isOnline && !isWaitingFreshData}
                            isScanning={isWaitingFreshData}
                            openBuy={eaState?.open_buy ?? 0}
                            openSell={eaState?.open_sell ?? 0}
                            pendBuy={eaState?.pending_buy ?? 0}
                            pendSell={eaState?.pending_sell ?? 0}
                            cap={activeCap}
                            liveCyclePnl={liveCyclePnl}
                            balance={balanceVal}
                            cyclePnl={eaState?.cycle_pnl || 0}
                            chart={eaState?.chart}
                        />

                        {/* Model A: Unified PnL Stack Vector Axis */}
                        <PnlVectorVisualizer
                            mode="modelA"
                            currency={cur}
                            cyclePnl={eaState?.cycle_pnl || 0}
                            targetProfit={activeTp}
                            pnlJitter={pnlJitter}
                            isOnline={isOnline && !isWaitingFreshData}
                            isScanning={isWaitingFreshData}
                            chart={eaState?.chart}
                        />

                        {/* Modular Freeze DD Risk Radar (easy to move/remove) */}
                        <FreezeRiskRadarCard
                            symbol={eaState?.symbol || 'XAUUSD'}
                            currency={cur}
                            balance={balanceVal}
                            cyclePnl={liveCyclePnl}
                            openBuy={eaState?.open_buy ?? 0}
                            openSell={eaState?.open_sell ?? 0}
                            frozenSide={eaState?.frozen_side}
                            armedLockTrigger={eaState?.active_config?.armed_lock_trigger ?? (parseInt(armedLockTrigger, 10) || 7)}
                            lockOppositeAt={eaState?.active_config?.lock_opposite_at ?? (parseInt(lockOppositeAt, 10) || 10)}
                            targetProfit={activeTp}
                            freezeStopLoss={eaState?.active_config?.freeze_stop_loss ?? (parseFloat(freezeStopLoss) || 0)}
                            hedgeDDPercent={eaState?.active_config?.hedge_dd_percent ?? (parseFloat(hedgeDDPercent) || 20)}
                            enableAutoHedge={eaState?.active_config?.enable_auto_hedge ?? enableAutoHedge}
                            initialLot={eaState?.active_config?.initial_lot ?? (parseFloat(initialLot) || 0.01)}
                            lotIncrement={eaState?.active_config?.lot_increment ?? (parseFloat(lotIncrement) || 0.01)}
                            stepLotRepeat={eaState?.active_config?.step_lot_repeat ?? (parseInt(stepLotRepeat, 10) || 2)}
                            chart={eaState?.chart}
                            isOnline={isOnline && !isWaitingFreshData}
                            isScanning={isWaitingFreshData}
                        />

                        {/* Cycle History Bar moved to the very bottom */}
                        <RoundHistoryBar
                            rounds={eaState?.round_history}
                            currency={cur}
                        />
                    </div>

                    {/* Quick Parameter Adjust Modal (Wheel Picker) */}
                    <Dialog open={Boolean(paramModalConfig)} onOpenChange={(open) => !open && setParamModalConfig(null)}>
                        <DialogContent className="bg-[#0b0f19] border border-cyan-500/30 text-slate-100 max-w-[310px] p-4 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.2)]">
                            <DialogHeader className="space-y-0.5 text-center">
                                <DialogTitle className="text-sm font-bold font-mono text-cyan-300 tracking-wide">
                                    {paramModalConfig?.title}
                                </DialogTitle>
                            </DialogHeader>

                            {/* Clean glowing number display */}
                            <div className="flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-slate-900/90 border border-cyan-500/30 my-0.5 shadow-inner">
                                <div className="flex items-baseline gap-1.5 font-mono">
                                    <span className="text-3xl font-extrabold text-cyan-300 tracking-tight">
                                        {paramModalConfig?.isDecimal ? paramModalValue.toFixed(2) : paramModalValue}
                                    </span>
                                    {paramModalConfig?.unit && (
                                        <span className="text-slate-400 text-xs font-semibold">{paramModalConfig.unit}</span>
                                    )}
                                </div>
                            </div>

                            {/* Scroll Wheel */}
                            {paramModalConfig && (
                                <ParamWheelPicker
                                    value={paramModalValue}
                                    onChange={(val) => setParamModalValue(val)}
                                    values={paramModalConfig.presetValues}
                                    unit={paramModalConfig.unit}
                                    isDecimal={paramModalConfig.isDecimal}
                                />
                            )}

                            {/* Steppers */}
                            {paramModalConfig && (
                                <div className="flex flex-wrap items-center justify-center gap-1 w-full pt-0.5">
                                    {paramModalConfig.quickSteps.map((step) => (
                                        <Button
                                            key={step}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-[11px] font-mono border-slate-700/80 bg-slate-900/60 hover:bg-cyan-950/40 hover:border-cyan-500/50 text-slate-200"
                                            onClick={() => {
                                                const next = paramModalConfig.isDecimal
                                                    ? Math.max(0, Math.round((paramModalValue + step) * 100) / 100)
                                                    : paramModalValue + step;
                                                setParamModalValue(next);
                                            }}
                                        >
                                            {step > 0 ? `+${step}` : step}
                                        </Button>
                                    ))}
                                </div>
                            )}

                            <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2 border-t border-slate-800/80 mt-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs text-slate-400 hover:text-slate-200"
                                    onClick={() => setParamModalConfig(null)}
                                >
                                    ยกเลิก
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-4 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                                    onClick={applyParamModal}
                                >
                                    ตกลง (OK)
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
        </div>
    );
}

export default function SmartEACockpitPage() {
    return (
        <main className="min-h-screen bg-[#040711] text-slate-100">
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center p-12 text-center text-cyan-400 font-mono text-sm">
                    <Loader2 className="w-5 h-5 animate-spin mr-2 inline" /> Loading Smart EA Cockpit...
                </div>
            }>
                <SmartEACockpitContent />
            </Suspense>
        </main>
    );
}
