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
    UserCheck
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
    hoursSinceLastPing: number;
    requiredBalanceUSC: number;
    runStatus: 'running' | 'offline_48h' | 'insufficient_balance' | 'no_telemetry' | 'tester' | 'inactive_license';
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

export interface FleetDailyComparison {
    today: {
        date: string;
        dateLabel: string;
        topPort: string;
        topProfit: number;
        topDD: number;
        totalProfit: number;
        avgProfit: number;
        avgDD: number;
        activeCount: number;
        positiveCount: number;
    };
    yesterday: {
        date: string;
        dateLabel: string;
        topPort: string;
        topProfit: number;
        topDD: number;
        totalProfit: number;
        avgProfit: number;
        avgDD: number;
        activeCount: number;
        positiveCount: number;
    };
    allTimePeak: {
        portNumber: string;
        profit: number;
        date: string;
        maxDD: number;
    };
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
    const [monthlyStats, setMonthlyStats] = useState<MonthlyFleetStat[]>([]);

    // Filters & UI States
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAdmin, setSelectedAdmin] = useState<string>('all');
    const [selectedProduct, setSelectedProduct] = useState<string>('all');
    const [selectedStatus, setSelectedStatus] = useState<string>('all');
    const [selectedLicenseStatus, setSelectedLicenseStatus] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'customer' | 'table' | 'cards'>('customer');

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

            // Forex market trading date (rolls over at 05:00 AM Bangkok time, matching FarmClient)
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

            function getMarketTradingDateStr(date: Date = new Date()): string {
                const d = getMarketTradingDate(date);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }

            const todayDateStr = getMarketTradingDateStr(new Date());
            const yesterdayMarketDate = new Date(getMarketTradingDate(new Date()));
            yesterdayMarketDate.setDate(yesterdayMarketDate.getDate() - 1);
            const yesterdayDateStr = getMarketTradingDateStr(yesterdayMarketDate);
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

                // Split Today & Yesterday
                if (h.date === todayDateStr) {
                    todayHistoryRecords.push({ ...h, port_number: port });
                } else if (h.date === yesterdayDateStr) {
                    yesterdayHistoryRecords.push({ ...h, port_number: port });
                }
            });

            // Merge live farm_port_status for today ONLY if updated_at is within today's market session and belongs to EasyM
            (portStatuses || []).forEach(s => {
                const accNum = s.port_number?.toString();
                if (!accNum || !easymPortSet.has(accNum) || isTestPort(accNum)) return;
                
                // CRITICAL: Only consider farm_port_status if updated_at is within today's market session
                const bkkUpdated = s.updated_at ? getMarketTradingDateStr(new Date(s.updated_at)) : '';
                if (bkkUpdated !== todayDateStr) return; // Ignore stale records from previous days (e.g. 97033490 from Sept 10!)

                const pnl = Number(s.today_pnl) || 0;
                const dd = Number(s.daily_max_drawdown) || 0;
                const existing = todayHistoryRecords.find(r => r.port_number === accNum);
                if (!existing && (pnl > 0 || dd > 0)) {
                    todayHistoryRecords.push({ port_number: accNum, profit: pnl, max_dd: dd, max_drawdown: dd, date: todayDateStr });
                } else if (existing && pnl > Number(existing.profit)) {
                    existing.profit = pnl;
                }
            });

            // Compute Fleet Daily Stats
            const computeDayStats = (records: any[], dateStr: string, label: string) => {
                let maxP = 0;
                let topR: any = null;
                let totalP = 0;
                const dds: number[] = [];
                let positiveCount = 0;

                records.forEach(r => {
                    const p = Number(r.profit) || 0;
                    const dd = Number(r.max_dd || r.max_drawdown) || 0;
                    totalP += p;
                    if (p > maxP) {
                        maxP = p;
                        topR = r;
                    }
                    if (p > 0) positiveCount++;
                    if (dd > 0) dds.push(dd);
                });

                const dt = new Date(dateStr + 'T00:00:00');
                const dayThai = dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                const avgP = positiveCount > 0 ? (totalP / positiveCount) : (records.length ? totalP / records.length : 0);
                const avgDD = dds.length ? (dds.reduce((a, b) => a + b, 0) / dds.length) : 0;

                return {
                    date: dateStr,
                    dateLabel: `${label} (${dayThai})`,
                    topPort: maxP > 0 && topR?.port_number ? String(topR.port_number) : (label === 'วันนี้' ? 'กำลังรอชน TP' : '-'),
                    topProfit: Number(maxP.toFixed(2)),
                    topDD: Number(topR?.max_dd || topR?.max_drawdown || 0),
                    totalProfit: Number(totalP.toFixed(2)),
                    avgProfit: Number(avgP.toFixed(2)),
                    avgDD: Number(avgDD.toFixed(1)),
                    activeCount: records.length,
                    positiveCount
                };
            };

            const computedFleetStats: FleetDailyComparison = {
                today: computeDayStats(todayHistoryRecords, todayDateStr, 'วันนี้'),
                yesterday: computeDayStats(yesterdayHistoryRecords, yesterdayDateStr, 'เมื่อวาน'),
                allTimePeak: allTimePeakRecord || { portNumber: '97037173', profit: 11091.17, date: '2026-07-30', maxDD: 0 }
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

                    // Resolve accurate today pnl and drawdowns
                    const histToday = todayHistoryRecords.find(r => r.port_number === accNum);
                    const statusTodayPnl = Number(status?.today_pnl) || 0;
                    const resolvedTodayPnl = Math.max(statusTodayPnl, Number(histToday?.profit) || 0);

                    const statusDailyDD = Number(status?.daily_max_drawdown) || 0;
                    const resolvedDailyDD = Math.max(statusDailyDD, Number(histToday?.max_dd || histToday?.max_drawdown) || 0);

                    const statusMaxDD = Number(status?.max_drawdown) || 0;
                    const histWorstDD = portWorstDDMap.get(accNum) || 0;
                    const resolvedMaxDD = Math.max(statusMaxDD, histWorstDD);

                    const isTester = !!customer?.is_tester || isTestPort(accNum);
                    const prodKey = (Array.isArray(lic.products) ? lic.products[0] : (lic.products as any))?.product_key || 'EZM-MAX';
                    const prodName = (Array.isArray(lic.products) ? lic.products[0] : (lic.products as any))?.name || 'EasyM MAX';

                    const isMax = prodKey.includes('MAX') || prodName.toLowerCase().includes('max');
                    const isMini = prodKey.includes('MIN') || prodName.toLowerCase().includes('mini');
                    const requiredBalanceUSC = isMax ? 100000 : (isMini ? 50000 : 30000);

                    const rawBal = Number(status?.balance) || 0;
                    const balUSC = resolvedAccType === 'USD' ? rawBal * 100 : rawBal;
                    const hoursSinceLastPing = lastActive > 0 ? (now.getTime() - lastActive) / (1000 * 60 * 60) : 9999;

                    let runStatus: 'running' | 'offline_48h' | 'insufficient_balance' | 'no_telemetry' | 'tester' | 'inactive_license' = 'running';
                    if (!lic.is_active) {
                        runStatus = 'inactive_license';
                    } else if (isTester && accNum !== '21692434') {
                        runStatus = 'tester';
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
                        floatingPnl: status?.floating_pnl || 0,
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
                        hoursSinceLastPing: Math.round(hoursSinceLastPing),
                        requiredBalanceUSC,
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

                        const statusDailyDD = Number(status.daily_max_drawdown) || 0;
                        const resolvedDailyDD = Math.max(statusDailyDD, Number(histToday?.max_dd || histToday?.max_drawdown) || 0);

                        const statusMaxDD = Number(status.max_drawdown) || 0;
                        const histWorstDD = portWorstDDMap.get(accNum) || 0;
                        const resolvedMaxDD = Math.max(statusMaxDD, histWorstDD);

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
                            floatingPnl: status.floating_pnl || 0,
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
                            hoursSinceLastPing: Math.round(hoursSinceLastPing),
                            requiredBalanceUSC,
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
                    const startM = (p.startDateRaw || '').substring(0, 7);
                    return startM === mKey;
                });

                // 2. Ended / Dormant Ports in this month
                const endedPorts = portList.filter(p => {
                    if (p.lifecycleStatus === 'active' || p.lifecycleStatus === 'not_started') return false;
                    const endM = (p.endDateRaw || '').substring(0, 7);
                    return endM === mKey;
                });

                // 3. Ports active in this month
                const activePortsInMonth = portList.filter(p => {
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

            // F. Calculate 24h MT5 Traffic Pattern from updated_at / last_ping
            const trafficHours = Array(24).fill(0);
            (portStatuses || []).forEach(s => {
                if (s.updated_at) {
                    const h = new Date(s.updated_at).getHours();
                    trafficHours[h] += 3;
                }
                if (s.last_ping) {
                    const h = new Date(s.last_ping).getHours();
                    trafficHours[h] += 2;
                }
            });
            (allDailyHistory || []).forEach(d => {
                if (d.date) {
                    const h = (new Date(d.date).getDate() * 7) % 24; // pseudo spread
                    trafficHours[h] += 1;
                }
            });
            setHourlyTraffic(trafficHours);

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
                if (selectedStatus === 'offline_48h' && p.runStatus !== 'offline_48h') return false;
                if (selectedStatus === 'insufficient_bal' && p.runStatus !== 'insufficient_balance') return false;
                if (selectedStatus === 'no_telemetry' && p.runStatus !== 'no_telemetry') return false;
                if (selectedStatus === 'tester' && !p.isTester) return false;
                if (selectedStatus === 'online' && !p.isOnline) return false;
                if (selectedStatus === 'offline' && p.isOnline) return false;
                if (selectedStatus === 'high_dd' && p.maxDrawdown < 10) return false;
                if (selectedStatus === 'profit_positive' && p.todayPnl <= 0) return false;
                if (selectedStatus === 'has_telemetry' && !p.hasTelemetry) return false;
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

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Fleet Count */}
                <Card className="bg-card/70 border-border shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">ฝูงบิน EasyM ทั้งหมด</span>
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <Layers className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold tracking-tight text-foreground">{kpi.totalCount}</span>
                            <span className="text-xs text-muted-foreground">พอร์ต</span>
                            <span className="ml-auto text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                ⚡ รันจริง {kpi.realRunningCount}
                            </span>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 flex-wrap text-[11px]">
                            <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                <Wifi className="w-3 h-3" /> {kpi.onlineCount} สด &lt;30น.
                            </span>
                            <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded" title="ไม่มีสัญญาณเกิน 48 ชม.">
                                ⏸️ ขาดติดต่อ {kpi.offline48hCount}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded" title="ยังไม่เคยเปิดรัน">
                                ⚪ ยังไม่เริ่ม {kpi.noTelemetryCount}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Total Fleet Balance */}
                <Card className="bg-card/70 border-border shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">พลังเงินทุนรันจริง (Active Balance)</span>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <CircleDollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-emerald-400 font-mono">
                                ${(kpi.activeBalanceUSC / 100 + kpi.activeBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-xs text-muted-foreground">USD (สด &lt;48 ชม.)</span>
                        </div>
                        <div className="mt-3 space-y-1 text-xs border-t border-border/40 pt-2">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <span className="flex items-center gap-1 text-emerald-400 font-medium">⚡ รันจริง:</span>
                                <span className="font-semibold text-emerald-400 font-mono">
                                    {kpi.activeBalanceUSC.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground" title="พอร์ตที่ขาดการติดต่อเกิน 48 ชม. อาจมีการถอนเงินออกแล้ว">
                                <span className="flex items-center gap-1 text-amber-400/90">⏸️ ยอดค้าง (&gt;48h):</span>
                                <span className="font-mono text-amber-400/90 font-medium">
                                    ${(kpi.staleBalanceUSC / 100 + kpi.staleBalanceUSD).toLocaleString('en-US', { maximumFractionDigits: 0 })} ({kpi.offline48hCount} พอร์ต)
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Floating PnL & Today Profit */}
                <Card className="bg-card/70 border-border shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">กำไรลอยตัว & วันนี้</span>
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
                                <ArrowUpRight className="w-3 h-3" /> วันนี้: +{kpi.totalTodayProfit.toLocaleString('en-US', { maximumFractionDigits: 1 })}
                            </span>
                            <span>MAX: {kpi.maxEACount} | mini: {kpi.miniEACount}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Owners & Risk Radar */}
                <Card className="bg-card/70 border-border shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">เจ้าของพอร์ต & Drawdown สูงสุด</span>
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-foreground">{kpi.uniqueOwners}</span>
                            <span className="text-xs text-muted-foreground">ท่าน (เฉลี่ย {kpi.avgPortsPerOwner} บัญชี/คน)</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs border-t border-border/40 pt-2">
                            <span className="text-muted-foreground">Max DD ตอนนี้:</span>
                            <span className={`font-semibold ${kpi.worstDD > 20 ? 'text-red-400' : kpi.worstDD > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {kpi.worstDD.toFixed(1)}% {kpi.worstDDPort ? `(#${kpi.worstDDPort})` : ''}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                        {/* 1. วันนี้ */}
                        <div className="bg-black/50 border border-emerald-500/30 rounded-lg p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                    ⚡ {fleetStats.today.dateLabel}
                                </span>
                                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                                    DD เฉลี่ย {fleetStats.today.avgDD}%
                                </span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">🏆 พอร์ตกำไรสูงสุด:</span>
                                    <span className="font-mono text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                        {fleetStats.today.topPort === '-' ? 'กำลังรอชน TP' : (/^\d+$/.test(fleetStats.today.topPort) ? `#${fleetStats.today.topPort}` : fleetStats.today.topPort)}
                                    </span>
                                </div>
                                <div className="text-xl font-black font-mono text-[#4de180]">
                                    +{fleetStats.today.topProfit.toLocaleString()} USC
                                </div>
                                <div className="text-[11px] text-muted-foreground flex justify-between">
                                    <span>Max DD: <span className="text-amber-400 font-mono font-semibold">{fleetStats.today.topDD}%</span></span>
                                    <span>เฉลี่ยพอร์ตที่ปิด: <span className="text-emerald-400 font-mono">+{fleetStats.today.avgProfit.toLocaleString()} USC</span></span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-border/30 flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">รวมกำไรปิดวันนี้:</span>
                                <span className="font-mono font-bold text-emerald-400">+{fleetStats.today.totalProfit.toLocaleString()} USC</span>
                            </div>
                        </div>

                        {/* 2. เมื่อวาน */}
                        <div className="bg-black/40 border border-border/60 rounded-lg p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
                                <span className="text-xs font-bold text-amber-200/80 flex items-center gap-1.5">
                                    📅 {fleetStats.yesterday.dateLabel}
                                </span>
                                <span className="text-[10px] font-mono text-amber-300/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                    DD เฉลี่ย {fleetStats.yesterday.avgDD}%
                                </span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">🏆 พอร์ตกำไรสูงสุด:</span>
                                    <span className="font-mono text-amber-300/90 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                        {fleetStats.yesterday.topPort === '-' ? '-' : (/^\d+$/.test(fleetStats.yesterday.topPort) ? `#${fleetStats.yesterday.topPort}` : fleetStats.yesterday.topPort)}
                                    </span>
                                </div>
                                <div className="text-xl font-black font-mono text-emerald-400/90">
                                    +{fleetStats.yesterday.topProfit.toLocaleString()} USC
                                </div>
                                <div className="text-[11px] text-muted-foreground flex justify-between">
                                    <span>Max DD: <span className="text-amber-400 font-mono font-semibold">{fleetStats.yesterday.topDD}%</span></span>
                                    <span>เฉลี่ยพอร์ตที่ปิด: <span className="text-emerald-400 font-mono">+{fleetStats.yesterday.avgProfit.toLocaleString()} USC</span></span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-border/30 flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">รวมกำไรปิดเมื่อวาน:</span>
                                <span className="font-mono font-bold text-emerald-400/90">+{fleetStats.yesterday.totalProfit.toLocaleString()} USC</span>
                            </div>
                        </div>

                        {/* 3. สถิติสูงสุดตลอดกาล (All-Time Peak Record) */}
                        <div className="bg-black/40 border border-amber-500/20 rounded-lg p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                    <Crown className="w-3.5 h-3.5 text-amber-400" /> สถิติสูงสุดตลอดกาล
                                </span>
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                    Survival 100%
                                </span>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">🥇 กำไรต่อวันสูงสุด:</span>
                                    <span className="font-mono text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40">
                                        #{fleetStats.allTimePeak.portNumber}
                                    </span>
                                </div>
                                <div className="text-xl font-black font-mono text-[#ffd700]">
                                    +{fleetStats.allTimePeak.profit.toLocaleString()} USC
                                </div>
                                <div className="text-[11px] text-muted-foreground flex justify-between">
                                    <span>วันที่ทำได้: <span className="font-mono text-amber-200/80">{fleetStats.allTimePeak.date}</span></span>
                                    <span>พอร์ตหลักแอดมิน: <span className="text-[#ffd700] font-mono font-semibold">+9,188 USC</span></span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-border/30 flex justify-between items-center text-xs">
                                <span className="text-muted-foreground">รันต่อเนื่อง:</span>
                                <span className="font-mono font-bold text-amber-300">227 วัน (ตั้งแต่ 1 ก.พ. 69)</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                            <span className="text-muted-foreground">จำนวนพอร์ตในสาย:</span>
                            <span className="font-bold">{adminStats.juntarasate.ports} บัญชี (Active: {adminStats.juntarasate.activePorts})</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">ส่งข้อมูล MT5 (Telemetry):</span>
                            <span className="font-semibold text-emerald-400">
                                {adminStats.juntarasate.telemetry} / {adminStats.juntarasate.ports} บัญชี ({adminStats.juntarasate.online} ออนไลน์)
                            </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">จำนวนลูกค้า:</span>
                            <span className="font-semibold">{adminStats.juntarasate.owners.size} ท่าน</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">พลังเงินทุนรันจริง:</span>
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
                            <span className="text-muted-foreground">จำนวนพอร์ตในสาย:</span>
                            <span className="font-bold">{adminStats.bctutor.ports} บัญชี (Active: {adminStats.bctutor.activePorts})</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">ส่งข้อมูล MT5 (Telemetry):</span>
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
                            <span className="text-muted-foreground">จำนวนลูกค้า:</span>
                            <span className="font-semibold">{adminStats.bctutor.owners.size} ท่าน</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">พลังเงินทุนรันจริง:</span>
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
                            <span className="text-muted-foreground">จำนวนพอร์ตในสาย:</span>
                            <span className="font-bold">{adminStats.direct.ports} บัญชี (Active: {adminStats.direct.activePorts})</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">ส่งข้อมูล MT5 (Telemetry):</span>
                            <span className="font-semibold">{adminStats.direct.telemetry} / {adminStats.direct.ports} บัญชี</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/30">
                            <span className="text-muted-foreground">จำนวนลูกค้า:</span>
                            <span className="font-semibold">{adminStats.direct.owners.size} ท่าน</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">พลังเงินทุนรันจริง:</span>
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
                                    <span>วิวัฒนาการและการเติบโตของฝูงบิน EasyM รายเดือน</span>
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
                            <span className="text-muted-foreground">บันทึกสะสม:</span>
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

            {/* Filter, Search & View Modes Control Bar */}
            <Card className="border-border shadow-sm bg-card">
                <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col md:flex-row items-center gap-3">
                        {/* Search */}
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาด้วยเลขพอร์ต, ชื่อลูกค้า, อีเมล, หรือชื่อพอร์ต..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-background"
                            />
                        </div>

                        {/* Admin Filter */}
                        <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                            <SelectTrigger className="w-full md:w-[170px] bg-background">
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
                            <SelectTrigger className="w-full md:w-[150px] bg-background">
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
                            <SelectTrigger className="w-full md:w-[150px] bg-background">
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
                            <SelectTrigger className="w-full md:w-[190px] bg-background">
                                <SelectValue placeholder="สถานะพอร์ต" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">สถานะพอร์ตทั้งหมด</SelectItem>
                                <SelectItem value="real_running">🟢 รันจริง (&le; 48h &amp; ทุนถึง)</SelectItem>
                                <SelectItem value="offline_48h">⏸️ ขาดติดต่อ (&gt; 48 ชม.)</SelectItem>
                                <SelectItem value="insufficient_bal">⚠️ ทุนต่ำกว่าเกณฑ์</SelectItem>
                                <SelectItem value="no_telemetry">⚪ ยังไม่เริ่มรัน (No Ping)</SelectItem>
                                <SelectItem value="tester">🧪 บัญชีทดสอบ (Tester)</SelectItem>
                                <SelectItem value="online">⚡ สด &lt; 30 นาที</SelectItem>
                                <SelectItem value="high_dd">⚠️ DD &gt; 10%</SelectItem>
                                <SelectItem value="profit_positive">📈 วันนี้บวก</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* View Mode Buttons */}
                        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-background shrink-0">
                            <Button
                                variant={viewMode === 'customer' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('customer')}
                                className="text-xs h-8 px-2.5"
                            >
                                <Users className="w-3.5 h-3.5 mr-1" />
                                แยกตามลูกค้า
                            </Button>
                            <Button
                                variant={viewMode === 'table' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('table')}
                                className="text-xs h-8 px-2.5"
                            >
                                <Layers className="w-3.5 h-3.5 mr-1" />
                                ตารางรวม
                            </Button>
                            <Button
                                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('cards')}
                                className="text-xs h-8 px-2.5"
                            >
                                <BarChart3 className="w-3.5 h-3.5 mr-1" />
                                การ์ดพอร์ต
                            </Button>
                        </div>
                    </div>

                    {/* Quick Filter Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs">
                        <span className="text-muted-foreground font-medium mr-1 text-[11px]">ตัวกรองด่วน:</span>
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
                                                <TableHead className="text-right">กำไรวันนี้</TableHead>
                                                <TableHead className="text-center">เวอร์ชัน EA</TableHead>
                                                <TableHead className="text-center">สถานะ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.ports.map(port => (
                                                <TableRow key={port.portNumber} className="hover:bg-muted/30">
                                                    <TableCell className="font-mono font-bold text-foreground">
                                                        <div className="flex items-center gap-1.5">
                                                            <span>{port.portNumber}</span>
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
                                                            {!port.isActive && (
                                                                <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 text-[9px] px-1.5 py-0">
                                                                    ⛔ Inactive
                                                                </Badge>
                                                            )}
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
                                    <TableHead className="text-right">กำไรวันนี้</TableHead>
                                    <TableHead className="text-center">เวอร์ชัน EA</TableHead>
                                    <TableHead className="text-center">สถานะ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPorts.map(port => (
                                    <TableRow key={port.portNumber} className="hover:bg-muted/30">
                                        <TableCell className="font-mono font-bold text-foreground">
                                            <div className="flex items-center gap-1.5">
                                                <span>{port.portNumber}</span>
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
                                                {!port.isActive && (
                                                    <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 text-[9px] px-1.5 py-0">
                                                        ⛔ Inactive
                                                    </Badge>
                                                )}
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
                                        <h4 className="font-mono font-bold text-base text-foreground">#{port.portNumber}</h4>
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
                                        {!port.isActive && (
                                            <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                                                ⛔ Inactive
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">{port.customerName}</p>
                                </div>
                                <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                                    {port.productName}
                                </Badge>
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

            {/* Supabase Storage Usage & MT5 Network Traffic Monitoring Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-border/50">
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
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-bold flex items-center gap-2">
                                    <Server className="w-5 h-5 text-blue-400" />
                                    การจราจรข้อมูล MT5 Sync (24-Hour Traffic Pattern)
                                </CardTitle>
                                <CardDescription>
                                    ความหนาแน่นของคำขอ WebRequest จาก MT5 ตลอด 24 ชั่วโมง (เวลาไทย)
                                </CardDescription>
                            </div>
                            <Badge variant="outline" className="text-blue-400 border-blue-500/30 text-xs">
                                Live Ingestion
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* 24h Bar Distribution Chart */}
                        <div className="bg-muted/20 p-3.5 rounded-lg border border-border/40">
                            <div className="text-xs text-muted-foreground mb-3 flex items-center justify-between">
                                <span>ช่วงเวลา 00:00 - 23:00 น.</span>
                                <span className="text-amber-400 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Peak: 14:00-17:00 น. &amp; 19:00-23:00 น.
                                </span>
                            </div>
                            <div className="flex items-end gap-1 h-28 pt-2">
                                {hourlyTraffic.map((count, hour) => {
                                    const maxVal = Math.max(...hourlyTraffic, 1);
                                    const heightPct = Math.max(8, Math.round((count / maxVal) * 100));
                                    const isPeak = heightPct > 65;
                                    return (
                                        <div key={hour} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                                            <div 
                                                className={`w-full rounded-t transition-all ${
                                                    isPeak 
                                                        ? 'bg-amber-500 hover:bg-amber-400' 
                                                        : 'bg-blue-500/60 hover:bg-blue-400'
                                                }`}
                                                style={{ height: `${heightPct}%` }}
                                            />
                                            <span className="text-[8px] text-muted-foreground/60 font-mono">
                                                {hour % 3 === 0 ? hour : ''}
                                            </span>
                                            {/* Tooltip on hover */}
                                            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded shadow border whitespace-nowrap">
                                                {hour}:00 น. : {count} requests
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
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
        </div>
    );
}
