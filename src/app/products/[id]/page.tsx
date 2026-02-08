import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Check, ShieldCheck, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { ProductPurchaseSection } from '@/components/product-purchase-section';

export const revalidate = 0;

const formatStrategy = (strategy: string) => {
    switch (strategy) {
        case 'scalping': return 'Scalping (ทำกำไรระยะสั้น)';
        case 'trend_following': return 'Trend Following (ตามเทรนด์)';
        case 'grid': return 'Grid System';
        case 'martingale': return 'Martingale';
        case 'hedging': return 'Hedging';
        case 'swing_trading': return 'Swing Trading';
        case 'day_trading': return 'Day Trading';
        case 'news_trading': return 'News Trading';
        case 'arbitrage': return 'Arbitrage';
        default: return strategy;
    }
};

export default async function ProductPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { data: product } = await supabase.from('products').select('*').eq('id', params.id).single();

    if (!product) {
        notFound();
    }

    return (
        <main className="min-h-screen flex flex-col bg-background">
            <Navbar />

            <div className="flex-1 container mx-auto px-4 py-12">
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block">
                    &larr; กลับไปหน้าร้านค้า
                </Link>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Left: Image/Visual */}
                    <div className="space-y-6">
                        <div className="aspect-video bg-gradient-to-br from-gray-900 to-black rounded-xl border border-border/50 flex items-center justify-center relative overflow-hidden shadow-2xl">
                            <div className="text-6xl font-bold text-white/10">{product.name.substring(0, 2)}</div>
                            {product.image_url && (
                                <img
                                    src={product.image_url}
                                    alt={product.name}
                                    className="absolute inset-0 w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-700"
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
                        </div>

                        <div className="bg-card p-6 rounded-xl border border-border/50">
                            <h3 className="font-semibold mb-4 flex items-center">
                                <ShieldCheck className="w-5 h-5 mr-2 text-primary" />
                                รับประกันคุณภาพ
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                EA ตัวนี้ได้รับการตรวจสอบบนบัญชีจริงแล้ว พร้อมทีมงาน Support ดูแลตลอด 24/7 และอัปเดตฟรีตลอดอายุการใช้งาน
                            </p>
                        </div>
                    </div>

                    {/* Right: Info & Purchase */}
                    <div>
                        <div className="mb-6">
                            <h1 className="text-4xl font-bold mb-3">{product.name}</h1>
                            <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
                                <span className="bg-primary/20 text-primary px-2.5 py-0.5 rounded-full font-medium">v{product.version}</span>
                                {product.platform && (
                                    <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-medium uppercase">
                                        {product.platform}
                                    </span>
                                )}
                                {product.asset_class && (
                                    <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-0.5 rounded-full font-medium capitalize">
                                        {product.asset_class}
                                    </span>
                                )}
                            </div>
                            {product.strategy && (
                                <div className="inline-block bg-muted/40 text-muted-foreground px-3 py-1 rounded-lg text-xs font-medium mb-2 border border-border/50">
                                    Strategy: {formatStrategy(product.strategy)}
                                </div>
                            )}
                        </div>

                        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                            {product.description}
                        </p>

                        <div className="mb-8">
                            <h3 className="font-semibold mb-3">ฟีเจอร์เด่น</h3>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {product.features?.map((feature: string, i: number) => (
                                    <li key={i} className="flex items-center text-sm">
                                        <Check className="w-4 h-4 mr-2 text-accent" />
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <ProductPurchaseSection product={product} />
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}

// Generate static params for these mock products to avoid 404 on static export if needed

