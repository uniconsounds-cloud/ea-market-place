import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ProductCard } from '@/components/product-card';
import { supabase } from '@/lib/supabaseClient';
import { fetchStorefrontVisibilityConfig, isProductShownOnStore } from '@/lib/license-audit';

export const revalidate = 0;

export default async function ProductsPage() {
    const [{ data: rawProducts }, visibilityConfig] = await Promise.all([
        supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false }),
        fetchStorefrontVisibilityConfig(supabase)
    ]);

    const products = (rawProducts || []).filter(p => isProductShownOnStore(p, visibilityConfig));

    const monitorProduct = products.find(p => p.product_key === 'EA-UNIMON-01');
    const smartEaProducts = products.filter(p => p.product_key?.startsWith('SMART-') || p.strategy === 'Smart EA');
    const eaProducts = products.filter(
        p => p.product_key !== 'EA-UNIMON-01' && !p.product_key?.startsWith('SMART-') && p.strategy !== 'Smart EA'
    );

    return (
        <main className="min-h-screen flex flex-col bg-background selection:bg-primary/30">
            <Navbar />
            <div className="container mx-auto px-4 py-8 flex-1">
                
                {/* 1. Smart EA Series Section */}
                <div className="mb-12">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-2">
                                NEW SERIES • WEB-CONTROLLED
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">Smart EA</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                ซีรีส์ EA ยุคใหม่ สั่งงาน ปรับค่า และมอนิเตอร์แบบเรียลไทม์ผ่านเว็บได้ทันทีทั้งมือถือและคอมพิวเตอร์
                            </p>
                        </div>
                        <a
                            href="/smart-ea"
                            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors shrink-0"
                        >
                            เปิดหน้าควบคุม Smart Vortex Cockpit →
                        </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {smartEaProducts.map((product: any) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                        {smartEaProducts.length === 0 && (
                            <div className="rounded-2xl border border-cyan-500/30 bg-card/60 p-6 flex flex-col justify-between shadow-lg">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
                                            SMART-VORTEX-01
                                        </span>
                                        <span className="text-xs font-semibold text-emerald-400">พร้อมใช้งาน</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-2">Smart Vortex</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                        Anchored Expanding Stop Grid EA ที่ออกแบบใหม่แบบ Modular เชื่อมต่อ 2-Way Real-Time กับหน้าเว็บ ปรับระยะ Grid, Lot และสั่ง Pause/Freeze ได้ทันทีจากมือถือ
                                    </p>
                                </div>
                                <div className="pt-4 border-t border-border/50 flex items-center justify-between gap-3">
                                    <span className="text-xs text-muted-foreground">Web Cockpit Ready</span>
                                    <a
                                        href="/smart-ea"
                                        className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                                    >
                                        เข้าใช้งาน Cockpit
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Dashboard Systems Section */}
                {monitorProduct && (
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-primary">ระบบมอนิเตอร์และแดชบอร์ด</h2>
                        <div className="max-w-md">
                            <ProductCard product={monitorProduct} />
                        </div>
                    </div>
                )}

                {/* 3. Trading EAs Section */}
                <div>
                    <h2 className="text-2xl font-bold mb-6 text-foreground">บอทเทรดอัตโนมัติ (Expert Advisors)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {eaProducts.map((product: any) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                        {eaProducts.length === 0 && (
                            <div className="col-span-3 text-center py-20 text-muted-foreground">
                                ยังไม่มีสินค้าบอทเทรด
                            </div>
                        )}
                    </div>
                </div>

            </div>
            <Footer />
        </main>
    );
}
