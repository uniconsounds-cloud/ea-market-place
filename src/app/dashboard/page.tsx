'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, CreditCard, Key, ShoppingCart, Loader2, AlertTriangle, Clock, Calendar, MoreVertical, Download, ShieldCheck, XCircle, Trash2, Sparkles, Copy, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { sweepAndDeactivateExpiredLicenses } from '@/lib/license-audit';

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
    show_farm?: boolean;
    port_name?: string;
    last_update_ms?: number;
    approved_at_ms?: number;
    is_online?: boolean;
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
    const [hasDemoChallenge, setHasDemoChallenge] = useState<boolean>(false);
    const [editingLicenseId, setEditingLicenseId] = useState<string | null>(null);
    const [tempPortName, setTempPortName] = useState<string>('');
    const [savingPortName, setSavingPortName] = useState<boolean>(false);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        if (navigator?.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedUrl(id);
            setTimeout(() => setCopiedUrl(null), 2500);
        }
    };

    const formatLastUpdated = (ms?: number) => {
        if (!ms) return null;
        const diffSec = Math.floor((Date.now() - ms) / 1000);
        if (diffSec < 60) return 'เมื่อสักครู่';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชม. ที่แล้ว`;
        return new Date(ms).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    };

    const handleSavePortName = async (licenseId: string) => {
        setSavingPortName(true);
        try {
            const { error } = await supabase
                .from('licenses')
                .update({ port_name: tempPortName })
                .eq('id', licenseId);

            if (error) throw error;

            // Update state locally
            setGroupedProducts(prev => prev.map(group => ({
                ...group,
                items: group.items.map(item => 
                    item.id === licenseId ? { ...item, port_name: tempPortName } : item
                )
            })));

            setEditingLicenseId(null);
        } catch (error: any) {
            alert('เกิดข้อผิดพลาดในการบันทึกชื่อพอร์ต: ' + error.message);
        } finally {
            setSavingPortName(false);
        }
    };

    const handleDeleteItem = async (id: string, source: 'license' | 'order') => {
        const confirmMsg = source === 'license' 
            ? "ยืนยันการลบรายการพอร์ตนี้? (ข้อมูลประวัติและ Dashboard ทั้งหมดของพอร์ตนี้จะถูกลบถาวร)" 
            : "ยืนยันการลบรายการออเดอร์นี้?";
        
        if (!confirm(confirmMsg)) return;

        try {
            const { data, error } = await supabase.rpc('delete_dashboard_item', {
                p_item_id: id,
                p_source: source
            });

            if (error) throw error;
            
            // Refresh data
            window.location.reload(); 
        } catch (error: any) {
            alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
        }
    };

    useEffect(() => {
        const initData = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }
            setUser(user);

            // Auto-deactivate any expired licenses and record audit log ('auto')
            await sweepAndDeactivateExpiredLicenses(supabase);

            // Check if user has joined demo challenge
            const { data: demoChallengeData } = await supabase
                .from('demo_challenges')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
            setHasDemoChallenge(!!demoChallengeData);

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
                    id, product_id, type, expiry_date, is_active, account_number, created_at, show_farm, port_name, ib_broker_name, is_ib_request,
                    products ( id, name, image_url, file_url, product_key )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            // Fetch Orders: fetch all orders for this user (both pending/rejected for display, and completed for upgrade/approval timestamp tracking)
            const { data: allUserOrders } = await supabase
                .from('orders')
                .select(`
                    id, product_id, plan_type, status, account_number, created_at,
                    products ( id, name, image_url, file_url, product_key )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            const ordersData = (allUserOrders || []).filter((o: any) => o.status === 'pending' || o.status === 'rejected');
            const completedOrders = (allUserOrders || []).filter((o: any) => o.status === 'completed' || o.status === 'approved');

            // Fetch latest telemetry for accounts to display actual last update
            const accountNumbers = (licensesData || [])
                .map((l: any) => l.account_number ? String(l.account_number).trim() : null)
                .filter(Boolean) as string[];

            let portStatusMap: Record<string, { updated_at?: string; last_ping?: string; is_online?: boolean }> = {};
            if (accountNumbers.length > 0) {
                try {
                    const { data: portStatuses } = await supabase
                        .from('farm_port_status')
                        .select('port_number, updated_at, last_ping, is_online')
                        .in('port_number', accountNumbers);

                    if (portStatuses) {
                        portStatuses.forEach((ps: any) => {
                            if (ps.port_number) {
                                portStatusMap[String(ps.port_number).trim()] = ps;
                            }
                        });
                    }
                } catch (e) {
                    console.error('Failed to fetch port telemetry:', e);
                }
            }

            // Process Data
            const allItems: ProductItem[] = [];

            if (licensesData) {
                licensesData.forEach((l: any) => {
                    const matchedIb = (ibData || []).find((ib: any) => String(ib.verification_data).trim() === String(l.account_number).trim());
                    const isIbLicense = Boolean(matchedIb) || (legacyIbAccount && String(legacyIbAccount).trim() === String(l.account_number).trim());

                    const brokerName = l.ib_broker_name || (Array.isArray((matchedIb as any)?.brokers) ? (matchedIb as any)?.brokers[0]?.name : (matchedIb as any)?.brokers?.name);

                    const ps = l.account_number ? portStatusMap[String(l.account_number).trim()] : null;
                    let approvedAtMs = l.created_at ? new Date(l.created_at).getTime() : 0;

                    // Match completed orders (such as upgrade orders to EasyM Prime or renewals)
                    if (l.account_number) {
                        const targetPort = String(l.account_number).trim();
                        completedOrders.forEach((o: any) => {
                            if (!o.account_number) return;
                            const ports = o.account_number.split(',').map((p: string) => p.trim());
                            if (ports.includes(targetPort)) {
                                const oMs = o.created_at ? new Date(o.created_at).getTime() : 0;
                                if (oMs > approvedAtMs) {
                                    approvedAtMs = oMs;
                                }
                            }
                        });
                    }

                    // For EasyM Prime licenses (including existing accounts upgraded to Prime with 60 days validity)
                    const isPrimeLicense = l.products?.product_key?.toUpperCase().includes('PRIME') ||
                                           l.products?.name?.toLowerCase().includes('prime') ||
                                           l.type === 'pro';

                    if (isPrimeLicense && l.expiry_date) {
                        const expiryMs = new Date(l.expiry_date).getTime();
                        // Upon approval of Prime upgrade, 60 days validity was granted
                        const estimatedUpgradeMs = expiryMs - (60 * 24 * 60 * 60 * 1000);
                        if (estimatedUpgradeMs > approvedAtMs) {
                            approvedAtMs = estimatedUpgradeMs;
                        }
                    }

                    const lastUpdateMs = Math.max(
                        ps?.last_ping ? new Date(ps.last_ping).getTime() : 0,
                        ps?.updated_at ? new Date(ps.updated_at).getTime() : 0,
                        approvedAtMs
                    );

                    allItems.push({
                        ...l,
                        source: 'license',
                        is_ib: isIbLicense || l.is_ib_request || l.type === 'ib',
                        ib_broker_name: brokerName,
                        last_update_ms: lastUpdateMs,
                        approved_at_ms: approvedAtMs,
                        is_online: ps?.is_online
                    });
                });
            }

            if (ordersData) {
                ordersData.forEach((o: any) => {
                    const approvedAtMs = o.created_at ? new Date(o.created_at).getTime() : 0;
                    allItems.push({
                        id: o.id,
                        product_id: o.product_id,
                        type: o.plan_type,
                        status: o.status,
                        account_number: o.account_number,
                        created_at: o.created_at,
                        products: o.products,
                        source: 'order',
                        is_ib: o.is_ib_request,
                        last_update_ms: approvedAtMs,
                        approved_at_ms: approvedAtMs
                    });
                });
            }

            // Sort all by approved_at_ms desc (latest approved at the top)
            allItems.sort((a, b) => (b.approved_at_ms || 0) - (a.approved_at_ms || 0));

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

            // Sort product groups so that the group containing the most recently approved item is at the top
            const sortedGroupList = Object.values(groups).sort((a, b) => {
                const maxA = Math.max(...a.items.map(i => i.approved_at_ms || 0), 0);
                const maxB = Math.max(...b.items.map(i => i.approved_at_ms || 0), 0);
                return maxB - maxA;
            });

            // Ensure items inside each group are also sorted by approved_at_ms desc (latest approved on top)
            sortedGroupList.forEach(g => {
                g.items.sort((a, b) => (b.approved_at_ms || 0) - (a.approved_at_ms || 0));
            });

            setGroupedProducts(sortedGroupList);
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
                {hasDemoChallenge && (
                    <Link href="/farm/demo" className="shrink-0 w-full md:w-auto">
                        <Button className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-extrabold shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 border-0 flex items-center justify-center gap-2 h-10 px-5">
                            <Activity className="w-4 h-4 animate-pulse" />
                            ดูระบบติดตามพอร์ตจริง (EasyM Live Tracker)
                        </Button>
                    </Link>
                )}
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

                        const isPrime = group.productName.toLowerCase().includes('prime') || group.productKey?.toUpperCase().includes('PRIME');

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

                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Upgrade to Prime for EasyM products (except Prime itself) */}
                                            {((group.productKey?.toUpperCase().startsWith('EZM') || group.productName?.toLowerCase().includes('easym') || group.productName?.toLowerCase().includes('easy m')) && !group.productName?.toLowerCase().includes('prime') && !group.productKey?.toUpperCase().includes('PRIME')) && (
                                                <Link href={`/dashboard/upgrade-prime?fromProductId=${group.productId}`}>
                                                    <Button size="sm" className="gap-1.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold shadow-md shadow-cyan-500/20 border border-cyan-400/40 text-xs sm:text-sm whitespace-nowrap">
                                                        <Sparkles className="h-3.5 w-3.5 text-yellow-300 animate-spin shrink-0" />
                                                        ✨ อัปเกรดสู่ Prime ฟรี
                                                    </Button>
                                                </Link>
                                            )}
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

                                {/* EasyM Prime WebRequest Advice Ribbon */}
                                {isPrime && (
                                    <div className="bg-sky-500/10 dark:bg-sky-950/30 border-b border-sky-500/20 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
                                        <div className="flex items-center gap-2 text-sky-200">
                                            <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="font-semibold text-sky-300">คำแนะนำตั้งค่า MT5:</span>
                                                <span className="text-muted-foreground text-[11px]">
                                                    เพิ่ม Allow WebRequest 2 รายการ (Tools &gt; Options &gt; Expert Advisors)
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* URL 1 */}
                                            <div className="flex items-center gap-1.5 bg-background/80 dark:bg-stone-900/90 border border-sky-500/30 rounded px-2 py-1 text-[11px] font-mono text-sky-200 shadow-sm">
                                                <span className="select-all">https://eaeze.com</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy('https://eaeze.com', 'url1')}
                                                    className="ml-1 text-sky-400 hover:text-sky-200 p-0.5 rounded transition-colors inline-flex items-center"
                                                    title="คัดลอก https://eaeze.com"
                                                >
                                                    {copiedUrl === 'url1' ? (
                                                        <span className="text-emerald-400 text-[10px] font-sans font-bold flex items-center gap-0.5">
                                                            <Check className="w-3 h-3" /> คัดลอกแล้ว
                                                        </span>
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* URL 2 */}
                                            <div className="flex items-center gap-1.5 bg-background/80 dark:bg-stone-900/90 border border-sky-500/30 rounded px-2 py-1 text-[11px] font-mono text-sky-200 shadow-sm">
                                                <span className="select-all">https://mfrspvzxmpksqnzcrysz.supabase.co</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy('https://mfrspvzxmpksqnzcrysz.supabase.co', 'url2')}
                                                    className="ml-1 text-sky-400 hover:text-sky-200 p-0.5 rounded transition-colors inline-flex items-center"
                                                    title="คัดลอก https://mfrspvzxmpksqnzcrysz.supabase.co"
                                                >
                                                    {copiedUrl === 'url2' ? (
                                                        <span className="text-emerald-400 text-[10px] font-sans font-bold flex items-center gap-0.5">
                                                            <Check className="w-3 h-3" /> คัดลอกแล้ว
                                                        </span>
                                                    ) : (
                                                        <Copy className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>

                                            {/* Quick Copy Both */}
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleCopy('https://eaeze.com\nhttps://mfrspvzxmpksqnzcrysz.supabase.co', 'both')}
                                                className="h-6 px-2 text-[10px] text-sky-400 hover:text-sky-200 hover:bg-sky-950/40 border border-sky-500/20"
                                                title="คัดลอกทั้ง 2 URLs พร้อมกัน"
                                            >
                                                {copiedUrl === 'both' ? (
                                                    <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                                        <Check className="w-3 h-3" /> คัดลอกครบ 2 ลิงก์
                                                    </span>
                                                ) : (
                                                    'คัดลอกทั้งคู่'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                )}

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
                                                                <div className="font-mono font-medium flex items-center gap-2 placeholder-transparent flex-wrap">
                                                                    Port: {item.account_number || <span className="text-muted-foreground italic text-xs">รอการระบุ</span>}
                                                                    {item.last_update_ms ? (
                                                                        <span className="text-[10px] text-muted-foreground/75 font-sans font-normal inline-flex items-center gap-1">
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${item.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'}`}></span>
                                                                            อัปเดต: {formatLastUpdated(item.last_update_ms)}
                                                                        </span>
                                                                    ) : null}

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
                                                                    {!item.is_ib && (item.type === 'monthly' || item.type === 'quarterly' || item.type === 'yearly') && (
                                                                        <div className="text-xs text-muted-foreground capitalize">
                                                                            {item.type === 'monthly' ? 'เช่ารายเดือน' :
                                                                                item.type === 'quarterly' ? 'เช่าราย 3 เดือน' :
                                                                                    'เช่ารายปี'}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {!isOrder && item.account_number && (
                                                                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                        <span className="text-[10px] text-amber-500/80 uppercase tracking-wider font-bold">ชื่อพอร์ต:</span>
                                                                        {editingLicenseId === item.id ? (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <input 
                                                                                    type="text" 
                                                                                    value={tempPortName}
                                                                                    onChange={(e) => setTempPortName(e.target.value)}
                                                                                    className="bg-stone-900 border border-amber-900/30 px-1.5 py-0.5 rounded text-xs text-amber-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 w-36 h-6"
                                                                                    placeholder="ตั้งชื่อพอร์ต..."
                                                                                    maxLength={24}
                                                                                />
                                                                                <button 
                                                                                    onClick={() => handleSavePortName(item.id)}
                                                                                    disabled={savingPortName}
                                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded h-6 disabled:opacity-50 transition-colors"
                                                                                >
                                                                                    {savingPortName ? '...' : 'บันทึก'}
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => setEditingLicenseId(null)}
                                                                                    className="bg-stone-700 hover:bg-stone-600 text-white text-[10px] font-bold px-2 py-0.5 rounded h-6 transition-colors"
                                                                                >
                                                                                    ยกเลิก
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="font-semibold text-stone-200">{item.port_name || 'ยังไม่ได้ตั้งชื่อ'}</span>
                                                                                <button 
                                                                                    onClick={() => {
                                                                                        setEditingLicenseId(item.id);
                                                                                        setTempPortName(item.port_name || '');
                                                                                    }}
                                                                                    className="text-amber-500 hover:text-amber-400 text-[10px] font-bold hover:underline transition-colors flex items-center gap-0.5"
                                                                                >
                                                                                    ✏️ แก้ไขชื่อ
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
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
                                                        <div className="flex justify-end items-center gap-2 min-w-[150px]">
                                                            {/* View Farm Button (Auto-enabled for EasyM Prime; requires admin show_farm approval for EasyM MAX and other products) */}
                                                            {!isOrder && item.account_number && (item.show_farm || Boolean(item.products?.name?.toLowerCase().includes('prime') || item.products?.product_key?.toUpperCase().includes('PRIME'))) && (
                                                                <Link href={`/farm/${item.account_number}`} target="_blank">
                                                                    <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1.5 bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20">
                                                                        <Activity className="w-3 h-3" />
                                                                        ดูฟาร์ม
                                                                    </Button>
                                                                </Link>
                                                            )}

                                                            {/* Delete Button (Cleanup) */}
                                                            {(isOrder && (item.status === 'pending' || item.status === 'rejected')) || 
                                                             (!isOrder && (!item.is_active || (!timeInfo?.isLifetime && timeInfo?.days! <= 0))) ? (
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                                    onClick={() => handleDeleteItem(item.id, isOrder ? 'order' : 'license')}
                                                                    title="ลบออกจากรายการ"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            ) : null}

                                                            {!isOrder && (!item.is_active || !timeInfo?.isLifetime) ? (
                                                                (() => {
                                                                    const isPrimeProduct = isPrime || item.type === 'pro';
                                                                    const isIb = !isPrimeProduct && (item.type === 'ib' || item.is_ib);
                                                                    const brokerParam = item.ib_broker_name ? `&ibBrokerName=${encodeURIComponent(item.ib_broker_name)}` : '';
                                                                    const planParam = isPrimeProduct
                                                                        ? (item.type === 'quarterly' || item.type === 'lifetime' ? item.type : 'monthly')
                                                                        : (item.type || (isIb ? 'lifetime' : 'monthly'));
                                                                    const renewCheckoutUrl = `/checkout/${group.productId}?accountNumber=${item.account_number}&plan=${planParam}${isIb ? '&isIbRequest=true' : ''}${brokerParam}`;
                                                                    return (
                                                                        <Link href={renewCheckoutUrl}>
                                                                            <Button size="sm" variant="outline" className="h-8 text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-300 font-medium">
                                                                                ต่ออายุ
                                                                            </Button>
                                                                        </Link>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <div className="w-[32px]"></div> // Minimal placeholder if no renew but has delete
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
