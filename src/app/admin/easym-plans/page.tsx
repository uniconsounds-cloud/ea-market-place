'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
    Check, 
    Sparkles, 
    ShieldCheck, 
    Server, 
    Smartphone, 
    Zap, 
    Lock, 
    Crown, 
    HelpCircle, 
    ArrowRight, 
    Layers, 
    SlidersHorizontal, 
    ChevronRight, 
    CheckCircle2, 
    Building2, 
    AlertCircle, 
    RefreshCcw,
    Gauge,
    MonitorPlay,
    Cpu,
    Coins,
    TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ---------------------------------------------------------------------------
// Plan Data Definitions based on EasyM Marketing Specification
// ---------------------------------------------------------------------------
export type CustomerType = 'existing' | 'new';
export type VpsOption = 'self' | 'managed';
export type BrokerOption = 'ib' | 'own';

export interface PlanItem {
    id: string;
    name: string;
    tier: 'mini' | 'max' | 'prime';
    tagline: string;
    description: string;
    priceAnnual: number;
    originalPriceAnnual?: number;
    customerType: CustomerType;
    vpsOption: VpsOption;
    farmUi: 'none' | 'standard' | 'advanced';
    hasTrial2Month: boolean;
    badge?: string;
    isFeatured?: boolean;
    highlights: string[];
    specs: {
        pairs: string;
        minCapital: string;
        vpsIncluded: boolean;
        webControl: boolean;
        singleDomainV2: boolean;
    };
    imageBox: string;
}

