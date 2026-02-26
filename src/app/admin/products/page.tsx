'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        const { data } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setProducts(data);
        setLoading(false);
    };

    // Group products by asset_class
    const groupedProducts = products.reduce((acc, product) => {
        const group = product.asset_class || 'other';
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(product);
        return acc;
    }, {} as Record<string, any[]>);

    const formatAssetClass = (assetClass: string) => {
        const mapping: Record<string, string> = {
            gold: 'Gold (XAUUSD)',
            silver: 'Silver (XAGUSD)',
            currency: 'Forex Pairs',
            crypto: 'Cryptocurrency',
            indices: 'Indices',
            commodities: 'Commodities',
            other: 'Other'
        };
        return mapping[assetClass] || assetClass.charAt(0).toUpperCase() + assetClass.slice(1);
    };

    const formatStrategy = (strategy: string) => {
        const mapping: Record<string, string> = {
            scalping: 'Scalping',
            trend_following: 'Trend Following',
            grid: 'Grid',
            martingale: 'Martingale',
            hedging: 'Hedging',
            swing_trading: 'Swing',
            day_trading: 'Day Trading',
            news_trading: 'News',
            arbitrage: 'Arbitrage'
        };
        return mapping[strategy] || strategy;
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">จัดการสินค้า</h1>
                    <p className="text-muted-foreground">รายการ EA ทั้งหมด ({products.length})</p>
                </div>
                <Link href="/admin/products/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> เพิ่มสินค้าใหม่
                    </Button>
                </Link>
            </div>

            {loading ? (
                <div>กำลังโหลด...</div>
            ) : (
                <div className="space-y-12 pb-8">
                    {Object.keys(groupedProducts).length === 0 ? (
                        <div className="text-center py-12 border rounded-lg bg-card/50">
                            <p className="text-muted-foreground">ยังไม่มีสินค้าในระบบ</p>
                        </div>
                    ) : (
                        (Object.entries(groupedProducts) as [string, any[]][]).map(([assetClass, items]) => (
                            <div key={assetClass} className="space-y-4">
                                <h2 className="text-xl font-semibold border-b pb-2 flex items-center gap-2">
                                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                                    {formatAssetClass(assetClass)}
                                    <Badge variant="secondary" className="ml-2">{items.length}</Badge>
                                </h2>
                                <div className="grid gap-4 overflow-x-auto pb-4">
                                    <div className="min-w-[600px]">
                                        {items.map((product: any) => (
                                            <Card key={product.id} className="overflow-hidden mb-4 hover:border-primary/50 transition-colors">
                                                <CardContent className="p-0 flex items-center justify-between">
                                                    <div className="flex items-center gap-4 p-4">
                                                        <div className="h-20 w-20 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden shrink-0 border">
                                                            {product.image_url ? (
                                                                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                                            ) : (
                                                                <span className="text-xs text-gray-500">No Image</span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-bold text-lg leading-none">{product.name}</h3>
                                                                {product.platform && (
                                                                    <Badge variant="outline" className="text-xs py-0 h-5">
                                                                        {product.platform.toUpperCase()}
                                                                    </Badge>
                                                                )}
                                                                {product.strategy && (
                                                                    <Badge variant="secondary" className="text-xs py-0 h-5">
                                                                        {formatStrategy(product.strategy)}
                                                                    </Badge>
                                                                )}
                                                                <Badge variant={product.is_active ? 'default' : 'destructive'} className="text-xs py-0 h-5">
                                                                    {product.is_active ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </div>
                                                            <div className="text-sm text-muted-foreground flex gap-4">
                                                                <span>รายเดือน: ฿{product.price_monthly?.toLocaleString()}</span>
                                                                {product.price_quarterly && <span>3 เดือน: ฿{product.price_quarterly?.toLocaleString()}</span>}
                                                                <span>ถาวร: ฿{product.price_lifetime?.toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 p-4 shrink-0">
                                                        <Link href={`/admin/products/${product.id}`}>
                                                            <Button variant="outline" size="icon">
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
