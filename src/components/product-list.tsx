'use client';

import { useState } from 'react';
import { ProductCard } from '@/components/product-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';

interface ProductListProps {
    initialProducts: any[];
}

export function ProductList({ initialProducts }: ProductListProps) {
    const [products, setProducts] = useState(initialProducts);
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState({
        platform: '',
        asset_class: '',
        strategy: ''
    });

    // ... (categories definition remains same) ...

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

    const handleFilterChange = (category: string, value: string) => {
        const newFilters = { ...filters, [category]: filters[category as keyof typeof filters] === value ? '' : value };
        setFilters(newFilters);
        applyFilters(newFilters);
    };

    const clearFilters = () => {
        const newFilters = { platform: '', asset_class: '', strategy: '' };
        setFilters(newFilters);
        applyFilters(newFilters);
    };

    const applyFilters = (currentFilters: typeof filters) => {
        let filtered = initialProducts;

        if (currentFilters.platform) {
            filtered = filtered.filter(p => p.platform === currentFilters.platform);
        }
        if (currentFilters.asset_class) {
            filtered = filtered.filter(p => p.asset_class === currentFilters.asset_class);
        }
        if (currentFilters.strategy) {
            filtered = filtered.filter(p => p.strategy === currentFilters.strategy);
        }

        setProducts(filtered);
    };

    const hasFilters = filters.platform || filters.asset_class || filters.strategy;

    // Helper to get label
    const getLabel = (category: string, id: string) => {
        return categories[category as keyof typeof categories].find(c => c.id === id)?.label || id;
    };

    return (
        <div className="space-y-6">
            {/* Filter Toggle & Summary Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    variant={isOpen ? "default" : "outline"}
                    onClick={() => setIsOpen(!isOpen)}
                    className="gap-2"
                >
                    <Filter className="w-4 h-4" />
                    {isOpen ? 'ซ่อนตัวกรอง' : 'ตัวกรองสินค้า'}
                </Button>

                {/* Active Filters Summary (Show when collapsed or expanded) */}
                {hasFilters && (
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="h-6 w-[1px] bg-border mx-1" />
                        {filters.platform && (
                            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                                Platform: {getLabel('platform', filters.platform)}
                                <button
                                    type="button"
                                    className="cursor-pointer hover:text-destructive ml-1 focus:outline-none"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFilterChange('platform', filters.platform);
                                    }}
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFilterChange('asset_class', filters.asset_class);
                                    }}
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
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleFilterChange('strategy', filters.strategy);
                                    }}
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
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-sm text-muted-foreground">
                            เลือกตัวกรอง
                        </h3>
                    </div>

                    <div className="space-y-6">
                        {/* Platform */}
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
                            {/* Asset Class */}
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

                            {/* Strategy */}
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

            {/* Results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {products.length > 0 ? (
                    products.map((product: any) => (
                        <ProductCard key={product.id} product={product} />
                    ))
                ) : (
                    <div className="col-span-full text-center py-20 opacity-50">
                        <p>ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
                        <Button variant="link" onClick={clearFilters}>ล้างตัวกรอง</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
