import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ProductList } from '@/components/product-list';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { HomeIbButton } from '@/components/home-ib-button';

export const revalidate = 60; // Cache the landing page for 60 seconds to reduce Vercel CPU usage

export default async function Home() {
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

      {/* Hero Section */}
      <section className="relative py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background z-0" />
        <div className="container relative z-10 mx-auto px-4 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-accent text-sm font-medium mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            ✨ เครื่องมือ Forex ระดับพรีเมียมสำหรับมืออาชีพ
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-2 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent drop-shadow-sm leading-tight">
            ทำกำไรแบบอัตโนมัติด้วย <br className="hidden sm:block" />
            <span className="text-primary text-glow">อัลกอริทึมขั้นสูง</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-5 leading-relaxed">
            ค้นพบ Expert Advisors (EA) ที่ผ่านการตรวจสอบแล้ว ออกแบบมาเพื่อเพิ่มศักยภาพการเทรดของคุณ
            ปลอดภัย เชื่อถือได้ และขับเคลื่อนด้วยข้อมูลจริง
          </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="#products">
                <Button size="lg" className="px-8 text-base">
                  ดูสินค้าทั้งหมด
                </Button>
              </Link>
              <HomeIbButton />
            </div>
        </div>
      </section>

      {/* Dashboard & Monitor Special Banner */}
      {false && monitorProduct && (
        <section className="py-10 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-stone-900 border-y border-purple-500/20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 bg-black/40 p-8 rounded-2xl border border-primary/20 backdrop-blur-md">
              <div className="space-y-4 max-w-2xl text-left">
                <span className="bg-primary/20 text-primary border border-primary/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                  NEW SERVICE
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                  ระบบเว็บมอนิเตอร์และแดชบอร์ดอัจฉริยะ <br/>
                  <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">{monitorProduct.name}</span>
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  เชื่อมโยงพอร์ตการเทรด MT5 ของคุณ เข้ากับแดชบอร์ดสุดล้ำแบบเรียลไทม์ 
                  มีสกินหน้ากากให้เลือกสลับมากมาย เช่น ธีมแผงควบคุมยานอวกาศ (Spaceship) หรือธีมฟาร์มผลไม้ 2.5D (Pixel Farm) 
                  สมัครใช้งานแบบ Free ได้ทันที หรือปลดล็อกคุณสมบัติ Pro/Max เพื่อรองรับการใช้งานระดับสูง
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center"><span className="w-2 h-2 bg-green-500 mr-1.5 animate-pulse" /> อัปเดตสดจาก MT5</span>
                  <span>•</span>
                  <span>เปลี่ยนธีมหน้ากากได้อิสระ</span>
                  <span>•</span>
                  <span>มีระบบปลุกอัตโนมัติ (On-Demand)</span>
                </div>
              </div>
              <div className="shrink-0 w-full lg:w-auto text-center">
                <Link href={`/products/${monitorProduct.id}`}>
                  <Button size="lg" className="w-full lg:w-auto bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:from-amber-400 hover:to-orange-500 font-bold px-8 shadow-lg shadow-orange-500/10">
                    ดูแดชบอร์ด & เปิดใช้งานฟรี
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section id="products" className="py-6 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">EA แนะนำ</h2>
              <p className="text-sm text-muted-foreground">เครื่องมือยอดนิยมที่เราคัดสรรมาเพื่อคุณ</p>
            </div>
            <Link href="/products" className="text-primary hover:text-primary/80 flex items-center text-sm font-medium">
              ดูทั้งหมด <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          <div className="min-h-[500px]">
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
