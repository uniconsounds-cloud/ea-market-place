'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Clock, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import Image from 'next/image';

// --- Utilities ---
function seededRandom(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

const TILE_W = 60; // Isometric pixel base width
const TILE_H = TILE_W / 2; // Isometric pixel half-height
const GRID_COLS = 10;
const GRID_ROWS = 12;

type ZoomLevel = 'DAILY' | 'WEEKLY' | 'MONTHLY';

// 15 predefined invisible slots on the tree bush for organic placement
const TREE_SLOTS = Array.from({ length: 15 }).map((_, i) => ({
    x: 20 + seededRandom(i * 10) * 60, // 20% to 80%
    y: 10 + seededRandom(i * 20) * 45, // 10% to 55%
    z: i
}));

export default function FarmClient({ portNumber, initialOrders }: { portNumber: string, initialOrders: any[] }) {
    const [orders, setOrders] = useState<any[]>(initialOrders);
    const [time, setTime] = useState(new Date());
    const [zoom, setZoom] = useState<ZoomLevel>('DAILY');

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const channel = supabase
            .channel(`farm_updates_${portNumber}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'farm_active_orders', filter: `port_number=eq.${portNumber}` },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setOrders(prev => [...prev.filter(o => o.ticket_id !== payload.new.ticket_id), payload.new]);
                    } else if (payload.eventType === 'UPDATE') {
                        setOrders(prev => prev.map(o => o.ticket_id === payload.new.ticket_id ? payload.new : o));
                    } else if (payload.eventType === 'DELETE') {
                        setOrders(prev => prev.filter(o => o.ticket_id !== payload.old.ticket_id));
                    }
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [portNumber]);

    // Mock initial demo state if empty
    const isDemo = orders.length === 0;
    const displayOrders = useMemo(() => isDemo ? [
        { ticket_id: 1001, type: 'BUY', status: 'OPEN', current_pnl: 15.50, sl_risk_percent: 5, raw_lot_size: 15 },
        { ticket_id: 1002, type: 'SELL', status: 'OPEN', current_pnl: -45.20, sl_risk_percent: 35, raw_lot_size: 30 },
        { ticket_id: 1004, type: 'SELL', status: 'CLOSED_TP', current_pnl: 10.00, sl_risk_percent: 0, raw_lot_size: 20 },
        { ticket_id: 1005, type: 'BUY', status: 'CLOSED_SL', current_pnl: -5.00, sl_risk_percent: 100, raw_lot_size: 50 },
    ] : orders, [isDemo, orders]);

    // Derived Variables based on Zoom Level
    const derivedStats = useMemo(() => {
        const openOrders = displayOrders.filter(o => o.status === 'OPEN');
        const floatingPnl = openOrders.reduce((sum, o) => sum + (Number(o.current_pnl) || 0), 0);
        const totalStandardLots = openOrders.reduce((sum, o) => sum + (Number(o.raw_lot_size) || 0), 0) / 100;

        let totalProfit = 0;
        let totalLoss = 0;

        // Cumulative past data (In a real app, Weekly/Monthly would hit DB aggregates instead of map)
        const closedTp = displayOrders.filter(o => o.status === 'CLOSED_TP');
        const closedSl = displayOrders.filter(o => o.status === 'CLOSED_SL');

        // Simulating data scaling based on zoom choice for effect
        let multiplier = zoom === 'DAILY' ? 1 : zoom === 'WEEKLY' ? 5 : 20;

        totalProfit = closedTp.reduce((sum, o) => sum + (Number(o.current_pnl) || 0), 0) * multiplier;
        totalLoss = Math.abs(closedSl.reduce((sum, o) => sum + (Number(o.current_pnl) || 0), 0)) * multiplier;

        return {
            openOrdersCount: openOrders.length,
            floatingPnl,
            totalStandardLots,
            fruitCount: Math.min(Math.floor(totalProfit * 10), 1000),   // 1 Fruit = 10 cents ($0.10)
            deadCount: Math.min(Math.floor(totalLoss * 10), 1000),      // 1 Dead = 10 cents ($0.10)
        };
    }, [displayOrders, zoom]);

    // Distribute active orders, fruits, and dead flowers across the 120 trees
    const treeDataMap = useMemo(() => {
        // Init 120 trees with 15 empty slots each
        const trees = Array.from({ length: GRID_COLS * GRID_ROWS }).map(() => ({
            assets: [] as any[], // Array of { type: 'A'|'B'|'C', slotId: number }
        }));

        let globalTreeIndex = 0;
        let globalSlotIndex = 0;

        const placeAsset = (type: 'A' | 'B' | 'C') => {
            if (globalTreeIndex >= trees.length) return; // Full farm
            trees[globalTreeIndex].assets.push({ type, slotId: globalSlotIndex });

            globalSlotIndex++;
            if (globalSlotIndex >= 15) {
                globalSlotIndex = 0;
                globalTreeIndex++;
            }
        };

        // 1. Place 'A' (Pulsing Lotus) for every Open Order
        for (let i = 0; i < derivedStats.openOrdersCount; i++) {
            placeAsset('A');
        }

        // 2. Place 'B' (Apple) for every 10 cents Profit
        for (let i = 0; i < derivedStats.fruitCount; i++) {
            placeAsset('B');
        }

        // 3. Place 'C' (Dead Lotus) for every 10 cents Loss
        for (let i = 0; i < derivedStats.deadCount; i++) {
            placeAsset('C');
        }

        // We shuffle the tree array purely for organic randomness so fruits aren't just stacked on Tree 0
        return trees.sort((a, b) => seededRandom(a.assets.length) - 0.5);
    }, [derivedStats]);

    // Signpost Labels
    const signpostLabel = zoom === 'DAILY'
        ? time.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
        : zoom === 'WEEKLY'
            ? `WEEK 3, ${time.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()}`
            : `${time.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}`;

    // Isometric Map Scale
    const mapScale = zoom === 'DAILY' ? 1.4 : zoom === 'WEEKLY' ? 0.9 : 0.6;

    return (
        <div className="flex flex-col min-h-screen w-full bg-[#fdfaf6] overflow-x-auto overflow-y-hidden font-sans relative">

            {/* Top Frame: Luxury HUD */}
            <div className="fixed top-0 left-0 w-full h-24 bg-white/90 backdrop-blur-md border-b-2 border-amber-200/50 flex items-center justify-between px-4 sm:px-8 shadow-sm shrink-0 z-50">
                <div className="flex flex-col">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-[#d4af37] tracking-wider drop-shadow-sm flex items-center gap-2">
                        <Image src="/logo.png" alt="EAEZE" width={40} height={40} className="h-8 w-auto" />
                        EasyGold Farm
                    </h1>
                    <span className="text-xs text-amber-900/40 font-mono tracking-widest mt-1">PORT: {portNumber}</span>
                </div>

                {/* Center: Zoom Controls */}
                <div className="hidden lg:flex bg-[#fbf8f1] rounded-full p-1 border border-[#e3d5b8] shadow-inner gap-1">
                    <button onClick={() => setZoom('DAILY')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${zoom === 'DAILY' ? 'bg-[#d4af37] text-white shadow-md' : 'text-[#8b7355] hover:bg-white'} uppercase tracking-wide`}>Daily</button>
                    <button onClick={() => setZoom('WEEKLY')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${zoom === 'WEEKLY' ? 'bg-[#d4af37] text-white shadow-md' : 'text-[#8b7355] hover:bg-white'} uppercase tracking-wide`}>Weekly</button>
                    <button onClick={() => setZoom('MONTHLY')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${zoom === 'MONTHLY' ? 'bg-[#d4af37] text-white shadow-md' : 'text-[#8b7355] hover:bg-white'} uppercase tracking-wide`}>Monthly</button>
                </div>

                <div className="flex items-center gap-6 sm:gap-12 text-[#5c4a3d]">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] sm:text-xs text-[#a68a61] uppercase tracking-widest font-semibold mb-1">Floating PnL</span>
                        <span className={`text-xl sm:text-3xl font-bold font-mono transition-colors duration-300 ${derivedStats.floatingPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {derivedStats.floatingPnl >= 0 ? '+' : ''}{derivedStats.floatingPnl.toFixed(2)}
                        </span>
                    </div>

                    <div className="hidden sm:flex flex-col items-center">
                        <span className="text-[10px] sm:text-xs text-[#a68a61] uppercase tracking-widest font-semibold mb-1">Standard Lots</span>
                        <span className="text-lg sm:text-xl font-bold font-mono">{derivedStats.totalStandardLots.toFixed(2)}</span>
                    </div>

                    <div className="flex flex-col items-end min-w-[100px]">
                        <span className="text-[10px] sm:text-xs text-[#a68a61] uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-[#d4af37]" /> Time
                        </span>
                        <span className="text-base sm:text-lg font-mono">{time.toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* Mobile Zoom Controls */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:hidden bg-white/90 backdrop-blur-md rounded-full p-1.5 border border-[#e3d5b8] shadow-2xl flex gap-2 z-50">
                <button onClick={() => setZoom('DAILY')} className={`p-3 rounded-full transition-all ${zoom === 'DAILY' ? 'bg-[#d4af37] text-white' : 'text-[#8b7355]'}`}><ZoomIn className="w-5 h-5" /></button>
                <button onClick={() => setZoom('WEEKLY')} className={`p-3 rounded-full transition-all ${zoom === 'WEEKLY' ? 'bg-[#d4af37] text-white' : 'text-[#8b7355]'}`}><Maximize className="w-5 h-5" /></button>
                <button onClick={() => setZoom('MONTHLY')} className={`p-3 rounded-full transition-all ${zoom === 'MONTHLY' ? 'bg-[#d4af37] text-white' : 'text-[#8b7355]'}`}><ZoomOut className="w-5 h-5" /></button>
            </div>

            {/* Main Infinite Canvas (Horizontal Scroll Area) */}
            <div className="flex-1 w-full min-w-[200vw] sm:min-w-[150vw] flex items-center justify-center relative mt-24">

                {/* 2.5D Camera Wrapper */}
                <div
                    className="relative transition-transform duration-1000 ease-out flex items-center justify-center origin-center"
                    style={{ transform: `scale(${mapScale})` }}
                >
                    {/* The 10x12 Isometric Farm Plot */}
                    <div className="relative w-0 h-0 flex items-center justify-center">

                        {/* Wooden Signpost Header */}
                        <div className="absolute -top-[350px] left-1/2 -translate-x-1/2 z-0 flex flex-col items-center pointer-events-none drop-shadow-xl blur-[0px]">
                            <div className="bg-[#6d4c41] border-4 border-[#3e2723] rounded-sm px-10 py-3 shadow-[inset_0_4px_6px_rgba(255,255,255,0.1)] relative">
                                {/* Nails */}
                                <div className="absolute top-1 left-2 w-2 h-2 rounded-full bg-black/60 shadow-inner"></div>
                                <div className="absolute top-1 right-2 w-2 h-2 rounded-full bg-black/60 shadow-inner"></div>
                                <div className="absolute bottom-1 left-2 w-2 h-2 rounded-full bg-black/60 shadow-inner"></div>
                                <div className="absolute bottom-1 right-2 w-2 h-2 rounded-full bg-black/60 shadow-inner"></div>

                                <h2 className="text-[#f5deb3] font-black text-2xl tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                                    {isDemo ? 'DEMO TIMELINE' : signpostLabel}
                                </h2>
                                {isDemo && <span className="block text-center text-[10px] text-[#ffcccb] tracking-wider mt-1">Simulated Aggregate Data</span>}
                            </div>
                            <div className="w-4 h-16 bg-[#3e2723] shadow-xl"></div>
                        </div>

                        {/* Rendering 120 Isometric Trees */}
                        {treeDataMap.map((tree, i) => {
                            const col = i % GRID_COLS;
                            const row = Math.floor(i / GRID_COLS);

                            // Cartesian to Isometric Projection
                            const posX = (col - row) * TILE_W;
                            const posY = (col + row) * TILE_H;
                            const zIndex = col + row; // Front items overlap back items

                            return (
                                <div
                                    key={`iso_tree_${i}`}
                                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                                    style={{
                                        left: `${posX}px`,
                                        top: `${posY}px`,
                                        zIndex: zIndex,
                                        width: '160px',  // Size of the base image rendering
                                        height: '160px'
                                    }}
                                >
                                    {/* Base Isometric Bush & Dirt */}
                                    <Image
                                        src="/farm/base_tree.jpg"
                                        alt="Base Tree"
                                        fill
                                        className="object-contain"
                                        style={{ mixBlendMode: 'multiply' }} // Clears the white JPEG background beautifully
                                        priority={i < 40}
                                        unoptimized
                                    />

                                    {/* Render Slots on this Tree */}
                                    {tree.assets.map((asset, aIdx) => {
                                        const slot = TREE_SLOTS[asset.slotId];
                                        return (
                                            <div
                                                key={`slot_${i}_${aIdx}`}
                                                className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none drop-shadow-xl"
                                                style={{
                                                    left: `${slot.x}%`,
                                                    top: `${slot.y}%`,
                                                    zIndex: zIndex + 1
                                                }}
                                            >
                                                {asset.type === 'A' && (
                                                    <Image src="/farm/asset_a_lotus.png" alt="Open Order" fill className="object-contain animate-pulse mix-blend-multiply" unoptimized />
                                                )}
                                                {asset.type === 'B' && (
                                                    <Image src="/farm/asset_b_apple.png" alt="Profit" fill className="object-contain mix-blend-multiply" unoptimized />
                                                )}
                                                {asset.type === 'C' && (
                                                    <Image src="/farm/asset_c_dead.png" alt="Loss" fill className="object-contain mix-blend-multiply opacity-90" unoptimized />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
}

