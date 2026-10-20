import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ProductList } from '@/components/product-list';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { HomeIbButton } from '@/components/home-ib-button';
import { fetchStorefrontVisibilityConfig, isProductShownOnStore } from '@/lib/license-audit';

export const revalidate = 0;

export default async function Home() {
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
  const eaProducts = products.filter(p => p.product_key !== 'EA-UNIMON-01');

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/30">
      <Navbar />

      {/* Hero Section - Compact 20% Viewport Height Proportion */}
      <section className="relative py-4 sm:py-5 overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/15 via-background to-background z-0 pointer-events-none" />
        <div className="container relative z-10 mx-auto px-4 text-center max-w-4xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-medium mb-1.5 animate-in fade-in duration-300">
            <span>✨</span>
            <span>เครื่องมือ Forex & Gold ระดับพรีเมียมสำหรับมืออาชีพ</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight mb-1 bg-gradient-to-r from-white via-slate-100 to-gray-400 bg-clip-text text-transparent drop-shadow-sm leading-tight">
            ทำกำไรแบบอัตโนมัติด้วย <span className="text-primary text-glow">อัลกอริทึมขั้นสูง</span>
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto mb-2.5 leading-snug">
            ค้นพบ Expert Advisors (EA) คุณภาพสูง ออกแบบมาเพื่อเพิ่มประสิทธิภาพพอร์ตการเทรดของคุณ ปลอดภัย เชื่อถือได้ และขับเคลื่อนด้วยข้อมูลจริง
          </p>

          <div className="flex justify-center items-center">
            <HomeIbButton 
              size="default" 
              className="h-9 sm:h-10 px-5 text-xs sm:text-sm font-bold rounded-lg shadow-md" 
            />
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section id="products" className="py-4 sm:py-6 bg-muted/15 flex-1">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-0.5">EA แนะนำ</h2>
              <p className="text-xs text-muted-foreground">เครื่องมือยอดนิยมที่เราคัดสรรมาเพื่อคุณ</p>
            </div>
            <Link href="/products" className="text-primary hover:text-primary/80 flex items-center text-xs font-medium">
              ดูทั้งหมด <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="min-h-[450px]">
            <ProductList initialProducts={eaProducts} />
          </div>
        </div>
      </section>

      {/* Features/Trust Section */}
      <section className="py-20 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 rounded-2xl bg-card border border-border/50">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold mb-2">ผลลัพธ์ที่พิสูจน์ได้</h3>
              <p className="text-sm text-muted-foreground">EA ทุกตัวผ่านการ Backtest และตรวจสอบผลการเทรดจริง</p>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border/50">
              <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-lg font-bold mb-2">ระบบลิขสิทธิ์ปลอดภัย</h3>
              <p className="text-sm text-muted-foreground">เริ่มใช้งานได้ทันทีด้วยระบบ Verify License ผ่าน API ที่ปลอดภัย</p>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border/50">
              <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-lg font-bold mb-2">ดาวน์โหลดทันที</h3>
              <p className="text-sm text-muted-foreground">รับไฟล์และคู่มือการติดตั้งทันทีหลังการชำระเงิน</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
