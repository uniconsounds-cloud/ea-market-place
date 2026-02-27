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
    Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminDashboardCharts } from './admin-dashboard-charts';

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
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('sales');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('sales-desc');
    const [filterCategory, setFilterCategory] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Data Client-Side to ensure we use the active session
                const [productsResult, ordersResult, licensesResult] = await Promise.all([
                    supabase.from('products').select('*').order('created_at', { ascending: false }),
                    supabase.from('orders').select('id, amount, status, product_id, user_id, created_at').order('created_at', { ascending: false }),
                    supabase.from('licenses').select('id, product_id, user_id, is_active, expiry_date, account_number')
                ]);

                const productsData = productsResult.data || [];
                const allOrders = ordersResult.data || [];
                const licensesData = licensesResult.data || [];

                // Filter completed orders (Case Insensitive)
                const completedOrders = allOrders.filter(o => o.status?.toLowerCase() === 'completed');

                // Get unique user IDs to fetch profiles
                const userIds = Array.from(new Set([
                    ...licensesData.map(l => l.user_id),
                    ...completedOrders.map(o => o.user_id)
                ].filter(Boolean)));

                let profileMap = new Map();
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', userIds);
                    profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
                }

                // Map Products
                const productMap = new Map(productsData.map(p => [p.id, p]));

                // Enrich Licenses
                const enrichedLicenses: LicenseWithProfile[] = licensesData.map((l: any) => ({
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

            } catch (error) {
                console.error("Failed to fetch admin data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

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

    // Reactive Product Metrics based on filtered orders
    const currentProductMetrics = useMemo(() => {
        const metrics: Record<string, ProductMetric> = {};
        products.forEach(p => {
            metrics[p.id] = { productId: p.id, salesCount: 0, revenue: 0, activeLicenses: 0 };
        });

        // Sales and Revenue are reactive to date filter
        filteredSalesOrders.forEach(o => {
            if (metrics[o.product_id]) {
                metrics[o.product_id].salesCount++;
                metrics[o.product_id].revenue += (o.amount || 0);
            }
        });

        // Active licenses remain global (or we could filter, but usually they are total)
        rawLicenses.filter(l => l.is_active).forEach(l => {
            if (metrics[l.product_id]) {
                metrics[l.product_id].activeLicenses++;
            }
        });

        return metrics;
    }, [filteredSalesOrders, products, rawLicenses]);


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
                            value="sales"
                            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 py-2.5 rounded-lg text-sm font-medium transition-all"
                        >
                            สถิติการขาย (Sales)
                        </TabsTrigger>
                        <TabsTrigger
                            value="licenses"
                            className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-6 py-2.5 rounded-lg text-sm font-medium transition-all"
                        >
                            จัดการผู้ใช้งาน (Licenses & VIPs)
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* ======================= TAB 1: SALES ======================= */}
                <TabsContent value="sales" className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 m-0">
                    <div className="flex justify-end">
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

                    {/* Stats Cards for Sales */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg shadow-primary/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม (Revenue)</CardTitle>
                                <CreditCard className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">฿{currentSalesStats.totalRevenue.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground flex items-center mt-1">
                                    <span className="text-green-500 mr-1">Updated</span> Realtime
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">คำสั่งซื้อทั้งหมด (Orders)</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-blue-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{currentSalesStats.totalOrders}</div>
                                <div className="h-1 w-full bg-blue-500/20 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 w-2/3" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Section */}
                    <AdminDashboardCharts orders={filteredSalesOrders} products={products} timeRange={timeRange} />

                    {/* Best Selling Products Table */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="w-5 h-5 text-blue-500" />
                            <h2 className="text-xl font-bold">ผลประกอบการรายสินค้า (Product Metrics)</h2>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                <div className="relative w-full md:w-80">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="ค้นหาชื่อสินค้า..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 bg-background/50"
                                    />
                                </div>
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
                                    <SelectItem value="sales-desc">ขายดีที่สุด (Best Selling)</SelectItem>
                                    <SelectItem value="sales-asc">ขายน้อยที่สุด</SelectItem>
                                    <SelectItem value="revenue-desc">ทำเงินสูงสุด (Revenue)</SelectItem>
                                    <SelectItem value="price-desc">ราคาสูงสุด</SelectItem>
                                    <SelectItem value="price-asc">ราคาต่ำสุด</SelectItem>
                                    <SelectItem value="name-asc">ชื่อ A-Z</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="rounded-xl border bg-card/50 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">สินค้า (Product)</th>
                                            <th className="px-6 py-4 font-medium text-center">หมวดหมู่</th>
                                            <th className="px-6 py-4 font-medium text-right">ราคา (Lifetime)</th>
                                            <th className="px-6 py-4 font-medium text-center">ยอดขาย (Sales)</th>
                                            <th className="px-6 py-4 font-medium text-right">รายได้ (Revenue)</th>
                                            <th className="px-6 py-4 font-medium text-center">Active Users</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {filteredProducts.length > 0 ? filteredProducts.map((product) => {
                                            const metrics = productMetrics[product.id] || { salesCount: 0, revenue: 0, activeLicenses: 0 };
                                            return (
                                                <tr
                                                    key={product.id}
                                                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                                                    onClick={() => router.push(`/admin/products/${product.id}`)}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 rounded-lg bg-gray-900 border border-border overflow-hidden shrink-0">
                                                                {product.image_url ? (
                                                                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
                                                                        No Img
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-base text-foreground group-hover:text-primary transition-colors">
                                                                    {product.name}
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">v{product.version}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex flex-col gap-1 items-center">
                                                            {product.platform && (
                                                                <Badge variant="outline" className="text-[10px] w-fit">
                                                                    {product.platform}
                                                                </Badge>
                                                            )}
                                                            {product.asset_class && (
                                                                <span className="text-[10px] text-muted-foreground capitalize">
                                                                    {product.asset_class}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-mono">฿{product.price_lifetime.toLocaleString()}</div>
                                                        {product.price_monthly > 0 && (
                                                            <div className="text-[10px] text-muted-foreground">
                                                                Mo: ฿{product.price_monthly.toLocaleString()}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                                            {metrics.salesCount} sold
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-bold text-green-600 dark:text-green-500">
                                                            ฿{metrics.revenue.toLocaleString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                                            {metrics.activeLicenses}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                                    ไม่พบข้อมูลสินค้าที่ค้นหา
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* ======================= TAB 2: LICENSES ======================= */}
                <TabsContent value="licenses" className="space-y-8 animate-in slide-in-from-bottom-2 duration-500 m-0">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                        <Card className="bg-gradient-to-br from-card to-card/50 border-green-500/20 shadow-lg shadow-green-500/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Active Licenses</CardTitle>
                                <Users className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.activeLicenses}</div>
                                <p className="text-xs text-muted-foreground mt-1">ผู้ใช้งานที่ยัง Active อยู่ในระบบ</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gradient-to-br from-card to-card/50 border-orange-500/20 shadow-lg shadow-orange-500/5">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">สินค้าบน Store (Products)</CardTitle>
                                <Package className="h-4 w-4 text-orange-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalProducts}</div>
                                <p className="text-xs text-muted-foreground mt-1">สินค้าทั้งหมดในระบบคลัง</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-8 lg:grid-cols-2">
                        {/* Table 1: Expiring Soon */}
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
                                        {expiringLicenses.length > 0 ? expiringLicenses.map((license) => {
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
                                        }) : (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                                                    ไม่มีสินค้าใกล้หมดอายุใน 14 วันนี้
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>

                        {/* Table 2: Top Users */}
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
                                        {topUsers.length > 0 ? topUsers.map((user, idx) => (
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
                                        )) : (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                                                    ยังไม่มีข้อมูลผู้ใช้งาน
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
