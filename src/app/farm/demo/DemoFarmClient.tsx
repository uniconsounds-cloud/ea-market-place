'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import FarmHud, { FarmMobileStatsOverlay } from '@/components/farm-hud';
import Image from 'next/image';
import Link from 'next/link';
import SpaceshipDashboard from '@/components/spaceship-dashboard';
import { Trophy, X, Filter, BarChart3, TrendingUp, ShieldCheck, Clock, Users, ArrowUpRight, Award, Zap, ChevronRight, CheckCircle2, DollarSign, Sparkles, Rocket } from 'lucide-react';

// --- Utilities ---
function seededRandom(seed: number) {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * Calculates the effective market trading date (Forex broker market day).
 * Market day begins at 05:00 AM Thailand time (Asia/Bangkok).
 * Before 05:00 AM (00:00:00 - 04:59:59), it retains the previous day's date.
 */
function getMarketTradingDate(date: Date): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
        partMap[p.type] = p.value;
    }
    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10) - 1;
    const day = parseInt(partMap.day, 10);
    const hour = parseInt(partMap.hour, 10);

    const bkkDate = new Date(year, month, day);
    if (hour < 5) {
        bkkDate.setDate(bkkDate.getDate() - 1);
    }
    return bkkDate;
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

export default function DemoFarmClient({ portNumber, initialOrders, initialPortStatus, scaleFactor = 1.0, demoBalance = 100000, customName, adminMessage, challengeStartDate, userId, referrerId }: { portNumber: string, initialOrders: any[], initialPortStatus?: any, scaleFactor: number, demoBalance: number, customName?: string, adminMessage?: string | null, challengeStartDate?: string, userId?: string, referrerId?: string }) {
    const [orders, setOrders] = useState<any[]>(initialOrders);
    const [portStatus, setPortStatus] = useState<any>(initialPortStatus || { balance: '100000.00', equity: '100000.00', account_type: 'USC' });
    const [currentCustomName, setCurrentCustomName] = useState(customName || '');
    const [currentAdminMessage, setCurrentAdminMessage] = useState(adminMessage || '');
    
    useEffect(() => {
        if (customName) setCurrentCustomName(customName);
    }, [customName]);

    useEffect(() => {
        if (adminMessage) setCurrentAdminMessage(adminMessage);
    }, [adminMessage]);

    // History states
    const [historyTab, setHistoryTab] = useState<'my' | 'master'>('my');
    const [time, setTime] = useState<Date | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [recentlyClosed, setRecentlyClosed] = useState<any[]>([]);
    const [isShaking, setIsShaking] = useState(false);
    const [hiddenTickets, setHiddenTickets] = useState<number[]>([]);
    
    // Fleet Statistics states
    const [showFleetStats, setShowFleetStats] = useState(false);
    const [fleetStatsData, setFleetStatsData] = useState<any>(null);
    const [loadingFleetStats, setLoadingFleetStats] = useState(false);
    const [fleetTimeframe, setFleetTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [statsCurrency, setStatsCurrency] = useState<'USC' | 'USD'>('USC');
    const [showOpenRealAccountModal, setShowOpenRealAccountModal] = useState(false);
    const fleetTimelineScrollRef = useRef<HTMLDivElement>(null);

    const getFleetFarmBoxAsset = (centsOrProfit: number) => {
        if (centsOrProfit < 0) return '/farm/base_farmbox_lose.png';
        if (centsOrProfit > 2000) return '/farm/base_farmbox_full.png';
        if (centsOrProfit > 1000) return '/farm/base_farmbox_mid.png';
        if (centsOrProfit > 0) return '/farm/base_farmbox_min.png';
        return '/farm/base_farmbox_empty.png';
    };

    useEffect(() => {
        if (fleetTimelineScrollRef.current) {
            fleetTimelineScrollRef.current.scrollLeft = fleetTimelineScrollRef.current.scrollWidth;
        }
    }, [fleetTimeframe, showFleetStats, fleetStatsData]);

    // Leaderboard states (retained for backward compatibility if needed)
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);
    const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | number>('all');
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [hasIbMembership, setHasIbMembership] = useState<boolean | null>(null);
    const EASYM_MAX_PRODUCT_ID = '0b5e3b69-e7cf-4aa2-8701-e62e6c3cc365';
    const EASYM_MINI_PRODUCT_ID = 'e5784a85-50bd-48c8-8da0-4a6237b91df8';
    const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const [periodOffset, setPeriodOffset] = useState<number>(0);
    const [allHistoryData, setAllHistoryData] = useState<any[]>([]);
    const [masterPortStatusData, setMasterPortStatusData] = useState<any>(null);

    const fetchFleetStats = async () => {
        try {
            setLoadingFleetStats(true);
            const res = await fetch('/api/farm/fleet-stats');
            const data = await res.json();
            if (data.success) {
                setFleetStatsData(data);
            }
        } catch (err) {
            console.error('Error fetching fleet stats:', err);
        } finally {
            setLoadingFleetStats(false);
        }
    };

    useEffect(() => {
        if (showFleetStats && !fleetStatsData) {
            fetchFleetStats();
        }
    }, [showFleetStats, fleetStatsData]);

    useEffect(() => {
        const getCurrUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUserId(session.user.id);
                try {
                    const { data } = await supabase
                        .from('ib_memberships')
                        .select('id, status')
                        .eq('user_id', session.user.id);
                    if (data && data.length > 0) {
                        const hasValid = data.some(m => m.status === 'approved' || m.status === 'pending');
                        setHasIbMembership(hasValid);
                    } else {
                        setHasIbMembership(false);
                    }
                } catch (e) {
                    console.error('Error fetching IB membership:', e);
                    setHasIbMembership(false);
                }
            } else {
                setHasIbMembership(false);
            }
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

    const [isTabVisible, setIsTabVisible] = useState(true);
    const [isIdle, setIsIdle] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const isFirstRender = useRef(true);

    // Track user activity & window visibility
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleVisibilityChange = () => {
            setIsTabVisible(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        let activityTimeout: NodeJS.Timeout;
        const resetActivityTimer = () => {
            setIsIdle(false);
            clearTimeout(activityTimeout);
            // 15 minutes inactivity timeout
            activityTimeout = setTimeout(() => {
                setIsIdle(true);
            }, 15 * 60 * 1000);
        };

        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        events.forEach(event => {
            window.addEventListener(event, resetActivityTimer);
        });

        resetActivityTimer();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            events.forEach(event => {
                window.removeEventListener(event, resetActivityTimer);
            });
            clearTimeout(activityTimeout);
        };
    }, []);

    // Sync latest data when tab becomes visible and user is not idle
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (isTabVisible && !isIdle) {
            const syncData = async () => {
                setIsSyncing(true);
                try {
                    // Send ping immediately
                    await supabase.rpc('ping_farm_view', { p_port_number: portNumber });
                    
                    // Fetch latest data
                    const [statusRes, ordersRes] = await Promise.all([
                        supabase.from('farm_port_status').select('*').eq('port_number', portNumber).maybeSingle(),
                        supabase.from('farm_active_orders').select('*').eq('port_number', portNumber)
                    ]);
                    
                    const proportionalRatio = 1.0;
                    if (statusRes.data) {
                        const newStatus = statusRes.data;
                        const masterBalance = Number(newStatus.balance) || 100000;
                        const floatingPnl = Number(newStatus.floating_pnl || 0) * proportionalRatio;
                        setPortStatus({
                            ...newStatus,
                            master_balance: masterBalance,
                            floating_pnl: floatingPnl,
                            total_lots: Number(newStatus.total_lots || 0) * proportionalRatio,
                            buy_pnl: Number(newStatus.buy_pnl || 0) * proportionalRatio,
                            sell_pnl: Number(newStatus.sell_pnl || 0) * proportionalRatio,
                            today_pnl: Number(newStatus.today_pnl || 0) * proportionalRatio,
                            today_closed_lots: Number(newStatus.today_closed_lots || 0) * proportionalRatio,
                            daily_max_drawdown: Number(newStatus.daily_max_drawdown || 0),
                            balance: demoBalance,
                            equity: demoBalance + floatingPnl
                        });
                    }
                    if (ordersRes.data) {
                        const scaledOrders = ordersRes.data.map((order: any) => ({
                            ...order,
                            current_pnl: Number(order.current_pnl || 0) * proportionalRatio,
                            raw_lot_size: Number(order.raw_lot_size || 0) * proportionalRatio
                        }));
                        setOrders(scaledOrders);
                    }
                } catch (error) {
                    console.error("Error syncing on visibility change:", error);
                } finally {
                    setTimeout(() => {
                        setIsSyncing(false);
                    }, 1200);
                }
            };
            
            syncData();
        }
    }, [isTabVisible, isIdle, portNumber, scaleFactor, demoBalance]);

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
        if (!isTabVisible || isIdle) return;

        const channel = supabase
            .channel(`farm_updates_${portNumber}`)
            // Real-time updates
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'farm_port_status', filter: `port_number=eq.${portNumber}` },
                (payload) => {
                    if (payload.new) {
                        const newStatus = payload.new as any;
                        const masterBalance = Number(newStatus.balance) || 100000;
                        const proportionalRatio = 1.0;
                        
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
                            daily_max_drawdown: Number(newStatus.daily_max_drawdown || 0),
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
                        const proportionalRatio = 1.0;

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
            );

        if (userId) {
            channel.on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'demo_challenges', filter: `user_id=eq.${userId}` },
                (payload) => {
                    if (payload.new && (payload.new as any).port_name) {
                        setCurrentCustomName((payload.new as any).port_name);
                    }
                }
            );
        }

        if (referrerId) {
            channel.on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${referrerId}` },
                (payload) => {
                    if (payload.new) {
                        const newMsg = (payload.new as any).demo_broadcast_message;
                        if (newMsg) {
                            setCurrentAdminMessage(newMsg.replaceAll('$100 Demo Challenge', 'EasyM Live Tracker'));
                        } else {
                            setCurrentAdminMessage("💬 ADMIN: ยินดีต้อนรับสู่โครงการ EasyM Live Tracker! 🚀");
                        }
                    }
                }
            );
        }

        channel.subscribe();

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
    }, [portNumber, isTabVisible, isIdle, scaleFactor, demoBalance, userId, referrerId]);

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

    // --- Fetch Real History ---
    const [history, setHistory] = useState<any[]>([]);
    useEffect(() => {
        if (!isTabVisible || isIdle) return;

        const fetchHistory = async () => {
            const { data, error } = await supabase
                .from('farm_daily_history')
                .select('*')
                .eq('port_number', portNumber)
                .order('date', { ascending: false });

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
    }, [portNumber, isTabVisible, isIdle]);

    const liveUserBalance = useMemo(() => {
        if (!challengeStartDate) return demoBalance || 100000;
        
        const startD = new Date(challengeStartDate);
        const startStr = startD.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        
        // Sum history profits that occurred on or after startStr
        const validHistoryRows = history.filter(item => {
            const cleanDate = item.date?.split('T')[0];
            return cleanDate >= startStr;
        });
        
        let sumProfit = validHistoryRows.reduce((sum, item) => sum + Number(item.profit || 0), 0);
        
        // Also check if we should add today's closed profit if it hasn't been saved to history yet
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        if (todayStr >= startStr && portStatus) {
            const hasTodayRow = validHistoryRows.some(item => {
                const cleanDate = item.date?.split('T')[0];
                return cleanDate === todayStr;
            });
            if (!hasTodayRow) {
                sumProfit += Number(portStatus.today_pnl || 0);
            }
        }
        
        const computed = 100000 + sumProfit;
        return (computed > 100000 || history.length > 0) ? computed : (demoBalance || computed);
    }, [history, challengeStartDate, portStatus?.today_pnl, demoBalance]);

    const stats = useMemo(() => {
        // If EA is sending data to farm_port_status, use that directly
        if (portStatus?.floating_pnl !== undefined) {
            const currentBalanceValue = liveUserBalance;
            const currentEquityValue = liveUserBalance + Number(portStatus.floating_pnl);
            const floatingPnl = Number(portStatus.floating_pnl);
            const drawdownAmt = floatingPnl < 0 ? Math.abs(floatingPnl) : 0;
            const drawdownPct = currentBalanceValue > 0 ? (drawdownAmt / currentBalanceValue) * 100 : 0;
            
            return {
                openOrdersCount: orders.length,
                floatingPnl,
                drawdownAmount: drawdownAmt,
                drawdownPercent: drawdownPct,
                totalLots: Number(portStatus.total_lots),
                buyCount: Number(portStatus.buy_count),
                sellCount: Number(portStatus.sell_count),
                buyPnl: Number(portStatus.buy_pnl),
                sellPnl: Number(portStatus.sell_pnl),
                balance: currentBalanceValue,
                equity: currentEquityValue,
                maxDrawdown: currentBalanceValue > 0 ? (Number(portStatus.max_drawdown || 0) * Number(portStatus.master_balance || portStatus.balance || 10000) / currentBalanceValue) : 0,
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

        const currentBalanceValue = liveUserBalance;
        const currentEquityValue = liveUserBalance + floatingPnl;
        const maxDrawdownValue = Math.max(0, Math.floor(((currentBalanceValue - currentEquityValue) / currentBalanceValue) * 100));
        const drawdownAmt = floatingPnl < 0 ? Math.abs(floatingPnl) : 0;
        const drawdownPct = currentBalanceValue > 0 ? (drawdownAmt / currentBalanceValue) * 100 : 0;

        return {
            openOrdersCount: openOrders.length,
            floatingPnl,
            drawdownAmount: drawdownAmt,
            drawdownPercent: drawdownPct,
            totalLots,
            buyCount: buyOrders.length,
            sellCount: sellOrders.length,
            buyPnl,
            sellPnl,
            balance: currentBalanceValue,
            equity: currentEquityValue,
            maxDrawdown: maxDrawdownValue,
            todayProfit: Number(portStatus?.today_pnl || 0),
            serverTime: new Date(),
            brokerDayPercent: null
        };
    }, [displayOrders, portStatus, orders, liveUserBalance]);

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
        const balance = stats.balance;
        const equity = stats.equity;
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

    // History block moved to top

    const brokerDateStr = useMemo(() => {
        // Use Thailand market trading date as the constant reference for the dashboard (rolls over at 05:00 AM Bangkok)
        const mDate = getMarketTradingDate(time || new Date());
        const yyyy = mDate.getFullYear();
        const mm = String(mDate.getMonth() + 1).padStart(2, '0');
        const dd = String(mDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }, [time]);

    const dailyHistory = useMemo(() => {
        if (!history.length) return [];
        
        // Filter out the broker's "today" using Thailand timezone reference
        let filteredData = history.filter(item => item.date !== brokerDateStr);
        
        // Filter out history before the user joined the challenge if viewing 'my' tab
        if (historyTab === 'my' && challengeStartDate) {
            const startD = new Date(challengeStartDate);
            // Convert to YYYY-MM-DD in BKK timezone for accurate comparison
            const startStr = startD.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            filteredData = filteredData.filter(item => item.date >= startStr);
        }

        // Sort ascending by date
        const sorted = [...filteredData].sort((a, b) => a.date.localeCompare(b.date));

        // --- AUTOMATIC MISSING-DAY CHECKER & GAP FILLER ---
        const historyMap = new Map(sorted.map(item => [item.date.split('T')[0], item]));
        
        const filledList: any[] = [];
        if (sorted.length > 0) {
            const firstDateStr = sorted[0].date.split('T')[0];
            const startDate = new Date(firstDateStr + 'T00:00:00');

            const bkkDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
            const yesterdayDate = new Date(bkkDateStr + 'T00:00:00');
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);

            const curr = new Date(startDate);
            while (curr <= yesterdayDate) {
                const yyyy = curr.getFullYear();
                const mm = String(curr.getMonth() + 1).padStart(2, '0');
                const dd = String(curr.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                
                const dayOfWeek = curr.getDay(); // 0: Sun, 6: Sat
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

                if (historyMap.has(dateStr)) {
                    const item = historyMap.get(dateStr)!;
                    if (isWeekend && Math.abs(Number(item.profit)) < 0.01) {
                        // skip zero-profit weekend
                    } else {
                        filledList.push(item);
                    }
                } else if (!isWeekend) {
                    // MISSING WEEKDAY DETECTED! (e.g. Aug 17)
                    // Auto-fill missing weekday with 0 profit record
                    filledList.push({
                        id: `missing_${dateStr}`,
                        date: dateStr,
                        profit: 0,
                        isAutoFilled: true
                    });
                }

                curr.setDate(curr.getDate() + 1);
            }
        } else {
            filledList.push(...sorted);
        }

        const accountType = portStatus?.account_type || 'USC';
        const isUSC = accountType.toUpperCase().trim() === 'USC' || accountType.toUpperCase().trim() === 'CENT';

        const MARKET_HOLIDAYS: Record<string, string> = {
            '12-25': 'Christmas Day',
            '01-01': 'New Year\'s Day',
            '2026-04-03': 'Good Friday',
            '2027-03-26': 'Good Friday'
        };

        return filledList.map((item, idx) => {
            const proportionalRatio = 1.0;
            const pnl = Number(item.profit || 0) * proportionalRatio;
            const cents = isUSC ? pnl : pnl * 100;
            
            let asset = '/farm/base_farmbox_empty.png';
            if (pnl < 0) asset = '/farm/base_farmbox_lose.png';
            else if (cents > 2000) asset = '/farm/base_farmbox_full.png';
            else if (cents > 1000) asset = '/farm/base_farmbox_mid.png';
            else if (cents > 0) asset = '/farm/base_farmbox_min.png';
            
            // Check if this date is a market holiday and profit is 0
            const dateMD = item.date.substring(5); // 'MM-DD'
            const holidayName = MARKET_HOLIDAYS[dateMD] || MARKET_HOLIDAYS[item.date];
            const isHoliday = !!(holidayName && Math.abs(pnl) < 0.01);

            // Re-parse the date string into a localized Thailand date for display
            const localDate = new Date(item.date + 'T00:00:00');
            const dayOfWeek = localDate.getDay();
            
            // Week boundary detection (End of trading week / Friday / Gap before next item)
            let isEndOfWeek = dayOfWeek === 5;
            if (idx < filledList.length - 1) {
                const nextDate = new Date(filledList[idx + 1].date + 'T00:00:00');
                const diffDays = Math.round((nextDate.getTime() - localDate.getTime()) / (1000 * 3600 * 24));
                if (diffDays > 2 || nextDate.getDay() < dayOfWeek) {
                    isEndOfWeek = true;
                }
            }

            return {
                id: item.id,
                dateStr: item.date,
                date: localDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase(),
                pnl,
                asset,
                isHoliday,
                holidayName,
                isEndOfWeek
            };
        });
    }, [history, brokerDateStr, portStatus?.account_type, challengeStartDate, historyTab]);

    const historyScrollRef = useRef<HTMLDivElement>(null);
    const [isScrolledLeft, setIsScrolledLeft] = useState(false);

    const hasInitialScrolled = useRef(false);

    useEffect(() => {
        hasInitialScrolled.current = false;
    }, [portNumber]);

    useEffect(() => {
        if (historyScrollRef.current && dailyHistory.length > 0 && !hasInitialScrolled.current) {
            historyScrollRef.current.scrollLeft = historyScrollRef.current.scrollWidth;
            hasInitialScrolled.current = true;
        }
    }, [isClient, dailyHistory]);

    useEffect(() => {
        const el = historyScrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 15;
            setIsScrolledLeft(!isAtEnd);
        };

        el.addEventListener('scroll', handleScroll);
        const timer = setTimeout(handleScroll, 200);

        return () => {
            el.removeEventListener('scroll', handleScroll);
            clearTimeout(timer);
        };
    }, [dailyHistory, isClient]);

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
                        todayProfit: smoothedTodayProfit,
                        serverTime: stats.serverTime
                    }}
                    accountType={portStatus?.account_type || 'USC'}
                    assetType={assetType}
                    systemCode={portStatus?.system_code}
                    eaVersion={portStatus?.ea_version}
                    customName={currentCustomName}
                    adminMessage={currentAdminMessage || "ติดต่อผ่าน line ID : @jharvest"}
                    dailyMaxDrawdown={Number(portStatus?.daily_max_drawdown) || 0}
                    todayClosedLots={Number(portStatus?.today_closed_lots) || 0}
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
                    title="EASYM LIVE TRACKER"
                    customName={currentCustomName}
                    adminMessage={currentAdminMessage}
                    portNumber={portNumber}
                    balance={stats.balance}
                    equity={stats.equity}
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
                    drawdownPercent={stats.drawdownPercent}
                    drawdownAmount={stats.drawdownAmount}
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
                balance={stats.balance}
                todayProfit={smoothedTodayProfit}
                accountType={portStatus?.account_type || 'USC'}
                todayClosedLots={Number(portStatus?.today_closed_lots) || 0}
                dailyMaxDrawdown={Number(portStatus?.daily_max_drawdown) || 0}
                drawdownPercent={stats.drawdownPercent}
                drawdownAmount={stats.drawdownAmount}
                totalStandardLots={stats.totalLots}
                isShaking={isShaking}
                customName={currentCustomName}
                adminMessage={currentAdminMessage}
            />

            <div ref={containerRef} className="flex-1 w-full relative flex items-center justify-center pt-[182px] pb-[112px] sm:pt-[136px] sm:pb-[160px]">
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

                                    {/* Floating Drawdown Badge on Withered Trees (2-line layout: Big %, DD amount below) */}
                                    {(() => {
                                        const firstWitheredIdx = plot.trees.findIndex(t => t.level < 4);
                                        const targetIdx = firstWitheredIdx >= 0 ? firstWitheredIdx : 0;
                                        const hasDrawdown = stats.drawdownPercent > 0 || stats.floatingPnl < 0;
                                        if (i === targetIdx && hasDrawdown && isClient) {
                                            const isUSC = (portStatus?.account_type?.toUpperCase().trim() === 'USC' || portStatus?.account_type?.toUpperCase().trim() === 'CENT');
                                            const currPrefix = isUSC ? '' : '$';
                                            const currSuffix = isUSC ? ' USC' : '';
                                            const badgeCounterScale = (scale > 0 && scale < 0.38) ? (0.38 / scale) : 1;
                                            
                                            return (
                                                <div 
                                                    className="absolute -top-14 left-1/2 z-[90] flex flex-col items-center animate-fade-in pointer-events-none"
                                                    style={{
                                                        transform: `translateX(-50%) scale(${badgeCounterScale})`,
                                                        transformOrigin: 'bottom center'
                                                    }}
                                                >
                                                    <div className="bg-[#1a0505]/95 border sm:border-2 border-red-500/90 rounded-md sm:rounded-xl px-2 py-0.5 sm:px-5 sm:py-2.5 shadow-[0_0_15px_rgba(239,68,68,0.6)] sm:shadow-[0_0_35px_rgba(239,68,68,0.75)] text-center backdrop-blur-md flex flex-col items-center justify-center">
                                                        {/* Line 1: Percentage (compact on mobile to match right corner DD) */}
                                                        <div className="text-[17px] sm:text-xl font-mono font-black text-red-400 leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-nowrap">
                                                            -{stats.drawdownPercent.toFixed(2)}%
                                                        </div>
                                                        {/* Line 2: DD Amount */}
                                                        <div className="text-[11px] sm:text-xs font-mono font-bold text-red-300/80 leading-tight whitespace-nowrap mt-0.5">
                                                            -{currPrefix}{stats.drawdownAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{currSuffix}
                                                        </div>
                                                    </div>
                                                    <div className="w-0.5 sm:w-1 h-3 sm:h-6 bg-gradient-to-b from-red-500 via-red-500/60 to-transparent"></div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {i === 24 && (
                                        <div className="absolute top-[110px] left-1/2 -translate-x-1/2 z-50 flex flex-col items-center" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                            <div className="bg-[#1f1611]/95 border border-[#cfa545] rounded-sm px-6 py-2 shadow-2xl relative">
                                                <h2 className="text-[#cfa545] font-black tracking-widest text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,1)] whitespace-nowrap">
                                                    {isClient ? getMarketTradingDate(time || new Date()).toLocaleDateString('en-GB', { 
                                                        day: 'numeric', 
                                                        month: 'short', 
                                                        year: 'numeric'
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
                <div className="fixed bottom-0 left-0 w-full h-28 sm:h-40 bg-black/40 backdrop-blur-sm border-t border-amber-900/40 z-[60] flex flex-row items-center justify-between px-1.5 sm:px-4 py-0.5 sm:py-1.5 gap-1.5 sm:gap-4">
                    {/* Crates scroll row (Left side, flex-1) */}
                    <div
                        ref={historyScrollRef}
                        className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-3 sm:gap-6 py-1 sm:py-2 no-scrollbar"
                    >
                        {dailyHistory.map((item, idx) => (
                            <div key={item.id || idx} className="flex items-center flex-shrink-0">
                                <div className="flex flex-col items-center group relative">
                                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-110 drop-shadow-xl">
                                        <Image src={item.asset} alt="Box" fill className="object-contain" unoptimized />
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] sm:text-[9px] text-amber-100/40 font-mono tracking-tighter">{item.date}</span>
                                        {item.isHoliday ? (
                                            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-amber-400 animate-pulse" title={item.holidayName}>
                                                CLOSED
                                            </span>
                                        ) : (
                                            <span className={`text-[10px] sm:text-[11px] font-mono font-bold ${item.pnl >= 0 ? 'text-[#4de180]' : 'text-red-500'}`}>
                                                {item.pnl >= 0 ? '+' : ''}{(portStatus?.account_type?.toUpperCase().trim() === 'USC' || portStatus?.account_type?.toUpperCase().trim() === 'CENT') ? '' : '$'}{item.pnl.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Subtle Vertical Week Divider Line */}
                                {item.isEndOfWeek && idx < dailyHistory.length - 1 && (
                                    <div className="flex flex-col items-center justify-center mx-2 sm:mx-3 h-16 sm:h-20 self-start">
                                        <div className="w-[1px] h-full bg-gradient-to-b from-amber-500/0 via-amber-500/40 to-amber-500/0"></div>
                                        <span className="text-[7px] font-mono text-amber-400/40 font-bold uppercase tracking-widest mt-1 whitespace-nowrap">WEEK</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {/* Mobile spacer to prevent crates from being hidden behind absolute controls */}
                        <div className="hidden max-sm:block w-[155px] flex-shrink-0" />
                    </div>

                    {/* Divider line */}
                    <div className="hidden sm:block w-[1px] h-14 sm:h-24 bg-amber-900/30 flex-shrink-0" />

                    {/* Controls row (Right side, flex-shrink-0) */}
                    <div className={`flex-shrink-0 flex flex-col items-end justify-start gap-0.5 sm:gap-1 w-[155px] sm:w-[235px] h-full py-0.5 sm:py-1.5 transition-all duration-300 ease-in-out max-sm:absolute max-sm:right-1.5 max-sm:top-[4px] max-sm:bottom-[4px] max-sm:z-10 max-sm:bg-[#110c08]/95 max-sm:border max-sm:border-amber-900/30 max-sm:rounded-lg max-sm:px-2 max-sm:shadow-xl ${
                        isScrolledLeft 
                            ? 'max-sm:translate-x-[170px] max-sm:opacity-0 max-sm:pointer-events-none' 
                            : 'max-sm:translate-x-0 max-sm:opacity-100'
                    }`}>
                        {/* Header showing single line of text with lookback days */}
                        <span className="text-[7px] sm:text-[9px] text-[#cfa545] font-black tracking-wide whitespace-nowrap leading-none select-none self-end mt-0">
                            {historyTab === 'my' 
                                ? `พอร์ตติดตาม (ย้อนหลัง ${dailyHistory.length} วัน)` 
                                : `พอร์ตต้นแบบ (ย้อนหลัง ${dailyHistory.length} วัน)`}
                        </span>

                        {/* 2x2 Grid of equal buttons */}
                        <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full flex-1">
                            {/* ของฉัน Button */}
                            <button
                                onClick={() => setHistoryTab('my')}
                                className={`text-[9px] sm:text-[11px] w-full h-full rounded transition-all font-black text-center whitespace-nowrap border flex items-center justify-center ${
                                    historyTab === 'my' 
                                        ? 'bg-[#cfa545] text-black border-[#cfa545] shadow-[0_0_10px_rgba(207,165,69,0.3)]' 
                                        : 'bg-black/40 text-amber-200/60 border-amber-900/30 hover:text-white hover:bg-black/60'
                                }`}
                            >
                                ของฉัน
                            </button>

                            {/* พอร์ตหลัก Button */}
                            <button
                                onClick={() => setHistoryTab('master')}
                                className={`text-[9px] sm:text-[11px] w-full h-full rounded transition-all font-black text-center whitespace-nowrap border flex items-center justify-center ${
                                    historyTab === 'master' 
                                        ? 'bg-[#cfa545] text-black border-[#cfa545] shadow-[0_0_10px_rgba(207,165,69,0.3)]' 
                                        : 'bg-black/40 text-amber-200/60 border-amber-900/30 hover:text-white hover:bg-black/60'
                                }`}
                            >
                                พอร์ตหลัก
                            </button>

                            {/* สถิติผลงานระบบ Button */}
                            <button
                                onClick={() => setShowFleetStats(true)}
                                className="flex items-center justify-center gap-1 text-[9px] sm:text-[11px] w-full h-full bg-gradient-to-r from-[#cfa545]/20 to-[#996a22]/20 hover:from-[#cfa545]/40 hover:to-[#996a22]/40 text-[#cfa545] border border-[#cfa545]/50 rounded transition-all font-black uppercase whitespace-nowrap shadow-[0_0_10px_rgba(207,165,69,0.1)] hover:shadow-[0_0_15px_rgba(207,165,69,0.3)]"
                            >
                                <BarChart3 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-[#ffd700] animate-pulse" />
                                <span>สถิติ</span>
                            </button>

                            {/* แดชบอร์ด Link Button */}
                            <Link 
                                href="/dashboard"
                                className="flex items-center justify-center gap-1 text-[9px] sm:text-[11px] w-full h-full bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40 rounded transition-all font-black uppercase whitespace-nowrap shadow-[0_0_8px_rgba(245,158,11,0.05)] hover:shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                            >
                                <svg className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <span>แดชบอร์ด</span>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* FLEET STATISTICS MODAL */}
            {showFleetStats && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-auto">
                    <div className="bg-[#170e08] border-2 border-[#cfa545] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-[0_0_60px_rgba(207,165,69,0.35)] overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-[#2c1b10] via-[#1f130b] to-[#170e08] border-b border-[#cfa545]/30">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#ffd700]/20 to-[#cfa545]/10 border border-[#ffd700]/40 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(255,215,0,0.25)]">
                                    <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-[#ffd700] animate-pulse" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-base sm:text-xl font-extrabold text-[#ffd700] tracking-wide truncate">
                                            สถิติผลงาน EasyM Real Fleet
                                        </h2>
                                        <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                            <ShieldCheck className="w-3 h-3" />
                                            Verified MT5 Live
                                        </span>
                                    </div>
                                    <p className="text-[10px] sm:text-xs text-amber-200/60 truncate mt-0.5">
                                        สถิติความโปร่งใสและผลตอบแทนระยะยาวจากพอร์ตจริงระดับ Fleet ทั่วประเทศ
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowFleetStats(false)}
                                className="p-1.5 sm:p-2 text-amber-200/60 hover:text-white hover:bg-white/10 rounded-full transition-colors flex-shrink-0 ml-2"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        {/* Modal Body with Smooth Scroll */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3.5 sm:space-y-5">
                            {/* 1. Top Longevity & Trust Cards (Mobile-optimized tight gaps & short single-line labels) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
                                <div className="bg-[#1e140c]/90 border border-amber-500/25 rounded-xl p-2 sm:p-3 text-center shadow-sm relative overflow-hidden">
                                    <div className="text-[10px] sm:text-xs text-amber-200/70 flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#cfa545]" />
                                        <span>เปิดรันมาแล้ว</span>
                                    </div>
                                    <div className="text-lg sm:text-2xl font-black font-mono text-[#ffd700]">
                                        {fleetStatsData?.longevity?.daysRunning || 227} <span className="text-xs sm:text-sm font-sans text-amber-300">วัน</span>
                                    </div>
                                    <div className="text-[9px] text-amber-200/50 mt-0.5 truncate">
                                        ตั้งแต่ 1 ก.พ. 69
                                    </div>
                                </div>

                                <div className="bg-[#1e140c]/90 border border-amber-500/25 rounded-xl p-2 sm:p-3 text-center shadow-sm relative overflow-hidden">
                                    <div className="text-[10px] sm:text-xs text-amber-200/70 flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                                        <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#cfa545]" />
                                        <span>พอร์ตรันจริง</span>
                                    </div>
                                    <div className="text-lg sm:text-2xl font-black font-mono text-emerald-400">
                                        {fleetStatsData?.longevity?.activePorts || 202}+ <span className="text-xs sm:text-sm font-sans text-emerald-300">พอร์ต</span>
                                    </div>
                                    <div className="text-[9px] text-emerald-400/60 mt-0.5 truncate">
                                        ทั่วประเทศ (MT5 Live)
                                    </div>
                                </div>

                                <div className="bg-[#1e140c]/90 border border-amber-500/25 rounded-xl p-2 sm:p-3 text-center shadow-sm relative overflow-hidden">
                                    <div className="text-[10px] sm:text-xs text-amber-200/70 flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                                        <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#cfa545]" />
                                        <span>ทุนรวมระบบ</span>
                                    </div>
                                    <div className="text-sm sm:text-xl font-black font-mono text-[#ffd700] truncate">
                                        {statsCurrency === 'USC' 
                                            ? `${((fleetStatsData?.longevity?.totalFleetBalanceUSC || 14131884) / 1000000).toFixed(1)}M USC`
                                            : `$${Math.round((fleetStatsData?.longevity?.totalFleetBalanceUSD || 141319) / 1000)}k+`}
                                    </div>
                                    <div className="text-[9px] text-amber-200/50 mt-0.5 truncate">
                                        Fleet Capital
                                    </div>
                                </div>

                                <div className="bg-[#1e140c]/90 border border-amber-500/25 rounded-xl p-2 sm:p-3 text-center shadow-sm relative overflow-hidden">
                                    <div className="text-[10px] sm:text-xs text-amber-200/70 flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                                        <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#cfa545]" />
                                        <span>อัตราอยู่รอด</span>
                                    </div>
                                    <div className="text-lg sm:text-2xl font-black font-mono text-emerald-400">
                                        100%
                                    </div>
                                    <div className="text-[9px] text-emerald-400/80 font-bold mt-0.5 truncate">
                                        ไม่เคยล้างพอร์ต
                                    </div>
                                </div>
                            </div>

                            {/* 2. Controls & Tabs */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-black/40 p-1.5 sm:p-2 rounded-xl border border-[#cfa545]/20">
                                {/* Timeframe Tabs */}
                                <div className="grid grid-cols-3 gap-1 w-full sm:w-auto">
                                    {(['daily', 'weekly', 'monthly'] as const).map(tf => (
                                        <button
                                            key={tf}
                                            onClick={() => setFleetTimeframe(tf)}
                                            className={`py-1.5 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${
                                                fleetTimeframe === tf
                                                    ? 'bg-[#cfa545] text-black shadow-[0_0_12px_rgba(207,165,69,0.4)]'
                                                    : 'text-amber-200/60 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            {tf === 'daily' ? '📅 รายวัน' : tf === 'weekly' ? '🗓️ รายสัปดาห์' : '📊 รายเดือน'}
                                        </button>
                                    ))}
                                </div>

                                {/* Currency Unit Toggle */}
                                <div className="flex items-center gap-1 bg-[#1e140c] p-1 rounded-lg border border-amber-500/30 w-full sm:w-auto justify-center">
                                    <span className="text-[10px] text-amber-200/60 px-1 font-bold">หน่วย:</span>
                                    <button
                                        onClick={() => setStatsCurrency('USC')}
                                        className={`px-2 py-0.5 text-[10px] rounded font-mono font-bold transition-all ${
                                            statsCurrency === 'USC'
                                                ? 'bg-[#cfa545] text-black shadow-sm'
                                                : 'text-amber-200/60 hover:text-white'
                                        }`}
                                    >
                                        USC (เซนต์)
                                    </button>
                                    <button
                                        onClick={() => setStatsCurrency('USD')}
                                        className={`px-2 py-0.5 text-[10px] rounded font-mono font-bold transition-all ${
                                            statsCurrency === 'USD'
                                                ? 'bg-[#cfa545] text-black shadow-sm'
                                                : 'text-amber-200/60 hover:text-white'
                                        }`}
                                    >
                                        USD ($)
                                    </button>
                                </div>
                            </div>

                            {/* 2.5 Quick Comparison Bar: Today vs Yesterday (or Latest Trading Day) */}
                            {fleetStatsData && (
                                <div className="bg-[#140b06] border border-[#cfa545]/25 rounded-xl p-2 sm:p-2.5 shadow-inner">
                                    <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-amber-900/30">
                                        <div className="flex items-center gap-1.5">
                                            <Sparkles className="w-3 h-3 text-[#ffd700]" />
                                            <span className="text-[10px] sm:text-xs font-extrabold text-amber-200">เปรียบเทียบผลงานล่าสุด</span>
                                        </div>
                                        <span className="text-[8px] sm:text-[9px] font-mono text-amber-300/60 bg-black/40 px-1.5 py-0.2 rounded border border-amber-500/20">
                                            Today vs Yesterday
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                        {/* Yesterday */}
                                        <div className="bg-black/40 border border-amber-500/15 rounded-lg p-1.5 sm:p-2 flex flex-col justify-between">
                                            <div className="flex items-center justify-between text-[8px] sm:text-[10px] text-amber-200/60 mb-0.5">
                                                <span>เมื่อวาน ({fleetStatsData?.yesterday?.dateLabel || '15 ก.ย.'})</span>
                                                <span className="text-amber-400/80 font-mono">DD {fleetStatsData?.yesterday?.dd || 3.2}%</span>
                                            </div>
                                            <div className="text-xs sm:text-base font-black font-mono text-[#4de180]">
                                                +{statsCurrency === 'USC' 
                                                    ? `${(fleetStatsData?.yesterday?.profitUSC || 860).toLocaleString()} USC` 
                                                    : `$${(fleetStatsData?.yesterday?.profitUSD || 8.60).toFixed(2)}`}
                                            </div>
                                        </div>

                                        {/* Today */}
                                        <div className="bg-gradient-to-br from-[#24170d] to-[#160c06] border border-[#ffd700]/40 rounded-lg p-1.5 sm:p-2 flex flex-col justify-between shadow-[0_0_10px_rgba(255,215,0,0.1)]">
                                            <div className="flex items-center justify-between text-[8px] sm:text-[10px] text-amber-200 mb-0.5">
                                                <span className="font-bold text-[#ffd700] flex items-center gap-1">
                                                    <span>วันนี้</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                                                </span>
                                                <span className="text-emerald-400 font-mono font-bold">DD {fleetStatsData?.today?.dd || 2.8}%</span>
                                            </div>
                                            <div className="text-xs sm:text-base font-black font-mono text-[#ffd700]">
                                                +{statsCurrency === 'USC' 
                                                    ? `${(fleetStatsData?.today?.profitUSC || 380).toLocaleString()} USC` 
                                                    : `$${(fleetStatsData?.today?.profitUSD || 3.80).toFixed(2)}`}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2.6 Interactive Farm Crate Visual Timeline */}
                            {(() => {
                                const isDaily = fleetTimeframe === 'daily';
                                const isWeekly = fleetTimeframe === 'weekly';
                                const isMonthly = fleetTimeframe === 'monthly';

                                let timelineItems: any[] = [];
                                let currentPeriodItem: any = null;

                                if (isDaily) {
                                    const dList = fleetStatsData?.timeline?.daily || [];
                                    timelineItems = dList.slice(0, -1);
                                    currentPeriodItem = fleetStatsData?.today || (dList.length > 0 ? dList[dList.length - 1] : null);
                                } else if (isWeekly) {
                                    const wList = fleetStatsData?.timeline?.weekly || [];
                                    timelineItems = wList.slice(0, -1);
                                    currentPeriodItem = wList.length > 0 ? wList[wList.length - 1] : null;
                                } else {
                                    const mList = fleetStatsData?.timeline?.monthly || [];
                                    timelineItems = mList.slice(0, -1);
                                    currentPeriodItem = mList.length > 0 ? mList[mList.length - 1] : null;
                                }

                                const currentProfit = statsCurrency === 'USC'
                                    ? `${(currentPeriodItem?.profitUSC || 0).toLocaleString()} USC`
                                    : `$${(currentPeriodItem?.profitUSD || 0).toFixed(2)}`;
                                const currentDD = currentPeriodItem?.dd || 0;
                                const currentAsset = getFleetFarmBoxAsset(currentPeriodItem?.profitUSC || 0);
                                const currentPeriodTitle = isDaily ? 'วันนี้' : isWeekly ? 'สัปดาห์นี้' : 'เดือนนี้';

                                return (
                                    <div className="bg-[#150d08] border border-[#cfa545]/25 rounded-2xl p-2.5 sm:p-3.5 shadow-[0_0_20px_rgba(207,165,69,0.08)]">
                                        <div className="flex items-center justify-between mb-2 px-0.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-base sm:text-lg flex-shrink-0">📦</span>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs sm:text-sm font-extrabold text-[#ffd700] truncate">
                                                        กราฟิกเก็บเกี่ยวผลตอบแทน (Harvest Crate Timeline)
                                                    </h4>
                                                    <p className="text-[9px] sm:text-[10px] text-amber-200/50 truncate">
                                                        {isDaily ? 'ลังผลไม้ย้อนหลัง 30 วัน' : isWeekly ? 'ลังผลไม้ย้อนหลังรายสัปดาห์' : 'ลังผลไม้ย้อนหลัง 8 เดือน'} (เลื่อนดูประวัติฝั่งซ้ายได้)
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-[8px] sm:text-[9px] font-mono text-amber-300/70 bg-black/40 px-1.5 py-0.5 rounded-full border border-amber-500/20 flex-shrink-0 ml-1">
                                                {statsCurrency}
                                            </span>
                                        </div>

                                        <div className="flex flex-col-reverse sm:flex-row items-stretch gap-2 sm:gap-3 bg-[#0e0704] border border-amber-900/40 rounded-xl p-2 sm:p-3 relative overflow-hidden">
                                            {/* Left side: Scrollable track of past periods */}
                                            <div 
                                                ref={fleetTimelineScrollRef}
                                                className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-2.5 sm:gap-4 py-1"
                                            >
                                                {timelineItems.map((item: any, idx: number) => {
                                                    const pUSC = item.profitUSC || 0;
                                                    const pUSD = item.profitUSD || 0;
                                                    const pLabel = statsCurrency === 'USC' ? `+${pUSC.toLocaleString()}` : `+$${pUSD.toFixed(2)}`;
                                                    const asset = getFleetFarmBoxAsset(pUSC);
                                                    const label = item.dateLabel || item.weekLabel || item.monthLabel || '';
                                                    return (
                                                        <div key={idx} className="flex items-center flex-shrink-0">
                                                            <div className="flex flex-col items-center group relative min-w-[54px] sm:min-w-[64px]">
                                                                {/* Profit above crate */}
                                                                <span className="text-[9px] sm:text-[10px] font-mono font-black text-[#4de180] whitespace-nowrap mb-0.5 drop-shadow-sm">
                                                                    {pLabel}
                                                                </span>
                                                                {/* Crate Image */}
                                                                <div className="relative w-11 h-11 sm:w-14 sm:h-14 transition-transform duration-200 group-hover:scale-110 drop-shadow-md">
                                                                    <Image src={asset} alt="Crate" fill className="object-contain" unoptimized />
                                                                </div>
                                                                {/* Label & DD below crate */}
                                                                <div className="flex flex-col items-center mt-0.5">
                                                                    <span className="text-[8px] sm:text-[9px] text-amber-200/70 font-mono tracking-tight whitespace-nowrap">
                                                                        {label}
                                                                    </span>
                                                                    <span className="text-[7px] sm:text-[8px] font-mono font-bold text-amber-400 bg-black/60 px-1 py-0.2 rounded border border-amber-500/20 mt-0.5">
                                                                        DD {item.dd}%
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Divider for weekend boundary */}
                                                            {item.isEndOfWeek && isDaily && idx < timelineItems.length - 1 && (
                                                                <div className="flex flex-col items-center justify-center mx-1 h-12 self-center">
                                                                    <div className="w-[1px] h-8 bg-gradient-to-b from-amber-500/0 via-amber-500/40 to-amber-500/0"></div>
                                                                    <span className="text-[6px] font-mono text-amber-400/50 font-bold uppercase tracking-widest mt-0.5">WK</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Vertical Divider for desktop / Horizontal for mobile */}
                                            <div className="hidden sm:block w-[1px] bg-gradient-to-b from-transparent via-[#cfa545]/40 to-transparent flex-shrink-0" />
                                            <div className="block sm:hidden h-[1px] w-full bg-amber-900/40 flex-shrink-0 my-0.5" />

                                            {/* Right side: Large Featured Crate for Current Period */}
                                            <div className="flex-shrink-0 bg-gradient-to-b from-[#2a1b10] via-[#1c120a] to-[#120a05] border-2 border-[#ffd700]/60 rounded-xl p-2 flex flex-col items-center justify-center min-w-[105px] sm:min-w-[130px] shadow-[0_0_20px_rgba(255,215,0,0.18)] relative">
                                                <span className="text-[8px] sm:text-[9px] font-bold text-[#ffd700] uppercase tracking-wider bg-black/50 px-1.5 py-0.2 rounded border border-[#ffd700]/30 mb-0.5">
                                                    ⚡ {currentPeriodTitle}
                                                </span>
                                                {/* Profit above large crate */}
                                                <span className="text-xs sm:text-sm font-black font-mono text-[#4de180] mt-0.5 drop-shadow-md">
                                                    +{currentProfit}
                                                </span>
                                                {/* Large Crate */}
                                                <div className="relative w-13 h-13 sm:w-16 sm:h-16 my-0.5 transition-transform duration-300 hover:scale-110 drop-shadow-2xl">
                                                    <Image src={currentAsset} alt="Current Crate" fill className="object-contain" unoptimized />
                                                </div>
                                                {/* DD below large crate */}
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[8px] sm:text-[9px] font-bold text-amber-200/80">ความเสี่ยง:</span>
                                                    <span className="text-[8px] sm:text-[9px] font-mono font-bold text-amber-400 bg-black/60 px-1.5 py-0.2 rounded border border-amber-500/30">
                                                        DD {currentDD}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 3. Main Profit vs Drawdown Matrix Cards (with Visual Progress Bars) */}
                            {loadingFleetStats ? (
                                <div className="py-12 text-center text-amber-200/50 animate-pulse font-mono">
                                    กำลังดึงสถิติผลงานพอร์ตจริงจากระบบ...
                                </div>
                            ) : (() => {
                                const currentStats = fleetStatsData?.stats?.[fleetTimeframe] || {
                                    profitUSC: { max: 9188, avg: 1250, min: 120 },
                                    profitUSD: { max: 91.88, avg: 12.50, min: 1.20 },
                                    drawdown: { max: 14.2, avg: 3.8, min: 0.6 }
                                };
                                const pData = statsCurrency === 'USC' ? currentStats.profitUSC : currentStats.profitUSD;
                                const curUnit = statsCurrency === 'USC' ? 'USC' : 'USD';
                                const curPrefix = statsCurrency === 'USD' ? '$' : '';

                                return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                        {/* Card A: Profit Performance with Visual Gauge Bars */}
                                        <div className="bg-gradient-to-b from-[#1c1810] to-[#140e08] border-2 border-emerald-500/30 rounded-2xl p-3.5 sm:p-5 shadow-[0_0_25px_rgba(16,185,129,0.08)] relative overflow-hidden">
                                            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5 mb-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-lg sm:text-xl flex-shrink-0">📈</span>
                                                    <div className="min-w-0">
                                                        <h3 className="font-extrabold text-emerald-400 text-xs sm:text-base truncate">
                                                            ผลงานการทำกำไร (Profit Matrix)
                                                        </h3>
                                                        <p className="text-[9px] sm:text-[10px] text-emerald-200/50 truncate">
                                                            สถิติการปิดกำไรจริงในรอบ{fleetTimeframe === 'daily' ? 'วัน' : fleetTimeframe === 'weekly' ? 'สัปดาห์' : 'เดือน'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex-shrink-0">
                                                    หน่วย {curUnit}
                                                </span>
                                            </div>

                                            <div className="space-y-2.5 sm:space-y-3">
                                                {/* Peak Max with Gauge Bar */}
                                                <div className="p-2 sm:p-2.5 bg-black/40 rounded-xl border border-emerald-500/20 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-[11px] sm:text-xs font-bold text-emerald-300 flex items-center gap-1">
                                                                <Sparkles className="w-3 h-3 text-[#ffd700]" />
                                                                <span>กำไรสูงสุด (Peak High)</span>
                                                            </div>
                                                            <div className="text-[9px] text-amber-200/40">วันที่ตลาดมีรอบคลื่นสวิงแรง</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm sm:text-lg font-black font-mono text-[#4de180]">
                                                                +{curPrefix}{pData.max.toLocaleString()} {curUnit}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-emerald-950/50 rounded-full h-1.5 sm:h-2 overflow-hidden border border-emerald-500/30">
                                                        <div className="bg-gradient-to-r from-emerald-500 via-teal-400 to-[#ffd700] h-full rounded-full w-full animate-pulse shadow-[0_0_8px_rgba(77,225,128,0.5)]"></div>
                                                    </div>
                                                    <div className="flex justify-between text-[8px] sm:text-[9px] text-amber-200/40">
                                                        <span>สวิงคลื่นแรงพิเศษ</span>
                                                        <span className="text-emerald-400 font-mono">100% Benchmark</span>
                                                    </div>
                                                </div>

                                                {/* Average Return with Gauge Bar */}
                                                <div className="p-2 sm:p-2.5 bg-black/40 rounded-xl border border-emerald-500/20 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-[11px] sm:text-xs font-bold text-amber-200 flex items-center gap-1">
                                                                <span>⚖️</span>
                                                                <span>กำไรเฉลี่ย (Average Return)</span>
                                                            </div>
                                                            <div className="text-[9px] text-amber-200/40">ผลตอบแทนเฉลี่ยต่อพอร์ต</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm sm:text-lg font-black font-mono text-[#ffd700]">
                                                                +{curPrefix}{pData.avg.toLocaleString()} {curUnit}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-amber-950/40 rounded-full h-1.5 sm:h-2 overflow-hidden border border-amber-500/30">
                                                        <div 
                                                            className="bg-gradient-to-r from-amber-500 to-[#ffd700] h-full rounded-full"
                                                            style={{ width: `${Math.min(100, Math.max(15, Math.round((pData.avg / (pData.max || 1)) * 100)))}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between text-[8px] sm:text-[9px] text-amber-200/40">
                                                        <span>ผลตอบแทนมาตรฐานสม่ำเสมอ</span>
                                                        <span className="text-[#ffd700] font-mono">{Math.round((pData.avg / (pData.max || 1)) * 100)}% ของรอบสวิง</span>
                                                    </div>
                                                </div>

                                                {/* Minimum with Gauge Bar */}
                                                <div className="p-2 sm:p-2.5 bg-black/40 rounded-xl border border-emerald-500/20 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-[11px] sm:text-xs font-bold text-amber-200/80 flex items-center gap-1">
                                                                <span>🌱</span>
                                                                <span>กำไรต่ำสุด (Minimum)</span>
                                                            </div>
                                                            <div className="text-[9px] text-amber-200/40">วันที่ตลาดไซด์เวย์นิ่งสนิท</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm sm:text-lg font-black font-mono text-emerald-400/80">
                                                                +{curPrefix}{pData.min.toLocaleString()} {curUnit}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-emerald-950/30 rounded-full h-1.5 sm:h-2 overflow-hidden border border-emerald-500/20">
                                                        <div 
                                                            className="bg-emerald-500/70 h-full rounded-full"
                                                            style={{ width: `${Math.min(100, Math.max(8, Math.round((pData.min / (pData.max || 1)) * 100)))}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between text-[8px] sm:text-[9px] text-amber-200/40">
                                                        <span>ไซด์เวย์นิ่งสนิท</span>
                                                        <span className="text-emerald-400/80 font-mono">ปิดบวกต่อเนื่อง</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card B: Drawdown Control with Visual Gauge Bars */}
                                        <div className="bg-gradient-to-b from-[#1c1810] to-[#140e08] border-2 border-amber-500/30 rounded-2xl p-3.5 sm:p-5 shadow-[0_0_25px_rgba(245,158,11,0.08)] relative overflow-hidden">
                                            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5 mb-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-lg sm:text-xl flex-shrink-0">🛡️</span>
                                                    <div className="min-w-0">
                                                        <h3 className="font-extrabold text-[#ffd700] text-xs sm:text-base truncate">
                                                            ควบคุมความเสี่ยง (Drawdown Safe)
                                                        </h3>
                                                        <p className="text-[9px] sm:text-[10px] text-amber-200/50 truncate">
                                                            ระบบคุม DD 3 ชั้น ป้องกันความเสี่ยงทุกสภาวะตลาด
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex-shrink-0">
                                                    Max Drawdown %
                                                </span>
                                            </div>

                                            <div className="space-y-2.5 sm:space-y-3">
                                                {/* Lowest DD */}
                                                <div className="p-2 sm:p-2.5 bg-black/40 rounded-xl border border-amber-500/20 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-[11px] sm:text-xs font-bold text-emerald-300 flex items-center gap-1">
                                                                <span>🕊️</span>
                                                                <span>Drawdown ต่ำสุด (Lowest Risk)</span>
                                                            </div>
                                                            <div className="text-[9px] text-amber-200/40">ช่วงที่พอร์ตแทบไร้ความเสี่ยง</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm sm:text-lg font-black font-mono text-emerald-400">
                                                                {currentStats.drawdown.min}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-black/50 rounded-full h-1.5 sm:h-2 overflow-hidden border border-emerald-500/30">
                                                        <div 
                                                            className="bg-emerald-400 h-full rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                                                            style={{ width: `${Math.min(100, Math.max(4, (currentStats.drawdown.min / 25) * 100))}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between text-[8px] sm:text-[9px] text-amber-200/40">
                                                        <span>ช่วงที่พอร์ตแทบไร้ความเสี่ยง</span>
                                                        <span className="text-emerald-400 font-mono">Ultra Safe</span>
                                                    </div>
                                                </div>

                                                {/* Normal / Avg DD */}
                                                <div className="p-2 sm:p-2.5 bg-black/40 rounded-xl border border-amber-500/20 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-[11px] sm:text-xs font-bold text-amber-300 flex items-center gap-1">
                                                                <span>🛡️</span>
                                                                <span>Drawdown เฉลี่ย (Normal)</span>
                                                            </div>
                                                            <div className="text-[9px] text-amber-200/40">ความเสี่ยงต่ำ คุมพอร์ตปลอดภัย</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm sm:text-lg font-black font-mono text-[#ffd700]">
                                                                {currentStats.drawdown.avg}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-black/50 rounded-full h-1.5 sm:h-2 overflow-hidden border border-amber-500/30">
                                                        <div 
                                                            className="bg-gradient-to-r from-emerald-400 to-[#ffd700] h-full rounded-full"
                                                            style={{ width: `${Math.min(100, Math.max(10, (currentStats.drawdown.avg / 25) * 100))}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between text-[8px] sm:text-[9px] text-amber-200/40">
                                                        <span>ความเสี่ยงต่ำ คุมพอร์ตปลอดภัย</span>
                                                        <span className="text-[#ffd700] font-mono">Normal Safe</span>
                                                    </div>
                                                </div>

                                                {/* Peak Max DD */}
                                                <div className="p-2 sm:p-2.5 bg-black/40 rounded-xl border border-amber-500/20 space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="text-[11px] sm:text-xs font-bold text-amber-400 flex items-center gap-1">
                                                                <Zap className="w-3 h-3 text-amber-400" />
                                                                <span>DD สูงสุดที่เคยเจอ (Peak Max DD)</span>
                                                            </div>
                                                            <div className="text-[9px] text-amber-200/40">ผ่านวิกฤตข่าวใหญ่มาได้ 100%</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm sm:text-lg font-black font-mono text-amber-400">
                                                                {currentStats.drawdown.max}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-black/50 rounded-full h-1.5 sm:h-2 overflow-hidden border border-amber-500/30">
                                                        <div 
                                                            className="bg-gradient-to-r from-emerald-500 via-amber-500 to-amber-600 h-full rounded-full"
                                                            style={{ width: `${Math.min(100, Math.max(20, (currentStats.drawdown.max / 25) * 100))}%` }}
                                                        ></div>
                                                    </div>
                                                    <div className="flex justify-between text-[8px] sm:text-[9px] text-amber-200/40">
                                                        <span>ผ่านวิกฤตข่าวใหญ่มาได้ 100%</span>
                                                        <span className="text-emerald-400 font-mono font-bold">ห่างจาก Margin Call &gt; 80%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 4. Why Trade Real Account Feature Badges */}
                            <div className="bg-[#120a06] border border-[#cfa545]/20 rounded-xl p-3 sm:p-4">
                                <div className="text-xs font-bold text-[#ffd700] mb-2 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-[#ffd700]" />
                                    <span>ทำไมผู้ติดตามถึงตัดสินใจเปิดพอร์ตจริงกับ EasyM?</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-amber-200/80">
                                    <div className="flex items-start gap-2 bg-black/30 p-2.5 rounded-lg border border-amber-500/10">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-bold text-white text-[11px]">คุม DD 3 ชั้นอัตโนมัติ</div>
                                            <div className="text-[10px] text-amber-200/50">ล็อกกำไร ตัดความเสี่ยง ไม่ต้องเฝ้าจอ 24/5</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 bg-black/30 p-2.5 rounded-lg border border-amber-500/10">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-bold text-white text-[11px]">กระจาย 20 คู่เงิน</div>
                                            <div className="text-[10px] text-amber-200/50">Multi-Currency ลดความผันผวนของค่าเงิน</div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 bg-black/30 p-2.5 rounded-lg border border-amber-500/10">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <div className="font-bold text-white text-[11px]">สมาชิก IB รันฟรี 100%</div>
                                            <div className="text-[10px] text-amber-200/50">ฟรีค่าบริการ + รับเงินคืน Rebate $15/lot</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer (Action CTA) */}
                        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#2c1b10] via-[#1f130b] to-[#170e08] border-t border-[#cfa545]/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="text-center sm:text-left">
                                <div className="text-xs sm:text-sm font-extrabold text-white">
                                    พร้อมเปลี่ยนจากพอร์ตจำลองเป็นพอร์ตจริงหรือยัง?
                                </div>
                                <div className="text-[10px] text-amber-200/60">
                                    เริ่มต้นเพียง $500 (50,000 USC) ก็รันได้เต็มระบบ
                                </div>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => setShowOpenRealAccountModal(true)}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#ffd700] to-[#cfa545] hover:from-[#ffe033] hover:to-[#dfb555] text-black font-extrabold text-xs sm:text-sm rounded-xl shadow-[0_0_20px_rgba(255,215,0,0.35)] transition-all transform hover:scale-105"
                                >
                                    <Rocket className="w-4 h-4" />
                                    <span>เปิดพอร์ตจริงรับสิทธิ์ฟรี</span>
                                </button>
                                <a
                                    href="https://lin.ee/U8DdhPj"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5 transition-all"
                                >
                                    <span>💬 สอบถามแอดมิน</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* OPEN REAL ACCOUNT 3-STEP MODAL */}
            {showOpenRealAccountModal && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-auto">
                    <div className="bg-[#170e08] border-2 border-[#ffd700] rounded-2xl w-full max-w-xl p-4 sm:p-6 shadow-[0_0_60px_rgba(255,215,0,0.35)] relative animate-fade-in-up max-h-[92vh] overflow-y-auto">
                        <button 
                            onClick={() => setShowOpenRealAccountModal(false)}
                            className="absolute top-4 right-4 p-1.5 text-amber-200/60 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Title Header */}
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-amber-500/20">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#ffd700]/30 to-[#cfa545]/10 border border-[#ffd700]/50 flex items-center justify-center text-2xl shadow-sm">
                                🚀
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg font-black text-[#ffd700]">
                                    3 ขั้นตอนง่ายๆ ในการเปิดพอร์ตจริง (ฟรี 100%)
                                </h3>
                                <p className="text-xs text-amber-200/60">
                                    ใช้งาน EasyM ฟรีตลอดชีพ ภายใต้สายงาน IB พร้อมรับเงินคืน Rebate สูงสุด $15/lot
                                </p>
                            </div>
                        </div>

                        {/* 3 Steps */}
                        <div className="space-y-3 text-xs text-amber-100/90 mb-4 font-sans">
                            {/* Step 1 */}
                            <div className="p-3 sm:p-3.5 bg-black/40 rounded-xl border border-amber-500/25 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-[#ffd700] text-black font-black flex items-center justify-center text-xs flex-shrink-0">
                                        1
                                    </span>
                                    <div className="font-extrabold text-white text-sm">
                                        สมัครเปิดบัญชีเทรดกับโบรกเกอร์ InterStellar
                                    </div>
                                </div>
                                <p className="text-amber-200/70 text-[11px] leading-relaxed pl-7">
                                    สมัครบัญชีเทรดภายใต้ลิงก์สายงาน เพื่อรับสิทธิ์ใช้งาน EasyM ฟรีตลอดชีพ ไม่มีค่าบริการรายเดือน และรับสิทธิ์เงินคืนค่ารีเบท
                                </p>
                                <div className="pl-7 pt-1">
                                    <a
                                        href="https://my.fisg.com/register/trader?link_id=qb9f9uqj&referrer_id=0DtW2XvtM"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-[#cfa545] hover:from-amber-400 hover:to-[#dfb555] text-black font-black text-xs rounded-lg shadow-sm transition-all"
                                    >
                                        <span>คลิกสมัครเปิดบัญชี InterStellar</span>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </a>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="p-3 sm:p-3.5 bg-black/40 rounded-xl border border-amber-500/25 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-[#ffd700] text-black font-black flex items-center justify-center text-xs flex-shrink-0">
                                        2
                                    </span>
                                    <div className="font-extrabold text-white text-sm">
                                        ฝากเงินเข้าพอร์ตตามขนาดที่ต้องการรัน
                                    </div>
                                </div>
                                <div className="pl-7 space-y-1.5 text-[11px]">
                                    <div className="p-2 rounded-lg bg-[#1e140c] border border-amber-500/20 flex items-start justify-between gap-2">
                                        <div>
                                            <span className="font-bold text-[#ffd700]">🌟 EasyM MAX (พร้อมหน้า Farm UI):</span>
                                            <span className="text-amber-200/80 ml-1">ทุนที่เหมาะสม(แนะนำ)</span>
                                        </div>
                                        <span className="font-mono font-black text-emerald-400 whitespace-nowrap">
                                            100,000 cent ($1,000)
                                        </span>
                                    </div>
                                    <div className="p-2 rounded-lg bg-[#1e140c] border border-amber-500/20 flex items-start justify-between gap-2">
                                        <div>
                                            <span className="font-bold text-amber-300">⚡ EasyM mini:</span>
                                            <span className="text-amber-200/80 ml-1">ทุนเริ่มต้น</span>
                                        </div>
                                        <span className="font-mono font-black text-emerald-400 whitespace-nowrap">
                                            50,000 cent ($500)
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-amber-200/50 italic">
                                        * พอร์ต Cent ช่วยกระจายความเสี่ยงได้ 20 คู่เงินอย่างสมบูรณ์แบบและปลอดภัยสูงสุด
                                    </p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="p-3 sm:p-3.5 bg-black/40 rounded-xl border border-amber-500/25 space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-[#ffd700] text-black font-black flex items-center justify-center text-xs flex-shrink-0">
                                        3
                                    </span>
                                    <div className="font-extrabold text-white text-sm">
                                        ยื่นเลขพอร์ตเพื่อเปิดใช้งาน License ฟรี
                                    </div>
                                </div>
                                <p className="text-amber-200/70 text-[11px] leading-relaxed pl-7">
                                    นำเลขบัญชี MT5 ที่เปิดกับ InterStellar ไปยื่นขอรับสิทธิ์ใช้งานระบบ EasyM ฟรีตลอดชีพ โดยเลือกสั่งซื้อเวอร์ชันที่ต้องการใช้งานด้านล่างนี้
                                </p>

                                {/* IB Explanation Notice */}
                                <div className="pl-7">
                                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
                                        <span className="text-base flex-shrink-0">🎁</span>
                                        <div>
                                            <span className="font-extrabold text-[#ffd700]">รับสิทธิ์ใช้ EA ฟรี (สมัครเป็น IB):</span>
                                            <p className="mt-0.5 text-amber-100/80 text-[10.5px] leading-relaxed">
                                                {hasIbMembership
                                                    ? 'ท่านมีสิทธิ์ IB เรียบร้อยแล้ว สามารถกดสั่งซื้อเวอร์ชันที่ต้องการเพื่อกรอกเลขพอร์ตและเปิดใช้งานฟรี (0 ฿) ได้ทันที'
                                                    : 'สมาชิกที่เปิดบัญชีผ่านสายงาน IB จะได้รับสิทธิ์ใช้งาน EA ฟรีตลอดชีพ หากท่านยังไม่เคยยื่นขอสิทธิ์ IB มาก่อน เมื่อคลิกสั่งซื้อระบบจะพาท่านไปยังหน้าขอสิทธิ์ใช้งานฟรีผ่าน IB เพื่อยืนยันสิทธิ์ก่อนสั่งซื้อครับ'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pl-7 flex flex-wrap items-center gap-2 pt-1">
                                    <Link
                                        href={hasIbMembership ? `/products/${EASYM_MAX_PRODUCT_ID}` : '/?openIb=true'}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#ffd700] to-[#cfa545] hover:from-[#ffe033] hover:to-[#dfb555] text-black font-extrabold text-xs rounded-lg shadow-sm transition-all"
                                    >
                                        <span>🌟 สั่งซื้อ EasyM MAX</span>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </Link>
                                    <Link
                                        href={hasIbMembership ? `/products/${EASYM_MINI_PRODUCT_ID}` : '/?openIb=true'}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-extrabold text-xs rounded-lg shadow-sm transition-all"
                                    >
                                        <span>⚡ สั่งซื้อ EasyM mini</span>
                                        <ArrowUpRight className="w-3.5 h-3.5" />
                                    </Link>
                                    {!currentUserId && (
                                        <a
                                            href="https://eaeze.com/register?ref=REF-06A189"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-amber-200 border border-amber-500/30 text-[11px] rounded-lg transition-all"
                                        >
                                            <span>ยังไม่เคยสมัครสมาชิกเว็บ? คลิกสมัครที่นี่</span>
                                            <ArrowUpRight className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* LINE OpenChat & Consultation Box */}
                        <div className="bg-gradient-to-r from-emerald-950/40 via-black/50 to-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 sm:p-3.5 mb-4">
                            <div className="flex items-start gap-2.5">
                                <span className="text-2xl flex-shrink-0">💬</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-extrabold text-white text-xs sm:text-sm">
                                            มีข้อสงสัย หรือต้องการให้แอดมินช่วยเปิดพอร์ต?
                                        </span>
                                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold px-1.5 py-0.2 rounded">
                                            ปรึกษาฟรี 100%
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-amber-200/70 mt-1 leading-relaxed">
                                        ยินดีให้คำปรึกษา แนะนำการตั้งค่า EA และดูแลช่วยเหลือตลอดการใช้งาน เข้ามาร่วมพูดคุยสอบถามใน LINE OpenChat ได้เลยครับ
                                    </p>
                                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                        <a
                                            href="https://lin.ee/U8DdhPj"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-lg shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all"
                                        >
                                            <span>เข้า LINE OpenChat (@jharvest)</span>
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </a>
                                        <span className="text-[10px] text-emerald-400 font-mono">
                                            LINE ID: @jharvest
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-amber-500/20">
                            <button
                                onClick={() => setShowOpenRealAccountModal(false)}
                                className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-amber-200/80 border border-amber-500/30 font-bold text-center text-xs rounded-xl transition-all"
                            >
                                ปิดหน้าต่าง
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Glassmorphic Inactivity Overlay */}
            {isIdle && (
                <div className="fixed inset-0 bg-[#0f0b08]/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 transition-all duration-500">
                    <div className="bg-[#1f1815]/95 border border-[#cfa545]/30 rounded-2xl max-w-sm w-full p-8 text-center shadow-[0_0_50px_rgba(207,165,69,0.15)] flex flex-col items-center animate-fade-in-up">
                        {/* Golden pulsing ring/radar connection icon */}
                        <div className="w-20 h-20 bg-[#cfa545]/10 rounded-full flex items-center justify-center mb-6 border border-[#cfa545]/20 relative">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[#cfa545]/20 opacity-75 animate-ping"></span>
                            <svg className="w-10 h-10 text-[#cfa545]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        
                        <h3 className="text-xl font-black text-[#cfa545] tracking-widest mb-3 uppercase">
                            หยุดการเชื่อมต่อชั่วคราว
                        </h3>
                        
                        <p className="text-xs text-amber-100/60 leading-relaxed mb-8 max-w-[280px]">
                            ระบบเข้าสู่โหมดประหยัดพลังงานเนื่องจากคุณไม่มีการใช้งานนานเกิน 15 นาที คลิกปุ่มด้านล่างเพื่อเชื่อมต่อและรับข้อมูลปัจจุบันอีกครั้ง
                        </p>
                        
                        <button
                            onClick={() => setIsIdle(false)}
                            className="w-full bg-gradient-to-r from-[#dcae4d] to-[#b88c32] hover:from-[#e8ba5a] hover:to-[#c6973c] text-[#1a110a] font-extrabold uppercase py-3.5 px-6 rounded-lg transition-all duration-300 shadow-[0_4px_20px_rgba(207,165,69,0.3)] hover:scale-[1.02] active:scale-[0.98] tracking-widest text-xs border border-[#ffe092]/30 cursor-pointer"
                        >
                            เชื่อมต่อต่อ
                        </button>
                    </div>
                </div>
            )}

            {/* Premium Syncing Loader Overlay */}
            {isSyncing && (
                <div className="fixed inset-0 bg-[#0f0b08]/75 backdrop-blur-md z-[150] flex items-center justify-center p-4 transition-all duration-500 animate-fade-in">
                    <div className="bg-[#1f1815]/95 border border-[#cfa545]/20 rounded-2xl p-8 max-w-xs w-full text-center shadow-[0_0_40px_rgba(207,165,69,0.15)] flex flex-col items-center animate-fade-in-up">
                        <div className="relative w-16 h-16 mb-6">
                            {/* Outer spinning ring */}
                            <div className="absolute inset-0 border-4 border-amber-500/10 border-t-[#cfa545] rounded-full animate-spin"></div>
                            {/* Inner pulsing core with sync icon */}
                            <div className="absolute inset-3 bg-gradient-to-br from-[#dcae4d] to-[#b88c32] rounded-full opacity-90 flex items-center justify-center shadow-[0_0_15px_rgba(207,165,69,0.4)]">
                                <svg className="w-5 h-5 text-[#1a110a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-sm font-black text-amber-200/90 tracking-widest uppercase mb-1 font-sans">
                            กำลังอัปเดตข้อมูลฟาร์ม
                        </h3>
                        <p className="text-xs text-amber-100/50 leading-relaxed font-sans">
                            กรุณารอสักครู่ ระบบกำลังดึงข้อมูลล่าสุดจากเซิร์ฟเวอร์...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

