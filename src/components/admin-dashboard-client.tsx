'use client';

import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    CreditCard,
    Users,
    Search,
    ArrowUpDown,
    Download,
    MoreVertical,
    FileText,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    Clock,
    User
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminDashboardCharts } from './admin-dashboard-charts';
import { AdminInsightCharts } from './admin-insight-charts';

interface Product {
    id: string;
    name: string;
    version: string;
    price_lifetime: number;
    price_monthly: number;
    image_url: string;
    platform: string;
    asset_class: string;
    category: string;
}

interface DashboardStats {
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    activeLicenses: number;
}

interface ProductMetric {
    productId: string;
    salesCount: number;
    revenue: number;
    activeLicenses: number;
}

interface LicenseWithProfile {
    id: string;
    product_id: string;
    user_id: string;
    is_active: boolean;
    expiry_date: string;
    account_number: string;
    product_name?: string;
    profile?: {
        email: string;
        full_name: string;
    };
}

interface TopUser {
    userId: string;
    email: string;
    fullName: string;
    activeLicensesCount: number;
    totalSpent: number;
}

interface Broker {
    id: string;
    name: string;
    owner_id: string;
    ib_link?: string;
}

interface IbMembership {
    id: string;
    user_id: string;
    broker_id: string;
    status: 'pending' | 'approved' | 'rejected';
    verification_data: string;
    created_at: string;
}

interface PortStatus {
    port_number: string;
    balance: number;
    equity: number;
    margin_level: number;
    account_type: string;
    max_drawdown: number;
    updated_at: string;
}

