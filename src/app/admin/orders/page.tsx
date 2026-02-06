'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X, Search, FileText, Loader2 } from 'lucide-react';

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

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
            // Fallback: Fetch raw orders if joins fail (or if no joined data found)
            console.log('Main fetch returned empty. Trying raw fetch...');
            const { data: rawData, error: rawError } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (rawData) {
                console.log('Raw fetch result:', rawData);
                // Map raw data to match structure (partially) so it renders
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
        if (!confirm('ยืนยันอนุมัติคำสั่งซื้อนี้? License จะถูกสร้างทันที')) return;

        setProcessingId(order.id);
        try {
            // 1. Update Order Status
            const { error: orderError } = await supabase
                .from('orders')
                .update({ status: 'completed' })
                .eq('id', order.id);

            if (orderError) throw orderError;

            // 2. Create License
            // Calculate expiry based on plan_type
            let expiryDate = null;
            if (order.plan_type === 'monthly') {
                const date = new Date();
                date.setMonth(date.getMonth() + 1);
                expiryDate = date.toISOString();
            } else {
                // Lifetime
                expiryDate = new Date(9999, 11, 31).toISOString(); // Far future
            }

            const { error: licenseError } = await supabase
                .from('licenses')
                .insert({
                    user_id: order.user_id,
                    product_id: order.product_id,
                    type: order.plan_type || 'lifetime',
                    is_active: true,
                    expiry_date: expiryDate,
                    account_number: order.account_number || '' // Use account number from order
                });

            if (licenseError) throw licenseError;

            alert('อนุมัติเรียบร้อย! License ถูกสร้างแล้ว');
            fetchOrders(); // Refresh list

        } catch (error: any) {
            console.error(error);
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm('ต้องการปฏิเสธคำสั่งซื้อนี้?')) return;

        setProcessingId(id);
        const { error } = await supabase
            .from('orders')
            .update({ status: 'rejected' })
            .eq('id', id);

        if (error) {
            alert('Error: ' + error.message);
        } else {
            fetchOrders();
        }
        setProcessingId(null);
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">รายการสั่งซื้อ</h1>
                    <p className="text-muted-foreground">ตรวจสอบสลิปและอนุมัติคำสั่งซื้อ</p>
                </div>
                <Button variant="outline" onClick={fetchOrders}><Search className="w-4 h-4 mr-2" /> Refresh</Button>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="grid gap-4">
                    {orders.map((order) => (
                        <Card key={order.id} className={order.status === 'pending' ? 'border-primary/50 bg-primary/5' : 'opacity-80'}>
                            <CardContent className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                                {/* Slip Preview */}
                                <div className="w-full md:w-32 h-48 md:h-32 bg-black/20 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border">
                                    {order.slip_url ? (
                                        <a href={order.slip_url} target="_blank" rel="noreferrer">
                                            <img src={order.slip_url} alt="Slip" className="w-full h-full object-cover hover:scale-110 transition-transform" />
                                        </a>
                                    ) : (
                                        <div className="text-xs text-muted-foreground flex flex-col items-center">
                                            <FileText className="mb-1" /> No Slip
                                        </div>
                                    )}
                                </div>

                                {/* Details */}
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between">
                                        <h3 className="font-bold text-lg">{order.products?.name || 'Unknown Product'}</h3>
                                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold ${order.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                            order.status === 'rejected' ? 'bg-red-500/20 text-red-500' :
                                                'bg-yellow-500/20 text-yellow-500'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        ลูกค้า: <span className="text-foreground">{order.profiles?.full_name || order.profiles?.email || order.user_id}</span>
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        ประเภท: <span className="text-primary font-medium uppercase">{order.plan_type}</span>
                                    </p>
                                    <p className="text-sm font-semibold text-accent">
                                        Account No: {order.account_number || '-'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        วันที่: {new Date(order.created_at).toLocaleString('th-TH')}
                                    </p>
                                    <div className="text-xl font-bold mt-2">฿{order.amount?.toLocaleString()}</div>
                                </div>

                                {/* Actions */}
                                {order.status === 'pending' && (
                                    <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto mt-4 md:mt-0">
                                        <Button
                                            className="w-full md:w-32 bg-green-600 hover:bg-green-700"
                                            onClick={() => handleApprove(order)}
                                            disabled={!!processingId}
                                        >
                                            {processingId === order.id ? <Loader2 className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4 mr-2" />}
                                            อนุมัติ
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            className="w-full md:w-32"
                                            onClick={() => handleReject(order.id)}
                                            disabled={!!processingId}
                                        >
                                            <X className="w-4 h-4 mr-2" /> ปฏิเสธ
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                    {orders.length === 0 && <div className="text-center py-12 text-muted-foreground">ไม่มีคำสั่งซื้อ</div>}
                </div>
            )}
        </div>
    );
}
