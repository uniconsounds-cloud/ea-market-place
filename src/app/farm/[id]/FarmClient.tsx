'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Clock, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import Image from 'next/image';
import FarmHud from '@/components/farm-hud';

// --- Utilities ---
function seededRandom(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// ==========================================
// 🛠️ CONFIGURABLE VARIABLES (สำหรับปรับจูนระยะ)
// ==========================================

// 1. ระยะห่างความกว้าง ซ้าย-ขวา (ยิ่งน้อย ต้นไม้จะยิ่งเบียดกันแนวนอน)
const TILE_W = 100;

// 2. ระยะความลึก บน-ล่าง (ยิ่งน้อย แถวบนจะยิ่งขยับเลื่อนลงมาซ้อนทับแถวล่างมากขึ้น)
const TILE_H_OFFSET = 55; // แนะนำ: 40-52 (เดิมปกติตามสูตรคือ TILE_W / 2)

// 2.5 ปรับชดเชยความสูงของต้นไม้ให้ฐานดินเนียนไปกับพื้นหญ้า (Y Offset)
const TREE_Y_OFFSET = 20;

// 3. พื้นที่เกิดของผลไม้/ดอกไม้บนต้น (0% คือยอดขอบบนสุด, 100% คือขอบล่างสุดของรูปต้นไม้)
const FRUIT_SPAWN_Y_MIN = 10; // ขอบเขตด้านบนสุด (เลขยิ่งน้อย ยิ่งอยู่สูง)
const FRUIT_SPAWN_Y_MAX = 42; // ขอบเขตด้านล่างสุด (เลขยิ่งมาก ยิ่งย้อยลงมาที่โคน)
const FRUIT_SPAWN_X_MIN = 25; // ขอบเขตซ้ายสุด
const FRUIT_SPAWN_X_MAX = 75; // ขอบเขตขวาสุด

const GRID_COLS = 10;
const GRID_ROWS = 12;

type ZoomLevel = 'DAILY' | 'WEEKLY' | 'MONTHLY';

// 15 predefined invisible slots on the tree bush for organic placement
const TREE_SLOTS = Array.from({ length: 15 }).map((_, i) => ({
    x: FRUIT_SPAWN_X_MIN + seededRandom(i * 10) * (FRUIT_SPAWN_X_MAX - FRUIT_SPAWN_X_MIN),
    y: FRUIT_SPAWN_Y_MIN + seededRandom(i * 20) * (FRUIT_SPAWN_Y_MAX - FRUIT_SPAWN_Y_MIN),
    z: i
}));

export default function FarmClient({ portNumber, initialOrders, initialPortStatus }: { portNumber: string, initialOrders: any[], initialPortStatus?: any }) {
    const [orders, setOrders] = useState<any[]>(initialOrders);
    const [portStatus, setPortStatus] = useState<any>(initialPortStatus);
    const [time, setTime] = useState(new Date());
    const [zoom, setZoom] = useState<ZoomLevel>('DAILY');
    const [isClient, setIsClient] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsClient(true);
        setIsMobile(window.innerWidth < 768);

        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);

        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Auto-center scroll on load
    useEffect(() => {
        if (!isClient) return;
        const alignCenter = () => {
            const container = scrollContainerRef.current;
            if (container && container.clientWidth > 0) {
                const isDaily = zoom === 'DAILY';
                const cw = isDaily ? 800 : zoom === 'WEEKLY' ? 2400 : 4000;
                const ch = isDaily ? 1000 : zoom === 'WEEKLY' ? 2000 : 3000;
                // Center it horizontally. 
                // Because Plot 0 is at Left: 0 and Top: 200 relative to the center 100x100 div
                container.scrollLeft = (cw - container.clientWidth) / 2;
                // Center vertically, focusing on Plot 0 bounds (+250px below center)
                container.scrollTop = (ch / 2) + 250 - (container.clientHeight / 2);
            }
        };

        // Try immediately in case it's painted
        alignCenter();

        // Try again shortly after to override browser scroll restoration or delayed layout
        const timerId = setTimeout(alignCenter, 100);
        return () => clearTimeout(timerId);
    }, [isClient, zoom]);


    useEffect(() => {
        const channel = supabase
            .channel(`farm_updates_${portNumber}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'farm_port_status', filter: `port_number=eq.${portNumber}` },
                (payload) => {
                    if (payload.new) setPortStatus(payload.new);
                }
            )
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

    // Daily Plot logic: 1 Plot = 1 Day (9 trees per plot)
    const plotsData = useMemo(() => {
        // We render exactly 20 plots (Today + 19 past days)
        return Array.from({ length: 20 }).map((_, pIdx) => {
            const trees = Array.from({ length: 25 }).map(() => ({ assets: [] as any[] }));

            let plotPnl = 0;

            if (pIdx === 0) {
                // TODAY: Open Orders + Today's PnL
                plotPnl = derivedStats.floatingPnl;
                let slot = 0, treeId = 0;

                // 1. Add Open Orders (Type 'A' - Golden Lotus)
                for (let i = 0; i < derivedStats.openOrdersCount; i++) {
                    if (treeId >= 25) break;
                    trees[treeId].assets.push({ type: 'A', slotId: slot++ });
                    if (slot >= 15) { slot = 0; treeId++; }
                }

                // 2. Add Today's Profit or Loss Assets
                if (plotPnl >= 0) {
                    const todayFruits = Math.min(Math.floor(plotPnl / 0.10), 1000);
                    for (let i = 0; i < todayFruits; i++) {
                        if (treeId >= 25) break;
                        trees[treeId].assets.push({ type: 'B', slotId: slot++ });
                        if (slot >= 15) { slot = 0; treeId++; }
                    }
                } else {
                    const todayDead = Math.min(Math.floor(Math.abs(plotPnl) / 0.10), 1000);
                    for (let i = 0; i < todayDead; i++) {
                        if (treeId >= 25) break;
                        trees[treeId].assets.push({ type: 'C', slotId: slot++ });
                        if (slot >= 15) { slot = 0; treeId++; }
                    }
                }

            } else {
                // PAST DAYS: Simulated historical data (Either Fruits OR Dead Lotus, never both)
                let dailyFruits = Math.floor(derivedStats.fruitCount / 19);
                let dailyDead = Math.floor(derivedStats.deadCount / 19);

                // Add some organic randomness to each day
                dailyFruits = Math.max(0, dailyFruits + Math.floor((seededRandom(pIdx) - 0.5) * 6));
                dailyDead = Math.max(0, dailyDead + Math.floor((seededRandom(pIdx * 2) - 0.5) * 4));

                // Determine net outcome: A plot can only have profit OR loss, not both mixed.
                const netAssets = dailyFruits - dailyDead;
                plotPnl = netAssets * 0.10;

                let slot = 0, treeId = 0;
                if (netAssets >= 0) {
                    // Profit -> Only Fruits (Type 'B')
                    for (let i = 0; i < netAssets; i++) {
                        if (treeId >= 25) break;
                        trees[treeId].assets.push({ type: 'B', slotId: slot++ });
                        if (slot >= 15) { slot = 0; treeId++; }
                    }
                } else {
                    // Loss -> Only Dead Flowers (Type 'C')
                    const lossCount = Math.abs(netAssets);
                    for (let i = 0; i < lossCount; i++) {
                        if (treeId >= 25) break;
                        trees[treeId].assets.push({ type: 'C', slotId: slot++ });
                        if (slot >= 15) { slot = 0; treeId++; }
                    }
                }
            }

            return {
                id: `plot_${pIdx}`,
                isToday: pIdx === 0,
                pnl: plotPnl,
                trees: trees.sort((a, b) => seededRandom(a.assets.length) - 0.5)
            };
        });
    }, [derivedStats]);

    // Signpost Labels
    const signpostLabel = !isClient ? '...' : (zoom === 'DAILY'
        ? time.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()
        : zoom === 'WEEKLY'
            ? `WEEK 3, ${time.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase()}`
            : `${time.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }).toUpperCase()}`);

    // Isometric Map Scale & Auto-center tweaks for Mobile Daily View
    // Make it much smaller on mobile screens so it doesn't overflow
    const mapScale = zoom === 'DAILY' ? (isMobile ? 0.9 : 1.3) : zoom === 'WEEKLY' ? (isMobile ? 0.5 : 0.9) : (isMobile ? 0.3 : 0.5);

    return (
        <div className="flex flex-col min-h-screen w-full overflow-x-auto overflow-y-auto font-sans relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e3f0ff] via-[#b5d6f4] to-[#7fb2df]">

            {/* Top Frame: Luxury HUD */}
            <FarmHud
                portNumber={portNumber}
                balance={portStatus?.balance || 51540.20} // Fallback to reference mock value if no DB row
                equity={portStatus?.equity || 51540.20}
                floatingPnl={derivedStats.floatingPnl}
                totalStandardLots={derivedStats.totalStandardLots}
                marginLevel={portStatus?.margin_level || 200}
                accountType={portStatus?.account_type || 'USC'}
                maxDrawdown={portStatus?.max_drawdown || 0}
                zoom={zoom}
                onZoomChange={setZoom}
            />

            {/* Mobile Zoom Controls */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 lg:hidden bg-white/90 backdrop-blur-md rounded-full p-1.5 border border-[#e3d5b8] shadow-2xl flex gap-2 z-50">
                <button onClick={() => setZoom('DAILY')} className={`p-3 rounded-full transition-all ${zoom === 'DAILY' ? 'bg-[#d4af37] text-white' : 'text-[#8b7355]'}`}><ZoomIn className="w-5 h-5" /></button>
                <button onClick={() => setZoom('WEEKLY')} className={`p-3 rounded-full transition-all ${zoom === 'WEEKLY' ? 'bg-[#d4af37] text-white' : 'text-[#8b7355]'}`}><Maximize className="w-5 h-5" /></button>
                <button onClick={() => setZoom('MONTHLY')} className={`p-3 rounded-full transition-all ${zoom === 'MONTHLY' ? 'bg-[#d4af37] text-white' : 'text-[#8b7355]'}`}><ZoomOut className="w-5 h-5" /></button>
            </div>

            {/* Main Infinite Canvas (Horizontal Scroll Area) */}
            <div ref={scrollContainerRef} className="flex-1 w-full relative mt-24 overflow-auto scroll-smooth">
                {/* Massive oversized frame to allow panning */}
                <div
                    className="flex items-center justify-center pointer-events-auto relative transition-all duration-700"
                    style={{
                        minWidth: zoom === 'DAILY' ? '800px' : zoom === 'WEEKLY' ? '2400px' : '4000px',
                        minHeight: zoom === 'DAILY' ? '1000px' : zoom === 'WEEKLY' ? '2000px' : '3000px'
                    }}
                >

                    {/* 2.5D Camera Wrapper */}
                    <div
                        className="relative transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] origin-center"
                        style={{ transform: `scale(${mapScale})` }}
                    >
                        {/* The Group of Plots */}
                        <div className="relative w-[100px] h-[100px] pointer-events-none">
                            {/* Render up to 20 Plots depending on zoom context, but they all exist in DOM */}
                            {plotsData.map((plot, pIdx) => {
                                // Arrange plots in an expanding Zig-Zag / Grid timeline
                                // Plot 0 (Today) is at the very front (bottom of isometric Y)
                                const P_COLS = 5; // How wide the zigzag is
                                const pc = pIdx % P_COLS;
                                const pr = Math.floor(pIdx / P_COLS);

                                // Base Isometric math for plot spacing
                                const SPACING_X = 550; // px distance horizontally between plot centers
                                const SPACING_Y = 320; // px distance vertically

                                // Reverse the drawing order so plot0 is front
                                const plotPosX = (pc - pr) * SPACING_X;
                                const plotPosY = (pc + pr) * -SPACING_Y + 100; // Offset downwards slightly
                                const plotZIndex = 100 - pIdx; // Today is always on top

                                // Calculate individual plot date
                                const plotDate = new Date(time);
                                plotDate.setDate(plotDate.getDate() - pIdx);
                                const dateString = plotDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
                                const plotLabel = plot.isToday ? (isDemo ? `DEMO: ${dateString}` : `TODAY: ${dateString}`) : dateString;

                                return (
                                    <div
                                        key={plot.id}
                                        className="absolute transition-opacity duration-1000 ease-in-out shadow-lg"
                                        style={{
                                            left: `${plotPosX}px`,
                                            top: `${plotPosY}px`,
                                            zIndex: plotZIndex,
                                            // Optional cull if not needed in current view, but scaling handles mostly.
                                            opacity: (zoom === 'DAILY' && pIdx > 0) ? 0 : 1, // Hide others in Daily zoom
                                        }}
                                    >
                                        {/* Wooden signpost moved into the 5x5 loop below to anchor to the front tree */}

                                        {/* Render 5x5 Ground Tiles and Trees Together for perfect Z-index */}
                                        {Array.from({ length: 25 }).map((_, i) => {
                                            const c = i % 5;
                                            const r = Math.floor(i / 5);
                                            // Make Z-index naturally flow from back to front
                                            const tZIndex = (c + r) + 20;

                                            // Place a tree on every single tile
                                            const tree = plot.trees[i];

                                            return (
                                                <div key={`tile_${i}`} className="absolute" style={{ left: `${(c - r) * TILE_W}px`, top: `${(c + r) * TILE_H_OFFSET}px`, zIndex: tZIndex, width: '280px', height: '280px' }}>
                                                    {/* Ground Layer */}
                                                    <Image src="/farm/base_ground.png" alt="G" fill className="object-contain object-bottom" unoptimized />

                                                    {/* Tree Layer (if exists on this tile) */}
                                                    {tree && (
                                                        <div className="absolute inset-0 pointer-events-none" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                                            <Image src="/farm/base_tree_new.png" alt="T" fill className="object-contain object-bottom drop-shadow-2xl" unoptimized priority={pIdx === 0} />
                                                            {tree.assets.map((asset, aIdx) => {
                                                                const slot = TREE_SLOTS[asset.slotId];
                                                                return (
                                                                    <div key={`s_${aIdx}`} className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 drop-shadow-xl" style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: tZIndex + 1 }}>
                                                                        {asset.type === 'A' && <Image src="/farm/asset_a_lotus.png" alt="Open" fill className="object-contain animate-pulse" unoptimized />}
                                                                        {asset.type === 'B' && <Image src="/farm/asset_b_apple.png" alt="Profit" fill className="object-contain" unoptimized />}
                                                                        {asset.type === 'C' && <Image src="/farm/asset_c_dead.png" alt="Loss" fill className="object-contain opacity-90" unoptimized />}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Signpost Anchor - Only render on the very front tile (i=24) */}
                                                    {i === 24 && (
                                                        <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-auto" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                                            <div className="flex flex-col gap-1.5 items-center z-10">
                                                                <div className={`bg-[#1f1611]/95 border ${plot.pnl >= 0 ? 'border-[#4de180]/50' : 'border-red-500/50'} rounded-sm px-4 py-1.5 shadow-2xl relative`}>
                                                                    <h3 className={`font-mono font-bold tracking-widest text-sm whitespace-nowrap ${plot.pnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                                                        {plot.pnl >= 0 ? '+' : ''}${plot.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </h3>
                                                                </div>
                                                                <div className="bg-[#1f1611]/95 border border-[#cfa545] rounded-sm px-6 py-2 shadow-2xl relative">
                                                                    <h2 className="text-[#cfa545] font-black tracking-widest text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,1)] whitespace-nowrap">
                                                                        {isClient ? plotLabel : '...'}
                                                                    </h2>
                                                                </div>
                                                            </div>
                                                            {/* Wooden Pole */}
                                                            <div className="w-1.5 h-16 bg-gradient-to-b from-[#8b5a2bd0] to-[#4a2e12d0] shadow-xl relative -mt-1 rounded-b-full border-x border-[#3a220f] z-0"></div>
                                                        </div>
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
        </div>
    );
}

