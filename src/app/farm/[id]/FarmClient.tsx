'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import FarmHud, { FarmMobileStatsOverlay } from '@/components/farm-hud';
import Image from 'next/image';
import SpaceshipDashboard from '@/components/spaceship-dashboard';
import AdminFarmDiagnosticOverlay from '@/components/AdminFarmDiagnosticOverlay';
import { toast } from 'sonner';
import { 
    Shield, Layers, Zap, Crosshair, X, 
    Gauge, Activity, AlertTriangle, CheckCircle2, 
    Lock, Unlock, Power, RefreshCw, TrendingDown, ArrowUpRight 
} from 'lucide-react';

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
function getMarketTradingDate(date: Date = new Date()): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
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

    const d = new Date(year, month, day);
    const dayOfWeek = d.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat

    if (dayOfWeek === 5) {
        // Friday after 17:00 NY: Friday trading week has concluded. Next active session is Monday.
        if (hour >= 17) {
            d.setDate(d.getDate() + 3);
        }
        return d;
    } else if (dayOfWeek === 6) {
        // Saturday: weekend, market closed. Next active trading session is Monday.
        d.setDate(d.getDate() + 2);
        return d;
    } else if (dayOfWeek === 0) {
        // Sunday: before 17:00 NY is weekend (next session is Monday), after 17:00 NY is Monday
        if (hour >= 17) {
            d.setDate(d.getDate() + 1);
        } else {
            d.setDate(d.getDate() + 1);
        }
        return d;
    } else {
        if (hour >= 17) {
            d.setDate(d.getDate() + 1);
        }
        return d;
    }
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

// 20 Currency Pairs for EasyM Prime (จัดกลุ่มตรงตาม 2 คอลัมน์บนแดชบอร์ด MT5)
const PRIME_LEFT_PAIRS = [
    'EURUSD', 'AUDUSD', 'USDJPY', 'EURJPY', 'USDCAD',
    'CADCHF', 'EURCAD', 'EURAUD', 'AUDJPY', 'EURNZD'
];
const PRIME_RIGHT_PAIRS = [
    'GBPUSD', 'NZDUSD', 'USDCHF', 'GBPJPY', 'AUDNZD',
    'NZDCAD', 'GBPCAD', 'GBPAUD', 'NZDJPY', 'GBPNZD'
];
const PRIME_20_PAIRS = [...PRIME_LEFT_PAIRS, ...PRIME_RIGHT_PAIRS];

// 🎨 Helper คำนวณธีมสีตามระดับ DD (ต่ำกว่า 18% = เขียว, 18% - 28% = เหลืองส้ม, เกิน 28% = แดง)
const getDDLevelTheme = (ddPct: number) => {
    if (ddPct > 28) {
        return {
            textColor: 'text-rose-400',
            arrowColor: 'text-rose-400/80',
            bulbBorder: 'border-rose-300',
            bulbBg: 'bg-gradient-to-br from-rose-400 via-red-600 to-rose-800 shadow-[0_0_6px_rgba(244,63,94,0.9)]',
            fillGradient: 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]',
            gaugeColor: '#f43f5e',
            needleColor: '#fda4af'
        };
    }
    if (ddPct >= 18) {
        return {
            textColor: 'text-amber-400',
            arrowColor: 'text-amber-400/80',
            bulbBorder: 'border-amber-300',
            bulbBg: 'bg-gradient-to-br from-amber-400 via-orange-600 to-amber-800 shadow-[0_0_6px_rgba(245,158,11,0.9)]',
            fillGradient: 'bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 shadow-[0_0_6px_rgba(245,158,11,0.8)]',
            gaugeColor: '#f59e0b',
            needleColor: '#fde68a'
        };
    }
    return {
        textColor: 'text-emerald-400',
        arrowColor: 'text-emerald-400/80',
        bulbBorder: 'border-emerald-300',
        bulbBg: 'bg-gradient-to-br from-emerald-400 via-teal-600 to-emerald-800 shadow-[0_0_6px_rgba(16,185,129,0.9)]',
        fillGradient: 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 shadow-[0_0_6px_rgba(16,185,129,0.8)]',
        gaugeColor: '#10b981',
        needleColor: '#6ee7b7'
    };
};

// 🎨 Helper คำนวณสีของคู่เงินกลุ่ม Active (ต่ำกว่า 5% = Active เขียว, 5% - 8% = Slow เหลืองส้ม, เกิน 8% = Freeze แดง)
const getActivePairTheme = (ddPct: number) => {
    if (ddPct >= 8.0) {
        return {
            status: 'FREEZE',
            badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-600',
            textColor: 'text-rose-400',
            bulbBorder: 'border-rose-300',
            bulbBg: 'bg-gradient-to-br from-rose-400 via-red-600 to-rose-800 shadow-[0_0_6px_rgba(244,63,94,0.9)]',
            fillGradient: 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 shadow-[0_0_6px_rgba(244,63,94,0.8)]'
        };
    }
    if (ddPct >= 5.0) {
        return {
            status: 'SLOW',
            badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-600',
            textColor: 'text-amber-400',
            bulbBorder: 'border-amber-300',
            bulbBg: 'bg-gradient-to-br from-amber-400 via-orange-600 to-amber-800 shadow-[0_0_6px_rgba(245,158,11,0.9)]',
            fillGradient: 'bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
        };
    }
    return {
        status: 'ACTIVE',
        badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-600',
        textColor: 'text-emerald-400',
        bulbBorder: 'border-emerald-300',
        bulbBg: 'bg-gradient-to-br from-emerald-400 via-teal-600 to-emerald-800 shadow-[0_0_6px_rgba(16,185,129,0.9)]',
        fillGradient: 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 shadow-[0_0_6px_rgba(16,185,129,0.8)]'
    };
};

