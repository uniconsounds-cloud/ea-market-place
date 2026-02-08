import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ProductList } from '@/components/product-list';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 0; // Disable static caching for real-time updates

export default async function Home() {
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen flex flex-col bg-background selection:bg-primary/30">
      <Navbar />

      {/* Hero Section */}
      <section className="relative py-8 md:py-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background z-0" />
        <div className="container relative z-10 mx-auto px-4 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-accent text-sm font-medium mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            ✨ เครื่องมือ Forex ระดับพรีเมียมสำหรับมืออาชีพ
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent drop-shadow-sm leading-tight">
            ทำกำไรแบบอัตโนมัติด้วย <br className="hidden sm:block" />
            <span className="text-primary text-glow">อัลกอริทึมขั้นสูง</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
            ค้นพบ Expert Advisors (EA) ที่ผ่านการตรวจสอบแล้ว ออกแบบมาเพื่อเพิ่มศักยภาพการเทรดของคุณ
            ปลอดภัย เชื่อถือได้ และขับเคลื่อนด้วยข้อมูลจริง
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="#products">
              <Button size="lg" className="px-8 text-base">
                ดูสินค้าทั้งหมด
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" size="lg" className="px-8 text-base">
                ทดลองใช้ฟรี
              </Button>
            </Link>
          </div>
        </div>
      </section>

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
            <ProductList initialProducts={products || []} />
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
