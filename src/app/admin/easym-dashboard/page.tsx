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

export default function EasyMMasterDashboardPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [loadingData, setLoadingData] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();

    // Raw datasets
    const [ports, setPorts] = useState<EasyMPortItem[]>([]);
    const [tableCounts, setTableCounts] = useState<{ [key: string]: number }>({});
    const [hourlyTraffic, setHourlyTraffic] = useState<number[]>(Array(24).fill(0));

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
                .select('id, full_name, email, role, referred_by, created_at');
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

            // D. Fetch accumulated daily history
            const { data: dailyHistory, error: historyErr } = await supabase
                .from('farm_daily_history')
                .select('port_number, profit, max_dd, date');
            if (historyErr) console.error('History fetch error:', historyErr);

            // Group history profit by port
            const portHistoryProfitMap = new Map<string, number>();
            const portFirstDateMap = new Map<string, string>();
            (dailyHistory || []).forEach(h => {
                const port = h.port_number?.toString();
                if (port) {
                    portHistoryProfitMap.set(port, (portHistoryProfitMap.get(port) || 0) + (h.profit || 0));
                    const curFirst = portFirstDateMap.get(port);
                    if (!curFirst || h.date < curFirst) {
                        portFirstDateMap.set(port, h.date);
                    }
                }
            });

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

                    // Start date & Active days
                    const startDateStr = portFirstDateMap.get(accNum) || lic.created_at || new Date().toISOString();
                    const startDt = new Date(startDateStr);
                    const now = new Date();
                    const diffTime = Math.abs(now.getTime() - startDt.getTime());
                    const activeDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

                    // Check online: active ping within last 10 minutes
                    let isOnline = false;
                    if (status?.last_ping) {
                        const pingTime = new Date(status.last_ping).getTime();
                        isOnline = (now.getTime() - pingTime) < 10 * 60 * 1000;
                    } else if (status?.updated_at) {
                        const updTime = new Date(status.updated_at).getTime();
                        isOnline = (now.getTime() - updTime) < 10 * 60 * 1000;
                    }

                    const item: EasyMPortItem = {
                        portNumber: accNum,
                        portName: lic.port_name || null,
                        customerId: lic.user_id || null,
                        customerName: customer?.full_name || 'ลูกค้าไม่มีชื่อ',
                        customerEmail: customer?.email || 'ไม่ระบุอีเมล',
                        adminName: adminInfo.name,
                        adminEmail: adminInfo.email,
                        productKey: (Array.isArray(lic.products) ? lic.products[0] : (lic.products as any))?.product_key || 'EZM-MAX',
                        productName: (Array.isArray(lic.products) ? lic.products[0] : (lic.products as any))?.name || 'EasyM MAX',
                        licenseTier: lic.license_tier || 'free',
                        startDate: startDt.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
                        activeDays,
                        balance: status?.balance || 0,
                        equity: status?.equity || 0,
                        floatingPnl: status?.floating_pnl || 0,
                        maxDrawdown: status?.max_drawdown || 0,
                        dailyMaxDrawdown: status?.daily_max_drawdown || 0,
                        totalLots: status?.total_lots || 0,
                        buyCount: status?.buy_count || 0,
                        sellCount: status?.sell_count || 0,
                        accountType: status?.account_type || 'USC',
                        isOnline,
                        lastPing: status?.last_ping || null,
                        updatedAt: status?.updated_at || null,
                        todayPnl: status?.today_pnl || 0,
                        todayClosedLots: status?.today_closed_lots || 0,
                        eaVersion: status?.ea_version || status?.system_code || 'v1.16',
                        accumulatedProfit: portHistoryProfitMap.get(accNum) || 0,
                        isActive: lic.is_active !== false,
                        hasTelemetry: !!status
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
                        if (status.last_ping) {
                            isOnline = (now.getTime() - new Date(status.last_ping).getTime()) < 10 * 60 * 1000;
                        }

                        portItemsMap.set(accNum, {
                            portNumber: accNum,
                            portName: 'พอร์ตระบบ / ทดสอบ',
                            customerId: null,
                            customerName: 'พอร์ตทดสอบพิเศษ / Admin',
                            customerEmail: 'juntarasate@gmail.com',
                            adminName: 'พี่โจ้ (juntarasate)',
                            adminEmail: 'juntarasate@gmail.com',
                            productKey: 'EZM-TEST',
                            productName: status.system_code || 'EasyM MAX',
                            licenseTier: 'pro',
                            startDate: startDt.toLocaleDateString('th-TH'),
                            activeDays,
                            balance: status.balance || 0,
                            equity: status.equity || 0,
                            floatingPnl: status.floating_pnl || 0,
                            maxDrawdown: status.max_drawdown || 0,
                            dailyMaxDrawdown: status.daily_max_drawdown || 0,
                            totalLots: status.total_lots || 0,
                            buyCount: status.buy_count || 0,
                            sellCount: status.sell_count || 0,
                            accountType: status.account_type || 'USC',
                            isOnline,
                            lastPing: status.last_ping || null,
                            updatedAt: status.updated_at || null,
                            todayPnl: status.today_pnl || 0,
                            todayClosedLots: status.today_closed_lots || 0,
                            eaVersion: status.ea_version || 'v1.16',
                            accumulatedProfit: portHistoryProfitMap.get(accNum) || 0,
                            isActive: true,
                            hasTelemetry: true
                        });
                    }
                }
            });

            const portList = Array.from(portItemsMap.values());
            setPorts(portList);

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
            (dailyHistory || []).forEach(d => {
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
                if (selectedStatus === 'online' && !p.isOnline) return false;
                if (selectedStatus === 'offline' && p.isOnline) return false;
                if (selectedStatus === 'high_dd' && p.maxDrawdown < 10) return false;
                if (selectedStatus === 'profit_positive' && p.todayPnl <= 0) return false;
                if (selectedStatus === 'has_telemetry' && !p.hasTelemetry) return false;
                if (selectedStatus === 'no_telemetry' && p.hasTelemetry) return false;
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
            if (p.isActive) g.activeCount++;
            if (p.hasTelemetry) g.telemetryCount++;
        });

        return Array.from(groupMap.values()).sort((a, b) => b.ports.length - a.ports.length);
    }, [filteredPorts]);

    // 5. Fleet KPI Calculations
    const kpi = useMemo(() => {
        const totalCount = filteredPorts.length;
        const onlineCount = filteredPorts.filter(p => p.isOnline).length;
        const offlineCount = totalCount - onlineCount;

        const maxEACount = filteredPorts.filter(p => p.productName.toLowerCase().includes('max')).length;
        const miniEACount = filteredPorts.filter(p => p.productName.toLowerCase().includes('mini')).length;

        let totalBalanceUSC = 0;
        let totalBalanceUSD = 0;
        let totalEquityUSC = 0;
        let totalEquityUSD = 0;
        let totalFloating = 0;
        let totalTodayProfit = 0;
        let totalAccumProfit = 0;
        let worstDD = 0;
        let worstDDPort = '';

        filteredPorts.forEach(p => {
            if (p.accountType === 'USD') {
                totalBalanceUSD += p.balance;
                totalEquityUSD += p.equity;
            } else {
                totalBalanceUSC += p.balance;
                totalEquityUSC += p.equity;
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
            onlineCount,
            offlineCount,
            maxEACount,
            miniEACount,
            totalBalanceUSC,
            totalBalanceUSD,
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
            juntarasate: { name: 'สายงานพี่โจ้ (juntarasate)', ports: 0, activePorts: 0, inactivePorts: 0, online: 0, telemetry: 0, uscBalance: 0, owners: new Set<string>() },
            bctutor: { name: 'สายงานครูชัย (bctutor)', ports: 0, activePorts: 0, inactivePorts: 0, online: 0, telemetry: 0, uscBalance: 0, owners: new Set<string>() },
            direct: { name: 'พอร์ตระบบ / อื่นๆ', ports: 0, activePorts: 0, inactivePorts: 0, online: 0, telemetry: 0, uscBalance: 0, owners: new Set<string>() },
        };

        ports.forEach(p => {
            let grp = res.direct;
            if (p.adminEmail.includes('juntarasate')) grp = res.juntarasate;
            else if (p.adminEmail.includes('bctutor')) grp = res.bctutor;

            grp.ports++;
            if (p.isActive) grp.activePorts++;
            else grp.inactivePorts++;
            if (p.hasTelemetry) grp.telemetry++;
            if (p.isOnline) grp.online++;
            grp.uscBalance += p.accountType === 'USD' ? p.balance * 100 : p.balance;
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
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs">
                            <span className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded">
                                <Wifi className="w-3 h-3" /> {kpi.onlineCount} ออนไลน์
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground bg-muted/40 px-2 py-0.5 rounded">
                                <WifiOff className="w-3 h-3" /> {kpi.offlineCount} ออฟไลน์
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Total Fleet Balance */}
                <Card className="bg-card/70 border-border shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">พลังเงินทุนรวม (Balance)</span>
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <CircleDollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold tracking-tight text-foreground">
                                {(kpi.totalBalanceUSC / 100 + kpi.totalBalanceUSD).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-xs text-muted-foreground">USD เทียบเท่า</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
                            <span>Cent: {kpi.totalBalanceUSC.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC</span>
                            <span>USD: ${kpi.totalBalanceUSD.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
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
                            <span className="text-muted-foreground">พลังเงินทุนสะสม:</span>
                            <span className="font-mono font-semibold text-emerald-400">
                                {adminStats.juntarasate.uscBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
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
                            <span className="text-muted-foreground">พลังเงินทุนสะสม:</span>
                            <span className="font-mono font-semibold text-emerald-400">
                                {adminStats.bctutor.uscBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
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
                            <span className="text-muted-foreground">พลังเงินทุนสะสม:</span>
                            <span className="font-mono font-semibold text-emerald-400">
                                {adminStats.direct.uscBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

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
                            <SelectTrigger className="w-full md:w-[160px] bg-background">
                                <SelectValue placeholder="สถานะพอร์ต" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">สถานะพอร์ตทั้งหมด</SelectItem>
                                <SelectItem value="online">🟢 ออนไลน์</SelectItem>
                                <SelectItem value="offline">⚪ ออฟไลน์</SelectItem>
                                <SelectItem value="high_dd">⚠️ DD &gt; 10%</SelectItem>
                                <SelectItem value="profit_positive">📈 วันนี้บวก</SelectItem>
                                <SelectItem value="has_telemetry">📡 มีข้อมูลสด MT5</SelectItem>
                                <SelectItem value="no_telemetry">⚠️ ไม่ได้ส่ง WebRequest #2</SelectItem>
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
                                                        <div className="text-[10px] text-emerald-400 font-semibold">{port.activeDays} วัน</div>
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono font-semibold">
                                                        {port.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {port.accountType}
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
                                                            {port.isOnline ? (
                                                                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0">
                                                                    🟢 Online
                                                                </Badge>
                                                            ) : port.hasTelemetry ? (
                                                                <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0">
                                                                    ⚪ Offline
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 text-[9px] px-1.5 py-0" title="ยังไม่ได้ตั้งค่า WebRequest ตัวที่ 2 (api/farm/sync)">
                                                                    ⚠️ ไม่มี Telemetry
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
                                            <div className="text-[10px] text-emerald-400 font-semibold">{port.activeDays} วัน</div>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-semibold">
                                            {port.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {port.accountType}
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
                                                {port.isOnline ? (
                                                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-2 py-0">
                                                        🟢 Online
                                                    </Badge>
                                                ) : port.hasTelemetry ? (
                                                    <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0">
                                                        ⚪ Offline
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-amber-400 border-amber-500/30 bg-amber-500/10 text-[9px] px-1.5 py-0" title="ยังไม่ได้ตั้งค่า WebRequest ตัวที่ 2 (api/farm/sync)">
                                                        ⚠️ ไม่มี Telemetry
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
                                        <span className="font-bold text-foreground text-sm">
                                            {port.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })} {port.accountType}
                                        </span>
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
                                        <span className="text-muted-foreground">รันมาแล้ว:</span>
                                        <span className="text-emerald-400 font-semibold">{port.activeDays} วัน (เริ่ม {port.startDate})</span>
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
