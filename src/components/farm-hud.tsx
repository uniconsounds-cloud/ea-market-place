'use client';

import Image from 'next/image';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

type FarmHudProps = {
    portNumber: string;
    balance: number;
    equity: number;
    floatingPnl: number;
    totalStandardLots: number;
    marginLevel: number;
    accountType: string;
    maxDrawdown: number;
    zoom: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    onZoomChange: (z: 'DAILY' | 'WEEKLY' | 'MONTHLY') => void;
};

export default function FarmHud({
    portNumber,
    balance,
    equity,
    floatingPnl,
    totalStandardLots,
    marginLevel,
    accountType,
    maxDrawdown,
    zoom,
    onZoomChange
}: FarmHudProps) {
    const [time, setTime] = useState(new Date());
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Extract time components for the analog clock
    const seconds = time.getSeconds();
    const minutes = time.getMinutes();
    const hours = time.getHours() % 12;

    const secondDeg = seconds * 6;
    const minuteDeg = minutes * 6 + seconds * 0.1;
    const hourDeg = hours * 30 + minutes * 0.5;

    return (
        <div className="fixed top-0 left-0 w-full bg-[#16120e] text-[#e8dcb9] z-50 border-b-2 border-amber-900/80 shadow-[0_4px_20px_rgba(0,0,0,0.8)] overflow-hidden">
            {/* Background Texture/Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-[#2a1d0f]/50 to-black/60 pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />

            <div className="relative max-w-7xl mx-auto flex items-center h-28 px-4">

                {/* Left: Luxury Analog Clock Motif */}
                <div className="flex-shrink-0 w-24 h-24 relative mr-4 flex flex-col items-center justify-center">
                    {/* Outer ornate border (CSS simulation) */}
                    <div className="absolute inset-0 rounded-full border-4 border-[#cfa545] shadow-[0_0_15px_rgba(207,165,69,0.3)] bg-[#110e0b]"></div>
                    {/* Inner dial */}
                    <div className="absolute inset-1 rounded-full border border-amber-800 bg-gradient-to-b from-[#1c1814] to-[#0a0806]">
                        {/* Numbers/Ticks - Simplified for space */}
                        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] text-[#cfa545]">12</span>
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-[#cfa545]">6</span>
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px] text-[#cfa545]">9</span>
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-[#cfa545]">3</span>

                        {/* Hands */}
                        {isClient && (
                            <>
                                <div className="absolute top-1/2 left-1/2 w-[1px] h-[30%] bg-amber-200 origin-bottom rounded-full" style={{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-[1px] h-[40%] bg-amber-400 origin-bottom rounded-full" style={{ transform: `translate(-50%, -100%) rotate(${minuteDeg}deg)` }} />
                                <div className="absolute top-1/2 left-1/2 w-[0.5px] h-[45%] bg-red-800 origin-bottom" style={{ transform: `translate(-50%, -100%) rotate(${secondDeg}deg)` }} />
                                {/* Center dot */}
                                <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-[#cfa545] rounded-full -translate-x-1/2 -translate-y-1/2 shadow-sm" />
                            </>
                        )}
                    </div>
                    {/* Digital Badge below clock */}
                    <div className="absolute -bottom-2 px-2 py-0.5 bg-[#16120e] border border-[#cfa545] rounded-md text-[9px] font-mono tracking-widest text-[#cfa545] shadow-md z-10 whitespace-nowrap">
                        {isClient ? time.toLocaleTimeString('en-US', { hour12: false }) : '00:00:00'}
                    </div>
                </div>

                {/* Desktop Zoom Controls */}
                <div className="hidden lg:flex bg-[#110e0b]/50 rounded-full p-1 border border-amber-900/30 shadow-inner gap-1 mx-6 items-center flex-shrink-0">
                    <button onClick={() => onZoomChange('DAILY')} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${zoom === 'DAILY' ? 'bg-[#d4af37] text-black shadow-md' : 'text-[#8b7355] hover:text-[#d4af37]'} uppercase tracking-wide`}>Daily</button>
                    <button onClick={() => onZoomChange('WEEKLY')} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${zoom === 'WEEKLY' ? 'bg-[#d4af37] text-black shadow-md' : 'text-[#8b7355] hover:text-[#d4af37]'} uppercase tracking-wide`}>Weekly</button>
                    <button onClick={() => onZoomChange('MONTHLY')} className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all ${zoom === 'MONTHLY' ? 'bg-[#d4af37] text-black shadow-md' : 'text-[#8b7355] hover:text-[#d4af37]'} uppercase tracking-wide`}>Monthly</button>
                </div>

                {/* Right: Data Grid */}
                <div className="flex-1 flex flex-col justify-center py-2 h-full gap-1 min-w-[300px]">
                    <div className="flex justify-between items-end border-b border-amber-900/50 pb-1 mb-1 relative">
                        <div>
                            <h1 className="text-sm font-bold text-[#cfa545] drop-shadow-sm tracking-wider uppercase">EA EasyGold</h1>
                            <div className="text-[10px] text-amber-100/60 uppercase tracking-widest font-mono">PORT: {portNumber}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[9px] text-amber-100/60 uppercase tracking-widest font-mono mb-0.5">BALANCE</div>
                            <div className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:text-xs">
                        <div className="flex justify-between items-center bg-black/20 px-1.5 py-0.5 rounded border border-amber-900/30">
                            <span className="text-amber-100/50 uppercase tracking-wide">P/L:</span>
                            <span className={`font-mono font-bold ${floatingPnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                {floatingPnl >= 0 ? '+' : ''}${floatingPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center bg-black/20 px-1.5 py-0.5 rounded border border-amber-900/30">
                            <span className="text-amber-100/50 uppercase tracking-wide">MARGIN:</span>
                            <span className="font-mono font-bold text-white">{marginLevel.toLocaleString()}%</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/20 px-1.5 py-0.5 rounded border border-amber-900/30">
                            <span className="text-amber-100/50 uppercase tracking-wide">LOTS:</span>
                            <span className="font-mono font-bold text-white">{totalStandardLots.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-black/20 px-1.5 py-0.5 rounded border border-amber-900/30">
                            <span className="text-amber-100/50 uppercase tracking-wide">ACCOUNT:</span>
                            <span className="font-mono font-bold text-[#cfa545]">{accountType}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Top Right small decorator */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#cfa545]/20 to-transparent pointer-events-none" />
        </div>
    );
}
