'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, ArrowRight, Filter, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export default function AdminProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // --- Filter State ---
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState({
        platform: '',
        asset_class: '',
        strategy: ''
    });

    const categories = {
        platform: [
            { id: 'mt4', label: 'MT4' },
            { id: 'mt5', label: 'MT5' }
        ],
        asset_class: [
            { id: 'gold', label: 'Gold (XAUUSD)' },
            { id: 'silver', label: 'Silver' },
            { id: 'currency', label: 'Forex Pairs' },
            { id: 'crypto', label: 'Crypto' },
            { id: 'indices', label: 'Indices' },
            { id: 'commodities', label: 'Commodities' }
        ],
        strategy: [
            { id: 'scalping', label: 'Scalping' },
            { id: 'trend_following', label: 'Trend' },
            { id: 'grid', label: 'Grid' },
            { id: 'martingale', label: 'Martingale' },
            { id: 'hedging', label: 'Hedging' },
            { id: 'swing_trading', label: 'Swing' },
            { id: 'day_trading', label: 'Day Trading' },
            { id: 'news_trading', label: 'News' },
            { id: 'arbitrage', label: 'Arbitrage' }
        ]
    };

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

    // --- Filter Logic ---
    const handleFilterChange = (category: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [category]: prev[category as keyof typeof prev] === value ? '' : value
        }));
    };

    const clearFilters = () => {
        setFilters({ platform: '', asset_class: '', strategy: '' });
    };

    const filteredProducts = products.filter(p => {
        if (filters.platform && p.platform !== filters.platform) return false;
        if (filters.asset_class && p.asset_class !== filters.asset_class) return false;
        if (filters.strategy && p.strategy !== filters.strategy) return false;
        return true;
    });

    const hasFilters = filters.platform || filters.asset_class || filters.strategy;

    const getLabel = (category: string, id: string) => {
        return categories[category as keyof typeof categories].find(c => c.id === id)?.label || id;
    };

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
                <div className="space-y-6 pb-8">

                    {/* -- Filter Bar -- */}
                    <div className="bg-card p-4 rounded-xl border shadow-sm">
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                variant={isOpen ? "default" : "outline"}
                                onClick={() => setIsOpen(!isOpen)}
                                className="gap-2"
                            >
                                <Filter className="w-4 h-4" />
                                {isOpen ? 'ซ่อนตัวกรอง' : 'ตัวกรองสินค้า'}
                            </Button>

                            {/* Active Filters Summary */}
                            {hasFilters && (
                                <div className="flex flex-wrap gap-2 items-center">
                                    <div className="h-6 w-[1px] bg-border mx-1" />
                                    {filters.platform && (
                                        <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                                            Platform: {getLabel('platform', filters.platform)}
                                            <button
                                                type="button"
                                                className="cursor-pointer hover:text-destructive ml-1 focus:outline-none"
                                                onClick={(e) => { e.stopPropagation(); handleFilterChange('platform', filters.platform); }}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    )}
                                    {filters.asset_class && (
                                        <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">
                                            Asset: {getLabel('asset_class', filters.asset_class)}
                                            <button
                                                type="button"
                                                className="cursor-pointer hover:text-destructive ml-1 focus:outline-none"
                                                onClick={(e) => { e.stopPropagation(); handleFilterChange('asset_class', filters.asset_class); }}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    )}
                                    {filters.strategy && (
                                        <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
                                            Strategy: {getLabel('strategy', filters.strategy)}
                                            <button
                                                type="button"
                                                className="cursor-pointer hover:text-destructive ml-1 focus:outline-none"
                                                onClick={(e) => { e.stopPropagation(); handleFilterChange('strategy', filters.strategy); }}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </Badge>
                                    )}
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground hover:text-destructive px-2">
                                        ล้างทั้งหมด
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Collapsible Filter Panel */}
                        {isOpen && (
                            <div className="mt-4 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="space-y-6">
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-2 block">Platform</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {categories.platform.map((item) => (
                                                <Badge
                                                    key={item.id}
                                                    variant={filters.platform === item.id ? 'default' : 'outline'}
                                                    className={`cursor-pointer hover:opacity-80 transition-all ${filters.platform === item.id ? 'bg-primary' : 'bg-background hover:bg-muted'}`}
                                                    onClick={() => handleFilterChange('platform', item.id)}
                                                >
                                                    {item.label}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-2 block">Asset Class</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {categories.asset_class.map((item) => (
                                                    <Badge
                                                        key={item.id}
                                                        variant={filters.asset_class === item.id ? 'default' : 'outline'}
                                                        className={`cursor-pointer hover:opacity-80 transition-all ${filters.asset_class === item.id ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-transparent' : 'bg-background hover:bg-muted'}`}
                                                        onClick={() => handleFilterChange('asset_class', item.id)}
                                                    >
                                                        {item.label}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-xs text-muted-foreground mb-2 block">Strategy</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {categories.strategy.map((item) => (
                                                    <Badge
                                                        key={item.id}
                                                        variant={filters.strategy === item.id ? 'default' : 'outline'}
                                                        className={`cursor-pointer hover:opacity-80 transition-all ${filters.strategy === item.id ? 'bg-blue-500 hover:bg-blue-600 text-white border-transparent' : 'bg-background hover:bg-muted'}`}
                                                        onClick={() => handleFilterChange('strategy', item.id)}
                                                    >
                                                        {item.label}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* -- Products List -- */}
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-12 border rounded-lg bg-card/50">
                            <p className="text-muted-foreground">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
                            {hasFilters && <Button variant="link" onClick={clearFilters}>ล้างตัวกรอง</Button>}
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                            {filteredProducts.map((product: any) => (
                                <Card key={product.id} className="overflow-hidden mb-2 hover:border-primary/50 transition-colors">
                                    <CardContent className="p-0 flex flex-col sm:flex-row sm:items-center justify-between">
                                        <div className="flex items-center gap-4 p-4">
                                            <div className="h-20 w-20 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden shrink-0 border">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-xs text-gray-500">No Image</span>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Link href={`/admin/products/${product.id}`} className="hover:underline">
                                                        <h3 className="font-bold text-lg leading-none">{product.name}</h3>
                                                    </Link>
                                                    {product.platform && (
                                                        <Badge variant="outline" className="text-xs py-0 h-5">
                                                            {product.platform.toUpperCase()}
                                                        </Badge>
                                                    )}
                                                    {product.asset_class && (
                                                        <Badge variant="secondary" className="text-xs py-0 h-5 bg-yellow-500/10 text-yellow-600">
                                                            {getLabel('asset_class', product.asset_class)}
                                                        </Badge>
                                                    )}
                                                    {product.strategy && (
                                                        <Badge variant="secondary" className="text-xs py-0 h-5 bg-blue-500/10 text-blue-600">
                                                            {formatStrategy(product.strategy)}
                                                        </Badge>
                                                    )}
                                                    <Badge variant={product.is_active ? 'default' : 'destructive'} className="text-xs py-0 h-5">
                                                        {product.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground flex flex-wrap gap-4">
                                                    <span>รายเดือน: ฿{product.price_monthly?.toLocaleString()}</span>
                                                    {product.price_quarterly && <span>3 เดือน: ฿{product.price_quarterly?.toLocaleString()}</span>}
                                                    <span>ถาวร: ฿{product.price_lifetime?.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 p-4 sm:shrink-0 bg-muted/20 sm:bg-transparent justify-end">
                                            <Link href={`/admin/products/${product.id}`}>
                                                <Button variant="outline" size="sm">
                                                    <Pencil className="h-4 w-4 mr-2" /> จัดการ
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