export function AdminDashboardClient() {
    const [products, setProducts] = useState<Product[]>([]);
    const [stats, setStats] = useState<DashboardStats>({
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        activeLicenses: 0
    });
    const [orders, setOrders] = useState<any[]>([]);
    const [productMetrics, setProductMetrics] = useState<Record<string, ProductMetric>>({});
    const [rawLicenses, setRawLicenses] = useState<LicenseWithProfile[]>([]);
    const [topUsers, setTopUsers] = useState<TopUser[]>([]);
    const [ibMemberships, setIbMemberships] = useState<IbMembership[]>([]);
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [portStatuses, setPortStatuses] = useState<PortStatus[]>([]);
    const [allProfiles, setAllProfiles] = useState<any[]>([]);
    const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map());
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('sales');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('sales-desc');
    const [filterCategory, setFilterCategory] = useState('all');
    const [selectedAdmin, setSelectedAdmin] = useState('all');
    const [availableAdmins, setAvailableAdmins] = useState<string[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Data Client-Side to ensure we use the active session
                const [productsResult, ordersResult, licensesResult, ibResult, brokersResult, portsResult] = await Promise.all([
                    supabase.from('products').select('*').order('created_at', { ascending: false }),
                    supabase.from('orders').select('id, amount, status, product_id, user_id, created_at').order('created_at', { ascending: false }),
                    supabase.from('licenses').select('id, product_id, user_id, is_active, expiry_date, account_number'),
                    supabase.from('ib_memberships').select('*'),
                    supabase.from('brokers').select('*'),
                    supabase.from('farm_port_status').select('*')
                ]);

                const productsData = productsResult.data || [];
                const allOrders = ordersResult.data || [];
                const licensesData = licensesResult.data || [];
                const ibData = ibResult.data || [];
                const brokersData = brokersResult.data || [];
                const portsData = portsResult.data || [];

                // Get ALL profiles so we can build a complete list of referrers (even if their users have no orders yet)
                const { data: profiles } = await supabase.from('profiles')
                    .select('id, email, full_name, role, is_tester, referred_by, referrer:profiles!referred_by(email)');
                
                // Get unique user IDs to iterate over later for Top VIP calculations
                const userIds = Array.from(new Set([
                    ...licensesData.map(l => l.user_id),
                    ...allOrders.map(o => o.user_id)
                ].filter(Boolean)));
                
                const pMap = new Map();
                let adminsSet = new Set<string>();

                (profiles || []).forEach((p: any) => {
                    if (p.role === 'admin' && p.email) adminsSet.add(p.email);
                    pMap.set(p.id, p);
                });

                const getUplineAdmin = (userId: string) => {
                    let current = pMap.get(userId);
                    let visited = new Set();
                    let lastAdmin = null;

                    while (current && !visited.has(current.id)) {
                        visited.add(current.id);

                        // Root Admin Emails
                        const isRoot = current.email === 'juntarasate@gmail.com' || current.email === 'bctutor123@gmail.com';
                        if (isRoot) return current;

                        // Intermediary Admin Check
                        if (current.role === 'admin') {
                            lastAdmin = current;
                        }

                        if (!current.referred_by) break;
                        current = pMap.get(current.referred_by);
                    }
                    return lastAdmin;
                };

                setAvailableAdmins(Array.from(adminsSet));
                setAllProfiles(profiles || []);
                setProfileMap(pMap);

                // Filter out tester data AND filter by selected admin if not 'all'
                const realOrders = allOrders.filter(o => {
                    const profile = profileMap.get(o.user_id);
                    if (profile?.is_tester) return false;
                    const rootAdmin = getUplineAdmin(o.user_id);
                    if (selectedAdmin !== 'all' && rootAdmin?.email !== selectedAdmin) return false;
                    return true;
                });
                const realLicenses = licensesData.filter(l => {
                    const profile = profileMap.get(l.user_id);
                    if (profile?.is_tester) return false;
                    const rootAdmin = getUplineAdmin(l.user_id);
                    if (selectedAdmin !== 'all' && rootAdmin?.email !== selectedAdmin) return false;
                    return true;
                });

                // Filter completed orders (Case Insensitive)
                const completedOrders = realOrders.filter(o => o.status?.toLowerCase() === 'completed');

                // Map Products
                const productMap = new Map(productsData.map(p => [p.id, p]));

                // Enrich Licenses
                const enrichedLicenses: LicenseWithProfile[] = realLicenses.map((l: any) => ({
                    ...l,
                    product_name: productMap.get(l.product_id)?.name || 'Unknown Product',
                    profile: profileMap.get(l.user_id) || { email: 'Unknown', full_name: 'Unknown' }
                }));

                const activeLicensesList = enrichedLicenses.filter(l => l.is_active);

                const activeLicensesCount = activeLicensesList.length;

                // Move totalRevenue and totalOrders calculation to be reactive to timeRange
                // Initialize default stats here
                setStats({
                    totalProducts: productsData.length,
                    totalOrders: completedOrders.length,
                    totalRevenue: completedOrders.reduce((sum, o) => sum + (o.amount || 0), 0),
                    activeLicenses: activeLicensesCount
                });

                setOrders(completedOrders);

                // Calculate Per-Product Metrics
                const metrics: Record<string, ProductMetric> = {};
                productsData.forEach(p => {
                    metrics[p.id] = { productId: p.id, salesCount: 0, revenue: 0, activeLicenses: 0 };
                });

                completedOrders.forEach(o => {
                    if (metrics[o.product_id]) {
                        metrics[o.product_id].salesCount++;
                        metrics[o.product_id].revenue += (o.amount || 0);
                    }
                });

                activeLicensesList.forEach(l => {
                    if (metrics[l.product_id]) {
                        metrics[l.product_id].activeLicenses++;
                    }
                });

                // Calculate Top Users
                const userAgg: Record<string, TopUser> = {};
                userIds.forEach(uid => {
                    if (!uid) return;
                    const p = profileMap.get(uid);
                    userAgg[uid] = {
                        userId: uid,
                        email: p?.email || 'Unknown',
                        fullName: p?.full_name || 'Unknown',
                        activeLicensesCount: 0,
                        totalSpent: 0
                    };
                });

                activeLicensesList.forEach(l => {
                    if (l.user_id && userAgg[l.user_id]) {
                        userAgg[l.user_id].activeLicensesCount++;
                    }
                });

                completedOrders.forEach(o => {
                    if (o.user_id && userAgg[o.user_id]) {
                        userAgg[o.user_id].totalSpent += (o.amount || 0);
                    }
                });

                const topUsersData = Object.values(userAgg)
                    .sort((a, b) => b.totalSpent - a.totalSpent)
                    .slice(0, 50); // Get top 50 VIPs

                setProducts(productsData);
                setProductMetrics(metrics);
                setRawLicenses(enrichedLicenses);
                setTopUsers(topUsersData);
                setIbMemberships(ibData);
                setBrokers(brokersData);
                setPortStatuses(portsData);

            } catch (error) {
                console.error("Failed to fetch admin data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedAdmin]);

    const categories = useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => {
            if (p.asset_class) cats.add(p.asset_class);
            if (p.platform) cats.add(p.platform);
        });
        return Array.from(cats);
    }, [products]);

    // Derived: Expiring Soon
    const expiringLicenses = useMemo(() => {
        const now = new Date();
        const future = new Date();
        future.setDate(future.getDate() + 14); // Next 14 days

        return rawLicenses
            .filter(l => l.is_active && l.expiry_date)
            .filter(l => {
                const expiry = new Date(l.expiry_date);
                return expiry > now && expiry <= future;
            })
            .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
    }, [rawLicenses]);

    const calculateDaysRemaining = (expiryDate: string) => {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // --- Data Mapping Helpers ---
    const accountToUserMap = useMemo(() => {
        const map = new Map();
        rawLicenses.forEach(l => {
            if (l.account_number) map.set(l.account_number, l.user_id);
        });
        return map;
    }, [rawLicenses]);

    // Sales Date Filter Logic
    const [timeRange, setTimeRange] = useState('30d'); // 1d, 3d, 7d, 30d, all

    const filteredSalesOrders = useMemo(() => {
        if (timeRange === 'all') return orders;
        const now = new Date();
        const daysToSubtract = timeRange === '1d' ? 1 : timeRange === '3d' ? 3 : timeRange === '7d' ? 7 : 30;

        // For '1d' (Today), we want orders from the start of today
        if (timeRange === '1d') {
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return orders.filter(o => new Date(o.created_at) >= startOfToday);
        }

        return orders.filter(o => {
            const date = new Date(o.created_at);
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= daysToSubtract;
        });
    }, [orders, timeRange]);

    // Reactive Stats based on filtered orders
    const currentSalesStats = useMemo(() => {
        return {
            totalRevenue: filteredSalesOrders.reduce((sum, o) => sum + (o.amount || 0), 0),
            totalOrders: filteredSalesOrders.length
        };
    }, [filteredSalesOrders]);

    // --- Advanced Stats Calculation ---
    const advancedStats = useMemo(() => {
        // 1. Root Admin Helper (Using the state profileMap)
        const getRootAdminByUserId = (userId: string) => {
            let current = profileMap.get(userId);
            let visited = new Set();
            let lastAdmin = null;
            while (current && !visited.has(current.id)) {
                visited.add(current.id);
                const isRoot = current.email === 'juntarasate@gmail.com' || current.email === 'bctutor123@gmail.com';
                if (isRoot) return current;
                if (current.role === 'admin') lastAdmin = current;
                if (!current.referred_by) break;
                current = profileMap.get(current.referred_by);
            }
            return lastAdmin;
        };

        // 2. Filter data by selectedAdmin
        const getProfilesInNode = (rootAdminEmail: string) => {
            if (rootAdminEmail === 'all') return allProfiles;
            return allProfiles.filter(p => {
                const root = getRootAdminByUserId(p.id);
                return root?.email === rootAdminEmail;
            });
        };

        const currentProfiles = getProfilesInNode(selectedAdmin);
        const currentProfileIds = new Set(currentProfiles.map(p => p.id));

        // 3. IB Statistics
        const currentIbMems = ibMemberships.filter(m => currentProfileIds.has(m.user_id));
        const approvedIbIds = new Set(currentIbMems.filter(m => m.status === 'approved').map(m => m.user_id));
        const pendingIbMems = currentIbMems.filter(m => m.status === 'pending');

        // 4. Port Statistics (Linking via the memoized accountToUserMap)

        const activePortsInScope = portStatuses.filter(p => {
            const ownerId = accountToUserMap.get(p.port_number);
            return currentProfileIds.has(ownerId);
        });

        // Relationship: Ports by User Type
        let ibPortsCount = 0;
        let regularPortsCount = 0;
        let totalEquity = 0;
        let totalBalance = 0;
        let highRiskPortsCount = 0;

        activePortsInScope.forEach(p => {
            const ownerId = accountToUserMap.get(p.port_number);
            if (approvedIbIds.has(ownerId)) ibPortsCount++;
            else regularPortsCount++;

            totalEquity += (p.equity || 0);
            totalBalance += (p.balance || 0);
            if (p.max_drawdown > 20) highRiskPortsCount++;
        });

        // 5. Customer Metrics
        const totalCustomers = currentProfiles.length;
        const IBCount = approvedIbIds.size;
        const regularCount = totalCustomers - IBCount;

        return {
            customer: {
                total: totalCustomers,
                ib: IBCount,
                regular: regularCount,
                pendingIb: pendingIbMems.length
            },
            ports: {
                total: activePortsInScope.length,
                totalEquity,
                totalBalance,
                riskCount: highRiskPortsCount,
                ibLinked: ibPortsCount,
                regularLinked: regularPortsCount
            },
            // Growth or more complex data if needed
            recentIbRequests: pendingIbMems.slice(0, 5)
        };
    }, [allProfiles, profileMap, selectedAdmin, ibMemberships, portStatuses, rawLicenses]);

    // Re-implement currentProductMetrics using the new state logic if needed, 
    // but the old one was fine, let's just make it consistent.
    const currentProductMetrics = useMemo(() => {
        const metrics: Record<string, ProductMetric> = {};
        products.forEach(p => {
            metrics[p.id] = { productId: p.id, salesCount: 0, revenue: 0, activeLicenses: 0 };
        });

        filteredSalesOrders.forEach(o => {
            if (metrics[o.product_id]) {
                metrics[o.product_id].salesCount++;
                metrics[o.product_id].revenue += (o.amount || 0);
            }
        });

        rawLicenses.filter(l => l.is_active).forEach(l => {
            // Check if user is in scope of selected admin
            const ownerRoot = getRootAdminByUserId(l.user_id);
            if (selectedAdmin !== 'all' && ownerRoot?.email !== selectedAdmin) return;

            if (metrics[l.product_id]) {
                metrics[l.product_id].activeLicenses++;
            }
        });

        return metrics;
    }, [filteredSalesOrders, products, rawLicenses, selectedAdmin, profileMap]);

    // Redefine getRootAdminByUserId as a standalone if needed elsewhere or just use it inside useMemo
    const getRootAdminByUserId = (userId: string) => {
        let current = profileMap.get(userId);
        let visited = new Set();
        let lastAdmin = null;
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            const isRoot = current.email === 'juntarasate@gmail.com' || current.email === 'bctutor123@gmail.com';
            if (isRoot) return current;
            if (current.role === 'admin') lastAdmin = current;
            if (!current.referred_by) break;
            current = profileMap.get(current.referred_by);
        }
        return lastAdmin;
    };


    // Filter & Sort Logic
    const filteredProducts = useMemo(() => {
        let result = [...products];

        // 1. Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(p => p.name.toLowerCase().includes(q));
        }

        // 2. Filter
        if (filterCategory !== 'all') {
            result = result.filter(p => p.asset_class === filterCategory || p.platform === filterCategory);
        }

        // 3. Sort
        result.sort((a, b) => {
            const metricsA = currentProductMetrics[a.id] || { salesCount: 0, revenue: 0, activeLicenses: 0 };
            const metricsB = currentProductMetrics[b.id] || { salesCount: 0, revenue: 0, activeLicenses: 0 };

            switch (sortOrder) {
                case 'sales-desc': return metricsB.salesCount - metricsA.salesCount;
                case 'sales-asc': return metricsA.salesCount - metricsB.salesCount;
                case 'revenue-desc': return metricsB.revenue - metricsA.revenue;
                case 'price-desc': return b.price_lifetime - a.price_lifetime;
                case 'price-asc': return a.price_lifetime - b.price_lifetime;
                case 'name-asc': return a.name.localeCompare(b.name);
                default: return 0;
            }
        });

        return result;
    }, [products, searchQuery, filterCategory, sortOrder, currentProductMetrics]);

    if (loading) {
        return (
            <div className="flex h-[50vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Loading dashboard data...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    Admin Command Center
                </h1>
                <p className="text-muted-foreground mt-1">
                    ภาพรวมสถิติและจัดการข้อมูลสินค้าทั้งหมด
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
                <div className="bg-card inline-flex p-1 rounded-xl border border-border/50">
                    <TabsList className="bg-transparent h-auto p-0 gap-1">
                        <TabsTrigger
                            value="customers"
                            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 py-2.5 rounded-lg text-sm font-medium transition-all"
                        >
                            ภาพรวมสมาชิก (Customers)
                        </TabsTrigger>
                        <TabsTrigger
                            value="ports"
                            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 py-2.5 rounded-lg text-sm font-medium transition-all"
                        >
                            สถิติพอร์ต & IB
                        </TabsTrigger>
                        <TabsTrigger
                            value="sales"
                            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 py-2.5 rounded-lg text-sm font-medium transition-all"
                        >
                            รายได้และการขาย (Sales)
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ======================= TAB 1: CUSTOMERS ======================= */}
                <TabsContent value="customers" className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 m-0">
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                        <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                            <SelectTrigger className="w-[200px] bg-background">
                                <SelectValue placeholder="ผู้แนะนำ (Admin)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ลูกค้าทั้งหมดทุกแอดมิน</SelectItem>
                                {availableAdmins.map(admin => (
                                    <SelectItem key={admin} value={admin}>ของ: {admin}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">ลูกค้าทั้งหมด</CardTitle>
                                <Users className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{advancedStats.customer.total}</div>
                                <p className="text-xs text-muted-foreground mt-1">จำนวนสมาชิกในสายงาน</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-green-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">สมาชิก IB (Approved)</CardTitle>
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{advancedStats.customer.ib}</div>
                                <p className="text-xs text-muted-foreground mt-1">ได้รับสิทธิ์ใช้งานฟรีแล้ว</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-blue-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">ลูกค้าทั่วไป (Paid/Other)</CardTitle>
                                <User className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{advancedStats.customer.regular}</div>
                                <p className="text-xs text-muted-foreground mt-1">ลูกค้าที่ไม่ได้ใช้สิทธิ์ IB</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-orange-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">คำขอรออนุมัติ (Pending)</CardTitle>
                                <Clock className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{advancedStats.customer.pendingIb}</div>
                                <p className="text-xs text-muted-foreground mt-1">รอตรวจสอบข้อมูล IB</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* NEW: Insight Charts for Tab 1 */}
                    <AdminInsightCharts 
                        ibMemberships={ibMemberships.filter(m => {
                            const root = getRootAdminByUserId(m.user_id);
                            return selectedAdmin === 'all' || root?.email === selectedAdmin;
                        })} 
                        profiles={allProfiles.filter(p => {
                            const root = getRootAdminByUserId(p.id);
                            return selectedAdmin === 'all' || root?.email === selectedAdmin;
                        })}
                        portStatuses={portStatuses.filter(p => {
                            const ownerId = accountToUserMap.get(p.port_number);
                            const root = getRootAdminByUserId(ownerId);
                            return selectedAdmin === 'all' || root?.email === selectedAdmin;
                        })}
                        selectedAdmin={selectedAdmin}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Table 2: Top Users Replacement for Tab 1 */}
                        <Card className="border-primary/20 shadow-lg shadow-primary/5 overflow-hidden flex flex-col">
                            <CardHeader className="bg-primary/5 pb-4 border-b border-border/50">
                                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                                    <LayoutDashboard className="w-5 h-5 text-primary" />
                                    ผู้ใช้งานสูงสุด (VIP Users)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="px-4 py-3">ลูกค้า</th>
                                            <th className="px-4 py-3 text-center">Licenses</th>
                                            <th className="px-4 py-3 text-right">ยอดใช้จ่ายสะสม</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {topUsers.filter(u => {
                                             const root = getRootAdminByUserId(u.userId);
                                             return selectedAdmin === 'all' || root?.email === selectedAdmin;
                                        }).slice(0, 10).map((user, idx) => (
                                            <tr
                                                key={user.userId}
                                                className="hover:bg-muted/30 cursor-pointer group"
                                                onClick={() => router.push(`/admin/users/${user.userId}`)}
                                            >
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                                                            {idx + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium group-hover:text-primary transition-colors">{user.fullName || user.email}</div>
                                                            {user.fullName && <div className="text-[10px] text-muted-foreground">{user.email}</div>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge variant="secondary" className="font-mono">
                                                        {user.activeLicensesCount}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="font-bold text-green-500">
                                                        ฿{user.totalSpent.toLocaleString()}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>

                        {/* Expiring Soon Table */}
                        <Card className="border-orange-500/20 shadow-lg shadow-orange-500/5 overflow-hidden flex flex-col">
                            <CardHeader className="bg-orange-500/5 pb-4 border-b border-border/50">
                                <CardTitle className="text-lg flex items-center gap-2 text-foreground">
                                    <Clock className="w-5 h-5 text-orange-500" />
                                    สินค้าใกล้หมดอายุ (Top 14-Days)
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 overflow-auto max-h-[500px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="px-4 py-3">User & Account</th>
                                            <th className="px-4 py-3 text-center">สินค้า</th>
                                            <th className="px-4 py-3 text-right">หมดอายุใน</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {expiringLicenses.filter(l => {
                                             const root = getRootAdminByUserId(l.user_id);
                                             return selectedAdmin === 'all' || root?.email === selectedAdmin;
                                        }).slice(0, 10).map((license) => {
                                            const daysLeft = calculateDaysRemaining(license.expiry_date);
                                            return (
                                                <tr
                                                    key={license.id}
                                                    className="hover:bg-muted/30 cursor-pointer"
                                                    onClick={() => router.push(`/admin/users/${license.user_id}`)}
                                                >
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{license.profile?.full_name || license.profile?.email}</div>
                                                        <div className="text-xs text-muted-foreground font-mono mt-0.5">Acc: {license.account_number}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {license.product_name}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className={`font-bold ${daysLeft <= 3 ? 'text-red-500' : 'text-orange-500'}`}>
                                                            {daysLeft} วัน
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground">
                                                            {new Date(license.expiry_date).toLocaleDateString('th-TH')}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* ======================= TAB 2: PORT & IB INSIGHTS ======================= */}
                <TabsContent value="ports" className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 m-0">
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                        <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                            <SelectTrigger className="w-[200px] bg-background">
                                <SelectValue placeholder="ผู้แนะนำ (Admin)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ลูกค้าทั้งหมดทุกแอดมิน</SelectItem>
                                {availableAdmins.map(admin => (
                                    <SelectItem key={admin} value={admin}>ของ: {admin}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Port Analytics Cards */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="bg-gradient-to-br from-card to-card/50 border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">พอร์ตที่เชื่อมต่อ (Active)</CardTitle>
                                <Package className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{advancedStats.ports.total}</div>
                                <p className="text-xs text-muted-foreground mt-1 text-green-500">กำลังรัน EA อยู่ในขณะนี้</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-green-500/20 shadow-lg shadow-green-500/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">รวม Equity ที่ดูแล</CardTitle>
                                <CreditCard className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">฿{advancedStats.ports.totalEquity.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">มูลค่าพอร์ตรวมทั้งหมด</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-purple-500/20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">พอร์ต IB vs พอร์ตซื้อ</CardTitle>
                                <Users className="h-4 w-4 text-purple-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-bold">
                                    {advancedStats.ports.ibLinked} <span className="text-muted-foreground text-sm">/ {advancedStats.ports.regularLinked}</span>
                                </div>
                                <div className="w-full bg-muted h-1.5 rounded-full mt-2 overflow-hidden flex">
                                    <div 
                                        className="bg-purple-500 h-full" 
                                        style={{ width: `${(advancedStats.ports.ibLinked / (advancedStats.ports.total || 1)) * 100}%` }} 
                                    />
                                    <div 
                                        className="bg-blue-400 h-full" 
                                        style={{ width: `${(advancedStats.ports.regularLinked / (advancedStats.ports.total || 1)) * 100}%` }} 
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className={`bg-gradient-to-br from-card to-card/50 ${advancedStats.ports.riskCount > 0 ? 'border-red-500/50 animate-pulse' : 'border-border'}`}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">พอร์ตความเสี่ยงสูง</CardTitle>
                                <AlertCircle className={`h-4 w-4 ${advancedStats.ports.riskCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${advancedStats.ports.riskCount > 0 ? 'text-red-500' : 'text-foreground'}`}>
                                    {advancedStats.ports.riskCount}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Drawdown &gt; 20%</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card className="border-border px-6 py-4">
                            <CardTitle className="text-lg mb-4">สัดส่วนพอร์ตแยกตามโบรกเกอร์ (Broker Dist.)</CardTitle>
                            <div className="space-y-4">
                                {brokers.map(broker => {
                                    const count = ibMemberships.filter(m => m.broker_id === broker.id && m.status === 'approved').length;
                                    if (count === 0) return null;
                                    return (
                                        <div key={broker.id} className="flex items-center justify-between">
                                            <Badge variant="outline">{broker.name}</Badge>
                                            <div className="flex items-center gap-4">
                                                <div className="text-sm font-medium">{count} Users</div>
                                                <div className="w-32 bg-muted h-2 rounded-full overflow-hidden">
                                                    <div className="bg-primary h-full" style={{ width: `${(count / (ibMemberships.length || 1)) * 100}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className="border-border overflow-hidden">
                            <CardHeader className="border-b border-border/50">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-orange-500" />
                                    คำขอ IB ล่าสุด
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-[10px] text-muted-foreground uppercase">
                                        <tr>
                                            <th className="px-4 py-3">User</th>
                                            <th className="px-4 py-3">IB Detail</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {advancedStats.recentIbRequests.length > 0 ? advancedStats.recentIbRequests.map(req => {
                                            const profile = profileMap.get(req.user_id);
                                            return (
                                                <tr key={req.id} className="hover:bg-muted/50">
                                                    <td className="px-4 py-3 font-medium">{profile?.full_name || profile?.email}</td>
                                                    <td className="px-4 py-3 text-xs">{req.verification_data}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => router.push('/admin/ib-requests')}
                                                        >
                                                            ตรวจสอบ
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                                                    ไม่มีคำขอใหม่
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                {/* ======================= TAB 3: SALES ======================= */}
                <TabsContent value="sales" className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 m-0">
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                        <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                            <SelectTrigger className="w-[200px] bg-background">
                                <SelectValue placeholder="ผู้แนะนำ (Admin)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ลูกค้าทั้งหมดทุกแอดมิน</SelectItem>
                                {availableAdmins.map(admin => (
                                    <SelectItem key={admin} value={admin}>ของ: {admin}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={timeRange} onValueChange={setTimeRange}>
                            <SelectTrigger className="w-[180px] bg-background">
                                <SelectValue placeholder="ช่วงเวลา" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1d">วันนี้</SelectItem>
                                <SelectItem value="3d">3 วันล่าสุด</SelectItem>
                                <SelectItem value="7d">7 วันล่าสุด</SelectItem>
                                <SelectItem value="30d">30 วันล่าสุด</SelectItem>
                                <SelectItem value="all">ทั้งหมด</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg shadow-primary/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม (Revenue)</CardTitle>
                                <CreditCard className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">฿{currentSalesStats.totalRevenue.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">อ้างอิงตามช่วงเวลาที่เลือก</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">คำสั่งซื้อ (Orders)</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{currentSalesStats.totalOrders}</div>
                                <p className="text-xs text-muted-foreground mt-1">จำนวนออเดอร์ที่ชำระเงินสำเร็จ</p>
                            </CardContent>
                        </Card>
                    </div>

                    <AdminDashboardCharts orders={filteredSalesOrders} products={products} timeRange={timeRange} />

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="w-5 h-5 text-blue-500" />
                            <h2 className="text-xl font-bold">ผลประกอบการรายสินค้า</h2>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                <Input
                                    placeholder="ค้นหาชื่อสินค้า..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full md:w-80 bg-background/50"
                                />
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger className="w-full md:w-[180px] bg-background/50">
                                        <SelectValue placeholder="หมวดหมู่" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                                        {categories.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Select value={sortOrder} onValueChange={setSortOrder}>
                                <SelectTrigger className="w-full md:w-[200px] bg-background/50">
                                    <SelectValue placeholder="เรียงลำดับ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sales-desc">ขายดีที่สุด</SelectItem>
                                    <SelectItem value="revenue-desc">ทำเงินสูงสุด</SelectItem>
                                    <SelectItem value="price-desc">ราคาสูงสุด</SelectItem>
                                    <SelectItem value="price-asc">ราคาต่ำสุด</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-xl border bg-card/50 overflow-hidden shadow-sm overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">สินค้า</th>
                                        <th className="px-6 py-4 text-center">หมวดหมู่</th>
                                        <th className="px-6 py-4 text-right">ราคา</th>
                                        <th className="px-6 py-4 text-center">ยอดขาย</th>
                                        <th className="px-6 py-4 text-right">รายได้</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredProducts.map((product) => {
                                        const metrics = productMetrics[product.id] || { salesCount: 0, revenue: 0, activeLicenses: 0 };
                                        return (
                                            <tr key={product.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => router.push(`/admin/products/${product.id}`)}>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-base">{product.name}</div>
                                                    <div className="text-xs text-muted-foreground">v{product.version}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge variant="outline">{product.platform || 'N/A'}</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">฿{product.price_lifetime.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">{metrics.salesCount} sold</td>
                                                <td className="px-6 py-4 text-right">฿{metrics.revenue.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
