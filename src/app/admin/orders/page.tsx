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
import { Check, X, Search, FileText, Loader2, Filter } from 'lucide-react';

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Filter & Sort State
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest');

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setLoading(true);

        // Use explicit foreign key names to avoid ambiguity
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                products!orders_product_id_fkey (name, price_monthly, price_lifetime),
                profiles!orders_user_id_profiles_fkey (full_name, email)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching orders:', error);
        }

        if (data && data.length > 0) {
            setOrders(data);
        } else {
            console.log('Main fetch returned empty. Trying raw fetch...');
            const { data: rawData } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (rawData) {
                const mappedData = rawData.map(o => ({
                    ...o,
                    products: { name: 'Raw Product (' + o.product_id + ')', price_monthly: 0, price_lifetime: 0 },
                    profiles: { full_name: 'Raw User', email: o.user_id }
                }));
                setOrders(mappedData);
            }
        }
        setLoading(false);
    };

    const handleApprove = async (order: any) => {
        if (!confirm('ยืนยันอนุมัติคำสั่งซื้อนี้? License จะถูกสร้าง/ต่ออายุทันที')) return;

        setProcessingId(order.id);
        try {
            const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'completed' })
                .eq('id', order.id);

            if (orderError) throw orderError;

            // Check for existing license (Robust matching)
            const { data: userLicenses } = await supabase
                .from('licenses')
                .select('*')
                .eq('user_id', order.user_id)
                .eq('product_id', order.product_id);

            const existingLicense = userLicenses?.find(l =>
                l.account_number.trim() === order.account_number.trim()
            );

            let expiryDate = null;
            let startDate = new Date();

            if (existingLicense) {
                // RENEWAL LOGIC
                // extend from current expiry if it's in the future, otherwise from today
                const currentExpiry = new Date(existingLicense.expiry_date);
                if (currentExpiry > startDate) {
                    startDate = currentExpiry;
                }
            }

            if (order.plan_type === 'monthly') {
                const date = new Date(startDate);
                date.setMonth(date.getMonth() + 1);
                expiryDate = date.toISOString();
            } else if (order.plan_type === 'quarterly') {
                const date = new Date(startDate);
                date.setMonth(date.getMonth() + 3);
                expiryDate = date.toISOString();
            } else {
                expiryDate = new Date(9999, 11, 31).toISOString();
            }

            if (existingLicense) {
                // Update existing license
                const { error: updateError } = await supabase
                    .from('licenses')
                    .update({
                        type: order.plan_type || 'lifetime',
                        is_active: true,
                        expiry_date: expiryDate
                    })
                    .eq('id', existingLicense.id);

                if (updateError) throw updateError;
                alert('อนุมัติเรียบร้อย! License ถูกต่ออายุแล้ว');

            } else {
                // Create new license
                const { error: licenseError } = await supabase
                    .from('licenses')
                    .insert({
                        user_id: order.user_id,
                        product_id: order.product_id,
                        type: order.plan_type || 'lifetime',
                        is_active: true,
                        expiry_date: expiryDate,
                        account_number: order.account_number || ''
                    });

                if (licenseError) throw licenseError;
                alert('อนุมัติเรียบร้อย! License ถูกสร้างแล้ว');
            }

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
                const { error: licenseError } = await supabase
                    .from('licenses')
                    .update({ is_active: false })
                    .eq('user_id', order.user_id)
                    .eq('product_id', order.product_id)
                    .eq('account_number', order.account_number);

                if (licenseError) {
                    console.error('Error deactivating license:', licenseError);
                    // Don't throw here, as order is already rejected. Just warn.
                    alert('Order rejected but failed to deactivate license. Please check database.');
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
        // Status Filter
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;

        // Search Filter
        const searchLower = searchQuery.toLowerCase();
        const matchesProduct = order.products?.name?.toLowerCase().includes(searchLower);
        const matchesUser = order.profiles?.full_name?.toLowerCase().includes(searchLower) ||
            order.profiles?.email?.toLowerCase().includes(searchLower);
        const matchesAccount = order.account_number?.toLowerCase().includes(searchLower);

        return matchesProduct || matchesUser || matchesAccount || searchQuery === '';
    }).sort((a, b) => {
        // Sort Logic
        if (sortOrder === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortOrder === 'amount-high') return b.amount - a.amount;
        if (sortOrder === 'amount-low') return a.amount - b.amount;
        return 0;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">รายการสั่งซื้อ</h1>
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

                <div className="flex items-center gap-2 w-full md:w-auto">
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
                    <TabsTrigger value="all">ทั้งหมด ({orders.length})</TabsTrigger>
                    <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-500/10 data-[state=active]:text-yellow-500">
                        รอตรวจสอบ ({orders.filter(o => o.status === 'pending').length})
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-500">
                        อนุมัติแล้ว ({orders.filter(o => o.status === 'completed').length})
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500">
                        ปฏิเสธ ({orders.filter(o => o.status === 'rejected').length})
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
                                <Card key={order.id} className={`transition-all duration-200 hover:bg-muted/5 ${order.status === 'pending' ? 'border-primary/50 bg-primary/5' : 'opacity-90'}`}>
                                    <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                        {/* Slip Preview */}
                                        <div className="w-full md:w-32 h-48 md:h-32 bg-black/20 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border relative group cursor-pointer">
                                            {order.slip_url ? (
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
                                                    <h3 className="font-bold text-lg text-primary">{order.products?.name || 'Unknown Product'}</h3>
                                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <span>ลูกค้า: {order.profiles?.full_name || order.profiles?.email || 'Guest'}</span>
                                                        <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                                                            {order.plan_type === 'monthly' ? 'รายเดือน' :
                                                                order.plan_type === 'quarterly' ? 'ราย 3 เดือน' :
                                                                    'ตลอดชีพ'}
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xl font-bold font-mono">฿{order.amount?.toLocaleString()}</div>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${order.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                                        order.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                                                            'bg-yellow-500/20 text-yellow-500'
                                                        }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mt-2 p-3 bg-muted/30 rounded-lg">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Account Port:</span>
                                                    <span className="font-mono font-bold text-accent">{order.account_number || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">สั่งซื้อเมื่อ:</span>
                                                    <span>{new Date(order.created_at).toLocaleString('th-TH')}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        {order.status === 'pending' && (
                                            <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0 shrink-0">
                                                <Button
                                                    className="w-full md:w-32 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20"
                                                    onClick={() => handleApprove(order)}
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
        </div>
    );
}
