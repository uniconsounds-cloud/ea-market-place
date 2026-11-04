'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
    Plus, 
    Pencil, 
    Filter, 
    X, 
    Sparkles, 
    Eye, 
    EyeOff, 
    CheckCircle2, 
    Trash2, 
    AlertTriangle, 
    Loader2, 
    Coins, 
    Layers 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    fetchStorefrontVisibilityConfig,
    isProductShownOnStore,
    saveProductStorefrontVisibility,
    sweepAndDeactivateExpiredLicenses
} from '@/lib/license-audit';

export default function AdminProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingVisibilityId, setUpdatingVisibilityId] = useState<string | null>(null);
    const [productToDelete, setProductToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

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
        // Auto-deactivate any expired licenses and record audit log ('auto')
        await sweepAndDeactivateExpiredLicenses(supabase);

        const [{ data }, visibilityConfig] = await Promise.all([
            supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false }),
            fetchStorefrontVisibilityConfig(supabase)
        ]);

        if (data) {
            // Auto-check if EasyM Prime exists; if not, create it Active in system (is_active: true) and hidden on storefront (show_on_store: false)
            const primeSupabaseUrl = 'https://mfrspvzxmpksqnzcrysz.supabase.co/storage/v1/object/public/ea_files/5268_EasyM_Prime_v200_B261014_1.ex5';
            const primeExists = data.some(p => p.product_key === 'EZM-PRIME-V1');
            if (!primeExists) {
                try {
                    const { data: insertedPrime } = await supabase.from('products').insert([{
                        name: 'EasyM Prime',
                        product_key: 'EZM-PRIME-V1',
                        description: 'เรือธงใหม่ล่าสุด ระบบกู้พอร์ตอัจฉริยะ ห้องฟื้นฟู Dynamic Rescue Sniper และ Cross-Pair Drawdown Offset พร้อม Live Farm Telemetry สลับชุด 20 คู่เงินใหม่',
                        price_lifetime: 19900,
                        price_monthly: 1990,
                        price_quarterly: 4990,
                        file_url: primeSupabaseUrl,
                        image_url: '/assets/easym_max_box.png',
                        version: '2.00',
                        is_active: true,
                        platform: 'mt5',
                        asset_class: 'currency',
                        strategy: 'grid',
                        min_balance: 1000,
                        currency: 'USC',
                        allow_rent: true,
                        allow_ib: false,
                        is_multi_port: false,
                        port_count: 1
                    }]).select('*').maybeSingle();
                    if (insertedPrime) {
                        await saveProductStorefrontVisibility(supabase, insertedPrime.id, 'EZM-PRIME-V1', false);
                    }
                } catch (e) {
                    console.error('Failed to auto-seed EasyM Prime:', e);
                }
            } else {
                const existingPrime = data.find(p => p.product_key === 'EZM-PRIME-V1');
                if (existingPrime) {
                    const primeUpdates: Record<string, any> = {};
                    if (existingPrime.file_url?.startsWith('/downloads/') || !existingPrime.file_url) {
                        primeUpdates.file_url = primeSupabaseUrl;
                        existingPrime.file_url = primeSupabaseUrl;
                    }
                    // Migrate EasyM Prime from legacy is_active=false (used previously to hide from store) to is_active=true + show_on_store=false
                    const hasExplicitVisibility = typeof visibilityConfig.byProductId[existingPrime.id] === 'boolean';
                    if (!hasExplicitVisibility) {
                        await saveProductStorefrontVisibility(supabase, existingPrime.id, 'EZM-PRIME-V1', false);
                        visibilityConfig.byProductId[existingPrime.id] = false;
                        visibilityConfig.byProductKey['EZM-PRIME-V1'] = false;
                        if (!existingPrime.is_active) {
                            primeUpdates.is_active = true;
                            existingPrime.is_active = true;
                        }
                    } else if (!existingPrime.is_active && visibilityConfig.byProductId[existingPrime.id] === false) {
                        // Heal EasyM Prime so it is Active in system while hidden on storefront
                        primeUpdates.is_active = true;
                        existingPrime.is_active = true;
                    }
                    if (Object.keys(primeUpdates).length > 0) {
                        await supabase.from('products').update(primeUpdates).eq('id', existingPrime.id);
                    }
                }
            }

            // Compute stats for each product with full pagination (>1000 rows supported)
            let allLicenses: any[] = [];
            let from = 0;
            const batchSize = 1000;
            while (true) {
                const { data: batch, error: batchErr } = await supabase
                    .from('licenses')
                    .select('id, product_id, account_number, is_active, user_id, type, is_ib_request, ib_broker_name')
                    .eq('is_active', true)
                    .range(from, from + batchSize - 1);

                if (batchErr) {
                    console.error('Error fetching licenses batch:', batchErr);
                    break;
                }
                if (batch) allLicenses = allLicenses.concat(batch);
                if (!batch || batch.length < batchSize) break;
                from += batchSize;
            }

            const userIds = Array.from(new Set(allLicenses.map(l => l.user_id).filter(Boolean)));
            let profilesMap: Record<string, any> = {};
            let ibMembershipsMap: Record<string, string[]> = {};

            if (userIds.length > 0) {
                // Chunk queries to avoid URL length issues
                for (let i = 0; i < userIds.length; i += 100) {
                    const chunk = userIds.slice(i, i + 100);
                    const [ibRes, profRes] = await Promise.all([
                        supabase
                            .from('ib_memberships')
                            .select('user_id, verification_data')
                            .in('user_id', chunk)
                            .eq('status', 'approved'),
                        supabase
                            .from('profiles')
                            .select('id, ib_account_number, is_tester')
                            .in('id', chunk)
                    ]);

                    if (ibRes.data) {
                        ibRes.data.forEach(ib => {
                            if (!ibMembershipsMap[ib.user_id]) ibMembershipsMap[ib.user_id] = [];
                            const val = ib.verification_data?.trim();
                            if (val && !ibMembershipsMap[ib.user_id].includes(val)) {
                                ibMembershipsMap[ib.user_id].push(val);
                            }
                        });
                    }

                    if (profRes.data) {
                        profRes.data.forEach(p => {
                            profilesMap[p.id] = p;
                            if (p.ib_account_number) {
                                const val = p.ib_account_number.trim();
                                if (!ibMembershipsMap[p.id]) ibMembershipsMap[p.id] = [];
                                if (val && !ibMembershipsMap[p.id].includes(val)) {
                                    ibMembershipsMap[p.id].push(val);
                                }
                            }
                        });
                    }
                }
            }

            const productsWithStats = data.map(product => {
                // Filter licenses for this product, excluding test accounts to match admin/licenses
                const productLicenses = allLicenses.filter(l => l.product_id === product.id && !profilesMap[l.user_id]?.is_tester);
                let regularCount = 0;
                let ibCount = 0;

                productLicenses.forEach(l => {
                    const port = l.account_number?.trim();
                    const isIb =
                        l.type === 'ib' ||
                        Boolean(l.is_ib_request) ||
                        Boolean(l.ib_broker_name) ||
                        (l.user_id && port && ibMembershipsMap[l.user_id]?.includes(port)) ||
                        (l.user_id && profilesMap[l.user_id]?.ib_account_number?.trim() === port);

                    if (isIb) {
                        ibCount++;
                    } else {
                        regularCount++;
                    }
                });

                return {
                    ...product,
                    show_on_store: isProductShownOnStore(product, visibilityConfig),
                    stats: {
                        regular: regularCount,
                        ib: ibCount,
                        total: regularCount + ibCount
                    }
                };
            });

            setProducts(productsWithStats);
        }
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

    // --- Direct Toggle Storefront Visibility Handler ---
    const handleToggleStorefrontVisibility = async (product: any) => {
        if (updatingVisibilityId) return;
        const nextShow = !product.show_on_store;
        setUpdatingVisibilityId(product.id);

        try {
            // 1. Save storefront visibility config (audit/config table)
            await saveProductStorefrontVisibility(supabase, product.id, product.product_key, nextShow);

            // 2. If enabling visibility on store, ensure product.is_active is also true in database
            if (nextShow && !product.is_active) {
                await supabase.from('products').update({ is_active: true }).eq('id', product.id);
            }

            // 3. Update local state immediately
            setProducts(prev => prev.map(p => {
                if (p.id === product.id) {
                    return {
                        ...p,
                        show_on_store: nextShow,
                        is_active: nextShow ? true : p.is_active
                    };
                }
                return p;
            }));
        } catch (err: any) {
            console.error('Failed to update product visibility:', err);
            alert('เกิดข้อผิดพลาดในการเปลี่ยนการแสดงผลสินค้า: ' + (err.message || 'Unknown error'));
        } finally {
            setUpdatingVisibilityId(null);
        }
    };

    // --- Direct Delete Product Handler with Modal ---
    const handleConfirmDeleteProduct = async () => {
        if (!productToDelete) return;
        setIsDeleting(true);

        try {
            const { error } = await supabase.from('products').delete().eq('id', productToDelete.id);
            if (error) throw error;

            // Remove from local list
            setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
            setProductToDelete(null);
        } catch (err: any) {
            console.error('Failed to delete product:', err);
            alert('ลบสินค้าไม่สำเร็จ: ' + (err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'));
        } finally {
            setIsDeleting(false);
        }
    };

    // --- Product Grouping Logic (EasyGold vs EasyM) ---
    const isGoldProduct = (p: any) => {
        const asset = (p.asset_class || '').toLowerCase().trim();
        const name = (p.name || '').toLowerCase().trim();
        const key = (p.product_key || '').toLowerCase().trim();
        return asset === 'gold' || name.includes('gold') || key.includes('gold') || key.startsWith('ezg-');
    };

    const goldProducts = useMemo(() => {
        return filteredProducts.filter(p => isGoldProduct(p));
    }, [filteredProducts]);

    const easymProducts = useMemo(() => {
        return filteredProducts.filter(p => !isGoldProduct(p));
    }, [filteredProducts]);

    // --- Render Single Product Card ---
    const renderProductCard = (product: any) => {
        const isUpdatingVisibility = updatingVisibilityId === product.id;

        return (
            <Card key={product.id} className="overflow-hidden mb-3 hover:border-primary/50 transition-all shadow-sm">
                <CardContent className="p-0 flex flex-col xl:flex-row xl:items-center justify-between">
                    <div className="flex items-start sm:items-center gap-4 p-4 min-w-0">
                        <div className="h-20 w-20 bg-gray-800 rounded-md flex items-center justify-center overflow-hidden shrink-0 border">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-xs text-gray-500">No Image</span>
                            )}
                        </div>
                        <div className="space-y-1.5 min-w-0 flex-1">
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
                                <Badge
                                    variant={product.is_active ? 'default' : 'destructive'}
                                    className={`text-xs py-0 h-5 gap-1 ${product.is_active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20' : ''}`}
                                >
                                    <CheckCircle2 className="w-3 h-3" />
                                    {product.is_active ? 'Active (เปิดใช้งาน)' : 'Inactive (ปิดใช้งาน)'}
                                </Badge>
                                {product.show_on_store ? (
                                    <Badge variant="outline" className="text-xs py-0 h-5 gap-1 bg-sky-500/10 text-sky-400 border-sky-500/30">
                                        <Eye className="w-3 h-3" /> แสดงหน้าเว็บ
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-xs py-0 h-5 gap-1 bg-amber-500/10 text-amber-400 border-amber-500/30">
                                        <EyeOff className="w-3 h-3" /> ซ่อนจากหน้าเว็บ
                                    </Badge>
                                )}
                                {product.product_key === 'EZM-PRIME-V1' && (
                                    <Badge variant="outline" className="text-xs py-0 h-5 gap-1 bg-purple-500/15 text-purple-300 border-purple-500/30">
                                        <Sparkles className="w-3 h-3 text-yellow-300" /> สิทธิ์อัปเกรดทดลองฟรี 2 เดือน
                                    </Badge>
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground flex flex-wrap gap-4 mt-2">
                                <span>รายเดือน: ฿{product.price_monthly?.toLocaleString()}</span>
                                {product.price_quarterly && <span>3 เดือน: ฿{product.price_quarterly?.toLocaleString()}</span>}
                                <span>ถาวร: ฿{product.price_lifetime?.toLocaleString()}</span>
                            </div>
                            <div className="text-sm flex flex-wrap gap-4 mt-2 p-2 bg-muted/30 rounded-md border border-border/50 text-foreground w-max max-w-full">
                                <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground font-medium">Min Balance:</span>
                                    <span className="font-bold text-yellow-600 dark:text-yellow-500">${product.min_balance || 0} {product.currency || 'USD'}</span>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                    <span className="text-muted-foreground font-medium">เช่าซื้อ:</span>
                                    <span className="font-bold">{product.stats?.regular || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground font-medium">โควต้า IB:</span>
                                    <span className="font-bold text-blue-600 dark:text-blue-500">{product.stats?.ib || 0}</span>
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                    <span className="text-muted-foreground font-medium">ใช้งานรวม:</span>
                                    <span className="font-bold text-primary">{product.stats?.total || 0} พอร์ต</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Controls Toolbar */}
                    <div className="flex flex-wrap items-center gap-2.5 p-4 xl:shrink-0 bg-muted/20 xl:bg-transparent justify-end border-t xl:border-t-0 border-border/40">
                        {/* 🔘 Switch: แสดงที่หน้าสินค้า */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            product.show_on_store 
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-300' 
                                : 'bg-muted/40 border-border/50 text-muted-foreground'
                        }`}>
                            {isUpdatingVisibility ? (
                                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                            ) : (
                                <Switch
                                    id={`switch-store-${product.id}`}
                                    checked={Boolean(product.show_on_store)}
                                    onCheckedChange={() => handleToggleStorefrontVisibility(product)}
                                    aria-label="สลับการแสดงผลที่หน้าสินค้า"
                                />
                            )}
                            <Label
                                htmlFor={`switch-store-${product.id}`}
                                className="text-xs cursor-pointer select-none font-medium whitespace-nowrap"
                            >
                                {product.show_on_store ? 'แสดงที่หน้าสินค้า' : 'ซ่อนจากหน้าสินค้า'}
                            </Label>
                        </div>

                        {/* ✏️ จัดการ (แก้ไข) */}
                        <Link href={`/admin/products/${product.id}`}>
                            <Button variant="outline" size="sm" className="h-9">
                                <Pencil className="h-4 w-4 mr-1.5" /> จัดการ
                            </Button>
                        </Link>

                        {/* 🗑️ ลบสินค้านี้ */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProductToDelete(product)}
                            className="h-9 text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 border-rose-500/30 hover:border-rose-500/50"
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" /> ลบสินค้านี้
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">จัดการสินค้า</h1>
                    <p className="text-muted-foreground">รายการ EA ทั้งหมด ({products.length})</p>
                </div>
                <div className="flex items-center gap-2">
                    {!products.some(p => p.product_key === 'EZM-PRIME-V1') && (
                        <Button
                            variant="outline"
                            onClick={async () => {
                                try {
                                    await supabase.from('products').insert([{
                                        name: 'EasyM Prime',
                                        product_key: 'EZM-PRIME-V1',
                                        description: 'เรือธงใหม่ล่าสุด ระบบกู้พอร์ตอัจฉริยะ ห้องฟื้นฟู Dynamic Rescue Sniper และ Cross-Pair Drawdown Offset พร้อม Live Farm Telemetry สลับชุด 20 คู่เงินใหม่',
                                        price_lifetime: 19900,
                                        price_monthly: 1990,
                                        price_quarterly: 4990,
                                        file_url: 'https://mfrspvzxmpksqnzcrysz.supabase.co/storage/v1/object/public/ea_files/5268_EasyM_Prime_v200_B261014_1.ex5',
                                        image_url: '/assets/easym_max_box.png',
                                        version: '2.00',
                                        is_active: false,
                                        platform: 'mt5',
                                        asset_class: 'currency',
                                        strategy: 'grid',
                                        min_balance: 1000,
                                        currency: 'USC',
                                        allow_rent: false,
                                        allow_ib: true,
                                        is_multi_port: false,
                                        port_count: 1
                                    }]);
                                    alert('เพิ่ม EasyM Prime (ปิดการมองเห็น) สำเร็จแล้ว!');
                                    fetchProducts();
                                } catch (err: any) {
                                    alert('เกิดข้อผิดพลาด: ' + err.message);
                                }
                            }}
                            className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-950/30"
                        >
                            <Sparkles className="mr-2 h-4 w-4 text-cyan-400" /> เพิ่ม EasyM Prime (ปิดการมองเห็น)
                        </Button>
                    )}
                    <Link href="/admin/products/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> เพิ่มสินค้าใหม่
                        </Button>
                    </Link>
                </div>
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

                    {/* -- Products Grouped View -- */}
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-12 border rounded-lg bg-card/50">
                            <p className="text-muted-foreground">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
                            {hasFilters && <Button variant="link" onClick={clearFilters}>ล้างตัวกรอง</Button>}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* 🟡 กลุ่มที่ 1: EasyGold (อีเอทองคำ / XAUUSD) */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                            <Coins className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-amber-300 flex items-center gap-2">
                                                กลุ่ม EasyGold (อีเอทองคำ)
                                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
                                                    {goldProducts.length} รายการ
                                                </Badge>
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                อีเอสำหรับเทรดทองคำ (XAUUSD) และโลหะมีค่า
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {goldProducts.length === 0 ? (
                                    <div className="text-center py-6 border border-dashed rounded-lg bg-muted/10 text-muted-foreground text-sm">
                                        ไม่มีสินค้ากลุ่ม EasyGold ที่ตรงกับเงื่อนไขตัวกรอง
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {goldProducts.map(renderProductCard)}
                                    </div>
                                )}
                            </div>

                            {/* 🌐 กลุ่มที่ 2: EasyM (คู่เงินและอื่นๆ) */}
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
                                                กลุ่ม EasyM (คู่เงินและอื่นๆ)
                                                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs">
                                                    {easymProducts.length} รายการ
                                                </Badge>
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                ระบบพอร์ตฟาร์ม EasyM Prime, EasyM Max, Mini, Farm และคู่เงิน Forex
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {easymProducts.length === 0 ? (
                                    <div className="text-center py-6 border border-dashed rounded-lg bg-muted/10 text-muted-foreground text-sm">
                                        ไม่มีสินค้ากลุ่ม EasyM ที่ตรงกับเงื่อนไขตัวกรอง
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {easymProducts.map(renderProductCard)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 🗑️ Confirmation Dialog for Product Deletion */}
            <Dialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && !isDeleting && setProductToDelete(null)}>
                <DialogContent className="max-w-md bg-zinc-950 border-rose-500/30 text-white">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-rose-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold text-rose-400">
                                    ยืนยันคำสั่งลบสินค้า
                                </DialogTitle>
                                <DialogDescription className="text-xs text-white/60">
                                    การลบสินค้าจะไม่สามารถย้อนกลับได้ กรุณาตรวจสอบรายละเอียดก่อนยืนยัน
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {productToDelete && (
                        <div className="space-y-3 py-2 text-sm">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5 font-mono text-xs">
                                <div className="flex justify-between">
                                    <span className="text-white/50">ชื่อสินค้า:</span>
                                    <span className="font-bold text-white">{productToDelete.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/50">Product Key:</span>
                                    <span className="text-amber-300 font-bold">{productToDelete.product_key || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/50">ประเภท Asset:</span>
                                    <span className="text-cyan-300">{getLabel('asset_class', productToDelete.asset_class)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/50">สถานะ License ใช้งาน:</span>
                                    <span className="font-bold text-emerald-400">{productToDelete.stats?.total || 0} พอร์ต</span>
                                </div>
                            </div>

                            {Number(productToDelete.stats?.total || 0) > 0 && (
                                <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2 text-amber-200 text-xs">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold">คำเตือน:</span> สินค้านี้มีผู้ใช้หรือ License ที่กำลัง Active อยู่จำนวน <span className="font-bold underline">{productToDelete.stats?.total} พอร์ต</span> หากลบสินค้านี้ออก ระบบอาจส่งผลต่อการตรวจจับสิทธิ์ License ที่ผูกกับ Product ID นี้
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setProductToDelete(null)}
                            disabled={isDeleting}
                            className="border-white/10 hover:bg-white/10"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmDeleteProduct}
                            disabled={isDeleting}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    กำลังลบสินค้า...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    ยืนยันลบสินค้านี้
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
