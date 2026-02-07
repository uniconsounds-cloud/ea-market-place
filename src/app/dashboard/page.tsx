'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, CreditCard, Key, ShoppingCart, Loader2, AlertTriangle, Clock, Calendar, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface License {
    id: string;
    product_id: string;
    products: {
        id: string; // added to link to product
        name: string;
        image_url: string;
    };
    type: 'monthly' | 'lifetime';
    expiry_date: string;
    is_active: boolean;
    account_number: string;
    created_at: string;
}

interface GroupedLicense {
    account_number: string;
    licenses: License[];
}

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState({
        activeLicenses: 0,
        totalInvestment: 0,
        totalProducts: 0,
        accountStatus: 'Inactive'
    });
    const [groupedLicenses, setGroupedLicenses] = useState<GroupedLicense[]>([]);

    useEffect(() => {
        const initData = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }
            setUser(user);

            // 1. Fetch Licenses (with product details)
            const { data: licensesData } = await supabase
                .from('licenses')
                .select(`
                    *,
                    products (
                        id,
                        name,
                        image_url
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            // 2. Fetch Orders (for total investment)
            const { data: ordersData } = await supabase
                .from('orders')
                .select('amount, status')
                .eq('user_id', user.id)
                .eq('status', 'completed');

            // Calculate Stats
            const activeCount = licensesData?.filter((l: any) => l.is_active).length || 0;
            const totalInv = ordersData?.reduce((sum: number, order: any) => sum + (order.amount || 0), 0) || 0;
            const totalProds = licensesData?.length || 0;

            setStats({
                activeLicenses: activeCount,
                totalInvestment: totalInv,
                totalProducts: totalProds,
                accountStatus: activeCount > 0 ? 'Active' : 'Standby'
            });

            // Group Licenses by Account Number
            if (licensesData) {
                const groups: { [key: string]: License[] } = {};
                licensesData.forEach((l: any) => {
                    const acc = l.account_number || 'Unassigned';
                    if (!groups[acc]) groups[acc] = [];
                    groups[acc].push(l);
                });

                // Convert to array and sort (Active ports first, then by account number)
                const groupedArray = Object.keys(groups).map(acc => ({
                    account_number: acc,
                    licenses: groups[acc]
                })).sort((a, b) => {
                    // Check if groups have active licenses
                    const aActive = a.licenses.some(l => l.is_active);
                    const bActive = b.licenses.some(l => l.is_active);
                    if (aActive && !bActive) return -1;
                    if (!aActive && bActive) return 1;
                    return a.account_number.localeCompare(b.account_number);
                });

                setGroupedLicenses(groupedArray);
            }

            setLoading(false);
        };

        initData();
    }, [router]);

    const calculateTimeRemaining = (expiryDate: string, type: 'monthly' | 'lifetime') => {
        if (type === 'lifetime') return { days: 999, percent: 100, label: 'ตลอดชีพ', color: 'bg-green-500' };

        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Assuming monthly is 30 days for progress bar calculation
        let percent = (diffDays / 30) * 100;
        if (percent > 100) percent = 100;
        if (percent < 0) percent = 0;

        let color = 'bg-green-500';
        if (diffDays <= 7) color = 'bg-yellow-500';
        if (diffDays <= 3) color = 'bg-red-500';

        return {
            days: diffDays,
            percent,
            label: diffDays > 0 ? `${diffDays} วัน` : 'หมดอายุ',
            color
        };
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold">ภาพรวมบัญชี</h1>
                <p className="text-muted-foreground">ยินดีต้อนรับ, {user?.user_metadata?.full_name || user?.email}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">License ที่ใช้งาน</CardTitle>
                        <Key className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeLicenses}</div>
                        <p className="text-xs text-muted-foreground">License ที่ Active อยู่</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">ยอดลงทุนรวม</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">฿{stats.totalInvestment.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">จากคำสั่งซื้อทั้งหมด</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">สถานะ Account</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.accountStatus === 'Active' ? 'text-green-500' : 'text-yellow-500'}`}>
                            {stats.accountStatus}
                        </div>
                        <p className="text-xs text-muted-foreground">สถานะสมาชิกปัจจุบัน</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">สินค้าทั้งหมด</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalProducts}</div>
                        <p className="text-xs text-muted-foreground">รายการที่ซื้อแล้ว</p>
                    </CardContent>
                </Card>
            </div>

            {/* Grouped Licenses */}
            <div className="space-y-6">
                <h2 className="text-xl font-semibold tracking-tight">รายการ License ตามพอร์ตลงทุน</h2>

                {groupedLicenses.length > 0 ? (
                    groupedLicenses.map((group) => (
                        <Card key={group.account_number} className="overflow-hidden border-l-4 border-l-primary">
                            <CardHeader className="bg-muted/40 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-primary/10 rounded-full">
                                            <Activity className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">Port: {group.account_number}</CardTitle>
                                            <p className="text-xs text-muted-foreground">{group.licenses.length} รายการในพอร์ตนี้</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="font-mono">
                                        MT4/MT5
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {group.licenses.map((item) => {
                                        const timeInfo = calculateTimeRemaining(item.expiry_date, item.type);
                                        return (
                                            <div key={item.id} className="p-4 hover:bg-muted/20 transition-colors">
                                                <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">

                                                    {/* Product Info */}
                                                    <div className="flex items-center gap-4 min-w-[200px]">
                                                        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                                                            <Key className="h-5 w-5 text-foreground/70" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium">{item.products?.name}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <span className="capitalize">{item.type} Plan</span>
                                                                <span>•</span>
                                                                <span className={item.is_active ? "text-green-500" : "text-red-500"}>
                                                                    {item.is_active ? "Active" : "Inactive"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Expiration Progress */}
                                                    <div className="flex-1 max-w-md space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                <span>เวลาที่เหลือ</span>
                                                            </div>
                                                            <span className={`font-medium ${timeInfo.days <= 7 && item.type !== 'lifetime' ? 'text-red-500' : ''
                                                                }`}>
                                                                {timeInfo.label}
                                                            </span>
                                                        </div>
                                                        {item.type !== 'lifetime' && (
                                                            <Progress value={timeInfo.percent} className="h-2" indicatorClassName={timeInfo.color} />
                                                        )}
                                                        {item.type === 'lifetime' && (
                                                            <div className="h-2 w-full bg-green-500/20 rounded-full relative overflow-hidden">
                                                                <div className="absolute inset-0 bg-green-500 w-full" />
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                                            <span>เริ่ม: {new Date(item.created_at).toLocaleDateString('th-TH')}</span>
                                                            <span>หมด: {item.type === 'lifetime' ? 'ตลอดชีพ' : new Date(item.expiry_date).toLocaleDateString('th-TH')}</span>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 md:justify-end min-w-[120px]">
                                                        {!item.is_active || (item.type !== 'lifetime' && timeInfo.days <= 30) ? (
                                                            <Link href={`/products/${item.products?.id}`}>
                                                                <Button size="sm" variant={item.is_active ? "outline" : "default"} className="h-8 gap-2">
                                                                    <CreditCard className="h-3 w-3" />
                                                                    {item.is_active ? 'ต่ออายุ' : 'ซื้อใหม่'}
                                                                </Button>
                                                            </Link>
                                                        ) : (
                                                            <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" disabled>
                                                                <Activity className="h-3 w-3 mr-2" />
                                                                ปกติ
                                                            </Button>
                                                        )}
                                                    </div>

                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <Key className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">ยังไม่มี License</h3>
                            <p className="max-w-sm mt-2 mb-6">คุณยังไม่มีรายการ License ที่ใช้งานอยู่ เชื่อมต่อพอร์ตของคุณโดยการสั่งซื้อสินค้า</p>
                            <Link href="/">
                                <Button>เลือกซื้อสินค้า</Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
