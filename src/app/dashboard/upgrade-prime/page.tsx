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
    TrendingUp, 
    Check, 
    X, 
    AlertCircle, 
    Loader2, 
    Send, 
    Clock, 
    Coins, 
    ChevronRight,
    HelpCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
    const [notes, setNotes] = useState<string>('');
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

            const upgradeNote = notes.trim() 
                ? `[UPGRADE PRIME] ${notes.trim()}`
                : '[UPGRADE PRIME] ขอรับสิทธิ์อัปเกรดสู่ EasyM Prime ฟรี 2 เดือนเต็ม';

            const { error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: user.id,
                    product_id: targetId,
                    amount: 0,
                    status: 'pending',
                    is_ib_request: true,
                    plan_type: 'upgrade',
                    account_number: selectedPort.trim(),
                    ib_broker_name: upgradeNote
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
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
                <p className="text-muted-foreground text-sm">กำลังโหลดข้อมูลระบบอัปเกรด EasyM Prime...</p>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-pulse">
                    <CheckCircle2 className="w-10 h-10 text-cyan-400" />
                </div>
                <Badge className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold px-3 py-1 text-xs uppercase tracking-wider">
                    Upgrade Request Submitted
                </Badge>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    ส่งคำขออัปเกรดสู่ EasyM Prime สำเร็จแล้ว!
                </h1>
                <p className="text-muted-foreground leading-relaxed">
                    ระบบได้ส่งคำขออัปเกรดพอร์ต <span className="font-mono font-bold text-cyan-400">{selectedPort}</span> ไปยังแอดมินเรียบร้อยแล้ว<br />
                    สิทธิ์จะได้รับการอนุมัติและเปิดให้ดาวน์โหลดไฟล์ EA ในหน้าแดชบอร์ดภายใน 24 ชั่วโมง
                </p>

                <div className="bg-muted/40 p-5 rounded-2xl border border-border/50 text-left space-y-3">
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" /> สิ่งที่จะเกิดขึ้นถัดไป:
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
                        <li>แอดมินอนุมัติสิทธิ์ทดลองใช้งาน EasyM Prime ฟรี 2 เดือนเต็ม (60 วัน)</li>
                        <li>ปุ่มดาวน์โหลดไฟล์ EA EasyM Prime จะปรากฏในหน้า Dashboard ของคุณ</li>
                        <li>ระบบจะเชื่อมต่อหน้า Live Farm แสดงสถานะพอร์ตดูสดแบบเรียลไทม์ทันทีที่เริ่มรัน EA</li>
                    </ul>
                </div>

                <div className="pt-4 flex justify-center gap-4">
                    <Link href="/dashboard">
                        <Button className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold px-6 shadow-lg shadow-cyan-500/20">
                            กลับไปยัง Dashboard
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-6 px-4 space-y-8">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="w-4 h-4" /> กลับหน้า Dashboard
                </Link>
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-400 bg-cyan-950/20 gap-1.5 py-1 px-3">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
                    EXCLUSIVE PRE-LAUNCH UPGRADE
                </Badge>
            </div>

            {/* Header with Clear Free Trial & Options Notice */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-cyan-950/30 to-purple-950/40 border border-cyan-500/30 p-6 md:p-8 shadow-2xl">
                <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-400/40 text-xs font-mono">
                            EASYM PRIME V2.00
                        </Badge>
                        <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs">
                            สิทธิ์ใช้งานฟรี 2 เดือนเต็ม (60 วัน)
                        </Badge>
                    </div>

                    <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white">
                        อัปเกรดสัมผัสพลัง <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">EasyM Prime</span> เรือธงใหม่ล่าสุด
                    </h1>

                    <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed">
                        เปิดโอกาสให้สมาชิกลูกค้าเก่า EasyM ได้ทดลองใช้นวัตกรรมกู้พอร์ตอัจฉริยะรุ่นใหม่ล่าสุดก่อนใคร 
                        พร้อมระบบ <span className="text-cyan-300 font-semibold">ห้องฟื้นฟูอัจฉริยะ</span>, <span className="text-purple-300 font-semibold">สไนเปอร์กู้ภัย Dynamic</span> และ <span className="text-amber-300 font-semibold">หน้าฟาร์มดูสดเรียลไทม์</span> โดยไม่มีค่าใช้จ่ายตลอดระยะเวลา 2 เดือน
                    </p>

                    {/* 3 Choices Banner */}
                    <div className="mt-4 p-4 md:p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-sm space-y-2.5">
                        <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                            <HelpCircle className="w-4 h-4" />
                            คำแนะนำพิเศษชัดเจน: หลังจากครบกำหนดทดลองใช้ฟรี 2 เดือน ท่านสามารถเลือกเส้นทางได้อิสระ 3 ทางเลือก
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                                <span className="font-bold text-slate-200">ทางเลือกที่ 1: กลับมาใช้ EasyM MAX เดิมฟรี</span>
                                <p className="text-slate-400 leading-normal">สลับกลับไปรัน EasyM MAX เวอร์ชั่นเดิมได้ฟรีตลอดไป (ไม่มีหน้าฟาร์ม)</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                                <span className="font-bold text-slate-200">ทางเลือกที่ 2: ใช้ EasyM MAX ต่อ (มีหน้าฟาร์ม)</span>
                                <p className="text-slate-400 leading-normal">ใช้ MAX ต่อไปพร้อมเปิดใช้งานหน้าฟาร์มมอนิเตอร์พอร์ต (มีค่าบริการ)</p>
                            </div>
                            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-950/60 to-purple-950/60 border border-cyan-500/30 text-xs space-y-1">
                                <span className="font-bold text-cyan-200">ทางเลือกที่ 3: ใช้ EasyM Prime ต่อ</span>
                                <p className="text-slate-300 leading-normal">ใช้ Prime ต่อเนื่องพร้อมหน้าฟาร์มดูสดเรียลไทม์ Telemetry แบบพิเศษ (มีค่าบริการ)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Carousel / Tab Switcher for the 3 Cards */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Layers className="w-5 h-5 text-cyan-400" /> รายละเอียดและข้อมูลเปรียบเทียบ
                    </h2>
                    <div className="flex gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/40">
                        <Button 
                            variant={activeCardTab === 0 ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setActiveCardTab(0)}
                            className={activeCardTab === 0 ? "bg-cyan-600 hover:bg-cyan-700 text-white text-xs" : "text-xs"}
                        >
                            1. จุดเด่น Prime
                        </Button>
                        <Button 
                            variant={activeCardTab === 1 ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setActiveCardTab(1)}
                            className={activeCardTab === 1 ? "bg-cyan-600 hover:bg-cyan-700 text-white text-xs" : "text-xs"}
                        >
                            2. ตารางเทียบกับ MAX
                        </Button>
                        <Button 
                            variant={activeCardTab === 2 ? "default" : "ghost"} 
                            size="sm" 
                            onClick={() => setActiveCardTab(2)}
                            className={activeCardTab === 2 ? "bg-cyan-600 hover:bg-cyan-700 text-white text-xs" : "text-xs"}
                        >
                            3. เงื่อนไข & การเตรียมพอร์ต
                        </Button>
                    </div>
                </div>

                {/* The 3 Cards Container */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* CARD 1: 4 Innovations */}
                    <Card className={`overflow-hidden border-cyan-500/30 transition-all duration-300 ${activeCardTab === 0 ? 'ring-2 ring-cyan-500 shadow-xl shadow-cyan-500/10' : 'opacity-90'}`}>
                        <CardHeader className="bg-gradient-to-r from-cyan-950/40 to-slate-900/60 pb-4 border-b border-border/30">
                            <div className="flex items-center justify-between">
                                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[11px]">การ์ดที่ 1</Badge>
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                            </div>
                            <CardTitle className="text-base md:text-lg font-bold text-white mt-1">
                                4 นวัตกรรมใหม่ใน EasyM Prime
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4 text-xs md:text-sm">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
                                    <ShieldCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">ห้องฟื้นฟูอัจฉริยะ (Smart Recovery Room)</h4>
                                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                                        เมื่อคู่เงินใดติดลบ ระบบจะแยกคู่นั้นเข้าห้องฟื้นฟูเพื่อจัดการแก้เกมอย่างเป็นระบบ ป้องกันไม่ให้ลุกลามฉุดรั้งพอร์ตหลัก และเปิดทางให้คู่เงินอื่นทำกำไรต่อได้ตามปกติ
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0 mt-0.5">
                                    <Crosshair className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">สไนเปอร์กู้ภัย Dynamic Step Lots</h4>
                                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                                        ระบบคำนวณไม้ออกกู้ภัยแบบสไนเปอร์ 3 ไม้ต่อชุด พร้อมกลไกสลับชุดหมุนเวียน ปิดรวบกำไรทันทีเมื่อถึงจุดคุ้มทุน
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                                    <Scale className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">กองทุนตัดขาดทุนข้ามคู่ (Cross-Pair DD Offset)</h4>
                                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                                        นำกำไรสะสมจากคู่เงินที่ปิดบวกมาทยอยหักลบ Drawdown ของคู่ที่อยู่ในห้องฟื้นฟู ลดความเสี่ยงพอร์ตได้เร็วขึ้นถึง 3 เท่า
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0 mt-0.5">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-foreground">ฟาร์มติดตามพอร์ตดูสดเรียลไทม์ (Live Farm)</h4>
                                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                                        อัปเดตข้อมูลสถานะพอร์ต Telemetry ทุกการเคลื่อนไหว แยกแสดงผลคู่ปกติและคู่ในห้องฟื้นฟูอย่างชัดเจน
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* CARD 2: Comparison Table */}
                    <Card className={`overflow-hidden border-purple-500/30 transition-all duration-300 ${activeCardTab === 1 ? 'ring-2 ring-purple-500 shadow-xl shadow-purple-500/10' : 'opacity-90'}`}>
                        <CardHeader className="bg-gradient-to-r from-purple-950/40 to-slate-900/60 pb-4 border-b border-border/30">
                            <div className="flex items-center justify-between">
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[11px]">การ์ดที่ 2</Badge>
                                <Scale className="w-4 h-4 text-purple-400" />
                            </div>
                            <CardTitle className="text-base md:text-lg font-bold text-white mt-1">
                                เปรียบเทียบ EasyM MAX vs EasyM Prime
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3 text-xs">
                            <div className="space-y-3 divide-y divide-border/30">
                                {/* Row 1: Currency Pairs */}
                                <div className="pt-2">
                                    <span className="font-semibold text-foreground block mb-1">ชุดคู่เงินที่เทรด</span>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block">MAX:</span>
                                            ชุดคลาสสิกเดิม
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block">Prime:</span>
                                            ปลด AUDCAD, EURCHF, GBPCHF<br />
                                            เสริม AUDNZD, CADCHF, NZDCAD (ลดสเปรด/แกว่ง)
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Crisis management */}
                                <div className="pt-2">
                                    <span className="font-semibold text-foreground block mb-1">การรับมือวิกฤตพอร์ต</span>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block">MAX:</span>
                                            ตัดขาดทุนตามเงื่อนไขปกติ
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block">Prime:</span>
                                            เข้า "ห้องฟื้นฟูอัจฉริยะ" แยกคู่ออกจากพอร์ตหลัก
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Recovery Strategy */}
                                <div className="pt-2">
                                    <span className="font-semibold text-foreground block mb-1">กลยุทธ์กู้คืนพอร์ต</span>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block">MAX:</span>
                                            เฉลี่ยต้นทุนแบบคงที่
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block">Prime:</span>
                                            สไนเปอร์กู้ภัย Dynamic Step Lots 3 ไม้ สลับชุดออโต้
                                        </div>
                                    </div>
                                </div>

                                {/* Row 4: Currency Cluster Limiter (Both have it!) */}
                                <div className="pt-2">
                                    <span className="font-semibold text-foreground block mb-1">การควบคุมความหนาแน่นสกุลเงิน</span>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40 text-emerald-400">
                                            <span className="font-bold text-muted-foreground block text-foreground">MAX:</span>
                                            <span className="inline-flex items-center gap-1 font-semibold">
                                                <Check className="w-3.5 h-3.5 text-emerald-400" /> มี (คุมไม่เกิน 3 คู่ต่อสกุล)
                                            </span>
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-emerald-300">
                                            <span className="font-bold text-cyan-400 block">Prime:</span>
                                            <span className="inline-flex items-center gap-1 font-semibold">
                                                <Check className="w-3.5 h-3.5 text-emerald-400" /> มี (คุมไม่เกิน 3 คู่ต่อสกุล)
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 5: Monitor & Farm */}
                                <div className="pt-2">
                                    <span className="font-semibold text-foreground block mb-1">ระบบมอนิเตอร์และหน้าฟาร์ม</span>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="p-2 rounded bg-muted/40 border border-border/40">
                                            <span className="font-bold text-muted-foreground block">MAX:</span>
                                            แดชบอร์ดมอนิเตอร์ทั่วไป
                                        </div>
                                        <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-200">
                                            <span className="font-bold text-cyan-400 block">Prime:</span>
                                            ระบบดูสดเรียลไทม์ Telemetry & โหมดกักขังแยกพอร์ต
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* CARD 3: Conditions & Port Preparation */}
                    <Card className={`overflow-hidden border-amber-500/30 transition-all duration-300 ${activeCardTab === 2 ? 'ring-2 ring-amber-500 shadow-xl shadow-amber-500/10' : 'opacity-90'}`}>
                        <CardHeader className="bg-gradient-to-r from-amber-950/40 to-slate-900/60 pb-4 border-b border-border/30">
                            <div className="flex items-center justify-between">
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[11px]">การ์ดที่ 3</Badge>
                                <Coins className="w-4 h-4 text-amber-400" />
                            </div>
                            <CardTitle className="text-base md:text-lg font-bold text-white mt-1">
                                เงื่อนไขและการเตรียมพอร์ตก่อนอัปเกรด
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4 text-xs md:text-sm">
                            <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                                    <Coins className="w-4 h-4" /> 1. ขนาดพอร์ตและทุนสำรอง
                                </div>
                                <p className="text-stone-300 text-xs leading-relaxed">
                                    เริ่มต้น <span className="font-semibold text-white">$1,000 หรือ 100,000 Cent</span> (แนะนำเพิ่มทุน $500 หรือมากกว่ายอดติดลบของคู่เงินสูงสุด เพื่อเป็นบัฟเฟอร์ให้ระบบฟื้นฟูทำงานกู้พอร์ตได้อย่างเต็มประสิทธิภาพ)
                                </p>
                            </div>

                            <div className="space-y-1.5 p-3 rounded-xl bg-slate-900 border border-border/40">
                                <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                                    <Activity className="w-4 h-4 text-cyan-400" /> 2. ความพร้อมของพอร์ต
                                </div>
                                <p className="text-muted-foreground text-xs leading-relaxed">
                                    สามารถอัปเกรดได้ทั้งพอร์ตใหม่และพอร์ตที่มีออเดอร์ค้าง (ระบบจะตรวจจับและดึงคู่ที่ติดลบเข้าห้องฟื้นฟูอัจฉริยะอัตโนมัติทันทีที่เริ่มรัน)
                                </p>
                            </div>

                            <div className="space-y-1.5 p-3 rounded-xl bg-slate-900 border border-border/40">
                                <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
                                    <Clock className="w-4 h-4 text-purple-400" /> 3. ระยะเวลาการอนุมัติ
                                </div>
                                <p className="text-muted-foreground text-xs leading-relaxed">
                                    สิทธิ์จะได้รับการอนุมัติและเปิดให้ดาวน์โหลดไฟล์ EA ในหน้าแดชบอร์ดภายใน 24 ชั่วโมงหลังจากส่งคำขอ
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bottom Form: Port Selection & Submit */}
            <Card className="border-cyan-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/20 shadow-2xl">
                <CardHeader className="border-b border-border/40 pb-4">
                    <CardTitle className="text-lg md:text-xl font-bold flex items-center gap-2 text-white">
                        <Send className="w-5 h-5 text-cyan-400" /> แบบฟอร์มส่งคำขออัปเกรดเป็น EasyM Prime
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                        เลือกพอร์ต EasyM ปัจจุบันของท่านที่ต้องการอัปเกรดเข้ารับสิทธิ์ทดลองใช้งานฟรี 2 เดือน
                    </p>
                </CardHeader>
                <CardContent className="p-6">
                    {userPorts.length === 0 ? (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <div>
                                ไม่พบพอร์ตที่มีสิทธิ์ใช้งาน EasyM ในบัญชีของคุณ หากคุณเป็นลูกค้า EasyM อยู่แล้ว โปรดติดต่อแอดมินเพื่อเชื่อมต่อพอร์ต
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmitUpgrade} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-foreground">
                                        เลือกหมายเลขพอร์ต EasyM ที่ต้องการอัปเกรด <span className="text-red-500">*</span>
                                    </Label>
                                    <select 
                                        value={selectedPort}
                                        onChange={(e) => setSelectedPort(e.target.value)}
                                        className="w-full h-10 px-3 py-2 rounded-md bg-background border border-input text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        required
                                    >
                                        {userPorts.map((port) => (
                                            <option key={port} value={port}>
                                                พอร์ตหมายเลข: {port}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-muted-foreground">
                                        * ระบบจะสลับ License ของพอร์ตนี้เป็น EasyM Prime และเริ่มนับเวลาสิทธิ์ฟรี 2 เดือนหลังจากแอดมินอนุมัติ
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-foreground">
                                        บันทึกเพิ่มเติม / แจ้งสถานะพอร์ตปัจจุบัน (ไม่บังคับ)
                                    </Label>
                                    <Input
                                        placeholder="เช่น ทุนปัจจุบัน $1,500, ติดลบ EURUSD อยู่ $150 อยากให้ช่วยตรวจสอบ"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="h-10 text-sm"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        ข้อมูลนี้จะส่งตรงถึงทีมงานเพื่อช่วยเตรียมความพร้อมก่อนเริ่มรัน EA
                                    </p>
                                </div>
                            </div>

                            {hasExistingPendingUpgrade && (
                                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 shrink-0 text-yellow-300" />
                                    คุณมีคำขออัปเกรดพอร์ตอื่นที่กำลังรอแอดมินตรวจสอบอยู่แล้ว คุณยังสามารถส่งคำขอสำหรับพอร์ตอื่นได้ตามต้องการ
                                </div>
                            )}

                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40">
                                <div className="text-xs text-muted-foreground">
                                    ✓ สิทธิ์ทดลองใช้งานฟรี 2 เดือนเต็ม • ไม่มีค่าใช้จ่ายแอบแฝง • ปลดล็อกดาวน์โหลด EA ทันทีเมื่ออนุมัติ
                                </div>
                                <Button
                                    type="submit"
                                    disabled={submitting || !selectedPort}
                                    className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold px-8 py-2.5 shadow-lg shadow-cyan-500/25 border border-cyan-400/30 text-sm"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            กำลังส่งคำขอ...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="mr-2 h-4 w-4 text-yellow-300" />
                                            ยืนยันส่งคำขออัปเกรดเป็น EasyM Prime (ฟรี 2 เดือน)
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
