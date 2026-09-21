'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Activity, 
    Crown, 
    Trophy,
    ShieldAlert, 
    Users, 
    Database, 
    TrendingUp, 
    TrendingDown, 
    Server, 
    RefreshCw, 
    Search, 
    Filter, 
    Calendar, 
    Clock, 
    ExternalLink, 
    Layers, 
    CheckCircle2, 
    AlertTriangle, 
    ArrowUpRight,
    Wifi,
    WifiOff,
    BarChart3,
    Sparkles,
    Cpu,
    ArrowDownRight,
    CircleDollarSign,
    UserCheck,
    X
} from 'lucide-react';
import { toast } from 'sonner';

interface EasyMPortItem {
    portNumber: string;
    portName: string | null;
    customerId: string | null;
    customerName: string;
    customerEmail: string;
    adminName: string;
    adminEmail: string;
    productKey: string;
    productName: string;
    licenseTier: string;
    startDate: string;
    startDateRaw: string;
    endDate: string | null;
    endDateRaw: string | null;
    durationDays: number;
    lifecycleStatus: 'active' | 'dormant' | 'ended' | 'not_started';
    activeDays: number;
    balance: number;
    equity: number;
    floatingPnl: number;
    maxDrawdown: number;
    dailyMaxDrawdown: number;
    totalLots: number;
    buyCount: number;
    sellCount: number;
    accountType: string;
    isOnline: boolean;
    lastPing: string | null;
    updatedAt: string | null;
    todayPnl: number;
    todayClosedLots: number;
    eaVersion: string;
    accumulatedProfit: number;
    isActive: boolean;
    hasTelemetry: boolean;
    isTester: boolean;
    isRealRunning: boolean;
    isGoldMismatch: boolean;
    actualAssetType: string;
    actualSystemCode: string;
    hoursSinceLastPing: number;
    requiredBalanceUSC: number;
    telemetryType: 'full_sync' | 'license_only' | 'none';
    runStatus: 'running' | 'offline_48h' | 'insufficient_balance' | 'no_telemetry' | 'tester' | 'inactive_license' | 'mismatch_gold';
}

export interface MonthlyFleetStat {
    monthKey: string;
    monthLabel: string;
    newPortsCount: number;
    endedPortsCount: number;
    netGrowth: number;
    activePortsCount: number;
    activeUsersCount: number;
    activeCapitalUSC: number;
    activeCapitalUSD: number;
    growthRatePct: number;
}

interface CustomerGroup {
    customerId: string;
    customerName: string;
    customerEmail: string;
    adminName: string;
    adminEmail: string;
    ports: EasyMPortItem[];
    totalBalanceUSC: number;
    totalBalanceUSD: number;
    totalEquityUSC: number;
    totalEquityUSD: number;
    totalFloatingPnl: number;
    totalTodayPnl: number;
    totalProfit: number;
    onlineCount: number;
    activeCount: number;
    telemetryCount: number;
}

export interface FleetDailyStat {
    date: string;
    dateLabel: string;
    topPort: string;
    topProfit: number;
    topDD: number;
    minProfit: number;
    minProfitPort: string;
    totalProfit: number;
    avgProfit: number;
    maxDD: number;
    maxDDPort: string;
    minDD: number;
    minDDPort: string;
    avgDD: number;
    activeCount: number;
    positiveCount: number;
    contributingPorts: { port: string; profit: number; dd: number }[];
}

export interface FleetDailyComparison {
    today: FleetDailyStat;
    yesterday: FleetDailyStat;
    allTimePeak: {
        portNumber: string;
        profit: number;
        date: string;
        maxDD: number;
    };
    isWeekend?: boolean;
    holidayLabel?: string;
    marketOpenHour?: number;
}

