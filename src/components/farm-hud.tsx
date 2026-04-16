'use client';

import Image from 'next/image';
import { Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── Animated Number: Breathing pulse + Slot machine roll on value change ───
function AnimatedNumber({
    value,
    formatter,
    colorClass,
    className = ''
}: {
    value: number;
    formatter: (v: number) => string;
    colorClass: string;
    className?: string;
}) {
    const [shown, setShown] = useState(value);
    const [incoming, setIncoming] = useState<number | null>(null);
    const [phase, setPhase] = useState<'idle' | 'rolling'>('idle');
    const [goingUp, setGoingUp] = useState(true);
    const t1 = useRef<ReturnType<typeof setTimeout> | null>(null);
    const t2 = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (Math.abs(value - shown) < 0.005) return;
        if (phase === 'rolling') return; // avoid rapid-fire conflicts
        setGoingUp(value > shown);
        setIncoming(value);
        setPhase('rolling');

        t1.current = setTimeout(() => {
            setShown(value);
            setIncoming(null);
        }, 280);
        t2.current = setTimeout(() => setPhase('idle'), 450);

        return () => {
            if (t1.current) clearTimeout(t1.current);
            if (t2.current) clearTimeout(t2.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const outStyle: React.CSSProperties = phase === 'rolling' ? {
        animation: `slotOut${goingUp ? 'Up' : 'Down'} 0.28s ease-in forwards`
    } : {
        animation: 'pnlBreathe 3.5s ease-in-out infinite'
    };

    const inStyle: React.CSSProperties = {
        position: 'absolute', top: 0, left: 0, right: 0,
        animation: `slotIn${goingUp ? 'Up' : 'Down'} 0.28s ease-out forwards`,
    };

    return (
        <span className={`relative inline-block overflow-hidden ${colorClass} ${className}`} style={{ verticalAlign: 'baseline' }}>
            <span style={outStyle}>{formatter(shown)}</span>
            {phase === 'rolling' && incoming !== null && (
                <span style={inStyle}>{formatter(incoming)}</span>
            )}
        </span>
    );
}

type FarmHudProps = {
    portNumber: string;
    balance: number;
    equity: number;
    floatingPnl: number;
    todayProfit: number; // Added for Today Result
    totalStandardLots: number;
    accountType: string;
    assetType: string; // Added assetType
    buyCount: number;
    sellCount: number;
    buyPnl: number;
    sellPnl: number;
    todayClosedLots: number;
    dailyMaxDrawdown: number;
    isShaking?: boolean;
    onClick?: () => void;
};

export default function FarmHud({
    portNumber,
    balance,
    equity,
    floatingPnl,
    todayProfit,
    totalStandardLots,
    accountType,
    assetType, // Added assetType
    buyCount,
    sellCount,
    buyPnl,
    sellPnl,
    todayClosedLots,
    dailyMaxDrawdown,
    isShaking = false,
    onClick,
}: FarmHudProps) {
    const [time, setTime] = useState<Date | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Extract time components for the analog clock
    const seconds = time?.getSeconds() || 0;
    const minutes = time?.getMinutes() || 0;
    const hours = (time?.getHours() || 0) % 12;

    const secondDeg = seconds * 6;
    const minuteDeg = minutes * 6 + seconds * 0.1;
    const hourDeg = hours * 30 + minutes * 0.5;

    const isUSD = accountType?.toUpperCase().trim() === 'USD' || accountType?.toUpperCase().trim() === 'STANDARD';
    const centsValue = isUSD ? todayProfit * 100 : todayProfit;

    let todayHarvestAsset = '/farm/base_farmbox_empty.png';
    if (todayProfit < 0) todayHarvestAsset = '/farm/base_farmbox_lose.png';
    else if (centsValue > 2000) todayHarvestAsset = '/farm/base_farmbox_full.png';
    else if (centsValue > 1000) todayHarvestAsset = '/farm/base_farmbox_mid.png';
    else if (centsValue > 0) todayHarvestAsset = '/farm/base_farmbox_min.png';

    const isUSC = accountType?.toUpperCase().trim() === 'USC' || accountType?.toUpperCase().trim() === 'CENT';
    const currencyPrefix = isUSC ? '' : '$';
    const unitSuffix = isUSC ? ' USC' : ' USD';

    return (
        <>
        <style>{`
            @keyframes pnlBreathe {
                0%, 100% { opacity: 0.65; }
                50% { opacity: 1; }
            }
            @keyframes slotOutUp {
                from { transform: translateY(0); opacity: 1; }
                to   { transform: translateY(-110%); opacity: 0; }
            }
            @keyframes slotInUp {
                from { transform: translateY(110%); opacity: 0; }
                to   { transform: translateY(0); opacity: 1; }
            }
            @keyframes slotOutDown {
                from { transform: translateY(0); opacity: 1; }
                to   { transform: translateY(110%); opacity: 0; }
            }
            @keyframes slotInDown {
                from { transform: translateY(-110%); opacity: 0; }
                to   { transform: translateY(0); opacity: 1; }
            }
        `}</style>
        <div 
            onClick={() => { console.log("HUD Clicked"); if(onClick) onClick(); }}
            className="w-full h-20 sm:h-32 bg-[#16120e] text-[#e8dcb9] z-[100] border-b border-amber-900/40 shadow-[0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden cursor-pointer select-none pointer-events-auto"
        >
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-[#2a1d0f]/50 to-black/60 pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />

            <div className="relative max-w-7xl mx-auto flex items-center h-full px-2 sm:px-4 gap-2 sm:gap-6 py-1 sm:py-4">

                {/* Left: Luxury Analog Clock Motif */}
                <div className="flex flex-shrink-0 w-14 h-14 sm:w-24 sm:h-24 relative flex-col items-center justify-center my-auto mx-1 sm:mx-2">
                    <div className="absolute inset-0 rounded-full border border-[#cfa545]/60 shadow-[0_0_15px_rgba(207,165,69,0.3)] bg-[#110e0b]"></div>
                    <div className="absolute inset-1 sm:inset-2 rounded-full border border-amber-800/50 bg-gradient-to-b from-[#1c1814] to-[#0a0806]">
                        <span className="absolute top-0.5 sm:top-1 left-1/2 -translate-x-1/2 text-[6px] sm:text-[8px] text-[#cfa545]">12</span>
                        <span className="absolute bottom-0.5 sm:bottom-1 left-1/2 -translate-x-1/2 text-[6px] sm:text-[8px] text-[#cfa545]">6</span>
                        {isClient && (
                            <>
                                <div className="absolute top-1/2 left-1/2 w-[1px] h-[30%] bg-amber-200/80 origin-bottom rounded-full" style={{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-[1px] h-[40%] bg-amber-400 origin-bottom rounded-full" style={{ transform: `translate(-50%, -100%) rotate(${minuteDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-[0.5px] h-[45%] bg-red-800/80 origin-bottom" style={{ transform: `translate(-50%, -100%) rotate(${secondDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-1 sm:w-1.5 h-1 sm:h-1.5 bg-[#cfa545] rounded-full -translate-x-1/2 -translate-y-1/2" />
                            </>
                        )}
                    </div>
                </div>

                {/* DIAGNOSTICS CENTER: Buy/Sell Bars + Balance/Equity */}
                <div className="flex-1 flex items-center gap-3 sm:gap-8 min-w-0">
                    
                    {/* Buy/Sell Thermometers (4-bar Row on mobile, Detailed on desktop) */}
                    <div className="hidden sm:flex gap-1.5 sm:gap-5 flex-shrink-0 items-center">
                        {/* BUY GROUP */}
                        <div className="flex flex-col items-center gap-1">
                            {/* Counter at TOP */}
                            <div className="flex items-center gap-1 text-[8px] sm:text-[10px] font-mono font-black text-cyan-400">
                                <span>B</span>
                                <span className="opacity-80">{buyCount}</span>
                            </div>

                            <div className="flex items-end gap-1 sm:gap-1.5 h-12 sm:h-16">
                                {/* Order Count Bar - Scaling relative to max of B/S */}
                                <div className="relative w-1.5 sm:w-2 h-full bg-black/40 rounded-full border border-cyan-500/10 overflow-hidden shadow-inner">
                                    <div 
                                        className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-600 to-cyan-300 transition-all duration-1000 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                                        style={{ height: `${Math.max(5, (buyCount / Math.max(1, buyCount, sellCount)) * 100)}%` }}
                                    />
                                </div>
                                {/* PnL Indicator Line + Scale */}
                                <div className="relative w-2 sm:w-3.5 h-full flex flex-col items-center overflow-visible">
                                    <div className="w-[3px] sm:w-[5px] h-full bg-white/10 rounded-full relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[5px] sm:w-[7px] h-[1.5px] bg-white/50 z-10" />
                                        
                                        <div 
                                            className={`absolute left-0 right-0 transition-all duration-1000 ${buyPnl >= 0 ? 'bg-cyan-400 bottom-1/2 rounded-t-full shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 'bg-red-500 top-1/2 rounded-b-full shadow-[0_0_12px_rgba(239,68,68,0.8)]'}`}
                                            style={{ height: `${Math.min(50, Math.abs((buyPnl / (Math.max(1, balance) * 0.01)) * 50))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* PnL Label at BOTTOM */}
                            <div className={`text-[7px] sm:text-[8px] font-mono font-bold ${buyPnl >= 0 ? 'text-cyan-400/80' : 'text-red-400/80'}`}>
                                <AnimatedNumber
                                    value={buyPnl}
                                    formatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
                                    colorClass={buyPnl >= 0 ? 'text-cyan-400/80' : 'text-red-400/80'}
                                />
                            </div>
                        </div>

                        {/* SELL GROUP */}
                        <div className="flex flex-col items-center gap-1">
                            {/* Counter at TOP */}
                            <div className="flex items-center gap-1 text-[8px] sm:text-[10px] font-mono font-black text-orange-400">
                                <span>S</span>
                                <span className="opacity-80">{sellCount}</span>
                            </div>

                            <div className="flex items-end gap-1 sm:gap-1.5 h-12 sm:h-16">
                                {/* Order Count Bar - Scaling relative to max of B/S */}
                                <div className="relative w-1.5 sm:w-2 h-full bg-black/40 rounded-full border border-orange-500/10 overflow-hidden shadow-inner">
                                    <div 
                                        className="absolute bottom-0 w-full bg-gradient-to-t from-orange-600 to-orange-300 transition-all duration-1000 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                                        style={{ height: `${Math.max(5, (sellCount / Math.max(1, buyCount, sellCount)) * 100)}%` }}
                                    />
                                </div>
                                {/* PnL Indicator Line + Scale */}
                                <div className="relative w-2 sm:w-3.5 h-full flex flex-col items-center overflow-visible">
                                    <div className="w-[3px] sm:w-[5px] h-full bg-white/10 rounded-full relative">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[5px] sm:w-[7px] h-[1.5px] bg-white/50 z-10" />
                                        
                                        <div 
                                            className={`absolute left-0 right-0 transition-all duration-1000 ${sellPnl >= 0 ? 'bg-orange-400 bottom-1/2 rounded-t-full shadow-[0_0_12px_rgba(251,146,60,0.8)]' : 'bg-red-500 top-1/2 rounded-b-full shadow-[0_0_12px_rgba(239,68,68,0.8)]'}`}
                                            style={{ height: `${Math.min(50, Math.abs((sellPnl / (Math.max(1, balance) * 0.01)) * 50))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* PnL Label at BOTTOM */}
                            <div className={`text-[7px] sm:text-[8px] font-mono font-bold ${sellPnl >= 0 ? 'text-orange-400/80' : 'text-red-400/80'}`}>
                                <AnimatedNumber
                                    value={sellPnl}
                                    formatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`}
                                    colorClass={sellPnl >= 0 ? 'text-orange-400/80' : 'text-red-400/80'}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Unified Relationship Bar (Balance, Equity, PnL) */}
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex justify-between items-end mb-1">
                            <div className="flex flex-col">
                                <h1 className="text-[10px] sm:text-xs font-black text-[#cfa545] tracking-widest uppercase truncate leading-none mb-1">
                                    <span className="hidden sm:inline">EasyGold Farming | </span>{assetType} | {portNumber} | {accountType}
                                </h1>
                                <div className="text-[10px] sm:text-sm font-bold tracking-wider text-[#0ea5e9]">
                                    <span className="text-[7px] sm:text-[8px] text-white/30 tracking-widest uppercase mr-1">EQUITY</span>
                                    {currencyPrefix}{equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="flex gap-1 sm:gap-2 items-center mb-0.5">
                                    <span className="text-[7px] sm:text-[8px] text-white/30 tracking-widest uppercase">BALANCE</span>
                                    <span className="font-mono text-[10px] sm:text-sm font-bold text-[#cfa545] tracking-wider">
                                        {currencyPrefix}{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className={`text-[8px] sm:text-[10px] font-mono font-black tracking-tighter ${floatingPnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                    <AnimatedNumber
                                        value={floatingPnl}
                                        formatter={v => `${v >= 0 ? '+' : ''}${currencyPrefix}${v.toFixed(2)} (${((v / balance) * 100).toFixed(2)}%)`}
                                        colorClass={floatingPnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* THE UNIFIED BAR: Balance as Anchor (75% mark) */}
                        <div className="relative h-2.5 sm:h-3.5 w-full bg-black/50 rounded-full border border-amber-900/30 p-0.5 overflow-hidden shadow-inner">
                           {/* Target Point: Balance Marker (WHITE) */}
                           <div className="absolute left-[75%] top-0 bottom-0 w-[1px] bg-white/60 z-20" />
                           
                           {/* Visual Segments Calculation */}
                           {floatingPnl < 0 ? (
                               <>
                                   {/* Drawdown: Blue bar ends before anchor, Red bar fills the gap */}
                                   <div 
                                        className="h-full bg-gradient-to-r from-[#0284c7] to-[#0ea5e9] rounded-l-full transition-all duration-1000"
                                        style={{ width: `${Math.max(0, 75 + (floatingPnl / balance) * 75)}%` }}
                                   />
                                   <div 
                                        className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-red-600/60 to-red-400 transition-all duration-1000"
                                        style={{ 
                                            left: `${Math.max(0, 75 + (floatingPnl / balance) * 75)}%`, 
                                            width: `${Math.min(75, Math.abs((floatingPnl / balance) * 75))}%` 
                                        }}
                                   />
                               </>
                           ) : (
                               <>
                                   {/* Profit: Blue bar fills up to anchor, Green bar extends beyond as a thinner line */}
                                   <div 
                                        className="h-full bg-gradient-to-r from-[#0284c7] to-[#38bdf8] rounded-l-full transition-all duration-1000"
                                        style={{ width: '75%' }}
                                   />
                                   <div 
                                        className="absolute bottom-0.5 h-1 sm:h-1.5 bg-gradient-to-r from-[#4de180] to-green-300 shadow-[0_0_8px_rgba(77,225,128,0.3)] transition-all duration-1000"
                                        style={{ 
                                            left: '75%', 
                                            width: `${Math.min(25, (floatingPnl / balance) * 75)}%` 
                                        }}
                                   />
                               </>
                           )}
                           
                           {/* Glow effect at the tip of current Equity (Dynamic Color) */}
                           <div 
                                className={`absolute h-full w-1 blur-[2px] z-30 transition-all duration-1000 ${floatingPnl >= 0 ? 'bg-[#38bdf8]' : 'bg-red-400'}`}
                                style={{ 
                                    left: `${Math.min(100, 75 + (floatingPnl / balance) * 75)}%`, 
                                    opacity: 0.6 
                                }}
                           />
                        </div>
                    </div>
                </div>

                {/* Right: Today Harvest Icon & Result */}
                <div className="hidden sm:flex flex-shrink-0 items-center gap-1 sm:gap-3 bg-black/40 border border-amber-900/20 rounded-lg p-1 sm:p-2 sm:pl-3 relative h-16 sm:h-24">
                    <div className={`relative w-12 h-12 sm:w-20 sm:h-20 flex-shrink-0 transition-transform duration-300 ${isShaking ? 'animate-box-shake' : ''}`}>
                        <Image src={todayHarvestAsset} alt="Box" fill className="object-contain" unoptimized />
                    </div>
                    <div className="flex flex-col pr-1 justify-center">
                        <span className="hidden sm:block text-[8px] lg:text-[10px] text-amber-200/40 uppercase font-black tracking-widest leading-none mb-1">Today Result</span>
                        <span className={`text-[11px] sm:text-sm lg:text-xl font-mono font-black ${todayProfit >= 0 ? 'text-[#4de180]' : 'text-red-500'} drop-shadow-sm leading-none`}>
                            <AnimatedNumber
                                value={todayProfit}
                                formatter={v => `${v >= 0 ? '+' : ''}${currencyPrefix}${v.toFixed(2)}`}
                                colorClass={todayProfit >= 0 ? 'text-[#4de180]' : 'text-red-500'}
                            />
                        </span>
                        {/* More visible USC Label */}
                        <div className="flex items-center gap-1 mt-0.5">
                           <span className="inline sm:inline text-[8px] text-white/40 uppercase">LOTS:<span className="text-[#0ea5e9] ml-1">{todayClosedLots.toFixed(2)}</span></span>
                           <span className="inline sm:inline text-[7px] text-white/20 ml-1">|</span>
                           <span className="inline sm:inline text-[8px] text-white/40 uppercase">MAX DD:<span className="text-red-500/80 ml-1">{currencyPrefix}{dailyMaxDrawdown.toFixed(2)}</span></span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Top Right small decorator */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#cfa545]/20 to-transparent pointer-events-none" />
        </div>
        </>
    );
}

// ─── Mobile Stats Overlay ───
// Placed right below the Timeline Bar on mobile.
export function FarmMobileStatsOverlay({
    portNumber,
    buyCount,
    sellCount,
    buyPnl,
    sellPnl,
    balance,
    todayProfit,
    todayClosedLots,
    dailyMaxDrawdown,
    accountType,
    totalStandardLots,
    isShaking,
}: {
    portNumber: string;
    buyCount: number;
    sellCount: number;
    buyPnl: number;
    sellPnl: number;
    balance: number;
    todayProfit: number;
    todayClosedLots: number;
    dailyMaxDrawdown: number;
    accountType: string;
    totalStandardLots: number;
    isShaking?: boolean;
}) {
    const isUSC = accountType?.toUpperCase().trim() === 'USC' || accountType?.toUpperCase().trim() === 'CENT';
    const currencyPrefix = isUSC ? '' : '$';

    const isUSD_Mobile = !isUSC;
    const centsValue_Mobile = isUSD_Mobile ? todayProfit * 100 : todayProfit;

    let todayHarvestAsset = '/farm/base_farmbox_empty.png';
    if (todayProfit < 0) todayHarvestAsset = '/farm/base_farmbox_lose.png';
    else if (centsValue_Mobile > 2000) todayHarvestAsset = '/farm/base_farmbox_full.png';
    else if (centsValue_Mobile > 1000) todayHarvestAsset = '/farm/base_farmbox_mid.png';
    else if (centsValue_Mobile > 0) todayHarvestAsset = '/farm/base_farmbox_min.png';

    return (
        <div className="sm:hidden fixed top-[94px] left-0 w-full h-[88px] bg-black/5 backdrop-blur-[2px] z-[90] flex justify-between items-center px-1.5 pt-1 border-b border-amber-900/10 pointer-events-auto">
            
            {/* Left side B/S */}
            <div className="flex gap-1.5 flex-shrink-0 items-center drop-shadow-xl bg-[#110e0b]/90 border border-amber-900/40 rounded-xl px-2 h-[80px]">
                {/* BUY GROUP */}
                <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center gap-1 text-[8px] font-mono font-black text-cyan-400 leading-none">
                        <span>B</span><span className="opacity-80">{buyCount}</span>
                    </div>
                    <div className="flex items-end gap-1 h-10">
                        {/* Order Count Bar */}
                        <div className="relative w-1.5 h-full bg-black/40 rounded-full border border-cyan-500/10 overflow-hidden shadow-inner">
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-600 to-cyan-300 transition-all duration-1000 shadow-[0_0_4px_rgba(6,182,212,0.5)]"
                                style={{ height: `${Math.max(5, (buyCount / Math.max(1, buyCount, sellCount)) * 100)}%` }} />
                        </div>
                        {/* PnL Indicator Line + Scale */}
                        <div className="relative w-1.5 h-full flex flex-col items-center overflow-visible">
                            <div className="w-[3px] h-full bg-white/10 rounded-full relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[5px] h-[1px] bg-white/50 z-10" />
                                <div 
                                    className={`absolute left-0 right-0 transition-all duration-1000 ${buyPnl >= 0 ? 'bg-cyan-400 bottom-1/2 rounded-t-full shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-red-500 top-1/2 rounded-b-full shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}
                                    style={{ height: `${Math.min(50, Math.abs((buyPnl / (Math.max(1, balance) * 0.01)) * 50))}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={`text-[8px] font-mono font-bold leading-none ${buyPnl >= 0 ? 'text-cyan-400/80' : 'text-red-400/80'}`}>
                        <AnimatedNumber value={buyPnl} formatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`} colorClass={buyPnl >= 0 ? 'text-cyan-400/80' : 'text-red-400/80'} />
                    </div>
                </div>
                
                {/* SELL GROUP */}
                <div className="flex flex-col items-center gap-0.5 ml-1">
                    <div className="flex items-center gap-1 text-[8px] font-mono font-black text-orange-400 leading-none">
                        <span>S</span><span className="opacity-80">{sellCount}</span>
                    </div>
                    <div className="flex items-end gap-1 h-10">
                        {/* Order Count Bar */}
                        <div className="relative w-1.5 h-full bg-black/40 rounded-full border border-orange-500/10 overflow-hidden shadow-inner">
                            <div className="absolute bottom-0 w-full bg-gradient-to-t from-orange-600 to-orange-300 transition-all duration-1000 shadow-[0_0_4px_rgba(249,115,22,0.5)]"
                                style={{ height: `${Math.max(5, (sellCount / Math.max(1, buyCount, sellCount)) * 100)}%` }} />
                        </div>
                        {/* PnL Indicator Line + Scale */}
                        <div className="relative w-1.5 h-full flex flex-col items-center overflow-visible">
                            <div className="w-[3px] h-full bg-white/10 rounded-full relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[5px] h-[1px] bg-white/50 z-10" />
                                <div 
                                    className={`absolute left-0 right-0 transition-all duration-1000 ${sellPnl >= 0 ? 'bg-orange-400 bottom-1/2 rounded-t-full shadow-[0_0_8px_rgba(251,146,60,0.8)]' : 'bg-red-500 top-1/2 rounded-b-full shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}
                                    style={{ height: `${Math.min(50, Math.abs((sellPnl / (Math.max(1, balance) * 0.01)) * 50))}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={`text-[8px] font-mono font-bold leading-none ${sellPnl >= 0 ? 'text-orange-400/80' : 'text-red-400/80'}`}>
                        <AnimatedNumber value={sellPnl} formatter={v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`} colorClass={sellPnl >= 0 ? 'text-orange-400/80' : 'text-red-400/80'} />
                    </div>
                </div>
            </div>

            {/* Right side Today Result Box */}
            <div className="bg-[#110e0b]/90 border border-amber-900/40 rounded-xl relative h-[80px] min-w-[130px] flex items-start px-2.5 pt-1.5">
                {/* Profit Text on Top-Left */}
                <div className="relative z-20 flex-1">
                    <span className={`text-[15px] font-mono font-black ${todayProfit >= 0 ? 'text-[#4de180]' : 'text-red-500'} drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-none tracking-tight`}>
                        <AnimatedNumber value={todayProfit} formatter={v => `${v >= 0 ? '+' : ''}${currencyPrefix}${v.toFixed(2)}`} colorClass={todayProfit >= 0 ? 'text-[#4de180]' : 'text-red-500'} />
                    </span>
                    <div className="flex flex-col gap-0 mt-[-2px]">
                        <span className="text-[7px] text-white/40 uppercase font-black tracking-widest leading-tight">MAX DD: <span className="text-red-500/80">{currencyPrefix}{dailyMaxDrawdown.toFixed(2)}</span></span>
                        <span className="text-[7px] text-white/40 uppercase font-black tracking-widest leading-tight">LOTS: <span className="text-[#0ea5e9]">{todayClosedLots.toFixed(2)}</span></span>
                    </div>
                </div>
                {/* Port Number on Bottom-Left */}
                <div className="absolute left-2.5 bottom-1.5 z-20">
                    <span className="text-[7px] text-white/20 font-black uppercase tracking-widest">{portNumber}</span>
                </div>
                {/* Box Image on Bottom-Right */}
                <div className={`absolute -right-2 -bottom-4 w-20 h-20 flex-shrink-0 drop-shadow-xl transition-transform duration-300 pointer-events-none z-10 ${isShaking ? 'animate-box-shake' : ''}`}>
                    <Image src={todayHarvestAsset} alt="Box" fill className="object-contain" unoptimized />
                </div>
            </div>

        </div>
    );
}