const ALL_PLANS: PlanItem[] = [
    // 1. Existing Customer + Run on My VPS
    {
        id: 'mini-existing-self',
        name: 'EasyM mini (เดิม)',
        tier: 'mini',
        tagline: 'Simple Start',
        description: 'เริ่มต้นใช้งาน EasyM บน VPS ของคุณ เหมาะสำหรับพอร์ตขนาดเล็กหรือทดสอบระบบเบื้องต้น',
        priceAnnual: 0,
        customerType: 'existing',
        vpsOption: 'self',
        farmUi: 'none',
        hasTrial2Month: false,
        highlights: [
            'สิทธิ์ใช้งานฟรีตลอดอายุการใช้งาน',
            'ติดตั้งและดูแลบน VPS ของลูกค้าเอง',
            'สมัครผ่าน IB ของ EasyM',
            'เทรด 5 คู่เงินหลักความเสี่ยงต่ำ',
            'ไม่มี Farm UI (มอนิเตอร์บน MT5)',
        ],
        specs: {
            pairs: '5 คู่เงิน',
            minCapital: '50,000 USC ($500)',
            vpsIncluded: false,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_mini_box.png'
    },
    {
        id: 'max-existing-self-free',
        name: 'EasyM MAX (แบบเดิม)',
        tier: 'max',
        tagline: 'Multi-Pair Trading Classic',
        description: 'ใช้งาน MAX แบบดั้งเดิม ดูแล VPS ด้วยตัวเอง สามารถกลับมาใช้งานแบบนี้ได้หลังหมดช่วงทดลอง Farm UI',
        priceAnnual: 0,
        customerType: 'existing',
        vpsOption: 'self',
        farmUi: 'none',
        hasTrial2Month: false,
        highlights: [
            'สิทธิ์ใช้งานฟรีตลอดอายุการใช้งาน',
            'เทรดกระจายความเสี่ยง 10 คู่เงิน',
            'ติดตั้งและดูแลบน VPS ของลูกค้าเอง',
            'สมัครผ่าน IB ของ EasyM',
            'ไม่มี Farm UI (มอนิเตอร์บน MT5)',
        ],
        specs: {
            pairs: '10 คู่เงิน',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: false,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },
    {
        id: 'max-existing-self-ui',
        name: 'EasyM MAX + Farm UI',
        tier: 'max',
        tagline: 'Multi-Pair Trading Made Simple',
        description: 'เพิ่ม Standard Farm UI สำหรับติดตามพอร์ตผ่านหน้าเว็บ มอนิเตอร์ผลงานและกำไรได้ทุกที่ตลอด 24 ชม.',
        priceAnnual: 4000,
        customerType: 'existing',
        vpsOption: 'self',
        farmUi: 'standard',
        hasTrial2Month: false,
        highlights: [
            'ราคาพิเศษสำหรับลูกค้าเดิมเพียง 4,000 บ./ปี',
            'รวม Standard Farm UI ดูสถานะผ่านเว็บได้ทันที',
            'มอนิเตอร์ยอด Balance, Equity, Drawdown สด',
            'ระบบแจ้งเตือนและสถิติกำไรสะสมรายวัน',
            'รันและดูแล VPS ด้วยตนเอง',
        ],
        specs: {
            pairs: '10 คู่เงิน',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: false,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },
    {
        id: 'prime-existing-self',
        name: 'EasyM PRIME (อัปเกรด)',
        tier: 'prime',
        tagline: 'Advanced Control. Smarter Protection.',
        description: 'อัปเกรดสู่รุ่นท็อปพร้อม Advanced Farm UI สั่งเปิด–ปิดคู่เงินจากหน้าเว็บได้ พร้อมเกราะป้องกันความผันผวนขั้นสูง',
        priceAnnual: 8000,
        originalPriceAnnual: 10000,
        customerType: 'existing',
        vpsOption: 'self',
        farmUi: 'advanced',
        hasTrial2Month: false,
        badge: 'Recommended Upgrade',
        isFeatured: true,
        highlights: [
            'ราคาพิเศษลูกค้าเดิมลด 2,000 บาท (จาก 10,000 บ.)',
            'รวม Advanced Farm UI เต็มความสามารถ',
            'สั่งเปิด–ปิดคู่เงินผ่านหน้าเว็บได้ทันที',
            'ระบบกรองความผันผวนและข่าวแรงอัจฉริยะ',
            'รองรับฟีเจอร์การควบคุมใหม่ในอนาคต',
        ],
        specs: {
            pairs: '10 คู่เงิน + Adaptive Filter',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: false,
            webControl: true,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },

    // 2. Existing Customer + EasyM Managed
    {
        id: 'max-existing-managed',
        name: 'EasyM MAX Managed',
        tier: 'max',
        tagline: 'We Run It. You Stay in Control.',
        description: 'ลดภาระดูแลระบบ ทีม EasyM รันบน Cloud VPS เสถียรสูงและดูแลหลังบ้านให้ทั้งหมด ลูกค้าติดตามผ่าน Farm UI',
        priceAnnual: 6000,
        originalPriceAnnual: 12000,
        customerType: 'existing',
        vpsOption: 'managed',
        farmUi: 'standard',
        hasTrial2Month: false,
        badge: 'ลด 50% ลูกค้าเดิม',
        highlights: [
            'สิทธิ์ลูกค้าเดิมลด 50% (เพียง 6,000 บ./ปี จาก 12,000)',
            'รวม Cloud VPS ฟรี ไม่ต้องเสียค่าเช่า VPS เอง',
            'ทีมงาน EasyM มอนิเตอร์และดูแลระบบ 24/5',
            'รวม Standard Farm UI ติดตามผ่านมือถือได้ 100%',
            'ไม่ต้องเปิดคอม ไม่ต้องเฝ้ากราฟ',
        ],
        specs: {
            pairs: '10 คู่เงิน',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: true,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },
    {
        id: 'prime-existing-managed',
        name: 'EasyM PRIME Managed',
        tier: 'prime',
        tagline: 'Best Value for Existing Customers',
        description: 'ประสบการณ์สมบูรณ์แบบสูงสุด ดูแลครบวงจรด้วย Cloud VPS + Advanced Farm UI สั่งเปิด–ปิดคู่เงินผ่านเว็บได้เบ็ดเสร็จ',
        priceAnnual: 12000,
        originalPriceAnnual: 15000,
        customerType: 'existing',
        vpsOption: 'managed',
        farmUi: 'advanced',
        hasTrial2Month: false,
        badge: 'Best Value for Existing Customers',
        isFeatured: true,
        highlights: [
            'สิทธิ์อัปเกรดลูกค้า MAX เดิมเพียง 12,000 บ. (ประหยัด 3,000 บ.)',
            'เท่ากับราคา MAX Managed ของลูกค้าใหม่ แต่ได้รุ่น PRIME ทันที!',
            'รวม Cloud VPS สเปกพรีเมียม และทีมดูแล 24/5',
            'รวม Advanced Farm UI สั่งเปิด–ปิดคู่เงินผ่านเว็บ',
            'ระบบ Single Domain 3-Tier ประหยัดเน็ตสูงสุด 90%',
        ],
        specs: {
            pairs: '10 คู่เงิน + Adaptive Filter',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: true,
            webControl: true,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },

    // 3. New Customer + Run on My VPS
    {
        id: 'mini-new-self',
        name: 'EasyM mini Free',
        tier: 'mini',
        tagline: 'Simple Start',
        description: 'เริ่มต้นใช้งาน EasyM บน VPS ของคุณ เหมาะสำหรับผู้เริ่มต้นหรือพอร์ตขนาดเล็ก ไม่มีค่าใช้จ่ายรายปี',
        priceAnnual: 0,
        customerType: 'new',
        vpsOption: 'self',
        farmUi: 'none',
        hasTrial2Month: false,
        highlights: [
            'ใช้งานฟรี ไม่มีค่าบริการรายปี',
            'ต้องสมัครผ่าน IB ของ EasyM',
            'ติดตั้งและดูแลบน VPS ของลูกค้าเอง',
            'กลยุทธ์เทรด 5 คู่เงินความเสี่ยงต่ำ',
            'ไม่มี Farm UI (มอนิเตอร์บน MT5)',
        ],
        specs: {
            pairs: '5 คู่เงิน',
            minCapital: '50,000 USC ($500)',
            vpsIncluded: false,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_mini_box.png'
    },
    {
        id: 'max-new-self-free',
        name: 'EasyM MAX Free',
        tier: 'max',
        tagline: 'Standalone Power',
        description: 'ระบบเทรด 10 คู่เงินเต็มรูปแบบ เหมาะสำหรับผู้ที่ต้องการดูแลและตรวจสอบผ่าน Dashboard ภายใน MT5 ด้วยตนเอง',
        priceAnnual: 0,
        customerType: 'new',
        vpsOption: 'self',
        farmUi: 'none',
        hasTrial2Month: false,
        highlights: [
            'ใช้งานฟรี ไม่มีค่าบริการรายปี',
            'เทรดกระจายความเสี่ยง 10 คู่เงิน',
            'ต้องสมัครผ่าน IB ของ EasyM',
            'ติดตั้งและดูแลบน VPS ของลูกค้าเอง',
            'ไม่มี Farm UI (มอนิเตอร์บน MT5)',
        ],
        specs: {
            pairs: '10 คู่เงิน',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: false,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },
    {
        id: 'max-new-self-system',
        name: 'EasyM MAX System',
        tier: 'max',
        tagline: 'Multi-Pair Trading Made Simple',
        description: 'ระบบเทรด MAX ครบชุด พร้อม Standard Farm UI สำหรับติดตามหลายพอร์ตผ่านเว็บได้ทุกที่ทุกเวลา',
        priceAnnual: 8000,
        customerType: 'new',
        vpsOption: 'self',
        farmUi: 'standard',
        hasTrial2Month: true,
        highlights: [
            '🎁 ฟรีทดลองใช้งาน Farm UI เต็มรูปแบบ 2 เดือนเต็ม',
            'รวม Standard Farm UI มอนิเตอร์พอร์ตผ่านเว็บ',
            'สถิติกำไรและ Drawdown สดแบบเรียลไทม์',
            'เทรดกระจายความเสี่ยง 10 คู่เงิน',
            'ติดตั้งบน VPS ของลูกค้าเอง',
        ],
        specs: {
            pairs: '10 คู่เงิน',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: false,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },
    {
        id: 'prime-new-self-system',
        name: 'EasyM PRIME System',
        tier: 'prime',
        tagline: 'More Control, More Protection',
        description: 'ระบบเทรดอัจฉริยะรุ่นท็อป รวม Advanced Farm UI สั่งเปิด–ปิดคู่เงินผ่านเว็บ ควบคุมและปกป้องเงินทุนได้เหนือระดับ',
        priceAnnual: 10000,
        customerType: 'new',
        vpsOption: 'self',
        farmUi: 'advanced',
        hasTrial2Month: true,
        badge: 'More Control, More Protection',
        isFeatured: true,
        highlights: [
            '🎁 ฟรีทดลองใช้งาน Farm UI เต็มรูปแบบ 2 เดือนเต็ม',
            'รวม Advanced Farm UI ฟังก์ชันเต็มรูปแบบ',
            'สั่งเปิด–ปิดคู่เงินผ่านหน้าเว็บได้ทันที',
            'กลยุทธ์ Adaptive Protection ป้องกันความผันผวน',
            'พร้อมรับฟีเจอร์ควบคุมใหม่และการแจ้งเตือนในอนาคต',
        ],
        specs: {
            pairs: '10 คู่เงิน + Adaptive Filter',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: false,
            webControl: true,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },

    // 4. New Customer + EasyM Managed
    {
        id: 'max-new-managed',
        name: 'EasyM MAX Managed',
        tier: 'max',
        tagline: 'Hands-Free Trading',
        description: 'รวม VPS และการดูแลระบบโดยทีมงาน EasyM พร้อม Standard Farm UI ลูกค้าไม่ต้องเฝ้าจอ ไม่ต้องเปิดคอมเอง',
        priceAnnual: 12000,
        customerType: 'new',
        vpsOption: 'managed',
        farmUi: 'standard',
        hasTrial2Month: true,
        highlights: [
            '🎁 ฟรีทดลองใช้งาน Farm UI เต็มรูปแบบ 2 เดือนเต็ม',
            'รวม Cloud VPS ประสิทธิภาพสูง ไม่ต้องเช่า VPS เอง',
            'ทีมงานมืออาชีพดูแลการรันและความเสถียร 24/5',
            'รวม Standard Farm UI ตรวจสอบผลงานได้ผ่านมือถือ',
            'เริ่มต้นง่าย เหมาะกับผู้ที่ไม่มีเวลาดูแลคอมพิวเตอร์',
        ],
        specs: {
            pairs: '10 คู่เงิน',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: true,
            webControl: false,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },
    {
        id: 'prime-new-managed',
        name: 'EasyM PRIME Managed',
        tier: 'prime',
        tagline: 'Recommended — Complete EasyM Experience',
        description: 'แพ็กเกจเรือธงที่ดีที่สุด รวมทุกอย่าง: Cloud VPS + ทีมงานดูแล 24/5 + Advanced Farm UI สั่งงานผ่านเว็บ 100%',
        priceAnnual: 15000,
        customerType: 'new',
        vpsOption: 'managed',
        farmUi: 'advanced',
        hasTrial2Month: true,
        badge: 'Recommended — Complete EasyM Experience',
        isFeatured: true,
        highlights: [
            '🎁 ฟรีทดลองใช้งาน Farm UI เต็มรูปแบบ 2 เดือนเต็ม',
            'เพิ่มจาก MAX เพียง 3,000 บ./ปี (~250 บ./เดือน) แต่ได้รุ่นท็อป!',
            'รวม Cloud VPS สเปกสูง และทีมงานดูแลระบบ 24/5',
            'รวม Advanced Farm UI ควบคุมสั่งเปิด–ปิดคู่เงินผ่านเว็บ',
            'สถาปัตยกรรม Single Domain 3-Tier ประหยัดแบนด์วิดท์สูงสุด',
        ],
        specs: {
            pairs: '10 คู่เงิน + Adaptive Filter',
            minCapital: '100,000 USC ($1,000)',
            vpsIncluded: true,
            webControl: true,
            singleDomainV2: true,
        },
        imageBox: '/assets/easym_max_box.png'
    },
];

export default function EasyMPlansPage() {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string>('');

    // Selection States
    const [customerType, setCustomerType] = useState<CustomerType>('new');
    const [vpsOption, setVpsOption] = useState<VpsOption>('managed');
    const [selectedPlanId, setSelectedPlanId] = useState<string>('prime-new-managed');
    const [brokerOption, setBrokerOption] = useState<BrokerOption>('ib');
    const [activeTab, setActiveTab] = useState<'flow' | 'matrix' | 'spec'>('flow');

    // Super Admin Verification: ONLY juntarasate@gmail.com
    useEffect(() => {
        const verifySuperAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setCurrentUserEmail(user.email || '');

            if (user.email !== 'juntarasate@gmail.com') {
                setIsAuthorized(false);
                setAuthLoading(false);
                return;
            }

            setIsAuthorized(true);
            setAuthLoading(false);
        };
        verifySuperAdmin();
    }, [router]);

    // Available plans matching Step 1 & Step 2
    const availablePlans = useMemo(() => {
        return ALL_PLANS.filter(p => p.customerType === customerType && p.vpsOption === vpsOption);
    }, [customerType, vpsOption]);

    // Auto-select the most recommended plan when Step 1 or Step 2 changes
    useEffect(() => {
        const featuredPlan = availablePlans.find(p => p.isFeatured) || availablePlans[availablePlans.length - 1];
        if (featuredPlan) {
            setSelectedPlanId(featuredPlan.id);
        }
    }, [availablePlans]);

    // Selected plan details
    const selectedPlan = useMemo(() => {
        return ALL_PLANS.find(p => p.id === selectedPlanId) || availablePlans[0];
    }, [selectedPlanId, availablePlans]);

    // Price Calculation
    const ownBrokerFee = brokerOption === 'own' ? 4000 : 0;
    const basePrice = selectedPlan ? selectedPlan.priceAnnual : 0;
    const totalAnnualPrice = basePrice + ownBrokerFee;
    const averageMonthlyPrice = Math.round(totalAnnualPrice / 12);

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground font-mono">กำลังตรวจสอบสิทธิ์ Super Admin...</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="p-8 max-w-xl mx-auto my-12 text-center bg-card border border-destructive/40 rounded-2xl shadow-xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">สิทธิ์การเข้าถึงถูกจำกัด (Restricted Access)</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    หน้านี้เป็นหน้าสำหรับออกแบบโครงสร้างราคาและการตลาดของกลุ่มสินค้า <strong>EasyM</strong> โดยเฉพาะ ได้รับการจำกัดสิทธิ์ให้เข้าถึงได้เฉพาะ <strong>Super Admin (Suphakorn Juntarasate)</strong> เท่านั้น
                </p>
                <div className="pt-2">
                    <Link href="/admin">
                        <Button variant="outline" size="sm">
                            กลับสู่หน้า Admin Panel
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Top Super Admin Preview Alert Banner */}
            <div className="bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-purple-500/15 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                        <Crown className="w-5 h-5 fill-amber-400/40" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                                EasyM Exclusive Marketing &amp; Pricing Page
                            </span>
                            <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] px-2 py-0 font-mono">
                                SUPER ADMIN ONLY
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            หน้านี้ถูกสร้างขึ้นเพื่อออกแบบและจำลอง Customer Journey สำหรับกลุ่ม EasyM ตามแผนงานใน <code className="text-amber-300">EasyM Marketing</code> ยังไม่เปิดให้บุคคลภายนอกเข้าถึง
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                        <TabsList className="h-8 bg-black/40 border border-border/50 text-xs">
                            <TabsTrigger value="flow" className="h-7 text-xs px-2.5">
                                <Sparkles className="w-3.5 h-3.5 mr-1 text-cyan-400" /> หน้าเลือกแพ็กเกจ
                            </TabsTrigger>
                            <TabsTrigger value="matrix" className="h-7 text-xs px-2.5">
                                <Layers className="w-3.5 h-3.5 mr-1 text-sky-400" /> ตารางราคารวม
                            </TabsTrigger>
                            <TabsTrigger value="spec" className="h-7 text-xs px-2.5">
                                <HelpCircle className="w-3.5 h-3.5 mr-1 text-amber-400" /> สเปก Farm UI
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* TAB 1: MAIN CUSTOMER JOURNEY FLOW */}
            {activeTab === 'flow' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Header Banner */}
                    <div className="text-center space-y-3 max-w-3xl mx-auto pt-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold tracking-wide">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            CHOOSE YOUR EASYM PLAN
                        </div>
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                            เลือกแพ็กเกจ EasyM ที่ใช่สำหรับคุณ
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                            เลือกตามสถานะลูกค้า รูปแบบการดูแลระบบ และระดับ EA ที่เหมาะกับพอร์ตของคุณ ออกแบบมาให้เลือกง่ายทีละสเต็ป พร้อมสิทธิ์ทดลองใช้ Farm UI ฟรี 2 เดือนเต็ม
                        </p>

                        {/* Step Progress Bar */}
                        <div className="pt-4 flex items-center justify-center gap-2 sm:gap-4 text-xs font-medium">
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${customerType ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-muted text-muted-foreground border-border'}`}>
                                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px]">1</span>
                                <span>สถานะลูกค้า</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${vpsOption ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-muted text-muted-foreground border-border'}`}>
                                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px]">2</span>
                                <span>วิธีดูแลระบบ</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border-cyan-400 text-cyan-300 font-bold shadow-sm">
                                <span className="w-5 h-5 rounded-full bg-cyan-500/30 flex items-center justify-center text-[10px]">3</span>
                                <span>เลือกรุ่น EA &amp; สรุปราคา</span>
                            </div>
                        </div>
                    </div>

                    {/* STEP 1: CUSTOMER TYPE SELECTION */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shadow-sm">
                                    1
                                </span>
                                <h3 className="text-base font-bold text-foreground">
                                    เลือกประเภทลูกค้า (Customer Type)
                                </h3>
                            </div>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                สิทธิพิเศษเฉพาะสำหรับลูกค้าเดิม และแพ็กเกจเปิดตัวสำหรับลูกค้าใหม่
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Option 1: Existing Customer */}
                            <div 
                                onClick={() => setCustomerType('existing')}
                                className={`group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                                    customerType === 'existing' 
                                        ? 'bg-gradient-to-br from-blue-950/40 via-card to-card border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500' 
                                        : 'bg-card border-border/70 hover:border-border hover:bg-muted/30'
                                }`}
                            >
                                {customerType === 'existing' && (
                                    <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                                        <div className="bg-blue-500 text-white text-[9px] font-bold py-0.5 text-center transform rotate-45 translate-x-3 translate-y-1 shadow-sm">
                                            ✓
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                            <ShieldCheck className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-foreground group-hover:text-blue-400 transition-colors">
                                                Existing Customer — ลูกค้าเดิม
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground">
                                                สำหรับผู้ใช้งาน EasyM ที่รันอยู่ก่อนเริ่มระบบราคาใหม่
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                        รับสิทธิ์ใช้ต่อในราคาเดิม (รวมตัวเลือกฟรีแบบดั้งเดิม) หรือรับสิทธิ์อัปเกรดสู่ <strong className="text-blue-300">EasyM PRIME</strong> ในราคาพิเศษสำหรับสมาชิกเดิมตลอดชีพ
                                    </p>
                                </div>
                                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-blue-400 font-medium">
                                        💎 รับสิทธิ์ส่วนลดพิเศษสูงสุด 50%
                                    </span>
                                    <Badge variant={customerType === 'existing' ? 'default' : 'outline'} className="text-[10px]">
                                        {customerType === 'existing' ? 'เลือกอยู่' : 'คลิกเพื่อเลือก'}
                                    </Badge>
                                </div>
                            </div>

                            {/* Option 2: New Customer */}
                            <div 
                                onClick={() => setCustomerType('new')}
                                className={`group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                                    customerType === 'new' 
                                        ? 'bg-gradient-to-br from-emerald-950/40 via-card to-card border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500' 
                                        : 'bg-card border-border/70 hover:border-border hover:bg-muted/30'
                                }`}
                            >
                                {customerType === 'new' && (
                                    <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                                        <div className="bg-emerald-500 text-white text-[9px] font-bold py-0.5 text-center transform rotate-45 translate-x-3 translate-y-1 shadow-sm">
                                            ✓
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                            <Zap className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-foreground group-hover:text-emerald-400 transition-colors">
                                                New Customer — ลูกค้าใหม่
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground">
                                                เริ่มต้นใช้งานระบบเทรด EasyM อัตโนมัติเต็มรูปแบบ
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                                        เริ่มต้นง่าย เลือกให้เหมาะกับระดับพอร์ตและรูปแบบการดูแลที่ต้องการ แพ็กเกจ MAX และ PRIME มาพร้อม <strong className="text-emerald-300">สิทธิ์ทดลอง Farm UI ฟรี 2 เดือน</strong>
                                    </p>
                                </div>
                                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-emerald-400 font-medium">
                                        🎁 ฟรีทดลองใช้ Farm UI 2 เดือนเต็ม
                                    </span>
                                    <Badge variant={customerType === 'new' ? 'default' : 'outline'} className="text-[10px]">
                                        {customerType === 'new' ? 'เลือกอยู่' : 'คลิกเพื่อเลือก'}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STEP 2: VPS MANAGEMENT SELECTION */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shadow-sm">
                                    2
                                </span>
                                <h3 className="text-base font-bold text-foreground">
                                    เลือกวิธีดูแลระบบ (VPS Management)
                                </h3>
                            </div>
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                ดูแล VPS เอง หรือให้ทีมงาน EasyM รันและดูแลหลังบ้านให้ทั้งหมด
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Option 1: Run on My VPS */}
                            <div 
                                onClick={() => setVpsOption('self')}
                                className={`group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                                    vpsOption === 'self' 
                                        ? 'bg-gradient-to-br from-indigo-950/40 via-card to-card border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500' 
                                        : 'bg-card border-border/70 hover:border-border hover:bg-muted/30'
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                            <Server className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-foreground group-hover:text-indigo-400 transition-colors">
                                                Run on My VPS — ฉันดูแล VPS เอง
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground">
                                                สำหรับผู้ที่มี VPS อยู่แล้ว และจัดการระบบติดตั้งเองได้
                                            </p>
                                        </div>
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-1 pt-1">
                                        <li className="flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span>ค่าใช้จ่ายแพ็กเกจประหยัดกว่า</span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span>มีตัวเลือกรุ่นฟรี (mini / MAX Free)</span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                            <span>ลูกค้าติดตั้งและตรวจสอบระบบด้วยตนเอง</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-indigo-400 font-medium">
                                        🖥️ รองรับทั้งรุ่นฟรีและรุ่นระบบ
                                    </span>
                                    <Badge variant={vpsOption === 'self' ? 'default' : 'outline'} className="text-[10px]">
                                        {vpsOption === 'self' ? 'เลือกอยู่' : 'คลิกเพื่อเลือก'}
                                    </Badge>
                                </div>
                            </div>

                            {/* Option 2: EasyM Managed */}
                            <div 
                                onClick={() => setVpsOption('managed')}
                                className={`group p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                                    vpsOption === 'managed' 
                                        ? 'bg-gradient-to-br from-cyan-950/40 via-card to-card border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500' 
                                        : 'bg-card border-border/70 hover:border-border hover:bg-muted/30'
                                }`}
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                                            <Cpu className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="font-bold text-sm text-foreground group-hover:text-cyan-400 transition-colors">
                                                    EasyM Managed — ให้ EasyM ดูแลให้
                                                </h4>
                                                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[9px] px-1.5 py-0 font-normal">
                                                    แนะนำ
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                ทีม EasyM รัน VPS และดูแลระบบหลังบ้านให้ทั้งหมด
                                            </p>
                                        </div>
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-1 pt-1">
                                        <li className="flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            <span><strong>รวม Cloud VPS เสถียรสูงฟรี</strong> (ไม่ต้องเช่า VPS เพิ่ม)</span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            <span>ทีมงานมอนิเตอร์และดูแลระบบความเสถียร 24/5</span>
                                        </li>
                                        <li className="flex items-center gap-1.5">
                                            <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            <span>ติดตามผลและสั่งงานผ่านหน้าเว็บ 100% ไม่ต้องเปิดคอม</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="pt-3 border-t border-border/40 mt-3 flex items-center justify-between text-xs">
                                    <span className="text-[11px] text-cyan-400 font-medium">
                                        ⚡ ประหยัดเวลา ไม่ต้องมีความรู้เรื่อง VPS
                                    </span>
                                    <Badge variant={vpsOption === 'managed' ? 'default' : 'outline'} className="text-[10px]">
                                        {vpsOption === 'managed' ? 'เลือกอยู่' : 'คลิกเพื่อเลือก'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {vpsOption === 'managed' && (
                            <div className="p-2.5 bg-cyan-950/20 border border-cyan-500/30 rounded-lg text-xs text-cyan-200 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                                <span>
                                    <strong>ข้อสังเกต:</strong> ในโหมด EasyM Managed จะเสนอเฉพาะรุ่น <strong>MAX</strong> และ <strong>PRIME</strong> ที่เชื่อมต่อกับ Farm UI เท่านั้น (รุ่น mini เป็นรุ่นฟรีสำหรับผู้ที่ดูแล VPS เอง)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* STEP 3: CHOOSE YOUR EA & PACKAGES */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-cyan-500 text-black font-bold text-xs flex items-center justify-center shadow-sm">
                                    3
                                </span>
                                <div>
                                    <h3 className="text-base font-bold text-foreground">
                                        เลือกรุ่น EA และแพ็กเกจ (Choose Your EA)
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        แสดงเฉพาะแพ็กเกจที่ตรงกับตัวเลือก {customerType === 'existing' ? 'ลูกค้าเดิม' : 'ลูกค้าใหม่'} + {vpsOption === 'self' ? 'รัน VPS เอง' : 'EasyM ดูแลให้'}
                                    </p>
                                </div>
                            </div>

                            {/* Value Highlight Badge */}
                            {customerType === 'new' && vpsOption === 'managed' && (
                                <Badge variant="outline" className="hidden sm:inline-flex bg-cyan-500/10 text-cyan-300 border-cyan-500/30 text-xs px-2.5 py-1">
                                    💡 เพิ่มเพียง 3,000 บ./ปี อัปเกรดเป็น PRIME Managed ทันที
                                </Badge>
                            )}
                        </div>

                        {/* Package Cards Grid */}
                        <div className={`grid grid-cols-1 gap-4 ${availablePlans.length === 2 ? 'sm:grid-cols-2 max-w-4xl mx-auto' : availablePlans.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                            {availablePlans.map((plan) => {
                                const isSelected = selectedPlanId === plan.id;
                                const isFree = plan.priceAnnual === 0;

                                return (
                                    <Card 
                                        key={plan.id}
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        className={`relative cursor-pointer transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                                            isSelected 
                                                ? plan.tier === 'prime'
                                                    ? 'border-2 border-cyan-400 bg-gradient-to-b from-cyan-950/30 via-card to-card shadow-xl shadow-cyan-500/10 ring-2 ring-cyan-400/40 scale-[1.01]'
                                                    : 'border-2 border-primary bg-gradient-to-b from-primary/10 via-card to-card shadow-lg ring-1 ring-primary'
                                                : 'border-border/80 bg-card/80 hover:border-border hover:bg-card hover:shadow-md'
                                        }`}
                                    >
                                        {/* Top Badge */}
                                        {plan.badge && (
                                            <div className="absolute top-0 right-0">
                                                <div className={`text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm ${
                                                    plan.tier === 'prime' 
                                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-extrabold' 
                                                        : 'bg-primary text-primary-foreground'
                                                }`}>
                                                    {plan.badge}
                                                </div>
                                            </div>
                                        )}

                                        <CardHeader className="p-4 pb-2 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 ${
                                                    plan.tier === 'prime' 
                                                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' 
                                                        : plan.tier === 'max'
                                                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                                            : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30'
                                                }`}>
                                                    {plan.tier === 'prime' ? '⚡ PRIME' : plan.tier === 'max' ? '📡 MAX' : '🔑 MINI'}
                                                </Badge>

                                                {plan.hasTrial2Month && (
                                                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" /> ฟรี 2 เดือน
                                                    </span>
                                                )}
                                            </div>

                                            <div>
                                                <CardTitle className="text-base font-bold text-foreground">
                                                    {plan.name}
                                                </CardTitle>
                                                <CardDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                                                    {plan.tagline}
                                                </CardDescription>
                                            </div>

                                            {/* Price Display */}
                                            <div className="pt-2 border-t border-border/40">
                                                {isFree ? (
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-2xl font-black text-emerald-400">ฟรี</span>
                                                        <span className="text-xs text-muted-foreground">ไม่มีค่าใช้จ่ายรายปี</span>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        {plan.originalPriceAnnual && (
                                                            <div className="text-xs text-muted-foreground line-through">
                                                                ปกติ {plan.originalPriceAnnual.toLocaleString()} บ./ปี
                                                            </div>
                                                        )}
                                                        <div className="flex items-baseline gap-1.5">
                                                            <span className={`text-2xl font-black ${plan.tier === 'prime' ? 'text-cyan-300' : 'text-foreground'}`}>
                                                                {plan.priceAnnual.toLocaleString()}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">บาท/ปี</span>
                                                            <span className="text-[11px] text-muted-foreground/80 font-mono">
                                                                (~{Math.round(plan.priceAnnual / 12).toLocaleString()} บ./ด.)
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </CardHeader>

                                        <CardContent className="p-4 pt-1 space-y-3 text-xs flex-1">
                                            <p className="text-muted-foreground text-[11px] leading-relaxed">
                                                {plan.description}
                                            </p>

                                            {/* Farm UI Level Badge */}
                                            <div className="p-2 rounded-lg bg-background/60 border border-border/50 space-y-1">
                                                <span className="text-[10px] text-muted-foreground block font-medium">ระดับ Farm UI ที่ได้รับ:</span>
                                                <div className="font-bold flex items-center gap-1.5">
                                                    {plan.farmUi === 'advanced' ? (
                                                        <span className="text-cyan-400 flex items-center gap-1">
                                                            <Sparkles className="w-3.5 h-3.5" /> Advanced Farm UI (สั่งการผ่านเว็บได้)
                                                        </span>
                                                    ) : plan.farmUi === 'standard' ? (
                                                        <span className="text-sky-400 flex items-center gap-1">
                                                            <MonitorPlay className="w-3.5 h-3.5" /> Standard Farm UI (ติดตามพอร์ตผ่านเว็บ)
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-400 flex items-center gap-1">
                                                            ⚪ ไม่มี Farm UI (มอนิเตอร์บน MT5)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Key Highlights Checklist */}
                                            <ul className="space-y-1.5 pt-1">
                                                {plan.highlights.map((h, i) => (
                                                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-foreground/90">
                                                        <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${plan.tier === 'prime' ? 'text-cyan-400' : 'text-emerald-400'}`} />
                                                        <span>{h}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </CardContent>

                                        <CardFooter className="p-4 pt-0">
                                            <Button 
                                                variant={isSelected ? (plan.tier === 'prime' ? 'default' : 'default') : 'outline'}
                                                className={`w-full text-xs font-bold h-9 rounded-lg transition-all ${
                                                    isSelected 
                                                        ? plan.tier === 'prime'
                                                            ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-md shadow-cyan-500/20'
                                                            : 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-muted'
                                                }`}
                                            >
                                                {isSelected ? (
                                                    <span className="flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-4 h-4" /> แพ็กเกจที่เลือก
                                                    </span>
                                                ) : (
                                                    'เลือกแพ็กเกจนี้'
                                                )}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* BROKER UNLOCK ADD-ON & LIVE SUMMARY SECTION */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                        {/* Left 2 Cols: Broker Selection & Product Details */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Broker Unlock Card */}
                            <Card className="border-border bg-card shadow-sm">
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="w-4 h-4 text-primary" />
                                        <CardTitle className="text-sm font-bold text-foreground">
                                            ตัวเลือกโบรกเกอร์ (Broker Connection Option)
                                        </CardTitle>
                                    </div>
                                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                        บัญชีเทรดของคุณสมัครผ่านพันธมิตร IB ของ EasyM หรือต้องการใช้โบรกเกอร์เดิมของตนเอง?
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 pt-2 space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* IB Broker (Free) */}
                                        <div 
                                            onClick={() => setBrokerOption('ib')}
                                            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                                brokerOption === 'ib' 
                                                    ? 'bg-primary/5 border-primary shadow-sm' 
                                                    : 'bg-background/50 border-border/70 hover:bg-muted/30'
                                            }`}
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <strong className="text-xs text-foreground">สมัครผ่าน IB ของ EasyM</strong>
                                                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] px-1.5 py-0">
                                                        ฟรีค่าปลดล็อก
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
                                                    เปิดบัญชีเทรดกับโบรกเกอร์พาร์ทเนอร์ที่รองรับผ่านลิงก์ IB ของ EasyM
                                                </p>
                                            </div>
                                            <div className="mt-3 pt-2 border-t border-border/40 text-xs font-mono font-bold text-emerald-400">
                                                +0 บาท / ปี
                                            </div>
                                        </div>

                                        {/* Own Broker Unlock (+4,000 THB) */}
                                        <div 
                                            onClick={() => setBrokerOption('own')}
                                            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                                brokerOption === 'own' 
                                                    ? 'bg-amber-500/10 border-amber-500 shadow-sm' 
                                                    : 'bg-background/50 border-border/70 hover:bg-muted/30'
                                            }`}
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                    <strong className="text-xs text-foreground">ใช้โบรกเกอร์ของตัวเอง</strong>
                                                    <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] px-1.5 py-0">
                                                        Own Broker Unlock
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground">
                                                    ใช้บัญชีเดิมหรือโบรกเกอร์ใดก็ได้ที่รองรับ MT5 โดยไม่ต้องย้ายสังกัด IB
                                                </p>
                                            </div>
                                            <div className="mt-3 pt-2 border-t border-border/40 text-xs font-mono font-bold text-amber-300">
                                                +4,000 บาท / ปี
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        💡 <strong>กติกากลาง:</strong> ราคาแต่ละรายการใช้กับ 1 พอร์ต / 1 บัญชีเทรด หากต้องการเพิ่มพอร์ตสามารถติดต่อฝ่ายสนับสนุนเพื่อรับข้อเสนอแบบ Multi-Port ได้
                                    </p>
                                </CardContent>
                            </Card>

                            {/* Value Comparison Banner for Marketing */}
                            <div className="p-4 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-card rounded-2xl border border-blue-500/30 space-y-2 text-xs">
                                <div className="flex items-center gap-2 text-blue-300 font-bold">
                                    <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                                    <span>สรุปความคุ้มค่าของ EasyM PRIME:</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-muted-foreground text-[11px] leading-relaxed">
                                    <div className="p-2.5 rounded-lg bg-black/30 border border-border/40">
                                        <strong className="text-foreground block mb-0.5">🌟 สำหรับลูกค้าใหม่:</strong>
                                        เพิ่มจาก MAX Managed (12,000 บ.) เป็น PRIME Managed (15,000 บ.) เพียง <strong>3,000 บาท/ปี</strong> (ตกเพียง ~250 บ./เดือน) แต่ได้รับสิทธิ์สั่งเปิด–ปิดคู่เงินผ่านเว็บและระบบป้องกันความเสี่ยงขั้นสูง
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-black/30 border border-border/40">
                                        <strong className="text-foreground block mb-0.5">💎 สำหรับลูกค้าเดิม:</strong>
                                        รับสิทธิ์อัปเกรด PRIME Managed ในราคาเพียง <strong>12,000 บาท/ปี</strong> ซึ่งเท่ากับราคา MAX ของลูกค้าใหม่ ประหยัดทันที 3,000 บาทตลอดอายุการใช้งาน
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Col: Live Order Summary Card */}
                        <div>
                            <Card className="border-2 border-cyan-500/40 bg-gradient-to-b from-card via-card to-cyan-950/20 shadow-xl rounded-2xl sticky top-20 overflow-hidden">
                                <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500" />
                                <CardHeader className="p-4 pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                            <Coins className="w-4 h-4 text-cyan-400" />
                                            สรุปรายการสั่งซื้อ (Live Summary)
                                        </CardTitle>
                                        <Badge variant="outline" className="text-[10px] font-mono text-cyan-300 border-cyan-500/30">
                                            1 พอร์ตเทรด
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-4 pt-2 space-y-3 text-xs">
                                    {/* Breakdown items */}
                                    <div className="space-y-2 py-2 border-y border-border/50 text-[11px]">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">ประเภทลูกค้า:</span>
                                            <span className="font-semibold text-foreground">
                                                {customerType === 'existing' ? '💎 สมาชิกเดิม (Existing)' : '🚀 ลูกค้าใหม่ (New)'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">การดูแลระบบ:</span>
                                            <span className="font-semibold text-foreground">
                                                {vpsOption === 'self' ? '🖥️ รัน VPS เอง' : '⚡ EasyM ดูแลให้ (รวม VPS)'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">แพ็กเกจที่เลือก:</span>
                                            <strong className="text-cyan-300 font-bold">
                                                {selectedPlan?.name}
                                            </strong>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">ระดับ Farm UI:</span>
                                            <span className="text-foreground">
                                                {selectedPlan?.farmUi === 'advanced' 
                                                    ? '✨ Advanced Farm UI (สั่งงานเว็บ)' 
                                                    : selectedPlan?.farmUi === 'standard' 
                                                        ? '📡 Standard Farm UI' 
                                                        : '⚪ ไม่มี Farm UI'}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">ค่าแพ็กเกจพื้นฐาน:</span>
                                            <span className="font-mono font-bold text-foreground">
                                                {basePrice === 0 ? 'ฟรี' : `${basePrice.toLocaleString()} บาท/ปี`}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">ค่าปลดล็อกโบรกเกอร์:</span>
                                            <span className="font-mono text-foreground">
                                                {brokerOption === 'own' ? '+4,000 บาท/ปี' : 'ฟรี (ผ่าน IB)'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Total Investment */}
                                    <div className="p-3 rounded-xl bg-black/40 border border-border/60 space-y-1">
                                        <span className="text-[10px] text-muted-foreground block font-medium">
                                            ยอดชำระสุทธิ (เรียกเก็บเป็นรายปี):
                                        </span>
                                        <div className="flex items-baseline justify-between">
                                            <div className="text-2xl font-black text-cyan-300 font-mono">
                                                {totalAnnualPrice === 0 ? '0' : totalAnnualPrice.toLocaleString()}
                                                <span className="text-xs font-normal text-muted-foreground ml-1">บาท/ปี</span>
                                            </div>
                                            {totalAnnualPrice > 0 && (
                                                <span className="text-xs text-muted-foreground font-mono">
                                                    เฉลี่ย ~{averageMonthlyPrice.toLocaleString()} บ./ด.
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Trial Announcement */}
                                    {selectedPlan?.hasTrial2Month && (
                                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-start gap-2">
                                            <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                                            <span>
                                                <strong>ทดลองใช้ฟรี 2 เดือน:</strong> แพ็กเกจนี้มาพร้อมสิทธิ์ทดลองใช้ Farm UI เต็มระบบ 2 เดือนก่อนเริ่มคิดค่าบริการรายปี
                                            </span>
                                        </div>
                                    )}

                                    {/* CTA Button */}
                                    <Button 
                                        className="w-full h-11 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-lg shadow-cyan-500/25"
                                        onClick={() => {
                                            alert(`[โหมดตัวอย่างสำหรับ Super Admin]\n\nคุณได้เลือก:\n• แพ็กเกจ: ${selectedPlan?.name}\n• ยอดรวม: ${totalAnnualPrice.toLocaleString()} บาท/ปี\n• บัญชี: ${brokerOption === 'own' ? 'โบรกเกอร์ตัวเอง (+4,000)' : 'ผ่าน IB EasyM'}\n\nเมื่อเปิดใช้งานจริง ระบบจะส่งต่อไปยังหน้าลงทะเบียน / ชำระเงิน`);
                                        }}
                                    >
                                        {selectedPlan?.hasTrial2Month ? (
                                            <span className="flex items-center gap-1.5">
                                                <Sparkles className="w-4 h-4" /> เริ่มทดลองใช้ Farm UI ฟรี 2 เดือน
                                            </span>
                                        ) : totalAnnualPrice === 0 ? (
                                            <span className="flex items-center gap-1.5">
                                                <Zap className="w-4 h-4" /> เริ่มต้นใช้งานฟรีทันที (Start Free)
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5">
                                                <ArrowRight className="w-4 h-4" /> สมัครใช้งานแพ็กเกจนี้
                                            </span>
                                        )}
                                    </Button>

                                    <p className="text-[10px] text-center text-muted-foreground/70">
                                        🔒 ชำระปลอดภัยผ่าน QR PromptPay หรือ บัตรเครดิต
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: COMPLETE PRICING MATRIX TABLE */}
            {activeTab === 'matrix' && (
                <Card className="border-border bg-card shadow-sm animate-in fade-in duration-300">
                    <CardHeader className="p-4 sm:p-6 pb-2">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-sky-400" />
                            <CardTitle className="text-base sm:text-lg font-bold">
                                ตารางราคารวมทุกรูปแบบ (Pricing Matrix Specification)
                            </CardTitle>
                        </div>
                        <CardDescription className="text-xs text-muted-foreground mt-0.5">
                            ใช้สำหรับตรวจสอบ Logic และข้อกำหนดของระบบราคาตามเอกสาร <code className="text-sky-300">EasyM_Web_Pricing_Structure_TH.md</code>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-2">
                        <div className="overflow-x-auto rounded-xl border border-border/60">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] font-mono border-b border-border/60">
                                    <tr>
                                        <th className="p-3">กลุ่มลูกค้า</th>
                                        <th className="p-3">วิธีรันระบบ</th>
                                        <th className="p-3">EA / แพ็กเกจ</th>
                                        <th className="p-3 text-center">ระดับ Farm UI</th>
                                        <th className="p-3 text-center">ช่วงทดลอง</th>
                                        <th className="p-3 text-right">ราคาต่อปี (ผ่าน IB)</th>
                                        <th className="p-3 text-right">ราคาต่อปี (โบรกตัวเอง)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 font-sans">
                                    {ALL_PLANS.map((p) => {
                                        const isPrime = p.tier === 'prime';
                                        return (
                                            <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${isPrime ? 'bg-cyan-500/5' : ''}`}>
                                                <td className="p-3 font-semibold">
                                                    {p.customerType === 'existing' ? (
                                                        <span className="text-blue-400">ลูกค้าเดิม</span>
                                                    ) : (
                                                        <span className="text-emerald-400">ลูกค้าใหม่</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-muted-foreground">
                                                    {p.vpsOption === 'self' ? '🖥️ VPS ตัวเอง' : '⚡ EasyM ดูแล (รวม VPS)'}
                                                </td>
                                                <td className="p-3 font-bold text-foreground flex items-center gap-1.5">
                                                    {p.name}
                                                    {p.badge && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-normal border-cyan-500/40 text-cyan-300">
                                                            {p.badge}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {p.farmUi === 'advanced' ? (
                                                        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[9px]">
                                                            Advanced
                                                        </Badge>
                                                    ) : p.farmUi === 'standard' ? (
                                                        <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[9px]">
                                                            Standard
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-[10px]">ไม่มี</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center text-muted-foreground">
                                                    {p.hasTrial2Month ? (
                                                        <span className="text-emerald-400 font-semibold">2 เดือน</span>
                                                    ) : (
                                                        <span>-</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold">
                                                    {p.priceAnnual === 0 ? (
                                                        <span className="text-emerald-400">ฟรี</span>
                                                    ) : (
                                                        <span className={isPrime ? 'text-cyan-300' : 'text-foreground'}>
                                                            {p.priceAnnual.toLocaleString()} บ.
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-mono text-amber-300">
                                                    {(p.priceAnnual + 4000).toLocaleString()} บ.
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* TAB 3: SPEC & FARM UI COMPARISON */}
            {activeTab === 'spec' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <Card className="border-border bg-card shadow-sm">
                        <CardHeader className="p-4 sm:p-6 pb-2">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-amber-400" />
                                <CardTitle className="text-base sm:text-lg font-bold">
                                    เปรียบเทียบความสามารถระหว่าง Standard vs Advanced Farm UI
                                </CardTitle>
                            </div>
                            <CardDescription className="text-xs text-muted-foreground mt-0.5">
                                รายละเอียดข้อแตกต่างของหน้า Farm UI สำหรับรุ่น MAX และรุ่น PRIME
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Standard Farm UI */}
                                <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-950/10 space-y-3">
                                    <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                                        <MonitorPlay className="w-4 h-4" />
                                        <span>Standard Farm UI (สำหรับ EasyM MAX)</span>
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-2">
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                                            <span><strong>Real-time Portfolio Monitoring:</strong> ติดตามยอด Balance, Equity, Drawdown และ Floating PnL สด</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                                            <span><strong>Daily Profit Tracking:</strong> บันทึกประวัติและสรุปกำไรสะสมรายวันย้อนหลัง</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                                            <span><strong>Multi-Port Support:</strong> สลับดูพอร์ตการลงทุนได้หลายพอร์ตในหน้าเดียว</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                                            <span><strong>Smart Sleep Protocol:</strong> รองรับโหมดประหยัดแบนด์วิดท์</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Advanced Farm UI */}
                                <div className="p-4 rounded-xl border-2 border-cyan-500/40 bg-cyan-950/15 space-y-3">
                                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                                        <Sparkles className="w-4 h-4 text-cyan-400" />
                                        <span>Advanced Farm UI (สำหรับ EasyM PRIME เท่านั้น)</span>
                                    </div>
                                    <ul className="text-xs text-muted-foreground space-y-2">
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                            <span><strong>ทุกความสามารถของ Standard Farm UI:</strong> มอนิเตอร์ครบทุกมิติ</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                            <span><strong>Web Control (สั่งเปิด–ปิดคู่เงินผ่านเว็บ):</strong> ควบคุมการทำงานของแต่ละคู่เงินจากหน้าเว็บได้โดยไม่ต้องเข้า VPS</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                            <span><strong>Adaptive Volatility Filter:</strong> ระบบวิเคราะห์ความผันผวนและกรองคู่เงินที่มีความเสี่ยงสูง</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                            <span><strong>Future Web Updates:</strong> สิทธิ์รับฟีเจอร์การตั้งค่าผ่านเว็บและการแจ้งเตือนขั้นสูงในอนาคต</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
