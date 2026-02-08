'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Activity, CreditCard, Key, ShoppingCart, Loader2, AlertTriangle, Clock, Calendar, MoreVertical, Download } from 'lucide-react';
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

interface GroupedProduct {
    productId: string;
    productName: string;
    productImage: string;
    fileUrl: string;
    licenses: License[];
}

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);

    useEffect(() => {
        const initData = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }
            setUser(user);

            // Fetch Licenses (with product details)
            const { data: licensesData } = await supabase
                .from('licenses')
                .select(`
                    *,
                    products (
                        id,
                        name,
                        image_url,
                        file_url
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            // Group Licenses by Product
            if (licensesData) {
                const groups: { [key: string]: GroupedProduct } = {};

                licensesData.forEach((l: any) => {
                    const prodId = l.product_id;
                    if (!groups[prodId]) {
                        groups[prodId] = {
                            productId: prodId,
                            productName: l.products?.name || 'Unknown Product',
                            productImage: l.products?.image_url || '',
                            fileUrl: l.products?.file_url || '',
                            licenses: []
                        };
                    }
                    groups[prodId].licenses.push(l);
                });

                // Convert to array
                const groupedArray = Object.values(groups);
                setGroupedProducts(groupedArray);
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
                <p className="text-muted-foreground">จัดการ License และดาวน์โหลด EA ของคุณ</p>
            </div>

            {/* Product List */}
            <div className="space-y-6">
                {groupedProducts.length > 0 ? (
                    groupedProducts.map((group) => (
                        <Card key={group.productId} className="overflow-hidden">
                            <CardHeader className="bg-muted/30 py-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border border-border">
                                            {group.productImage ? (
                                                <img src={group.productImage} alt={group.productName} className="h-full w-full object-cover" />
                                            ) : (
                                                <Key className="h-6 w-6 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{group.productName}</CardTitle>
                                            <p className="text-sm text-muted-foreground">{group.licenses.length} License ที่ครอบครอง</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {group.fileUrl && (
                                            <a href={group.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <Button size="sm" variant="outline" className="gap-2">
                                                    <Download className="h-4 w-4" />
                                                    ดาวน์โหลด EA
                                                </Button>
                                            </a>
                                        )}
                                        <Link href={`/products/${group.productId}`}>
                                            <Button size="sm">ซื้อเพิ่ม</Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {group.licenses.map((license) => {
                                        const timeInfo = calculateTimeRemaining(license.expiry_date, license.type);
                                        return (
                                            <div key={license.id} className="p-4 hover:bg-muted/10 transition-colors">
                                                <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">

                                                    {/* Port Info */}
                                                    <div className="flex items-center gap-3 min-w-[200px]">
                                                        <div className={`p-2 rounded-full ${license.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                            <Activity className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <div className="font-mono font-medium">Port: {license.account_number || 'ยังไม่ระบุ'}</div>
                                                            <div className="text-xs text-muted-foreground capitalize">{license.type} Plan</div>
                                                        </div>
                                                    </div>

                                                    {/* Status & Expiry */}
                                                    <div className="flex-1 max-w-md space-y-2">
                                                        <div className="flex justify-between text-xs">
                                                            <div className="flex items-center gap-1 text-muted-foreground">
                                                                <Clock className="h-3 w-3" />
                                                                <span>สถานะ: {license.is_active ? 'Active' : 'Expired'}</span>
                                                            </div>
                                                            <span className={`font-medium ${timeInfo.days <= 7 && license.type !== 'lifetime' ? 'text-red-500' : ''}`}>
                                                                {timeInfo.label}
                                                            </span>
                                                        </div>
                                                        {license.type !== 'lifetime' && (
                                                            <Progress value={timeInfo.percent} className="h-1.5" indicatorClassName={timeInfo.color} />
                                                        )}
                                                        {license.type === 'lifetime' && (
                                                            <div className="h-1.5 w-full bg-green-500/20 rounded-full relative overflow-hidden">
                                                                <div className="absolute inset-0 bg-green-500 w-full" />
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                                            <span>เริ่ม: {new Date(license.created_at).toLocaleDateString('th-TH')}</span>
                                                            <span>หมด: {license.type === 'lifetime' ? 'ตลอดชีพ' : new Date(license.expiry_date).toLocaleDateString('th-TH')}</span>
                                                        </div>
                                                    </div>

                                                    {/* Action */}
                                                    <div className="flex justify-end min-w-[100px]">
                                                        {!license.is_active || (license.type !== 'lifetime' && timeInfo.days <= 30) ? (
                                                            <Link href={`/products/${group.productId}?renew=${license.account_number}`}>
                                                                <Button size="sm" variant="secondary" className="h-8 text-xs">
                                                                    ต่ออายุ
                                                                </Button>
                                                            </Link>
                                                        ) : (
                                                            <Badge variant="outline" className="h-8 px-3 text-green-500 border-green-500/30 bg-green-500/5">
                                                                ปกติ
                                                            </Badge>
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
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                            <div className="p-4 bg-muted rounded-full mb-4">
                                <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">ยังไม่มีรายการสินค้า</h3>
                            <p className="max-w-sm mt-2 mb-6 text-sm">เลือกซื้อ EA ที่เหมาะกับสไตล์การเทรดของคุณได้เลย</p>
                            <Link href="/">
                                <Button>ไปที่ร้านค้า</Button>
                            </Link>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
