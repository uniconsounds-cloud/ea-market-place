'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { 
    Sparkles, 
    ShieldCheck, 
    ArrowLeft, 
    CheckCircle2, 
    Crosshair, 
    Activity, 
    Scale, 
    Layers, 
    Check, 
    AlertCircle, 
    Loader2, 
    Send, 
    Clock, 
    Coins, 
    HelpCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

function UpgradePrimeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const fromProductId = searchParams.get('fromProductId');

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeCardTab, setActiveCardTab] = useState<number>(0);

    // Form states
    const [userPorts, setUserPorts] = useState<string[]>([]);
    const [selectedPort, setSelectedPort] = useState<string>('');
    const [primeProductId, setPrimeProductId] = useState<string>('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [hasExistingPendingUpgrade, setHasExistingPendingUpgrade] = useState(false);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/login');
                return;
            }
            setUser(user);

            // Fetch user's existing EasyM ports from licenses
            const { data: licenses } = await supabase
                .from('licenses')
                .select(`
                    id, account_number, product_id,
                    products ( id, name, product_key )
                `)
                .eq('user_id', user.id);

            const easyMPorts: string[] = [];
            if (licenses) {
                licenses.forEach((lic: any) => {
                    const pName = lic.products?.name?.toLowerCase() || '';
                    const pKey = lic.products?.product_key?.toUpperCase() || '';
                    if (pKey.startsWith('EZM') || pName.includes('easym') || pName.includes('easy m')) {
                        const portStr = String(lic.account_number || '').trim();
                        if (portStr && !easyMPorts.includes(portStr)) {
                            easyMPorts.push(portStr);
                        }
                    }
                });
            }
            setUserPorts(easyMPorts);
            if (easyMPorts.length > 0) {
                setSelectedPort(easyMPorts[0]);
            }

            // Check if user already has a pending upgrade order
            const { data: pendingOrders } = await supabase
                .from('orders')
                .select('id, account_number')
                .eq('user_id', user.id)
                .eq('plan_type', 'upgrade')
                .eq('status', 'pending');

            if (pendingOrders && pendingOrders.length > 0) {
                setHasExistingPendingUpgrade(true);
            }

            // Lookup EasyM Prime product ID from database
            const { data: primeProduct } = await supabase
                .from('products')
                .select('id')
                .eq('product_key', 'EZM-PRIME-V1')
                .maybeSingle();

            if (primeProduct) {
                setPrimeProductId(primeProduct.id);
            } else if (fromProductId) {
                setPrimeProductId(fromProductId);
            }

            setLoading(false);
        };

        init();
    }, [router, fromProductId]);

    const handleSubmitUpgrade = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPort) {
            alert('กรุณาเลือกหมายเลขพอร์ตที่ต้องการอัปเกรด');
            return;
        }

        setSubmitting(true);
        try {
            // Check again for conflict
            const { data: duplicateCheck } = await supabase
                .from('orders')
                .select('id')
                .eq('user_id', user.id)
                .eq('account_number', selectedPort)
                .eq('plan_type', 'upgrade')
                .eq('status', 'pending');

            if (duplicateCheck && duplicateCheck.length > 0) {
                alert(`พอร์ต ${selectedPort} มีคำขออัปเกรดที่กำลังรอแอดมินอนุมัติอยู่แล้ว`);
                setSubmitting(false);
                return;
            }

            // Find target product id: prime product or fallback to a known product
            let targetId = primeProductId;
            if (!targetId) {
                const { data: fallbackProd } = await supabase
                    .from('products')
                    .select('id')
                    .or('product_key.eq.EZM-PRIME-V1,product_key.eq.EZM-MAX-V1')
                    .limit(1)
                    .single();
                targetId = fallbackProd?.id;
            }

            const { error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    product_id: targetId,
                    amount: 0,
                    status: 'pending',
                    is_ib_request: true,
                    plan_type: 'upgrade',
                    account_number: selectedPort.trim()
                });

            if (orderError) throw orderError;

            setIsSuccess(true);
        } catch (err: any) {
            console.error('Error submitting upgrade:', err);
            alert('เกิดข้อผิดพลาดในการส่งคำขอ: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                <p className="text-muted-foreground text-xs">กำลังโหลดข้อมูลระบบอัปเกรด...</p>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="max-w-xl mx-auto py-10 px-4 text-center space-y-5">
                <div className="w-16 h-16 mx-auto rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-pulse">
                    <CheckCircle2 className="w-8 h-8 text-cyan-400" />
                </div>
                <Badge className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold px-3 py-0.5 text-[11px] uppercase tracking-wider">
                    ส่งคำขอสำเร็จ
                </Badge>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                    ส่งคำขออัปเกรด Prime สำเร็จแล้ว
                </h1>
                <p className="text-muted-foreground text-xs md:text-sm leading-relaxed">
                    ส่งคำขออัปเกรดพอร์ต <span className="font-mono font-bold text-cyan-400">{selectedPort}</span> ไปยังแอดมินแล้ว<br />
                    สิทธิ์จะได้รับการอนุมัติและเปิดให้ดาวน์โหลด EA ภายใน 24 ชม.
                </p>

                <div className="bg-muted/40 p-4 rounded-xl border border-border/50 text-left space-y-2 text-xs">
                    <h4 className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-yellow-400" /> ขั้นตอนถัดไป:
                    </h4>
                    <ul className="text-muted-foreground space-y-1.5 list-disc list-inside">
                        <li>แอดมินอนุมัติสิทธิ์ทดลอง Prime ฟรี 2 เดือนเต็ม (60 วัน)</li>
                        <li>ปุ่มดาวน์โหลดไฟล์ EA จะเปิดในหน้าแดชบอร์ดทันที</li>
                        <li>เข้าใช้งานหน้าฟาร์มดูสดเรียลไทม์ได้ทันทีที่เริ่มรัน EA</li>
                    </ul>
                </div>

                <div className="pt-2 flex justify-center">
                    <Link href="/dashboard">
                        <Button className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold px-6 shadow-md shadow-cyan-500/20 text-xs sm:text-sm whitespace-nowrap">
                            กลับหน้าแดชบอร์ด
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto py-4 md:py-6 px-3 sm:px-4 space-y-6">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> แดชบอร์ด
                </Link>
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 bg-cyan-950/20 gap-1 py-0.5 px-2.5 text-[11px] font-medium">
                    <Sparkles className="w-3 h-3 text-yellow-300 animate-spin" />
                    สิทธิ์พิเศษลูกค้า EasyM
                </Badge>
            </div>

            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-cyan-950/30 to-purple-950/40 border border-cyan-500/30 p-5 md:p-7 shadow-xl">
                <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/40 text-[10px] font-mono">
                            EasyM Prime v2.00
                        </Badge>
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-[10px]">
                            ทดลองฟรี 2 เดือน (60 วัน)
                        </Badge>
                    </div>

                    <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                        อัปเกรดสู่ <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">EasyM Prime</span>
                    </h1>

                    <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                        สิทธิ์พิเศษลูกค้าเดิม ทดลองระบบกู้พอร์ตอัจฉริยะ พร้อมห้องฟื้นฟู สไนเปอร์ Dynamic และหน้าฟาร์มดูสด ฟรี 2 เดือนเต็ม
                    </p>

                    {/* 3 Choices Box */}
                    <div className="mt-3 p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 backdrop-blur-sm space-y-2">
                        <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-xs">
                            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                            เงื่อนไขหลังครบ 2 เดือน (เลือกได้ 3 รูปแบบ):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-0.5">
                                <span className="font-bold text-slate-200 block">1. กลับใช้ MAX เดิมฟรี</span>
                                <p className="text-slate-400 leading-normal">สลับกลับ EasyM MAX ฟรีตลอดชีพ (ไม่มีหน้าฟาร์ม)</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] space-y-0.5">
                                <span className="font-bold text-slate-200 block">2. ใช้ MAX ต่อ + หน้าฟาร์ม</span>
                                <p className="text-slate-400 leading-normal">ใช้ MAX ต่อเนื่อง พร้อมระบบฟาร์ม (มีค่าบริการ)</p>
                            </div>
                            <div className="p-2.5 rounded-lg bg-gradient-to-br from-cyan-950/60 to-purple-950/60 border border-cyan-500/30 text-[11px] space-y-0.5">
                                <span className="font-bold text-cyan-200 block">3. ใช้ Prime ต่อ + ฟาร์มสด</span>
                                <p className="text-slate-300 leading-normal">ใช้ Prime ต่อ พร้อมฟาร์มดูสด Telemetry (มีค่าบริการ)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Switcher for the 3 Cards */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-cyan-400" /> ข้อมูลและการเปรียบเทียบ
                    </h2>
                    <div className="flex gap-1 bg-muted/50 p-1 rounded-lg border border-border/40 self-start sm:self-auto overflow-x-auto max-w-full">
                        <Button 
                            variant={activeCardTab === 0 ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setActiveCardTab(0)}
                            className={activeCardTab === 0 ? "bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8 px-3 whitespace-nowrap" : "text-xs h-8 px-3 whitespace-nowrap"}
                        >
                            จุดเด่น Prime
                        </Button>
                        <Button 
                            variant={activeCardTab === 1 ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setActiveCardTab(1)}
                            className={activeCardTab === 1 ? "bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8 px-3 whitespace-nowrap" : "text-xs h-8 px-3 whitespace-nowrap"}
                        >
                            เทียบกับ MAX
                        </Button>
                        <Button 
                            variant={activeCardTab === 2 ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setActiveCardTab(2)}
                            className={activeCardTab === 2 ? "bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8 px-3 whitespace-nowrap" : "text-xs h-8 px-3 whitespace-nowrap"}
                        >
                            การเตรียมพอร์ต
                        </Button>
                    </div>
                </div>

                {/* The 3 Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* CARD 1: 4 Innovations */}
                    <Card className={`overflow-hidden border-cyan-500/30 transition-all duration-300 ${activeCardTab === 0 ? 'ring-2 ring-cyan-500 shadow-lg shadow-cyan-500/10' : 'opacity-90'}`}>
                        <CardHeader className="bg-gradient-to-r from-cyan-950/40 to-slate-900/60 p-4 border-b border-border/30">
                            <div className="flex items-center justify-between">
                                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">การ์ด 1</Badge>
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <CardTitle className="text-sm sm:text-base font-bold text-white mt-1">
                                4 นวัตกรรมใน EasyM Prime
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                            <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">ห้องฟื้นฟูอัจฉริยะ (Recovery Room)</h4>
                                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                                        แยกคู่ติดลบไปกู้พอร์ตโดยเฉพาะ ไม่ฉุดพอร์ตหลัก คู่ที่เหลือทำกำไรต่อได้ตามปกติ
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0 mt-0.5">
                                    <Crosshair className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">สไนเปอร์กู้ภัย Dynamic</h4>
                                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                                        ออกไม้แก้ 3 ไม้ต่อชุด พร้อมระบบสลับชุด รวบปิดกำไรเมื่อถึงจุดคุ้มทุน
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                                    <Scale className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">กองทุนตัดขาดทุนข้ามคู่ (DD Offset)</h4>
                                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                                        นำกำไรคู่บวกมาช่วยลด Drawdown คู่ติดลบ ปลดล็อกพอร์ตเร็วขึ้น 3 เท่า
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <div className="p-1.5 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0 mt-0.5">
                                    <Activity className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">ฟาร์มดูสดเรียลไทม์ (Live Farm)</h4>
                                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                                        Telemetry สดทุกวินาที แยกสถานะพอร์ตและห้องฟื้นฟูชัดเจน
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* CARD 2: Comparison Table */}
                    <Card className={`overflow-hidden border-purple-500/30 transition-all duration-300 ${activeCardTab === 1 ? 'ring-2 ring-purple-500 shadow-lg shadow-purple-500/10' : 'opacity-90'}`}>
                        <CardHeader className="bg-gradient-to-r from-purple-950/40 to-slate-900/60 p-4 border-b border-border/30">
                            <div className="flex items-center justify-between">
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">การ์ด 2</Badge>
                                <Scale className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <CardTitle className="text-sm sm:text-base font-bold text-white mt-1">
                                เปรียบเทียบ MAX vs Prime
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 sm:p-4 space-y-2.5 text-xs">
                            <div className="space-y-2 divide-y divide-border/30">
                                <div className="pt-1.5">
                                    <span className="font-semibold text-foreground block mb-1 text-[11px]">ชุดคู่เงิน</span>
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block text-[10px]">MAX:</span>
                                            ชุดคลาสสิกเดิม
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block text-[10px]">Prime:</span>
                                            ปรับ 3 คู่ใหม่ (ลดสเปรด/แกว่ง)
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-1.5">
                                    <span className="font-semibold text-foreground block mb-1 text-[11px]">การรับมือวิกฤต</span>
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block text-[10px]">MAX:</span>
                                            ตัดขาดทุนปกติ
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block text-[10px]">Prime:</span>
                                            เข้าห้องฟื้นฟูอัจฉริยะ
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-1.5">
                                    <span className="font-semibold text-foreground block mb-1 text-[11px]">กลยุทธ์กู้พอร์ต</span>
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block text-[10px]">MAX:</span>
                                            เฉลี่ยต้นทุนคงที่
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block text-[10px]">Prime:</span>
                                            สไนเปอร์ Dynamic 3 ไม้
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-1.5">
                                    <span className="font-semibold text-foreground block mb-1 text-[11px]">คุมสัดส่วนสกุลเงิน</span>
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40 text-emerald-400">
                                            <span className="font-bold text-muted-foreground block text-foreground text-[10px]">MAX:</span>
                                            <span className="inline-flex items-center gap-1 font-semibold">
                                                <Check className="w-3 h-3 text-emerald-400" /> คุมไม่เกิน 3 คู่/สกุล
                                            </span>
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-emerald-300">
                                            <span className="font-bold text-cyan-400 block text-[10px]">Prime:</span>
                                            <span className="inline-flex items-center gap-1 font-semibold">
                                                <Check className="w-3 h-3 text-emerald-400" /> คุมไม่เกิน 3 คู่/สกุล
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-1.5">
                                    <span className="font-semibold text-foreground block mb-1 text-[11px]">ระบบหน้าฟาร์ม</span>
                                    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block text-[10px]">MAX:</span>
                                            มอนิเตอร์ทั่วไป
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block text-[10px]">Prime:</span>
                                            ดูสดเรียลไทม์ Telemetry
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* CARD 3: Conditions & Port Preparation */}
                    <Card className={`overflow-hidden border-amber-500/30 transition-all duration-300 ${activeCardTab === 2 ? 'ring-2 ring-amber-500 shadow-lg shadow-amber-500/10' : 'opacity-90'}`}>
                        <CardHeader className="bg-gradient-to-r from-amber-950/40 to-slate-900/60 p-4 border-b border-border/30">
                            <div className="flex items-center justify-between">
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">การ์ด 3</Badge>
                                <Coins className="w-3.5 h-3.5 text-amber-400" />
                            </div>
                            <CardTitle className="text-sm sm:text-base font-bold text-white mt-1">
                                การเตรียมพอร์ตก่อนอัปเกรด
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                            <div className="space-y-1 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                                    <Coins className="w-3.5 h-3.5" /> 1. ขนาดพอร์ต
                                </div>
                                <p className="text-stone-300 text-[11px] leading-relaxed">
                                    เริ่ม $1,000 หรือ 100,000 Cent (แนะนำสำรอง $500 เพื่อเป็นบัฟเฟอร์กู้พอร์ต)
                                </p>
                            </div>

                            <div className="space-y-1 p-2.5 rounded-lg bg-slate-900 border border-border/40">
                                <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs">
                                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> 2. สถานะพอร์ต
                                </div>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    ใช้ได้ทั้งพอร์ตใหม่และพอร์ตมีออเดอร์ค้าง (ระบบจะดึงเข้าห้องฟื้นฟูอัตโนมัติ)
                                </p>
                            </div>

                            <div className="space-y-1 p-2.5 rounded-lg bg-slate-900 border border-border/40">
                                <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs">
                                    <Clock className="w-3.5 h-3.5 text-purple-400" /> 3. การอนุมัติ
                                </div>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    อนุมัติและเปิดให้ดาวน์โหลด EA ในแดชบอร์ดภายใน 24 ชม.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bottom Form */}
            <Card className="border-cyan-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/20 shadow-xl">
                <CardHeader className="border-b border-border/40 p-4 sm:p-5">
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                        <Send className="w-4 h-4 text-cyan-400" /> ส่งคำขออัปเกรด Prime
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        เลือกพอร์ต EasyM ที่ต้องการรับสิทธิ์ทดลองฟรี 2 เดือน
                    </p>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                    {userPorts.length === 0 ? (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <div>
                                ไม่พบพอร์ต EasyM ในบัญชีของคุณ หากท่านเป็นลูกค้าอยู่แล้ว โปรดติดต่อแอดมินเพื่อเชื่อมต่อพอร์ต
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmitUpgrade} className="space-y-4">
                            <div className="max-w-md mx-auto space-y-1.5">
                                <Label className="text-xs font-semibold text-foreground">
                                    เลือกพอร์ต EasyM <span className="text-red-500">*</span>
                                </Label>
                                <select 
                                    value={selectedPort}
                                    onChange={(e) => setSelectedPort(e.target.value)}
                                    className="w-full h-10 px-3 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm"
                                    required
                                >
                                    {userPorts.map((port) => (
                                        <option key={port} value={port}>
                                            พอร์ตหมายเลข: {port}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground">
                                    * สิทธิ์ฟรี 2 เดือนจะเริ่มนับหลังจากแอดมินอนุมัติ
                                </p>
                            </div>

                            {hasExistingPendingUpgrade && (
                                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-[11px] flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 shrink-0 text-yellow-300" />
                                    ท่านมีคำขอพอร์ตอื่นรอตรวจสอบอยู่แล้ว แต่สามารถส่งคำขอเพิ่มได้
                                </div>
                            )}

                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/40">
                                <div className="text-[11px] text-muted-foreground text-center sm:text-left">
                                    ✓ ทดลองฟรี 2 เดือน • ไม่มีข้อผูกมัด • เปิดโหลด EA ทันทีเมื่ออนุมัติ
                                </div>
                                <Button
                                    type="submit"
                                    disabled={submitting || !selectedPort}
                                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold px-6 py-2 shadow-md shadow-cyan-500/25 border border-cyan-400/30 text-xs sm:text-sm whitespace-nowrap h-10"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" />
                                            กำลังส่งคำขอ...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-yellow-300 shrink-0" />
                                            ขออัปเกรด Prime ฟรี 2 เดือน
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function UpgradePrimePage() {
    return (
        <Suspense fallback={
            <div className="min-h-[70vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            </div>
        }>
            <UpgradePrimeContent />
        </Suspense>
    );
}
