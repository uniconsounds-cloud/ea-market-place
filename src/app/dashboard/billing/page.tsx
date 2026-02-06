'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreditCard, QrCode, Loader2 } from 'lucide-react';

export default function BillingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [orders, setOrders] = useState<any[]>([]);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.replace('/login');
            return;
        }

        const { data } = await supabase
            .from('orders')
            .select(`
                *,
                products (
                    name
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (data) setOrders(data);
        setLoading(false);
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
                <h1 className="text-3xl font-bold">การชำระเงิน</h1>
                <p className="text-muted-foreground">จัดการวิธีการชำระเงินและดูประวัติการสั่งซื้อ</p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                <div className="space-y-6">
                    <div className="p-6 rounded-xl bg-card border border-border">
                        <h2 className="text-xl font-bold mb-4">ช่องทางชำระเงิน</h2>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        <QrCode className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">สแกนจ่าย Thai QR</div>
                                        <div className="text-xs text-muted-foreground">PromptPay</div>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm">เริ่มต้น</Button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-lg bg-background border border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <div>
                                        <div className="font-semibold">บัตรเครดิต / เดบิต</div>
                                        <div className="text-xs text-muted-foreground">Visa, Mastercard</div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm">จัดการ</Button>
                            </div>
                        </div>

                        <Button className="w-full mt-6" variant="default" disabled>เพิ่มวิธีการชำระเงิน (เร็วๆนี้)</Button>
                    </div>
                </div>

                <div className="p-6 rounded-xl bg-card border border-border">
                    <h2 className="text-xl font-bold mb-4">ประวัติการชำระเงิน</h2>
                    <div className="space-y-4">
                        {orders.length > 0 ? (
                            orders.map((order) => (
                                <div key={order.id} className="flex justify-between items-center py-3 border-b border-border/50 last:border-0">
                                    <div>
                                        <div className="font-medium">{order.products?.name || 'Order #' + order.id.slice(0, 8)}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {new Date(order.created_at).toLocaleDateString('th-TH')}
                                        </div>
                                        <div className="text-xs font-mono text-muted-foreground mt-1">
                                            Port: {order.account_number || '-'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold">฿{(order.amount || 0).toLocaleString()}</div>
                                        <div className={`text-xs ${order.status === 'completed' ? 'text-green-500' :
                                                order.status === 'rejected' ? 'text-red-500' :
                                                    'text-yellow-500'
                                            }`}>
                                            {order.status === 'completed' ? 'ชำระแล้ว' :
                                                order.status === 'rejected' ? 'ถูกปฏิเสธ' :
                                                    'รอตรวจสอบ'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                ยังไม่มีประวัติการสั่งซื้อ
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
