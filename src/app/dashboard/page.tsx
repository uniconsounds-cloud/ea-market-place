'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CreditCard, Key, ShoppingCart, Loader2 } from 'lucide-react';

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
    const [licenses, setLicenses] = useState<any[]>([]);

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
            const activeCount = licensesData?.filter(l => l.is_active).length || 0;
            const totalInv = ordersData?.reduce((sum, order) => sum + (order.amount || 0), 0) || 0;

            setStats({
                activeLicenses: activeCount,
                totalInvestment: totalInv,
                totalProducts: licensesData?.length || 0,
                accountStatus: activeCount > 0 ? 'Active' : 'Standby'
            });

            setLicenses(licensesData || []);
            setLoading(false);
        };

        initData();
    }, [router]);

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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-full">
                    <CardHeader>
                        <CardTitle>License ล่าสุดของคุณ</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {licenses.length > 0 ? (
                            <div className="space-y-8">
                                {licenses.map((item, i) => (
                                    <div key={i} className="flex items-center">
                                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Key className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="ml-4 space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                {item.products?.name || 'Unknown Product'}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {item.type === 'monthly' ? 'รายเดือน' : 'ถาวร'}
                                            </p>
                                            <p className="text-sm font-mono text-accent">
                                                Port: {item.account_number || '-'}
                                            </p>
                                        </div>
                                        <div className="ml-auto font-medium text-sm">
                                            {item.is_active ? (
                                                <span className="text-green-500 bg-green-500/10 px-2 py-1 rounded-full text-xs">ใช้งานได้</span>
                                            ) : (
                                                <span className="text-red-500 bg-red-500/10 px-2 py-1 rounded-full text-xs">หมดอายุ</span>
                                            )}
                                        </div>
                                        <div className="ml-8 text-sm text-muted-foreground w-32 text-right">
                                            {item.type === 'lifetime' ? 'ตลอดชีพ' : new Date(item.expiry_date).toLocaleDateString('th-TH')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-muted-foreground">ยังไม่มีรายการ License</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
