'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, CreditCard, Key, ShoppingCart, Loader2, AlertTriangle, Clock, Calendar, MoreVertical, Download, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface ProductItem {
    id: string; // license id or order id
    product_id: string;
    type: 'monthly' | 'quarterly' | 'yearly' | 'lifetime' | string;
    expiry_date?: string; // only for licenses
    is_active?: boolean; // only for licenses
    status?: string; // mostly for orders (pending, rejected)
    account_number: string;
    created_at: string;
    products: {
        id: string;
        name: string;
        image_url: string;
        product_key: string;
    };
    source: 'license' | 'order';
    is_ib?: boolean;
    ib_broker_name?: string;
}

interface GroupedProduct {
    productId: string;
    productName: string;
    productImage: string;
    productKey: string;
    fileUrl: string;
    items: ProductItem[];
}

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);
    const [ibBrokers, setIbBrokers] = useState<string[]>([]);
    const [pendingIbRequests, setPendingIbRequests] = useState<any[]>([]);
    const [rejectedIbRequests, setRejectedIbRequests] = useState<any[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'expiring' | 'expired' | 'rejected'>('all');

    useEffect(() => {
        const initData = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }
            setUser(user);

            // Fetch Profile for legacy fallback IB account
            const { data: profileData } = await supabase
                .from('profiles')
                .select('ib_account_number')
                .eq('id', user.id)
                .single();
            const legacyIbAccount = profileData?.ib_account_number;

            // Fetch All IB Memberships (Pending and Approved)
            const { data: allIbData } = await supabase
                .from('ib_memberships')
                .select('verification_data, status, brokers(name)')
                .eq('user_id', user.id);

            const ibData = allIbData?.filter(ib => ib.status === 'approved') || [];
            const pendingIb = allIbData?.filter(ib => ib.status === 'pending') || [];
            const rejectedIb = allIbData?.filter(ib => ib.status === 'rejected') || [];
            
            setPendingIbRequests(pendingIb);
            setRejectedIbRequests(rejectedIb);

            if (ibData.length > 0) {
                const brokers = ibData.map((b: any) => b.brokers?.name).filter(Boolean);
                setIbBrokers(brokers);
            }

            // Fetch Licenses (with product details)
            const { data: licensesData } = await supabase
                .from('licenses')
                .select(`
                    id, product_id, type, expiry_date, is_active, account_number, created_at,
                    products ( id, name, image_url, file_url, product_key )
                `)
                .eq('user_id', user.id);

            // Fetch Orders that are pending or rejected
            const { data: ordersData } = await supabase
                .from('orders')
                .select(`
                    id, product_id, plan_type, status, account_number, created_at,
                    products ( id, name, image_url, file_url, product_key )
                `)
                .eq('user_id', user.id)
                .in('status', ['pending', 'rejected']);

            // Process Data
            const allItems: ProductItem[] = [];

            if (licensesData) {
                licensesData.forEach((l: any) => {
                    const matchedIb = (ibData || []).find((ib: any) => String(ib.verification_data).trim() === String(l.account_number).trim());
                    const isIbLicense = Boolean(matchedIb) || (legacyIbAccount && String(legacyIbAccount).trim() === String(l.account_number).trim());

                    const brokerName = Array.isArray((matchedIb as any)?.brokers) ? (matchedIb as any)?.brokers[0]?.name : (matchedIb as any)?.brokers?.name;

                    allItems.push({
                        ...l,
                        source: 'license',
                        is_ib: isIbLicense,
                        ib_broker_name: brokerName
                    });
                });
            }

            if (ordersData) {
                ordersData.forEach((o: any) => {
                    allItems.push({
                        id: o.id,
                        product_id: o.product_id,
                        type: o.plan_type,
                        status: o.status,
                        account_number: o.account_number,
                        created_at: o.created_at,
                        products: o.products,
                        source: 'order',
                        is_ib: o.is_ib_request // if we want orders to know too, though less relevant here
                    });
                });
            }

            // Sort all by created_at desc
            allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Group by Product
            const groups: { [key: string]: GroupedProduct } = {};
            allItems.forEach((item) => {
                const prodId = item.product_id;
                if (!groups[prodId]) {
                    groups[prodId] = {
                        productId: prodId,
                        productName: item.products?.name || 'Unknown Product',
                        productImage: item.products?.image_url || '',
                        fileUrl: (item.products as any)?.file_url || '',
                        productKey: item.products?.product_key || '',
                        items: []
                    };
                }
                groups[prodId].items.push(item);
            });

            setGroupedProducts(Object.values(groups));
            setLoading(false);
        };

        initData();
    }, [router]);

    const calculateTimeRemaining = (item: ProductItem) => {
        // Pure lifetime non-IB licenses
        if (item.type === 'lifetime' && !item.is_ib) {
            return { days: 999, percent: 100, label: 'ตลอดชีพ', color: 'bg-green-500', isLifetime: true };
        }

        if (!item.expiry_date) {
            return { days: 0, percent: 0, label: 'ไม่มีข้อมูลวันหมดอายุ', color: 'bg-gray-500', isLifetime: false };
        }

        const now = new Date();
        const expiry = new Date(item.expiry_date);
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let totalDays = 30; // default for monthly
        if (item.type === 'quarterly') totalDays = 90;
        if (item.type === 'yearly') totalDays = 365;

        // If it's an IB license or anything else with a dynamic creation/expiry delta
        if (item.is_ib && item.created_at) {
            const created = new Date(item.created_at);
            const totalDiffTime = expiry.getTime() - created.getTime();
            const calculatedTotalDays = Math.ceil(totalDiffTime / (1000 * 60 * 60 * 24));
            totalDays = calculatedTotalDays > 0 ? calculatedTotalDays : 90; // Fallback to 90
        }

        let percent = (diffDays / totalDays) * 100;
        if (percent > 100) percent = 100;
        if (percent < 0) percent = 0;

        let color = 'bg-green-500';
        if (diffDays <= 7) color = 'bg-yellow-500';
        if (diffDays <= 3) color = 'bg-red-500';

        return {
            days: diffDays,
            percent,
            label: diffDays > 0 ? `เหลือ ${diffDays} วัน` : 'หมดอายุ',
            color,
            isLifetime: false
        };
    };

    const isItemVisible = (item: ProductItem, currentFilter: string) => {
        if (currentFilter === 'all') return true;

        if (item.source === 'order') {
            if (currentFilter === 'pending' && item.status === 'pending') return true;
            if (currentFilter === 'rejected' && item.status === 'rejected') return true;
            return false;
        }

        if (item.source === 'license') {
            const timeInfo = calculateTimeRemaining(item);

            if (currentFilter === 'active' && item.is_active && timeInfo.days > 7) return true;
            if (currentFilter === 'expiring' && item.is_active && timeInfo.days > 0 && timeInfo.days <= 7) return true;
            if (currentFilter === 'expired' && (!item.is_active || timeInfo.days <= 0)) return true;
            return false;
        }

        return false;
    };

    const hasActiveLicense = (group: GroupedProduct) => {
        return group.items.some(item => {
            if (item.source !== 'license') return false;
            const timeInfo = calculateTimeRemaining(item);
            return item.is_active && timeInfo.days > 0;
        });
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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold">ภาพรวมบัญชี</h1>
                        {ibBrokers.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap">
                                {ibBrokers.map(brokerName => (
                                    <Badge key={brokerName} variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 py-1 border border-green-500/20">
                                        <ShieldCheck className="w-3 h-3 mr-1" />
                                        IB {brokerName}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1">จัดการ License, ติดตามสถานะออเดอร์ และดาวน์โหลด EA</p>
                </div>
            </div>

            {/* Pending IB Requests Alerts */}
            {pendingIbRequests.length > 0 && (
                <div className="grid gap-3">
                    {pendingIbRequests.map((req, idx) => (
                        <div key={idx} className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-orange-600 dark:text-orange-400">คำขอสิทธิ์ IB: {req.brokers?.name || 'ไม่ระบุโบรคเกอร์'} (รอการอนุมัติ)</h4>
                                <p className="text-sm text-orange-600/80 dark:text-orange-400/80 mt-1">
                                    พอร์ต {req.verification_data} กำลังอยู่ในขั้นตอนการตรวจสอบจากแอดมิน โปรดรอประมาณ 1-12 ชั่วโมง
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Rejected IB Requests Alerts */}
            {rejectedIbRequests.length > 0 && (
                <div className="grid gap-3">
                    {rejectedIbRequests.map((req, idx) => (
                        <div key={idx} className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-red-600 dark:text-red-400">การขอสิทธิ์ IB: {req.brokers?.name || 'ไม่ระบุโบรคเกอร์'} (ไม่ผ่านการอนุมัติ)</h4>
                                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                                        ข้อมูล {req.verification_data} ไม่ถูกต้องหรืออยู่นอกเงื่อนไข โปรดสมัครใหม่ด้วยข้อมูลที่ถูกต้อง
                                    </p>
                                </div>
                            </div>
                            <Link href="/">
                                <Button variant="outline" size="sm" className="bg-white hover:bg-red-50 text-red-600 border-red-200">
                                    สมัครใหม่อีกครั้ง
                                </Button>
                            </Link>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
                    ทั้งหมด
                </Button>
                <Button variant={filter === 'active' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('active')} className={filter === 'active' ? 'bg-green-600 hover:bg-green-700' : ''}>
                    ใช้งานอยู่ (Active)
                </Button>
                <Button variant={filter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('pending')} className={filter === 'pending' ? 'bg-orange-500 hover:bg-orange-600' : ''}>
                    รออนุมัติ (Pending)
                </Button>
                <Button variant={filter === 'expiring' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('expiring')} className={filter === 'expiring' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}>
                    ใกล้หมดอายุ
                </Button>
                <Button variant={filter === 'expired' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('expired')}>
                    หมดอายุ
                </Button>
                <Button variant={filter === 'rejected' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('rejected')} className={filter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}>
                    ถูกปฏิเสธ
                </Button>
            </div>

            {/* Product List */}
            <div className="space-y-6">
                {groupedProducts.filter(group => group.items.some(item => isItemVisible(item, filter))).length > 0 ? (
                    groupedProducts.map((group) => {
                        // Filter items based on selected tab
                        const visibleItems = group.items.filter(item => isItemVisible(item, filter));
                        if (visibleItems.length === 0) return null;

                        return (
                            <Card key={group.productId} className="overflow-hidden border-border/50">
                                <CardHeader className="bg-muted/30 py-4 border-b border-border/30">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border border-border/50 shadow-sm">
                                                {group.productImage ? (
                                                    <img src={group.productImage} alt={group.productName} className="h-full w-full object-cover" />
                                                ) : (
                                                    <Key className="h-6 w-6 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-lg">{group.productName}</CardTitle>
                                                    {group.productKey && (
                                                        <Badge variant="secondary" className="text-xs font-mono bg-background/50 border-border/50">
                                                            {group.productKey}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{visibleItems.length} รายการ (พอร์ต/ไอดี)</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {group.fileUrl && (
                                                hasActiveLicense(group) ? (
                                                    <a href={group.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <Button size="sm" variant="outline" className="gap-2 bg-background hover:bg-muted font-bold text-primary border-primary/20">
                                                            <Download className="h-4 w-4" />
                                                            ดาวน์โหลดไฟล์
                                                        </Button>
                                                    </a>
                                                ) : (
                                                    <Button size="sm" variant="outline" className="gap-2 bg-muted/50 text-muted-foreground cursor-not-allowed border-dashed" disabled>
                                                        <Download className="h-4 w-4 text-muted-foreground/50" />
                                                        ไม่มีสิทธิ์ดาวน์โหลด (พอร์ตหมดอายุ)
                                                    </Button>
                                                )
                                            )}
                                            <Link href={`/products/${group.productId}`}>
                                                <Button size="sm">เพิ่มพอร์ตรับ EA</Button>
                                            </Link>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 bg-card">
                                    <div className="divide-y divide-border/40">
                                        {visibleItems.map((item) => {
                                            const isOrder = item.source === 'order';
                                            let timeInfo = null;
                                            if (!isOrder && item.expiry_date) {
                                                timeInfo = calculateTimeRemaining(item);
                                            }

                                            return (
                                                <div key={item.id} className="p-4 hover:bg-muted/10 transition-colors">
                                                    <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">

                                                        {/* Port Info & Badge */}
                                                        <div className="flex items-start md:items-center gap-3 min-w-[200px]">
                                                            {isOrder ? (
                                                                <div className={`p-2 rounded-full mt-1 md:mt-0 ${item.status === 'pending' ? 'bg-orange-500/10 text-orange-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                    <Clock className="h-4 w-4" />
                                                                </div>
                                                            ) : (
                                                                <div className={`p-2 rounded-full mt-1 md:mt-0 ${item.is_active && timeInfo?.days! > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                    <Activity className="h-4 w-4" />
                                                                </div>
                                                            )}

                                                            <div>
                                                                <div className="font-mono font-medium flex items-center gap-2 placeholder-transparent">
                                                                    Port: {item.account_number || <span className="text-muted-foreground italic text-xs">รอการระบุ</span>}

                                                                    {/* Status Badges */}
                                                                    {isOrder && item.status === 'pending' && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20">รออนุมัติ</Badge>}
                                                                    {isOrder && item.status === 'rejected' && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">ถูกปฏิเสธ</Badge>}
                                                                    {!isOrder && item.is_active && timeInfo?.days! > 7 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">ใช้งานอยู่</Badge>}
                                                                    {!isOrder && item.is_active && timeInfo?.days! > 0 && timeInfo?.days! <= 7 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/30">ใกล้หมดอายุ</Badge>}
                                                                    {!isOrder && (!item.is_active || timeInfo?.days! <= 0) && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">หมดอายุ</Badge>}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    {item.is_ib && (
                                                                        <Badge variant="outline" className="h-4 px-1 text-[9px] bg-blue-500/10 text-blue-500 border-blue-500/20 uppercase tracking-wider">
                                                                            IB {item.ib_broker_name || 'Customer'}
                                                                        </Badge>
                                                                    )}
                                                                    <div className="text-xs text-muted-foreground capitalize">
                                                                        {item.type === 'monthly' ? 'เช่ารายเดือน' :
                                                                            item.type === 'quarterly' ? 'เช่าราย 3 เดือน' :
                                                                                item.type === 'yearly' ? 'เช่ารายปี' :
                                                                                    'สิทธิ์ใช้งานตลอดชีพ (Lifetime)'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Central Status Area (Progress or Reject Reason) */}
                                                        <div className="flex-1 max-w-md space-y-2">
                                                            {isOrder ? (
                                                                // For Orders
                                                                <div className="text-sm bg-muted/30 p-2.5 rounded-md border border-border/40">
                                                                    {item.status === 'pending' && "ระบบกำลังดำเนินการตรวจสอบออเดอร์ หากคุณชำระเงิน/ใช้ IB Quota แล้ว โปรดรอแอดมินอนุมัติ 1-12 ชม."}
                                                                    {item.status === 'rejected' && "คำสั่งซื้อถูกปฏิเสธ: รูปสลิปอาจไม่ชัดเจน หรือ ข้อมูล IB ไม่ถูกต้อง หากมีข้อสงสัยโปรดติดต่อแอดมิน"}
                                                                </div>
                                                            ) : (
                                                                // For Licenses
                                                                <>
                                                                    <div className="flex justify-between text-xs">
                                                                        <div className="flex items-center gap-1 text-muted-foreground">
                                                                            <Clock className="h-3 w-3" />
                                                                            <span>เวลาที่เหลือ</span>
                                                                        </div>
                                                                        <span className={`font-medium ${timeInfo?.days! <= 7 && !timeInfo?.isLifetime ? 'text-red-500' : ''}`}>
                                                                            {timeInfo?.label}
                                                                        </span>
                                                                    </div>
                                                                    {!timeInfo?.isLifetime && (
                                                                        <Progress value={timeInfo?.percent} className="h-1.5 bg-muted/50" indicatorClassName={timeInfo?.color} />
                                                                    )}
                                                                    {timeInfo?.isLifetime && (
                                                                        <div className="h-1.5 w-full bg-green-500/10 rounded-full relative overflow-hidden">
                                                                            <div className="absolute inset-0 bg-green-500 w-full" />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                                                        <span>เริ่ม: {new Date(item.created_at).toLocaleDateString('th-TH')}</span>
                                                                        <span>หมดอายุ: {timeInfo?.isLifetime ? 'ตลอดชีพ' : new Date(item.expiry_date!).toLocaleDateString('th-TH')}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Right Action Menu */}
                                                        <div className="flex justify-end min-w-[100px]">
                                                            {!isOrder && (!item.is_active || (!timeInfo?.isLifetime && timeInfo?.days! <= 30)) ? (
                                                                <Link href={`/products/${group.productId}?renew=${item.account_number}`}>
                                                                    <Button size="sm" variant="outline" className="h-8 text-xs bg-background">
                                                                        ต่ออายุ
                                                                    </Button>
                                                                </Link>
                                                            ) : (
                                                                <div className="w-[70px]"></div> // Spacing placeholder
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                ) : (
                    <Card className="border-border/50 bg-card/50">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                            <div className="p-5 bg-muted rounded-full mb-4 ring-8 ring-background">
                                <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-xl font-medium text-foreground">ไม่พบรายการสินค้าในสถานะออเดอร์นี้</h3>
                            <p className="max-w-sm mt-2 mb-6 text-sm">หากคุณสั่งซื้อเรียบร้อยแล้ว แต่ออเดอร์หายไป โปรดติดต่อเราเพื่อตรวจสอบ</p>
                            {filter !== 'all' ? (
                                <Button variant="outline" onClick={() => setFilter('all')}>ดูรายการทั้งหมด</Button>
                            ) : (
                                <Link href="/">
                                    <Button>เข้าสู่หน้าร้านค้า EA</Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
