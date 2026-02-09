'use client';

import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    Loader2
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
    const [loading, setLoading] = useState(true);
    const router = useRouter();

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
                    supabase.from('orders').select('id, amount, status, product_id, created_at').order('created_at', { ascending: false }),
                    supabase.from('licenses').select('id, product_id, is_active').eq('is_active', true)
                ]);

                const productsData = productsResult.data || [];
                const allOrders = ordersResult.data || [];
                const licensesData = licensesResult.data || [];

                // Log for debugging
                console.log('--- [Admin Client Debug] ---');
                console.log('Products:', productsData.length);
                console.log('Orders (Raw):', allOrders.length, allOrders);
                console.log('Licenses:', licensesData.length);

                // Filter completed orders (Case Insensitive)
                const completedOrders = allOrders.filter(o => o.status?.toLowerCase() === 'completed');
                console.log('Orders (Completed):', completedOrders.length);

                // Calculate Global Stats
                const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
                const totalOrders = completedOrders.length;
                const activeLicenses = licensesData.length;

                setStats({
                    totalProducts: productsData.length,
                    totalOrders,
                    totalRevenue,
                    activeLicenses
                });

                // Store completed orders for charts
                setOrders(completedOrders);

                // Calculate Per-Product Metrics
                const metrics: Record<string, ProductMetric> = {};

                // Init metrics for all products
                productsData.forEach(p => {
                    metrics[p.id] = {
                        productId: p.id,
                        salesCount: 0,
                        revenue: 0,
                        activeLicenses: 0
                    };
                });

                // Aggregate Orders
                completedOrders.forEach(o => {
                    if (metrics[o.product_id]) {
                        metrics[o.product_id].salesCount++;
                        metrics[o.product_id].revenue += (o.amount || 0);
                    }
                });

                // Aggregate Licenses
                licensesData.forEach(l => {
                    if (metrics[l.product_id]) {
                        metrics[l.product_id].activeLicenses++;
                    }
                });

                setProducts(productsData);
                setProductMetrics(metrics);

            } catch (error) {
                console.error("Failed to fetch admin data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Get unique categories/platforms
    const categories = useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => {
            if (p.asset_class) cats.add(p.asset_class);
            if (p.platform) cats.add(p.platform);
        });
        return Array.from(cats);
    }, [products]);

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
            const metricsA = productMetrics[a.id] || { salesCount: 0, revenue: 0, activeLicenses: 0 };
            const metricsB = productMetrics[b.id] || { salesCount: 0, revenue: 0, activeLicenses: 0 };

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
    }, [products, searchQuery, filterCategory, sortOrder, productMetrics]);

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

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-card to-card/50 border-primary/20 shadow-lg shadow-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายรวม (Revenue)</CardTitle>
                        <CreditCard className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿{stats.totalRevenue.toLocaleString()}</div>
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
                        <div className="text-2xl font-bold">{stats.totalOrders}</div>
                        <div className="h-1 w-full bg-blue-500/20 mt-2 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-2/3" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-card/50 border-green-500/20 shadow-lg shadow-green-500/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Active Licenses</CardTitle>
                        <Users className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeLicenses}</div>
                        <p className="text-xs text-muted-foreground mt-1">ผู้ใช้งานที่ยัง Active อยู่</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-card/50 border-orange-500/20 shadow-lg shadow-orange-500/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">สินค้าทั้งหมด (Products)</CardTitle>
                        <Package className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProducts}</div>
                        <p className="text-xs text-muted-foreground mt-1">พร้อมขายบน Store</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <AdminDashboardCharts orders={orders} products={products} />

            {/* Product Table Section */}
            <div className="space-y-4">
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
        </div>
    );
}
