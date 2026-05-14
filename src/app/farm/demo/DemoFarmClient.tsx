'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import FarmHud, { FarmMobileStatsOverlay } from '@/components/farm-hud';
import Image from 'next/image';
import Link from 'next/link';
import SpaceshipDashboard from '@/components/spaceship-dashboard';
import { Trophy, X, Filter } from 'lucide-react';

// --- Utilities ---
function seededRandom(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// ==========================================
// 🛠️ CONFIGURABLE VARIABLES (สำหรับปรับจูนระยะ)
// ==========================================
const TILE_W = 98;
const TILE_H_OFFSET = 55;
const TREE_Y_OFFSET = 8;

const FRUIT_SPAWN_Y_MIN = 10;
const FRUIT_SPAWN_Y_MAX = 42;
const FRUIT_SPAWN_X_MIN = 25;
const FRUIT_SPAWN_X_MAX = 75;

// 15 predefined invisible slots on the tree bush for organic placement
const TREE_SLOTS = Array.from({ length: 15 }).map((_, i) => ({
    x: FRUIT_SPAWN_X_MIN + seededRandom(i * 10) * (FRUIT_SPAWN_X_MAX - FRUIT_SPAWN_X_MIN),
    y: FRUIT_SPAWN_Y_MIN + seededRandom(i * 20) * (FRUIT_SPAWN_Y_MAX - FRUIT_SPAWN_Y_MIN),
    z: i
}));

export default function DemoFarmClient({ portNumber, initialOrders, initialPortStatus, scaleFactor = 0.1, demoBalance = 10000, customName, adminMessage, challengeStartDate }: { portNumber: string, initialOrders: any[], initialPortStatus?: any, scaleFactor: number, demoBalance: number, customName?: string, adminMessage?: string | null, challengeStartDate?: string }) {
    const [orders, setOrders] = useState<any[]>(initialOrders);
    const [portStatus, setPortStatus] = useState<any>(initialPortStatus || { balance: '1000.00', equity: '750.00', account_type: 'USC' });
    const [time, setTime] = useState<Date | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [recentlyClosed, setRecentlyClosed] = useState<any[]>([]);
    const [isShaking, setIsShaking] = useState(false);
    const [hiddenTickets, setHiddenTickets] = useState<number[]>([]);
    
    // Leaderboard states
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);
    const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | number>('all');
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const [periodOffset, setPeriodOffset] = useState<number>(0);
    const [allHistoryData, setAllHistoryData] = useState<any[]>([]);
    const [masterPortStatusData, setMasterPortStatusData] = useState<any>(null);

    useEffect(() => {
        const getCurrUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) setCurrentUserId(session.user.id);
        };
        getCurrUser();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            setLoadingLeaderboard(true);
            const [usersRes, histRes, statusRes] = await Promise.all([
                supabase.from('admin_demo_challenges_view').select('*'),
                supabase.from('farm_daily_history').select('*').eq('port_number', portNumber).order('date', { ascending: false }),
                supabase.from('farm_port_status').select('*').eq('port_number', portNumber).single()
            ]);
            if (usersRes.data) setLeaderboardUsers(usersRes.data);
            if (histRes.data) setAllHistoryData(histRes.data);
            if (statusRes.data) setMasterPortStatusData(statusRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingLeaderboard(false);
        }
    };

    useEffect(() => {
        if (showLeaderboard) fetchLeaderboard();
    }, [showLeaderboard]);

    const formatGregorian = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Get current date in Bangkok timezone (UTC+7) to avoid US vs TH date mismatch
    const getBangkokDate = () => {
        const bkkStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        const [y, m, d] = bkkStr.split('-').map(Number);
        const cleanY = y > 2500 ? y - 543 : y;
        return new Date(cleanY, m - 1, d);
    };

    const getPeriodInfo = (tf: 'daily' | 'weekly' | 'monthly', offset: number) => {
        const today = getBangkokDate();
        if (tf === 'daily') {
            const d = new Date(today);
            d.setDate(d.getDate() - offset);
            const dateStr = formatGregorian(d);
            const shortDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            let label = shortDate;
            if (offset === 0) label = `วันนี้ (${shortDate})`;
            else if (offset === 1) label = `เมื่อวาน (${shortDate})`;
            const dayOfWeek = d.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            return { startStr: dateStr, endStr: dateStr, label, isWeekend };
        } else if (tf === 'weekly') {
            const d = new Date(today);
            d.setDate(d.getDate() - offset * 7);
            const day = d.getDay();
            const start = new Date(d);
            start.setDate(start.getDate() - day);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            
            const startStr = formatGregorian(start);
            const endStr = formatGregorian(end);
            const startLabel = start.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            const endLabel = end.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
            let label = `${startLabel} - ${endLabel}`;
            if (offset === 0) label = `สัปดาห์นี้ (${label})`;
            else if (offset === 1) label = `สัปดาห์ที่แล้ว (${label})`;
            return { startStr, endStr, label, isWeekend: false };
        } else {
            const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
            const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            const startStr = formatGregorian(d);
            const endStr = formatGregorian(end);
            let label = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
            if (offset === 0) label = `เดือนนี้ (${label})`;
            else if (offset === 1) label = `เดือนที่แล้ว (${label})`;
            return { startStr, endStr, label, isWeekend: false };
        }
    };
    
    // Smooth out today's profit to ignore sudden 0s during EA "รวบไม้" heartbeat glitches
    const [smoothedTodayProfit, setSmoothedTodayProfit] = useState(0);
    const lastDayRef = useRef('');
    const [viewMode, setViewMode] = useState<'farm' | 'spaceship'>('farm');
    const [clickCount, setClickCount] = useState(0);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const ordersRef = useRef<any[]>(initialOrders);

    // Sync ref with state for use in subscription cleanup
    useEffect(() => { ordersRef.current = orders; }, [orders]);

    useEffect(() => {
        setIsClient(true);
        setTime(new Date());
        const timer = setInterval(() => setTime(new Date()), 10000); // Only need date update occasionally

        const handleResize = () => {
            if (!containerRef.current) return;
            const winW = window.innerWidth;
            const winH = window.innerHeight - 110; // Space for HUD (110px)

            // Base size of our isometric plot is roughly 1000x800 including depth
            const baseW = 1100;
            const baseH = 900;

            const scaleW = winW / baseW;
            const scaleH = winH / baseH;

            // Use the smaller scale but limit zoom in for extremely large screens to maintain quality
            let newScale = Math.min(scaleW, scaleH);
            if (newScale > 1.2) newScale = 1.2;
            if (newScale < 0.3) newScale = 0.3; // Minimum fallback

            setScale(newScale);
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call

        // Re-calculate on viewMode change as well
        if (viewMode === 'farm') {
            setTimeout(handleResize, 50); 
        }

        return () => {
            clearInterval(timer);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // --- Real-time Subscription ---
    useEffect(() => {
        const channel = supabase
            .channel(`farm_updates_${portNumber}`)
            // Existing subscription logic...
            // Real-time updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'farm_port_status', filter: `port_number=eq.${portNumber}` },
                (payload) => {
                    if (payload.new) {
                        const newStatus = payload.new as any;
                        const masterBalance = Number(newStatus.balance) || 100000;
                        const proportionalRatio = 0.1 * scaleFactor;
                        
                        const floatingPnl = Number(newStatus.floating_pnl || 0) * proportionalRatio;
                        setPortStatus({
                            ...newStatus,
                            master_balance: masterBalance, // Save for order scaling
                            floating_pnl: floatingPnl,
                            total_lots: Number(newStatus.total_lots || 0) * proportionalRatio,
                            buy_pnl: Number(newStatus.buy_pnl || 0) * proportionalRatio,
                            sell_pnl: Number(newStatus.sell_pnl || 0) * proportionalRatio,
                            today_pnl: Number(newStatus.today_pnl || 0) * proportionalRatio,
                            today_closed_lots: Number(newStatus.today_closed_lots || 0) * proportionalRatio,
                            daily_max_drawdown: Number(newStatus.daily_max_drawdown || 0) * scaleFactor,
                            balance: demoBalance,
                            equity: demoBalance + floatingPnl
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'farm_active_orders', filter: `port_number=eq.${portNumber}` },
                (payload) => {
                    setPortStatus((currentStatus: any) => {
                        const proportionalRatio = 0.1 * scaleFactor;

                        if (payload.eventType === 'INSERT') {
                            const newOrder = payload.new as any;
                            const scaledOrder = {
                                ...newOrder,
                                current_pnl: Number(newOrder.current_pnl || 0) * proportionalRatio,
                                raw_lot_size: Number(newOrder.raw_lot_size || 0) * proportionalRatio
                            };
                            setOrders(prev => [...prev.filter(o => o.ticket_id !== scaledOrder.ticket_id), scaledOrder]);
                        } else if (payload.eventType === 'UPDATE') {
                            const newOrder = payload.new as any;
                            const scaledOrder = {
                                ...newOrder,
                                current_pnl: Number(newOrder.current_pnl || 0) * proportionalRatio,
                                raw_lot_size: Number(newOrder.raw_lot_size || 0) * proportionalRatio
                            };
                            setOrders(prev => prev.map(o => o.ticket_id === scaledOrder.ticket_id ? scaledOrder : o));
                        } else if (payload.eventType === 'DELETE') {
                            const oldOrder = payload.old as any;
                            const closedOrder = ordersRef.current.find(o => o.ticket_id === oldOrder.ticket_id);
                            if (closedOrder) {
                                pendingCloseQueue.current.push({
                                    ticket_id: closedOrder.ticket_id,
                                    pnl: Number(closedOrder.current_pnl) || 0,
                                    closedAt: Date.now()
                                });
                            }
                            setOrders(prev => prev.filter(o => o.ticket_id !== oldOrder.ticket_id));
                        }
                        
                        return currentStatus; // Return unmodified to avoid state update loops
                    });
                }
            )
            .subscribe();

        // [ON-DEMAND SYNC] Signal to the server that we are actively viewing this port
        const pingInterval = setInterval(async () => {
            await supabase.rpc('ping_farm_view', { p_port_number: portNumber });
        }, 20000); // Ping every 20 seconds

        // Initial ping
        supabase.rpc('ping_farm_view', { p_port_number: portNumber });

        return () => { 
            supabase.removeChannel(channel); 
            clearInterval(pingInterval);
        };
    }, [portNumber]);

    // --- Dynamic Theming ---
    const rawAsset = portStatus?.asset_type || 'GOLD';
    const assetType = rawAsset.toUpperCase() === 'EASYGOLD' ? 'GOLD' : rawAsset;
    const theme = useMemo(() => ({
        open: assetType === 'FOREX' ? '/farm/asset_a_lily.png' : '/farm/asset_a_lotus.png',
        profit: assetType === 'FOREX' ? '/farm/asset_b_orange.png' : '/farm/asset_b_apple.png',
        dead: assetType === 'FOREX' ? '/farm/asset_c_dead_forex.png' : '/farm/asset_c_dead.png'
    }), [assetType]);

    // Cleanup recently closed orders
    useEffect(() => {
        if (recentlyClosed.length === 0) return;
        const timer = setInterval(() => {
            const now = Date.now();
            setRecentlyClosed(prev => prev.filter(o => (now - o.closedAt) < 10000));
        }, 1000);
        return () => clearInterval(timer);
    }, [recentlyClosed]);

    // Auto-detect closed orders from portStatus dropping
    const prevOpenCountRef = useRef(0);
    const prevTodayProfitRef = useRef(0);
    // Batch orders closing aggregator for "รวบไม้" (Grid closes)
    const pendingCloseQueue = useRef<{ ticket_id: number, pnl: number, closedAt: number }[]>([]);
    useEffect(() => {
        const interval = setInterval(() => {
            if (pendingCloseQueue.current.length > 0) {
                const now = Date.now();
                const lastItem = pendingCloseQueue.current[pendingCloseQueue.current.length - 1];
                
                // Wait 400ms after the last delete event to ensure the whole batch has finished arriving
                if (now - lastItem.closedAt > 400) {
                    const batch = pendingCloseQueue.current;
                    pendingCloseQueue.current = [];
                    
                    const totalPnl = batch.reduce((sum, o) => sum + o.pnl, 0);
                    const isProfit = totalPnl >= 0;
                    
                    const newEvents = batch.map(o => ({
                        ticket_id: o.ticket_id,
                        closedAt: now,
                        isProfit: isProfit // Uniform profit/loss logic for the entire basket
                    }));
                    
                    setRecentlyClosed(prev => [...prev, ...newEvents]);
                    
                    if (isProfit) {
                        setTimeout(() => {
                            setIsShaking(true);
                            setTimeout(() => setIsShaking(false), 500);
                        }, 9500);
                    }
                }
            }
        }, 100);
        return () => clearInterval(interval);
    }, []);

    // Cleanup old events
    useEffect(() => {
        const interval = setInterval(() => {
            setRecentlyClosed(prev => prev.filter(e => Date.now() - e.closedAt < 15000));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Ignore 0 profit momentarily caused by EA sync delays
    useEffect(() => {
        if (!portStatus) return;
        const currentPnl = Number(portStatus.today_pnl || 0);
        
        let serverDate = new Date();
        if (portStatus.server_time) {
            serverDate = new Date(Number(portStatus.server_time) * 1000);
        }
        
        const dayStr = serverDate.toISOString().split('T')[0];
        
        if (lastDayRef.current !== dayStr) {
            // New day or first load
            lastDayRef.current = dayStr;
            setSmoothedTodayProfit(currentPnl);
        } else {
            // Same day: if currentPnl drops to exactly 0 suddenly but it was positive, ignore it!
            if (currentPnl === 0 && smoothedTodayProfit > 0) {
                // momentary 0 drop, ignore
            } else {
                setSmoothedTodayProfit(currentPnl);
            }
        }
    }, [portStatus?.today_pnl, portStatus?.server_time, smoothedTodayProfit]);

    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        const currentOpenCount = (Number(portStatus?.buy_count) || 0) + (Number(portStatus?.sell_count) || 0);

        if (isInitialLoad) {
            if (currentOpenCount !== undefined && portStatus?.balance) {
                prevOpenCountRef.current = currentOpenCount;
                setIsInitialLoad(false);
            }
            return;
        }

        prevOpenCountRef.current = currentOpenCount;
    }, [portStatus?.buy_count, portStatus?.sell_count, isInitialLoad]);

    const isDemo = orders.length === 0 && !portStatus?.balance;
    const allDisplayOrders = useMemo(() => isDemo ? Array.from({ length: 25 }).map((_, i) => ({
        ticket_id: 2000 + i,
        type: i % 2 === 0 ? 'BUY' : 'SELL',
        status: 'OPEN',
        current_pnl: i % 3 === 0 ? 309.24 : -150.00,
        sl_risk_percent: 5,
        raw_lot_size: 20
    })) : orders, [isDemo, orders]);

    const displayOrders = useMemo(() =>
        allDisplayOrders.filter(o => !hiddenTickets.includes(o.ticket_id)),
        [allDisplayOrders, hiddenTickets]);

    const simulateOrderClose = (order: any) => {
        if (hiddenTickets.includes(order.ticket_id)) return;
        const pnl = Number(order.current_pnl) || 0;
        const newEvent = { ...order, closedAt: Date.now(), isProfit: pnl >= 0 };
        setRecentlyClosed(prev => [...prev, newEvent]);
        setHiddenTickets(prev => [...prev, order.ticket_id]);
        if (pnl > 0) {
            setTimeout(() => {
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 500);
            }, 9500);
        }
    };

    const stats = useMemo(() => {
        // If EA is sending data to farm_port_status, use that directly
        if (portStatus?.floating_pnl !== undefined) {
            return {
                openOrdersCount: orders.length,
                floatingPnl: Number(portStatus.floating_pnl),
                totalLots: Number(portStatus.total_lots),
                buyCount: Number(portStatus.buy_count),
                sellCount: Number(portStatus.sell_count),
                buyPnl: Number(portStatus.buy_pnl),
                sellPnl: Number(portStatus.sell_pnl),
                balance: Number(portStatus.balance),
                equity: Number(portStatus.equity),
                maxDrawdown: Number(portStatus.max_drawdown || 0),
                todayProfit: Number(portStatus.today_pnl || 0),
                serverTime: portStatus.server_time ? new Date(Number(portStatus.server_time) * 1000) : new Date(),
                // Correct broker day progress: use modulo to extract HH:MM from raw broker timestamp
                // (avoids timezone mismatch since MQL5 TimeCurrent is broker-local, not UTC)
                brokerDayPercent: (() => {
                    const raw = Number(portStatus.server_time);
                    if (!raw) return null;
                    const secFromMidnight = raw % 86400;
                    return secFromMidnight / 86400 * 100;
                })()
            };
        }
        
        // Fallback to local calculation for simulated data
        const openOrders = displayOrders.filter(o => o.status === 'OPEN');
        const floatingPnl = openOrders.reduce((sum, o) => sum + (Number(o.current_pnl) || 0), 0);
        const totalLots = openOrders.reduce((sum, o) => sum + (Number(o.raw_lot_size) || 0), 0) / 100;
        const buyOrders = openOrders.filter(o => o.type === 'BUY');
        const sellOrders = openOrders.filter(o => o.type === 'SELL');
        const buyPnl = buyOrders.reduce((sum, o) => sum + (Number(o.current_pnl) || 0), 0);
        const sellPnl = sellOrders.reduce((sum, o) => sum + (Number(o.current_pnl) || 0), 0);

        return {
            openOrdersCount: openOrders.length,
            floatingPnl,
            totalLots,
            buyCount: buyOrders.length,
            sellCount: sellOrders.length,
            buyPnl,
            sellPnl,
            balance: Number(portStatus?.balance) || 51540.20,
            equity: Number(portStatus?.equity) || (51540.20 + floatingPnl),
            maxDrawdown: Math.max(0, Math.floor(((Number(portStatus?.balance || 51540.20) - Number(portStatus?.equity || 51540.20)) / Number(portStatus?.balance || 51540.20)) * 100)),
            todayProfit: Number(portStatus?.today_pnl || 0),
            serverTime: new Date(),
            brokerDayPercent: null
        };
    }, [displayOrders, portStatus, orders]);

    const treePriority = useMemo(() => {
        const order = Array.from({ length: 25 }).map((_, i) => ({ index: i, c: i % 5, r: Math.floor(i / 5) }));
        return order.sort((a, b) => (a.c - a.r) - (b.c - b.r) || (a.c + a.r) - (b.c + b.r)).map(o => o.index);
    }, []);

    const flowerPriority = useMemo(() => {
        const order = Array.from({ length: 25 }).map((_, i) => ({
            index: i,
            score: (i % 5 - Math.floor(i / 5)) * 10 + (seededRandom(i * 55) * 15)
        }));
        return order.sort((a, b) => b.score - a.score).map(o => o.index);
    }, []);

    const plot = useMemo(() => {
        const balance = Number(portStatus?.balance) || 51540.20;
        const equity = Number(portStatus?.equity) || balance;
        const drawdown = Math.max(0, Math.floor(((balance - equity) / balance) * 100));

        const treeLevels = new Array(25).fill(4);
        let pointsToLose = drawdown;
        for (const idx of treePriority) {
            if (pointsToLose <= 0) break;
            const damage = Math.min(pointsToLose, 4);
            treeLevels[idx] -= damage;
            pointsToLose -= damage;
        }

        const trees = Array.from({ length: 25 }).map((_, i) => ({ assets: [] as any[], level: treeLevels[i] }));
        // Use real orders if available, otherwise generate synthetic flowers from portStatus counts
        // (farm_active_orders may be empty due to heartbeat sync not sending orders)
        const realOpenOrders = displayOrders.filter(o => o.status === 'OPEN');
        const totalOpenFromStatus = (Number(portStatus?.buy_count) || 0) + (Number(portStatus?.sell_count) || 0);
        
        const openLotusAssets = realOpenOrders.length > 0
            ? realOpenOrders.map(o => ({ type: 'OPEN_LOTUS', ticketId: o.ticket_id }))
            : totalOpenFromStatus > 0
                ? Array.from({ length: Math.min(totalOpenFromStatus, 100) }).map((_, i) => ({ type: 'OPEN_LOTUS', ticketId: 90000 + i }))
                : [];

        const allAssets = [
            ...openLotusAssets,
            ...recentlyClosed.map(o => ({ type: o.isProfit ? 'PROFIT_FRUIT' : 'LOSS_DEAD', ticketId: o.ticket_id }))
        ];

        allAssets.forEach((asset, i) => {
            const jitteredIdx = Math.floor(Math.pow(seededRandom(i * 77 + 123), 1.8) * 25);
            const treeIdx = flowerPriority[jitteredIdx];
            const tree = trees[treeIdx];
            const occupiedSlots = tree.assets.map(a => a.slotId);
            let slotId = Math.floor(seededRandom(i * 99 + 456) * 15);
            while (occupiedSlots.includes(slotId) && occupiedSlots.length < 15) { slotId = (slotId + 1) % 15; }
            if (occupiedSlots.length < 15) { tree.assets.push({ ...asset, slotId }); }
        });

        return { pnl: stats.floatingPnl, trees };
    }, [displayOrders, recentlyClosed, stats.floatingPnl, portStatus, treePriority, flowerPriority]);

    // --- Fetch Real History ---
    const [history, setHistory] = useState<any[]>([]);
    useEffect(() => {
        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('farm_daily_history')
                .select('*')
                .eq('port_number', portNumber)
                .order('date', { ascending: false })
                .limit(30);

            if (data) {
                setHistory(data.reverse());
            }
        };

        fetchHistory();
        
        // Listen for history updates
        const historyChannel = supabase
            .channel('history_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_daily_history', filter: `port_number=eq.${portNumber}` }, fetchHistory)
            .subscribe();

        return () => { supabase.removeChannel(historyChannel); };
    }, [portNumber]);

    const brokerDateStr = useMemo(() => {
        const d = stats.serverTime;
        // Use Thailand time as the constant reference for the dashboard
        return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }); // 'en-CA' gives YYYY-MM-DD
    }, [stats.serverTime]);

    const dailyHistory = useMemo(() => {
        if (!history.length) return [];
        
        // Filter out the broker's "today" using Thailand timezone reference
        let filteredData = history.filter(item => item.date !== brokerDateStr);
        
        // Filter out history before the user joined the challenge
        if (challengeStartDate) {
            const startD = new Date(challengeStartDate);
            // Convert to YYYY-MM-DD in BKK timezone for accurate comparison
            const startStr = startD.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            filteredData = filteredData.filter(item => item.date >= startStr);
        }
        
        const accountType = portStatus?.account_type || 'USC';

        return filteredData.map(item => {
            const proportionalRatio = 0.1 * scaleFactor;
            const pnl = Number(item.profit) * proportionalRatio;
            const isUSD = accountType.toUpperCase().trim() === 'USD' || accountType.toUpperCase().trim() === 'STANDARD';
            const cents = isUSD ? pnl * 100 : pnl;
            
            let asset = '/farm/base_farmbox_empty.png';
            if (pnl < 0) asset = '/farm/base_farmbox_lose.png';
            else if (cents > 2000) asset = '/farm/base_farmbox_full.png';
            else if (cents > 1000) asset = '/farm/base_farmbox_mid.png';
            else if (cents > 0) asset = '/farm/base_farmbox_min.png';
            
            // Re-parse the date string into a localized Thailand date for display
            const localDate = new Date(item.date + 'T00:00:00');
            return {
                id: item.id,
                date: localDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
                pnl,
                asset
            };
        });
    }, [history, brokerDateStr, portStatus?.account_type, challengeStartDate]);

    const historyScrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (historyScrollRef.current) {
            historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth;
        }
    }, [isClient, dailyHistory]);

    const handleSecretToggle = () => {
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        
        setClickCount(prev => {
            const nextCount = prev + 1;
            console.log(`[EAEZE] Secret Click Count: ${nextCount}/5`);
            
            if (nextCount >= 5) {
                console.log("[EAEZE] Toggle View Mode from:", viewMode);
                const nextMode = viewMode === 'farm' ? 'spaceship' : 'farm';
                setViewMode(nextMode);
                window.scrollTo(0,0);
                // Trigger a resize calculation to fix layout after unmounting spaceship
                setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
                return 0;
            }
            return nextCount;
        });

        clickTimeoutRef.current = setTimeout(() => {
            setClickCount(0);
            clickTimeoutRef.current = null;
        }, 2000);
    };

    if (viewMode === 'spaceship') {
        return (
            <div className="relative">
                <SpaceshipDashboard 
                    portNumber={portNumber}
                    stats={{
                        balance: stats.balance,
                        equity: stats.equity,
                        floatingPnl: stats.floatingPnl,
                        maxDrawdown: stats.maxDrawdown,
                        totalLots: stats.totalLots,
                        buyCount: stats.buyCount,
                        sellCount: stats.sellCount,
                        buyPnl: stats.buyPnl,
                        sellPnl: stats.sellPnl,
                        todayProfit: stats.todayProfit
                    }}
                    accountType={portStatus?.account_type || 'USC'}
                    assetType={assetType}
                    systemCode={portStatus?.system_code}
                    eaVersion={portStatus?.ea_version}
                />
                {/* Visual indicator for secret toggle back */}
                <div 
                    className="fixed top-0 left-0 w-20 h-20 z-[100] cursor-pointer opacity-0 hover:opacity-10"
                    onClick={handleSecretToggle}
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full overflow-hidden font-sans relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#e3f0ff] via-[#b5d6f4] to-[#7fb2df] select-none">

            {/* FIXED HEADER SECTION (HUD + TIMELINE) */}
            <div className="fixed top-0 left-0 w-full z-[100] bg-[#16120e] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <FarmHud
                    title="EASYM DEMO CHALLENGE"
                    customName={customName}
                    adminMessage={adminMessage}
                    portNumber={portNumber}
                    balance={Number(portStatus?.balance) || 0}
                    equity={Number(portStatus?.equity) || 0}
                    floatingPnl={stats.floatingPnl}
                    totalStandardLots={stats.totalLots}
                    accountType={portStatus?.account_type || 'USC'}
                    buyCount={stats.buyCount}
                    sellCount={stats.sellCount}
                    buyPnl={stats.buyPnl}
                    sellPnl={stats.sellPnl}
                    todayProfit={smoothedTodayProfit}
                    todayClosedLots={Number(portStatus?.today_closed_lots) || 0}
                    dailyMaxDrawdown={Number(portStatus?.daily_max_drawdown) || 0}
                    assetType={assetType}
                    isShaking={isShaking}
                    systemCode={portStatus?.system_code}
                    onClick={handleSecretToggle}
                />
                
                {/* 1-Day Trading Timeline Bar: left=open, right=close, bar shrinks from right */}
                <div className="relative w-full bg-black/40 border-y border-amber-900/20 py-1 sm:py-2">
                    <div className="max-w-7xl mx-auto px-4 relative">
                        <div className="h-1.5 sm:h-2 w-full bg-white/5 rounded-full relative overflow-hidden">
                            {/* Only render client-side to prevent SSR/hydration timezone mismatch */}
                            {isClient && (() => {
                                const pct = stats.brokerDayPercent !== null
                                    ? stats.brokerDayPercent
                                    : ((time?.getHours() ?? 0) * 60 + (time?.getMinutes() ?? 0)) / (24 * 60) * 100;
                                const remaining = Math.max(0, 100 - pct);
                                return (
                                    <div 
                                        className="absolute top-0 right-0 h-full bg-gradient-to-r from-amber-300/30 via-amber-400/60 to-amber-500/90 transition-all duration-1000 rounded-full"
                                        style={{ width: `${remaining}%` }}
                                    />
                                );
                            })()}
                        </div>
                        <div className="absolute inset-0 px-4 flex justify-between items-center pointer-events-none">
                            {Array.from({ length: 25 }).map((_, i) => (
                                <div key={`h_${i}`} className={`h-2 sm:h-3 w-[1px] ${i % 6 === 0 ? 'bg-white/40' : 'bg-white/10'}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* MOBILE ONLY OVERLAY DOCKED BELOW HEADER */}
            <FarmMobileStatsOverlay
                portNumber={portNumber}
                buyCount={stats.buyCount}
                sellCount={stats.sellCount}
                buyPnl={stats.buyPnl}
                sellPnl={stats.sellPnl}
                balance={Number(portStatus?.balance) || 0}
                todayProfit={smoothedTodayProfit}
                accountType={portStatus?.account_type || 'USC'}
                todayClosedLots={Number(portStatus?.today_closed_lots) || 0}
                dailyMaxDrawdown={Number(portStatus?.daily_max_drawdown) || 0}
                totalStandardLots={stats.totalLots}
                isShaking={isShaking}
            />

            <div ref={containerRef} className="flex-1 w-full relative h-full flex items-center justify-center mt-36 sm:mt-44">
                <div
                    className="relative transition-all duration-500 ease-out origin-center"
                    style={{ transform: `scale(${isClient ? scale : 1})`, width: '100px', height: '100px' }}
                >
                    <div className="absolute left-1/2 top-1/2 -ml-[140px] -mt-[360px]">
                        {Array.from({ length: 25 }).map((_, i) => {
                            const c = i % 5;
                            const r = Math.floor(i / 5);
                            const tZIndex = (c + r) + 20;
                            const tree = plot.trees[i];

                            return (
                                <div
                                    key={`tile_${i}`}
                                    className="absolute"
                                    style={{ left: `${(c - r) * TILE_W}px`, top: `${(c + r) * TILE_H_OFFSET}px`, zIndex: tZIndex, width: '280px', height: '280px' }}
                                >
                                    {isClient && (
                                        <div className="absolute inset-0" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                            <Image
                                                src={
                                                    tree.level === 4 ? '/farm/base_tree_new.png' :
                                                        tree.level === 3 ? '/farm/base_tree_state2.png' :
                                                            tree.level === 2 ? '/farm/base_tree_state3.png' :
                                                                '/farm/base_tree_state4.png'
                                                }
                                                alt="T" fill className="object-contain object-bottom drop-shadow-2xl" unoptimized priority={true}
                                            />
                                            {tree.assets.map((asset, aIdx) => {
                                                const slot = TREE_SLOTS[asset.slotId];
                                                return (
                                                    <div
                                                        key={`order_${asset.ticketId || aIdx}`}
                                                        className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 drop-shadow-xl 
                                                            ${asset.type === 'OPEN_LOTUS' ? 'animate-pulse' : ''}
                                                            ${asset.type === 'PROFIT_FRUIT' ? 'animate-float-fade' : ''}
                                                            ${asset.type === 'LOSS_DEAD' ? 'animate-fade-out' : ''}
                                                        `}
                                                        style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: tZIndex + 1 }}
                                                    >
                                                        {asset.type === 'OPEN_LOTUS' && (
                                                            <div
                                                                className="w-full h-full relative pointer-events-auto cursor-pointer"
                                                                onClick={() => simulateOrderClose(displayOrders.find(o => o.ticket_id === asset.ticketId))}
                                                            >
                                                                <Image src={theme.open} alt="O" fill className="object-contain" unoptimized />
                                                            </div>
                                                        )}
                                                        {asset.type === 'PROFIT_FRUIT' && <Image src={theme.profit} alt="P" fill className="object-contain pointer-events-none" unoptimized />}
                                                        {asset.type === 'LOSS_DEAD' && <Image src={theme.dead} alt="L" fill className="object-contain opacity-70 pointer-events-none" unoptimized />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {i === 24 && (
                                        <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                            <div className="bg-[#1f1611]/95 border border-[#cfa545] rounded-sm px-6 py-2 shadow-2xl relative">
                                                <h2 className="text-[#cfa545] font-black tracking-widest text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,1)] whitespace-nowrap">
                                                    {isClient ? stats.serverTime.toLocaleDateString('en-GB', { 
                                                        day: 'numeric', 
                                                        month: 'short', 
                                                        year: 'numeric',
                                                        timeZone: 'Asia/Bangkok'
                                                    }).toUpperCase() : '...'}
                                                </h2>
                                            </div>
                                            <div className="w-1.5 h-16 bg-gradient-to-b from-[#8b5a2bd0] to-[#4a2e12d0] shadow-xl relative -mt-1 rounded-b-full border-x border-[#3a220f] z-0"></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {isClient && (
                <div className="fixed bottom-0 left-0 w-full h-28 sm:h-40 bg-black/40 backdrop-blur-sm border-t border-amber-900/40 z-[60] flex flex-col">
                    {/* Desktop header row */}
                    <div className="hidden sm:flex justify-between px-6 pt-2 mb-1">
                        <span className="text-[10px] text-amber-200/50 uppercase tracking-[0.2em] font-bold">
                            Demo Harvest History (Scaled x{scaleFactor})
                        </span>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowLeaderboard(true)}
                                className="flex items-center gap-1.5 text-[10px] bg-gradient-to-r from-[#cfa545]/20 to-[#996a22]/20 hover:from-[#cfa545]/40 hover:to-[#996a22]/40 text-[#cfa545] border border-[#cfa545]/50 px-3.5 py-1.5 rounded transition-all uppercase font-bold shadow-[0_0_15px_rgba(207,165,69,0.2)] hover:shadow-[0_0_20px_rgba(207,165,69,0.4)]"
                            >
                                <Trophy className="w-3.5 h-3.5" />อันดับแคมเปญ
                            </button>
                            <Link 
                                href="/dashboard"
                                className="flex items-center gap-1.5 text-[10px] bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40 px-3.5 py-1.5 rounded transition-all uppercase font-bold shadow-[0_0_10px_rgba(245,158,11,0.1)] hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                กลับสู่หน้าหลัก Dashboard
                            </Link>
                        </div>
                    </div>

                    {/* Crates scroll row (mobile: inline 90D button at END of scroll, desktop: fill remaining space) */}
                    <div
                        ref={historyScrollRef}
                        className="flex-1 w-full overflow-x-auto overflow-y-hidden flex items-center gap-3 sm:gap-6 px-3 sm:px-6 py-1 sm:py-2 no-scrollbar"
                    >
                        {dailyHistory.map((item) => (
                            <div key={item.id} className="flex-shrink-0 flex flex-col items-center group">
                                <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-110 drop-shadow-xl">
                                    <Image src={item.asset} alt="Box" fill className="object-contain" unoptimized />
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-[8px] sm:text-[9px] text-amber-100/40 font-mono tracking-tighter">{item.date}</span>
                                    <span className={`text-[10px] sm:text-[11px] font-mono font-bold ${item.pnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                        {item.pnl >= 0 ? '+' : ''}{(portStatus?.account_type?.toUpperCase().trim() === 'USC' || portStatus?.account_type?.toUpperCase().trim() === 'CENT') ? '' : '$'}{item.pnl.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Mobile-only: Square Leaderboard button + 90D button at the end */}
                        <button
                            onClick={() => setShowLeaderboard(true)}
                            className="sm:hidden flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-gradient-to-b from-[#cfa545]/20 to-[#996a22]/20 hover:from-[#cfa545]/35 hover:to-[#996a22]/35 text-[#cfa545] border border-[#cfa545]/50 rounded-lg transition-colors ml-auto font-bold text-center px-1 shadow-[0_0_15px_rgba(207,165,69,0.2)]"
                        >
                            <Trophy className="w-5 h-5 mb-1 animate-pulse" />
                            <span className="text-[8px] uppercase tracking-tighter">อันดับ</span>
                        </button>

                        <Link 
                            href="/dashboard"
                            className="sm:hidden flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40 rounded-lg transition-colors font-bold text-center px-1"
                        >
                            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                            <span className="text-[8px] uppercase tracking-tighter">แดชบอร์ด</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* LEADERBOARD MODAL */}
            {showLeaderboard && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-auto">
                    <div className="bg-[#1e140c] border-2 border-[#cfa545] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(207,165,69,0.3)] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 sm:p-6 bg-gradient-to-r from-[#2c1b10] to-[#1e140c] border-b border-[#cfa545]/30">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-[#cfa545] flex-shrink-0 animate-bounce" />
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-base sm:text-2xl font-extrabold text-[#cfa545] tracking-wide truncate">$100 Demo Challenge Leaderboard</h2>
                                    <p className="text-[10px] sm:text-xs text-amber-200/60 truncate">กระดานจัดอันดับผู้ทำกำไรสูงสุดแบบเรียลไทม์</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowLeaderboard(false)}
                                className="p-1 sm:p-2 text-amber-200/60 hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0 ml-2"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        {/* Filter Bar */}
                        <div className="space-y-2 p-3 sm:p-4 bg-[#170e08] border-b border-[#cfa545]/20">
                            {/* Row 1: Timeframe Mode Buttons */}
                            <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl border border-amber-500/20 w-full">
                                {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={() => { setLeaderboardTimeframe(tf); setPeriodOffset(0); }}
                                        className={`py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all text-center truncate ${
                                            leaderboardTimeframe === tf
                                                ? 'bg-[#cfa545] text-black shadow-[0_0_15px_rgba(207,165,69,0.5)]'
                                                : 'hover:bg-white/5 text-amber-200/60'
                                        }`}
                                    >
                                        {tf === 'daily' ? '📅 รายวัน' : tf === 'weekly' ? '🗓️ สัปดาห์' : '📊 เดือน'}
                                    </button>
                                ))}
                            </div>

                            {/* Row 2: Risk Filter Buttons */}
                            <div className="grid grid-cols-4 gap-1 bg-black/30 p-1 rounded-xl border border-amber-500/10 w-full">
                                {(['all', 1.0, 1.5, 2.0] as const).map((filter) => (
                                    <button
                                        key={String(filter)}
                                        onClick={() => setLeaderboardFilter(filter)}
                                        className={`py-1 px-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all text-center truncate ${
                                            leaderboardFilter === filter
                                                ? 'bg-[#cfa545] text-black shadow-[0_0_15px_rgba(207,165,69,0.5)]'
                                                : 'hover:bg-white/5 text-amber-200/70'
                                        }`}
                                    >
                                        {filter === 'all' ? '🌟 ทั้งหมด' : filter === 1.0 ? '🛡️ เซฟ' : filter === 1.5 ? '🚀 เติบโต' : '🔥 ซิ่ง'}
                                    </button>
                                ))}
                            </div>

                            {/* Row 3: Period Offset Navigation */}
                            <div className="flex items-center justify-between w-full font-mono bg-black/30 px-3 py-1.5 rounded-xl border border-amber-500/10 text-[11px] sm:text-xs">
                                <button
                                    onClick={() => setPeriodOffset(o => o + 1)}
                                    className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-lg font-bold transition-all flex items-center gap-1 flex-shrink-0"
                                >
                                    ◀<span className="hidden sm:inline"> อดีต</span>
                                </button>
                                {(() => {
                                    const info = getPeriodInfo(leaderboardTimeframe, periodOffset);
                                    return <span className="font-bold text-[#cfa545] truncate px-1 text-center">{info.label}</span>;
                                })()}
                                <button
                                    onClick={() => setPeriodOffset(o => Math.max(0, o - 1))}
                                    disabled={periodOffset === 0}
                                    className={`px-2 py-1 border rounded-lg font-bold transition-all flex items-center gap-1 flex-shrink-0 ${
                                        periodOffset === 0 
                                            ? 'bg-transparent text-amber-200/20 border-amber-500/10 cursor-not-allowed' 
                                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border-amber-500/30'
                                    }`}
                                >
                                    <span className="hidden sm:inline">ล่าสุด </span>▶
                                </button>
                            </div>
                        </div>

                        {/* User List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3">
                            {loadingLeaderboard ? (
                                <div className="py-12 text-center text-amber-200/50 animate-pulse font-mono">กำลังโหลดกระดานจัดอันดับ...</div>
                            ) : leaderboardUsers.length === 0 ? (
                                <div className="py-12 text-center text-amber-200/40">ยังไม่มีผู้เข้าร่วมแคมเปญ</div>
                            ) : (() => {
                                const { startStr, endStr, isWeekend } = getPeriodInfo(leaderboardTimeframe, periodOffset);
                                const todayStr = formatGregorian(getBangkokDate());
                                const sourceHistory = allHistoryData.length > 0 ? allHistoryData : history;
                                const activeStatus = masterPortStatusData || initialPortStatus;

                                const usersWithPeriodPnl = leaderboardUsers.map(u => {
                                    const risk = Number(u.risk_level) || 1.0;
                                    const portNum = u.master_port_number || portNumber || '100000';
                                    const joinDateStr = u.join_date ? String(u.join_date).split('T')[0] : '2000-01-01';
                                    const isBeforeJoin = endStr < joinDateStr;
                                    
                                    // Strip time 'T00:00:00' from database date strings to match pure YYYY-MM-DD
                                    // Strictly exclude any trading history before the user's specific join_date
                                    const histRows = sourceHistory.filter(h => {
                                        if (String(h.port_number || portNumber) !== String(portNum)) return false;
                                        const cleanDate = h.date?.split('T')[0];
                                        return cleanDate >= startStr && cleanDate <= endStr && cleanDate >= joinDateStr;
                                    });
                                    let totalMasterPnl = histRows.reduce((sum, h) => sum + Number(h.profit), 0);
                                    
                                    if (periodOffset === 0 && todayStr >= startStr && todayStr <= endStr && todayStr >= joinDateStr) {
                                        const hasTodayRow = histRows.some(h => h.date?.split('T')[0] === todayStr);
                                        if (!hasTodayRow && activeStatus && String(activeStatus.port_number || portNumber) === String(portNum)) {
                                            totalMasterPnl += Number(activeStatus.today_pnl || 0);
                                        }
                                    }

                                    const periodGrowth = totalMasterPnl * 0.1 * risk;

                                    // Calculate all-time cumulative profit since join_date for true live current balance
                                    const allTimeHistRows = sourceHistory.filter(h => {
                                        if (String(h.port_number || portNumber) !== String(portNum)) return false;
                                        const cleanDate = h.date?.split('T')[0];
                                        return cleanDate >= joinDateStr;
                                    });
                                    let allTimeMasterPnl = allTimeHistRows.reduce((sum, h) => sum + Number(h.profit), 0);
                                    if (todayStr >= joinDateStr) {
                                        const hasTodayRow = allTimeHistRows.some(h => h.date?.split('T')[0] === todayStr);
                                        if (!hasTodayRow && activeStatus && String(activeStatus.port_number || portNumber) === String(portNum)) {
                                            allTimeMasterPnl += Number(activeStatus.today_pnl || 0);
                                        }
                                    }
                                    const allTimeGrowth = allTimeMasterPnl * 0.1 * risk;
                                    const liveCurrentBalance = 10000 + allTimeGrowth;

                                    return {
                                        ...u,
                                        periodGrowth,
                                        isBeforeJoin,
                                        current_balance: periodOffset === 0 ? liveCurrentBalance : 10000 + periodGrowth
                                    };
                                }).filter(u => {
                                    const r = Number(u.risk_level);
                                    if (leaderboardFilter === 1.0) return r < 1.5;
                                    if (leaderboardFilter === 1.5) return r >= 1.5 && r < 2.0;
                                    if (leaderboardFilter === 2.0) return r >= 2.0;
                                    return true;
                                }).sort((a, b) => b.periodGrowth - a.periodGrowth);

                                if (usersWithPeriodPnl.length === 0) return <div className="py-12 text-center text-amber-200/40">ไม่มีข้อมูลในสัปดาห์/เดือนนี้</div>;

                                return (
                                    <>
                                        {leaderboardTimeframe === 'daily' && isWeekend && (
                                            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl text-center mb-4 flex items-center justify-center gap-2 shadow-inner">
                                                <span className="text-xl">🏖️</span>
                                                <span className="text-amber-200 font-bold text-xs">ตลาดปิดทำการ (วันหยุดเสาร์-อาทิตย์)</span>
                                            </div>
                                        )}
                                        {usersWithPeriodPnl.map((user, idx) => {
                                            const isMe = currentUserId && user.user_id === currentUserId;
                                            const growth = user.periodGrowth;
                                            
                                            let badge = <span className="text-lg font-mono font-bold text-amber-200/40 w-8 text-center">{idx + 1}</span>;
                                            if (idx === 0) badge = <span className="text-2xl animate-pulse">🏆</span>;
                                            else if (idx === 1) badge = <span className="text-2xl">🥈</span>;
                                            else if (idx === 2) badge = <span className="text-2xl">🥉</span>;

                                            return (
                                                <div 
                                                    key={user.id}
                                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                                        isMe 
                                                            ? 'bg-gradient-to-r from-[#cfa545]/20 to-[#996a22]/20 border-[#cfa545] shadow-[0_0_20px_rgba(207,165,69,0.3)] scale-[1.02]' 
                                                            : 'bg-[#170e08] hover:bg-[#21150e] border-amber-900/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex items-center justify-center w-10">
                                                            {badge}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-white text-sm">
                                                                    {user.user_name || user.user_email?.split('@')[0] || 'Trader'}
                                                                </span>
                                                                {isMe && (
                                                                    <span className="bg-[#cfa545] text-black font-extrabold text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                                                                        พอร์ตของคุณ
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-amber-200/60 mt-0.5">
                                                                {Number(user.risk_level) < 1.5 
                                                                    ? `🛡️ สายเซฟ (x${Number(user.risk_level).toFixed(1)})` 
                                                                    : Number(user.risk_level) < 2.0 
                                                                    ? `🚀 สายเติบโต (x${Number(user.risk_level).toFixed(1)})` 
                                                                    : `🔥 สายซิ่ง (x${Number(user.risk_level).toFixed(1)})`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {user.isBeforeJoin ? (
                                                        <div className="text-right">
                                                            <span className="bg-amber-500/10 text-amber-200/40 border border-amber-500/20 text-[10px] sm:text-xs px-2.5 py-1 rounded-lg font-mono inline-block">
                                                                ยังไม่เข้าร่วม
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-right">
                                                            <div className="font-mono font-extrabold text-[#4de180] text-base">
                                                                ${Number(user.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className={`font-mono text-xs font-bold ${growth >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                                                {growth >= 0 ? '+' : ''}{growth.toFixed(2)} USC
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