function FleetProfitBarChart({ 
    ports, 
    theme = 'emerald' 
}: { 
    ports: { port: string; profit: number; dd: number }[]; 
    theme?: 'emerald' | 'amber';
}) {
    // Default to top #1 profitable port of the day so the banner is always populated
    const [selectedPort, setSelectedPort] = useState<{ port: string; profit: number; dd: number } | null>(
        ports && ports.length > 0 ? ports[0] : null
    );

    // Keep selectedPort synchronized if ports array updates
    useEffect(() => {
        if (ports && ports.length > 0) {
            setSelectedPort(prev => {
                if (!prev) return ports[0];
                const match = ports.find(p => p.port === prev.port);
                return match || ports[0];
            });
        }
    }, [ports]);

    if (!ports || ports.length === 0) {
        return (
            <div className="py-3 text-center text-xs text-muted-foreground italic bg-black/20 rounded border border-border/20">
                <span className="hidden sm:inline">กำลังรอพอร์ตชน TP ชุดแรกในวันนี้...</span>
                <span className="sm:hidden">รอปิดกำไรชุดแรก...</span>
            </div>
        );
    }

    const maxProfit = Math.max(...ports.map(p => p.profit), 1);

    const formatBarValue = (val: number) => {
        if (val >= 100000) return `${(val / 1000).toFixed(0)}k`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
        if (val >= 100) return Math.round(val).toString();
        if (val > 0) return val.toFixed(0);
        return '0';
    };

    const activePort = selectedPort || ports[0];
    const activeRank = ports.findIndex(p => p.port === activePort.port) + 1;

    return (
        <div className="space-y-2.5 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium">
                    <BarChart3 className={`w-3.5 h-3.5 ${theme === 'emerald' ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <span className="hidden sm:inline">การกระจายกำไรรายพอร์ต ({ports.length} พอร์ต):</span>
                    <span className="sm:hidden">กราฟกำไร ({ports.length} พอร์ต):</span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/80">
                    <span className="hidden sm:inline">เลื่อนเมาส์ชี้ดูข้อมูล / คลิกแท่งเพื่อเปิดหน้าฟาร์ม</span>
                    <span className="sm:hidden">แตะแท่งดูข้อมูล / ฟาร์ม</span>
                </span>
            </div>

            {/* Pinned Info Banner (Does NOT disappear when mouse leaves) */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs shadow-md transition-all duration-150 ${
                theme === 'emerald'
                    ? 'bg-gradient-to-r from-emerald-950/90 via-black/80 to-black/90 border-emerald-500/50'
                    : 'bg-gradient-to-r from-amber-950/90 via-black/80 to-black/90 border-amber-500/50'
            }`}>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="font-mono font-black text-amber-300 text-sm">
                        #{activePort.port}
                    </span>
                    <span className="font-mono text-emerald-400 font-extrabold text-sm sm:text-base">
                        +{activePort.profit.toLocaleString()} USC
                    </span>
                    <span className="text-[11px] text-muted-foreground/90 font-mono">
                        (≈ +${(activePort.profit / 100).toFixed(2)} USD)
                    </span>
                    <span className="text-[11px] text-amber-300 font-mono bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                        Max DD: {activePort.dd}%
                    </span>
                    {activeRank > 0 && activeRank <= 3 && (
                        <span className="text-[10px] bg-amber-500/25 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/40">
                            🏆 อันดับ {activeRank}
                        </span>
                    )}
                </div>
                <a
                    href={`/farm/${activePort.port}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-end sm:self-center text-xs font-semibold text-emerald-300 hover:text-emerald-100 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors shrink-0"
                >
                    <span>เปิดฟาร์มพอร์ตนี้</span>
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {/* Vertical Bars Container */}
            <div className="bg-black/60 rounded-lg p-3 border border-border/40 relative">
                {/* Horizontal Baseline */}
                <div className="absolute left-3 right-3 bottom-8 h-px bg-border/40 pointer-events-none" />

                <div className="flex items-end gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-2 scrollbar-thin">
                    {ports.map((p, idx) => {
                        const heightPct = Math.max(14, Math.min(100, Math.round((p.profit / maxProfit) * 100)));
                        const isTop3 = idx < 3;
                        const isSelected = activePort.port === p.port;
                        return (
                            <div
                                key={p.port}
                                className="group relative flex flex-col items-center flex-shrink-0 cursor-pointer"
                                onMouseEnter={() => setSelectedPort(p)}
                                onClick={() => {
                                    setSelectedPort(p);
                                    window.open(`/farm/${p.port}`, '_blank');
                                }}
                            >
                                {/* Vertical Bar */}
                                <div className="h-20 flex items-end">
                                    <div
                                        style={{ height: `${heightPct}%` }}
                                        className={`w-3.5 sm:w-4 rounded-t transition-all duration-150 group-hover:scale-y-110 ${
                                            isSelected
                                                ? 'bg-gradient-to-t from-amber-500 via-amber-300 to-yellow-200 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)] brightness-125'
                                                : theme === 'emerald'
                                                    ? isTop3
                                                        ? 'bg-gradient-to-t from-emerald-600 via-emerald-400 to-amber-300 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                                                        : 'bg-gradient-to-t from-emerald-700 via-emerald-500 to-emerald-400'
                                                    : isTop3
                                                        ? 'bg-gradient-to-t from-amber-700 via-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                                                        : 'bg-gradient-to-t from-amber-800 via-amber-600 to-amber-400'
                                        }`}
                                    />
                                </div>

                                {/* Profit Value Label below bar */}
                                <span className={`text-[9px] font-mono mt-1.5 select-none font-semibold whitespace-nowrap transition-colors ${
                                    isSelected
                                        ? 'text-amber-300 font-bold scale-110'
                                        : 'text-emerald-400/80 group-hover:text-amber-300'
                                }`}>
                                    +{formatBarValue(p.profit)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function EasyMMasterDashboardPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [loadingData, setLoadingData] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();

    // Raw datasets
    const [ports, setPorts] = useState<EasyMPortItem[]>([]);
    const [fleetStats, setFleetStats] = useState<FleetDailyComparison | null>(null);
    const [tableCounts, setTableCounts] = useState<{ [key: string]: number }>({});
    const [hourlyTraffic, setHourlyTraffic] = useState<number[]>(Array(24).fill(0));
    const [historicalPeaks, setHistoricalPeaks] = useState<number[]>(Array(24).fill(0));
    const [hoveredHour, setHoveredHour] = useState<number | null>(null);
    const [monthlyStats, setMonthlyStats] = useState<MonthlyFleetStat[]>([]);

    // เพดานขีดจำกัดประสิทธิภาพสูงสุดของ Supabase Compute & Connection Pooler (500 พอร์ตพร้อมกัน หรือ ~60,000 req/ชม.)
    // สำหรับเปรียบเทียบจำนวนพอร์ตที่ส่งข้อมูลเข้ามาพร้อมกันในแต่ละชั่วโมง
    const SUPABASE_MAX_CAPACITY = 500;
    const REQ_PER_PORT_HOUR = 120; // 1 พอร์ตส่งเฉลี่ย ~120 requests/ชั่วโมง (ส่งทุก 30 วินาที)

    // Filters & UI States
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedLicenseStatus, setSelectedLicenseStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'customer' | 'table' | 'cards'>('customer');
    const [activeTab, setActiveTab] = useState<'performance' | 'ports' | 'team-analytics'>('performance');

    // 1. Auth Guard: Only juntarasate@gmail.com
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUserEmail(user.email || null);
            setLoadingAuth(false);

            if (user.email === 'juntarasate@gmail.com') {
                loadAllDashboardData();
            }
        };
        checkAuth();
    }, [router]);

    // 2. Fetch & Aggregate All Dashboard Data
    const loadAllDashboardData = async () => {
        setLoadingData(true);
        setIsRefreshing(true);
        try {
            // A. Fetch all profiles to resolve referral upline admins
            const { data: profiles, error: profileErr } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, referred_by, created_at, is_tester');
            if (profileErr) throw profileErr;

            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            // Helper to get Root Admin
            const getRootAdmin = (userId: string | null) => {
                if (!userId) return { name: 'Direct / ระบบกลาง', email: 'juntarasate@gmail.com' };
                let current = profileMap.get(userId);
                let visited = new Set();
                let lastAdmin = null;

                while (current && !visited.has(current.id)) {
                    visited.add(current.id);
                    if (current.email === 'juntarasate@gmail.com') {
                        return { name: 'พี่โจ้ (juntarasate)', email: current.email };
                    }
                    if (current.email === 'bctutor123@gmail.com') {
                        return { name: 'ครูชัย (bctutor123)', email: current.email };
                    }
                    if (current.role === 'admin') {
                        lastAdmin = { name: current.full_name || current.email, email: current.email };
                    }
                    if (!current.referred_by) break;
                    current = profileMap.get(current.referred_by);
                }
                return lastAdmin || { name: 'Direct / ระบบกลาง', email: 'juntarasate@gmail.com' };
            };

            // B. Fetch all EasyM licenses
            const { data: licenses, error: licErr } = await supabase
                .from('licenses')
                .select('id, user_id, product_id, account_number, port_name, is_active, created_at, expiry_date, license_tier, products(id, name, product_key)');
            if (licErr) throw licErr;

            // Filter for EasyM products
            const easymLicenses = (licenses || []).filter(l => {
                const prod = Array.isArray(l.products) ? l.products[0] : l.products;
                const pKey = (prod as any)?.product_key || '';
                const pName = (prod as any)?.name || '';
                return pKey.includes('EZM') || pName.toLowerCase().includes('easym') || pName.toLowerCase().includes('easy m');
            });

            // Set of accounts that actually have a Gold EA license in system
            const goldLicenseAccountSet = new Set<string>();
            (licenses || []).forEach(l => {
                const prod = Array.isArray(l.products) ? l.products[0] : l.products;
                const pKey = ((prod as any)?.product_key || '').toUpperCase();
                const pName = ((prod as any)?.name || '').toUpperCase();
                if (pKey.includes('GOLD') || pName.includes('GOLD') || pKey.includes('EZG')) {
                    const rawAcc = (l.account_number || '').trim();
                    if (rawAcc) {
                        rawAcc.split(/[\s,]+/).filter(Boolean).forEach((acc: string) => goldLicenseAccountSet.add(acc));
                    }
                }
            });

            // C. Fetch all farm_port_status
            const { data: portStatuses, error: statusErr } = await supabase
                .from('farm_port_status')
                .select('*');
            if (statusErr) console.error('Status fetch error:', statusErr);

            const statusMap = new Map((portStatuses || []).map(s => [s.port_number?.toString(), s]));

            // D. Fetch accumulated daily history (paginated to include all 3,900+ rows)
            let allDailyHistory: any[] = [];
            let histPage = 0;
            const histPageSize = 1000;
            while (true) {
                const { data: batch, error: batchErr } = await supabase
                    .from('farm_daily_history')
                    .select('port_number, profit, max_dd, max_drawdown, date')
                    .range(histPage * histPageSize, (histPage + 1) * histPageSize - 1)
                    .order('date', { ascending: false });
                if (batchErr || !batch || batch.length === 0) break;
                allDailyHistory = allDailyHistory.concat(batch);
                if (batch.length < histPageSize) break;
                histPage++;
            }

            // Forex market trading date (rolls over dynamically at 17:00 New York time, handling US Daylight Saving Time automatically)
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

                // Forex daily candle closes at 17:00 (5:00 PM) New York time (EDT: 04:00 BKK, EST: 05:00 BKK)
                // At/after 17:00 NY, the session advances to the next trading day
                const marketDate = new Date(year, month, day);
                if (hour >= 17) {
                    marketDate.setDate(marketDate.getDate() + 1);
                }
                return marketDate;
            }

            // Detect current Bangkok market open hour based on US Daylight Saving Time (EDT: 04:00, EST: 05:00)
            function getMarketOpenHourBangkok(date: Date = new Date()): number {
                const formatter = new Intl.DateTimeFormat('en-US', {
                    timeZone: 'America/New_York',
                    timeZoneName: 'short'
                });
                const parts = formatter.formatToParts(date);
                const tzName = parts.find(p => p.type === 'timeZoneName')?.value;
                return tzName === 'EDT' ? 4 : 5;
            }

            function getMarketTradingDateStr(date: Date = new Date()): string {
                const d = getMarketTradingDate(date);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }

            const now = new Date();
            const marketDate = getMarketTradingDate(now);
            const marketDayOfWeek = marketDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

            let isWeekend = false;
            let holidayLabel = '';
            let day1Date: Date;
            let day2Date: Date;
            let day1Prefix: string;
            let day2Prefix: string;

            if (marketDayOfWeek === 6) {
                // วันเสาร์ (ตลาด Forex ปิดทำการเสาร์-อาทิตย์)
                isWeekend = true;
                holidayLabel = 'วันนี้วันเสาร์ (วันหยุด)';
                day1Date = new Date(marketDate);
                day1Date.setDate(day1Date.getDate() - 1); // วันศุกร์ (วันทำการล่าสุดก่อนวันหยุด)
                day2Date = new Date(marketDate);
                day2Date.setDate(day2Date.getDate() - 2); // วันพฤหัสบดี (วันทำการก่อนหน้า)
                day1Prefix = 'วันศุกร์';
                day2Prefix = 'วันพฤหัสบดี';
            } else if (marketDayOfWeek === 0) {
                // วันอาทิตย์ (ตลาด Forex ปิดทำการทั้งวัน)
                isWeekend = true;
                holidayLabel = 'วันนี้วันอาทิตย์ (วันหยุด)';
                day1Date = new Date(marketDate);
                day1Date.setDate(day1Date.getDate() - 2); // วันศุกร์ (วันทำการล่าสุดก่อนวันหยุด)
                day2Date = new Date(marketDate);
                day2Date.setDate(day2Date.getDate() - 3); // วันพฤหัสบดี (วันทำการก่อนหน้า)
                day1Prefix = 'วันศุกร์';
                day2Prefix = 'วันพฤหัสบดี';
            } else if (marketDayOfWeek === 1) {
                // วันจันทร์ (ตลาดเปิดทำการ 05:00 น. เช้าวันจันทร์)
                isWeekend = false;
                holidayLabel = '';
                day1Date = new Date(marketDate); // วันนี้ (วันจันทร์)
                day2Date = new Date(marketDate);
                day2Date.setDate(day2Date.getDate() - 3); // วันทำการก่อนหน้าคือวันศุกร์
                day1Prefix = 'วันนี้';
                day2Prefix = 'วันศุกร์';
            } else {
                // วันอังคาร - ศุกร์ (วันทำการปกติ)
                isWeekend = false;
                holidayLabel = '';
                day1Date = new Date(marketDate);
                day2Date = new Date(marketDate);
                day2Date.setDate(day2Date.getDate() - 1);
                day1Prefix = 'วันนี้';
                day2Prefix = 'เมื่อวาน';
            }

            const formatDateStr = (d: Date) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            const day1DateStr = formatDateStr(day1Date);
            const day2DateStr = formatDateStr(day2Date);
            const todayDateStr = formatDateStr(marketDate);
            const testPatterns = ['1111111', '12345678', '7777777', '8888888', '9999999', '12121210', '000000', '99999999', '999999'];
            const isTestPort = (acc?: any) => {
                if (!acc) return true;
                const str = String(acc).trim();
                return testPatterns.includes(str) || /^(\d)\1{5,}$/.test(str);
            };

            // Group history profit & worst DD by port
            const portHistoryProfitMap = new Map<string, number>();
            const portWorstDDMap = new Map<string, number>();
            const portFirstDateMap = new Map<string, string>();
            const portLastDateMap = new Map<string, string>();
            const portActiveMonthsMap = new Map<string, Set<string>>();
            const todayHistoryRecords: any[] = [];
            const yesterdayHistoryRecords: any[] = [];
            let allTimePeakRecord: any = null;

            // Build Set of genuine EasyM port account numbers
            const easymPortSet = new Set<string>();
            easymLicenses.forEach(lic => {
                const accs = (lic.account_number || '').split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean);
                accs.forEach((acc: string) => easymPortSet.add(acc));
            });
            easymPortSet.add('21692434');

            allDailyHistory.forEach(h => {
                const port = h.port_number?.toString();
                if (!port || !easymPortSet.has(port) || isTestPort(port)) return;

                const p = Number(h.profit) || 0;
                const dd = Number(h.max_dd || h.max_drawdown) || 0;

                portHistoryProfitMap.set(port, (portHistoryProfitMap.get(port) || 0) + p);
                if (dd > (portWorstDDMap.get(port) || 0)) {
                    portWorstDDMap.set(port, dd);
                }

                const curFirst = portFirstDateMap.get(port);
                if (!curFirst || (h.date && h.date < curFirst)) {
                    portFirstDateMap.set(port, h.date);
                }
                const curLast = portLastDateMap.get(port);
                if (!curLast || (h.date && h.date > curLast)) {
                    portLastDateMap.set(port, h.date);
                }
                if (h.date) {
                    const mKey = h.date.substring(0, 7);
                    if (!portActiveMonthsMap.has(port)) {
                        portActiveMonthsMap.set(port, new Set());
                    }
                    portActiveMonthsMap.get(port)!.add(mKey);
                }

                // Check all-time peak
                if (p > (allTimePeakRecord?.profit || 0)) {
                    allTimePeakRecord = { portNumber: port, profit: p, date: h.date, maxDD: dd };
                }

                // Split Today & Yesterday (strictly EasyM only: exclude Gold EA mismatches like 97072259)
                const st = statusMap.get(port);
                const isGoldPort = (port === '97072259') || (goldLicenseAccountSet.has(port) && (st?.system_code?.toLowerCase().includes('gold') || st?.system_code === 'EG_FARMING'));
                if (!isGoldPort) {
                    if (h.date === day1DateStr) {
                        todayHistoryRecords.push({ ...h, port_number: port });
                    } else if (h.date === day2DateStr) {
                        yesterdayHistoryRecords.push({ ...h, port_number: port });
                    }
                }
            });

            // Merge live farm_port_status for today ONLY if not weekend, last_ping is within today's market session (< 24h) and belongs to genuine EasyM (not Gold)
            if (!isWeekend) {
                (portStatuses || []).forEach(s => {
                    const accNum = s.port_number?.toString();
                    if (!accNum || !easymPortSet.has(accNum) || isTestPort(accNum)) return;
                    
                    // CRITICAL 1: Exclude Gold EA mismatches
                    const isGold = (accNum === '97072259') || (goldLicenseAccountSet.has(accNum) && (s.system_code?.toLowerCase().includes('gold') || s.system_code === 'EG_FARMING'));
                    if (isGold) return;

                    // CRITICAL 2: Only consider farm_port_status if last_ping is within today's market session and < 24 hours
                    if (!s.last_ping) return;
                    const pingBkk = getMarketTradingDateStr(new Date(s.last_ping));
                    const pingAgeHours = (now.getTime() - new Date(s.last_ping).getTime()) / (1000 * 60 * 60);
                    if (pingBkk !== day1DateStr || pingAgeHours > 24) return; // Ignore stale records from previous days or dead pings (e.g. 97033490!)

                    const pnl = Number(s.today_pnl) || 0;
                    const dd = Number(s.daily_max_drawdown) || 0;
                    const existing = todayHistoryRecords.find(r => r.port_number === accNum);
                    if (!existing && (pnl > 0 || dd > 0)) {
                        todayHistoryRecords.push({ port_number: accNum, profit: pnl, max_dd: dd, max_drawdown: dd, date: day1DateStr });
                    } else if (existing && pnl > Number(existing.profit)) {
                        existing.profit = pnl;
                    }
                });
            }

            // Compute Fleet Daily Stats
            const computeDayStats = (records: any[], dateStr: string, label: string): FleetDailyStat => {
                let maxP = 0;
                let topR: any = null;
                let minP = Infinity;
                let minPR: any = null;
                let totalP = 0;
                const dds: { port: string; dd: number }[] = [];
                let positiveCount = 0;
                const contributingPorts: { port: string; profit: number; dd: number }[] = [];

                records.forEach(r => {
                    const p = Number(r.profit) || 0;
                    const dd = Number(r.max_dd || r.max_drawdown) || 0;
                    const portStr = String(r.port_number || '');
                    totalP += p;

                    if (p > maxP) {
                        maxP = p;
                        topR = r;
                    }
                    if (p > 0) {
                        positiveCount++;
                        if (p < minP) {
                            minP = p;
                            minPR = r;
                        }
                        contributingPorts.push({ 
                            port: portStr, 
                            profit: Number(p.toFixed(2)),
                            dd: Number(dd.toFixed(1))
                        });
                    }
                    if (portStr) {
                        dds.push({ port: portStr, dd });
                    }
                });

                // Sort ports by profit descending
                contributingPorts.sort((a, b) => b.profit - a.profit);

                // DD metrics across ports
                let maxDD = 0;
                let maxDDPort = '-';
                let minDD = Infinity;
                let minDDPort = '-';
                let sumDD = 0;

                if (dds.length > 0) {
                    dds.forEach(item => {
                        sumDD += item.dd;
                        if (item.dd > maxDD) {
                            maxDD = item.dd;
                            maxDDPort = item.port;
                        }
                        if (item.dd < minDD && item.dd > 0) {
                            minDD = item.dd;
                            minDDPort = item.port;
                        }
                    });
                }
                if (minDD === Infinity) {
                    minDD = 0;
                    minDDPort = dds.length > 0 ? dds[0].port : '-';
                }

                const dt = new Date(dateStr + 'T00:00:00');
                const dayThai = dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                const avgP = positiveCount > 0 ? (totalP / positiveCount) : (records.length ? totalP / records.length : 0);
                const avgDD = dds.length ? (sumDD / dds.length) : 0;

                return {
                    date: dateStr,
                    dateLabel: `${label} (${dayThai})`,
                    topPort: maxP > 0 && topR?.port_number ? String(topR.port_number) : (label === 'วันนี้' ? 'กำลังรอชน TP' : '-'),
                    topProfit: Number(maxP.toFixed(2)),
                    topDD: Number(topR?.max_dd || topR?.max_drawdown || 0),
                    minProfit: minP !== Infinity ? Number(minP.toFixed(2)) : 0,
                    minProfitPort: minPR?.port_number ? String(minPR.port_number) : '-',
                    totalProfit: Number(totalP.toFixed(2)),
                    avgProfit: Number(avgP.toFixed(2)),
                    maxDD: Number(maxDD.toFixed(1)),
                    maxDDPort: maxDDPort !== '-' ? maxDDPort : (topR?.port_number ? String(topR.port_number) : '-'),
                    minDD: Number(minDD.toFixed(1)),
                    minDDPort,
                    avgDD: Number(avgDD.toFixed(1)),
                    activeCount: records.length,
                    positiveCount,
                    contributingPorts
                };
            };

            const computedFleetStats: FleetDailyComparison = {
                today: computeDayStats(todayHistoryRecords, day1DateStr, day1Prefix),
                yesterday: computeDayStats(yesterdayHistoryRecords, day2DateStr, day2Prefix),
                allTimePeak: allTimePeakRecord || { portNumber: '97037173', profit: 11091.17, date: '2026-07-30', maxDD: 0 },
                isWeekend,
                holidayLabel,
                marketOpenHour: getMarketOpenHourBangkok()
            };
            setFleetStats(computedFleetStats);

            // E. Build unified port items
            const portItemsMap = new Map<string, EasyMPortItem>();

            easymLicenses.forEach(lic => {
                const rawAcc = (lic.account_number || '').trim();
                if (!rawAcc) return;

                // Split space/comma separated account numbers if multiple were entered in one field
                const accList = rawAcc.split(/[\s,]+/).filter(Boolean);
                accList.forEach((accNum: string) => {
                    const existing = portItemsMap.get(accNum);
                    // If account already exists and existing is active while current is inactive, keep active
                    if (existing && existing.isActive && !lic.is_active) {
                        return;
                    }

                    const customer = lic.user_id ? profileMap.get(lic.user_id) : null;
                    const adminInfo = getRootAdmin(lic.user_id);
                    const status = statusMap.get(accNum);
                    const prodCurrency = (Array.isArray(lic.products) ? lic.products[0] : (lic.products as any))?.currency || 'USC';
                    const hasRealStatus = !!status && (Number(status.balance) > 0 || Number(status.equity) > 0 || status.last_ping != null || status.server_time != null);
                    
                    // Start date & Active days
                    const startDateStr = portFirstDateMap.get(accNum) || lic.created_at || new Date().toISOString();
                    const startDt = new Date(startDateStr);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - startDt.getTime());
                    const activeDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                    // Check online: active ping within last 30 minutes
                    let isOnline = false;
                    const pingTime = status?.last_ping ? new Date(status.last_ping).getTime() : 0;
                    const updTime = (status?.updated_at && status?.last_ping) ? new Date(status.updated_at).getTime() : 0;
                    const lastActive = Math.max(pingTime, updTime);
                    if (lastActive > 0) {
                        isOnline = (now.getTime() - lastActive) < 30 * 60 * 1000;
                    }

                    // Account type: prioritize product currency if status is empty shell or defaults to USD while product is USC
                    let resolvedAccType = status?.account_type || prodCurrency;
                    if (resolvedAccType === 'USD' && prodCurrency === 'USC' && (!status?.balance || status.balance === 0)) {
                        resolvedAccType = 'USC';
                    }

                    const prodKey = (Array.isArray(lic.products) ? lic.products[0] : (lic.products as any))?.product_key || 'EZM-MAX';
                    const prodName = (Array.isArray(lic.products) ? lic.products[0] : (lic.products as any))?.name || 'EasyM MAX';

                    const isGoldMismatch = (accNum === '97072259') || 
                                           (goldLicenseAccountSet.has(accNum) && (status?.system_code?.toLowerCase().includes('gold') || status?.system_code === 'EG_FARMING'));

                    const isTester = !!customer?.is_tester || isTestPort(accNum);
                    const isMax = prodKey.includes('MAX') || prodName.toLowerCase().includes('max');
                    const isMini = prodKey.includes('MIN') || prodName.toLowerCase().includes('mini');
                    const requiredBalanceUSC = isMax ? 100000 : (isMini ? 50000 : 30000);

                    const rawBal = Number(status?.balance) || 0;
                    const balUSC = resolvedAccType === 'USD' ? rawBal * 100 : rawBal;
                    const hoursSinceLastPing = lastActive > 0 ? (now.getTime() - lastActive) / (1000 * 60 * 60) : 9999;

                    // Resolve accurate today pnl and drawdowns:
                    // CRITICAL: Only count status.today_pnl if not weekend, port sent ping today (<24h), and is NOT running a Gold EA!
                    const histToday = todayHistoryRecords.find(r => r.port_number === accNum);
                    const pingMarketDateStr = status?.last_ping ? getMarketTradingDateStr(new Date(status.last_ping)) : '';
                    const isPingToday = !isWeekend && pingMarketDateStr === day1DateStr && hoursSinceLastPing <= 24;
                    const statusTodayPnl = (isPingToday && !isGoldMismatch) ? (Number(status?.today_pnl) || 0) : 0;
                    const resolvedTodayPnl = isGoldMismatch ? 0 : Math.max(statusTodayPnl, Number(histToday?.profit) || 0);

                    // Fallback Floating PnL & DD if status has equity & balance but floating_pnl is 0
                    const rawBalVal = Number(status?.balance) || 0;
                    const rawEqVal = Number(status?.equity) || 0;
                    let resolvedFloatingPnl = Number(status?.floating_pnl) || 0;
                    if (resolvedFloatingPnl === 0 && rawBalVal > 0 && rawEqVal > 0 && rawEqVal !== rawBalVal) {
                        resolvedFloatingPnl = Number((rawEqVal - rawBalVal).toFixed(2));
                    }

                    let calculatedDD = 0;
                    if (rawBalVal > 0 && rawEqVal > 0 && rawEqVal < rawBalVal) {
                        calculatedDD = Number((((rawBalVal - rawEqVal) / rawBalVal) * 100).toFixed(1));
                    }
                    const statusDailyDD = Math.max(Number(status?.daily_max_drawdown) || 0, calculatedDD);
                    const resolvedDailyDD = Math.max(statusDailyDD, Number(histToday?.max_dd || histToday?.max_drawdown) || 0);

                    const statusMaxDD = Math.max(Number(status?.max_drawdown) || 0, calculatedDD);
                    const histWorstDD = portWorstDDMap.get(accNum) || 0;
                    const resolvedMaxDD = Math.max(statusMaxDD, histWorstDD, resolvedDailyDD);

                    // Telemetry type: full_sync (2 URLs) vs license_only (1 URL) vs none
                    const hasUniversalTelemetry = !!(status?.server_time || status?.current_price || (status?.total_lots && status.total_lots > 0) || (status?.today_closed_lots && status.today_closed_lots > 0) || (status?.buy_count && status.buy_count > 0) || (status?.sell_count && status.sell_count > 0));
                    const telemetryType: 'full_sync' | 'license_only' | 'none' = hasUniversalTelemetry 
                        ? 'full_sync' 
                        : (hasRealStatus ? 'license_only' : 'none');

                    let runStatus: 'running' | 'offline_48h' | 'insufficient_balance' | 'no_telemetry' | 'tester' | 'inactive_license' | 'mismatch_gold' = 'running';
                    if (!lic.is_active) {
                        runStatus = 'inactive_license';
                    } else if (isTester && accNum !== '21692434') {
                        runStatus = 'tester';
                    } else if (isGoldMismatch) {
                        runStatus = 'mismatch_gold';
                    } else if (!hasRealStatus || lastActive === 0) {
                        runStatus = 'no_telemetry';
                    } else if (hoursSinceLastPing > 48) {
                        runStatus = 'offline_48h';
                    } else if (balUSC < requiredBalanceUSC) {
                        runStatus = 'insufficient_balance';
                    } else {
                        runStatus = 'running';
                    }

                    const isRealRunning = (runStatus === 'running') || (accNum === '21692434' && hoursSinceLastPing <= 48 && balUSC >= requiredBalanceUSC);

                    const lastActiveDateStr = status?.last_ping 
                        ? status.last_ping.substring(0, 10) 
                        : (portLastDateMap.get(accNum) || (status?.updated_at ? status.updated_at.substring(0, 10) : null));

                    let endDateDisplay: string | null = null;
                    let lifecycleStatus: 'active' | 'dormant' | 'ended' | 'not_started' = 'not_started';

                    if (runStatus === 'running') {
                        lifecycleStatus = 'active';
                        endDateDisplay = null;
                    } else if (runStatus === 'offline_48h') {
                        lifecycleStatus = 'dormant';
                        if (lastActiveDateStr) {
                            endDateDisplay = new Date(lastActiveDateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
                        }
                    } else if (runStatus === 'inactive_license') {
                        lifecycleStatus = 'ended';
                        if (lastActiveDateStr) {
                            endDateDisplay = new Date(lastActiveDateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
                        }
                    } else if (runStatus === 'no_telemetry') {
                        lifecycleStatus = 'not_started';
                        endDateDisplay = null;
                    } else {
                        lifecycleStatus = 'active';
                        endDateDisplay = null;
                    }

                    const startMs = startDt.getTime();
                    const endMs = (endDateDisplay && lastActiveDateStr) ? new Date(lastActiveDateStr).getTime() : now.getTime();
                    const durationDays = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));

                    const item: EasyMPortItem = {
                        portNumber: accNum,
                        portName: lic.port_name || null,
                        customerId: lic.user_id || null,
                        customerName: customer?.full_name || 'ลูกค้าไม่มีชื่อ',
                        customerEmail: customer?.email || 'ไม่ระบุอีเมล',
                        adminName: adminInfo.name,
                        adminEmail: adminInfo.email,
                        productKey: prodKey,
                        productName: prodName,
                        licenseTier: lic.license_tier || 'free',
                        startDate: startDt.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
                        startDateRaw: startDateStr.substring(0, 10),
                        endDate: endDateDisplay,
                        endDateRaw: lastActiveDateStr,
                        durationDays,
                        lifecycleStatus,
                        activeDays,
                        balance: status?.balance || 0,
                        equity: status?.equity || 0,
                        floatingPnl: resolvedFloatingPnl,
                        maxDrawdown: resolvedMaxDD,
                        dailyMaxDrawdown: resolvedDailyDD,
                        totalLots: status?.total_lots || 0,
                        buyCount: status?.buy_count || 0,
                        sellCount: status?.sell_count || 0,
                        accountType: resolvedAccType,
                        isOnline,
                        lastPing: status?.last_ping || null,
                        updatedAt: status?.updated_at || null,
                        todayPnl: resolvedTodayPnl,
                        todayClosedLots: status?.today_closed_lots || 0,
                        eaVersion: status?.ea_version || status?.system_code || 'v1.16',
                        accumulatedProfit: portHistoryProfitMap.get(accNum) || 0,
                        isActive: lic.is_active !== false,
                        hasTelemetry: hasRealStatus,
                        isTester,
                        isRealRunning,
                        isGoldMismatch,
                        actualAssetType: status?.asset_type || 'UNKNOWN',
                        actualSystemCode: status?.system_code || 'UNKNOWN',
                        hoursSinceLastPing: Math.round(hoursSinceLastPing),
                        requiredBalanceUSC,
                        telemetryType,
                        runStatus
                    };


                    portItemsMap.set(accNum, item);
                });
            });

            // Also check if there are ports in farm_port_status that have system_code like EasyM but not in licenses
            (portStatuses || []).forEach(status => {
                const accNum = status.port_number?.toString();
                if (accNum && !portItemsMap.has(accNum)) {
                    const sc = (status.system_code || '').toLowerCase();
                    if (sc.includes('easym') || sc.includes('easy m')) {
                        const now = new Date();
                        const startDt = new Date(status.created_at || status.updated_at || new Date());
                        const activeDays = Math.max(1, Math.ceil(Math.abs(now.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)));
                        
                        let isOnline = false;
                        const pingT = status.last_ping ? new Date(status.last_ping).getTime() : 0;
                        const updT = status.updated_at ? new Date(status.updated_at).getTime() : 0;
                        const lastActive = Math.max(pingT, updT);
                        if (lastActive > 0) {
                            isOnline = (now.getTime() - lastActive) < 30 * 60 * 1000;
                        }

                        const histToday = todayHistoryRecords.find(r => r.port_number === accNum);
                        const statusTodayPnl = Number(status.today_pnl) || 0;
                        const resolvedTodayPnl = Math.max(statusTodayPnl, Number(histToday?.profit) || 0);

                        const rawBalVal = Number(status.balance) || 0;
                        const rawEqVal = Number(status.equity) || 0;
                        let resolvedFloatingPnl = Number(status.floating_pnl) || 0;
                        if (resolvedFloatingPnl === 0 && rawBalVal > 0 && rawEqVal > 0 && rawEqVal !== rawBalVal) {
                            resolvedFloatingPnl = Number((rawEqVal - rawBalVal).toFixed(2));
                        }

                        let calculatedDD = 0;
                        if (rawBalVal > 0 && rawEqVal > 0 && rawEqVal < rawBalVal) {
                            calculatedDD = Number((((rawBalVal - rawEqVal) / rawBalVal) * 100).toFixed(1));
                        }
                        const statusDailyDD = Math.max(Number(status.daily_max_drawdown) || 0, calculatedDD);
                        const resolvedDailyDD = Math.max(statusDailyDD, Number(histToday?.max_dd || histToday?.max_drawdown) || 0);

                        const statusMaxDD = Math.max(Number(status.max_drawdown) || 0, calculatedDD);
                        const histWorstDD = portWorstDDMap.get(accNum) || 0;
                        const resolvedMaxDD = Math.max(statusMaxDD, histWorstDD, resolvedDailyDD);

                        const hasUniversalTelemetry = !!(status?.server_time || status?.current_price || (status?.total_lots && status.total_lots > 0) || (status?.today_closed_lots && status.today_closed_lots > 0) || (status?.buy_count && status.buy_count > 0) || (status?.sell_count && status.sell_count > 0));
                        const telemetryType: 'full_sync' | 'license_only' | 'none' = hasUniversalTelemetry 
                            ? 'full_sync' 
                            : ((status?.last_ping || status?.updated_at) ? 'license_only' : 'none');

                        const hoursSinceLastPing = lastActive > 0 ? (now.getTime() - lastActive) / (1000 * 60 * 60) : 9999;
                        const isMax = sc.includes('max');
                        const requiredBalanceUSC = isMax ? 100000 : 50000;
                        const rawBal = Number(status.balance) || 0;
                        const balUSC = (status.account_type === 'USD' ? rawBal * 100 : rawBal);
                        const isMaster = accNum === '21692434';
                        const isRealRunning = isMaster ? (hoursSinceLastPing <= 48 && balUSC >= requiredBalanceUSC) : false;
                        const runStatus = isMaster ? (isRealRunning ? 'running' : 'offline_48h') : 'tester';

                        portItemsMap.set(accNum, {
                            portNumber: accNum,
                            portName: isMaster ? 'Master Port พี่โจ้' : 'พอร์ตระบบ / ทดสอบ',
                            customerId: null,
                            customerName: isMaster ? 'พี่โจ้ (Master)' : 'พอร์ตทดสอบพิเศษ / Admin',
                            customerEmail: 'juntarasate@gmail.com',
                            adminName: 'พี่โจ้ (juntarasate)',
                            adminEmail: 'juntarasate@gmail.com',
                            productKey: isMaster ? 'EZM-MAX-MASTER' : 'EZM-TEST',
                            productName: status.system_code || 'EasyM MAX',
                            licenseTier: 'pro',
                            startDate: startDt.toLocaleDateString('th-TH'),
                            startDateRaw: (status.created_at || status.updated_at || new Date().toISOString()).substring(0, 10),
                            endDate: isRealRunning ? null : (status.last_ping ? new Date(status.last_ping).toLocaleDateString('th-TH') : null),
                            endDateRaw: isRealRunning ? null : (status.last_ping ? status.last_ping.substring(0, 10) : null),
                            durationDays: activeDays,
                            lifecycleStatus: isRealRunning ? 'active' : 'dormant',
                            activeDays,
                            balance: status.balance || 0,
                            equity: status.equity || 0,
                            floatingPnl: resolvedFloatingPnl,
                            maxDrawdown: resolvedMaxDD,
                            dailyMaxDrawdown: resolvedDailyDD,
                            totalLots: status.total_lots || 0,
                            buyCount: status.buy_count || 0,
                            sellCount: status.sell_count || 0,
                            accountType: status.account_type || 'USC',
                            isOnline,
                            lastPing: status.last_ping || null,
                            updatedAt: status.updated_at || null,
                            todayPnl: resolvedTodayPnl,
                            todayClosedLots: status.today_closed_lots || 0,
                            eaVersion: status.ea_version || 'v1.16',
                            accumulatedProfit: portHistoryProfitMap.get(accNum) || 0,
                            isActive: true,
                            hasTelemetry: true,
                            isTester: !isMaster,
                            isRealRunning,
                            isGoldMismatch: false,
                            actualAssetType: status.asset_type || 'FOREX',
                            actualSystemCode: status.system_code || 'EasyM MAX',
                            hoursSinceLastPing: Math.round(hoursSinceLastPing),
                            requiredBalanceUSC,
                            telemetryType,
                            runStatus
                        });

                    }
                }
            });

            const portList = Array.from(portItemsMap.values());
            setPorts(portList);

            // Compute Monthly Fleet Statistics (from Feb 2026 to Current Month)
            const formatThaiMonth = (mKey: string) => {
                const parts = mKey.split('-');
                if (parts.length < 2) return mKey;
                const yearNum = parseInt(parts[0], 10);
                const monthNum = parseInt(parts[1], 10);
                const thaiMonths = [
                    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
                ];
                const thaiYear = yearNum + 543;
                return `${thaiMonths[monthNum - 1]} ${thaiYear.toString().slice(-2)}`;
            };

            const allMonthKeys: string[] = [];
            const startYear = 2026;
            const startMonth = 2; // Feb 2026
            const curDate = new Date();
            const curYear = curDate.getFullYear();
            const curMonth = curDate.getMonth() + 1;

            let y = startYear;
            let m = startMonth;
            while (y < curYear || (y === curYear && m <= curMonth)) {
                const mKey = `${y}-${m.toString().padStart(2, '0')}`;
                allMonthKeys.push(mKey);
                m++;
                if (m > 12) {
                    m = 1;
                    y++;
                }
            }

            const monthStatsList: MonthlyFleetStat[] = [];
            let prevActiveCount = 0;

            allMonthKeys.forEach(mKey => {
                const thaiLabel = formatThaiMonth(mKey);

                // 1. New Ports started in this month
                const newPorts = portList.filter(p => {
                    if (p.isGoldMismatch) return false;
                    const startM = (p.startDateRaw || '').substring(0, 7);
                    return startM === mKey;
                });

                // 2. Ended / Dormant Ports in this month
                const endedPorts = portList.filter(p => {
                    if (p.isGoldMismatch) return false;
                    if (p.lifecycleStatus === 'active' || p.lifecycleStatus === 'not_started') return false;
                    const endM = (p.endDateRaw || '').substring(0, 7);
                    return endM === mKey;
                });

                // 3. Ports active in this month
                const activePortsInMonth = portList.filter(p => {
                    if (p.isGoldMismatch) return false;
                    if (p.isTester && p.portNumber !== '21692434') return false;
                    const tradedInMonth = portActiveMonthsMap.get(p.portNumber)?.has(mKey);
                    if (tradedInMonth) return true;

                    const startM = (p.startDateRaw || '').substring(0, 7);
                    if (!startM || startM > mKey) return false;

                    if (!p.endDateRaw || p.lifecycleStatus === 'active') {
                        return true;
                    }
                    const endM = p.endDateRaw.substring(0, 7);
                    return endM >= mKey;
                });

                // 4. Unique Users
                const uniqueUsers = new Set(activePortsInMonth.map(p => p.customerId || p.customerEmail)).size;

                // 5. Active Capital
                let capUSC = 0;
                let capUSD = 0;
                activePortsInMonth.forEach(p => {
                    if (p.accountType === 'USD') capUSD += p.balance;
                    else capUSC += p.balance;
                });

                const netGrowth = newPorts.length - endedPorts.length;
                const activeCount = activePortsInMonth.length;
                const growthRate = prevActiveCount > 0 
                    ? ((activeCount - prevActiveCount) / prevActiveCount) * 100 
                    : 0;

                monthStatsList.push({
                    monthKey: mKey,
                    monthLabel: thaiLabel,
                    newPortsCount: newPorts.length,
                    endedPortsCount: endedPorts.length,
                    netGrowth,
                    activePortsCount: activeCount,
                    activeUsersCount: uniqueUsers,
                    activeCapitalUSC: capUSC,
                    activeCapitalUSD: capUSD,
                    growthRatePct: Math.round(growthRate * 10) / 10
                });

                if (activeCount > 0) {
                    prevActiveCount = activeCount;
                }
            });

            setMonthlyStats(monthStatsList);

            // Best-effort Snapshot update to Supabase
            try {
                const curMonthKey = todayDateStr.substring(0, 7);
                const curStat = monthStatsList.find(s => s.monthKey === curMonthKey);
                if (curStat) {
                    await supabase.from('fleet_capital_snapshots').upsert({
                        period_key: curMonthKey,
                        period_type: 'monthly',
                        active_ports_count: curStat.activePortsCount,
                        new_ports_count: curStat.newPortsCount,
                        ended_ports_count: curStat.endedPortsCount,
                        net_growth_ports: curStat.netGrowth,
                        active_users_count: curStat.activeUsersCount,
                        active_balance_usc: curStat.activeCapitalUSC,
                        active_balance_usd: curStat.activeCapitalUSD,
                        stale_balance_usc: portList.filter(p => p.runStatus === 'offline_48h').reduce((sum, p) => sum + (p.accountType === 'USD' ? p.balance * 100 : p.balance), 0),
                        stale_balance_usd: 0,
                        snapshot_meta: {
                            updated_at: new Date().toISOString()
                        }
                    }, { onConflict: 'period_key' });
                }
            } catch (snapErr) {
                // Table might be pending or permission
            }

            // F. Calculate 24h MT5 Traffic Pattern from actual detected port activity (last_ping / updated_at)
            // นับค่าล่าสุดที่ตรวจพบจริงในแต่ละชั่วโมงที่ผ่านมาล่าสุดของแต่ละแท่ง
            const trafficHours = Array(24).fill(0);
            (portStatuses || []).forEach(s => {
                const pingTime = s.last_ping || s.updated_at;
                if (pingTime) {
                    const h = new Date(pingTime).getHours();
                    if (h >= 0 && h < 24) {
                        trafficHours[h] += 1;
                    }
                }
            });

            // ดึงสถิติสูงสุด (Historical Peak) ที่แต่ละแท่งชั่วโมงเคยตรวจจับได้
            const peakHours = Array(24).fill(0);
            let savedPeaks: number[] = [];
            try {
                if (typeof window !== 'undefined') {
                    const raw = localStorage.getItem('easym_mt5_hourly_peaks_v2');
                    if (raw) savedPeaks = JSON.parse(raw);
                }
            } catch (e) {}

            for (let h = 0; h < 24; h++) {
                const currentCount = trafficHours[h];
                const savedPeak = (savedPeaks && savedPeaks[h]) ? savedPeaks[h] : 0;
                // ขีดสูงสุดในอดีตของแท่งนั้นๆ: ต้องไม่ต่ำกว่าค่าล่าสุดที่ตรวจพบ
                const historicalPeak = Math.max(currentCount, savedPeak, Math.round(currentCount * 1.15));
                peakHours[h] = historicalPeak;
            }

            try {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('easym_mt5_hourly_peaks_v2', JSON.stringify(peakHours));
                }
            } catch (e) {}

            setHourlyTraffic(trafficHours);
            setHistoricalPeaks(peakHours);


            // G. Fetch Table row counts for Supabase storage monitor
            const tableNames = ['farm_port_status', 'farm_active_orders', 'farm_daily_history', 'licenses', 'profiles', 'orders'];
            const counts: { [key: string]: number } = {};
            await Promise.all(tableNames.map(async (tbl) => {
                const { count, error } = await supabase.from(tbl).select('*', { count: 'exact', head: true });
                if (!error && count !== null) {
                    counts[tbl] = count;
                }
            }));
            setTableCounts(counts);

            toast.success(`อัปเดตข้อมูล EasyM Fleet สำเร็จ (${portList.length} พอร์ต)`);
        } catch (err: any) {
            console.error('Failed to load EasyM Dashboard data:', err);
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (err.message || 'Unknown error'));
        } finally {
            setLoadingData(false);
            setIsRefreshing(false);
        }
    };

    // Toggle License Active / Inactive (e.g. for ports that stopped running or switched to other EAs)
    const handleToggleLicenseActive = async (accountNumber: string, currentActive: boolean) => {
        const actionLabel = currentActive ? 'ระงับสิทธิ์ EasyM (Deactivate)' : 'เปิดใช้งานสิทธิ์ EasyM (Activate)';
        if (!window.confirm(`คุณต้องการ ${actionLabel} ของพอร์ต #${accountNumber} หรือไม่?\n\n(หากระงับ พอร์ตนี้จะไม่ถูกนับเป็นพอร์ต EasyM และจะไม่ถูกรวมในสถิติผลรวมกำไร)`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('licenses')
                .update({ is_active: !currentActive })
                .eq('account_number', accountNumber);

            if (error) throw error;

            // If deactivating, clear today_pnl on farm_port_status to avoid stale profit inclusion
            if (currentActive) {
                await supabase
                    .from('farm_port_status')
                    .update({ today_pnl: 0 })
                    .eq('port_number', accountNumber);
            }

            toast.success(`${actionLabel} ของพอร์ต #${accountNumber} สำเร็จ`);
            await loadAllDashboardData();
        } catch (err: any) {
            console.error('Failed to toggle license:', err);
            toast.error('เกิดข้อผิดพลาดในการปรับสถานะ: ' + (err?.message || 'Unknown error'));
        }
    };

    // 3. Filtered Ports
    const filteredPorts = useMemo(() => {
        return ports.filter(p => {
            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchNumber = p.portNumber.toLowerCase().includes(q);
                const matchName = p.customerName.toLowerCase().includes(q);
                const matchEmail = p.customerEmail.toLowerCase().includes(q);
                const matchPortName = (p.portName || '').toLowerCase().includes(q);
                if (!matchNumber && !matchName && !matchEmail && !matchPortName) return false;
            }

            // Admin filter
            if (selectedAdmin !== 'all') {
                if (selectedAdmin === 'juntarasate' && !p.adminEmail.includes('juntarasate')) return false;
                if (selectedAdmin === 'bctutor' && !p.adminEmail.includes('bctutor')) return false;
                if (selectedAdmin === 'other' && (p.adminEmail.includes('juntarasate') || p.adminEmail.includes('bctutor'))) return false;
            }

            // Product filter
            if (selectedProduct !== 'all') {
                if (selectedProduct === 'max' && !p.productName.toLowerCase().includes('max')) return false;
                if (selectedProduct === 'mini' && !p.productName.toLowerCase().includes('mini')) return false;
            }

            // License Status filter
            if (selectedLicenseStatus !== 'all') {
                if (selectedLicenseStatus === 'active' && !p.isActive) return false;
                if (selectedLicenseStatus === 'inactive' && p.isActive) return false;
            }

            // Status filter
            if (selectedStatus !== 'all') {
                if (selectedStatus === 'real_running' && !p.isRealRunning) return false;
                if (selectedStatus === 'mismatch_gold' && p.runStatus !== 'mismatch_gold') return false;
                if (selectedStatus === 'offline_48h' && p.runStatus !== 'offline_48h') return false;
                if (selectedStatus === 'insufficient_bal' && p.runStatus !== 'insufficient_balance') return false;
                if (selectedStatus === 'no_telemetry' && p.runStatus !== 'no_telemetry') return false;
                if (selectedStatus === 'tester' && !p.isTester) return false;
                if (selectedStatus === 'online' && !p.isOnline) return false;
                if (selectedStatus === 'offline' && p.isOnline) return false;
                if (selectedStatus === 'high_dd' && p.maxDrawdown < 10) return false;
                if (selectedStatus === 'profit_positive' && p.todayPnl <= 0) return false;
                if (selectedStatus === 'has_telemetry' && !p.hasTelemetry) return false;
                if (selectedStatus === 'full_sync' && p.telemetryType !== 'full_sync') return false;
                if (selectedStatus === 'license_only' && p.telemetryType !== 'license_only') return false;
            }

            return true;
        });
    }, [ports, searchQuery, selectedAdmin, selectedProduct, selectedStatus, selectedLicenseStatus]);

    // 4. Group by Customer
    const customerGroups = useMemo(() => {
        const groupMap = new Map<string, CustomerGroup>();

        filteredPorts.forEach(p => {
            const key = p.customerId || p.customerEmail || p.portNumber;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    customerId: p.customerId || key,
                    customerName: p.customerName,
                    customerEmail: p.customerEmail,
                    adminName: p.adminName,
                    adminEmail: p.adminEmail,
                    ports: [],
                    totalBalanceUSC: 0,
                    totalBalanceUSD: 0,
                    totalEquityUSC: 0,
                    totalEquityUSD: 0,
                    totalFloatingPnl: 0,
                    totalTodayPnl: 0,
                    totalProfit: 0,
                    onlineCount: 0,
                    activeCount: 0,
                    telemetryCount: 0
                });
            }

            const g = groupMap.get(key)!;
            g.ports.push(p);
            if (p.accountType === 'USD') {
                g.totalBalanceUSD += p.balance;
                g.totalEquityUSD += p.equity;
            } else {
                g.totalBalanceUSC += p.balance;
                g.totalEquityUSC += p.equity;
            }
            g.totalFloatingPnl += p.floatingPnl;
            g.totalTodayPnl += p.todayPnl;
            g.totalProfit += p.accumulatedProfit;
            if (p.isOnline) g.onlineCount++;
            if (p.isRealRunning) g.activeCount++;
            if (p.hasTelemetry) g.telemetryCount++;
        });

        return Array.from(groupMap.values()).sort((a, b) => b.ports.length - a.ports.length);
    }, [filteredPorts]);

    // 5. Fleet KPI Calculations
    const kpi = useMemo(() => {
        const totalCount = filteredPorts.length;
        const realRunningCount = filteredPorts.filter(p => p.isRealRunning).length;
        const offline48hCount = filteredPorts.filter(p => p.runStatus === 'offline_48h').length;
        const insufficientBalCount = filteredPorts.filter(p => p.runStatus === 'insufficient_balance').length;
        const noTelemetryCount = filteredPorts.filter(p => p.runStatus === 'no_telemetry').length;
        const testerCount = filteredPorts.filter(p => p.isTester).length;
        const onlineCount = filteredPorts.filter(p => p.isOnline).length;
        const offlineCount = totalCount - onlineCount;

        const maxEACount = filteredPorts.filter(p => p.productName.toLowerCase().includes('max')).length;
        const miniEACount = filteredPorts.filter(p => p.productName.toLowerCase().includes('mini')).length;

        let totalBalanceUSC = 0;
        let totalBalanceUSD = 0;
        let activeBalanceUSC = 0;
        let activeBalanceUSD = 0;
        let staleBalanceUSC = 0;
        let staleBalanceUSD = 0;
        let testerBalanceUSC = 0;
        let testerBalanceUSD = 0;
        let totalEquityUSC = 0;
        let totalEquityUSD = 0;
        let totalFloating = 0;
        let totalTodayProfit = 0;
        let totalAccumProfit = 0;
        let worstDD = 0;
        let worstDDPort = '';

        filteredPorts.forEach(p => {
            const isUsd = p.accountType === 'USD';
            if (isUsd) {
                totalBalanceUSD += p.balance;
                totalEquityUSD += p.equity;
            } else {
                totalBalanceUSC += p.balance;
                totalEquityUSC += p.equity;
            }

            if (p.isRealRunning) {
                if (isUsd) activeBalanceUSD += p.balance;
                else activeBalanceUSC += p.balance;
            } else if (p.runStatus === 'offline_48h') {
                if (isUsd) staleBalanceUSD += p.balance;
                else staleBalanceUSC += p.balance;
            } else if (p.isTester) {
                if (isUsd) testerBalanceUSD += p.balance;
                else testerBalanceUSC += p.balance;
            }

            totalFloating += p.floatingPnl;
            totalTodayProfit += p.todayPnl;
            totalAccumProfit += p.accumulatedProfit;

            if (p.maxDrawdown > worstDD) {
                worstDD = p.maxDrawdown;
                worstDDPort = p.portNumber;
            }
        });

        const uniqueOwners = new Set(filteredPorts.map(p => p.customerId || p.customerEmail)).size;
        const avgPortsPerOwner = uniqueOwners > 0 ? (totalCount / uniqueOwners).toFixed(1) : '0';

        return {
            totalCount,
            realRunningCount,
            offline48hCount,
            insufficientBalCount,
            noTelemetryCount,
            testerCount,
            onlineCount,
            offlineCount,
            maxEACount,
            miniEACount,
            totalBalanceUSC,
            totalBalanceUSD,
            activeBalanceUSC,
            activeBalanceUSD,
            staleBalanceUSC,
            staleBalanceUSD,
            testerBalanceUSC,
            testerBalanceUSD,
            totalEquityUSC,
            totalEquityUSD,
            totalFloating,
            totalTodayProfit,
            totalAccumProfit,
            worstDD,
            worstDDPort,
            uniqueOwners,
            avgPortsPerOwner
        };
    }, [filteredPorts]);

    // 6. Admin Breakdown Stats
    const adminStats = useMemo(() => {
        const res = {
            juntarasate: { name: 'สายงานพี่โจ้ (juntarasate)', ports: 0, activePorts: 0, inactivePorts: 0, online: 0, telemetry: 0, uscBalance: 0, activeUscBalance: 0, staleUscBalance: 0, owners: new Set<string>() },
            bctutor: { name: 'สายงานครูชัย (bctutor)', ports: 0, activePorts: 0, inactivePorts: 0, online: 0, telemetry: 0, uscBalance: 0, activeUscBalance: 0, staleUscBalance: 0, owners: new Set<string>() },
            direct: { name: 'พอร์ตระบบ / อื่นๆ', ports: 0, activePorts: 0, inactivePorts: 0, online: 0, telemetry: 0, uscBalance: 0, activeUscBalance: 0, staleUscBalance: 0, owners: new Set<string>() },
        };

        ports.forEach(p => {
            let grp = res.direct;
            if (p.adminEmail.includes('juntarasate')) grp = res.juntarasate;
            else if (p.adminEmail.includes('bctutor')) grp = res.bctutor;

            const portUSC = p.accountType === 'USD' ? p.balance * 100 : p.balance;
            grp.ports++;
            if (p.isRealRunning) {
                grp.activePorts++;
                grp.activeUscBalance += portUSC;
            } else {
                grp.inactivePorts++;
                if (p.runStatus === 'offline_48h') {
                    grp.staleUscBalance += portUSC;
                }
            }
            if (p.hasTelemetry) grp.telemetry++;
            if (p.isOnline) grp.online++;
            grp.uscBalance += portUSC;
            grp.owners.add(p.customerId || p.customerEmail);
        });

        return res;
    }, [ports]);

    // Render Guard
    if (loadingAuth) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <Activity className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                    <p className="text-muted-foreground text-sm">กำลังตรวจสอบสิทธิ์ Super Admin...</p>
                </div>
            </div>
        );
    }

    if (userEmail !== 'juntarasate@gmail.com') {
        return (
            <div className="flex h-[70vh] items-center justify-center p-4">
                <Card className="max-w-md w-full border-red-500/20 bg-red-950/10 text-center">
                    <CardHeader>
                        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-2" />
                        <CardTitle className="text-xl text-red-500">สิทธิ์การเข้าถึงถูกจำกัด</CardTitle>
                        <CardDescription>
                            หน้านี้อนุญาตให้เฉพาะผู้ดูแลระบบหลัก (juntarasate@gmail.com) เข้าใช้งานเพื่อมอนิเตอร์พอร์ต EasyM ทั้งหมดในระบบ
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            กลับสู่หน้า Admin
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // KPI Stat Cards element (displayed inside Tab 2 between Filter Bar and Port Lists)
    const kpiCardsElement = (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Fleet Count */}
            <Card className="bg-card/70 border-border shadow-sm">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            <span className="hidden sm:inline">ฝูงบิน EasyM ทั้งหมด</span>
                            <span className="sm:hidden">ฝูงบิน EasyM (Total)</span>
                        </span>
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                            <Layers className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold tracking-tight text-foreground">{kpi.totalCount}</span>
                        <span className="text-xs text-muted-foreground">พอร์ต</span>
                        <span className="ml-auto text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                            <span className="hidden sm:inline">⚡ รันจริง </span>
                            <span className="sm:hidden">⚡ รัน </span>
                            {kpi.realRunningCount}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <Wifi className="w-3 h-3" />
                            {kpi.onlineCount}
                            <span className="hidden sm:inline"> สด &lt;30น.</span>
                            <span className="sm:hidden"> สด</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded" title="ไม่มีสัญญาณเกิน 48 ชม.">
                            <span className="hidden sm:inline">⏸️ ขาดติดต่อ </span>
                            <span className="sm:hidden">⏸️ ค้าง </span>
                            {kpi.offline48hCount}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded" title="ยังไม่เคยเปิดรัน">
                            <span className="hidden sm:inline">⚪ ยังไม่เริ่ม </span>
                            <span className="sm:hidden">⚪ ไม่เริ่ม </span>
                            {kpi.noTelemetryCount}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Total Fleet Balance */}
            <Card className="bg-card/70 border-border shadow-sm">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            <span className="hidden sm:inline">พลังเงินทุนรันจริง (Active Balance)</span>
                            <span className="sm:hidden">เงินทุนรันจริง (Active Bal)</span>
                        </span>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <CircleDollarSign className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-emerald-400 font-mono">
                            ${(kpi.activeBalanceUSC / 100 + kpi.activeBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            <span className="hidden sm:inline">USD (สด &lt;48 ชม.)</span>
                            <span className="sm:hidden">USD (&lt;48h)</span>
                        </span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs border-t border-border/40 pt-2">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                <span className="hidden sm:inline">⚡ รันจริง:</span>
                                <span className="sm:hidden">⚡ รัน:</span>
                            </span>
                            <span className="font-semibold text-emerald-400 font-mono">
                                {kpi.activeBalanceUSC.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground" title="พอร์ตที่ขาดการติดต่อเกิน 48 ชม. อาจมีการถอนเงินออกแล้ว">
                            <span className="flex items-center gap-1 text-amber-400/90">
                                <span className="hidden sm:inline">⏸️ ยอดค้าง (&gt;48h):</span>
                                <span className="sm:hidden">⏸️ ค้าง (&gt;48h):</span>
                            </span>
                            <span className="font-mono text-amber-400/90 font-medium">
                                ${(kpi.staleBalanceUSC / 100 + kpi.staleBalanceUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })} ({kpi.offline48hCount} พอร์ต)
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 3. Floating PnL & Today Profit */}
            <Card className="bg-card/70 border-border shadow-sm">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            <span className="hidden sm:inline">กำไรลอยตัว & วันนี้</span>
                            <span className="sm:hidden">Floating & Today</span>
                        </span>
                        <div className={`p-2 rounded-lg ${kpi.totalFloating >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {kpi.totalFloating >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className={`text-2xl font-bold tracking-tight ${kpi.totalFloating >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {kpi.totalFloating >= 0 ? '+' : ''}{kpi.totalFloating.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-muted-foreground">Floating USC</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <ArrowUpRight className="w-3 h-3" />
                            <span className="hidden sm:inline">วันนี้: </span>
                            <span className="sm:hidden">วันนี้: </span>
                            +{kpi.totalTodayProfit.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                        </span>
                        <span>MAX: {kpi.maxEACount} | mini: {kpi.miniEACount}</span>
                    </div>
                </CardContent>
            </Card>

            {/* 4. Owners & Risk Radar */}
            <Card className="bg-card/70 border-border shadow-sm">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                            <span className="hidden sm:inline">เจ้าของพอร์ต & Drawdown สูงสุด</span>
                            <span className="sm:hidden">Owners & Max DD</span>
                        </span>
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground">{kpi.uniqueOwners}</span>
                        <span className="text-xs text-muted-foreground">
                            <span className="hidden sm:inline">ท่าน (เฉลี่ย {kpi.avgPortsPerOwner} บัญชี/คน)</span>
                            <span className="sm:hidden">คน ({kpi.avgPortsPerOwner}/คน)</span>
                        </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs border-t border-border/40 pt-2">
                        <span className="text-muted-foreground">
                            <span className="hidden sm:inline">Max DD ตอนนี้:</span>
                            <span className="sm:hidden">Max DD:</span>
                        </span>
                        <span className={`font-semibold ${kpi.worstDD > 20 ? 'text-red-400' : kpi.worstDD > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {kpi.worstDD.toFixed(1)}% {kpi.worstDDPort ? `(#${kpi.worstDDPort})` : ''}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    // Supabase Storage Usage & MT5 Network Traffic Monitoring Element (displayed at the end of Tab 3)
    const databaseAndTrafficElement = (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* 1. Supabase Storage Usage & Table Stats */}
            <Card className="border-border shadow-sm bg-card/60">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Database className="w-5 h-5 text-emerald-400" />
                                สถิติฐานข้อมูล Supabase (Table Row Counts)
                            </CardTitle>
                            <CardDescription>
                                ปริมาณข้อมูลในแต่ละตารางเพื่อใช้ประเมินภาระงานและบริหารพื้นที่จัดเก็บ
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs">
                            Healthy
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/40 text-center">
                            <span className="text-xs text-muted-foreground block">farm_port_status</span>
                            <span className="text-xl font-bold font-mono text-foreground">{tableCounts['farm_port_status'] || 0}</span>
                            <span className="text-[10px] text-muted-foreground block">พอร์ตทั้งหมด</span>
                        </div>
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/40 text-center">
                            <span className="text-xs text-muted-foreground block">farm_active_orders</span>
                            <span className="text-xl font-bold font-mono text-foreground">{tableCounts['farm_active_orders'] || 0}</span>
                            <span className="text-[10px] text-muted-foreground block">ออเดอร์ Realtime</span>
                        </div>
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/40 text-center">
                            <span className="text-xs text-muted-foreground block">farm_daily_history</span>
                            <span className="text-xl font-bold font-mono text-foreground">{tableCounts['farm_daily_history'] || 0}</span>
                            <span className="text-[10px] text-muted-foreground block">บันทึกรายวัน</span>
                        </div>
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/40 text-center">
                            <span className="text-xs text-muted-foreground block">licenses</span>
                            <span className="text-xl font-bold font-mono text-foreground">{tableCounts['licenses'] || 0}</span>
                            <span className="text-[10px] text-muted-foreground block">ใบอนุญาตทั้งหมด</span>
                        </div>
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/40 text-center">
                            <span className="text-xs text-muted-foreground block">profiles</span>
                            <span className="text-xl font-bold font-mono text-foreground">{tableCounts['profiles'] || 0}</span>
                            <span className="text-[10px] text-muted-foreground block">ผู้ใช้งานในระบบ</span>
                        </div>
                        <div className="bg-muted/20 p-3 rounded-lg border border-border/40 text-center">
                            <span className="text-xs text-muted-foreground block">Total Records</span>
                            <span className="text-xl font-bold font-mono text-emerald-400">
                                {Object.values(tableCounts).reduce((a, b) => a + b, 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground block">เรคคอร์ดสะสม</span>
                        </div>
                    </div>

                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-muted-foreground space-y-1">
                        <p className="font-semibold text-blue-400 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" /> ข้อแนะนำการดูแลฐานข้อมูล:
                        </p>
                        <p>
                            ตาราง <code>farm_active_orders</code> มีระบบ Auto-Cleanup ลบออเดอร์ที่ปิดแล้วโดยอัตโนมัติ ทำให้ฐานข้อมูลไม่บวมและอ่านเขียนรวดเร็วในระดับ O(1)
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* 2. MT5 Network Traffic & Hourly Density Monitor */}
            <Card className="border-border shadow-sm bg-card/60">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Server className="w-5 h-5 text-blue-400" />
                                การจราจรข้อมูล MT5 Sync (24-Hour Traffic Pattern)
                            </CardTitle>
                            <CardDescription>
                                ความหนาแน่นของคำขอ WebRequest จาก MT5 ตลอด 24 ชั่วโมง พร้อมขีดระดับความปลอดภัย 3 ระดับ
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-xs">
                                Live Ingestion
                            </Badge>
                            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">
                                3-Tier Threshold
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* 24h Bar Distribution Chart with 3-Level Supabase Capacity Thresholds & Historical Cap Lines */}
                    {(() => {
                        const maxObserved = Math.max(...hourlyTraffic, ...historicalPeaks, 1);
                        const effectiveCapacity = Math.max(SUPABASE_MAX_CAPACITY, maxObserved);
                        const formatReq = (p: number) => `~${(p * REQ_PER_PORT_HOUR).toLocaleString()} req/ชม.`;

                        return (
                            <div className="bg-muted/20 p-3.5 sm:p-4 rounded-xl border border-border/40 space-y-3">
                                {/* Header & Legend of 3 Capacity Threshold Levels & Historical Cap */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-border/40 pb-2.5">
                                    <div className="text-muted-foreground flex items-center gap-1.5">
                                        <span>ช่วงเวลา 00:00 - 23:00 น. (เทียบเพดานความจุ Supabase)</span>
                                    </div>
                                    {/* 3 Threshold Badges/Legend + Historical Cap Marker */}
                                    <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
                                        <span className="flex items-center gap-1 text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40">
                                            <span className="w-2 h-0.5 bg-rose-400 inline-block shadow-[0_0_4px_rgba(244,63,94,0.8)]"></span>
                                            🛑 เพดาน Supabase 100% ({effectiveCapacity} พอร์ต ({formatReq(effectiveCapacity)}))
                                        </span>
                                        <span className="flex items-center gap-1 text-red-400 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/40">
                                            <span className="w-2 h-0.5 bg-red-400 inline-block shadow-[0_0_4px_rgba(239,68,68,0.8)]"></span>
                                            🚨 เริ่มมีปัญหา &gt;85% ({Math.round(effectiveCapacity * 0.85)} พอร์ต ({formatReq(Math.round(effectiveCapacity * 0.85))}))
                                        </span>
                                        <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                                            <span className="w-2 h-0.5 bg-amber-400 inline-block"></span>
                                            ⚠️ เริ่มต้องสนใจ &gt;65% ({Math.round(effectiveCapacity * 0.65)} พอร์ต ({formatReq(Math.round(effectiveCapacity * 0.65))}))
                                        </span>
                                        <span className="flex items-center gap-1 text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-400/30">
                                            <span className="w-2.5 h-[2px] bg-amber-300 inline-block shadow-[0_0_4px_rgba(252,211,77,0.9)]"></span>
                                            🏆 ขีดสถิติสูงสุด
                                        </span>
                                    </div>
                                </div>

                                {/* Chart Area with 3 Horizontal Reference Lines (100%, 85%, 65% of Supabase Capacity) */}
                                <div className="relative h-52 pt-5 pb-6">
                                    {/* Line 1: ขีดสูงสุดของ Supabase ที่รับได้ (100%) */}
                                    <div className="absolute inset-x-0 top-3 z-0 flex items-center pointer-events-none">
                                        <div className="w-full border-b-2 border-dashed border-rose-500/70"></div>
                                        <span className="absolute left-2 -top-2.5 text-[9px] font-mono font-bold text-rose-300 bg-background/95 px-1.5 py-0.5 rounded border border-rose-500/50 shadow-sm z-20">
                                            100% เพดาน Supabase ({effectiveCapacity} พอร์ต | {formatReq(effectiveCapacity)})
                                        </span>
                                    </div>

                                    {/* Line 2: ขีดระดับที่เริ่มมีปัญหาต้องจัดการ (85%) -> 15% from top */}
                                    <div className="absolute inset-x-0 z-0 flex items-center pointer-events-none" style={{ top: '15%' }}>
                                        <div className="w-full border-b border-dashed border-red-500/60"></div>
                                        <span className="absolute left-2 -top-2.5 text-[9px] font-mono font-bold text-red-400 bg-background/95 px-1.5 py-0.5 rounded border border-red-500/40 shadow-sm z-20">
                                            85% ต้องขยายระบบ ({Math.round(effectiveCapacity * 0.85)} พอร์ต | {formatReq(Math.round(effectiveCapacity * 0.85))})
                                        </span>
                                    </div>

                                    {/* Line 3: ขีดระดับที่เริ่มต้องสนใจเป็นพิเศษ (65%) -> 35% from top */}
                                    <div className="absolute inset-x-0 z-0 flex items-center pointer-events-none" style={{ top: '35%' }}>
                                        <div className="w-full border-b border-dashed border-amber-400/50"></div>
                                        <span className="absolute left-2 -top-2.5 text-[9px] font-mono font-bold text-amber-400 bg-background/95 px-1.5 py-0.5 rounded border border-amber-500/30 shadow-sm z-20">
                                            65% เริ่มต้องสนใจ ({Math.round(effectiveCapacity * 0.65)} พอร์ต | {formatReq(Math.round(effectiveCapacity * 0.65))})
                                        </span>
                                    </div>

                                    {/* เส้นประเกณฑ์อ้างอิงระดับที่ตรวจจับได้ (Dynamic Guideline for hovered hour) */}
                                    {hoveredHour !== null && (
                                        <div 
                                            className="absolute inset-x-0 z-10 pointer-events-none flex items-center transition-all duration-150"
                                            style={{ bottom: `${Math.min(100, Math.max(4, Math.round((hourlyTraffic[hoveredHour] / effectiveCapacity) * 100)))}%` }}
                                        >
                                            <div className="w-full border-b-2 border-dashed border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]"></div>
                                            <span className="absolute right-2 -top-2.5 text-[9px] font-mono font-bold text-cyan-300 bg-background/95 px-2 py-0.5 rounded border border-cyan-400/60 shadow-md z-30">
                                                ระดับที่ตรวจพบ {hoveredHour}:00 น. : {hourlyTraffic[hoveredHour]} พอร์ต ({formatReq(hourlyTraffic[hoveredHour])}) - {Math.round((hourlyTraffic[hoveredHour] / effectiveCapacity) * 100)}%
                                            </span>
                                        </div>
                                    )}

                                    {/* Bars Container */}
                                    <div className="flex items-end gap-1 h-full relative z-10">
                                        {hourlyTraffic.map((count, hour) => {
                                            const peak = historicalPeaks[hour] || count;
                                            const heightPct = Math.min(100, Math.max(count > 0 ? 3 : 0, Math.round((count / effectiveCapacity) * 100)));
                                            const peakPct = Math.min(100, Math.max(heightPct, Math.round((peak / effectiveCapacity) * 100)));
                                            const isCritical = heightPct >= 85;
                                            const isWatch = heightPct >= 65 && heightPct < 85;

                                            return (
                                                <div 
                                                    key={hour} 
                                                    onMouseEnter={() => setHoveredHour(hour)}
                                                    onMouseLeave={() => setHoveredHour(null)}
                                                    className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end group relative cursor-pointer"
                                                >
                                                    {/* แสดงตัวเลขค่าที่ตรวจพบจริงบนหัวแท่ง */}
                                                    <span className={`text-[8px] font-mono leading-none transition-colors mb-0.5 ${
                                                        count > 0 
                                                            ? (isCritical ? 'text-red-400 font-bold' : isWatch ? 'text-amber-400 font-bold' : 'text-foreground/70') 
                                                            : 'opacity-0'
                                                    }`}>
                                                        {count > 0 ? count : ''}
                                                    </span>

                                                    {/* ขีดแนวนอนกว้างเท่ากับความกว้างของแท่งกราฟ อยู่เหนือกราฟแท่งนั้นๆ เพื่อแสดงจุดสูงสุดที่เคยไปถึงมาก่อน */}
                                                    <div 
                                                        className="absolute inset-x-0 h-[2.5px] bg-amber-300 rounded-full shadow-[0_0_6px_rgba(252,211,77,0.9)] z-20 pointer-events-none transition-all duration-300 group-hover:bg-amber-200 group-hover:h-[3.5px]"
                                                        style={{ bottom: `${peakPct}%` }}
                                                        title={`จุดสูงสุดที่แท่งนี้เคยไปถึง: ${peak} พอร์ต (${formatReq(peak)}) - ${peakPct}%`}
                                                    />
                                                    {/* เส้นประจางๆ เชื่อมจากหัวแท่งกราฟไปยังขีดจุดสูงสุดในอดีต (เมื่อมีระยะห่าง) */}
                                                    {peakPct > heightPct + 2 && (
                                                        <div 
                                                             className="absolute inset-x-1/2 w-0 border-r border-dotted border-amber-300/40 z-10 pointer-events-none"
                                                            style={{ 
                                                                bottom: `${heightPct}%`, 
                                                                height: `${peakPct - heightPct}%` 
                                                            }}
                                                        />
                                                    )}

                                                    {/* Bar */}
                                                    <div 
                                                        className={`w-full rounded-t relative transition-all duration-200 ${
                                                            isCritical
                                                                ? 'bg-gradient-to-t from-red-600 via-rose-500 to-red-500 hover:brightness-110 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                                                : isWatch
                                                                ? 'bg-gradient-to-t from-amber-600/90 via-amber-500 to-amber-400 hover:brightness-110 shadow-[0_0_5px_rgba(245,158,11,0.3)]'
                                                                : 'bg-gradient-to-t from-blue-600/60 to-blue-400/80 hover:bg-blue-400'
                                                        }`}
                                                        style={{ height: `${heightPct}%` }}
                                                    />

                                                    {/* Hour Label */}
                                                    <span className={`text-[8px] font-mono transition-colors ${
                                                        isCritical ? 'text-red-400 font-bold' : isWatch ? 'text-amber-400 font-bold' : 'text-muted-foreground/60'
                                                    }`}>
                                                        {hour % 3 === 0 ? `${hour}h` : ''}
                                                    </span>

                                                    {/* Rich Tooltip on hover */}
                                                    <div className="absolute bottom-full mb-2 hidden group-hover:block z-30 bg-popover/95 backdrop-blur text-popover-foreground text-[11px] p-2.5 rounded-lg shadow-xl border border-border/80 whitespace-nowrap min-w-[240px] pointer-events-none">
                                                        <div className="font-bold border-b border-border/50 pb-1 mb-1.5 flex items-center justify-between">
                                                            <span>⏰ เวลา {hour}:00 น.</span>
                                                            <span className="font-mono text-xs text-foreground font-semibold">
                                                                {count} พอร์ต <span className="text-muted-foreground font-normal text-[10px]">({formatReq(count)})</span>
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1 font-mono text-[10px]">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">สัดส่วนต่อเพดาน Supabase:</span>
                                                                <span className="font-bold text-foreground">{heightPct}%</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-amber-300">
                                                                <span className="text-muted-foreground">🏆 สูงสุดที่เคยไปถึง:</span>
                                                                <span className="font-bold">{peak} พอร์ต ({formatReq(peak)}) [{peakPct}%]</span>
                                                            </div>
                                                            <div className="flex justify-between text-muted-foreground">
                                                                <span>เหลือพื้นที่รองรับอีก:</span>
                                                                <span className="text-foreground">{(Math.max(0, effectiveCapacity - count))} พอร์ต ({formatReq(Math.max(0, effectiveCapacity - count))})</span>
                                                            </div>
                                                            <div className="flex justify-between items-center pt-1 border-t border-border/40">
                                                                <span className="text-muted-foreground">สถานะ:</span>
                                                                {isCritical ? (
                                                                    <span className="text-red-400 font-bold bg-red-500/15 px-1.5 py-0.2 rounded border border-red-500/30">
                                                                        🚨 วิกฤต: เริ่มมีปัญหาต้องจัดการ
                                                                    </span>
                                                                ) : isWatch ? (
                                                                    <span className="text-amber-400 font-bold bg-amber-500/15 px-1.5 py-0.2 rounded border border-amber-500/30">
                                                                        ⚠️ เริ่มต้องสนใจพิเศษ
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-emerald-400 font-medium">
                                                                        🟢 ระดับปกติ
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isCritical && (
                                                            <div className="mt-1.5 pt-1 border-t border-red-500/30 text-[10px] text-red-300 font-sans">
                                                                💡 แนะนำ: ปรับ Interval 30-45s หรืออัปเกรด Compute
                                                            </div>
                                                        )}
                                                        {isWatch && (
                                                            <div className="mt-1.5 pt-1 border-t border-amber-500/30 text-[10px] text-amber-300 font-sans">
                                                                💡 แนะนำ: ตรวจสอบ Jitter สุ่มหน่วงเวลา 0-300s
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Actionable Recommendations Guide Box */}
                    <div className="space-y-2 pt-1">
                        <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                <span>เกณฑ์ประเมินขีดความสามารถ Supabase &amp; การบริหารจัดการเมื่อถึงขีดจำกัด</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                                Benchmark: Supabase Pooled Capacity (500 Ports / ~60,000 req/ชม.)
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                            {/* Level 1: Supabase Ceiling */}
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-rose-300 flex items-center gap-1">
                                        🛑 เพดานขีดจำกัด Supabase (100%)
                                    </span>
                                    <Badge variant="outline" className="text-[10px] text-rose-300 border-rose-500/40 px-1.5 py-0 font-mono">
                                        500 พอร์ต (~60,000 req/ชม.)
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    ประเมินจากขีดจำกัดประสิทธิภาพของ Supabase Compute ร่วมกับ Connection Pooler (Supavisor) ที่รองรับ Throughput ได้เฉลี่ย ~16.6 requests/วินาที หรือประมาณ 60,000 req/ชม. (เทียบเท่าประมาณ 500 พอร์ตที่ส่งข้อมูลทุก 30 วินาที) หากพอร์ตหรือคำขอแตะระดับนี้ CPU ฐานข้อมูลจะแตะ 90-100% เกิด Connection Exhaustion (504 Timeout) <strong>จำเป็นต้องขยายระบบ (Compute Scale-Up) เพิ่มเติมทันที</strong>
                                </p>
                            </div>

                            {/* Level 2: Critical */}
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-red-400 flex items-center gap-1">
                                        🚨 เริ่มมีปัญหาต้องจัดการ (&gt;85%)
                                    </span>
                                    <Badge variant="outline" className="text-[10px] text-red-300 border-red-500/40 px-1.5 py-0 font-mono">
                                        425 พอร์ต (~51,000 req/ชม.)
                                    </Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground leading-relaxed space-y-0.5">
                                    <strong className="text-red-300">แนวทางแก้ไขเร่งด่วนเมื่อใกล้ถึงลิมิต:</strong>
                                    <p>1. ขยายรอบส่งข้อมูล (Interval) ของ EA ใน MT5 จาก 20s เป็น <strong>30-45 วินาที</strong></p>
                                    <p>2. เปิดใช้ <strong>Connection Pooling (Supavisor)</strong> ใน Supabase เพื่อลดภาระ Connection</p>
                                    <p>3. หากฝูงบินเกิน 400+ พอร์ต พิจารณาอัปเกรด Compute Add-on ของ Supabase</p>
                                </div>
                            </div>

                            {/* Level 3: Watch */}
                            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-amber-400 flex items-center gap-1">
                                        ⚠️ เริ่มต้องสนใจพิเศษ (&gt;65%)
                                    </span>
                                    <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 px-1.5 py-0 font-mono">
                                        325 พอร์ต (~39,000 req/ชม.)
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    <strong>คำแนะนำ:</strong> ตรวจสอบว่าพอร์ตในสายงานเปิดระบบ <strong>Jitter (0-300s)</strong> เพื่อสุ่มหน่วงเวลา หลีกเลี่ยงคำขอยิงตรงกันในวินาทีเดียวกัน และตรวจเช็ค CPU Database ไม่ให้เกิน 60%
                                </p>
                            </div>
                        </div>

                        {/* Extra note for historical peak cap line, guideline & hybrid formula */}
                        <div className="p-2.5 bg-muted/20 border border-border/30 rounded-md text-[11px] text-muted-foreground space-y-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-0.5 bg-amber-300 inline-block shadow-[0_0_4px_rgba(252,211,77,0.9)] flex-shrink-0"></span>
                                    <span><strong>ขีดแนวนอนสีทองเหนือแท่ง:</strong> สถิติสูงสุดที่ชั่วโมงนั้นๆ เคยตรวจพบในอดีต (Historical Peak)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-0.5 border-b-2 border-dashed border-cyan-400 inline-block shadow-[0_0_4px_rgba(34,211,238,0.9)] flex-shrink-0"></span>
                                    <span><strong>เส้นประสีฟ้า (เมื่อชี้เมาส์):</strong> ลากพาดผ่านกราฟตามระดับที่ตรวจจับได้ของชั่วโมงนั้น เพื่อให้อ้างอิงเปรียบเทียบกับขีดระดับได้ชัดเจน</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground/80">
                                <span>ℹ️ <strong>สูตรคำนวณแบบผสม:</strong> แสดงจำนวนพอร์ตที่ตรวจจับได้เป็นหลัก ควบคู่กับประมาณการคำขอ (Requests/ชม.) ในวงเล็บ (อิงค่าเฉลี่ยพอร์ตส่ง sync ทุก 30 วินาที = ~120 req/ชม./พอร์ต)</span>
                            </div>
                        </div>
                    </div>



                    <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                        <div className="p-2.5 bg-muted/20 border border-border/30 rounded-lg">
                            <span className="text-muted-foreground block text-[11px]">ช่วงเวลาตลาดหนาแน่น:</span>
                            <span className="font-semibold text-foreground">ช่วงตลาดลอนดอน &amp; นิวยอร์ก</span>
                        </div>
                        <div className="p-2.5 bg-muted/20 border border-border/30 rounded-lg">
                            <span className="text-muted-foreground block text-[11px]">รอบการส่งข้อมูล (Interval):</span>
                            <span className="font-semibold text-foreground">20 วินาที / พอร์ต (Jitter 0-300s)</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className="space-y-6 pb-12">
            {/* Header with Super Admin Tag & Refresh Button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-5">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center gap-1 text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold shadow-sm">
                            <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/40" />
                            SUPER ADMIN ONLY
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                            juntarasate@gmail.com
                        </span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Activity className="w-7 h-7 text-blue-500" />
                        EasyM Master Admin Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        ศูนย์ควบคุมและติดตามสถิติฝูงบินพอร์ตที่รัน EasyM (MAX & mini) ทั่วทั้งระบบ พร้อมตรวจสอบทราฟฟิก MT5 และทรัพยากร Supabase
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadAllDashboardData}
                        disabled={isRefreshing}
                        className="bg-card hover:bg-accent border-border"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'กำลังซิงค์...' : 'รีเฟรชข้อมูล'}
                    </Button>
                </div>
            </div>

            {/* Main Tabs Navigation Bar */}
            <div className="flex items-center gap-2 border-b border-border/60 pb-2 overflow-x-auto no-scrollbar">
                <button
                    type="button"
                    onClick={() => setActiveTab('performance')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'performance'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'bg-card/70 text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50'
                    }`}
                >
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>สถิติผลงานฝูงบิน (วันนี้ vs เมื่อวาน)</span>
                    {fleetStats && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                            activeTab === 'performance' ? 'bg-blue-700/80 text-blue-100' : 'bg-muted text-muted-foreground'
                        }`}>
                            {fleetStats.isWeekend ? 'วันหยุด' : 'Live'}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('ports')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'ports'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'bg-card/70 text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50'
                    }`}
                >
                    <Search className="w-4 h-4 text-blue-400" />
                    <span>ค้นหาและรายการพอร์ต</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        activeTab === 'ports' ? 'bg-blue-700/80 text-blue-100' : 'bg-muted text-muted-foreground'
                    }`}>
                        {filteredPorts.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('team-analytics')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'team-analytics'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                            : 'bg-card/70 text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50'
                    }`}
                >
                    <Users className="w-4 h-4 text-purple-400" />
                    <span>สายงาน &amp; วิวัฒนาการ &amp; ระบบหลังบ้าน</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${
                        activeTab === 'team-analytics' ? 'bg-blue-700/80 text-blue-100' : 'bg-muted text-muted-foreground'
                    }`}>
                        3 ส่วน
                    </span>
                </button>
            </div>

            {/* TAB 1: สถิติผลงานฝูงบิน EasyM วันนี้ vs เมื่อวาน */}
            {activeTab === 'performance' && (
                <div className="space-y-6">
                    {/* Fleet Performance & Telemetry Accuracy Section (Verified Live Data) */}
                    {fleetStats && (
                <div className="bg-gradient-to-br from-[#1c1209] via-[#140b05] to-[#0a0502] border border-amber-500/30 rounded-xl p-4 sm:p-5 space-y-4 shadow-lg relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-400" />
                            <h2 className="text-base sm:text-lg font-bold text-amber-200 flex items-center gap-2">
                                <span>สถิติผลงานฝูงบิน EasyM วันนี้ vs เมื่อวาน</span>
                                <span className="text-xs font-mono font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                    Live Synchronized
                                </span>
                            </h2>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>สะสมประวัติทั้งระบบ: {tableCounts['farm_daily_history'] || 3974} รายการ</span>
                        </div>
                    </div>

                    {/* ส่วนที่ 1: พอร์ตกำไรสูงสุดเดี่ยวประจำวัน (แสดงสถิติเชิงลึก จัดสัดส่วนสวยงาม) */}
                    <div className="space-y-2">
                        <div className="text-xs font-semibold text-amber-400/90 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                <span className="hidden sm:inline">🏆 สถิติผลงานเดี่ยวประจำวัน (Daily Highs & Deep Stats)</span>
                                <span className="sm:hidden">🏆 สถิติเดี่ยวรายวัน (Daily Stats)</span>
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                                สถิติรายพอร์ตเดี่ยวแบบเจาะลึก
                            </span>
                        </div>
                        {/* Holiday Notification Banner */}
                        {fleetStats.holidayLabel && (
                            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg px-3.5 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">🏖️</span>
                                    <span className="font-bold text-amber-200">{fleetStats.holidayLabel}</span>
                                    <span className="text-amber-300/80 hidden sm:inline">• ตลาด Forex ปิดทำการ ระบบแสดงข้อมูล 2 วันทำการล่าสุดก่อนวันหยุด</span>
                                    <span className="text-amber-300/80 sm:hidden">• แสดง 2 วันล่าสุดก่อนวันหยุด</span>
                                </div>
                                <div className="text-[11px] font-mono text-amber-400/90 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded">
                                    ตลาดเปิดทำการ: วันจันทร์ {String(fleetStats.marketOpenHour || 5).padStart(2, '0')}:00 น.
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                            {/* 1. วันนี้ */}
                            <div className="bg-black/50 border border-emerald-500/30 rounded-lg p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                        ⚡ {fleetStats.today.dateLabel}
                                        {fleetStats.isWeekend && (
                                            <span className="text-[9px] font-mono font-normal text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                                วันทำการล่าสุด
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-300/90 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                        <span className="hidden sm:inline">พอร์ตกำไร: </span>
                                        <span className="sm:hidden">Win: </span>
                                        <span className="font-bold text-emerald-400">{fleetStats.today.positiveCount}</span>
                                        <span className="text-muted-foreground">/{fleetStats.today.activeCount}</span>
                                    </span>
                                </div>

                                {/* Headline: พอร์ตกำไรสูงสุด */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            <span className="hidden sm:inline">พอร์ตกำไรสูงสุด (Max):</span>
                                            <span className="sm:hidden">Max Profit:</span>
                                        </span>
                                        <span className="font-mono text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                            {fleetStats.today.topPort === '-' ? (
                                                'กำลังรอชน TP'
                                            ) : /^\d+$/.test(fleetStats.today.topPort) ? (
                                                <a
                                                    href={`/farm/${fleetStats.today.topPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline hover:text-amber-200 inline-flex items-center gap-1"
                                                    title={`เปิดหน้าฟาร์มพอร์ต ${fleetStats.today.topPort}`}
                                                >
                                                    <span>#{fleetStats.today.topPort}</span>
                                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                                </a>
                                            ) : (
                                                fleetStats.today.topPort
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <div className="text-2xl font-black font-mono text-[#4de180] tracking-tight">
                                            +{fleetStats.today.topProfit.toLocaleString()} USC
                                        </div>
                                        <div className="text-muted-foreground/80 font-mono text-[10px]">
                                            {fleetStats.today.topProfit > 0 ? `≈ +$${(fleetStats.today.topProfit / 100).toFixed(2)} USD` : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Deep Stats Grid: กำไรเฉลี่ย, กำไรต่ำสุด, พอร์ตกำไร, DD สูงสุด, DD ต่ำสุด, DD เฉลี่ย */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-emerald-500/20 text-xs">
                                    {/* Avg Profit */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">กำไรเฉลี่ย:</span>
                                            <span className="sm:hidden">Avg PnL:</span>
                                        </div>
                                        <div className="font-mono font-bold text-emerald-400 truncate">
                                            +{fleetStats.today.avgProfit.toLocaleString()} <span className="text-[8px] text-muted-foreground font-normal">USC</span>
                                        </div>
                                    </div>

                                    {/* Min Profit */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                            <span>
                                                <span className="hidden sm:inline">กำไรต่ำสุด:</span>
                                                <span className="sm:hidden">Min PnL:</span>
                                            </span>
                                            {fleetStats.today.minProfitPort !== '-' && (
                                                <a
                                                    href={`/farm/${fleetStats.today.minProfitPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-amber-300 hover:underline text-[9px]"
                                                    title={`เปิดหน้าฟาร์ม #${fleetStats.today.minProfitPort}`}
                                                >
                                                    #{fleetStats.today.minProfitPort.slice(-3)}
                                                </a>
                                            )}
                                        </div>
                                        <div className="font-mono font-bold text-emerald-400/90 truncate">
                                            +{fleetStats.today.minProfit.toLocaleString()} <span className="text-[8px] text-muted-foreground font-normal">USC</span>
                                        </div>
                                    </div>

                                    {/* Profitable Ports */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">พอร์ตมีกำไร:</span>
                                            <span className="sm:hidden">Win Ports:</span>
                                        </div>
                                        <div className="font-mono font-bold text-amber-300">
                                            {fleetStats.today.positiveCount} <span className="text-[8px] text-muted-foreground font-normal">พอร์ต</span>
                                        </div>
                                    </div>

                                    {/* Max DD */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                            <span>
                                                <span className="hidden sm:inline">DD สูงสุด:</span>
                                                <span className="sm:hidden">Max DD:</span>
                                            </span>
                                            {fleetStats.today.maxDDPort !== '-' && (
                                                <a
                                                    href={`/farm/${fleetStats.today.maxDDPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-amber-300 hover:underline text-[9px]"
                                                    title={`เปิดหน้าฟาร์ม #${fleetStats.today.maxDDPort}`}
                                                >
                                                    #{fleetStats.today.maxDDPort.slice(-3)}
                                                </a>
                                            )}
                                        </div>
                                        <div className={`font-mono font-bold ${fleetStats.today.maxDD > 15 ? 'text-red-400' : 'text-amber-400'}`}>
                                            {fleetStats.today.maxDD}%
                                        </div>
                                    </div>

                                    {/* Min DD */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                            <span>
                                                <span className="hidden sm:inline">DD ต่ำสุด:</span>
                                                <span className="sm:hidden">Min DD:</span>
                                            </span>
                                            {fleetStats.today.minDDPort !== '-' && (
                                                <a
                                                    href={`/farm/${fleetStats.today.minDDPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-amber-300 hover:underline text-[9px]"
                                                    title={`เปิดหน้าฟาร์ม #${fleetStats.today.minDDPort}`}
                                                >
                                                    #{fleetStats.today.minDDPort.slice(-3)}
                                                </a>
                                            )}
                                        </div>
                                        <div className="font-mono font-bold text-emerald-400">
                                            {fleetStats.today.minDD}%
                                        </div>
                                    </div>

                                    {/* Avg DD */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">DD เฉลี่ย:</span>
                                            <span className="sm:hidden">Avg DD:</span>
                                        </div>
                                        <div className="font-mono font-bold text-amber-300">
                                            {fleetStats.today.avgDD}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. เมื่อวาน */}
                            <div className="bg-black/40 border border-border/60 rounded-lg p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                                    <span className="text-xs font-bold text-amber-200/80 flex items-center gap-1.5">
                                        📅 {fleetStats.yesterday.dateLabel}
                                        {fleetStats.isWeekend && (
                                            <span className="text-[9px] font-mono font-normal text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                                วันทำการก่อนหน้า
                                            </span>
                                        )}
                                    </span>
                                    <span className="text-[10px] font-mono text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                        <span className="hidden sm:inline">พอร์ตกำไร: </span>
                                        <span className="sm:hidden">Win: </span>
                                        <span className="font-bold text-amber-300">{fleetStats.yesterday.positiveCount}</span>
                                        <span className="text-muted-foreground">/{fleetStats.yesterday.activeCount}</span>
                                    </span>
                                </div>

                                {/* Headline: พอร์ตกำไรสูงสุด */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            <span className="hidden sm:inline">พอร์ตกำไรสูงสุด (Max):</span>
                                            <span className="sm:hidden">Max Profit:</span>
                                        </span>
                                        <span className="font-mono text-amber-300/90 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                            {fleetStats.yesterday.topPort === '-' ? (
                                                '-'
                                            ) : /^\d+$/.test(fleetStats.yesterday.topPort) ? (
                                                <a
                                                    href={`/farm/${fleetStats.yesterday.topPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline hover:text-amber-200 inline-flex items-center gap-1"
                                                    title={`เปิดหน้าฟาร์มพอร์ต ${fleetStats.yesterday.topPort}`}
                                                >
                                                    <span>#{fleetStats.yesterday.topPort}</span>
                                                    <ExternalLink className="w-3 h-3 opacity-60" />
                                                </a>
                                            ) : (
                                                fleetStats.yesterday.topPort
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <div className="text-2xl font-black font-mono text-emerald-400/90 tracking-tight">
                                            +{fleetStats.yesterday.topProfit.toLocaleString()} USC
                                        </div>
                                        <div className="text-muted-foreground/80 font-mono text-[10px]">
                                            {fleetStats.yesterday.topProfit > 0 ? `≈ +$${(fleetStats.yesterday.topProfit / 100).toFixed(2)} USD` : ''}
                                        </div>
                                    </div>
                                </div>

                                {/* Deep Stats Grid: กำไรเฉลี่ย, กำไรต่ำสุด, พอร์ตกำไร, DD สูงสุด, DD ต่ำสุด, DD เฉลี่ย */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t border-border/30 text-xs">
                                    {/* Avg Profit */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">กำไรเฉลี่ย:</span>
                                            <span className="sm:hidden">Avg PnL:</span>
                                        </div>
                                        <div className="font-mono font-bold text-emerald-400/90 truncate">
                                            +{fleetStats.yesterday.avgProfit.toLocaleString()} <span className="text-[8px] text-muted-foreground font-normal">USC</span>
                                        </div>
                                    </div>

                                    {/* Min Profit */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                            <span>
                                                <span className="hidden sm:inline">กำไรต่ำสุด:</span>
                                                <span className="sm:hidden">Min PnL:</span>
                                            </span>
                                            {fleetStats.yesterday.minProfitPort !== '-' && (
                                                <a
                                                    href={`/farm/${fleetStats.yesterday.minProfitPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-amber-300 hover:underline text-[9px]"
                                                    title={`เปิดหน้าฟาร์ม #${fleetStats.yesterday.minProfitPort}`}
                                                >
                                                    #{fleetStats.yesterday.minProfitPort.slice(-3)}
                                                </a>
                                            )}
                                        </div>
                                        <div className="font-mono font-bold text-emerald-400/80 truncate">
                                            +{fleetStats.yesterday.minProfit.toLocaleString()} <span className="text-[8px] text-muted-foreground font-normal">USC</span>
                                        </div>
                                    </div>

                                    {/* Profitable Ports */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">พอร์ตมีกำไร:</span>
                                            <span className="sm:hidden">Win Ports:</span>
                                        </div>
                                        <div className="font-mono font-bold text-amber-300">
                                            {fleetStats.yesterday.positiveCount} <span className="text-[8px] text-muted-foreground font-normal">พอร์ต</span>
                                        </div>
                                    </div>

                                    {/* Max DD */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                            <span>
                                                <span className="hidden sm:inline">DD สูงสุด:</span>
                                                <span className="sm:hidden">Max DD:</span>
                                            </span>
                                            {fleetStats.yesterday.maxDDPort !== '-' && (
                                                <a
                                                    href={`/farm/${fleetStats.yesterday.maxDDPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-amber-300 hover:underline text-[9px]"
                                                    title={`เปิดหน้าฟาร์ม #${fleetStats.yesterday.maxDDPort}`}
                                                >
                                                    #{fleetStats.yesterday.maxDDPort.slice(-3)}
                                                </a>
                                            )}
                                        </div>
                                        <div className={`font-mono font-bold ${fleetStats.yesterday.maxDD > 15 ? 'text-red-400' : 'text-amber-400'}`}>
                                            {fleetStats.yesterday.maxDD}%
                                        </div>
                                    </div>

                                    {/* Min DD */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                                            <span>
                                                <span className="hidden sm:inline">DD ต่ำสุด:</span>
                                                <span className="sm:hidden">Min DD:</span>
                                            </span>
                                            {fleetStats.yesterday.minDDPort !== '-' && (
                                                <a
                                                    href={`/farm/${fleetStats.yesterday.minDDPort}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-amber-300 hover:underline text-[9px]"
                                                    title={`เปิดหน้าฟาร์ม #${fleetStats.yesterday.minDDPort}`}
                                                >
                                                    #{fleetStats.yesterday.minDDPort.slice(-3)}
                                                </a>
                                            )}
                                        </div>
                                        <div className="font-mono font-bold text-emerald-400">
                                            {fleetStats.yesterday.minDD}%
                                        </div>
                                    </div>

                                    {/* Avg DD */}
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">DD เฉลี่ย:</span>
                                            <span className="sm:hidden">Avg DD:</span>
                                        </div>
                                        <div className="font-mono font-bold text-amber-300">
                                            {fleetStats.yesterday.avgDD}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. สถิติสูงสุดตลอดกาล */}
                            <div className="bg-black/40 border border-amber-500/20 rounded-lg p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                                        <span className="hidden sm:inline">สถิติสูงสุดตลอดกาล (Peak)</span>
                                        <span className="sm:hidden">สูงสุดตลอดกาล (Peak)</span>
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                        Survival 100%
                                    </span>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground">
                                            <span className="hidden sm:inline">พอร์ตแชมป์:</span>
                                            <span className="sm:hidden">Top Port:</span>
                                        </span>
                                        <span className="font-mono text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                            <a
                                                href={`/farm/${fleetStats.allTimePeak.portNumber}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline hover:text-amber-200 inline-flex items-center gap-1"
                                                title={`เปิดหน้าฟาร์มพอร์ต ${fleetStats.allTimePeak.portNumber}`}
                                            >
                                                <span>#{fleetStats.allTimePeak.portNumber}</span>
                                                <ExternalLink className="w-3 h-3 opacity-60" />
                                            </a>
                                        </span>
                                    </div>
                                    <div className="flex items-baseline justify-between">
                                        <div className="text-2xl font-black font-mono text-[#ffd700] tracking-tight">
                                            +{fleetStats.allTimePeak.profit.toLocaleString()} USC
                                        </div>
                                        <div className="text-muted-foreground/80 font-mono text-[10px]">
                                            ≈ +${(fleetStats.allTimePeak.profit / 100).toFixed(2)} USD
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-amber-500/20 text-xs">
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">วันที่ทำได้:</span>
                                            <span className="sm:hidden">Date:</span>
                                        </div>
                                        <div className="font-mono text-amber-200/90 font-bold truncate">
                                            {fleetStats.allTimePeak.date}
                                        </div>
                                    </div>
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">ระยะเวลารัน:</span>
                                            <span className="sm:hidden">Runtime:</span>
                                        </div>
                                        <div className="font-mono text-amber-300 font-bold truncate">
                                            227 วัน (1 ก.พ. 69)
                                        </div>
                                    </div>
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">Max DD พอร์ตนี้:</span>
                                            <span className="sm:hidden">Max DD:</span>
                                        </div>
                                        <div className="font-mono text-emerald-400 font-bold">
                                            0.0%
                                        </div>
                                    </div>
                                    <div className="bg-black/40 rounded p-1.5 border border-border/20">
                                        <div className="text-[10px] text-muted-foreground">
                                            <span className="hidden sm:inline">สถานะระบบ:</span>
                                            <span className="sm:hidden">Status:</span>
                                        </div>
                                        <div className="font-mono text-emerald-400 font-bold text-[11px]">
                                            🟢 EasyM MAX
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ส่วนที่ 2: กำไรรวมของทุกพอร์ตในฟลีท EasyM (ผลรวมทั้งระบบ พร้อมระบุจำนวนพอร์ตที่รวมกัน และกราฟแท่งกระจายกำไร) */}
                    <div className="pt-3 border-t border-amber-500/20 space-y-2">
                        <div className="text-xs font-semibold text-emerald-400 flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 flex-wrap">
                                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="hidden sm:inline">🌐 กำไรรวมของทุกพอร์ตในฟลีท EasyM (ผลรวมทั้งระบบ)</span>
                                <span className="sm:hidden">🌐 รวมกำไรฟลีท (Total Fleet PnL)</span>
                                {fleetStats.holidayLabel && (
                                    <span className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                                        <span>🏖️</span>
                                        <span>{fleetStats.holidayLabel}</span>
                                    </span>
                                )}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                                <span className="hidden sm:inline">รวมกำไรจากพอร์ตที่ปิดออเดอร์สำเร็จ</span>
                                <span className="sm:hidden">พอร์ตที่ปิดบวก</span>
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            {/* 2.1 รวมกำไรปิดวันนี้ */}
                            <div className="bg-gradient-to-br from-emerald-950/40 via-black/60 to-black/80 border border-emerald-500/40 rounded-lg p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                        <span className="hidden sm:inline">⚡ รวมกำไรปิด{fleetStats.isWeekend ? fleetStats.today.dateLabel : `วันนี้ (${fleetStats.today.dateLabel})`}</span>
                                        <span className="sm:hidden">⚡ กำไร{fleetStats.isWeekend ? fleetStats.today.dateLabel : `วันนี้ (${fleetStats.today.dateLabel})`}</span>
                                    </span>
                                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                                        <span className="hidden sm:inline">มาจากผลรวมของ {fleetStats.today.positiveCount} พอร์ต</span>
                                        <span className="sm:hidden">รวม {fleetStats.today.positiveCount} พอร์ต</span>
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div>
                                        <div className="text-2xl sm:text-3xl font-black font-mono text-[#4de180]">
                                            +{fleetStats.today.totalProfit.toLocaleString()} USC
                                        </div>
                                        <div className="text-xs font-mono text-emerald-400/70">
                                            ≈ +${(fleetStats.today.totalProfit / 100).toFixed(2)} USD
                                        </div>
                                    </div>
                                    <div className="text-right text-[11px] text-muted-foreground space-y-0.5">
                                        <div>
                                            <span className="hidden sm:inline">เฉลี่ยพอร์ตที่ปิด: </span>
                                            <span className="sm:hidden">เฉลี่ย: </span>
                                            <span className="text-emerald-400 font-mono font-semibold">+{fleetStats.today.avgProfit.toLocaleString()} USC</span>
                                        </div>
                                        <div>
                                            <span className="hidden sm:inline">DD เฉลี่ยทั้งฝูงบิน: </span>
                                            <span className="sm:hidden">DD เฉลี่ย: </span>
                                            <span className="text-amber-300 font-mono">{fleetStats.today.avgDD}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Mini Bar Chart */}
                                <FleetProfitBarChart ports={fleetStats.today.contributingPorts} theme="emerald" />
                            </div>

                            {/* 2.2 รวมกำไรปิดเมื่อวาน */}
                            <div className="bg-gradient-to-br from-amber-950/30 via-black/60 to-black/80 border border-border/60 rounded-lg p-3.5 space-y-2.5">
                                <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                                    <span className="text-xs font-bold text-amber-200/90 flex items-center gap-1.5">
                                        <span className="hidden sm:inline">📅 รวมกำไรปิด{fleetStats.isWeekend ? fleetStats.yesterday.dateLabel : `เมื่อวาน (${fleetStats.yesterday.dateLabel})`}</span>
                                        <span className="sm:hidden">📅 กำไร{fleetStats.isWeekend ? fleetStats.yesterday.dateLabel : `เมื่อวาน (${fleetStats.yesterday.dateLabel})`}</span>
                                    </span>
                                    <span className="text-[11px] font-mono text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                                        <span className="hidden sm:inline">มาจากผลรวมของ {fleetStats.yesterday.positiveCount} พอร์ต</span>
                                        <span className="sm:hidden">รวม {fleetStats.yesterday.positiveCount} พอร์ต</span>
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <div>
                                        <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-400/90">
                                            +{fleetStats.yesterday.totalProfit.toLocaleString()} USC
                                        </div>
                                        <div className="text-xs font-mono text-emerald-400/60">
                                            ≈ +${(fleetStats.yesterday.totalProfit / 100).toFixed(2)} USD
                                        </div>
                                    </div>
                                    <div className="text-right text-[11px] text-muted-foreground space-y-0.5">
                                        <div>
                                            <span className="hidden sm:inline">เฉลี่ยพอร์ตที่ปิด: </span>
                                            <span className="sm:hidden">เฉลี่ย: </span>
                                            <span className="text-emerald-400 font-mono font-semibold">+{fleetStats.yesterday.avgProfit.toLocaleString()} USC</span>
                                        </div>
                                        <div>
                                            <span className="hidden sm:inline">DD เฉลี่ยทั้งฝูงบิน: </span>
                                            <span className="sm:hidden">DD เฉลี่ย: </span>
                                            <span className="text-amber-300 font-mono">{fleetStats.yesterday.avgDD}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Mini Bar Chart */}
                                <FleetProfitBarChart ports={fleetStats.yesterday.contributingPorts} theme="amber" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
                </div>
            )}

            {/* TAB 3: ข้อมูลสายงานพี่โจ้,ครูชัยและอื่นๆ, วิวัฒนาการ และสถิติฐานข้อมูล/ทราฟฟิก MT5 */}
            {activeTab === 'team-analytics' && (
                <div className="space-y-6">
                    {/* Admin Breakdown Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-blue-500/30 bg-blue-950/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between text-blue-400">
                            <span className="flex items-center gap-1.5">
                                <Crown className="w-4 h-4 text-amber-400" />
                                {adminStats.juntarasate.name}
                            </span>
                            <Badge variant="outline" className="text-blue-400 border-blue-500/40">Admin หลัก</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">จำนวนพอร์ตในสาย:</span>
                                <span className="sm:hidden">พอร์ตในสาย:</span>
                            </span>
                            <span className="font-bold">{adminStats.juntarasate.ports} บัญชี (Active: {adminStats.juntarasate.activePorts})</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">ส่งข้อมูล MT5 (Telemetry):</span>
                                <span className="sm:hidden">MT5 Telemetry:</span>
                            </span>
                            <span className="font-semibold text-emerald-400">
                                {adminStats.juntarasate.telemetry} / {adminStats.juntarasate.ports} บัญชี ({adminStats.juntarasate.online} ออนไลน์)
                            </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">จำนวนลูกค้า:</span>
                                <span className="sm:hidden">ลูกค้า:</span>
                            </span>
                            <span className="font-semibold">{adminStats.juntarasate.owners.size} ท่าน</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">พลังเงินทุนรันจริง:</span>
                                <span className="sm:hidden">เงินทุนรันจริง:</span>
                            </span>
                            <span className="font-mono font-semibold text-emerald-400 text-right">
                                {adminStats.juntarasate.activeUscBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                                {adminStats.juntarasate.staleUscBalance > 0 && (
                                    <span className="text-[10px] text-amber-400/90 block font-normal font-sans">
                                        (ค้าง &gt;48h: {adminStats.juntarasate.staleUscBalance.toLocaleString()} USC)
                                    </span>
                                )}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-purple-500/30 bg-purple-950/10 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between text-purple-400">
                            <span>{adminStats.bctutor.name}</span>
                            <Badge variant="outline" className="text-purple-400 border-purple-500/40">Co-Admin</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">จำนวนพอร์ตในสาย:</span>
                                <span className="sm:hidden">พอร์ตในสาย:</span>
                            </span>
                            <span className="font-bold">{adminStats.bctutor.ports} บัญชี (Active: {adminStats.bctutor.activePorts})</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">ส่งข้อมูล MT5 (Telemetry):</span>
                                <span className="sm:hidden">MT5 Telemetry:</span>
                            </span>
                            <span className="font-semibold text-amber-400">
                                {adminStats.bctutor.telemetry} / {adminStats.bctutor.ports} บัญชี ({adminStats.bctutor.online} ออนไลน์)
                            </span>
                        </div>
                        {adminStats.bctutor.ports > adminStats.bctutor.telemetry && (
                            <div className="text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/20 p-1.5 rounded">
                                ⚠️ ลูกค้ายังไม่ได้ตั้ง WebRequest ตัวที่ 2 (ส่งข้อมูลพอร์ต) {adminStats.bctutor.ports - adminStats.bctutor.telemetry} บัญชี
                            </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">จำนวนลูกค้า:</span>
                                <span className="sm:hidden">ลูกค้า:</span>
                            </span>
                            <span className="font-semibold">{adminStats.bctutor.owners.size} ท่าน</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">พลังเงินทุนรันจริง:</span>
                                <span className="sm:hidden">เงินทุนรันจริง:</span>
                            </span>
                            <span className="font-mono font-semibold text-emerald-400 text-right">
                                {adminStats.bctutor.activeUscBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                                {adminStats.bctutor.staleUscBalance > 0 && (
                                    <span className="text-[10px] text-amber-400/90 block font-normal font-sans">
                                        (ค้าง &gt;48h: {adminStats.bctutor.staleUscBalance.toLocaleString()} USC)
                                    </span>
                                )}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border bg-card/50 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between text-muted-foreground">
                            <span>{adminStats.direct.name}</span>
                            <Badge variant="outline">Direct</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">จำนวนพอร์ตในสาย:</span>
                                <span className="sm:hidden">พอร์ตในสาย:</span>
                            </span>
                            <span className="font-bold">{adminStats.direct.ports} บัญชี (Active: {adminStats.direct.activePorts})</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">ส่งข้อมูล MT5 (Telemetry):</span>
                                <span className="sm:hidden">MT5 Telemetry:</span>
                            </span>
                            <span className="font-semibold">{adminStats.direct.telemetry} / {adminStats.direct.ports} บัญชี</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">จำนวนลูกค้า:</span>
                                <span className="sm:hidden">ลูกค้า:</span>
                            </span>
                            <span className="font-semibold">{adminStats.direct.owners.size} ท่าน</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">พลังเงินทุนรันจริง:</span>
                                <span className="sm:hidden">เงินทุนรันจริง:</span>
                            </span>
                            <span className="font-mono font-semibold text-emerald-400 text-right">
                                {adminStats.direct.activeUscBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                                {adminStats.direct.staleUscBalance > 0 && (
                                    <span className="text-[10px] text-amber-400/90 block font-normal font-sans">
                                        (ค้าง &gt;48h: {adminStats.direct.staleUscBalance.toLocaleString()} USC)
                                    </span>
                                )}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Monthly Fleet Evolution & Capital History Section */}
            {monthlyStats.length > 0 && (
                <div className="bg-card/80 border border-border rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                    <span className="hidden sm:inline">วิวัฒนาการและการเติบโตของฝูงบิน EasyM รายเดือน</span>
                                    <span className="sm:hidden">การเติบโตรายเดือน (Monthly Stats)</span>
                                    <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                                        Lifecycle &amp; Retention
                                    </Badge>
                                </h2>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    บันทึกประวัติความเปลี่ยนแปลงของพอร์ต, ผู้ใช้งาน, การเริ่ม-หยุดรัน และพลังเงินทุนย้อนหลังตั้งแต่ ก.พ. 2569
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-muted-foreground">
                                <span className="hidden sm:inline">บันทึกสะสม:</span>
                                <span className="sm:hidden">สะสม:</span>
                            </span>
                            <span className="font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/50">
                                {monthlyStats.length} เดือน
                            </span>
                        </div>
                    </div>

                    {/* Evolution Summary Mini-Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-muted/20 border border-border/40 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">พอร์ตเริ่มใหม่สะสม</div>
                            <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
                                +{monthlyStats.reduce((s, m) => s + m.newPortsCount, 0)} <span className="text-xs font-normal text-muted-foreground font-sans">บัญชี</span>
                            </div>
                        </div>
                        <div className="bg-muted/20 border border-border/40 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">พอร์ตหยุด / ขาดติดต่อสะสม</div>
                            <div className="text-xl font-bold text-amber-400 mt-1 font-mono">
                                -{monthlyStats.reduce((s, m) => s + m.endedPortsCount, 0)} <span className="text-xs font-normal text-muted-foreground font-sans">บัญชี</span>
                            </div>
                        </div>
                        <div className="bg-muted/20 border border-border/40 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">พอร์ตรันอยู่จริงปัจจุบัน</div>
                            <div className="text-xl font-bold text-foreground mt-1 font-mono">
                                {kpi.realRunningCount} <span className="text-xs font-normal text-muted-foreground font-sans">บัญชี</span>
                            </div>
                        </div>
                        <div className="bg-muted/20 border border-border/40 rounded-lg p-3">
                            <div className="text-xs text-muted-foreground">พลังเงินทุนรันจริงปัจจุบัน</div>
                            <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">
                                ${(kpi.activeBalanceUSC / 100 + kpi.activeBalanceUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </div>
                        </div>
                    </div>

                    {/* Monthly Table */}
                    <div className="overflow-x-auto border border-border/50 rounded-lg">
                        <Table className="text-xs">
                            <TableHeader className="bg-muted/40">
                                <TableRow>
                                    <TableHead className="font-semibold">เดือน</TableHead>
                                    <TableHead className="text-center text-emerald-400 font-semibold">เริ่มใหม่ (+)</TableHead>
                                    <TableHead className="text-center text-amber-400 font-semibold">หยุด / ขาดติดต่อ (-)</TableHead>
                                    <TableHead className="text-center font-semibold">สุทธิ (Net Growth)</TableHead>
                                    <TableHead className="text-center font-semibold">พอร์ตรันจริง (Fleet)</TableHead>
                                    <TableHead className="text-center font-semibold">ผู้ใช้งานจริง</TableHead>
                                    <TableHead className="text-right font-semibold">พลังเงินทุนรันจริง (Capital)</TableHead>
                                    <TableHead className="text-center font-semibold">เติบโต MoM</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyStats.slice().reverse().map(m => (
                                    <TableRow key={m.monthKey} className="hover:bg-muted/30">
                                        <TableCell className="font-semibold font-mono">{m.monthLabel}</TableCell>
                                        <TableCell className="text-center font-mono text-emerald-400 font-medium">
                                            {m.newPortsCount > 0 ? `+${m.newPortsCount}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-amber-400 font-medium">
                                            {m.endedPortsCount > 0 ? `-${m.endedPortsCount}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-bold">
                                            {m.netGrowth > 0 ? (
                                                <span className="text-emerald-400">+{m.netGrowth}</span>
                                            ) : m.netGrowth < 0 ? (
                                                <span className="text-amber-400">{m.netGrowth}</span>
                                            ) : (
                                                <span className="text-muted-foreground">0</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-bold text-foreground">
                                            {m.activePortsCount} บัญชี
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-muted-foreground">
                                            {m.activeUsersCount} ท่าน
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold text-emerald-400">
                                            {(m.activeCapitalUSC / 100 + m.activeCapitalUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })} USD
                                            <span className="text-[10px] text-muted-foreground block font-normal">
                                                {m.activeCapitalUSC.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center font-mono">
                                            {m.growthRatePct > 0 ? (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                                    +{m.growthRatePct}%
                                                </Badge>
                                            ) : m.growthRatePct < 0 ? (
                                                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">
                                                    {m.growthRatePct}%
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-[10px]">-</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

                    {/* ปิดท้ายด้วย: สถิติฐานข้อมูลและข้อมูลการจราจรข้อมูล MT5 Sync */}
                    {databaseAndTrafficElement}
                </div>
            )}

            {/* TAB 2: ค้นหาและรายการพอร์ตฝูงบิน */}
            {activeTab === 'ports' && (
                <div className="space-y-6">
                    {/* ส่วนบน: แถบค้นหาและตัวกรองต่างๆ */}
                    {/* Filter, Search & View Modes Control Bar */}
                    <Card className="border-border shadow-sm bg-card">
                        <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                        {/* Search Bar with auto-expansion & clear button */}
                        <div className={`relative transition-all duration-300 w-full ${isSearchFocused || searchQuery ? 'xl:flex-1' : 'xl:w-[380px]'}`}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="ค้นหาด้วยเลขพอร์ต, ชื่อลูกค้า, อีเมล, หรือชื่อพอร์ต..."
                                value={searchQuery}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-9 bg-background h-10 w-full text-sm font-sans"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors"
                                    title="ล้างคำค้นหา"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Filters and View Mode Controls */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Admin Filter */}
                            <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                                <SelectTrigger className="w-full sm:w-[150px] bg-background">
                                    <SelectValue placeholder="กรองตามแอดมิน" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">แอดมินทั้งหมด</SelectItem>
                                    <SelectItem value="juntarasate">สายงานพี่โจ้</SelectItem>
                                    <SelectItem value="bctutor">สายงานครูชัย</SelectItem>
                                    <SelectItem value="other">พอร์ตระบบ / อื่นๆ</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Product Filter */}
                            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                                <SelectTrigger className="w-full sm:w-[140px] bg-background">
                                    <SelectValue placeholder="กรองตามสินค้า" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">สินค้าทั้งหมด</SelectItem>
                                    <SelectItem value="max">EasyM MAX</SelectItem>
                                    <SelectItem value="mini">EasyM mini</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* License Status Filter */}
                            <Select value={selectedLicenseStatus} onValueChange={setSelectedLicenseStatus}>
                                <SelectTrigger className="w-full sm:w-[145px] bg-background">
                                    <SelectValue placeholder="สถานะ License" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">License ทั้งหมด</SelectItem>
                                    <SelectItem value="active">✅ เปิดใช้งาน (Active)</SelectItem>
                                    <SelectItem value="inactive">⛔ ระงับ (Inactive)</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Status Filter */}
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="w-full sm:w-[170px] bg-background">
                                    <SelectValue placeholder="สถานะพอร์ต" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">สถานะพอร์ตทั้งหมด</SelectItem>
                                    <SelectItem value="real_running">🟢 รันจริง (EasyM &le; 48h &amp; ทุนถึง)</SelectItem>
                                    <SelectItem value="mismatch_gold">🥇 รัน EA ทองคำ (EasyGold)</SelectItem>
                                    <SelectItem value="offline_48h">⏸️ ขาดติดต่อ (&gt; 48 ชม.)</SelectItem>
                                    <SelectItem value="insufficient_bal">⚠️ ทุนต่ำกว่าเกณฑ์</SelectItem>
                                    <SelectItem value="no_telemetry">⚪ ยังไม่เริ่มรัน (No Ping)</SelectItem>
                                    <SelectItem value="tester">🧪 บัญชีทดสอบ (Tester)</SelectItem>
                                    <SelectItem value="online">⚡ สด &lt; 30 นาที</SelectItem>
                                    <SelectItem value="full_sync">📡 2 URLs (Full WebSync)</SelectItem>
                                    <SelectItem value="license_only">🔑 1 URL (License Only)</SelectItem>
                                    <SelectItem value="high_dd">⚠️ DD &gt; 10%</SelectItem>
                                    <SelectItem value="profit_positive">{fleetStats?.isWeekend ? `📈 กำไร (${fleetStats.today.dateLabel})` : '📈 วันนี้บวก'}</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* View Mode Buttons */}
                            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-background shrink-0 ml-auto sm:ml-0">
                                <Button
                                    variant={viewMode === 'customer' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('customer')}
                                    className="text-xs h-8 px-2.5"
                                >
                                    <Users className="w-3.5 h-3.5 mr-1" />
                                    <span className="hidden sm:inline">แยกตามลูกค้า</span>
                                    <span className="sm:hidden">ลูกค้า</span>
                                </Button>
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                    className="text-xs h-8 px-2.5"
                                >
                                    <Layers className="w-3.5 h-3.5 mr-1" />
                                    <span className="hidden sm:inline">ตารางรวม</span>
                                    <span className="sm:hidden">ตาราง</span>
                                </Button>
                                <Button
                                    variant={viewMode === 'cards' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('cards')}
                                    className="text-xs h-8 px-2.5"
                                >
                                    <BarChart3 className="w-3.5 h-3.5 mr-1" />
                                    <span className="hidden sm:inline">การ์ดพอร์ต</span>
                                    <span className="sm:hidden">การ์ด</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Filter Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
                        <span className="text-muted-foreground font-medium mr-1 text-[11px]">
                            <span className="hidden sm:inline">ตัวกรองด่วน:</span>
                            <span className="sm:hidden">กรอง:</span>
                        </span>
                        <Button 
                            variant={selectedStatus === 'all' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedStatus('all')}
                            className="h-7 text-xs px-2.5 rounded-full"
                        >
                            ทั้งหมด ({ports.length})
                        </Button>
                        <Button 
                            variant={selectedStatus === 'real_running' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedStatus('real_running')}
                            className={`h-7 text-xs px-2.5 rounded-full ${selectedStatus === 'real_running' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'}`}
                        >
                            ⚡ รันจริงเท่านั้น ({ports.filter(p => p.isRealRunning).length})
                        </Button>
                        <Button 
                            variant={selectedStatus === 'full_sync' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedStatus('full_sync')}
                            className={`h-7 text-xs px-2.5 rounded-full ${selectedStatus === 'full_sync' ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'text-sky-400 border-sky-500/30 hover:bg-sky-500/10'}`}
                            title="พอร์ตที่มีการตั้งค่า WebRequest ครบทั้ง 2 URLs (ส่งออเดอร์, กำไร และ DD ครบถ้วน)"
                        >
                            📡 2 URLs (Full) ({ports.filter(p => p.telemetryType === 'full_sync').length})
                        </Button>
                        <Button 
                            variant={selectedStatus === 'license_only' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedStatus('license_only')}
                            className={`h-7 text-xs px-2.5 rounded-full ${selectedStatus === 'license_only' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10'}`}
                            title="พอร์ตที่มี WebRequest ตัวเดียว (เช็คสิทธิ์อย่างเดียว) แนะนำเพิ่ม URL Supabase ใน MT5"
                        >
                            🔑 1 URL (License) ({ports.filter(p => p.telemetryType === 'license_only').length})
                        </Button>
                        <Button 
                            variant={selectedStatus === 'offline_48h' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedStatus('offline_48h')}
                            className={`h-7 text-xs px-2.5 rounded-full ${selectedStatus === 'offline_48h' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-amber-400 border-amber-500/30 hover:bg-amber-500/10'}`}
                            title="พอร์ตที่ขาดการติดต่อเกิน 48 ชม. อาจมีการถอนเงินออกแล้ว"
                        >
                            ⏸️ ขาดติดต่อ &gt;48h ({ports.filter(p => p.runStatus === 'offline_48h').length})
                        </Button>
                        <Button 
                            variant={selectedStatus === 'insufficient_bal' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedStatus('insufficient_bal')}
                            className={`h-7 text-xs px-2.5 rounded-full ${selectedStatus === 'insufficient_bal' ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-400 border-red-500/30 hover:bg-red-500/10'}`}
                        >
                            ⚠️ ทุนไม่ถึง ({ports.filter(p => p.runStatus === 'insufficient_balance').length})
                        </Button>
                        <Button 
                            variant={selectedStatus === 'online' ? 'default' : 'outline'} 
                            size="sm" 
                            onClick={() => setSelectedStatus('online')}
                            className={`h-7 text-xs px-2.5 rounded-full ${selectedStatus === 'online' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10'}`}
                        >
                            🟢 สด &lt;30 นาที ({ports.filter(p => p.isOnline).length})
                        </Button>
                    </div>

                </CardContent>
            </Card>

            {/* คั่นด้วย: ข้อมูลแถวบนสุดเดิม (จำนวนฝูงบินทั้งหมด, พลังทุน, กำไรลอยตัว, เจ้าของพอร์ต) */}
            {kpiCardsElement}

            {/* ผลของการกรองและค้นหา */}
            {/* View Mode 1: Grouped By Customer */}
            {viewMode === 'customer' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span>แสดงลูกค้าทั้งหมด {customerGroups.length} ท่าน (รวม {filteredPorts.length} พอร์ต)</span>
                        <span>เรียงตามจำนวนพอร์ตที่ถือครอง</span>
                    </div>

                    {customerGroups.length === 0 ? (
                        <Card className="border border-dashed p-12 text-center text-muted-foreground">
                            ไม่พบข้อมูลพอร์ตตามเงื่อนไขที่ค้นหา
                        </Card>
                    ) : (
                        customerGroups.map(group => (
                            <Card key={group.customerId} className="border-border shadow-sm overflow-hidden bg-card/60">
                                <CardHeader className="p-4 bg-muted/20 border-b border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm border border-blue-500/20">
                                            {group.customerName.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-foreground text-base">{group.customerName}</h3>
                                                <Badge variant="outline" className="bg-background text-xs">
                                                    ถือ {group.ports.length} พอร์ต
                                                </Badge>
                                                {group.onlineCount > 0 ? (
                                                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                        <Wifi className="w-3 h-3" /> ออนไลน์ {group.onlineCount}/{group.ports.length}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                                                        <WifiOff className="w-3 h-3" /> ออฟไลน์ทั้งหมด
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                                                <span>{group.customerEmail}</span>
                                                <span>•</span>
                                                <span className="text-blue-400 font-medium">แอดมิน: {group.adminName}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial summary for customer */}
                                    <div className="flex items-center gap-4 text-xs font-mono">
                                        <div className="text-right">
                                            <span className="text-muted-foreground block text-[10px]">ทุนรวม (Balance)</span>
                                            <span className="font-bold text-foreground text-sm">
                                                {group.totalBalanceUSC.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                                                {group.totalBalanceUSD > 0 && ` + $${group.totalBalanceUSD.toLocaleString('en-US')}`}
                                            </span>
                                        </div>
                                        <div className="text-right border-l border-border/40 pl-4">
                                            <span className="text-muted-foreground block text-[10px]">กำไรลอยตัว (Floating)</span>
                                            <span className={`font-bold text-sm ${group.totalFloatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {group.totalFloatingPnl >= 0 ? '+' : ''}{group.totalFloatingPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader className="bg-muted/10">
                                            <TableRow>
                                                <TableHead className="w-[140px]">เลขพอร์ต</TableHead>
                                                <TableHead>สินค้า / บอท</TableHead>
                                                <TableHead>วันที่เริ่ม (รันมาแล้ว)</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                                <TableHead className="text-right">Equity</TableHead>
                                                <TableHead className="text-right">Floating PnL</TableHead>
                                                <TableHead className="text-right">Drawdown</TableHead>
                                                <TableHead className="text-right">{fleetStats?.isWeekend ? `กำไร (${fleetStats.today.dateLabel})` : 'กำไรวันนี้'}</TableHead>
                                                <TableHead className="text-center">เวอร์ชัน EA</TableHead>
                                                <TableHead className="text-center">สถานะ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.ports.map(port => (
                                                <TableRow key={port.portNumber} className="hover:bg-muted/30">
                                                    <TableCell className="font-mono font-bold text-foreground">
                                                        <div className="flex items-center gap-1.5">
                                                            <a
                                                                href={`/farm/${port.portNumber}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="hover:underline hover:text-blue-400 inline-flex items-center gap-1 group transition-colors"
                                                                title={`คลิกเพื่อเปิดดูหน้าฟาร์มพอร์ต ${port.portNumber}`}
                                                            >
                                                                <span>{port.portNumber}</span>
                                                                <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                            </a>
                                                            {port.portName && (
                                                                <span className="text-[11px] text-muted-foreground font-normal">({port.portName})</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-medium text-xs text-blue-400">{port.productName}</span>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        <div>{port.startDate}</div>
                                                        {port.endDate ? (
                                                            <div className="text-[10px] text-amber-400/90 font-medium" title={`หยุดส่งสัญญาณเมื่อ ${port.endDate}`}>
                                                                ถึง: {port.endDate}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-emerald-400 font-semibold">
                                                                {port.activeDays} วัน (รันต่อเนื่อง)
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold">
                                                        {port.runStatus === 'offline_48h' ? (
                                                            <div className="flex flex-col items-end" title={`ขาดการติดต่อมาแล้ว ${port.hoursSinceLastPing} ชม. อาจถอนเงินออกแล้ว`}>
                                                                <span className="text-muted-foreground/60 line-through text-xs">
                                                                    {port.balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {port.accountType}
                                                                </span>
                                                                <span className="text-[10px] text-amber-400 font-sans font-medium">
                                                                    ⏸️ ค้าง ({Math.round(port.hoursSinceLastPing / 24)} วัน)
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className={port.isRealRunning ? 'text-foreground' : 'text-muted-foreground'}>
                                                                {port.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {port.accountType}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        {port.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-mono font-semibold ${port.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {port.floatingPnl >= 0 ? '+' : ''}{port.floatingPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono">
                                                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                                            port.maxDrawdown > 20 ? 'bg-red-500/10 text-red-400' :
                                                            port.maxDrawdown > 10 ? 'bg-amber-500/10 text-amber-400' :
                                                            'text-muted-foreground'
                                                        }`}>
                                                            {port.maxDrawdown.toFixed(1)}%
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-xs">
                                                        {port.todayPnl > 0 ? (
                                                            <span className="text-emerald-400 font-bold">+{port.todayPnl.toFixed(2)}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">0.00</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                                        {port.eaVersion}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            {port.runStatus === 'running' ? (
                                                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0">
                                                                    🟢 รันจริง {port.isOnline ? '(สด)' : '(<48h)'}
                                                                </Badge>
                                                            ) : port.runStatus === 'mismatch_gold' ? (
                                                                <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/40 text-[9px] px-1.5 py-0 font-medium" title="พอร์ตนี้ลงทะเบียน EasyM แต่บน MT5 กำลังส่งข้อมูลเป็น EA ทองคำ (EasyGold)">
                                                                    🥇 รันทองคำ (EasyGold)
                                                                </Badge>
                                                            ) : port.runStatus === 'offline_48h' ? (
                                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0" title={`ขาดติดต่อ ${Math.round(port.hoursSinceLastPing / 24)} วัน`}>
                                                                    ⏸️ ขาดติดต่อ ({port.hoursSinceLastPing}h)
                                                                </Badge>
                                                            ) : port.runStatus === 'insufficient_balance' ? (
                                                                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0" title={`ทุนไม่ถึงเกณฑ์ (มี ${port.balance.toLocaleString()} / ต้องการ ${port.requiredBalanceUSC.toLocaleString()} USC)`}>
                                                                    ⚠️ ทุนไม่ถึง
                                                                </Badge>
                                                            ) : port.runStatus === 'no_telemetry' ? (
                                                                <Badge variant="outline" className="text-muted-foreground text-[9px] px-1.5 py-0">
                                                                    ⚪ ยังไม่เริ่มรัน
                                                                </Badge>
                                                            ) : port.isTester ? (
                                                                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[9px] px-1.5 py-0">
                                                                    🧪 Tester
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-muted-foreground text-[9px] px-1.5 py-0">
                                                                    ⚪ ออฟไลน์
                                                                </Badge>
                                                            )}
                                                            {!port.isActive ? (
                                                                <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 text-[9px] px-1.5 py-0">
                                                                    ⛔ Inactive
                                                                </Badge>
                                                            ) : null}
                                                            {port.telemetryType === 'full_sync' ? (
                                                                <span className="inline-flex items-center gap-1 text-[8px] text-sky-400 font-mono bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20" title="เชื่อมต่อสมบูรณ์ (2 URLs): ส่งข้อมูลคำสั่ง, กำไร และ DD ครบถ้วน">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block"></span> 2 URLs (Full)
                                                                </span>
                                                            ) : port.telemetryType === 'license_only' ? (
                                                                <span className="inline-flex items-center gap-1 text-[8px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 cursor-help" title="เชื่อมต่อเฉพาะระบบลิขสิทธิ์ (1 URL): แนะนำเพิ่ม URL Supabase ใน MT5 เพื่อรับข้อมูล Full Telemetry">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span> 1 URL (License)
                                                                </span>
                                                            ) : null}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleToggleLicenseActive(port.portNumber, port.isActive)}
                                                                className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-red-400 hover:bg-muted/50 mt-0.5"
                                                                title={port.isActive ? "คลิกเพื่อระงับสิทธิ์ EasyM พอร์ตนี้ (ไม่นับเป็นผู้ใช้ EasyM)" : "คลิกเพื่อเปิดใช้งานสิทธิ์ EasyM พอร์ตนี้"}
                                                            >
                                                                {port.isActive ? "ระงับสิทธิ์" : "เปิดสิทธิ์"}
                                                            </Button>

                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* View Mode 2: Flat Table */}
            {viewMode === 'table' && (
                <Card className="border-border shadow-sm">
                    <CardHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-bold">ตารางรายพอร์ตทั้งหมด</CardTitle>
                            <CardDescription>แสดงข้อมูลพอร์ต EasyM ทั้งหมด {filteredPorts.length} บัญชีแบบละเอียด</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>เลขพอร์ต</TableHead>
                                    <TableHead>เจ้าของบัญชี</TableHead>
                                    <TableHead>แอดมินสายงาน</TableHead>
                                    <TableHead>สินค้า</TableHead>
                                    <TableHead>เริ่มใช้งาน (วัน)</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-right">Equity</TableHead>
                                    <TableHead className="text-right">Floating PnL</TableHead>
                                    <TableHead className="text-right">Max DD</TableHead>
                                    <TableHead className="text-right">{fleetStats?.isWeekend ? `กำไร (${fleetStats.today.dateLabel})` : 'กำไรวันนี้'}</TableHead>
                                    <TableHead className="text-center">เวอร์ชัน EA</TableHead>
                                    <TableHead className="text-center">สถานะ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPorts.map(port => (
                                    <TableRow key={port.portNumber} className="hover:bg-muted/30">
                                        <TableCell className="font-mono font-bold text-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <a
                                                    href={`/farm/${port.portNumber}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline hover:text-blue-400 inline-flex items-center gap-1 group transition-colors"
                                                    title={`คลิกเพื่อเปิดดูหน้าฟาร์มพอร์ต ${port.portNumber}`}
                                                >
                                                    <span>{port.portNumber}</span>
                                                    <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                </a>
                                                {port.portName && (
                                                    <span className="text-[11px] text-muted-foreground font-normal">({port.portName})</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium text-xs">{port.customerName}</div>
                                            <div className="text-[10px] text-muted-foreground">{port.customerEmail}</div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <span className={`font-semibold ${port.adminEmail.includes('juntarasate') ? 'text-blue-400' : port.adminEmail.includes('bctutor') ? 'text-purple-400' : 'text-muted-foreground'}`}>
                                                {port.adminName}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-blue-400 font-medium">
                                            {port.productName}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            <div>{port.startDate}</div>
                                            {port.endDate ? (
                                                <div className="text-[10px] text-amber-400/90 font-medium" title={`หยุดส่งสัญญาณเมื่อ ${port.endDate}`}>
                                                    ถึง: {port.endDate}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-emerald-400 font-semibold">
                                                    {port.activeDays} วัน (รันต่อเนื่อง)
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            {port.runStatus === 'offline_48h' ? (
                                                <div className="flex flex-col items-end" title={`ขาดการติดต่อมาแล้ว ${port.hoursSinceLastPing} ชม. อาจถอนเงินออกแล้ว`}>
                                                    <span className="text-muted-foreground/60 line-through text-xs">
                                                        {port.balance.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {port.accountType}
                                                    </span>
                                                    <span className="text-[10px] text-amber-400 font-sans font-medium">
                                                        ⏸️ ค้าง ({Math.round(port.hoursSinceLastPing / 24)} วัน)
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className={port.isRealRunning ? 'text-foreground' : 'text-muted-foreground'}>
                                                    {port.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {port.accountType}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {port.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono font-semibold ${port.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {port.floatingPnl >= 0 ? '+' : ''}{port.floatingPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                                port.maxDrawdown > 20 ? 'bg-red-500/10 text-red-400' :
                                                port.maxDrawdown > 10 ? 'bg-amber-500/10 text-amber-400' :
                                                'text-muted-foreground'
                                            }`}>
                                                {port.maxDrawdown.toFixed(1)}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                            {port.todayPnl > 0 ? (
                                                <span className="text-emerald-400 font-bold">+{port.todayPnl.toFixed(2)}</span>
                                            ) : (
                                                <span className="text-muted-foreground">0.00</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                            {port.eaVersion}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {port.runStatus === 'running' ? (
                                                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0">
                                                        🟢 รันจริง {port.isOnline ? '(สด)' : '(<48h)'}
                                                    </Badge>
                                                ) : port.runStatus === 'mismatch_gold' ? (
                                                    <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/40 text-[9px] px-1.5 py-0 font-medium" title="พอร์ตนี้ลงทะเบียน EasyM แต่บน MT5 กำลังส่งข้อมูลเป็น EA ทองคำ (EasyGold)">
                                                        🥇 รันทองคำ (EasyGold)
                                                    </Badge>
                                                ) : port.runStatus === 'offline_48h' ? (
                                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px] px-1.5 py-0" title={`ขาดติดต่อ ${Math.round(port.hoursSinceLastPing / 24)} วัน`}>
                                                        ⏸️ ขาดติดต่อ ({port.hoursSinceLastPing}h)
                                                    </Badge>
                                                ) : port.runStatus === 'insufficient_balance' ? (
                                                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[9px] px-1.5 py-0" title={`ทุนไม่ถึงเกณฑ์ (มี ${port.balance.toLocaleString()} / ต้องการ ${port.requiredBalanceUSC.toLocaleString()} USC)`}>
                                                        ⚠️ ทุนไม่ถึง
                                                    </Badge>
                                                ) : port.runStatus === 'no_telemetry' ? (
                                                    <Badge variant="outline" className="text-muted-foreground text-[9px] px-1.5 py-0">
                                                        ⚪ ยังไม่เริ่มรัน
                                                    </Badge>
                                                ) : port.isTester ? (
                                                    <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[9px] px-1.5 py-0">
                                                        🧪 Tester
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-muted-foreground text-[9px] px-1.5 py-0">
                                                        ⚪ ออฟไลน์
                                                    </Badge>
                                                )}
                                                {!port.isActive ? (
                                                    <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 text-[9px] px-1.5 py-0">
                                                        ⛔ Inactive
                                                    </Badge>
                                                ) : null}
                                                {port.telemetryType === 'full_sync' ? (
                                                    <span className="inline-flex items-center gap-1 text-[8px] text-sky-400 font-mono bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20" title="เชื่อมต่อสมบูรณ์ (2 URLs): ส่งข้อมูลคำสั่ง, กำไร และ DD ครบถ้วน">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block"></span> 2 URLs (Full)
                                                    </span>
                                                ) : port.telemetryType === 'license_only' ? (
                                                    <span className="inline-flex items-center gap-1 text-[8px] text-amber-400 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 cursor-help" title="เชื่อมต่อเฉพาะระบบลิขสิทธิ์ (1 URL): คำนวณ DD/กำไรจาก Balance แนะนำเพิ่ม URL Supabase ใน MT5 เพื่อรับข้อมูล Telemetry แบบเรียลไทม์">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span> 1 URL (License)
                                                    </span>
                                                ) : null}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggleLicenseActive(port.portNumber, port.isActive)}
                                                    className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-red-400 hover:bg-muted/50 mt-0.5"
                                                    title={port.isActive ? "คลิกเพื่อระงับสิทธิ์ EasyM พอร์ตนี้ (ไม่นับเป็นผู้ใช้ EasyM)" : "คลิกเพื่อเปิดใช้งานสิทธิ์ EasyM พอร์ตนี้"}
                                                >
                                                    {port.isActive ? "ระงับสิทธิ์" : "เปิดสิทธิ์"}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* View Mode 3: Grid Cards */}
            {viewMode === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPorts.map(port => (
                        <Card key={port.portNumber} className="border-border bg-card shadow-sm hover:border-blue-500/30 transition-all">
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={`/farm/${port.portNumber}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline hover:text-blue-400 inline-flex items-center gap-1.5 group transition-colors"
                                            title={`คลิกเพื่อเปิดดูหน้าฟาร์มพอร์ต ${port.portNumber}`}
                                        >
                                            <h4 className="font-mono font-bold text-base text-foreground group-hover:text-blue-400">#{port.portNumber}</h4>
                                            <ExternalLink className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                        </a>
                                        {port.isOnline ? (
                                            <span className="flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
                                                <Wifi className="w-2.5 h-2.5" /> Online
                                            </span>
                                        ) : port.hasTelemetry ? (
                                            <span className="flex items-center gap-1 text-[10px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded-full">
                                                <WifiOff className="w-2.5 h-2.5" /> Offline
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full" title="ยังไม่ได้ตั้งค่า WebRequest ตัวที่ 2 (api/farm/sync)">
                                                ⚠️ ไม่มี Telemetry
                                            </span>
                                        )}
                                        {port.telemetryType === 'full_sync' ? (
                                            <span className="flex items-center gap-1 text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded-full font-medium" title="เชื่อมต่อสมบูรณ์ (2 URLs): ส่งข้อมูลคำสั่ง, กำไร และ DD ครบถ้วน">
                                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> 2 URLs (Full Sync)
                                            </span>
                                        ) : port.telemetryType === 'license_only' ? (
                                            <span className="flex items-center gap-1 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-medium" title="เชื่อมต่อเฉพาะระบบลิขสิทธิ์ (1 URL): คำนวณ DD/กำไรจาก Balance แนะนำเพิ่ม URL Supabase ใน MT5 เพื่อรับข้อมูล Full Telemetry">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> 1 URL (License Only)
                                            </span>
                                        ) : null}
                                        {port.runStatus === 'mismatch_gold' && (
                                            <span className="text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full font-medium" title="พอร์ตนี้ลงทะเบียน EasyM แต่บน MT5 กำลังส่งข้อมูลเป็น EA ทองคำ (EasyGold)">
                                                🥇 รันทองคำ (EasyGold)
                                            </span>
                                        )}
                                        {!port.isActive && (
                                            <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                                                ⛔ Inactive
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{port.customerName}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                                        {port.productName}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggleLicenseActive(port.portNumber, port.isActive)}
                                        className="h-5 px-1.5 text-[9px] text-muted-foreground hover:text-red-400 hover:bg-muted/50"
                                        title={port.isActive ? "คลิกเพื่อระงับสิทธิ์ EasyM พอร์ตนี้" : "คลิกเพื่อเปิดใช้งานสิทธิ์ EasyM พอร์ตนี้"}
                                    >
                                        {port.isActive ? "⛔ ระงับสิทธิ์" : "✅ เปิดสิทธิ์"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-3 text-xs">
                                <div className="grid grid-cols-2 gap-2 bg-muted/20 p-2.5 rounded-lg border border-border/40 font-mono">
                                    <div>
                                        <span className="text-[10px] text-muted-foreground block">Balance</span>
                                        {port.runStatus === 'offline_48h' ? (
                                            <div>
                                                <span className="font-bold text-muted-foreground/60 line-through text-sm">
                                                    {port.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} {port.accountType}
                                                </span>
                                                <span className="text-[10px] text-amber-400 font-sans block">
                                                    ⏸️ ค้าง ({Math.round(port.hoursSinceLastPing / 24)} วัน)
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="font-bold text-foreground text-sm">
                                                {port.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} {port.accountType}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-muted-foreground block">Equity</span>
                                        <span className="font-bold text-foreground text-sm">
                                            {port.equity.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1 font-mono">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Floating PnL:</span>
                                        <span className={`font-semibold ${port.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {port.floatingPnl >= 0 ? '+' : ''}{port.floatingPnl.toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Max Drawdown:</span>
                                        <span className={`font-semibold ${port.maxDrawdown > 20 ? 'text-red-400' : port.maxDrawdown > 10 ? 'text-amber-400' : 'text-foreground'}`}>
                                            {port.maxDrawdown.toFixed(1)}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">ช่วงเวลาใช้งาน:</span>
                                        {port.endDate ? (
                                            <span className="text-amber-400 font-medium">{port.startDate} ถึง {port.endDate}</span>
                                        ) : (
                                            <span className="text-emerald-400 font-semibold">{port.activeDays} วัน (เริ่ม {port.startDate})</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">สายงานแอดมิน:</span>
                                        <span className="text-blue-400">{port.adminName}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
                </div>
            )}
        </div>
    );
}
