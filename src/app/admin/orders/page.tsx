'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Check, X, Search, FileText, Loader2, Filter, Zap, Calendar, Mail, RotateCw, RefreshCw, Sparkles } from 'lucide-react';

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // IB Approval Modal State
    const [approveModalOpen, setApproveModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [expiryOption, setExpiryOption] = useState("6months");
    const [customDate, setCustomDate] = useState("");

    // Filter & Sort State
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');
    const [hideTestAccounts, setHideTestAccounts] = useState(true);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);

        // Auto-deactivate any expired licenses
        try {
            await supabase
                .from('licenses')
                .update({ is_active: false })
                .eq('is_active', true)
                .neq('type', 'lifetime')
                .lt('expiry_date', new Date().toISOString());
        } catch (e) {
            console.error('Error auto-deactivating expired licenses:', e);
        }

        // Fetch all orders with pagination (>1000 records supported)
        let allOrders: any[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
            const { data: batch, error: batchErr } = await supabase
                .from('orders')
                .select(`
                    *,
                    products!orders_product_id_fkey (name, price_monthly, price_lifetime),
                    profiles!orders_user_id_profiles_fkey (full_name, email, is_tester)
                `)
                .order('created_at', { ascending: false })
                .range(from, from + batchSize - 1);

            if (batchErr) {
                console.error('Error fetching orders batch:', batchErr);
                break;
            }
            if (batch) allOrders = allOrders.concat(batch);
            if (!batch || batch.length < batchSize) break;
            from += batchSize;
        }

        if (allOrders.length > 0) {
            // Fetch IB Memberships to get the broker details for these orders
            const userIds = Array.from(new Set(allOrders.map(o => o.user_id).filter(Boolean)));
            let ibMembershipsMap: Record<string, string> = {};

            for (let i = 0; i < userIds.length; i += 100) {
                const chunk = userIds.slice(i, i + 100);
                const { data: ibMemberships } = await supabase
                    .from('ib_memberships')
                    .select('user_id, verification_data, brokers(name)')
                    .in('user_id', chunk)
                    .eq('status', 'approved');

                if (ibMemberships) {
                    ibMemberships.forEach(ib => {
                        const bName = Array.isArray((ib as any).brokers)
                            ? (ib as any).brokers[0]?.name
                            : (ib as any).brokers?.name;
                        const key = `${ib.user_id}_${ib.verification_data?.trim()}`;
                        if (bName) ibMembershipsMap[key] = bName;
                    });
                }
            }

            // Fetch Existing Licenses to identify Renewal requests
            const allPorts = Array.from(new Set(allOrders.flatMap(o => (o.account_number || '').split(',').map((p: string) => p.trim())).filter(Boolean)));
            let licensesMap: Record<string, any> = {};

            if (allPorts.length > 0) {
                for (let i = 0; i < allPorts.length; i += 100) {
                    const chunk = allPorts.slice(i, i + 100);
                    const { data: licensesChunk } = await supabase
                        .from('licenses')
                        .select('id, user_id, product_id, account_number, expiry_date, type, is_active, created_at')
                        .in('account_number', chunk);

                    if (licensesChunk) {
                        licensesChunk.forEach(lic => {
                            const key = `${lic.user_id}_${lic.product_id}_${lic.account_number?.trim()}`;
                            licensesMap[key] = lic;
                        });
                    }
                }
            }

            const mappedData = allOrders.map(o => {
                const port = o.account_number?.trim();
                const key = `${o.user_id}_${port}`;
                const matchedBroker = ibMembershipsMap[key];

                const orderPorts = (o.account_number || '').split(',').map((p: string) => p.trim()).filter(Boolean);
                const orderCreatedAt = new Date(o.created_at).getTime();

                // To be a true renewal, the license must have already existed BEFORE this order was placed.
                // If the order created the license upon approval, license.created_at is >= order.created_at.
                const preExistingLicenses = orderPorts
                    .map((p: string) => licensesMap[`${o.user_id}_${o.product_id}_${p}`])
                    .filter((lic: any) => {
                        if (!lic || !lic.created_at) return false;
                        return new Date(lic.created_at).getTime() < orderCreatedAt - 10000;
                    });

                const isRenewal = preExistingLicenses.length > 0;
                const existingLicense = isRenewal ? preExistingLicenses[0] : null;

                return {
                    ...o,
                    ib_broker_name: matchedBroker || o.ib_broker_name || undefined,
                    is_renewal: isRenewal,
                    existing_license: existingLicense
                };
            });

            setOrders(mappedData);
        } else {
            console.log('Main fetch returned empty. Trying raw fetch...');
            let rawOrders: any[] = [];
            let rFrom = 0;
            while (true) {
                const { data: rawBatch } = await supabase
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(rFrom, rFrom + batchSize - 1);
                if (rawBatch) rawOrders = rawOrders.concat(rawBatch);
                if (!rawBatch || rawBatch.length < batchSize) break;
                rFrom += batchSize;
            }

            if (rawOrders.length > 0) {
                const mappedData = rawOrders.map(o => ({
                    ...o,
                    products: { name: 'Raw Product (' + o.product_id + ')', price_monthly: 0, price_lifetime: 0 },
                    profiles: { full_name: 'Raw User', email: o.user_id, ib_status: 'none', ib_expiry_date: null, is_tester: false }
                }));
                setOrders(mappedData);
            } else {
                setOrders([]);
            }
        }
        setLoading(false);
    };

    const handleApproveClick = (order: any) => {
        if (order.plan_type === 'upgrade') {
            const confirmMsg = `🚀 ยืนยันอนุมัติคำขออัปเกรดเป็น EasyM Prime สำหรับพอร์ต ${order.account_number}?\n\n• ระบบจะอัปเกรด License เป็น EasyM Prime (Tier Pro)\n• ได้รับสิทธิ์ใช้งานฟรี 60 วัน (2 เดือนเต็ม)\n• สามารถดาวน์โหลดไฟล์ EA และเข้าถึงระบบ Live Farm ได้ทันที`;
            if (!confirm(confirmMsg)) return;

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 60); // 2 months free
            handleApprove(order, expiryDate);
            return;
        }

        if (order.is_ib_request) {
            setSelectedOrder(order);
            const baseDate = (order.existing_license?.expiry_date && new Date(order.existing_license.expiry_date) > new Date())
                ? new Date(order.existing_license.expiry_date)
                : new Date();
            const date = new Date(baseDate);
            date.setMonth(date.getMonth() + 6);
            setCustomDate(date.toISOString().split('T')[0]);
            setExpiryOption("6months");
            setApproveModalOpen(true);
        } else {
            handleApprove(order);
        }
    };

    const submitIbApproval = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) return;

        let finalExpiryDate: Date;
        const baseDate = (selectedOrder.existing_license?.expiry_date && new Date(selectedOrder.existing_license.expiry_date) > new Date())
            ? new Date(selectedOrder.existing_license.expiry_date)
            : new Date();

        if (expiryOption === "1month") {
            const date = new Date(baseDate);
            date.setMonth(date.getMonth() + 1);
            finalExpiryDate = date;
        } else if (expiryOption === "6months") {
            const date = new Date(baseDate);
            date.setMonth(date.getMonth() + 6);
            finalExpiryDate = date;
        } else if (expiryOption === "1year") {
            const date = new Date(baseDate);
            date.setFullYear(date.getFullYear() + 1);
            finalExpiryDate = date;
        } else {
            finalExpiryDate = new Date(customDate);
        }

        handleApprove(selectedOrder, finalExpiryDate);
    };

    const handleApprove = async (order: any, customExpiryDate?: Date) => {
        const confirmMsg = order.is_renewal
            ? 'ยืนยันอนุมัติ "ต่ออายุ" คำสั่งซื้อนี้? License เดิมจะได้รับการขยายเวลาใช้งานทันที'
            : 'ยืนยันอนุมัติคำสั่งซื้อนี้? License จะถูกสร้าง/ต่ออายุทันที';
        if (!customExpiryDate && !confirm(confirmMsg)) return;

        setApproveModalOpen(false);
        setProcessingId(order.id);
        try {
            const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'completed' })
                .eq('id', order.id);

            if (orderError) throw orderError;

            // ==========================================
            // AFFILIATE COMMISSION LOGIC
            // ==========================================
            if (!order.is_ib_request && order.amount > 0) {
                // 1. Get the buyer's referred_by ID
                const { data: buyerProfile } = await supabase
                    .from('profiles')
                    .select('referred_by')
                    .eq('id', order.user_id)
                    .single();

                if (buyerProfile && buyerProfile.referred_by) {
                    const affiliateId = buyerProfile.referred_by;

                    // 2. Get the Affiliate's current commission rate
                    const { data: affiliateProfile } = await supabase
                        .from('profiles')
                        .select('commission_rate, accumulated_commission')
                        .eq('id', affiliateId)
                        .single();

                    if (affiliateProfile) {
                        const commissionRate = affiliateProfile.commission_rate || 2.0;

                        // 3. Calculate Commission amount
                        // e.g. 1000 * (2 / 100) = 20
                        const commissionAmount = order.amount * (commissionRate / 100);

                        // 4. Insert into commission_history
                        const { error: historyError } = await supabase
                            .from('commission_history')
                            .insert({
                                affiliate_id: affiliateId,
                                buyer_id: order.user_id,
                                order_id: order.id,
                                amount: commissionAmount
                            });

                        if (historyError) {
                            console.error('Error inserting commission history:', historyError);
                            // Not throwing to avoid blocking the user's license generation,
                            // but ideally this should be a transaction.
                        } else {
                            // 5. Update accumulated_commission
                            const newAccumulated = (Number(affiliateProfile.accumulated_commission) || 0) + commissionAmount;

                            const { error: updateProfileError } = await supabase
                                .from('profiles')
                                .update({ accumulated_commission: newAccumulated })
                                .eq('id', affiliateId);

                            if (updateProfileError) {
                                console.error('Error updating accumulated_commission:', updateProfileError);
                            }
                        }
                    }
                }
            }
            // ==========================================
            // END AFFILIATE COMMISSION LOGIC
            // ==========================================

            const accountNumbersToProcess = order.account_number ? order.account_number.split(',').map((p: string) => p.trim()).filter(Boolean) : [];

            if (accountNumbersToProcess.length === 0) {
                throw new Error("ไม่พบเลขพอร์ตในออเดอร์ หรือ ข้อมูลพอร์ตว่างเปล่า");
            }

            // Determine license data once for the whole order (ensures all ports in multi-port get same data)
            let commonExpiryDate: string | null = null;
            let commonLicenseType = order.is_ib_request ? 'ib' : (order.plan_type || 'lifetime');
            let targetProductId = order.product_id;

            if (order.plan_type === 'upgrade') {
                commonLicenseType = 'pro';
                if (customExpiryDate) {
                    commonExpiryDate = customExpiryDate.toISOString();
                } else {
                    const d = new Date();
                    d.setDate(d.getDate() + 60); // 2 months
                    commonExpiryDate = d.toISOString();
                }

                // Retrieve EasyM Prime product ID
                const { data: primeProd } = await supabase
                    .from('products')
                    .select('id')
                    .eq('product_key', 'EZM-PRIME-V1')
                    .maybeSingle();

                if (primeProd) {
                    targetProductId = primeProd.id;
                }
            } else if (order.is_ib_request) {
                // IB Request gets the admin-specified expiry date
                if (customExpiryDate) {
                    commonExpiryDate = customExpiryDate.toISOString();
                } else {
                    // Fallback to 1 year
                    const date = new Date();
                    date.setFullYear(date.getFullYear() + 1);
                    commonExpiryDate = date.toISOString();
                }
            } else {
                // For non-IB (rental/lifetime), extend from current expiry if in the future, or from Today
                let startDate = new Date();
                if (order.existing_license?.expiry_date && new Date(order.existing_license.expiry_date) > startDate) {
                    startDate = new Date(order.existing_license.expiry_date);
                }
                if (order.plan_type === 'monthly') {
                    startDate.setMonth(startDate.getMonth() + 1);
                    commonExpiryDate = startDate.toISOString();
                } else if (order.plan_type === 'quarterly') {
                    startDate.setMonth(startDate.getMonth() + 3);
                    commonExpiryDate = startDate.toISOString();
                } else {
                    commonExpiryDate = new Date(9999, 11, 31).toISOString();
                }
            }

            // Loop through each port for Multi-Port support
            for (const port of accountNumbersToProcess) {
                // If it's an upgrade order, check for existing license by Account Number (across any product, e.g. EasyM Max/mini)
                let existingLicense: any = null;
                if (order.plan_type === 'upgrade') {
                    const { data: portLicenses } = await supabase
                        .from('licenses')
                        .select('*')
                        .eq('account_number', port);
                    existingLicense = portLicenses && portLicenses.length > 0 ? portLicenses[0] : null;
                } else {
                    const { data: existingLicenses, error: licenseCheckError } = await supabase
                        .from('licenses')
                        .select('*')
                        .eq('product_id', order.product_id)
                        .eq('account_number', port); // exact match

                    if (licenseCheckError) console.error('Error checking license:', licenseCheckError);
                    existingLicense = existingLicenses && existingLicenses.length > 0 ? existingLicenses[0] : null;
                }

                console.log('Match Found for port', port, ':', existingLicense);
                console.log('Applying Data for', port, ':', { type: commonLicenseType, expiry: commonExpiryDate, product_id: targetProductId });

                if (existingLicense) {
                    // Update existing license
                    console.log('Updating License ID:', existingLicense.id);
                    const { error: updateError } = await supabase
                        .from('licenses')
                        .update({
                            user_id: order.user_id,
                            product_id: targetProductId,
                            type: commonLicenseType,
                            is_active: true,
                            expiry_date: commonExpiryDate,
                            ...(order.ib_broker_name && { ib_broker_name: order.ib_broker_name }),
                            is_ib_request: order.is_ib_request // flag it as IB if it is one
                        })
                        .eq('id', existingLicense.id);

                    if (updateError) {
                        console.error('Update Error:', updateError);
                        throw updateError;
                    }

                } else {
                    // Create new license
                    console.log('Creating New License for', port);
                    const { error: licenseError } = await supabase
                        .from('licenses')
                        .insert({
                            user_id: order.user_id,
                            product_id: targetProductId,
                            type: commonLicenseType,
                            is_active: true,
                            expiry_date: commonExpiryDate,
                            account_number: port,
                            ib_broker_name: order.ib_broker_name || null,
                            is_ib_request: order.is_ib_request
                        });

                    if (licenseError) {
                        console.error('Insert Error:', licenseError);
                        throw licenseError;
                    }
                }
            }

            alert(`อนุมัติเรียบร้อย! ระบบจัดการ License ให้แล้วจำนวน ${accountNumbersToProcess.length} พอร์ต`);

            fetchOrders();

        } catch (error: any) {
            console.error(error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm('ต้องการปฏิเสธคำสั่งซื้อนี้? License ที่เกี่ยวข้องจะถูกระงับทันที')) return;

        setProcessingId(id);
        try {
            // 1. Get Order Details
            const { data: order, error: fetchError } = await supabase
                .from('orders')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            // 2. Reject Order
            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'rejected' })
                .eq('id', id);

            if (updateError) throw updateError;

            // 3. Deactivate License (if exists)
            if (order.account_number && order.product_id) {
                const portsToDeactivate = order.account_number.split(',').map((p: string) => p.trim()).filter(Boolean);
                
                if (portsToDeactivate.length > 0) {
                    const { error: licenseError } = await supabase
                        .from('licenses')
                        .update({ is_active: false })
                        .eq('user_id', order.user_id)
                        .eq('product_id', order.product_id)
                        .in('account_number', portsToDeactivate); // Use .in() for multiple ports

                    if (licenseError) {
                        console.error('Error deactivating licenses:', licenseError);
                        alert('Order rejected but failed to deactivate some licenses. Please check database.');
                    }
                }
            }

            fetchOrders();
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    // Filter Logic
    const filteredOrders = orders.filter(order => {
        // Test Accounts Filter
        if (hideTestAccounts && order.profiles?.is_tester) return false;

        // Status Filter
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;

        // Search Filter
        const searchLower = searchQuery.toLowerCase();
        const matchesProduct = order.products?.name?.toLowerCase().includes(searchLower);
        const matchesUser = order.profiles?.full_name?.toLowerCase().includes(searchLower) ||
            order.profiles?.email?.toLowerCase().includes(searchLower);
        const matchesAccount = order.account_number?.toLowerCase().includes(searchLower);
        const matchesRenewal = (searchLower.includes('ต่ออายุ') || searchLower.includes('renew')) && order.is_renewal;

        return matchesProduct || matchesUser || matchesAccount || matchesRenewal || searchQuery === '';
    }).sort((a, b) => {
        // Sort Logic
        if (sortOrder === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortOrder === 'amount-high') return b.amount - a.amount;
        if (sortOrder === 'amount-low') return a.amount - b.amount;
        return 0;
    });

    const baseOrdersForTabs = hideTestAccounts ? orders.filter(o => !o.profiles?.is_tester) : orders;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent pb-1">รายการสั่งซื้อ</h1>
                    <p className="text-muted-foreground">จัดการและตรวจสอบคำสั่งซื้อทั้งหมด</p>
                </div>
                <Button variant="outline" onClick={fetchOrders} size="sm" className="hidden md:flex">
                    <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center bg-card/50 p-4 rounded-xl border border-border/50">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหา Product, ลูกค้า, หรือ Port Number..."
                        className="pl-9 bg-background/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground mr-2 cursor-pointer border rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors">
                        <input 
                            type="checkbox" 
                            className="rounded text-primary border-muted-foreground focus:ring-primary h-4 w-4"
                            checked={hideTestAccounts}
                            onChange={(e) => setHideTestAccounts(e.target.checked)}
                        />
                        ซ่อนบัญชีทดสอบ
                    </label>
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={sortOrder} onValueChange={setSortOrder}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="เรียงลำดับ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">ล่าสุด (Newest)</SelectItem>
                            <SelectItem value="oldest">เก่าที่สุด (Oldest)</SelectItem>
                            <SelectItem value="amount-high">ยอดเงินสูง (High - Low)</SelectItem>
                            <SelectItem value="amount-low">ยอดเงินต่ำ (Low - High)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Tabs defaultValue="all" value={statusFilter} onValueChange={setStatusFilter} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="all">ทั้งหมด ({baseOrdersForTabs.length})</TabsTrigger>
                    <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-500">
                        รอตรวจสอบ ({baseOrdersForTabs.filter(o => o.status === 'pending').length})
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-500">
                        อนุมัติแล้ว ({baseOrdersForTabs.filter(o => o.status === 'completed').length})
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500">
                        ปฏิเสธ ({baseOrdersForTabs.filter(o => o.status === 'rejected').length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={statusFilter} className="mt-0">
                    {loading ? (
                        <div className="flex justify-center p-12 text-muted-foreground">
                            <Loader2 className="animate-spin mr-2" /> กำลังโหลดข้อมูล...
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredOrders.length > 0 ? filteredOrders.map((order) => (
                                <Card 
                                    key={order.id} 
                                    className={`transition-all duration-200 hover:bg-muted/5 ${
                                        order.status === 'pending' 
                                            ? order.is_renewal
                                                ? 'border-amber-500/70 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-card shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                                                : 'border-primary/50 bg-primary/5' 
                                            : 'opacity-90'
                                    }`}
                                >
                                    <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                        {/* Slip Preview */}
                                        <div className="w-full md:w-32 h-48 md:h-32 bg-black/20 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border relative group cursor-pointer">
                                            {order.is_ib_request ? (
                                                <div className={`text-xs flex flex-col items-center justify-center p-2 text-center h-full w-full ${order.is_renewal ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                    {order.is_renewal ? (
                                                        <RotateCw className="w-8 h-8 mb-1.5 text-amber-400" />
                                                    ) : (
                                                        <Zap className="w-8 h-8 mb-2" />
                                                    )}
                                                    <span className="font-bold">
                                                        {order.is_renewal ? 'ต่ออายุสิทธิ์ IB' : `IB ${order.ib_broker_name || 'Request'}`}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground">{order.ib_broker_name || 'Free License'}</span>
                                                </div>
                                            ) : order.slip_url ? (
                                                <a href={order.slip_url} target="_blank" rel="noreferrer" className="w-full h-full">
                                                    <img src={order.slip_url} alt="Slip" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <Search className="text-white w-6 h-6" />
                                                    </div>
                                                </a>
                                            ) : (
                                                <div className="text-xs text-muted-foreground flex flex-col items-center">
                                                    <FileText className="mb-1" /> No Slip
                                                </div>
                                            )}
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 space-y-1.5 w-full">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-bold text-lg text-primary">
                                                            {order.products?.name || 'Unknown Product'}
                                                        </h3>
                                                        {order.plan_type === 'upgrade' ? (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 text-cyan-300 border border-cyan-400/50 shadow-lg shadow-cyan-500/20 animate-pulse">
                                                                <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> 🚀 ขออัปเกรด (UPGRADE TO PRIME)
                                                            </span>
                                                        ) : order.is_renewal ? (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm animate-pulse">
                                                                <RotateCw className="w-3 h-3" /> ขอต่ออายุพอร์ตเดิม (Renewal)
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                                ✨ สั่งซื้อใหม่ (New Order)
                                                            </span>
                                                        )}
                                                        {order.is_ib_request && (
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                                คำขอสิทธิ์ IB {order.ib_broker_name ? `(${order.ib_broker_name})` : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                                                        <span className="flex items-center gap-1.5 flex-wrap">
                                                            ลูกค้า: <span className="font-medium text-foreground">{order.profiles?.full_name || 'Guest'}</span>
                                                            {order.profiles?.email && (
                                                                <span className="text-[11px] px-1.5 py-0.5 bg-muted rounded border border-border/50 text-muted-foreground flex items-center gap-1">
                                                                    <Mail className="w-3 h-3" /> {order.profiles.email}
                                                                </span>
                                                            )}
                                                        </span>
                                                        {order.profiles?.is_tester && (
                                                            <span className="text-[10px] text-orange-500 font-bold ml-1 bg-orange-500/10 px-1 rounded uppercase">Tester</span>
                                                        )}
                                                        {!order.is_ib_request && (
                                                            <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                                                                {order.plan_type === 'upgrade' ? 'อัปเกรด Prime (ทดลองฟรี 2 เดือน)' :
                                                                    order.plan_type === 'monthly' ? 'รายเดือน' :
                                                                        order.plan_type === 'quarterly' ? 'ราย 3 เดือน' :
                                                                            'ตลอดชีพ'}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-bold font-mono">
                                                        {order.is_ib_request ? '฿0' : `฿${order.amount?.toLocaleString()}`}
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${order.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                                        order.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                                                            'bg-yellow-500/20 text-yellow-500'
                                                        }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-3.5 bg-muted/30 rounded-lg border border-border/50">
                                                <div className="flex flex-col gap-1 overflow-hidden">
                                                    <span className="text-muted-foreground text-xs">Account Port:</span>
                                                    <span className="font-mono font-bold text-accent break-all">{order.account_number || '-'}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 md:items-end">
                                                    <span className="text-muted-foreground text-xs">สั่งซื้อเมื่อ:</span>
                                                    <span className="font-medium text-[13px]">{new Date(order.created_at).toLocaleString('th-TH')}</span>
                                                </div>
                                            </div>

                                            {/* Dedicated Renewal Information Box */}
                                            {order.is_renewal && order.existing_license && (
                                                <div className="mt-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1.5">
                                                    <div className="flex items-center justify-between font-bold text-amber-300">
                                                        <span className="flex items-center gap-1.5">
                                                            <RotateCw className="w-3.5 h-3.5" />
                                                            ข้อมูล License พอร์ตเดิมในระบบ (ก่อนต่ออายุ)
                                                        </span>
                                                        <span className={order.existing_license.is_active ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                                                            {order.existing_license.is_active ? "● ปัจจุบันยังเปิดใช้งานอยู่" : "○ หมดอายุแล้ว"}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-300 pt-1 border-t border-amber-500/20">
                                                        <div>
                                                            <span className="text-muted-foreground">วันหมดอายุเดิม:</span>{" "}
                                                            <span className="font-semibold text-amber-200">
                                                                {order.existing_license.type === 'lifetime' 
                                                                    ? 'ตลอดชีพ' 
                                                                    : order.existing_license.expiry_date 
                                                                        ? new Date(order.existing_license.expiry_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
                                                                        : 'ไม่ระบุ'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">ประเภทสิทธิ์เดิม:</span>{" "}
                                                            <span className="font-semibold text-stone-200 uppercase">
                                                                {order.existing_license.type === 'ib' ? 'IB (ฟรี)' : order.existing_license.type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Dedicated Upgrade Information Box */}
                                            {order.plan_type === 'upgrade' && (
                                                <div className="mt-2.5 p-3.5 bg-gradient-to-r from-cyan-950/40 via-purple-950/40 to-slate-900/60 border border-cyan-500/40 rounded-lg text-xs space-y-2 shadow-inner">
                                                    <div className="flex items-center justify-between font-bold text-cyan-300">
                                                        <span className="flex items-center gap-1.5 text-sm">
                                                            <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                                                            คำขอสิทธิ์อัปเกรดสู่ EasyM Prime (ทดลองใช้งานฟรี 2 เดือน)
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-[11px]">
                                                            60 Days Free Trial
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-300 pt-1 border-t border-cyan-500/20">
                                                        <div>
                                                            <span className="text-muted-foreground">พอร์ตที่ขออัปเกรด:</span>{" "}
                                                            <span className="font-bold text-cyan-200 font-mono text-sm">{order.account_number}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">เมื่ออนุมัติ:</span>{" "}
                                                            <span className="font-semibold text-emerald-300">อัปเกรดเป็น Prime Pro + ปลดล็อกดาวน์โหลด EA ทันที</span>
                                                        </div>
                                                        {order.notes && (
                                                            <div className="sm:col-span-2 bg-black/30 p-2 rounded border border-white/5 mt-1">
                                                                <span className="text-muted-foreground">บันทึกเพิ่มเติมจากลูกค้า:</span>{" "}
                                                                <span className="text-stone-200 italic">{order.notes}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {order.status === 'pending' && (
                                            <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 shrink-0">
                                                <Button
                                                    className="w-full md:w-32 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20"
                                                    onClick={() => handleApproveClick(order)}
                                                    disabled={!!processingId}
                                                    size="sm"
                                                >
                                                    {processingId === order.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4 mr-2" />}
                                                    อนุมัติ
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    className="w-full md:w-32 shadow-lg shadow-red-900/20"
                                                    onClick={() => handleReject(order.id)}
                                                    disabled={!!processingId}
                                                    size="sm"
                                                >
                                                    <X className="w-4 h-4 mr-2" /> ปฏิเสธ
                                                </Button>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )) : (
                                <div className="text-center py-16 bg-muted/10 rounded-xl border border-dashed border-border">
                                    <div className="text-muted-foreground mb-2">ไม่พบรายการคำสั่งซื้อ</div>
                                    <p className="text-xs text-muted-foreground/70">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* IB Approve Modal */}
            <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>ยืนยันอนุมัติคำสั่งซื้อ (สิทธิ์ IB)</DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <form onSubmit={submitIbApproval} className="space-y-6 pt-2">
                            {selectedOrder.is_renewal && selectedOrder.existing_license && (
                                <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-lg text-xs space-y-1.5">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-300">
                                        <RotateCw className="w-4 h-4" />
                                        <span>คำสั่งซื้อนี้เป็นการขอต่ออายุ License เดิม</span>
                                    </div>
                                    <p className="text-stone-300">
                                        วันหมดอายุเดิม: <span className="font-semibold text-amber-200">
                                            {selectedOrder.existing_license.type === 'lifetime' 
                                                ? 'ตลอดชีพ' 
                                                : selectedOrder.existing_license.expiry_date 
                                                    ? new Date(selectedOrder.existing_license.expiry_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
                                                    : 'ไม่ระบุ'}
                                        </span>
                                    </p>
                                    <p className="text-[11px] text-amber-400/90 font-medium">
                                        *ระบบจะคำนวณวันหมดอายุใหม่โดยต่อยอดจากวันหมดอายุเดิมให้อัตโนมัติ (หรือปรับเปลี่ยนวันที่ได้ตามต้องการ)
                                    </p>
                                </div>
                            )}
                            <div className="bg-muted/50 p-4 rounded-md border border-border/50 text-sm space-y-2">
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">ลูกค้า:</span> <strong>{selectedOrder.profiles?.full_name || selectedOrder.profiles?.email || 'Guest'}</strong></p>
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">สินค้า:</span> <strong>{selectedOrder.products?.name}</strong></p>
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">Account Port:</span> <strong className="font-mono text-primary">{selectedOrder.account_number || '-'}</strong></p>
                            </div>

                            <div className="space-y-3">
                                <Label>ระยะเวลาอนุมัติ License (วันหมดอายุสิทธิ์)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant={expiryOption === "1month" ? "default" : "outline"}
                                        className={expiryOption === "1month" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("1month")}
                                    >
                                        1 เดือน
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={expiryOption === "6months" ? "default" : "outline"}
                                        className={expiryOption === "6months" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("6months")}
                                    >
                                        6 เดือน
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={expiryOption === "1year" ? "default" : "outline"}
                                        className={expiryOption === "1year" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("1year")}
                                    >
                                        1 ปี
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={expiryOption === "custom" ? "default" : "outline"}
                                        className={expiryOption === "custom" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("custom")}
                                    >
                                        กำหนดเอง
                                    </Button>
                                </div>

                                {expiryOption === "custom" && (
                                    <div className="pt-2">
                                        <Label htmlFor="customDate" className="text-muted-foreground text-xs mb-1.5 block">เลือกวันที่หมดอายุ</Label>
                                        <div className="relative">
                                            <Input
                                                id="customDate"
                                                type="date"
                                                value={customDate}
                                                onChange={(e) => setCustomDate(e.target.value)}
                                                className="pl-9"
                                                min={new Date().toISOString().split('T')[0]}
                                                required={expiryOption === "custom"}
                                            />
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white" disabled={!!processingId}>
                                {!!processingId ? "กำลังดำเนินการ..." : "ยืนยันการสร้าง/ต่ออายุ License"}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
