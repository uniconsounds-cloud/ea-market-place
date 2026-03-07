'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Clock } from 'lucide-react';

// Seeded random number generator for consistent static positioning on Canvas
function seededRandom(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

export default function FarmClient({ portNumber, initialOrders }: { portNumber: string, initialOrders: any[] }) {
    const [orders, setOrders] = useState<any[]>(initialOrders);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Subscribe to real-time changes using Postgres Changes
        const channel = supabase
            .channel(`farm_updates_${portNumber}`)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to all inserts, updates, deletes
                    schema: 'public',
                    table: 'farm_active_orders',
                    filter: `port_number=eq.${portNumber}`
                },
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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [portNumber]);

    const mockOrders = useMemo(() => [
        { ticket_id: 1001, type: 'BUY', status: 'OPEN', current_pnl: 15.50, sl_risk_percent: 5, raw_lot_size: 15 },
        { ticket_id: 1002, type: 'SELL', status: 'OPEN', current_pnl: -45.20, sl_risk_percent: 35, raw_lot_size: 30 },
        { ticket_id: 1003, type: 'BUY', status: 'OPEN', current_pnl: -120.00, sl_risk_percent: 85, raw_lot_size: 60 },
        { ticket_id: 1004, type: 'SELL', status: 'CLOSED_TP', current_pnl: 85.00, sl_risk_percent: 0, raw_lot_size: 20 },
        { ticket_id: 1005, type: 'BUY', status: 'CLOSED_SL', current_pnl: -200.00, sl_risk_percent: 100, raw_lot_size: 50 },
        { ticket_id: 1006, type: 'BUY', status: 'OPEN', current_pnl: 5.00, sl_risk_percent: 15, raw_lot_size: 150 },
        { ticket_id: 1007, type: 'SELL', status: 'OPEN', current_pnl: -80.00, sl_risk_percent: 60, raw_lot_size: 15 },
    ], []);

    const isDemo = orders.length === 0;
    const displayOrders = isDemo ? mockOrders : orders;

    // Derived stats from Open states only
    const floatingPnl = useMemo(() => {
        return displayOrders.filter(o => o.status === 'OPEN').reduce((sum, o) => sum + (Number(o.current_pnl) || 0), 0);
    }, [displayOrders]);

    const totalRawLots = useMemo(() => {
        return displayOrders.filter(o => o.status === 'OPEN').reduce((sum, o) => sum + (Number(o.raw_lot_size) || 0), 0);
    }, [displayOrders]);

    const totalStandardLots = totalRawLots / 100;

    return (
        <div className="flex flex-col h-screen w-full bg-gradient-to-b from-[#1a120b] to-[#3e2723] overflow-hidden font-sans">
            {/* Top Frame: Luxury HUD */}
            <div className="w-full h-24 bg-black/60 backdrop-blur-md border-b border-amber-500/30 flex items-center justify-between px-4 sm:px-8 shadow-2xl shrink-0 z-10 relative">
                <div className="flex flex-col">
                    <h1 className="text-xl sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 tracking-wider">
                        EasyGold Farm
                    </h1>
                    <span className="text-sm text-amber-200/60 font-mono tracking-widest mt-1">PORT: {portNumber}</span>
                </div>

                <div className="flex items-center gap-6 sm:gap-12">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] sm:text-xs text-amber-500/70 uppercase tracking-widest font-semibold mb-1">Floating PnL</span>
                        <span className={`text-xl sm:text-3xl font-bold font-mono transition-colors duration-300 ${floatingPnl >= 0 ? 'text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.4)]' : 'text-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.4)]'}`}>
                            {floatingPnl >= 0 ? '+' : ''}{floatingPnl.toFixed(2)}
                        </span>
                    </div>

                    <div className="hidden sm:flex flex-col items-center">
                        <span className="text-[10px] sm:text-xs text-amber-500/70 uppercase tracking-widest font-semibold mb-1">Standard Lots</span>
                        <span className="text-lg sm:text-xl font-bold text-amber-100 font-mono">{totalStandardLots.toFixed(2)}</span>
                    </div>

                    <div className="flex flex-col items-end min-w-[100px]">
                        <span className="text-[10px] sm:text-xs text-amber-500/70 uppercase tracking-widest font-semibold mb-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-amber-400" /> Time
                        </span>
                        <span className="text-base sm:text-lg font-mono text-amber-200">{time.toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* Main Canvas / Gameplay Area */}
            <div className="flex-1 w-full flex items-center justify-center p-4 sm:p-8 relative">

                {/* 1:1 Aspect Ratio Farm Plot */}
                <div className="relative w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl aspect-square bg-[#2d1b11] rounded-3xl border-[6px] border-[#4e342e] shadow-[inset_0_20px_60px_rgba(0,0,0,0.6),0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden">

                    {/* Dirt texture & Lighting */}
                    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-900/40 via-[#3e2723] to-black" />

                    {/* Grid Pattern Background */}
                    <div className="absolute inset-0 opacity-50 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:10%_10%]" />

                    {/* Base Environment Trees (Planted uniformly) */}
                    <div className="absolute inset-2 sm:inset-6 grid grid-cols-8 grid-rows-8 gap-0 sm:gap-1 opacity-85 pointer-events-none">
                        {Array.from({ length: 64 }).map((_, i) => (
                            <div key={`base_tree_${i}`} className="w-full h-full flex items-center justify-center">
                                <span className="text-[1.75rem] sm:text-4xl md:text-5xl lg:text-[4.5rem] drop-shadow-[0_8px_10px_rgba(0,0,0,0.5)]">
                                    🌳
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Plot Label */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-gradient-to-b from-[#8d6e63] to-[#5d4037] border-2 border-[#3e2723] px-8 py-2.5 rounded-xl shadow-2xl z-20 flex flex-col items-center">
                        <h2 className="text-amber-50 font-bold text-base sm:text-lg tracking-widest uppercase shadow-black drop-shadow-md">
                            {isDemo ? 'DEMO FARM' : time.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h2>
                        {isDemo && <span className="text-[10px] text-amber-200/80 tracking-wider">Simulated Data</span>}
                    </div>

                    {/* Render Order "Flowers" dynamically */}
                    {displayOrders.map(order => (
                        <FlowerNode
                            key={`${order.ticket_id}_${order.status}`}
                            order={order}
                        />
                    ))}

                </div>
            </div>
        </div>
    );
}

// Sub-component rendering the physics UI of a flower
function FlowerNode({ order }: { order: any }) {
    // 1. Calculate deterministic X, Y position inside 15% - 85% safe zone.
    const posX = useMemo(() => 15 + (seededRandom(order.ticket_id * 1.5) * 70), [order.ticket_id]);
    const posY = useMemo(() => 20 + (seededRandom(order.ticket_id * 2.5) * 65), [order.ticket_id]);

    // 2. Variable Sizing Rules (Mapping lot sizes to 5 scales)
    const sizeMap = () => {
        const s = order.raw_lot_size || 0;
        if (s < 10) return 'scale-75 text-sm';     // Size 1: Micro
        if (s < 50) return 'scale-90 text-base';   // Size 2: Small
        if (s < 100) return 'scale-100 text-lg';   // Size 3: Normal
        if (s < 500) return 'scale-125 text-xl';   // Size 4: Large
        return 'scale-150 text-2xl drop-shadow-xl z-10'; // Size 5: Jumbo
    };

    // 3. Status and color mapping
    const appearance = () => {
        const status = order.status;

        // Morph state: Profit (Golden Fruit)
        if (status === 'CLOSED_TP') {
            return {
                baseClass: 'bg-gradient-to-tr from-yellow-300 via-yellow-100 to-white shadow-[0_0_25px_rgba(253,224,71,0.9)] border-yellow-200 z-20',
                innerElement: '✨',
                animation: 'animate-bounce'
            };
        }

        // Morph state: Loss (Dead/Burned)
        if (status === 'CLOSED_SL') {
            return {
                baseClass: 'bg-gradient-to-br from-[#4e342e] to-[#212121] shadow-none border-[#3e2723] opacity-60 z-0',
                innerElement: '🥀',
                animation: 'grayscale'
            };
        }

        // OPEN State: Risk Gradient 0 -> 100
        const risk = order.sl_risk_percent || 0;
        if (risk < 10) {
            // Very Safe (Near TP / Floating Positive)
            return { baseClass: 'bg-gradient-to-tr from-yellow-400 to-yellow-100 shadow-[0_0_20px_rgba(250,204,21,0.6)] border-yellow-300', innerElement: '🏵️', animation: 'animate-pulse' };
        } else if (risk < 40) {
            // Moderate Risk
            return { baseClass: 'bg-gradient-to-tr from-orange-400 to-yellow-400 shadow-[0_0_10px_rgba(251,146,60,0.5)] border-orange-300', innerElement: '🌸', animation: '' };
        } else if (risk < 75) {
            // High Risk
            return { baseClass: 'bg-gradient-to-tr from-orange-600 to-orange-400 border-orange-500', innerElement: '🌺', animation: '' };
        } else {
            // Danger Limits (Near SL)
            return { baseClass: 'bg-gradient-to-tr from-[#795548] to-[#ffb74d] border-[#5d4037]', innerElement: '🍂', animation: '' };
        }
    };

    const { baseClass, innerElement, animation } = appearance();

    return (
        <div
            className={`absolute flex flex-col items-center justify-center transition-all duration-[2000ms] ease-out group cursor-default ${sizeMap()} ${animation}`}
            style={{
                left: `${posX}%`,
                top: `${posY}%`,
                transform: 'translate(-50%, -50%)',
                // Add a small randomized rotation for natural asymmetry
                rotate: `${-15 + (seededRandom(order.ticket_id) * 30)}deg`
            }}
        >
            {/* The Plant Shape */}
            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-[3px] transition-colors duration-1000 ${baseClass}`}>
                <span className="drop-shadow-sm">{innerElement}</span>
            </div>

            {/* Hover Tooltip (Interactive Reveal) */}
            <div className="absolute top-full mt-2 w-max opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-[10px] px-3 py-1.5 rounded-lg pointer-events-none z-50 shadow-2xl border border-white/10 flex flex-col items-center">
                <span className="font-mono text-amber-500 mb-0.5">#{order.ticket_id} | {order.type}</span>
                <span className={`font-bold ${Number(order.current_pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${Number(order.current_pnl || 0).toFixed(2)}
                </span>
                {order.status === 'OPEN' && (
                    <span className="text-gray-400 mt-0.5 text-[9px]">Risk: {Number(order.sl_risk_percent || 0).toFixed(0)}%</span>
                )}
            </div>
        </div>
    );
}
