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

    return (
        <main className="min-h-screen flex flex-col bg-background selection:bg-primary/30">
            <Navbar />
            <div className="container mx-auto px-4 py-8 flex-1">
                <h1 className="text-3xl font-bold mb-6">สินค้าทั้งหมด</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {products?.map((product: any) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                    {products?.length === 0 && (
                        <div className="col-span-3 text-center py-20 text-muted-foreground">
                            ยังไม่มีสินค้า
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </main>
    );
}
