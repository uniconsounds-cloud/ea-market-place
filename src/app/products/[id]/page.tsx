import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Check, ShieldCheck, Zap, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { ProductPurchaseSection } from '@/components/product-purchase-section';
import { ProductIbBanner } from '@/components/product-ib-banner';
import { ProductGallery } from '@/components/product-gallery';
import { MonitorProductDetail } from '@/components/monitor-product-detail';

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

    if (product.product_key === 'EA-UNIMON-01') {
        return (
            <main className="min-h-screen flex flex-col bg-background">
                <Navbar />
                <div className="flex-1 container mx-auto px-4 py-12">
                    <Link href="/" className="text-sm text-muted-foreground hover:text-foreground mb-8 inline-block">
                        &larr; กลับไปหน้าร้านค้า
                    </Link>
                    <div className="mb-8 space-y-4">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent inline-block">{product.name}</h1>
                        <p className="text-base text-muted-foreground leading-relaxed max-w-3xl">
                            {product.description}
                        </p>
                    </div>
                    <MonitorProductDetail product={product} />
                </div>
                <Footer />
            </main>
        );
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
                        <ProductGallery 
                            mainImage={product.image_url} 
                            additionalImages={product.additional_images} 
                            productName={product.name} 
                        />

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
                        {product.allow_rent === false && product.allow_ib === false ? (
                            <div className="mt-8 bg-muted/60 p-8 rounded-xl border border-border text-center">
                                <h3 className="text-xl font-bold mb-2 text-muted-foreground">ปิดการขายชั่วคราว</h3>
                                <p className="text-muted-foreground">สินค้ารายการนี้ยังไม่เปิดให้เช่าซื้อหรือสมัครใช้งานผ่านสิทธิ์ IB ในขณะนี้</p>
                            </div>
                        ) : (
                            <>
                                {product.allow_ib !== false && <ProductIbBanner productId={product.id} />}
                                {/* Rest of content */}
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
                                        {product.currency && (
                                            <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-2.5 py-0.5 rounded-full font-medium uppercase">
                                                {product.currency}
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

                                {/* Special Upgrade Privilege Callout for Existing Customers */}
                                <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/30">
                                    <div className="flex items-start gap-3.5">
                                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div className="space-y-1.5 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-bold text-amber-300 text-sm sm:text-base">
                                                    สิทธิพิเศษอัปเกรด EasyM PRIME สำหรับลูกค้าเดิม (ลด 50% ปีแรกเท่านั้น)
                                                </span>
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                    First Year Only
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                                ลูกค้าเดิมที่ถือ EA ทุกสินค้าในเครือ รับสิทธิ์อัปเกรดเป็น <strong className="text-purple-300">EasyM PRIME</strong> ระบบเรือธงในราคาลด 50% สำหรับการใช้งานปีแรก (แบบรันเองเหลือเพียง <strong className="text-foreground">฿5,000/ปี</strong> หรือแบบให้เรารันให้เหลือเพียง <strong className="text-foreground">฿7,000/ปี</strong>)
                                            </p>
                                            <p className="text-xs text-amber-300/90 font-medium">
                                                *ข้อกำหนดสำคัญ: ราคาส่วนลดพิเศษ 50% นี้มีผลเฉพาะรอบบิลปีแรกเท่านั้น รอบการต่ออายุในปีถัดไปจะคิดในอัตรามาตรฐานของระบบ
                                            </p>
                                            <div className="pt-1.5">
                                                <Link 
                                                    href="/admin/easym-plans" 
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-300 hover:text-purple-200 transition"
                                                >
                                                    <span>ดูแผนราคา EasyM & สิทธิ์อัปเกรด</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <ProductPurchaseSection product={product} />
                            </>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </main>
    );
}

// Generate static params for these mock products to avoid 404 on static export if needed

