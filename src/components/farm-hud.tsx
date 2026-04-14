'use client';

import Image from 'next/image';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

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

    let todayHarvestAsset = '/farm/base_farmbox_empty.png';
    const displayPnl = todayProfit; // Today Result uses Today's Closed Profit
    if (displayPnl < 0) todayHarvestAsset = '/farm/base_farmbox_lose.png';
    else if (displayPnl > 50) todayHarvestAsset = '/farm/base_farmbox_full.png';
    else if (displayPnl > 10) todayHarvestAsset = '/farm/base_farmbox_mid.png';
    else if (displayPnl > 0) todayHarvestAsset = '/farm/base_farmbox_min.png';

    const isUSC = accountType?.toUpperCase().trim() === 'USC' || accountType?.toUpperCase().trim() === 'CENT';
    const currencyPrefix = isUSC ? '' : '$';
    const unitSuffix = isUSC ? ' USC' : ' USD';

    return (
        <div 
            onClick={() => { console.log("HUD Clicked"); if(onClick) onClick(); }}
            className="fixed top-0 left-0 w-full bg-[#16120e] text-[#e8dcb9] z-[100] border-b-2 border-amber-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden cursor-pointer select-none pointer-events-auto"
        >
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-[#2a1d0f]/50 to-black/60 pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />

            <div className="relative max-w-7xl mx-auto flex items-center h-28 px-4 gap-4 sm:gap-8">

                {/* Left: Luxury Analog Clock Motif */}
                <div className="flex flex-shrink-0 w-16 h-16 sm:w-24 sm:h-24 relative flex-col items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-2 sm:border-4 border-[#cfa545] shadow-[0_0_15px_rgba(207,165,69,0.3)] bg-[#110e0b]"></div>
                    <div className="absolute inset-0.5 sm:inset-1 rounded-full border border-amber-800 bg-gradient-to-b from-[#1c1814] to-[#0a0806]">
                        <span className="absolute top-0.5 sm:top-1 left-1/2 -translate-x-1/2 text-[6px] sm:text-[8px] text-[#cfa545]">12</span>
                        <span className="absolute bottom-0.5 sm:bottom-1 left-1/2 -translate-x-1/2 text-[6px] sm:text-[8px] text-[#cfa545]">6</span>
                        {isClient && (
                            <>
                                <div className="absolute top-1/2 left-1/2 w-[1px] h-[30%] bg-amber-200 origin-bottom rounded-full" style={{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-[1px] h-[40%] bg-amber-400 origin-bottom rounded-full" style={{ transform: `translate(-50%, -100%) rotate(${minuteDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-[0.5px] h-[45%] bg-red-800 origin-bottom" style={{ transform: `translate(-50%, -100%) rotate(${secondDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-1 sm:w-1.5 h-1 sm:h-1.5 bg-[#cfa545] rounded-full -translate-x-1/2 -translate-y-1/2" />
                            </>
                        )}
                    </div>
                </div>

                {/* DIAGNOSTICS CENTER: Buy/Sell Bars + Balance/Equity */}
                <div className="flex-1 flex items-center gap-3 sm:gap-8 min-w-0">
                    
                    {/* Buy/Sell Vertical Energy Bars + PnL Indicators */}
                    <div className="flex gap-4 flex-shrink-0">
                        {/* BUY GROUP (B) */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-end gap-1.5 h-12 sm:h-16">
                                {/* Order Count Bar */}
                                <div className="relative w-1.5 h-full bg-black/40 rounded-full border border-cyan-500/20 overflow-hidden shadow-inner">
                                    <div 
                                        className="absolute bottom-0 w-full bg-gradient-to-t from-cyan-600 to-cyan-300 transition-all duration-1000 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                                        style={{ height: `${Math.min((buyCount / 10) * 100, 100)}%` }}
                                    />
                                </div>
                                {/* PnL Indicator Line */}
                                <div className="relative w-[1.5px] h-full bg-white/5 rounded-full overflow-visible">
                                    {/* Zero Center Mark */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-[1px] bg-white/40 z-10" />
                                    {/* Dynamic PnL Segment */}
                                    <div 
                                        className={`absolute left-1/2 -translate-x-1/2 transition-all duration-1000 ${buyPnl >= 0 ? 'bg-cyan-400 bottom-1/2 rounded-t-full shadow-[0_0_5px_rgba(34,211,238,0.6)]' : 'bg-red-500 top-1/2 rounded-b-full shadow-[0_0_5px_rgba(239,68,68,0.6)]'}`}
                                        style={{ 
                                            height: `${Math.min(50, Math.abs((buyPnl / (balance * 0.02)) * 50))}%` 
                                        }}
                                    />
                                </div>
                            </div>
                            <span className="text-[7px] sm:text-[8px] font-bold text-cyan-400">B</span>
                        </div>

                        {/* SELL GROUP (S) */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-end gap-1.5 h-12 sm:h-16">
                                {/* Order Count Bar */}
                                <div className="relative w-1.5 h-full bg-black/40 rounded-full border border-orange-500/20 overflow-hidden shadow-inner">
                                    <div 
                                        className="absolute bottom-0 w-full bg-gradient-to-t from-orange-600 to-orange-300 transition-all duration-1000 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
                                        style={{ height: `${Math.min((sellCount / 10) * 100, 100)}%` }}
                                    />
                                </div>
                                {/* PnL Indicator Line */}
                                <div className="relative w-[1.5px] h-full bg-white/5 rounded-full overflow-visible">
                                    {/* Zero Center Mark */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-[1px] bg-white/40 z-10" />
                                    {/* Dynamic PnL Segment */}
                                    <div 
                                        className={`absolute left-1/2 -translate-x-1/2 transition-all duration-1000 ${sellPnl >= 0 ? 'bg-orange-400 bottom-1/2 rounded-t-full shadow-[0_0_5px_rgba(251,146,60,0.6)]' : 'bg-red-500 top-1/2 rounded-b-full shadow-[0_0_5px_rgba(239,68,68,0.6)]'}`}
                                        style={{ 
                                            height: `${Math.min(50, Math.abs((sellPnl / (balance * 0.02)) * 50))}%` 
                                        }}
                                    />
                                </div>
                            </div>
                            <span className="text-[7px] sm:text-[8px] font-bold text-orange-400">S</span>
                        </div>
                    </div>

                    {/* Unified Relationship Bar (Balance, Equity, PnL) */}
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                        <div className="flex justify-between items-end mb-1">
                            <div className="flex flex-col">
                                <h1 className="text-[10px] sm:text-xs font-black text-[#cfa545] tracking-widest uppercase truncate leading-none mb-1">
                                    EasyGold Farming | {portNumber} | <span className="text-white/60">{assetType}</span> <span className="text-amber-500/80">| {accountType?.toUpperCase().trim() === 'USC' ? 'USC' : 'USD'}</span>
                                </h1>
                                <div className="text-[10px] sm:text-sm font-bold tracking-wider text-[#0ea5e9]">
                                    <span className="text-[7px] sm:text-[8px] text-white/30 tracking-widest uppercase mr-1">EQUITY</span>
                                    {currencyPrefix}{equity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <div className="flex gap-1 sm:gap-2 items-center mb-0.5">
                                    <span className="text-[7px] sm:text-[8px] text-white/30 tracking-widest uppercase">BALANCE</span>
                                    <span className="font-mono text-[10px] sm:text-sm font-bold text-[#cfa545] tracking-wider">
                                        {currencyPrefix}{balance.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                    </span>
                                </div>
                                <div className={`text-[8px] sm:text-[10px] font-mono font-black tracking-tighter ${floatingPnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                    {floatingPnl >= 0 ? '+' : ''}{currencyPrefix}{floatingPnl.toFixed(2)} ({((floatingPnl / balance) * 100).toFixed(2)}%)
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
                <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3 bg-black/30 border border-amber-900/30 rounded-lg p-1 sm:p-2 sm:pl-3 ml-1 sm:ml-2">
                    <div className={`relative w-12 h-12 lg:w-16 lg:h-16 flex-shrink-0 transition-transform duration-300 ${isShaking ? 'animate-box-shake' : ''}`}>
                        <Image src={todayHarvestAsset} alt="Box" fill className="object-contain" unoptimized />
                    </div>
                    <div className="flex flex-col pr-1">
                        <span className="text-[8px] lg:text-[10px] text-amber-200/40 uppercase font-black tracking-widest leading-none mb-1">Today Result</span>
                        <span className={`text-xs lg:text-base font-mono font-black ${todayProfit >= 0 ? 'text-[#4de180]' : 'text-red-500'} drop-shadow-sm`}>
                            {todayProfit >= 0 ? '+' : ''}{currencyPrefix}{todayProfit.toFixed(2)}
                        </span>
                        <div className="text-[8px] text-white/20 font-mono mt-0.5 uppercase tracking-tighter">
                            LOTS: {totalStandardLots.toFixed(2)} | {accountType}
                        </div>
                    </div>
                </div>

            </div>

            {/* Top Right small decorator */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#cfa545]/20 to-transparent pointer-events-none" />
        </div>
    );
}