// 🔮 Glowing Crystal DD Dial Orb Component (ทรงลูกแก้วคริสตัลเรืองแสงพร้อมสเกลหน้าปัดและเข็มตาชั่ง Real-time)
const GlowingDdOrb = ({
    type,
    value,
    onClick,
    className,
    showPing,
    title,
    isHighlighted,
    onMouseEnter,
    onMouseLeave
}: {
    type: 'TOTAL' | 'ACTIVE' | 'QUARANTINE';
    value: number;
    onClick?: () => void;
    className?: string;
    showPing?: boolean;
    title?: string;
    isHighlighted?: boolean;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}) => {
    // ระดับสีของค่า DD (ต่ำกว่า 18% เขียว, 18-28% เหลืองส้ม, เกิน 28% แดง)
    const levelTheme = getDDLevelTheme(value);

    const config = {
        TOTAL: {
            container: 'border-rose-400/80 bg-gradient-to-b from-[#2e0915]/95 via-[#1d050d]/95 to-[#0a0204]/95 shadow-[0_0_20px_rgba(244,63,94,0.6),inset_0_0_12px_rgba(244,63,94,0.35)] hover:shadow-[0_0_35px_rgba(244,63,94,0.9)]',
            label: 'TOTAL',
            labelColor: 'text-rose-300/90',
            pingBg: 'bg-rose-400',
            pingDot: 'bg-rose-500',
            tooltip: `DD รวมของพอร์ต: -${value.toFixed(2)}%`
        },
        ACTIVE: {
            container: 'border-emerald-400/80 bg-gradient-to-b from-[#06241a]/95 via-[#031710]/95 to-[#010906]/95 shadow-[0_0_20px_rgba(16,185,129,0.55),inset_0_0_12px_rgba(16,185,129,0.3)] hover:shadow-[0_0_35px_rgba(16,185,129,0.85)]',
            label: 'ACTIVE',
            labelColor: 'text-emerald-300/90',
            pingBg: 'bg-emerald-400',
            pingDot: 'bg-emerald-500',
            tooltip: `DD ฟาร์มปัจจุบัน: -${value.toFixed(2)}%`
        },
        QUARANTINE: {
            container: 'border-amber-400/80 bg-gradient-to-b from-[#2a1705]/95 via-[#1a0e03]/95 to-[#0b0501]/95 shadow-[0_0_20px_rgba(245,158,11,0.55),inset_0_0_12px_rgba(245,158,11,0.3)] hover:shadow-[0_0_35px_rgba(245,158,11,0.85)]',
            label: 'QUAR',
            labelColor: 'text-amber-300/90',
            pingBg: 'bg-amber-400',
            pingDot: 'bg-amber-500',
            tooltip: `DD คู่ที่ถูกขัง: -${value.toFixed(2)}%`
        }
    }[type];

    // Scale calculation: 270-degree speedometer / weighing scale arc (starts at 135° to 405°)
    const r = 20;
    const circumference = 2 * Math.PI * r; // 125.66
    const arcTotalLength = circumference * (270 / 360); // 94.25
    const fillPct = Math.min(100, Math.max(5, (value / 50) * 100));
    const activeSweepLength = arcTotalLength * (fillPct / 100);

    // Indicator needle tip angle at current value (เลื่อนหมุนตามสเกลเหมือนเข็มตาชั่ง)
    const needleAngleDeg = 135 + (fillPct / 100) * 270;
    const needleRad = (needleAngleDeg * Math.PI) / 180;
    const tipX = 24 + r * Math.cos(needleRad);
    const tipY = 24 + r * Math.sin(needleRad);
    const needleBaseX = 24 + (r - 4.5) * Math.cos(needleRad);
    const needleBaseY = 24 + (r - 4.5) * Math.sin(needleRad);

    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`group relative flex flex-col items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 transition-all duration-300 backdrop-blur-md cursor-pointer hover:scale-110 active:scale-95 select-none ${config.container} ${isHighlighted ? 'ring-2 ring-white shadow-[0_0_35px_rgba(255,255,255,0.8)] scale-110' : ''} ${className || ''}`}
            title={title || config.tooltip}
        >
            {/* 🔮 3D Crystal Specular Highlights */}
            <span className="absolute top-0.5 sm:top-1 left-2 sm:left-2.5 right-2 sm:right-2.5 h-2.5 sm:h-3 rounded-full bg-gradient-to-b from-white/40 via-white/10 to-transparent pointer-events-none z-20" />
            <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.22),transparent_65%)] pointer-events-none z-10" />
            <span className="absolute bottom-0.5 left-2.5 right-2.5 h-1 rounded-full bg-white/15 blur-[0.5px] pointer-events-none z-20" />

            {/* 🧭 Calibrated Scale Meter & Needle (สเกลขีดรอบวงและเข็มบอกค่าตาชั่ง) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 48 48">
                {/* 1. Background Graduation Ticks (ขีดสเกลหน้าปัดตาชั่ง) */}
                <circle
                    cx="24"
                    cy="24"
                    r={r}
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="2.2"
                    strokeDasharray="1.2 3.5"
                    strokeDashoffset="0"
                    transform="rotate(135 24 24)"
                />

                {/* 2. Active Scale Progress Sweep Arc (วงสเกลยาวขึ้นตามค่าที่ระบุ - สีเปลี่ยนตามระดับ DD) */}
                <circle
                    cx="24"
                    cy="24"
                    r={r}
                    fill="none"
                    stroke={levelTheme.gaugeColor}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeDasharray={`${activeSweepLength} ${circumference}`}
                    transform="rotate(135 24 24)"
                    style={{ filter: `drop-shadow(0 0 3px ${levelTheme.gaugeColor})` }}
                    className="transition-all duration-700 ease-out"
                />

                {/* 3. Scale Needle / Indicator Point (เข็มชี้สเกลตาชั่ง) */}
                <line
                    x1={needleBaseX}
                    y1={needleBaseY}
                    x2={tipX}
                    y2={tipY}
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 2px ${levelTheme.needleColor})` }}
                    className="transition-all duration-700 ease-out"
                />
                <circle
                    cx={tipX}
                    cy={tipY}
                    r="1.4"
                    fill="#ffffff"
                    style={{ filter: `drop-shadow(0 0 3px ${levelTheme.gaugeColor})` }}
                    className="transition-all duration-700 ease-out"
                />
            </svg>

            {/* 🔢 Center Dial Gauge Value & Label (ย่อขนาดเล็กลงพอเหมาะ ไม่ทับสเกล - สีตัวเลขเปลี่ยนตามระดับ DD) */}
            <div className="relative z-20 flex flex-col items-center justify-center leading-none text-center pointer-events-none">
                <span className={`text-[5px] sm:text-[6px] font-black tracking-widest uppercase mb-0.5 ${config.labelColor}`}>
                    {config.label}
                </span>
                <span className={`font-mono font-black text-[7.5px] sm:text-[9px] tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${levelTheme.textColor}`}>
                    -{value.toFixed(1)}%
                </span>
            </div>

            {/* 🚨 Pulse Ping Indicator */}
            {showPing && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3 pointer-events-none z-30">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pingBg}`} />
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 ${config.pingDot}`} />
                </span>
            )}
        </button>
    );
};

export default function FarmClient({ 
    portNumber, 
    initialOrders, 
    initialPortStatus,
    licenseCreatedAt,
    customName,
    licenseTier = 'free',
    dashboardSkin = 'avatar_scifi',
    isAdmin = false,
    isSuperAdmin = false,
    licenseInfo = null
}: { 
    portNumber: string;
    initialOrders: any[];
    initialPortStatus?: any;
    licenseCreatedAt: string | null;
    customName?: string | null;
    licenseTier?: string;
    dashboardSkin?: string;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    licenseInfo?: any;
}) {
    const [orders, setOrders] = useState<any[]>(initialOrders);
    const [portStatus, setPortStatus] = useState<any>(initialPortStatus || { balance: '1000.00', equity: '750.00', account_type: 'USC' });
    const [currentCustomName, setCurrentCustomName] = useState(customName || '');
    
    useEffect(() => {
        if (customName) setCurrentCustomName(customName);
    }, [customName]);

    const [time, setTime] = useState<Date | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);
    const [recentlyClosed, setRecentlyClosed] = useState<any[]>([]);
    const [isShaking, setIsShaking] = useState(false);
    const [hiddenTickets, setHiddenTickets] = useState<number[]>([]);
    
    // Smooth out today's profit to ignore sudden 0s during EA "รวบไม้" heartbeat glitches
    const [smoothedTodayProfit, setSmoothedTodayProfit] = useState(0);
    const lastDayRef = useRef('');

    // Determine product & asset types for default theme & behavior
    const prodKey = (licenseInfo?.productKey || '').toUpperCase();
    const prodName = (licenseInfo?.productName || '').toLowerCase();
    const rawSysCode = initialPortStatus?.system_code || portStatus?.system_code || '';
    const cleanSysCode = rawSysCode.split(':::')[0];
    const sysCode = cleanSysCode.toLowerCase();
    const eaVer = (initialPortStatus?.ea_version || portStatus?.ea_version || '').toLowerCase();
    const rawAsset = portStatus?.asset_type || (prodName.includes('gold') || prodKey.includes('GOLD') || prodKey.includes('EZG') ? 'GOLD' : 'FOREX');
    const assetType = rawAsset.toUpperCase() === 'EASYGOLD' ? 'GOLD' : rawAsset;

    const isEasyM = prodKey.includes('EZM') || 
                    prodName.includes('easym') || 
                    prodName.includes('easy m') ||
                    sysCode.includes('easym') ||
                    sysCode.includes('easy m') ||
                    assetType === 'FOREX';

    // EasyM Prime Dev Gate: Restrict Prime floating orbs and cockpit exclusively to user's ports (21692434 & 97053088)
    // Other users running Prime will safely see the standard stable farm view until testing is finalized.
    const isPrime = String(portNumber) === '21692434' || String(portNumber) === '97053088';

    const [primeActiveOrb, setPrimeActiveOrb] = useState<number | null>(null);

    const isEasyGold = !isEasyM && (
        prodKey.includes('GOLD') || 
        prodKey.includes('EZG') || 
        prodName.includes('gold') ||
        sysCode.includes('gold') ||
        sysCode.includes('eg_farming') ||
        assetType === 'GOLD'
    );

    const [viewMode, setViewMode] = useState<'farm' | 'spaceship'>(
        isEasyGold ? 'spaceship' : 'farm'
    );
    const [clickCount, setClickCount] = useState(0);
    const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const ordersRef = useRef<any[]>(initialOrders);
    const portStatusRef = useRef<any>(portStatus);

    // Sync ref with state for use in subscription cleanup
    useEffect(() => { ordersRef.current = orders; }, [orders]);
    useEffect(() => { portStatusRef.current = portStatus; }, [portStatus]);

    const [isTabVisible, setIsTabVisible] = useState(true);
    const [isIdle, setIsIdle] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- Pro Trial & Theme Preview States ---
    const [isActivatingTrial, setIsActivatingTrial] = useState(false);
    const [forceShowEALoader, setForceShowEALoader] = useState(false);
    const [trialActivationTime, setTrialActivationTime] = useState<number | null>(null);
    const [activePreviewSkin, setActivePreviewSkin] = useState<string | null>(null);
    const [previewTimeLeft, setPreviewTimeLeft] = useState(0);
    const [secondsSinceLastUpdate, setSecondsSinceLastUpdate] = useState<number>(0);
    const [isDdExpanded, setIsDdExpanded] = useState(false);
    const [isQuarantineEnlarged, setIsQuarantineEnlarged] = useState(false);
    const [isQuarantineExpanded, setIsQuarantineExpanded] = useState(false);
    const [isDdOrbExpanded, setIsDdOrbExpanded] = useState(false);
    const [highlightTarget, setHighlightTarget] = useState<'FARM' | 'QUARANTINE' | null>(null);
    const [expandedActivePair, setExpandedActivePair] = useState<string | null>(null);

    const handleQuarantineBoxClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // ปรับการคลิกที่กรอบแสดง DD รวมของ quarantine ให้คลิกแล้วขยายใหญ่ขึ้นเหมือนเดิม แต่ไม่มีผลกับโดม เมื่อคลิกอีกครั้งก็หดลงเหมือนเดิม
        setIsQuarantineEnlarged(prev => !prev);
    };

    const handleGreenhouseDomeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // เมื่อคลิกที่โดมแก้ว ให้กระจายแปลงต้นไม้พร้อมแสดงปรอทแยกต้นได้ทันที
        setIsQuarantineExpanded(true);
        setIsQuarantineEnlarged(false);
    };

    const handleCloseQuarantine = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsQuarantineExpanded(false);
        setIsQuarantineEnlarged(false);
        setExpandedTreeId(null);
    };

    const [expandedTreeId, setExpandedTreeId] = useState<string | null>(null);
    const [selectedTreeModal, setSelectedTreeModal] = useState<any | null>(null);

    const isOffline = useMemo(() => secondsSinceLastUpdate > 60, [secondsSinceLastUpdate]);

    useEffect(() => {
        if (!trialActivationTime || !portStatus?.updated_at) return;
        const updatedAtTime = new Date(portStatus.updated_at).getTime();
        // If updated_at is newer than activation start time, trial sync complete!
        if (updatedAtTime > trialActivationTime - 2000) {
            setTrialActivationTime(null);
            setForceShowEALoader(false);
            toast.success("ข้อมูลครั้งแรกดึงเสร็จสิ้น!");
        }
    }, [portStatus?.updated_at, trialActivationTime]);

    useEffect(() => {
        if (trialActivationTime) {
            const timer = setTimeout(() => {
                setTrialActivationTime(null);
                setForceShowEALoader(false);
                toast.error("หมดเวลาเชื่อมต่อกับ EA กรุณาลองใหม่อีกครั้ง");
            }, 15000);
            return () => clearTimeout(timer);
        }
    }, [trialActivationTime]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (portStatus?.updated_at) {
                const diff = (Date.now() - new Date(portStatus.updated_at).getTime()) / 1000;
                setSecondsSinceLastUpdate(diff);
            } else {
                setSecondsSinceLastUpdate(999);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [portStatus?.updated_at]);

    const isTrialActive = useMemo(() => {
        if (!portStatus?.pro_trial_expires_at) return false;
        return new Date(portStatus.pro_trial_expires_at).getTime() > Date.now();
    }, [portStatus?.pro_trial_expires_at]);

    const [trialTimeLeft, setTrialTimeLeft] = useState(0);

    useEffect(() => {
        if (!isTrialActive || !portStatus?.pro_trial_expires_at) {
            setTrialTimeLeft(0);
            return;
        }

        const updateTimer = () => {
            const exp = new Date(portStatus.pro_trial_expires_at).getTime();
            const left = Math.max(0, Math.round((exp - Date.now()) / 1000));
            setTrialTimeLeft(left);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [isTrialActive, portStatus?.pro_trial_expires_at]);

    const activeTier = useMemo(() => {
        if (isTrialActive) return 'pro';
        return licenseTier;
    }, [isTrialActive, licenseTier]);

    const currentViewMode = useMemo(() => {
        if (activePreviewSkin === 'farm') return 'farm';
        if (activePreviewSkin === 'spaceship') return 'spaceship';
        if (isEasyM) return viewMode;
        if (activeTier === 'free') return 'spaceship';
        return viewMode;
    }, [activePreviewSkin, activeTier, isEasyM, viewMode]);

    const canActivateLimit = (key: string, limit: number = 3): boolean => {
        if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return true; // Bypass limits on localhost for testing
        }
        if (typeof window === 'undefined') return true;
        const today = new Date().toDateString();
        const stored = localStorage.getItem(key);
        if (!stored) return true;
        try {
            const parsed = JSON.parse(stored);
            if (parsed.date !== today) return true;
            return parsed.count < limit;
        } catch {
            return true;
        }
    };

    const recordActivationLimit = (key: string) => {
        if (typeof window === 'undefined') return;
        const today = new Date().toDateString();
        const stored = localStorage.getItem(key);
        let count = 1;
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed.date === today) {
                    count = parsed.count + 1;
                }
            } catch {}
        }
        localStorage.setItem(key, JSON.stringify({ date: today, count }));
    };

    const handleActivateProTrial = async () => {
        if (!canActivateLimit('eae_pro_trial_limit', 3)) {
            toast.error("คุณใช้สิทธิ์ทดลองใช้ Pro ครบ 3 ครั้งของวันนี้แล้ว");
            return;
        }
        setIsActivatingTrial(true);
        try {
            const { error } = await supabase.rpc('activate_pro_trial', { p_port_number: portNumber });
            if (error) throw error;
            recordActivationLimit('eae_pro_trial_limit');
            toast.success("เริ่มโหมดทดลองใช้ Pro 30 นาทีแล้ว ระบบกำลังปลุก EA...");
            
            setTrialActivationTime(Date.now());
            setForceShowEALoader(true);
        } catch (err: any) {
            console.error(err);
            toast.error("ไม่สามารถเปิดโหมดทดลองได้: " + err.message);
        } finally {
            setIsActivatingTrial(false);
        }
    };

    const handleSelectSkinPreview = (skin: string) => {
        if (skin === 'spaceship') {
            setActivePreviewSkin(null);
            return;
        }
        if (skin === 'farm') {
            if (isEasyM || licenseTier !== 'free' || isTrialActive) {
                setViewMode('farm');
                return;
            }
            if (!canActivateLimit('eae_preview_limit', 3)) {
                toast.error("คุณใช้สิทธิ์พรีวิวธีมครบ 3 ครั้งของวันนี้แล้ว");
                return;
            }
            recordActivationLimit('eae_preview_limit');
            setActivePreviewSkin('farm');
            toast.success("กำลังทดลองใช้งานธีม Pixel Farm 2.5D เป็นเวลา 1 นาที");
        }
    };

    useEffect(() => {
        if (!activePreviewSkin) return;
        const targetTime = Date.now() + 60 * 1000;
        
        const updatePreviewTimer = () => {
            const left = Math.max(0, Math.round((targetTime - Date.now()) / 1000));
            setPreviewTimeLeft(left);
            if (left <= 0) {
                setActivePreviewSkin(null);
                toast.info("หมดเวลาทดลองใช้ธีมพรีเมียม");
            }
        };

        updatePreviewTimer();
        const interval = setInterval(updatePreviewTimer, 1000);
        return () => clearInterval(interval);
    }, [activePreviewSkin]);


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
                    
                    if (statusRes.data) {
                        setPortStatus(statusRes.data);
                    }
                    if (ordersRes.data) {
                        setOrders(ordersRes.data);
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
    }, [isTabVisible, isIdle, portNumber]);

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
                        const closedOrder = ordersRef.current.find(o => o.ticket_id === payload.old.ticket_id);
                        if (closedOrder) {
                            const curStatus = portStatusRef.current;
                            const curPrice = Number(curStatus?.current_price) || 2354.50;
                            const lots = (Number(closedOrder.raw_lot_size) || 20) / 100;
                            const accountType = curStatus?.account_type || 'USC';
                            const pnlUsd = accountType === 'USC' 
                                ? (Number(closedOrder.current_pnl) || 0) / 100 
                                : (Number(closedOrder.current_pnl) || 0);
                            const priceDiff = lots > 0 ? pnlUsd / (lots * 100) : 0;
                            const entryPrice = closedOrder.type === 'BUY' ? curPrice - priceDiff : curPrice + priceDiff;

                            pendingCloseQueue.current.push({
                                ticket_id: closedOrder.ticket_id,
                                pnl: Number(closedOrder.current_pnl) || 0,
                                type: closedOrder.type,
                                raw_lot_size: Number(closedOrder.raw_lot_size) || 20,
                                entryPrice: parseFloat(entryPrice.toFixed(2)),
                                closedAt: Date.now()
                            });
                        }
                        setOrders(prev => prev.filter(o => o.ticket_id !== payload.old.ticket_id));
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'licenses', filter: `account_number=eq.${portNumber}` },
                (payload) => {
                    if (payload.new && (payload.new as any).port_name) {
                        setCurrentCustomName((payload.new as any).port_name);
                    } else {
                        setCurrentCustomName('');
                    }
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
    }, [portNumber, isTabVisible, isIdle]);

    // --- Dynamic Theming ---
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
            setRecentlyClosed(prev => prev.filter(o => (now - o.closedAt) < 60000));
        }, 1000);
        return () => clearInterval(timer);
    }, [recentlyClosed]);

    // Auto-detect closed orders from portStatus dropping
    const prevOpenCountRef = useRef(0);
    const prevTodayProfitRef = useRef(0);
    // Batch orders closing aggregator for "รวบไม้" (Grid closes)
    const pendingCloseQueue = useRef<{ ticket_id: number, pnl: number, closedAt: number, type?: string, raw_lot_size?: number, entryPrice?: number }[]>([]);
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
                        pnl: o.pnl,
                        type: o.type,
                        raw_lot_size: o.raw_lot_size,
                        entryPrice: o.entryPrice,
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
            setRecentlyClosed(prev => prev.filter(e => Date.now() - e.closedAt < 60000));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Day rollover & today's profit sync
    useEffect(() => {
        if (!portStatus) return;
        const currentPnl = Number(portStatus.today_pnl || 0);
        const currentClosedLots = Number(portStatus.today_closed_lots || 0);
        
        // Derive trading day from market trading date (rolls over at 05:00 AM Bangkok)
        const mDate = getMarketTradingDate(time || new Date());
        const yyyy = mDate.getFullYear();
        const mm = String(mDate.getMonth() + 1).padStart(2, '0');
        const dd = String(mDate.getDate()).padStart(2, '0');
        const activeTradingDateStr = `${yyyy}-${mm}-${dd}`;

        // Check if market is currently in weekend closed hours (Friday after 17:00 NY, Saturday, Sunday before 17:00 NY)
        const now = time || new Date();
        const nyFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: 'numeric',
            hour12: false
        });
        const nyHour = parseInt(nyFormatter.format(now), 10);
        const nyDay = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
        const isMarketWeekend = (nyDay === 6) || (nyDay === 0 && nyHour < 17) || (nyDay === 5 && nyHour >= 17);
        const isForexOrGold = !portStatus?.asset_type || portStatus?.asset_type === 'FOREX' || portStatus?.asset_type === 'GOLD';

        if (isMarketWeekend && isForexOrGold) {
            // Market is closed for the weekend: today's active trading session is closed, profit rolls to history
            setSmoothedTodayProfit(0);
            return;
        }
        
        if (lastDayRef.current !== activeTradingDateStr) {
            // New day or first load: sync with current today_pnl immediately
            lastDayRef.current = activeTradingDateStr;
            setSmoothedTodayProfit(currentPnl);
        } else {
            // Same day: if 0 trades closed today, today's PnL is definitely 0
            if (currentClosedLots === 0 && currentPnl === 0) {
                setSmoothedTodayProfit(0);
            } else if (currentPnl === 0 && smoothedTodayProfit > 0 && currentClosedLots > 0) {
                // momentary 0 drop during position reload on the same day with existing closed lots
            } else {
                setSmoothedTodayProfit(currentPnl);
            }
        }
    }, [portStatus?.today_pnl, portStatus?.today_closed_lots, portStatus?.asset_type, time, smoothedTodayProfit]);

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
        const curPrice = portStatus?.current_price || 2354.50;
        const lots = (Number(order.raw_lot_size) || 20) / 100;
        const accountType = portStatus?.account_type || 'USC';
        const pnlUsd = accountType === 'USC' ? pnl / 100 : pnl;
        const priceDiff = lots > 0 ? pnlUsd / (lots * 100) : 0;
        const entryPrice = order.type === 'BUY' ? curPrice - priceDiff : curPrice + priceDiff;

        const newEvent = { 
            ...order, 
            pnl,
            entryPrice: parseFloat(entryPrice.toFixed(2)),
            closedAt: Date.now(), 
            isProfit: pnl >= 0 
        };
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
            const floatingPnl = Number(portStatus.floating_pnl);
            const balance = Number(portStatus.balance) || 1;
            const drawdownAmt = floatingPnl < 0 ? Math.abs(floatingPnl) : 0;
            const drawdownPct = balance > 0 ? (drawdownAmt / balance) * 100 : 0;

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
        const balance = Number(portStatus?.balance) || 51540.20;
        const equity = Number(portStatus?.equity) || (51540.20 + floatingPnl);
        const drawdownAmt = floatingPnl < 0 ? Math.abs(floatingPnl) : 0;
        const drawdownPct = balance > 0 ? (drawdownAmt / balance) * 100 : 0;

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
            balance,
            equity,
            maxDrawdown: Math.max(0, Math.floor(((balance - equity) / balance) * 100)),
            todayProfit: Number(portStatus?.today_pnl || 0),
            serverTime: new Date(),
            brokerDayPercent: null
        };
    }, [displayOrders, portStatus, orders]);

    // 🎛️ Prime 20-Pair Cockpit Matrix Controls (Persisted to localStorage)
    const [pairControls, setPairControls] = useState<Record<string, { enabled: boolean }>>(() => {
        const initial: Record<string, { enabled: boolean }> = {};
        PRIME_20_PAIRS.forEach(p => { initial[p] = { enabled: true }; });
        return initial;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(`prime_pairs_${portNumber}`);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    setPairControls(prev => ({ ...prev, ...parsed }));
                } catch (e) {}
            }
        }
    }, [portNumber]);

    // Confirmation state for pair commands (กดยืนยันก่อนส่งคำสั่งไปที่อีเอ)
    const [pendingPairAction, setPendingPairAction] = useState<{
        type: 'SINGLE' | 'ALL_ACTIVE' | 'ALL_CLOSE_ONLY';
        pair?: string;
        targetEnabled?: boolean;
    } | null>(null);
    const [isDispatchingCommand, setIsDispatchingCommand] = useState(false);

    const requestTogglePair = (pair: string, currentEnabled: boolean) => {
        setPendingPairAction({
            type: 'SINGLE',
            pair,
            targetEnabled: !currentEnabled
        });
    };

    const requestSetAllPairs = (enableAll: boolean) => {
        setPendingPairAction({
            type: enableAll ? 'ALL_ACTIVE' : 'ALL_CLOSE_ONLY',
            targetEnabled: enableAll
        });
    };

    const handleConfirmAction = async () => {
        if (!pendingPairAction) return;
        setIsDispatchingCommand(true);
        try {
            if (pendingPairAction.type === 'SINGLE' && pendingPairAction.pair) {
                const pair = pendingPairAction.pair;
                const target = Boolean(pendingPairAction.targetEnabled);

                // Update backend via /api/farm/control
                await fetch('/api/farm/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        port_number: portNumber,
                        symbols: {
                            [pair]: { enabled: target, close_only: !target }
                        }
                    })
                }).catch(err => console.warn('Control API error:', err));

                setPairControls(prev => {
                    const updated = { ...prev, [pair]: { enabled: target } };
                    if (typeof window !== 'undefined') {
                        localStorage.setItem(`prime_pairs_${portNumber}`, JSON.stringify(updated));
                    }
                    return updated;
                });

                toast.success(
                    target 
                        ? `🟢 ส่งคำสั่งเปิด [${pair}: ACTIVE] ไปยัง EA สำเร็จแล้ว` 
                        : `⛔ ส่งคำสั่งปิด [${pair}: CLOSE-ONLY] ไปยัง EA สำเร็จแล้ว`,
                    { duration: 3000 }
                );
            } else if (pendingPairAction.type === 'ALL_ACTIVE' || pendingPairAction.type === 'ALL_CLOSE_ONLY') {
                const target = pendingPairAction.targetEnabled ?? true;
                const symbolsPayload: Record<string, { enabled: boolean; close_only: boolean }> = {};
                const updatedState: Record<string, { enabled: boolean }> = {};

                PRIME_20_PAIRS.forEach(p => {
                    symbolsPayload[p] = { enabled: target, close_only: !target };
                    updatedState[p] = { enabled: target };
                });

                await fetch('/api/farm/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        port_number: portNumber,
                        symbols: symbolsPayload
                    })
                }).catch(err => console.warn('Control API error:', err));

                setPairControls(updatedState);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(`prime_pairs_${portNumber}`, JSON.stringify(updatedState));
                }

                toast.success(
                    target 
                        ? `🟢 ส่งคำสั่งเปิดทุกคู่เงิน (20 Pairs ACTIVE) ไปยัง EA เรียบร้อยแล้ว` 
                        : `⛔ ส่งคำสั่งปิดทุกคู่เงิน (20 Pairs CLOSE-ONLY) ไปยัง EA เรียบร้อยแล้ว`,
                    { duration: 3500 }
                );
            }
        } catch (err: any) {
            console.error('Dispatch command failed:', err);
            toast.error('เกิดข้อผิดพลาดในการส่งคำสั่ง: ' + (err.message || 'Network Error'));
        } finally {
            setIsDispatchingCommand(false);
            setPendingPairAction(null);
        }
    };

    // 🛡️ Prime Tactical Telemetry (Table D & Table E Computed Metrics)
    const primeTelemetry = useMemo(() => {
        const bal = stats.balance > 0 ? stats.balance : 100000;
        const eq = stats.equity > 0 ? stats.equity : bal;

        // Extract Realtime Prime Telemetry from MT5 EA Heartbeat (supports native column or embedded fallback)
        let primeData = (portStatus as any)?.prime_data;
        if (!primeData && portStatus?.system_code && portStatus.system_code.includes(':::')) {
            try {
                const parts = portStatus.system_code.split(':::');
                primeData = JSON.parse(parts.slice(1).join(':::'));
            } catch (e) {
                console.error('Failed to parse embedded prime_data from system_code:', e);
            }
        }

        const liveTotalDD = stats.drawdownPercent > 0 
            ? stats.drawdownPercent 
            : (primeData?.total_dd !== undefined ? Number(primeData.total_dd) : stats.drawdownPercent);
        const ddPct = liveTotalDD;

        // Group active orders per pair (Enriched for Table & MT5 Cockpit)
        const pairData: Record<string, {
            count: number;
            lot: number;
            pnl: number;
            buyCount: number;
            sellCount: number;
            buyLot: number;
            sellLot: number;
            side: 'B' | 'S' | '-';
            ddPct: number;
        }> = {};
        PRIME_20_PAIRS.forEach(p => { 
            pairData[p] = { count: 0, lot: 0, pnl: 0, buyCount: 0, sellCount: 0, buyLot: 0, sellLot: 0, side: '-', ddPct: 0 }; 
        });

        // Dynamic Settings transmitted from MT5 EA (learns user's custom thresholds)
        const settings = {
            slowDD: Number(primeData?.settings?.slow_dd ?? 15),
            freezeDD: Number(primeData?.settings?.freeze_dd ?? 28),
            resumeDD: Number(primeData?.settings?.resume_dd ?? 12),
            quarantineIn: Number(primeData?.settings?.quarantine_in ?? 18),
            quarantineOut: Number(primeData?.settings?.quarantine_out ?? 12),
            maxQuarantined: Number(primeData?.settings?.max_quarantined ?? 2),
            hedgeTrigger: Number(primeData?.settings?.hedge_trigger ?? 35),
            maxActive: Number(primeData?.settings?.max_active ?? 10)
        };

        // Quarantined and Locked pairs evaluation
        let quarantinedDetails: Array<{ sym: string; abbr: string; ddPct: number; isHedged: boolean }> = [];
        let quarantinedList: string[] = [];
        let quarantineSummary = 'QT: -';

        if (primeData?.quarantined && Array.isArray(primeData.quarantined)) {
            quarantinedDetails = primeData.quarantined.map((q: any) => ({
                sym: q.sym,
                abbr: q.abbr || q.sym.substring(0, 2),
                ddPct: Number(q.loss_pct || 0),
                isHedged: Boolean(q.is_hedged)
            }));
            quarantinedList = quarantinedDetails.map(q => q.sym);
            quarantineSummary = quarantinedDetails.length > 0 
                ? ('QT: ' + quarantinedDetails.map(q => `${q.abbr} ${q.ddPct.toFixed(2)}%`).join(' : ')) 
                : 'QT: -';
        } else {
            // Default fallback if prime_data has not synced yet
            quarantinedList = ['EURJPY', 'GBPJPY'];
            quarantinedDetails = [
                { sym: 'EURJPY', abbr: 'EJ', ddPct: 12.22, isHedged: false },
                { sym: 'GBPJPY', abbr: 'GJ', ddPct: 19.93, isHedged: false }
            ];
            quarantineSummary = 'QT: EJ 12.22% : GJ 19.93%';
        }

        // Locked pair for Dial 3: Top quarantined pair with highest DD
        const sortedQuarantined = [...quarantinedDetails].sort((a, b) => b.ddPct - a.ddPct);
        const topQuarantined = sortedQuarantined.length > 0 ? sortedQuarantined[0] : null;

        let lockedPair = {
            sym: topQuarantined ? topQuarantined.sym : '-',
            abbr: topQuarantined ? topQuarantined.abbr : '-',
            ddPct: topQuarantined ? topQuarantined.ddPct : 0.0,
            status: topQuarantined ? (topQuarantined.isHedged ? 'HEDGE' : 'QT') : 'NORMAL'
        };

        let worstPair = {
            sym: 'NZDJPY',
            ddPct: 10.3,
            status: 'F'
        };

        let worstSummary = primeData?.worst && primeData.worst !== '-' 
            ? primeData.worst 
            : ((portStatus as any)?.worst_summary || 'NZDUSD 1.0- | NZDJPY 10.3F');
            
        let worstItems = [
            { sym: 'NZDUSD', lossPct: 1.0, flag: '-', flagLabel: 'ปกติ' },
            { sym: 'NZDJPY', lossPct: 10.3, flag: 'F', flagLabel: 'FREEZE' }
        ];

        if (orders && orders.length > 0) {
            let hasAnySymbol = false;
            orders.forEach(o => {
                const sym = (o.symbol || o.pair || '').toUpperCase().replace(/[^A-Z]/g, '');
                if (sym && pairData[sym]) {
                    hasAnySymbol = true;
                    const orderLot = (Number(o.raw_lot_size) || 0) / 100;
                    const orderPnl = Number(o.current_pnl) || 0;
                    const isBuy = o.type === 'BUY' || o.type === 0 || o.type === '0' || o.order_type === 'BUY';

                    pairData[sym].count += 1;
                    pairData[sym].lot += orderLot;
                    pairData[sym].pnl += orderPnl;

                    if (isBuy) {
                        pairData[sym].buyCount += 1;
                        pairData[sym].buyLot += orderLot;
                    } else {
                        pairData[sym].sellCount += 1;
                        pairData[sym].sellLot += orderLot;
                    }
                }
            });

            // Finalize side & ddPct for each pair
            PRIME_20_PAIRS.forEach(p => {
                const d = pairData[p];
                if (d.buyCount > 0 && d.sellCount === 0) {
                    d.side = 'B';
                } else if (d.sellCount > 0 && d.buyCount === 0) {
                    d.side = 'S';
                } else if (d.buyLot > d.sellLot) {
                    d.side = 'B';
                } else if (d.sellLot > d.buyLot) {
                    d.side = 'S';
                } else if (d.count > 0) {
                    d.side = 'B';
                } else {
                    d.side = '-';
                }
                d.ddPct = d.pnl < 0 ? Number(((Math.abs(d.pnl) / bal) * 100).toFixed(2)) : 0;
            });

            if (hasAnySymbol) {
                const sortedLosses = Object.entries(pairData)
                    .filter(([_, d]) => d.pnl < 0)
                    .map(([sym, d]) => {
                        const lossPct = Number(((Math.abs(d.pnl) / bal) * 100).toFixed(1));
                        const flag = lossPct >= 8.0 ? 'F' : lossPct >= 4.0 ? 'S' : '-';
                        const flagLabel = flag === 'F' ? 'FREEZE' : flag === 'S' ? 'SLOW' : 'ปกติ';
                        return { sym, lossPct, flag, flagLabel };
                    })
                    .sort((a, b) => b.lossPct - a.lossPct);

                if (sortedLosses.length > 0) {
                    worstItems = sortedLosses.slice(0, 3);
                    if (!primeData?.worst || primeData.worst === '-') {
                        worstSummary = worstItems.map(w => `${w.sym} ${w.lossPct}${w.flag}`).join(' | ');
                    }
                    worstPair = {
                        sym: worstItems[0].sym,
                        ddPct: worstItems[0].lossPct,
                        status: worstItems[0].flag
                    };
                }
            }
        }

        // Table D: Live Mode DD%
        // FloatingDDPct() in EA excludes quarantined pairs dynamically
        const quarantinedDrag = 32.15;
        const derivedModeDD = Math.max(0, Number((ddPct - quarantinedDrag).toFixed(2)));
        const modeDDPct = primeData?.mode_dd !== undefined 
            ? Number(primeData.mode_dd)
            : ((portStatus as any)?.mode_dd !== undefined 
                ? Number((portStatus as any).mode_dd) 
                : (derivedModeDD > 0 && derivedModeDD < ddPct ? derivedModeDD : 10.45));

        // Table D: Portfolio Mode (NORMAL, SLOW, FREEZE) evaluated on Mode DD
        const portMode: 'NORMAL' | 'SLOW' | 'FREEZE' = primeData?.mode
            ? (primeData.mode.toUpperCase() as 'NORMAL' | 'SLOW' | 'FREEZE')
            : (modeDDPct >= settings.freezeDD ? 'FREEZE' : modeDDPct >= settings.slowDD ? 'SLOW' : 'NORMAL');

        // Table E: Capital Buffer & Resilience Multiplier
        const baseline = (licenseInfo?.minBalance && licenseInfo.minBalance > 0) ? licenseInfo.minBalance : 100000;
        const rawBufPct = baseline > 0 ? ((bal - baseline) / baseline) * 100 : 78.6;
        const rawResMult = baseline > 0 ? (bal / baseline) : 1.8;
        const bufPct = primeData?.buf_pct !== undefined 
            ? Number(primeData.buf_pct) 
            : ((portStatus as any)?.buf_pct !== undefined ? Number((portStatus as any).buf_pct) : (rawBufPct > 0 ? Number(rawBufPct.toFixed(1)) : 78.6));
        const resMult = primeData?.res_mult !== undefined 
            ? Number(primeData.res_mult) 
            : ((portStatus as any)?.res_mult !== undefined ? Number((portStatus as any).res_mult) : (rawResMult > 0 ? Number(rawResMult.toFixed(1)) : 1.8));

        // Table E: Cross-Pair Relief Fund (FUND)
        const reliefBudget = primeData?.relief_budget !== undefined 
            ? Number(primeData.relief_budget) 
            : ((portStatus as any)?.relief_budget !== undefined ? Number((portStatus as any).relief_budget) : 238.78);
        const reliefCap = primeData?.relief_cap !== undefined 
            ? Number(primeData.relief_cap) 
            : (bal > 0 ? Math.round(bal * 0.05) : 8930);
        const reliefUsed = primeData?.relief_used !== undefined 
            ? Number(primeData.relief_used) 
            : ((portStatus as any)?.relief_used !== undefined ? Number((portStatus as any).relief_used) : 0.00);

        // Table E: Sniper Rescue Grid (R)
        const rescueOrdersCount = primeData?.rescue_orders !== undefined 
            ? Number(primeData.rescue_orders) 
            : ((portStatus as any)?.rescue_orders !== undefined ? Number((portStatus as any).rescue_orders) : 0);
        const rescueDDPct = primeData?.rescue_dd !== undefined 
            ? Number(primeData.rescue_dd) 
            : ((portStatus as any)?.rescue_dd !== undefined ? Number((portStatus as any).rescue_dd) : 0.00);

        // Alert Action
        const alertAction: string = primeData?.alert || (portStatus as any)?.alert_action || (quarantinedDetails.length > 0 ? 'lock withdraws' : 'system healthy');

        return {
            portMode,
            modeDDPct,
            ddPct: liveTotalDD,
            ddAmt: (bal > 0 ? (liveTotalDD / 100) * bal : 0),
            bufPct,
            resMult,
            reliefBudget,
            reliefCap,
            reliefUsed,
            worstPair,
            worstSummary,
            worstItems,
            lockedPair,
            rescueOrdersCount,
            rescueDDPct,
            quarantinedList,
            quarantinedDetails,
            quarantineSummary,
            alertAction,
            settings,
            pairData
        };
    }, [stats, orders, licenseInfo, portStatus]);

    // Top 4 Worst Drawdown pairs for vertical dropdown under Active Farm DD
    // EXCLUDES all quarantined pairs, exactly matching Table D on the EA dashboard!
    const top4WorstPairs = useMemo(() => {
        const quarantinedSyms = new Set(primeTelemetry?.quarantinedList || ['EURJPY', 'GBPJPY', 'USDJPY']);
        const map = new Map<string, { sym: string; ddPct: number; isQuarantined: boolean; isRescue: boolean; status: string }>();

        // 1. Add from primeTelemetry.worstItems (Table D active pairs) excluding quarantined pairs
        primeTelemetry?.worstItems?.forEach(w => {
            if (!quarantinedSyms.has(w.sym) && !map.has(w.sym)) {
                map.set(w.sym, {
                    sym: w.sym,
                    ddPct: w.lossPct,
                    isQuarantined: false,
                    isRescue: false,
                    status: w.flagLabel || (w.lossPct >= 8.0 ? 'FREEZE' : w.lossPct >= 5.0 ? 'SLOW' : 'ACTIVE')
                });
            }
        });

        // 2. Add from real live order pairs that are active and negative pnl
        if (primeTelemetry?.pairData) {
            const bal = stats.balance > 0 ? stats.balance : 100000;
            Object.entries(primeTelemetry.pairData).forEach(([sym, data]) => {
                if (!quarantinedSyms.has(sym) && data.pnl < 0 && !map.has(sym)) {
                    const lossPct = Number(((Math.abs(data.pnl) / bal) * 100).toFixed(1));
                    map.set(sym, {
                        sym,
                        ddPct: lossPct,
                        isQuarantined: false,
                        isRescue: false,
                        status: lossPct >= 8.0 ? 'FREEZE' : lossPct >= 5.0 ? 'SLOW' : 'ACTIVE'
                    });
                }
            });
        }

        // 3. Fallback active pairs (Table D style) if no active drawdown orders yet
        const activeFallbacks = [
            { sym: 'NZDJPY', ddPct: 10.30, isQuarantined: false, isRescue: false, status: 'FREEZE' },
            { sym: 'AUDJPY', ddPct: 8.40, isQuarantined: false, isRescue: false, status: 'FREEZE' },
            { sym: 'CADJPY', ddPct: 5.40, isQuarantined: false, isRescue: false, status: 'SLOW' },
            { sym: 'NZDUSD', ddPct: 1.20, isQuarantined: false, isRescue: false, status: 'ACTIVE' },
        ];
        activeFallbacks.forEach(fb => {
            if (!quarantinedSyms.has(fb.sym) && !map.has(fb.sym)) {
                map.set(fb.sym, fb);
            }
        });

        return Array.from(map.values())
            .sort((a, b) => b.ddPct - a.ddPct)
            .slice(0, 4);
    }, [primeTelemetry, stats.balance]);

    // 🛡️ Quarantined & Rescued Trees Dataset (Dynamic: 0, 1, 2, or 3 trees)
    // Anchored at Plot 2 (c: 1.0, r: 5) where the dome sits, and unfolding sequentially to the right
    const quarantinePreviewList = useMemo(() => {
        const details = primeTelemetry?.quarantinedDetails || [];
        // If no quarantined pairs exist, return empty array (plot stays empty/natural soil)
        if (details.length === 0) return [];

        if (details.length === 1) {
            return [{
                id: 'q_preview_1',
                c: 1.0,
                r: 5,
                sym: details[0].sym,
                ddPct: details[0].ddPct,
                isRescue: details[0].isHedged,
                src: details[0].isHedged ? '/farm/Tree_aura.png?v=2' : '/farm/Tree_fence.png?v=2',
                alt: details[0].isHedged ? 'Rescue Active Tree' : 'Quarantined Tree',
                label: details[0].isHedged ? 'RESCUE GRID' : 'QUARANTINE',
                delayMs: 0
            }];
        }

        if (details.length === 2) {
            // 2 Trees: Tree 1 stays at dome location (c: 1.0), Tree 2 unfolds right beside it touching (c: 1.8)
            return [
                {
                    id: 'q_preview_1',
                    c: 1.0,
                    r: 5,
                    sym: details[0].sym,
                    ddPct: details[0].ddPct,
                    isRescue: details[0].isHedged,
                    src: details[0].isHedged ? '/farm/Tree_aura.png?v=2' : '/farm/Tree_fence.png?v=2',
                    alt: 'Quarantined Tree',
                    label: details[0].isHedged ? 'RESCUE GRID' : 'QUARANTINE',
                    delayMs: 0
                },
                {
                    id: 'q_preview_2',
                    c: 1.8,
                    r: 5,
                    sym: details[1].sym,
                    ddPct: details[1].ddPct,
                    isRescue: details[1].isHedged,
                    src: details[1].isHedged ? '/farm/Tree_aura.png?v=2' : '/farm/Tree_fence.png?v=2',
                    alt: 'Rescue Active Tree',
                    label: details[1].isHedged ? 'RESCUE GRID' : 'QUARANTINE',
                    delayMs: 150
                }
            ];
        }

        // 3 Trees: Tree 1 at dome (c: 1.0), Tree 2 beside it (c: 1.8), Tree 3 next in line (c: 2.6)
        return [
            { 
                id: 'q_preview_1', 
                c: 1.0, 
                r: 5, 
                sym: details[0]?.sym || 'EURJPY',
                ddPct: details[0]?.ddPct ?? 14.20,
                isRescue: Boolean(details[0]?.isHedged),
                src: details[0]?.isHedged ? '/farm/Tree_aura.png?v=2' : '/farm/Tree_fence.png?v=2', 
                alt: 'Quarantined Tree', 
                label: details[0]?.isHedged ? 'RESCUE GRID' : 'QUARANTINE',
                delayMs: 0
            },
            { 
                id: 'q_preview_2', 
                c: 1.8, 
                r: 5, 
                sym: details[1]?.sym || 'GBPJPY',
                ddPct: details[1]?.ddPct ?? 16.80,
                isRescue: true,
                src: '/farm/Tree_aura.png?v=2',  
                alt: 'Rescue Active Tree', 
                label: 'RESCUE GRID',
                delayMs: 150
            },
            { 
                id: 'q_preview_3', 
                c: 2.6, 
                r: 5, 
                sym: details[2]?.sym || 'USDJPY',
                ddPct: details[2]?.ddPct ?? 11.50,
                isRescue: Boolean(details[2]?.isHedged),
                src: details[2]?.isHedged ? '/farm/Tree_aura.png?v=2' : '/farm/Tree_fence.png?v=2', 
                alt: 'Quarantined Tree', 
                label: details[2]?.isHedged ? 'RESCUE GRID' : 'QUARANTINE',
                delayMs: 300
            },
        ];
    }, [primeTelemetry]);

    const totalQuarantineDD = useMemo(() => {
        return Number(quarantinePreviewList.reduce((acc, t) => acc + t.ddPct, 0).toFixed(2));
    }, [quarantinePreviewList]);

    // Definitions of DD at each location:
    // 1. Top Orb (ลูกแก้วบนสุด) = DD รวมของพอร์ต (Total Port DD)
    // 2. Badge above Farm (กรอบ DD เหนือฟาร์ม) = DD ของฟาร์มที่ทำงานอยู่ปัจจุบันโดยหัก DD ที่ถูกกักขังออกแล้ว (Active Farm DD = Total Port DD - Quarantine Total DD)
    // 3. Badge on Quarantined Trees (บนต้นไม้ที่ถูกขัง) = DD ของคู่เงินที่ถูกขังทั้งหมด (Quarantine Total DD)
    const rawPortDD = primeTelemetry ? primeTelemetry.ddPct : stats.drawdownPercent;
    const activeFarmDDPct = useMemo(() => {
        if (portNumber === '97053088' || isPrime) {
            return rawPortDD >= totalQuarantineDD + 5 
                ? Number((rawPortDD - totalQuarantineDD).toFixed(2)) 
                : (rawPortDD > 0 ? Number(rawPortDD.toFixed(2)) : 14.20);
        }
        return rawPortDD;
    }, [rawPortDD, totalQuarantineDD, portNumber, isPrime]);

    const totalPortDDPct = useMemo(() => {
        if (portNumber === '97053088' || isPrime) {
            return Number((activeFarmDDPct + totalQuarantineDD).toFixed(2));
        }
        return rawPortDD;
    }, [rawPortDD, activeFarmDDPct, totalQuarantineDD, portNumber, isPrime]);

    const activeCount = useMemo(() => {
        return PRIME_20_PAIRS.filter(p => pairControls[p]?.enabled !== false).length;
    }, [pairControls]);
    const closeOnlyCount = 20 - activeCount;

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
        if (!isTabVisible || isIdle) return;

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
    }, [portNumber, isTabVisible, isIdle]);

    const brokerDateStr = useMemo(() => {
        // Use Thailand market trading date as the constant reference for the dashboard (rolls over at 05:00 AM Bangkok)
        const mDate = getMarketTradingDate(time || new Date());
        const yyyy = mDate.getFullYear();
        const mm = String(mDate.getMonth() + 1).padStart(2, '0');
        const dd = String(mDate.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }, [time]);

    const licenseCreatedDateStr = useMemo(() => {
        if (!licenseCreatedAt) return null;
        try {
            const d = new Date(licenseCreatedAt);
            return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        } catch (e) {
            console.error("Error parsing licenseCreatedAt:", e);
            return null;
        }
    }, [licenseCreatedAt]);

    const dailyHistory = useMemo(() => {
        if (!history.length) return [];
        
        // Filter out today's active trading date and any future dates (only show past completed days before today)
        let filteredData = history.filter(item => item.date < brokerDateStr);
        
        // Filter out dates before the license creation date
        if (licenseCreatedDateStr) {
            filteredData = filteredData.filter(item => item.date >= licenseCreatedDateStr);
        }

        // Sort ascending by date
        const sorted = [...filteredData].sort((a, b) => a.date.localeCompare(b.date));

        // --- AUTOMATIC MISSING-DAY CHECKER & GAP FILLER ---
        const historyMap = new Map(sorted.map(item => [item.date.split('T')[0], item]));
        
        const filledList: any[] = [];
        if (sorted.length > 0) {
            const firstDateStr = sorted[0].date.split('T')[0];
            const startDate = new Date(firstDateStr + 'T00:00:00');

            // History crates represent completed days strictly prior to today's active trading date (brokerDateStr)
            const lastCompletedDate = new Date(brokerDateStr + 'T00:00:00');
            lastCompletedDate.setDate(lastCompletedDate.getDate() - 1);

            const curr = new Date(startDate);
            while (curr <= lastCompletedDate) {
                const yyyy = curr.getFullYear();
                const mm = String(curr.getMonth() + 1).padStart(2, '0');
                const dd = String(curr.getDate()).padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                
                const dayOfWeek = curr.getDay(); // 0: Sun, 6: Sat
                const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
                const isForexOrGold = !portStatus?.asset_type || portStatus?.asset_type === 'FOREX' || portStatus?.asset_type === 'GOLD';

                if (historyMap.has(dateStr)) {
                    const item = historyMap.get(dateStr)!;
                    // Forex & Gold markets are strictly closed on Saturday & Sunday.
                    // Always skip weekends for Forex/Gold, and skip zero-profit weekends for others.
                    if (isWeekend && (isForexOrGold || Math.abs(Number(item.profit)) < 0.01)) {
                        // skip weekend
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

        // Extra guarantee: ensure no item equals or exceeds today's active market trading date
        const safeFilledList = filledList.filter(item => item.date < brokerDateStr);

        const accountType = portStatus?.account_type || 'USC';
        const isUSC = accountType.toUpperCase().trim() === 'USC' || accountType.toUpperCase().trim() === 'CENT';

        const MARKET_HOLIDAYS: Record<string, string> = {
            '12-25': 'Christmas Day',
            '01-01': 'New Year\'s Day',
            '2026-04-03': 'Good Friday',
            '2027-03-26': 'Good Friday'
        };

        return safeFilledList.map((item, idx) => {
            const pnl = Number(item.profit || 0);
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
    }, [history, brokerDateStr, licenseCreatedDateStr, portStatus?.account_type]);

    const historyScrollRef = useRef<HTMLDivElement>(null);
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

    const handleSecretToggle = () => {
        if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
        
        setClickCount(prev => {
            const nextCount = prev + 1;
            console.log(`[EAEZE] Secret Click Count: ${nextCount}/5`);
            
            if (nextCount >= 5) {
                if (!isEasyM && activeTier === 'free' && !isAdmin) {
                    toast.info("กรุณาอัปเกรดเป็นสิทธิ์ Pro หรือ Max เพื่อเปิดใช้งานระบบฟาร์ม 2.5D");
                    return 0;
                }
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

    if (currentViewMode === 'spaceship') {
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
                    systemCode={portStatus?.system_code?.split(':::')[0]}
                    eaVersion={portStatus?.ea_version}
                    orders={orders}
                    recentlyClosed={recentlyClosed}
                    licenseTier={licenseTier}
                    isTrialActive={isTrialActive}
                    trialTimeLeft={trialTimeLeft}
                    onActivateTrial={handleActivateProTrial}
                    isActivatingTrial={isActivatingTrial}
                    onSelectSkinPreview={handleSelectSkinPreview}
                    activePreviewSkin={activePreviewSkin}
                    previewTimeLeft={previewTimeLeft}
                    isOffline={isOffline}
                    currentPrice={portStatus?.current_price}
                    licenseCreatedAt={licenseCreatedAt}
                    dailyHistory={dailyHistory}
                    customName={currentCustomName}
                    adminMessage={portStatus?.admin_message || "ติดต่อผ่าน line ID : @jharvest"}
                    dailyMaxDrawdown={Number(portStatus?.daily_max_drawdown) || 0}
                    todayClosedLots={Number(portStatus?.today_closed_lots) || 0}
                    isFirstSyncLoading={forceShowEALoader}
                />
                {/* Admin Diagnostic Overlay for juntarasate@gmail.com */}
                <AdminFarmDiagnosticOverlay
                    isSuperAdmin={isSuperAdmin}
                    portNumber={portNumber}
                    portStatus={portStatus}
                    ordersCount={orders.length}
                    licenseInfo={licenseInfo}
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
                    title={currentCustomName ? `${currentCustomName.toUpperCase()} (${portNumber})` : undefined}
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
                    drawdownPercent={primeTelemetry ? primeTelemetry.ddPct : stats.drawdownPercent}
                    drawdownAmount={stats.drawdownAmount}
                    assetType={assetType}
                    isShaking={isShaking}
                    systemCode={portStatus?.system_code?.split(':::')[0]}
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
                drawdownPercent={primeTelemetry ? primeTelemetry.ddPct : stats.drawdownPercent}
                drawdownAmount={stats.drawdownAmount}
                totalStandardLots={stats.totalLots}
                isShaking={isShaking}
                customName={currentCustomName || undefined}
            />

            <div ref={containerRef} className="flex-1 w-full relative flex items-center justify-center pt-[182px] pb-[112px] sm:pt-[136px] sm:pb-[160px]">
                <div
                    className="relative transition-all duration-500 ease-out origin-center"
                    style={{ transform: `scale(${isClient ? scale : 1})`, width: '100px', height: '100px' }}
                >
                    <div className="absolute left-1/2 top-1/2 -ml-[140px] -mt-[360px]">
                        {/* 🌑 GENTLE SPOTLIGHT FOCUS BACKDROP WHEN QUARANTINE IS ACTIVE */}
                        <div 
                            onClick={(e) => {
                                if (isQuarantineExpanded || isQuarantineEnlarged) {
                                    handleCloseQuarantine(e);
                                }
                            }}
                            className={`absolute inset-[-1500px] bg-black/15 transition-all duration-500 z-[19] ${
                                (isQuarantineExpanded || isQuarantineEnlarged) 
                                    ? 'opacity-100 pointer-events-auto cursor-pointer' 
                                    : 'opacity-0 pointer-events-none'
                            }`} 
                            title="คลิกพื้นที่ว่างเพื่อกลับสู่มุมมองฟาร์มปกติ"
                        />

                        {/* 🌾 THE ENTIRE MAIN FARM AREA (GENTLY FLOATING SLOWLY, SUBTLY RECEDING WHEN QUARANTINE IS FOCUSED) */}
                        <div className={`animate-float-farm transition-all duration-500 ease-out ${
                            (isQuarantineExpanded || isQuarantineEnlarged)
                                ? 'opacity-70 brightness-95 scale-[0.99]'
                                : 'opacity-100 brightness-100 scale-100'
                        }`}>
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

                        {/* 🔻 Floating Drawdown Badge (Placed in separate high z-index overlay so target tree never jumps to front) */}
                        {(() => {
                            const firstWitheredIdx = plot.trees.findIndex(t => t.level < 4);
                            const targetIdx = firstWitheredIdx >= 0 ? firstWitheredIdx : 0;
                            const hasDrawdown = stats.drawdownPercent > 0 || stats.floatingPnl < 0;
                            if (!hasDrawdown || !isClient) return null;

                            const targetC = targetIdx % 5;
                            const targetR = Math.floor(targetIdx / 5);
                            const badgeLeft = (targetC - targetR) * TILE_W;
                            const badgeTop = (targetC + targetR) * TILE_H_OFFSET;
                            const badgeCounterScale = (scale > 0 && scale < 0.38) ? (0.38 / scale) : 1;
                            const portDDPct = activeFarmDDPct;
                            const portMercuryFill = Math.min(100, Math.max(10, (portDDPct / 40) * 100));

                            return (
                                <div
                                    className="absolute pointer-events-none"
                                    style={{
                                        left: `${badgeLeft}px`,
                                        top: `${badgeTop}px`,
                                        zIndex: 99999,
                                        width: '280px',
                                        height: '280px'
                                    }}
                                >
                                    <div 
                                        className="absolute -top-14 left-1/2 flex flex-col items-center animate-fade-in pointer-events-auto"
                                        style={{
                                            transform: `translateX(-50%) scale(${badgeCounterScale})`,
                                            transformOrigin: 'bottom center'
                                        }}
                                    >
                                        {/* Main DD Badge Container (Step 1: Expands width & height proportionally, enlarges number) */}
                                        {(() => {
                                            const activeTheme = getDDLevelTheme(portDDPct);
                                            return (
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsDdExpanded(prev => !prev);
                                                    }}
                                                    className={`bg-[#041c14]/95 hover:bg-[#06241a]/95 border sm:border-2 border-emerald-500/90 rounded-xl text-center backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-out select-none ${
                                                        highlightTarget === 'FARM'
                                                            ? 'ring-2 ring-emerald-400 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.95)] scale-110'
                                                            : ''
                                                    } ${
                                                        isDdExpanded 
                                                            ? 'w-72 sm:w-80 py-3 px-4 sm:py-3.5 sm:px-5 shadow-[0_0_30px_rgba(16,185,129,0.85)]' 
                                                            : 'w-32 sm:w-36 py-1.5 px-2.5 sm:py-2 sm:px-4 hover:scale-105 shadow-[0_0_15px_rgba(16,185,129,0.55)]'
                                                    }`}
                                                    title={isDdExpanded ? "คลิกเพื่อพับเก็บ" : "คลิกเพื่อคลี่ดู Top 4 คู่เงินที่ DD สูงสุดในโหมด Active"}
                                                >
                                                    {/* Mini Subtitle Tag linking to Active Farm */}
                                                    <div className="flex items-center gap-1 mb-0.5 pointer-events-none">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                        <span className="text-[7px] sm:text-[8px] font-black tracking-widest text-emerald-400 uppercase">
                                                            ACTIVE FARM
                                                        </span>
                                                    </div>

                                                    {/* Line 1: Main DD Number (สีเปลี่ยนตามระดับ DD: <18% เขียว, 18-28% เหลืองส้ม, >28% แดง) */}
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-mono font-black ${activeTheme.textColor} leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-nowrap transition-all duration-300 ${
                                                            isDdExpanded ? 'text-2xl sm:text-3xl' : 'text-[17px] sm:text-xl'
                                                        }`}>
                                                            -{portDDPct.toFixed(2)}%
                                                        </span>
                                                        <span className={`${activeTheme.arrowColor} transition-all duration-300 ${
                                                            isDdExpanded ? 'rotate-180 text-xs sm:text-sm' : 'text-[9px]'
                                                        }`}>
                                                            ▼
                                                        </span>
                                                    </div>

                                                    {/* Line 2: ปรอทแนวนอน ขยายตามความกว้างและความสูง (สีปรอทเปลี่ยนตามระดับ DD) */}
                                                    <div className={`transition-all duration-300 ease-out flex items-center rounded-full bg-black/80 border border-emerald-500/30 shadow-inner ${
                                                        isDdExpanded ? 'w-56 sm:w-64 px-1.5 py-1 mt-2' : 'w-24 sm:w-28 px-1 py-0.5 mt-1'
                                                    }`}>
                                                        {/* Mercury Bulb (กระเปาะปรอททรงกลมเรืองแสงตามระดับ DD) */}
                                                        <div className={`relative rounded-full flex-shrink-0 flex items-center justify-center border ${activeTheme.bulbBorder} ${activeTheme.bulbBg} transition-all duration-300 ${
                                                            isDdExpanded ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
                                                        }`}>
                                                            <div className="w-0.5 h-0.5 rounded-full bg-white/90 -mt-0.5 -ml-0.5"></div>
                                                        </div>

                                                        {/* Horizontal Glass Stem Tube (หลอดแก้วแนวนอน) */}
                                                        <div className={`relative flex-1 -ml-0.5 rounded-r-full bg-slate-950/80 border border-white/20 overflow-hidden shadow-inner flex items-center transition-all duration-300 ${
                                                            isDdExpanded ? 'h-2 sm:h-2.5' : 'h-1.5'
                                                        }`}>
                                                            <div className="absolute top-0 left-0 right-0 h-[0.5px] bg-white/40 z-20 pointer-events-none"></div>
                                                            <div 
                                                                className={`h-full rounded-r-full ${activeTheme.fillGradient} transition-all duration-700 relative`}
                                                                style={{ width: `${portMercuryFill}%` }}
                                                            >
                                                                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/70 rounded-r-full"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Step 2: ค่อยๆ คลี่แถบปรอทลงในแนวตั้งทีละตัว (Top 4 Active Pairs: สัดส่วนและขนาดตัวอักษรเหมือนของกักขัง ไม่มี #1,2,3,4) */}
                                        {isDdExpanded && (
                                            <div 
                                                onClick={(e) => e.stopPropagation()}
                                                className="mt-2.5 w-72 sm:w-80 flex flex-col gap-2 z-[100] pointer-events-auto select-none"
                                            >
                                                {top4WorstPairs.map((p, idx) => {
                                                    const isPairExpanded = expandedActivePair === p.sym;
                                                    const fillWidth = Math.min(100, Math.max(12, (p.ddPct / 25) * 100));
                                                    const unfoldClass = idx === 0 ? 'animate-unfold-bar-1' :
                                                                        idx === 1 ? 'animate-unfold-bar-2' :
                                                                        idx === 2 ? 'animate-unfold-bar-3' : 'animate-unfold-bar-4';
                                                    const pTheme = getActivePairTheme(p.ddPct);
                                                    return (
                                                        <div 
                                                            key={p.sym}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedActivePair(prev => prev === p.sym ? null : p.sym);
                                                            }}
                                                            className={`w-full bg-[#02140d]/95 border-2 rounded-xl sm:rounded-2xl transition-all duration-300 cursor-pointer select-none backdrop-blur-xl flex flex-col gap-1.5 sm:gap-2 ${
                                                                isPairExpanded 
                                                                    ? 'scale-[1.10] sm:scale-[1.14] px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-[0_20px_45px_rgba(0,0,0,0.95),0_0_25px_rgba(16,185,129,0.7)] border-emerald-300 ring-2 ring-emerald-400/80 z-50 my-1' 
                                                                    : 'border-emerald-500/80 px-3 py-2 sm:px-3.5 sm:py-2.5 hover:scale-[1.02] shadow-[0_10px_25px_rgba(0,0,0,0.85),0_0_15px_rgba(16,185,129,0.35)]'
                                                            } ${unfoldClass}`}
                                                            title={isPairExpanded ? "แตะเพื่อย่อกลับขนาดปกติ" : "แตะเพื่อขยายดูรายละเอียดปรอท"}
                                                        >
                                                            {/* Top Row: Symbol, Status Badge, DD % (ไม่มีตัวเลขลำดับ #1,2,3,4) */}
                                                            <div className="flex items-center justify-between font-mono">
                                                                <span className={`font-black tracking-wider transition-all ${pTheme.textColor} ${
                                                                    isPairExpanded ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                                                                }`}>
                                                                    {p.sym}
                                                                </span>
                                                                <span className={`rounded-md font-bold uppercase tracking-wider border transition-all ${pTheme.badgeBg} ${
                                                                    isPairExpanded ? 'text-[11px] sm:text-xs px-2.5 py-0.5' : 'text-[10px] sm:text-[11px] px-2 py-0.5'
                                                                }`}>
                                                                    {pTheme.status}
                                                                </span>
                                                                <span className={`font-black font-mono transition-all ${pTheme.textColor} ${
                                                                    isPairExpanded ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                                                                }`}>
                                                                    -{p.ddPct.toFixed(1)}%
                                                                </span>
                                                            </div>

                                                            {/* Bottom Row: หลอดปรอทสัดส่วนเหมือนชุดของกักขัง (Bulb ทรงกลม + Glass Tube สเกล 4 ขีด) */}
                                                            <div className="flex items-center w-full">
                                                                {/* Mercury Bulb (กระเปาะปรอททรงกลมพร้อมจุดสะท้อนแสง) */}
                                                                <div className={`relative rounded-full flex-shrink-0 flex items-center justify-center border-2 ${pTheme.bulbBorder} ${pTheme.bulbBg} transition-all duration-300 z-10 ${
                                                                    isPairExpanded ? 'w-5 h-5 sm:w-6 sm:h-6 shadow-[0_0_12px_rgba(16,185,129,0.95)]' : 'w-4 h-4 sm:w-4.5 sm:h-4.5'
                                                                }`}>
                                                                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white/90 -mt-0.5 -ml-0.5 pointer-events-none"></div>
                                                                </div>

                                                                {/* Horizontal Glass Stem Tube (หลอดแก้วแนวนอนพร้อมขีดสเกล 4 เส้น) */}
                                                                <div className={`relative flex-1 -ml-1 rounded-r-full bg-slate-950/90 border border-white/25 overflow-hidden shadow-inner flex items-center transition-all duration-300 ${
                                                                    isPairExpanded ? 'h-3.5 sm:h-4' : 'h-3 sm:h-3.5'
                                                                }`}>
                                                                    {/* Graduation tick marks (ขีดสเกล 4 ขีด) */}
                                                                    <div className="absolute inset-0 flex justify-between px-2 pointer-events-none z-10 opacity-30">
                                                                        <div className="w-[1px] h-full bg-white"></div>
                                                                        <div className="w-[1px] h-full bg-white"></div>
                                                                        <div className="w-[1px] h-full bg-white"></div>
                                                                        <div className="w-[1px] h-full bg-white"></div>
                                                                    </div>

                                                                    {/* Specular top reflection line (เส้นสะท้อนแสงด้านบน) */}
                                                                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/40 z-20 pointer-events-none"></div>

                                                                    {/* Mercury Fill Bar */}
                                                                    <div 
                                                                        className={`h-full rounded-r-full ${pTheme.fillGradient} transition-all duration-700 relative`}
                                                                        style={{ width: `${fillWidth}%` }}
                                                                    >
                                                                        <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/80 rounded-r-full shadow-[0_0_4px_white]"></div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="w-0.5 sm:w-1 h-3 sm:h-6 bg-gradient-to-b from-emerald-500 via-emerald-500/60 to-transparent"></div>
                                    </div>
                                </div>
                            );
                        })()}
                        </div> {/* 🌾 End of animate-float-farm */}

                        {/* 🏡 SINGLE QUARANTINE GREENHOUSE DOME (แสดงโรงเรือนกระจกที่แปลงที่ 2: c: 1.0, r: 5 ก่อนคลิกขยาย) */}
                        {isClient && (portNumber === '97053088' || isPrime) && quarantinePreviewList.length > 0 && !isQuarantineExpanded && (
                            <div
                                key="quarantine_greenhouse_dome"
                                onClick={handleGreenhouseDomeClick}
                                className="absolute cursor-pointer transition-all duration-300 group select-none"
                                style={{
                                    left: `${(1 - 5) * TILE_W}px`,
                                    top: `${(1 + 5) * TILE_H_OFFSET}px`,
                                    zIndex: (1 + 5) + 20,
                                    width: '280px',
                                    height: '280px'
                                }}
                                title="โรงเรือนกระจกฟื้นฟูพืช (แตะเพื่อขยายดูคู่เงินที่ถูกกักขัง)"
                            >
                                {/* Subtle breathing magical amber aura under the dome */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-40 h-40 rounded-full bg-amber-500/15 group-hover:bg-amber-400/25 blur-2xl animate-pulse transition-all"></div>
                                    <div className="w-28 h-28 rounded-full bg-orange-400/15 group-hover:bg-orange-300/25 blur-xl animate-pulse delay-700 transition-all"></div>
                                </div>

                                {/* Greenhouse Dome Graphic: Compact & clean scale with subtle hover feedback */}
                                <div 
                                    className="absolute inset-0 scale-[0.78] origin-bottom transition-transform duration-300 group-hover:scale-[0.82] drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]" 
                                    style={{ marginTop: `${TREE_Y_OFFSET}px` }}
                                >
                                    <Image
                                        src="/farm/Greenhouse_dome.png"
                                        alt="Quarantine Greenhouse Dome"
                                        fill
                                        className="object-contain object-bottom"
                                        unoptimized
                                        priority
                                    />
                                </div>
                            </div>
                        )}

                        {/* 🛡️ QUARANTINE & RESCUE PREVIEW TREES (คลี่ออกมาจากจุดที่โดมอยู่ เรียงเป็นลำดับ 1 -> 2 -> 3 และชิดกัน) */}
                        {isClient && (portNumber === '97053088' || isPrime) && isQuarantineExpanded && quarantinePreviewList.map((qTree, idx) => {
                            const tZIndex = Math.round(qTree.c + qTree.r) + 20;
                            return (
                                <div
                                    key={`tree_${qTree.id}`}
                                    className="absolute pointer-events-none animate-fade-in"
                                    style={{
                                        left: `${(qTree.c - qTree.r) * TILE_W}px`,
                                        top: `${(qTree.c + qTree.r) * TILE_H_OFFSET}px`,
                                        zIndex: tZIndex,
                                        width: '280px',
                                        height: '280px',
                                        animationDelay: `${qTree.delayMs || idx * 150}ms`
                                    }}
                                >
                                    {/* Tree Graphic: Compact scale (scale-[0.75]) to sit close and not overwhelm the farm */}
                                    <div className="absolute inset-0 scale-[0.75] origin-bottom transition-all duration-300" style={{ marginTop: `${TREE_Y_OFFSET}px` }}>
                                        <Image
                                            src={qTree.src}
                                            alt={qTree.alt}
                                            fill
                                            className="object-contain object-bottom drop-shadow-2xl"
                                            unoptimized
                                            priority
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* 🌡️ QUARANTINE FLOATING OVERLAY: COMBINED DD BADGE OR EXPANDED INDIVIDUAL MERCURY BARS */}
                        {isClient && (portNumber === '97053088' || isPrime) && quarantinePreviewList.length > 0 && (() => {
                            const previewList = quarantinePreviewList;
                            const quarantineMercuryFill = Math.min(100, Math.max(12, (totalQuarantineDD / 50) * 100));
                            const quarTheme = getDDLevelTheme(totalQuarantineDD);

                            if (!isQuarantineExpanded) {
                                return (
                                    <div
                                        key="quarantine_combined_badge"
                                        className="absolute pointer-events-none"
                                        style={{
                                            left: `${(1 - 5) * TILE_W}px`,
                                            top: `${(1 + 5) * TILE_H_OFFSET}px`,
                                            zIndex: 90,
                                            width: '280px',
                                            height: '280px'
                                        }}
                                    >
                                        <div 
                                            className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto select-none"
                                        >
                                            <div 
                                                onClick={handleQuarantineBoxClick}
                                                className={`bg-[#1c1204]/95 hover:bg-[#2a1b06]/95 border sm:border-2 border-amber-500/90 rounded-xl text-center backdrop-blur-md flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ease-out select-none ${
                                                    highlightTarget === 'QUARANTINE'
                                                        ? 'ring-2 ring-amber-400 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.95)] scale-110'
                                                        : ''
                                                } ${
                                                    isQuarantineEnlarged
                                                        ? 'w-64 sm:w-72 py-3 px-4 sm:py-3.5 sm:px-5 shadow-[0_0_30px_rgba(245,158,11,0.85)] scale-100'
                                                        : 'w-32 sm:w-36 py-1.5 px-2.5 sm:py-2 sm:px-4 hover:scale-105 shadow-[0_0_15px_rgba(245,158,11,0.55)] animate-fade-in'
                                                }`}
                                                title={isQuarantineEnlarged ? "คลิกอีกครั้งเพื่อย่อกลับ" : "คลิกเพื่อขยายดูรายละเอียด"}
                                            >
                                                {/* Mini Subtitle Tag linking to Quarantined Pairs */}
                                                <div className="flex items-center gap-1 mb-0.5 pointer-events-none">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                                    <span className="text-[7px] sm:text-[8px] font-black tracking-widest text-amber-400 uppercase">
                                                        QUARANTINE
                                                    </span>
                                                </div>

                                                {/* Line 1: Main DD Number (สีเปลี่ยนตามระดับ DD: <18% เขียว, 18-28% เหลืองส้ม, >28% แดง) */}
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-mono font-black ${quarTheme.textColor} leading-tight tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] whitespace-nowrap transition-all duration-300 ${
                                                        isQuarantineEnlarged ? 'text-2xl sm:text-3xl' : 'text-[17px] sm:text-xl'
                                                    }`}>
                                                        -{totalQuarantineDD.toFixed(2)}%
                                                    </span>
                                                    <span className={`${quarTheme.arrowColor} transition-all duration-300 ${
                                                        isQuarantineEnlarged ? 'rotate-180 text-xs sm:text-sm' : 'text-[9px]'
                                                    }`}>
                                                        ▼
                                                    </span>
                                                </div>

                                                {/* Line 2: ปรอทแนวนอน ขยายตามความกว้างและความสูง (สีปรอทเปลี่ยนตามระดับ DD) */}
                                                <div className={`transition-all duration-300 ease-out flex items-center rounded-full bg-black/80 border border-amber-500/30 shadow-inner ${
                                                    isQuarantineEnlarged ? 'w-52 sm:w-60 px-1.5 py-1 mt-2' : 'w-24 sm:w-28 px-1 py-0.5 mt-1'
                                                }`}>
                                                    {/* Mercury Bulb (กระเปาะปรอททรงกลมเรืองแสงตามระดับ DD) */}
                                                    <div className={`relative rounded-full flex-shrink-0 flex items-center justify-center border ${quarTheme.bulbBorder} ${quarTheme.bulbBg} transition-all duration-300 ${
                                                        isQuarantineEnlarged ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'
                                                    }`}>
                                                        <div className="w-0.5 h-0.5 rounded-full bg-white/90 -mt-0.5 -ml-0.5"></div>
                                                    </div>

                                                    {/* Horizontal Glass Stem Tube */}
                                                    <div className={`relative flex-1 -ml-0.5 rounded-r-full bg-slate-950/80 border border-white/20 overflow-hidden shadow-inner flex items-center transition-all duration-300 ${
                                                        isQuarantineEnlarged ? 'h-2 sm:h-2.5' : 'h-1.5'
                                                    }`}>
                                                        <div className="absolute top-0 left-0 right-0 h-[0.5px] bg-white/40 z-20 pointer-events-none"></div>
                                                        <div 
                                                            className={`h-full rounded-r-full ${quarTheme.fillGradient} transition-all duration-700 relative`}
                                                            style={{ width: `${quarantineMercuryFill}%` }}
                                                        >
                                                            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/70 rounded-r-full"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key="quarantine_expanded_bars">
                                    {/* 🔘 ปุ่มวงกลมมีกากบาท (X) ขยายใหญ่ ลอยตัวอยู่บนปรอทเยื้องขวา ไม่ซ้อนทับปรอท */}
                                    <div
                                        className="absolute pointer-events-none"
                                        style={{
                                            left: `${(1.8 - 5) * TILE_W}px`,
                                            top: `${(1.8 + 5) * TILE_H_OFFSET}px`,
                                            zIndex: 99998,
                                            width: '280px',
                                            height: '280px'
                                        }}
                                    >
                                        <div className="absolute -top-20 sm:-top-24 left-1/2 translate-x-12 sm:translate-x-16 pointer-events-auto animate-fade-in">
                                            <button
                                                onClick={handleCloseQuarantine}
                                                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#1c1204]/95 hover:bg-[#332007] border-2 border-amber-500/90 hover:border-amber-400 text-amber-200 hover:text-white flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.85)] backdrop-blur-md transition-all active:scale-95 select-none cursor-pointer group"
                                                title="คลิกเพื่อรวบเก็บ DD รวม"
                                            >
                                                <X className="w-8 h-8 sm:w-10 sm:h-10 stroke-[2.5] group-hover:scale-110 transition-transform" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Individual Mercury Bars (คลี่ออกตามลำดับจากซ้ายไปขวา) */}
                                    {previewList.map((qTree, idx) => {
                                        const isTreeExpanded = expandedTreeId === qTree.id;
                                        const barZIndex = isTreeExpanded ? 99999 : 90;
                                        const fillWidth = Math.min(100, Math.max(12, (qTree.ddPct / 25) * 100));

                                        return (
                                            <div
                                                key={`bar_${qTree.id}`}
                                                className="absolute pointer-events-none animate-fade-in"
                                                style={{
                                                    left: `${(qTree.c - qTree.r) * TILE_W}px`,
                                                    top: `${(qTree.c + qTree.r) * TILE_H_OFFSET}px`,
                                                    zIndex: barZIndex,
                                                    width: '280px',
                                                    height: '280px',
                                                    animationDelay: `${qTree.delayMs || idx * 150}ms`
                                                }}
                                            >
                                                {/* 🌡️ หลอดปรอทแนวนอนเหนือต้นไม้ (ขยายใหญ่ขึ้น ขยายออกทางขวาไม่ล้นจอทางซ้าย) */}
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedTreeId(prev => prev === qTree.id ? null : qTree.id);
                                                    }}
                                                    className={`absolute top-0 flex flex-col items-center pointer-events-auto select-none cursor-pointer transition-all duration-300 ease-out ${
                                                        isTreeExpanded 
                                                            ? 'left-1/2 -translate-x-12 scale-[2.0] sm:scale-[1.8] -translate-y-8 origin-bottom-left shadow-[0_20px_40px_rgba(0,0,0,0.95),0_0_25px_rgba(245,158,11,0.6)]' 
                                                            : 'left-1/2 -translate-x-1/2 w-44 sm:w-48 hover:scale-105'
                                                    }`}
                                                    style={{
                                                        width: isTreeExpanded ? '170px' : undefined
                                                    }}
                                                    title={isTreeExpanded ? "แตะเพื่อย่อกลับขนาดปกติ" : "แตะเพื่อขยายหลอดปรอท"}
                                                >
                                                    {/* Status Header Badge */}
                                                    <div className={`flex items-center justify-between w-full px-2 py-0.5 rounded-t-lg bg-[#160e03]/95 backdrop-blur-md border-t border-x border-amber-500/70 shadow-lg text-[10px] font-mono font-bold transition-colors`}>
                                                        <span className="tracking-wider text-amber-300">
                                                            {qTree.sym}
                                                        </span>
                                                        <span className={`text-[8px] px-1 py-0.2 rounded font-semibold ${
                                                            qTree.isRescue 
                                                                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50' 
                                                                : 'bg-orange-500/25 text-orange-300 border border-orange-500/50'
                                                        }`}>
                                                            {qTree.label}
                                                        </span>
                                                        <span className="font-black text-amber-400">
                                                            -{qTree.ddPct.toFixed(1)}%
                                                        </span>
                                                    </div>

                                                    {/* Mercury Tube Assembly */}
                                                    <div className="flex items-center w-full px-1.5 py-1 rounded-b-lg bg-[#0e0802]/95 backdrop-blur-md border-b border-x border-amber-500/70 shadow-xl transition-colors">
                                                        {/* Mercury Bulb */}
                                                        <div className="relative w-3.5 h-3.5 rounded-full flex-shrink-0 flex items-center justify-center border border-amber-300 bg-gradient-to-br from-amber-400 via-orange-600 to-amber-800 shadow-[0_0_8px_rgba(245,158,11,0.9)]">
                                                            <div className="w-1 h-1 rounded-full bg-white/90 -mt-0.5 -ml-0.5"></div>
                                                        </div>

                                                        {/* Horizontal Glass Stem Tube */}
                                                        <div className="relative flex-1 h-2.5 -ml-0.5 rounded-r-full bg-slate-950/80 border border-white/25 overflow-hidden shadow-inner flex items-center">
                                                            <div className="absolute inset-0 flex justify-between px-1.5 pointer-events-none z-10 opacity-30">
                                                                <div className="w-[1px] h-full bg-white"></div>
                                                                <div className="w-[1px] h-full bg-white"></div>
                                                                <div className="w-[1px] h-full bg-white"></div>
                                                                <div className="w-[1px] h-full bg-white"></div>
                                                            </div>

                                                            <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/40 z-20 pointer-events-none"></div>

                                                            <div 
                                                                className={`h-full rounded-r-full transition-all duration-700 relative ${
                                                                    qTree.isRescue
                                                                        ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                                                                        : 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                                                                }`}
                                                                style={{
                                                                    width: `${fillWidth}%`
                                                                }}
                                                            >
                                                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/70 rounded-r-full"></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {isClient && (
                <div className="fixed bottom-0 left-0 w-full h-28 sm:h-40 bg-black/40 backdrop-blur-sm border-t border-amber-900/40 z-[60] flex flex-col">
                    {/* Desktop header row */}
                    <div className="hidden sm:flex justify-between px-6 pt-2 mb-1">
                        <span className="text-[10px] text-amber-200/50 uppercase tracking-[0.2em] font-bold">
                            Daily Harvest History ({dailyHistory.length}D)
                        </span>
                        <button 
                            onClick={() => {
                                const key = prompt("Enter API Key to download history:");
                                if(key) window.open(`/api/farm/export?port=${portNumber}&key=${key}`, '_blank');
                            }}
                            className="flex items-center gap-1.5 text-[9px] bg-amber-900/40 hover:bg-amber-900/60 text-amber-200/70 border border-amber-700/50 px-3 py-1 rounded transition-colors uppercase font-bold"
                        >
                            Export 90D History (.CSV)
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        </button>
                    </div>

                    {/* Crates scroll row (mobile: inline 90D button at END of scroll, desktop: fill remaining space) */}
                    <div
                        ref={historyScrollRef}
                        className="flex-1 w-full overflow-x-auto overflow-y-hidden flex items-center gap-3 sm:gap-6 px-3 sm:px-6 py-1 sm:py-2 no-scrollbar"
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

                        {/* Mobile-only: Square 90D button at the end, same size as crate */}
                        <button 
                            onClick={() => {
                                const key = prompt("Enter API Key to download history:");
                                if(key) window.open(`/api/farm/export?port=${portNumber}&key=${key}`, '_blank');
                            }}
                            className="sm:hidden flex-shrink-0 w-16 h-16 flex flex-col items-center justify-center bg-amber-900/40 hover:bg-amber-800/60 text-amber-200/80 border border-amber-700/50 rounded-lg transition-colors ml-auto"
                        >
                            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span className="text-[9px] font-bold uppercase">90D</span>
                        </button>
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

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* 🔮 PRIME EDITION: 4 FLOATING GLOWING ORBS (RIGHT DOCK)           */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {isPrime && (
                <>
                    <div className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-[90] flex flex-col gap-3 pointer-events-auto items-end">
                        {/* 🔮 Orb 1 Row: Glowing DD Dial Sphere & Horizontal Dispersal (กระจายออกมาทางซ้ายเรียงกัน 3 ลูก) */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {isDdOrbExpanded && (
                                <>
                                    {/* 1. Leftmost Orb: Quarantine Total DD (คู่เงินที่ถูกขังทั้งหมด) */}
                                    <div className="animate-orb-disperse-left">
                                        <GlowingDdOrb
                                            type="QUARANTINE"
                                            value={totalQuarantineDD}
                                            isHighlighted={highlightTarget === 'QUARANTINE'}
                                            onMouseEnter={() => setHighlightTarget('QUARANTINE')}
                                            onMouseLeave={() => setHighlightTarget(null)}
                                            title={`🔒 DD รวมของคู่เงินที่ถูกขังทั้งหมด: -${totalQuarantineDD.toFixed(2)}% (เชื่อมโยงกับกล่องต้นไม้ที่ขัง)`}
                                        />
                                    </div>

                                    {/* 2. Middle Orb: Active Farm DD (ฟาร์มที่ทำงานปัจจุบัน) */}
                                    <div className="animate-orb-disperse-mid">
                                        <GlowingDdOrb
                                            type="ACTIVE"
                                            value={activeFarmDDPct}
                                            isHighlighted={highlightTarget === 'FARM'}
                                            onMouseEnter={() => setHighlightTarget('FARM')}
                                            onMouseLeave={() => setHighlightTarget(null)}
                                            title={`🌾 DD ของฟาร์มที่ทำงานอยู่ปัจจุบัน: -${activeFarmDDPct.toFixed(2)}% (เชื่อมโยงกับกล่อง DD เหนือฟาร์ม)`}
                                        />
                                    </div>
                                </>
                            )}

                            {/* 3. Rightmost Orb: Original Orb 1 (Total Port DD รวมของพอร์ต) */}
                            <GlowingDdOrb
                                type="TOTAL"
                                value={totalPortDDPct}
                                showPing
                                onClick={() => setIsDdOrbExpanded(prev => !prev)}
                                title={isDdOrbExpanded ? "คลิกเพื่อพับเก็บลูกแก้วย่อย" : `📊 DD รวมของพอร์ต: -${totalPortDDPct.toFixed(2)}% (คลิกเพื่อคลี่ดู DD ฟาร์ม / DD ถูกขัง)`}
                            />
                        </div>

                        {/* Orb 2: Cyan/Blue Glow */}
                        <button
                            onClick={() => setPrimeActiveOrb(2)}
                            className="group relative flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-[#0f172a]/90 border border-cyan-500/60 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_35px_rgba(6,182,212,0.75)] hover:scale-110 active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer"
                            title="Prime menu 2"
                        >
                            <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400 group-hover:rotate-12 transition-transform" />
                        </button>

                        {/* Orb 3: Purple/Violet Glow */}
                        <button
                            onClick={() => setPrimeActiveOrb(3)}
                            className="group relative flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-[#0f172a]/90 border border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_35px_rgba(168,85,247,0.75)] hover:scale-110 active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer"
                            title="Prime menu 3"
                        >
                            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400 group-hover:scale-125 transition-transform" />
                        </button>

                        {/* Orb 4: Amber/Orange Glow */}
                        <button
                            onClick={() => setPrimeActiveOrb(4)}
                            className="group relative flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-[#0f172a]/90 border border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_35px_rgba(245,158,11,0.75)] hover:scale-110 active:scale-95 transition-all duration-300 backdrop-blur-md cursor-pointer"
                            title="Prime menu 4"
                        >
                            <Crosshair className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400 group-hover:rotate-90 transition-transform" />
                        </button>
                    </div>

                    {/* 🪟 PRIME TRANSLUCENT GLOWING MODAL POPUP */}
                    {primeActiveOrb !== null && (
                        <div 
                            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-[160] flex items-center justify-center p-3 animate-fade-in"
                            onClick={() => setPrimeActiveOrb(null)}
                        >
                            <div 
                                className={`relative ${
                                    primeActiveOrb === 2 
                                        ? 'w-[96vw] sm:w-[95vw] lg:w-[92vw] max-w-6xl max-h-[88vh] sm:max-h-[90vh]' 
                                        : 'w-[90vw] sm:w-[70vw] max-w-xl max-h-[70vh] sm:max-h-[72vh]'
                                } flex flex-col rounded-3xl p-3.5 sm:p-5 backdrop-blur-2xl border-2 shadow-2xl animate-fade-in transition-all overflow-hidden ${
                                    primeActiveOrb === 1 ? 'bg-[#061512]/90 border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.35)]' :
                                    primeActiveOrb === 2 ? 'bg-[#06121a]/95 border-cyan-500/60 shadow-[0_0_50px_rgba(6,182,212,0.35)]' :
                                    primeActiveOrb === 3 ? 'bg-[#12081d]/90 border-purple-500/60 shadow-[0_0_50px_rgba(168,85,247,0.35)]' :
                                    'bg-[#1a0f06]/90 border-amber-500/60 shadow-[0_0_50px_rgba(245,158,11,0.35)]'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-white/10 shrink-0">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shadow-lg ${
                                            primeActiveOrb === 1 ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                                            primeActiveOrb === 2 ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' :
                                            primeActiveOrb === 3 ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' :
                                            'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                        }`}>
                                            {primeActiveOrb === 1 && <Gauge className="w-5 h-5" />}
                                            {primeActiveOrb === 2 && <Layers className="w-5 h-5" />}
                                            {primeActiveOrb === 3 && <Zap className="w-5 h-5" />}
                                            {primeActiveOrb === 4 && <Crosshair className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-sm sm:text-base font-mono font-black text-white tracking-wider">
                                                    {primeActiveOrb === 1 ? 'SAFETY & RESILIENCE HUD' :
                                                     primeActiveOrb === 2 ? '20-PAIR COCKPIT MATRIX' :
                                                     `PRIME MENU ${primeActiveOrb}`}
                                                </h2>
                                                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold ${
                                                    primeActiveOrb === 1 ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' :
                                                    primeActiveOrb === 2 ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' :
                                                    'bg-white/10 border-white/20 text-white/60'
                                                }`}>
                                                    {primeActiveOrb === 1 ? 'TABLE D & E' :
                                                     primeActiveOrb === 2 ? 'CONTROL' : 'COMING SOON'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] sm:text-[11px] text-white/50 font-sans">
                                                {primeActiveOrb === 1 ? 'มาตรวัดและสเกลความปลอดภัยพอร์ต Real-time' :
                                                 primeActiveOrb === 2 ? 'ควบคุมสั่งการเปิด-ปิดคู่เงิน (Active vs Close-Only)' :
                                                 'ระบบสั่งการ EasyM Prime'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Close button */}
                                    <button
                                        onClick={() => setPrimeActiveOrb(null)}
                                        className="text-white/60 hover:text-white p-1.5 sm:p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                                        aria-label="Close"
                                    >
                                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                                    </button>
                                </div>

                                {/* 🛡️ ORB 1: TABLE D & E TACTICAL HUD */}
                                {primeActiveOrb === 1 && (
                                    <div className="overflow-y-auto py-3 space-y-3 pr-1 no-scrollbar flex-1">
                                        {/* TOP ROW: 3 DIALS (PORT DD, PORT MODE, LOCKED PAIR DD) */}
                                        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 items-stretch">
                                            {/* Dial 1: ค่าของพอร์ต (Portfolio DD) */}
                                            <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-between text-center relative overflow-hidden backdrop-blur-md">
                                                <div className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider truncate w-full">
                                                    ค่าของพอร์ต
                                                </div>

                                                <div className="relative w-full h-11 sm:h-13 flex items-center justify-center my-1">
                                                    <svg viewBox="0 0 130 65" className="w-full h-full overflow-visible">
                                                        <defs>
                                                            <linearGradient id="primeGaugeGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                <stop offset="0%" stopColor="#10b981" />
                                                                <stop offset="35%" stopColor="#10b981" />
                                                                <stop offset="60%" stopColor="#f59e0b" />
                                                                <stop offset="90%" stopColor="#ef4444" />
                                                            </linearGradient>
                                                        </defs>
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="#1e293b"
                                                            strokeWidth="9"
                                                            strokeLinecap="round"
                                                        />
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="url(#primeGaugeGrad1)"
                                                            strokeWidth="9"
                                                            strokeLinecap="round"
                                                            strokeDasharray="141.4"
                                                            strokeDashoffset={141.4 * (1 - Math.min(1, Math.max(0, primeTelemetry.ddPct / 50)))}
                                                            className="transition-all duration-700 ease-out"
                                                        />
                                                        {(() => {
                                                            const p = Math.min(1, Math.max(0, primeTelemetry.ddPct / 50));
                                                            const angleDeg = -90 + p * 180;
                                                            return (
                                                                <g transform={`rotate(${angleDeg}, 65, 60)`} className="transition-transform duration-700 ease-out">
                                                                    <line x1="65" y1="60" x2="65" y2="18" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
                                                                    <circle cx="65" cy="60" r="4.5" fill="#f8fafc" />
                                                                    <circle cx="65" cy="60" r="2" fill="#0f172a" />
                                                                </g>
                                                            );
                                                        })()}
                                                    </svg>
                                                </div>

                                                <div className="text-sm sm:text-base font-mono font-black text-white tracking-tight drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] w-full">
                                                    {primeTelemetry.ddPct.toFixed(2)}%
                                                </div>
                                            </div>

                                            {/* Dial 2: ค่าของโหมด (Table D Mode) */}
                                            <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-between text-center relative overflow-hidden backdrop-blur-md">
                                                <div className="text-[9px] sm:text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider truncate w-full flex items-center justify-center gap-1">
                                                    <span>ค่าของโหมด</span>
                                                    <span className={`text-[8px] sm:text-[9px] px-1 py-0.2 rounded font-black border ${
                                                        primeTelemetry.portMode === 'FREEZE' ? 'bg-red-500/20 text-red-300 border-red-500/50' :
                                                        primeTelemetry.portMode === 'SLOW' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' :
                                                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                                    }`}>
                                                        {primeTelemetry.portMode}
                                                    </span>
                                                </div>

                                                <div className="relative w-full h-11 sm:h-13 flex items-center justify-center my-1">
                                                    <svg viewBox="0 0 130 65" className="w-full h-full overflow-visible">
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="#1e293b"
                                                            strokeWidth="9"
                                                            strokeLinecap="round"
                                                        />
                                                        {/* 3 Zone Tracks: Normal(Green), Slow(Orange), Freeze(Red) */}
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="#10b981"
                                                            strokeWidth="9"
                                                            strokeDasharray="47.1 94.3"
                                                            strokeDashoffset="0"
                                                            className="opacity-80"
                                                        />
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="#f59e0b"
                                                            strokeWidth="9"
                                                            strokeDasharray="47.1 94.3"
                                                            strokeDashoffset="-47.1"
                                                            className="opacity-80"
                                                        />
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="#ef4444"
                                                            strokeWidth="9"
                                                            strokeDasharray="47.1 94.3"
                                                            strokeDashoffset="-94.2"
                                                            className="opacity-80"
                                                        />
                                                        {(() => {
                                                            // Mode DD has 3 zones dynamically driven by EA inputs: Normal (0 -> slowDD), Slow (slowDD -> freezeDD), Freeze (freezeDD -> freezeDD+10%+)
                                                            const slowLimit = primeTelemetry.settings?.slowDD ?? 15;
                                                            const freezeLimit = primeTelemetry.settings?.freezeDD ?? 28;
                                                            let angleDeg = -90;
                                                            if (primeTelemetry.modeDDPct <= slowLimit) {
                                                                angleDeg = -90 + (Math.max(0, primeTelemetry.modeDDPct) / (slowLimit || 1)) * 60;
                                                            } else if (primeTelemetry.modeDDPct <= freezeLimit) {
                                                                angleDeg = -30 + ((primeTelemetry.modeDDPct - slowLimit) / Math.max(1, freezeLimit - slowLimit)) * 60;
                                                            } else {
                                                                angleDeg = 30 + Math.min(1, (primeTelemetry.modeDDPct - freezeLimit) / 10) * 60;
                                                            }
                                                            return (
                                                                <g transform={`rotate(${angleDeg}, 65, 60)`} className="transition-transform duration-700 ease-out">
                                                                    <line x1="65" y1="60" x2="65" y2="18" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
                                                                    <circle cx="65" cy="60" r="4.5" fill="#f8fafc" />
                                                                    <circle cx="65" cy="60" r="2" fill="#0f172a" />
                                                                </g>
                                                            );
                                                        })()}
                                                    </svg>
                                                </div>

                                                <div className={`text-sm sm:text-base font-mono font-black tracking-tight w-full ${
                                                    primeTelemetry.portMode === 'FREEZE' ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]' :
                                                    primeTelemetry.portMode === 'SLOW' ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]' :
                                                    'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                                                }`}>
                                                    {primeTelemetry.modeDDPct.toFixed(2)}%
                                                </div>
                                            </div>

                                            {/* Dial 3: ค่าของคู่เงินที่ถูกขัง (Locked/Quarantined Pair DD) */}
                                            <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-2 sm:p-2.5 flex flex-col items-center justify-between text-center relative overflow-hidden backdrop-blur-md">
                                                <div className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider truncate w-full flex items-center justify-center gap-1">
                                                    <span>คู่เงินที่ถูกขัง</span>
                                                    <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                        {primeTelemetry.lockedPair.sym}
                                                    </span>
                                                </div>

                                                <div className="relative w-full h-11 sm:h-13 flex items-center justify-center my-1">
                                                    <svg viewBox="0 0 130 65" className="w-full h-full overflow-visible">
                                                        <defs>
                                                            <linearGradient id="primeGaugeGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                <stop offset="0%" stopColor="#f59e0b" />
                                                                <stop offset="50%" stopColor="#f97316" />
                                                                <stop offset="100%" stopColor="#ef4444" />
                                                            </linearGradient>
                                                        </defs>
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="#1e293b"
                                                            strokeWidth="9"
                                                            strokeLinecap="round"
                                                        />
                                                        <path
                                                            d="M 20 60 A 45 45 0 0 1 110 60"
                                                            fill="none"
                                                            stroke="url(#primeGaugeGrad3)"
                                                            strokeWidth="9"
                                                            strokeLinecap="round"
                                                            strokeDasharray="141.4"
                                                            strokeDashoffset={141.4 * (1 - Math.min(1, Math.max(0, primeTelemetry.lockedPair.ddPct / Math.max(30, (primeTelemetry.settings?.quarantineIn ?? 18) * 1.5))))}
                                                            className="transition-all duration-700 ease-out"
                                                        />
                                                        {(() => {
                                                            const qIn = primeTelemetry.settings?.quarantineIn ?? 18;
                                                            const maxScale = Math.max(30, qIn * 1.5);
                                                            const p = Math.min(1, Math.max(0, primeTelemetry.lockedPair.ddPct / maxScale));
                                                            const angleDeg = -90 + p * 180;
                                                            return (
                                                                <g transform={`rotate(${angleDeg}, 65, 60)`} className="transition-transform duration-700 ease-out">
                                                                    <line x1="65" y1="60" x2="65" y2="18" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
                                                                    <circle cx="65" cy="60" r="4.5" fill="#f8fafc" />
                                                                    <circle cx="65" cy="60" r="2" fill="#0f172a" />
                                                                </g>
                                                            );
                                                        })()}
                                                    </svg>
                                                </div>

                                                <div className="text-sm sm:text-base font-mono font-black text-amber-300 tracking-tight drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] w-full">
                                                    {primeTelemetry.lockedPair.ddPct.toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* ═══ LIVE EA DASHBOARD HUD BANNER (TABLE D & TABLE E EXACT REPLICA) ═══ */}
                                        <div className="bg-black/80 border border-cyan-500/50 rounded-2xl p-3 sm:p-3.5 backdrop-blur-xl shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col gap-2 font-mono">
                                            {/* Top mini header */}
                                            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-1.5 text-[10px]">
                                                <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
                                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                                    <span>EA PRIME DASHBOARD TELEMETRY</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-white/40">
                                                    <span>MT5 LIVE FEED</span>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                </div>
                                            </div>

                                            {/* Row 1: Table D (MODE | WORST) */}
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 text-xs border border-cyan-500/30 rounded-xl overflow-hidden bg-black/60 p-1.5">
                                                <div className="md:col-span-5 flex items-center gap-2 px-2 py-1 bg-cyan-950/20 rounded-lg border border-cyan-500/20">
                                                    <span className="text-cyan-400 font-black text-[11px] tracking-wider shrink-0 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">MODE</span>
                                                    <span className={`font-black tracking-tight ${
                                                        primeTelemetry.portMode === 'FREEZE' ? 'text-red-400' :
                                                        primeTelemetry.portMode === 'SLOW' ? 'text-amber-400' :
                                                        'text-emerald-400'
                                                    }`}>
                                                        {primeTelemetry.portMode}
                                                    </span>
                                                    <span className="text-white/40 font-normal">DD=</span>
                                                    <span className="font-bold text-white tracking-tight">
                                                        {primeTelemetry.modeDDPct.toFixed(2)}%
                                                    </span>
                                                </div>

                                                <div className="md:col-span-7 flex items-center gap-2 px-2 py-1 bg-cyan-950/20 rounded-lg border border-cyan-500/20 overflow-x-auto no-scrollbar">
                                                    <span className="text-cyan-400 font-black text-[11px] tracking-wider shrink-0 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">WORST</span>
                                                    <div className="flex items-center gap-2 whitespace-nowrap text-white/90">
                                                        {primeTelemetry.worstItems.map((item, idx) => (
                                                            <span key={item.sym} className="flex items-center gap-1">
                                                                <span className="font-semibold text-white/80">{item.sym}</span>
                                                                <span className={item.flag === 'F' ? 'text-red-400 font-bold' : item.flag === 'S' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                                                                    {item.lossPct.toFixed(1)}{item.flag}
                                                                </span>
                                                                {idx < primeTelemetry.worstItems.length - 1 && <span className="text-white/30">|</span>}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 2: Table E (BUF | FUND | ALERT BAR) */}
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-1.5 text-xs border border-cyan-500/30 rounded-xl overflow-hidden bg-black/60 p-1.5">
                                                {/* Col 0: BUF */}
                                                <div className="md:col-span-3 flex items-center gap-1.5 px-2 py-1 bg-emerald-950/20 rounded-lg border border-emerald-500/20">
                                                    <span className="text-emerald-400 font-black text-[11px] tracking-wider shrink-0">BUF:</span>
                                                    <span className="text-emerald-300 font-black tracking-tight">
                                                        {primeTelemetry.bufPct >= 0 ? '+' : ''}{primeTelemetry.bufPct.toFixed(1)}%
                                                    </span>
                                                    <span className="text-emerald-400/70 text-[11px]">
                                                        ({primeTelemetry.resMult.toFixed(1)}x)
                                                    </span>
                                                </div>

                                                {/* Col 1: FUND */}
                                                <div className="md:col-span-4 flex items-center gap-1.5 px-2 py-1 bg-amber-950/20 rounded-lg border border-amber-500/20">
                                                    <span className="text-amber-400 font-black text-[11px] tracking-wider shrink-0">FUND:</span>
                                                    <span className="text-amber-300 font-black tracking-tight">
                                                        {primeTelemetry.reliefBudget.toFixed(2)}
                                                    </span>
                                                    <span className="text-amber-400/70 text-[10px]">
                                                        (C:{primeTelemetry.reliefCap} | U:{primeTelemetry.reliefUsed.toFixed(2)})
                                                    </span>
                                                </div>

                                                {/* Col 2: Alert, Rescue & Quarantine */}
                                                <div className="md:col-span-5 flex items-center gap-2 px-2 py-1 bg-amber-950/30 rounded-lg border border-amber-500/30 overflow-x-auto no-scrollbar text-amber-300 font-medium text-[11px]">
                                                    <span className="text-white/70 shrink-0">R{primeTelemetry.rescueOrdersCount}: {primeTelemetry.rescueDDPct.toFixed(2)}%</span>
                                                    <span className="text-white/30">|</span>
                                                    <span className="text-amber-300 shrink-0 font-bold">{primeTelemetry.quarantineSummary}</span>
                                                    <span className="text-white/30">|</span>
                                                    <span className="text-rose-400 font-black uppercase shrink-0 px-1 py-0.2 rounded bg-rose-500/20 border border-rose-500/40 animate-pulse">
                                                        {primeTelemetry.alertAction}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ═══ SECTION D: TABLE D DETAILED PANELS (MODE & WORST CONTROL) ═══ */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* Panel D1: Portfolio Auto Mode */}
                                            <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md flex flex-col justify-between">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${
                                                            primeTelemetry.portMode === 'FREEZE' ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]' :
                                                            primeTelemetry.portMode === 'SLOW' ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]' :
                                                            'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                                                        }`} />
                                                        <span className="text-[10px] font-mono font-bold text-white/60 tracking-wider">PORTFOLIO AUTO MODE (TABLE D)</span>
                                                    </div>
                                                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                                                        primeTelemetry.portMode === 'FREEZE' ? 'bg-red-500/20 text-red-300 border-red-500/50' :
                                                        primeTelemetry.portMode === 'SLOW' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' :
                                                        'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                                    }`}>
                                                        {primeTelemetry.portMode}
                                                    </span>
                                                </div>

                                                <div className="my-2 flex items-baseline justify-between">
                                                    <div>
                                                        <div className={`text-2xl sm:text-3xl font-mono font-black ${
                                                            primeTelemetry.portMode === 'FREEZE' ? 'text-red-400' :
                                                            primeTelemetry.portMode === 'SLOW' ? 'text-amber-400' :
                                                            'text-emerald-400'
                                                        }`}>
                                                            DD = {primeTelemetry.modeDDPct.toFixed(2)}%
                                                        </div>
                                                        <div className="text-[10px] font-mono text-white/50 mt-0.5">
                                                            Mode Drawdown (หักคู่เงินที่ถูกขังออกแล้ว)
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Threshold Meter Bar */}
                                                <div className="space-y-1 mt-1">
                                                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-white/10 flex">
                                                        <div className="h-full bg-emerald-500/70 border-r border-black/40" style={{ width: '42.8%' }} title={`NORMAL: 0 - ${primeTelemetry.settings?.slowDD ?? 15}%`} />
                                                        <div className="h-full bg-amber-500/70 border-r border-black/40" style={{ width: '37.1%' }} title={`SLOW: ${primeTelemetry.settings?.slowDD ?? 15} - ${primeTelemetry.settings?.freezeDD ?? 28}%`} />
                                                        <div className="h-full bg-red-500/70" style={{ width: '20.1%' }} title={`FREEZE: ${primeTelemetry.settings?.freezeDD ?? 28}%+`} />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-mono text-white/40">
                                                        <span className="text-emerald-400 font-semibold">Normal &le;{primeTelemetry.settings?.slowDD ?? 15}%</span>
                                                        <span className="text-amber-400 font-semibold">Slow &le;{primeTelemetry.settings?.freezeDD ?? 28}%</span>
                                                        <span className="text-red-400 font-semibold">Freeze &gt;{primeTelemetry.settings?.freezeDD ?? 28}%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Panel D2: Worst Symbols Throttle */}
                                            <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md flex flex-col justify-between">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-amber-400">⚠️</span>
                                                        <span className="text-[10px] font-mono font-bold text-white/60 tracking-wider">WORST SYMBOLS THROTTLE</span>
                                                    </div>
                                                    <span className="text-[9px] font-mono text-white/40">
                                                        คุมความเสี่ยงรายคู่
                                                    </span>
                                                </div>

                                                <div className="my-2 space-y-2">
                                                    {primeTelemetry.worstItems.map((item) => (
                                                        <div key={item.sym} className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/10">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-black text-sm text-white tracking-wider">{item.sym}</span>
                                                                <span className="text-[10px] font-mono text-white/40">ขาดทุน</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-mono font-bold text-sm ${item.flag === 'F' ? 'text-red-400' : item.flag === 'S' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                                    {item.lossPct.toFixed(1)}%
                                                                </span>
                                                                <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded border ${
                                                                    item.flag === 'F' ? 'bg-red-500/20 text-red-300 border-red-500/50' :
                                                                    item.flag === 'S' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' :
                                                                    'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                                                }`}>
                                                                    {item.flag} {item.flagLabel}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="text-[9px] font-mono text-white/40 mt-1 flex justify-between">
                                                    <span>- ปกติ (&lt;4%)</span>
                                                    <span>S ชะลอ (4-8%)</span>
                                                    <span className="text-rose-400">F แช่แข็ง (&ge;8%)</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ═══ SECTION E: TABLE E DETAILED PANELS (BUFFER & RELIEF VAULT) ═══ */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* Capital Buffer & Resilience Multiplier */}
                                            <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md flex flex-col justify-between">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-mono text-white/60 font-bold tracking-wider">CAPITAL BUFFER (BUF)</span>
                                                    <span className="text-[10px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                                                        {primeTelemetry.resMult.toFixed(2)}x RESILIENCE
                                                    </span>
                                                </div>

                                                <div className="my-2 flex items-baseline gap-2">
                                                    <div className={`text-2xl sm:text-3xl font-mono font-black ${primeTelemetry.bufPct >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                        {primeTelemetry.bufPct >= 0 ? '+' : ''}{primeTelemetry.bufPct.toFixed(1)}%
                                                    </div>
                                                    <div className="text-[11px] font-mono text-white/40">
                                                        above baseline capital
                                                    </div>
                                                </div>

                                                {/* Resilience level meter */}
                                                <div className="space-y-1">
                                                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/10">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                                                            style={{ width: `${Math.min(100, Math.max(10, (primeTelemetry.resMult / 2) * 100))}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-mono text-white/40">
                                                        <span>1.0x (Par)</span>
                                                        <span>1.5x (Safe)</span>
                                                        <span>2.0x+ (Fortress)</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Cross-Pair Relief Fund (FUND) */}
                                            <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md flex flex-col justify-between">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-mono text-white/60 font-bold tracking-wider">RELIEF FUND VAULT (FUND)</span>
                                                    <span className="text-[10px] font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                                                        40% PROFIT SLICING
                                                    </span>
                                                </div>

                                                <div className="my-2 flex items-baseline gap-2">
                                                    <div className="text-2xl sm:text-3xl font-mono font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                                                        ${primeTelemetry.reliefBudget.toFixed(2)}
                                                    </div>
                                                    <div className="text-[11px] font-mono text-white/50">
                                                        USC กองทุนสะสม
                                                    </div>
                                                </div>

                                                {/* Slicing Vault capacity bar */}
                                                <div className="space-y-1">
                                                    <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-white/10">
                                                        <div 
                                                            className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-500"
                                                            style={{ width: `${Math.min(100, (primeTelemetry.reliefBudget / (primeTelemetry.reliefCap || 1)) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-mono text-white/40">
                                                        <span>Used: ${primeTelemetry.reliefUsed.toFixed(2)}</span>
                                                        <span>Cap: ${primeTelemetry.reliefCap.toLocaleString()} USC (5%)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ═══ SECTION E3: TACTICAL DEFENSE, RESCUE GRID & QUARANTINE ═══ */}
                                        <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md">
                                            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                                                    <span className="text-xs font-mono font-bold text-white/90">DEFENSE &amp; QUARANTINE STATUS</span>
                                                </div>
                                                <span className="text-[10px] font-mono text-rose-400 font-bold uppercase px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 animate-pulse">
                                                    {primeTelemetry.alertAction}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                                                {/* R0: Rescue Grid */}
                                                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between">
                                                    <span className="text-[10px] text-white/50 font-bold mb-1">RESCUE GRID</span>
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-cyan-400 font-black text-base">R{primeTelemetry.rescueOrdersCount}</span>
                                                        <span className="text-white/60 text-xs">({primeTelemetry.rescueDDPct.toFixed(2)}% DD)</span>
                                                    </div>
                                                    <span className="text-[9px] text-white/40 mt-1">
                                                        {primeTelemetry.rescueOrdersCount > 0 ? 'ระบบกริดกู้ชีพทำงาน' : 'สแตนด์บายปกติ'}
                                                    </span>
                                                </div>

                                                {/* QT: Quarantined Pairs */}
                                                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between sm:col-span-2">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] text-white/50 font-bold">QUARANTINED PAIRS (ขังไม้เดี่ยว)</span>
                                                        <span className="text-[10px] text-amber-400 font-bold">{primeTelemetry.quarantineSummary}</span>
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 my-1">
                                                        {primeTelemetry.quarantinedDetails.map(q => (
                                                            <div key={q.sym} className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5">
                                                                <span>{q.abbr} ({q.sym})</span>
                                                                <span className="text-white font-mono">{q.ddPct.toFixed(2)}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <span className="text-[9px] text-white/40">
                                                        แยกคู่เงินติดลบออกจากการคำนวณโหมดพอร์ตเพื่อป้องกันการแช่แข็งทั้งระบบ
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 🎛️ ORB 2: 20-PAIR COCKPIT MATRIX (MT5 EA DASHBOARD MIRROR) */}
                                {primeActiveOrb === 2 && (
                                    <div className="overflow-y-auto py-2.5 sm:py-3 space-y-3 pr-1 no-scrollbar flex-1 flex flex-col">
                                        {/* Quick Actions & Pair Status Summary */}
                                        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-black/60 border border-cyan-500/30 rounded-2xl p-2.5 sm:p-3.5 backdrop-blur-md shrink-0">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                                                <div className="text-xs font-mono">
                                                    <span className="text-white/50">COCKPIT STATUS: </span>
                                                    <span className="text-emerald-400 font-black font-mono">{activeCount} ACTIVE</span>
                                                    <span className="text-white/30 mx-1.5">|</span>
                                                    <span className="text-amber-400 font-black font-mono">{closeOnlyCount} CLOSE-ONLY</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => requestSetAllPairs(true)}
                                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] sm:text-xs font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    <span>SET ALL ACTIVE</span>
                                                </button>
                                                <button
                                                    onClick={() => requestSetAllPairs(false)}
                                                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] sm:text-xs font-mono font-bold transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <Power className="w-3.5 h-3.5" />
                                                    <span>SET ALL CLOSE-ONLY</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* 20 PAIRS TWO-COLUMN MT5 REPLICA TABLE */}
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 overflow-y-auto max-h-[58vh] sm:max-h-[62vh] pr-1 no-scrollbar">
                                            {/* Left Column (10 Pairs) */}
                                            <div className="bg-black/50 border border-cyan-500/25 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
                                                <div className="px-3 py-2 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center justify-between">
                                                    <span className="text-[11px] font-mono font-black text-cyan-300 tracking-wider">PRIMARY CLUSTER (1 - 10)</span>
                                                    <span className="text-[10px] font-mono text-white/40">EUR • USD • AUD • CAD</span>
                                                </div>
                                                <div className="overflow-x-auto no-scrollbar flex-1">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-[10px] font-mono text-white/50 bg-black/40">
                                                                <th className="py-2 px-2.5">SYM</th>
                                                                <th className="py-2 px-1 text-center">DIR</th>
                                                                <th className="py-2 px-2">ORDERS</th>
                                                                <th className="py-2 px-2">P/L</th>
                                                                <th className="py-2 px-2 text-right">LOT</th>
                                                                <th className="py-2 px-2 text-right">DD%</th>
                                                                <th className="py-2 px-2 text-center">COMMAND</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {PRIME_LEFT_PAIRS.map(pair => {
                                                                const isEnabled = pairControls[pair]?.enabled !== false;
                                                                const data = primeTelemetry.pairData[pair] || {
                                                                    count: 0, lot: 0, pnl: 0, buyCount: 0, sellCount: 0, buyLot: 0, sellLot: 0, side: '-', ddPct: 0
                                                                };
                                                                const maxTicks = 8;
                                                                const filledTicks = Math.min(maxTicks, data.count);
                                                                const pnlVal = data.pnl;
                                                                const pnlFormatted = pnlVal > 0 ? `+${pnlVal.toFixed(2)}` : pnlVal < 0 ? pnlVal.toFixed(2) : '0.00';
                                                                const pnlColor = pnlVal > 0 ? 'text-emerald-400' : pnlVal < 0 ? 'text-rose-400' : 'text-white/40';
                                                                const ddVal = data.ddPct;
                                                                const ddColor = ddVal >= 8 ? 'text-rose-400 font-bold' : ddVal >= 4 ? 'text-amber-400 font-bold' : ddVal > 0 ? 'text-emerald-400' : 'text-white/40';

                                                                return (
                                                                    <tr key={pair} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                                                                        <td className="py-1.5 px-2.5 font-mono font-black text-xs text-white tracking-wider whitespace-nowrap">
                                                                            <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-white/15 inline-block text-[11px]">
                                                                                {pair}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                                                                            {data.side === 'B' ? (
                                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono font-black text-[10px] bg-cyan-500/25 border border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                                                                                    B
                                                                                </span>
                                                                            ) : data.side === 'S' ? (
                                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono font-black text-[10px] bg-amber-500/25 border border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                                                                                    S
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono text-[10px] bg-white/5 border border-white/10 text-white/30">
                                                                                    -
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-1.5 px-2 whitespace-nowrap">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="flex items-center gap-0.5 w-11 sm:w-12 h-3 bg-black/60 rounded px-1 border border-white/10">
                                                                                    {Array.from({ length: maxTicks }).map((_, i) => (
                                                                                        <div 
                                                                                            key={i} 
                                                                                            className={`flex-1 h-2 rounded-[1px] transition-all ${
                                                                                                i < filledTicks 
                                                                                                    ? (i >= 5 ? 'bg-rose-500 shadow-[0_0_3px_rgba(244,63,94,0.8)]' : i >= 3 ? 'bg-amber-400 shadow-[0_0_3px_rgba(245,158,11,0.8)]' : 'bg-emerald-400 shadow-[0_0_3px_rgba(16,185,129,0.8)]')
                                                                                                    : 'bg-white/10'
                                                                                            }`} 
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                                <span className="font-mono text-xs font-bold text-white/90 w-3 text-right">
                                                                                    {data.count}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-1.5 px-2 whitespace-nowrap">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="relative w-10 sm:w-12 h-2.5 bg-black/70 rounded-full border border-white/10 overflow-hidden shrink-0">
                                                                                    <div className="absolute top-0 bottom-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-white/40 z-10" />
                                                                                    {pnlVal > 0 ? (
                                                                                        <div 
                                                                                            className="absolute top-0 bottom-0 left-1/2 bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_4px_rgba(16,185,129,0.8)]"
                                                                                            style={{ width: `${Math.min(50, (pnlVal / 50) * 50)}%` }}
                                                                                        />
                                                                                    ) : pnlVal < 0 ? (
                                                                                        <div 
                                                                                            className="absolute top-0 bottom-0 right-1/2 bg-gradient-to-l from-rose-500 to-amber-500 shadow-[0_0_4px_rgba(244,63,94,0.8)]"
                                                                                            style={{ width: `${Math.min(50, (Math.abs(pnlVal) / 50) * 50)}%` }}
                                                                                        />
                                                                                    ) : null}
                                                                                </div>
                                                                                <span className={`font-mono text-[11px] font-bold text-right min-w-[45px] ${pnlColor}`}>
                                                                                    {pnlFormatted}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-1.5 px-2 font-mono text-[11px] text-cyan-200/90 text-right whitespace-nowrap">
                                                                            {data.lot > 0 ? data.lot.toFixed(2) : '0.00'}
                                                                        </td>
                                                                        <td className={`py-1.5 px-2 font-mono text-[11px] text-right whitespace-nowrap ${ddColor}`}>
                                                                            {data.ddPct > 0 ? `${data.ddPct.toFixed(2)}%` : '0.00%'}
                                                                        </td>
                                                                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                                                            <button
                                                                                onClick={() => requestTogglePair(pair, isEnabled)}
                                                                                className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-black tracking-wide border transition-all duration-200 cursor-pointer shadow-sm active:scale-95 ${
                                                                                    isEnabled
                                                                                        ? 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                                                                                        : 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-500/50 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                                                                                }`}
                                                                            >
                                                                                {isEnabled ? '🟢 ACTIVE' : '⛔ CLOSE'}
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Right Column (10 Pairs) */}
                                            <div className="bg-black/50 border border-cyan-500/25 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col">
                                                <div className="px-3 py-2 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center justify-between">
                                                    <span className="text-[11px] font-mono font-black text-cyan-300 tracking-wider">SECONDARY CLUSTER (11 - 20)</span>
                                                    <span className="text-[10px] font-mono text-white/40">GBP • NZD • CHF • JPY</span>
                                                </div>
                                                <div className="overflow-x-auto no-scrollbar flex-1">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-white/10 text-[10px] font-mono text-white/50 bg-black/40">
                                                                <th className="py-2 px-2.5">SYM</th>
                                                                <th className="py-2 px-1 text-center">DIR</th>
                                                                <th className="py-2 px-2">ORDERS</th>
                                                                <th className="py-2 px-2">P/L</th>
                                                                <th className="py-2 px-2 text-right">LOT</th>
                                                                <th className="py-2 px-2 text-right">DD%</th>
                                                                <th className="py-2 px-2 text-center">COMMAND</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {PRIME_RIGHT_PAIRS.map(pair => {
                                                                const isEnabled = pairControls[pair]?.enabled !== false;
                                                                const data = primeTelemetry.pairData[pair] || {
                                                                    count: 0, lot: 0, pnl: 0, buyCount: 0, sellCount: 0, buyLot: 0, sellLot: 0, side: '-', ddPct: 0
                                                                };
                                                                const maxTicks = 8;
                                                                const filledTicks = Math.min(maxTicks, data.count);
                                                                const pnlVal = data.pnl;
                                                                const pnlFormatted = pnlVal > 0 ? `+${pnlVal.toFixed(2)}` : pnlVal < 0 ? pnlVal.toFixed(2) : '0.00';
                                                                const pnlColor = pnlVal > 0 ? 'text-emerald-400' : pnlVal < 0 ? 'text-rose-400' : 'text-white/40';
                                                                const ddVal = data.ddPct;
                                                                const ddColor = ddVal >= 8 ? 'text-rose-400 font-bold' : ddVal >= 4 ? 'text-amber-400 font-bold' : ddVal > 0 ? 'text-emerald-400' : 'text-white/40';

                                                                return (
                                                                    <tr key={pair} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                                                                        <td className="py-1.5 px-2.5 font-mono font-black text-xs text-white tracking-wider whitespace-nowrap">
                                                                            <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-white/15 inline-block text-[11px]">
                                                                                {pair}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-1.5 px-1 text-center whitespace-nowrap">
                                                                            {data.side === 'B' ? (
                                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono font-black text-[10px] bg-cyan-500/25 border border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]">
                                                                                    B
                                                                                </span>
                                                                            ) : data.side === 'S' ? (
                                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono font-black text-[10px] bg-amber-500/25 border border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                                                                                    S
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center justify-center w-5 h-5 rounded font-mono text-[10px] bg-white/5 border border-white/10 text-white/30">
                                                                                    -
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-1.5 px-2 whitespace-nowrap">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="flex items-center gap-0.5 w-11 sm:w-12 h-3 bg-black/60 rounded px-1 border border-white/10">
                                                                                    {Array.from({ length: maxTicks }).map((_, i) => (
                                                                                        <div 
                                                                                            key={i} 
                                                                                            className={`flex-1 h-2 rounded-[1px] transition-all ${
                                                                                                i < filledTicks 
                                                                                                    ? (i >= 5 ? 'bg-rose-500 shadow-[0_0_3px_rgba(244,63,94,0.8)]' : i >= 3 ? 'bg-amber-400 shadow-[0_0_3px_rgba(245,158,11,0.8)]' : 'bg-emerald-400 shadow-[0_0_3px_rgba(16,185,129,0.8)]')
                                                                                                    : 'bg-white/10'
                                                                                            }`} 
                                                                                        />
                                                                                    ))}
                                                                                </div>
                                                                                <span className="font-mono text-xs font-bold text-white/90 w-3 text-right">
                                                                                    {data.count}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-1.5 px-2 whitespace-nowrap">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <div className="relative w-10 sm:w-12 h-2.5 bg-black/70 rounded-full border border-white/10 overflow-hidden shrink-0">
                                                                                    <div className="absolute top-0 bottom-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-white/40 z-10" />
                                                                                    {pnlVal > 0 ? (
                                                                                        <div 
                                                                                            className="absolute top-0 bottom-0 left-1/2 bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_4px_rgba(16,185,129,0.8)]"
                                                                                            style={{ width: `${Math.min(50, (pnlVal / 50) * 50)}%` }}
                                                                                        />
                                                                                    ) : pnlVal < 0 ? (
                                                                                        <div 
                                                                                            className="absolute top-0 bottom-0 right-1/2 bg-gradient-to-l from-rose-500 to-amber-500 shadow-[0_0_4px_rgba(244,63,94,0.8)]"
                                                                                            style={{ width: `${Math.min(50, (Math.abs(pnlVal) / 50) * 50)}%` }}
                                                                                        />
                                                                                    ) : null}
                                                                                </div>
                                                                                <span className={`font-mono text-[11px] font-bold text-right min-w-[45px] ${pnlColor}`}>
                                                                                    {pnlFormatted}
                                                                                </span>
                                                                            </div>
                                                                        </td>
                                                                        <td className="py-1.5 px-2 font-mono text-[11px] text-cyan-200/90 text-right whitespace-nowrap">
                                                                            {data.lot > 0 ? data.lot.toFixed(2) : '0.00'}
                                                                        </td>
                                                                        <td className={`py-1.5 px-2 font-mono text-[11px] text-right whitespace-nowrap ${ddColor}`}>
                                                                            {data.ddPct > 0 ? `${data.ddPct.toFixed(2)}%` : '0.00%'}
                                                                        </td>
                                                                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                                                                            <button
                                                                                onClick={() => requestTogglePair(pair, isEnabled)}
                                                                                className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-black tracking-wide border transition-all duration-200 cursor-pointer shadow-sm active:scale-95 ${
                                                                                    isEnabled
                                                                                        ? 'bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                                                                                        : 'bg-amber-500/20 hover:bg-amber-500/35 border-amber-500/50 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                                                                                }`}
                                                                            >
                                                                                {isEnabled ? '🟢 ACTIVE' : '⛔ CLOSE'}
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cockpit Safety Guard Note */}
                                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-[10px] sm:text-[11px] font-mono text-cyan-200/80 shrink-0">
                                            <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                                            <span>
                                                <strong className="text-cyan-300">ความปลอดภัยของระบบ:</strong> สั่งการได้เฉพาะเปิดรับออเดอร์ใหม่ (ACTIVE) หรือปิดรับออเดอร์ใหม่ให้เคลียร์ไม้เดิม (CLOSE-ONLY) เท่านั้น • ปิดการสั่งกักขังเพื่อไม่ให้กระทบกลไกคำนวณและเสถียรภาพพอร์ตของ EA
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 🔒 ORBS 3 & 4 (UPCOMING PLACEHOLDER) */}
                                {(primeActiveOrb === 3 || primeActiveOrb === 4) && (
                                    <div className="py-12 text-center flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-white/40 shadow-inner">
                                            <Lock className="w-7 h-7 text-white/50" />
                                        </div>
                                        <div className="inline-block px-4 py-1.5 rounded-xl bg-white/5 border border-white/10 mb-3">
                                            <span className={`font-mono text-sm font-bold ${
                                                primeActiveOrb === 3 ? 'text-purple-400' : 'text-amber-400'
                                            }`}>
                                                [ Prime menu {primeActiveOrb} : COMING SOON ]
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                                            ฟีเจอร์ส่วนนี้กำลังอยู่ในขั้นตอนการพัฒนาตามลำดับ (เปิดใช้งาน Orb 1 และ Orb 2 เป็นลำดับแรก)
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 🛡️ Pair Command Confirmation Dialog (กดยืนยันก่อนส่งคำสั่งไปที่อีเอ) */}
                    {pendingPairAction && (
                        <div 
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in"
                            onClick={() => !isDispatchingCommand && setPendingPairAction(null)}
                        >
                            <div 
                                className="bg-[#08131d] border-2 border-cyan-500/50 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-[0_0_60px_rgba(6,182,212,0.35)] animate-scale-up"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                                    <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                                        <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm sm:text-base font-mono font-black text-white tracking-wide">
                                            {pendingPairAction.type === 'SINGLE' 
                                                ? `ยืนยันส่งคำสั่ง [${pendingPairAction.pair}]`
                                                : 'ยืนยันส่งคำสั่งทุกคู่เงิน (ALL 20 PAIRS)'
                                            }
                                        </h3>
                                        <p className="text-[11px] text-white/50 font-sans">
                                            ยืนยันคำสั่งควบคุมการทำงานก่อนส่งไปยัง EA MT5
                                        </p>
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div className="py-4 space-y-3 font-mono text-xs">
                                    <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/50">เป้าหมายคำสั่ง:</span>
                                            <span className="font-black text-white px-2 py-0.5 rounded bg-white/10">
                                                {pendingPairAction.pair || '20 PAIRS'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-white/50">สถานะที่ต้องการเปลี่ยน:</span>
                                            <span className={`font-black px-2.5 py-0.5 rounded-full border text-xs ${
                                                pendingPairAction.targetEnabled
                                                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                                    : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                            }`}>
                                                {pendingPairAction.targetEnabled ? '🟢 ACTIVE (เปิดรับออเดอร์ใหม่)' : '⛔ CLOSE-ONLY (ปิดรับออเดอร์ใหม่)'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-[11px] font-sans text-white/70 leading-relaxed bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-2xl">
                                        {pendingPairAction.targetEnabled ? (
                                            <span>
                                                เมื่อกดยืนยัน อีเอ EasyM Prime จะ<strong>เปิดรับสัญญาณการเข้าออเดอร์ใหม่</strong>สำหรับคู่นี้ตามเงื่อนไขกลยุทธ์
                                            </span>
                                        ) : (
                                            <span>
                                                เมื่อกดยืนยัน อีเอ EasyM Prime จะ<strong>หยุดเปิดออเดอร์ใหม่</strong>สำหรับคู่นี้ โดยจะยังคงบริหารจัดการและปิดรวบกำไรไม้ที่ค้างอยู่เดิมให้จนจบ
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2.5 pt-2">
                                    <button
                                        disabled={isDispatchingCommand}
                                        onClick={() => setPendingPairAction(null)}
                                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        ยกเลิก (Cancel)
                                    </button>
                                    <button
                                        disabled={isDispatchingCommand}
                                        onClick={handleConfirmAction}
                                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-mono text-xs font-black shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isDispatchingCommand ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>กำลังส่งคำสั่ง...</span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                <span>ยืนยันส่งคำสั่ง EA</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
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
            {/* Theme Preview Countdown Floating Overlay */}
            {activePreviewSkin === 'farm' && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[200] bg-[#1f1611]/95 border border-[#cfa545] text-[#cfa545] font-mono text-xs px-5 py-2.5 rounded-full shadow-[0_0_25px_rgba(207,165,69,0.35)] flex items-center gap-2 animate-bounce">
                    <span className="w-2.5 h-2.5 bg-[#cfa545] rounded-full animate-ping" />
                    <span>โหมดทดลองใช้ธีม Farm 2.5D: {previewTimeLeft} วินาทีที่เหลือ</span>
                </div>
            )}

            {/* EA Wakeup / Trial Loading Spinner */}
            {forceShowEALoader && currentViewMode === 'farm' && (
                <div className="fixed inset-0 bg-[#0f0b08]/85 backdrop-blur-md z-[180] flex items-center justify-center p-4 transition-all duration-500">
                    <div className="bg-[#1f1815]/95 border border-[#cfa545]/30 rounded-2xl p-8 max-w-xs w-full text-center shadow-[0_0_40px_rgba(207,165,69,0.2)] flex flex-col items-center animate-fade-in-up">
                        <div className="relative w-16 h-16 mb-6">
                            <div className="absolute inset-0 border-4 border-amber-500/10 border-t-[#cfa545] rounded-full animate-spin"></div>
                            <div className="absolute inset-3 bg-gradient-to-br from-[#dcae4d] to-[#b88c32] rounded-full opacity-90 flex items-center justify-center shadow-[0_0_15px_rgba(207,165,69,0.4)]">
                                <svg className="w-5 h-5 text-[#1a110a] animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-sm font-black text-[#cfa545] tracking-widest uppercase mb-2 font-mono">
                            LOADING LIVE EA DATA
                        </h3>
                        <p className="text-xs text-amber-100/60 leading-relaxed font-sans">
                            กำลังปลุก EA เพื่อส่งข้อมูลออเดอร์ชุดแรก... กรุณารอสักครู่
                        </p>
                    </div>
                </div>
            )}

            {/* Admin Diagnostic Overlay for juntarasate@gmail.com */}
            <AdminFarmDiagnosticOverlay
                isSuperAdmin={isSuperAdmin}
                portNumber={portNumber}
                portStatus={portStatus}
                ordersCount={orders.length}
                licenseInfo={licenseInfo}
            />

            {/* 🌟 EXPANDED MERCURY THERMOMETER ZOOM MODAL (เมื่อคลิกที่ปรอทของต้นไม้) */}
            {selectedTreeModal && (
                <div 
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedTreeModal(null)}
                >
                    <div 
                        className="relative w-full max-w-md bg-gradient-to-b from-[#181111] via-[#0d0707] to-black border-2 border-red-500/60 rounded-2xl p-6 shadow-[0_0_50px_rgba(239,68,68,0.5)] flex flex-col gap-5 select-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header with Close Button */}
                        <div className="flex items-center justify-between border-b border-red-500/30 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🌡️</span>
                                <div>
                                    <h3 className="text-base font-black text-white font-mono tracking-wide">
                                        QUARANTINE THERMOMETER
                                    </h3>
                                    <p className="text-[11px] text-red-300/70 font-mono">
                                        EasyM Prime Live Drawdown Monitor
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedTreeModal(null)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition-colors border border-white/20"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Tree Preview & Symbol Readout */}
                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-3.5">
                            <div className="relative w-20 h-20 flex-shrink-0">
                                <Image
                                    src={selectedTreeModal.src}
                                    alt={selectedTreeModal.alt}
                                    fill
                                    className="object-contain drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]"
                                    unoptimized
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black font-mono text-cyan-400 tracking-wider">
                                        {selectedTreeModal.sym}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-black tracking-wider ${
                                        selectedTreeModal.isRescue 
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    }`}>
                                        {selectedTreeModal.label}
                                    </span>
                                </div>
                                <p className="text-xs text-white/70">
                                    {selectedTreeModal.isRescue 
                                        ? 'Sniper Rescue Grid กำลังทำงานเพื่อลดการติดลบ'
                                        : 'ถูกกักขังเดี่ยวเพื่อป้องกันความเสี่ยงของพอร์ต'}
                                </p>
                            </div>
                        </div>

                        {/* High-Res Enlarged Horizontal Mercury Thermometer Gauge */}
                        <div className="flex flex-col gap-2 bg-black/60 border border-white/10 rounded-xl p-4 shadow-inner">
                            <div className="flex justify-between items-baseline font-mono">
                                <span className="text-xs text-white/60 font-bold uppercase tracking-wider">
                                    Current Drawdown Level
                                </span>
                                <span className={`text-2xl font-black ${
                                    selectedTreeModal.isRescue ? 'text-amber-400' : 'text-rose-500'
                                }`}>
                                    -{selectedTreeModal.ddPct.toFixed(2)}%
                                </span>
                            </div>

                            {/* Big Mercury Tube Assembly */}
                            <div className="flex items-center w-full px-2 py-1.5 rounded-full bg-black border border-white/25 shadow-2xl">
                                {/* Big Mercury Bulb */}
                                <div className={`relative w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2 ${
                                    selectedTreeModal.isRescue 
                                        ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-amber-700 border-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.9)]'
                                        : 'bg-gradient-to-br from-rose-400 via-red-600 to-rose-800 border-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.9)]'
                                }`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/90 -mt-1 -ml-1"></div>
                                </div>

                                {/* Big Glass Stem */}
                                <div className="relative flex-1 h-5 -ml-1 rounded-r-full bg-slate-950/90 border border-white/30 overflow-hidden shadow-inner flex items-center">
                                    {/* Scale Ticks */}
                                    <div className="absolute inset-0 flex justify-between px-3 pointer-events-none z-10 opacity-40">
                                        <div className="w-[1.5px] h-full bg-white"></div>
                                        <div className="w-[1.5px] h-full bg-white"></div>
                                        <div className="w-[1.5px] h-full bg-white"></div>
                                        <div className="w-[1.5px] h-full bg-white"></div>
                                    </div>

                                    {/* Glass Reflection Highlight */}
                                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/50 z-20 pointer-events-none"></div>

                                    {/* Liquid Column */}
                                    <div 
                                        className={`h-full rounded-r-full transition-all duration-700 relative ${
                                            selectedTreeModal.isRescue
                                                ? 'bg-gradient-to-r from-amber-500 via-orange-400 to-cyan-300 shadow-[0_0_15px_rgba(251,191,36,0.9)]'
                                                : 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 shadow-[0_0_15px_rgba(244,63,94,0.9)]'
                                        }`}
                                        style={{
                                            width: `${Math.min(100, Math.max(12, (selectedTreeModal.ddPct / 25) * 100))}%`
                                        }}
                                    >
                                        <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/80 rounded-r-full"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Scale Indicators */}
                            <div className="flex justify-between text-[10px] font-mono text-white/50 px-1 pt-1">
                                <span>0%</span>
                                <span>10% Floor</span>
                                <span>14% Runaway</span>
                                <span>25% Max</span>
                            </div>
                        </div>

                        {/* Threshold info summary */}
                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                            <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] text-white/50 uppercase">เกณฑ์เข้าห้องขัง</span>
                                <span className="font-bold text-amber-300">DD &ge; 14% (หรือพอร์ต Slow 10%)</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-white/5 border border-white/10 flex flex-col">
                                <span className="text-[10px] text-white/50 uppercase">เกณฑ์ปลดปล่อย</span>
                                <span className="font-bold text-emerald-400">DD ลดลง 4% จากจุดเข้า</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedTreeModal(null)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold font-mono text-xs tracking-wider uppercase transition-all shadow-lg shadow-red-900/40"
                        >
                            ปิดหน้าต่าง (Close)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

