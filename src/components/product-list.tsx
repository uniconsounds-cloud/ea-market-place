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

export type ProductGroupTab = 'easygold' | 'easym_others' | 'all';

export const isEasyGoldProduct = (p: any): boolean => {
    const key = (p.product_key || '').toUpperCase();
    const name = (p.name || '').toLowerCase();
    const asset = (p.asset_class || '').toLowerCase();
    return key.includes('GOLD') || key.includes('EZG') || name.includes('gold') || asset === 'gold';
};

export function ProductList({ initialProducts }: ProductListProps) {
    const [activeGroup, setActiveGroup] = useState<ProductGroupTab>('all');
    const [products, setProducts] = useState(initialProducts);
    const [isOpen, setIsOpen] = useState(false);
    const [filters, setFilters] = useState({
        platform: '',
        asset_class: '',
        strategy: ''
    });

    const goldCount = initialProducts.filter(isEasyGoldProduct).length;
    const easymCount = initialProducts.filter(p => !isEasyGoldProduct(p)).length;

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

    const handleGroupChange = (newGroup: ProductGroupTab) => {
        setActiveGroup(newGroup);
        applyFilters(filters, newGroup);
    };

    const handleFilterChange = (category: string, value: string) => {
        const newFilters = { ...filters, [category]: filters[category as keyof typeof filters] === value ? '' : value };
        setFilters(newFilters);
        applyFilters(newFilters, activeGroup);
    };

    const clearFilters = () => {
        const newFilters = { platform: '', asset_class: '', strategy: '' };
        setFilters(newFilters);
        applyFilters(newFilters, activeGroup);
    };

    const applyFilters = (currentFilters: typeof filters, currentGroup: ProductGroupTab = activeGroup) => {
        let filtered = initialProducts;

        if (currentGroup === 'easygold') {
            filtered = filtered.filter(isEasyGoldProduct);
        } else if (currentGroup === 'easym_others') {
            filtered = filtered.filter(p => !isEasyGoldProduct(p));
        }

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
        <div className="space-y-4 sm:space-y-5">
            {/* 🌟 2 Main Category Menus (EasyGold vs EasyM & Others) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/40">
                <div className="inline-flex p-1 bg-muted/50 backdrop-blur-md rounded-xl border border-border/60 gap-1.5 overflow-x-auto max-w-full">
                    {/* Menu 1: EasyGold */}
                    <button
                        type="button"
                        onClick={() => handleGroupChange('easygold')}
                        className={`h-9 sm:h-10 flex items-center gap-2 px-4 sm:px-5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeGroup === 'easygold'
                                ? 'bg-gradient-to-r from-amber-500 via-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/30 font-black scale-[1.02]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                    >
                        <span className="text-sm">🥇</span>
                        <span>กลุ่ม EasyGold (ทองคำ)</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                            activeGroup === 'easygold' ? 'bg-black/25 text-slate-950' : 'bg-background/80 text-muted-foreground'
                        }`}>
                            {goldCount}
                        </span>
                    </button>

                    {/* Menu 2: EasyM & Others */}
                    <button
                        type="button"
                        onClick={() => handleGroupChange('easym_others')}
                        className={`h-9 sm:h-10 flex items-center gap-2 px-4 sm:px-5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeGroup === 'easym_others'
                                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-md shadow-blue-500/30 font-black scale-[1.02]'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                    >
                        <span className="text-sm">🌐</span>
                        <span>กลุ่ม EasyM & อื่นๆ (คู่เงิน Forex)</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                            activeGroup === 'easym_others' ? 'bg-white/20 text-white' : 'bg-background/80 text-muted-foreground'
                        }`}>
                            {easymCount}
                        </span>
                    </button>

                    {/* All Products Option */}
                    <button
                        type="button"
                        onClick={() => handleGroupChange('all')}
                        className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                            activeGroup === 'all'
                                ? 'bg-secondary text-secondary-foreground font-bold shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                    >
                        ทั้งหมด ({initialProducts.length})
                    </button>
                </div>

                {/* Sub-filter Toggle Button */}
                <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                    <Button
                        variant={isOpen ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsOpen(!isOpen)}
                        className="h-9 sm:h-10 px-3.5 gap-1.5 text-xs sm:text-sm font-semibold rounded-lg"
                    >
                        <Filter className="w-3.5 h-3.5" />
                        {isOpen ? 'ซ่อนตัวกรองย่อย' : 'ตัวกรองย่อย'}
                    </Button>
                </div>
            </div>

            {/* Active Sub-Filters Summary Bar (if any) */}
            {hasFilters && (
                <div className="flex flex-wrap gap-2 items-center text-xs">
                    <span className="text-muted-foreground">ตัวกรองที่เลือก:</span>
                    {filters.platform && (
                        <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs">
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
                        <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20">
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
                        <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
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
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs text-muted-foreground hover:text-destructive px-2">
                        ล้างทั้งหมด
                    </Button>
                </div>
            )}

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
