import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ProductCard } from '@/components/product-card';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 0;

export default async function ProductsPage() {
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    const monitorProduct = products?.find(p => p.product_key === 'EA-UNIMON-01');
    const eaProducts = products?.filter(p => p.product_key !== 'EA-UNIMON-01') || [];

    return (
        <main className="min-h-screen flex flex-col bg-background selection:bg-primary/30">
            <Navbar />
            <div className="container mx-auto px-4 py-8 flex-1">
                
                {/* 1. Dashboard Systems Section */}
                {monitorProduct && (
                    <div className="mb-12">
                        <h2 className="text-2xl font-bold mb-4 text-primary">ระบบมอนิเตอร์และแดชบอร์ด</h2>
                        <div className="max-w-md">
                            <ProductCard product={monitorProduct} />
                        </div>
                    </div>
                )}

                {/* 2. Trading EAs Section */}
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
