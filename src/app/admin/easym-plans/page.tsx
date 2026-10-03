'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { 
    Check, 
    X,
    Sparkles, 
    ShieldCheck, 
    Server, 
    Zap, 
    Lock, 
    Crown, 
    ArrowRight, 
    ChevronRight, 
    CheckCircle2, 
    XCircle,
    Building2, 
    AlertCircle, 
    RefreshCcw,
    Users,
    UserPlus,
    Cloud,
    SlidersHorizontal,
    ExternalLink,
    HelpCircle,
    Copy,
    CheckCheck,
    Cpu,
    Activity,
    Layers,
    Table,
    LayoutGrid
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Allowed Super Admin Email
const SUPER_ADMIN_EMAIL = 'juntarasate@gmail.com';

export type CustomerType = 'existing' | 'new';
export type VpsOption = 'self' | 'managed';
export type BrokerOption = 'ib' | 'own';

interface ComparisonFeatureRow {
    icon: React.ReactNode;
    title: string;
    description: string;
    isSupported: boolean;
    highlight?: boolean;
}

interface ProductCardData {
    id: string;
    tier: 'mini' | 'max' | 'prime';
    name: string;
    tagline: string;
    badge?: string;
    isRecommended?: boolean;
    imageBox: string;
    priceAnnual: number;
    originalPriceAnnual?: number;
    priceSubtitle: string;
    monthlyAvgText: string;
    trialBadge?: string;
    rows: {
        engine: ComparisonFeatureRow;
        infrastructure: ComparisonFeatureRow;
        dashboard: ComparisonFeatureRow;
        control: ComparisonFeatureRow;
        broker: ComparisonFeatureRow;
        support: ComparisonFeatureRow;
    };
    ctaText: string;
    ctaVariant: 'emerald' | 'amber' | 'purple';
}

export default function EasyMPlansPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Primary State Controls
    const [customerType, setCustomerType] = useState<CustomerType>('existing');
    const [vpsOption, setVpsOption] = useState<VpsOption>('self');
    const [brokerOption, setBrokerOption] = useState<BrokerOption>('ib');
    const [selectedCardId, setSelectedCardId] = useState<string>('prime-card');
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [activeTab, setActiveTab] = useState<'cards' | 'matrix' | 'farmUi'>('cards');

    // Super Admin Verification Gate
    useEffect(() => {
        const verifySuperAdmin = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }
                setUserEmail(user.email || null);
                if (user.email === SUPER_ADMIN_EMAIL) {
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                }
            } catch (err) {
                console.error('Super Admin check failed:', err);
                setIsAuthorized(false);
            } finally {
                setLoading(false);
            }
        };
        verifySuperAdmin();
    }, [router]);

    // Construct Product Comparison Cards based on Selected Mode
    const comparisonCards = useMemo<ProductCardData[]>(() => {
        const isExisting = customerType === 'existing';
        const isSelf = vpsOption === 'self';

        if (isSelf) {
            // Self-Hosted Mode: mini, MAX, PRIME
            const miniCard: ProductCardData = {
                id: 'mini-self',
                tier: 'mini',
                name: 'EasyM mini',
                tagline: 'Simple Start • พอร์ตเริ่มต้น',
                badge: 'ฟรีตลอดชีพ',
                imageBox: '/assets/easym_mini_box.png',
                priceAnnual: 0,
                priceSubtitle: 'ไม่มีค่าบริการรายปี',
                monthlyAvgText: 'ฟรีตลอดอายุการใช้งาน',
                rows: {
                    engine: {
                        icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
                        title: '5 คู่เงินหลักความเสี่ยงต่ำ',
                        description: 'อัลกอริทึม Martingale แบบ Conservative',
                        isSupported: true
                    },
                    infrastructure: {
                        icon: <Server className="w-3.5 h-3.5 text-slate-400" />,
                        title: 'รันบน VPS ของลูกค้าเอง',
                        description: 'ลูกค้าจัดเตรียมและดูแล VPS เอง 100%',
                        isSupported: true
                    },
                    dashboard: {
                        icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
                        title: 'Farm UI 1U (ฟรีตลอดชีพ)',
                        description: 'ส่งสถิติพื้นฐานเข้าแดชบอร์ด Farm',
                        isSupported: true
                    },
                    control: {
                        icon: <Lock className="w-3.5 h-3.5 text-slate-500" />,
                        title: 'สั่งเปิด-ปิดผ่านเว็บ: ไม่รองรับ',
                        description: 'ควบคุมผ่านตัวโปรแกรม MT5 เท่านั้น',
                        isSupported: false
                    },
                    broker: {
                        icon: <Building2 className="w-3.5 h-3.5 text-emerald-400" />,
                        title: 'พาร์ตเนอร์ IB เท่านั้น',
                        description: 'ต้องเปิดบัญชีผ่าน IB EasyM',
                        isSupported: true
                    },
                    support: {
                        icon: <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />,
                        title: 'Community Support',
                        description: 'ซัพพอร์ตช่วยเหลือตามรอบเวลาทำการ',
                        isSupported: true
                    }
                },
                ctaText: 'เลือก EasyM mini',
                ctaVariant: 'emerald'
            };

            const maxCard: ProductCardData = {
                id: 'max-self',
                tier: 'max',
                name: 'EasyM MAX',
                tagline: 'Multi-Pair Recovery • ระบบ 10 คู่เงิน',
                badge: isExisting ? 'สิทธิ์ลูกค้าเดิม' : 'ระบบยอดนิยม',
                imageBox: '/assets/easym_max_box.png',
                priceAnnual: isExisting ? 4000 : 8000,
                originalPriceAnnual: isExisting ? 8000 : undefined,
                priceSubtitle: isExisting ? 'ลด 50% สำหรับลูกค้าเดิม' : 'ค่าลิขสิทธิ์ระบบรายปี',
                monthlyAvgText: isExisting ? 'เฉลี่ยเพียง ฿333 / เดือน' : 'เฉลี่ย ฿667 / เดือน',
                trialBadge: isExisting ? undefined : 'ทดลอง Farm UI 2U ฟรี 2 เดือน',
                rows: {
                    engine: {
                        icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
                        title: '10 คู่เงิน Multi-Timeframe',
                        description: 'ระบบ Recovery กระจายพอร์ตข้ามคู่เงิน',
                        isSupported: true,
                        highlight: true
                    },
                    infrastructure: {
                        icon: <Server className="w-3.5 h-3.5 text-slate-400" />,
                        title: 'รันบน VPS ของลูกค้าเอง',
                        description: 'ติดตั้งลงบน VPS ส่วนตัวของคุณ',
                        isSupported: true
                    },
                    dashboard: {
                        icon: <Activity className="w-3.5 h-3.5 text-amber-400" />,
                        title: 'Standard Farm UI',
                        description: 'เช็ค Equity, PnL, Drawdown สดผ่านเว็บ',
                        isSupported: true
                    },
                    control: {
                        icon: <Lock className="w-3.5 h-3.5 text-slate-500" />,
                        title: 'สั่งเปิด-ปิดผ่านเว็บ: ไม่รองรับ',
                        description: 'มอนิเตอร์สถานะสด ไม่รองรับรีโมตคอนโทรล',
                        isSupported: false
                    },
                    broker: {
                        icon: <Building2 className="w-3.5 h-3.5 text-amber-400" />,
                        title: 'IB Partner หรือ ปลดล็อกโบรก',
                        description: 'ฟรีค่าธรรมเนียมเมื่อเปิดบัญชี IB พาร์ตเนอร์',
                        isSupported: true
                    },
                    support: {
                        icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />,
                        title: 'Priority Line Support',
                        description: 'บริการช่วยเหลือและตรวจสุขภาพพอร์ต',
                        isSupported: true
                    }
                },
                ctaText: 'เลือก EasyM MAX',
                ctaVariant: 'amber'
            };

            const primeCard: ProductCardData = {
                id: 'prime-self',
                tier: 'prime',
                name: 'EasyM PRIME',
                tagline: 'Flagship Control • ควบคุมสั่งการเต็มรูปแบบ',
                badge: isExisting ? 'อัปเกรดลูกค้าเดิม (ประหยัด 2,000)' : 'แนะนำสำหรับมืออาชีพ',
                isRecommended: true,
                imageBox: '/assets/easym_farm_box.png',
                priceAnnual: isExisting ? 8000 : 10000,
                originalPriceAnnual: isExisting ? 10000 : undefined,
                priceSubtitle: isExisting ? 'สิทธิ์อัปเกรดพิเศษ (ปกติ 10,000)' : 'ระบบเรือธงครบทุกฟังก์ชัน',
                monthlyAvgText: isExisting ? 'เฉลี่ย ฿667 / เดือน' : 'เฉลี่ย ฿833 / เดือน',
                trialBadge: 'ทดลอง Farm UI 2U ฟรี 2 เดือน',
                rows: {
                    engine: {
                        icon: <Crown className="w-3.5 h-3.5 text-purple-400" />,
                        title: '10 คู่เงิน + Adaptive Filter',
                        description: 'กรองข่าวและตัดความผันผวนอัจฉริยะ',
                        isSupported: true,
                        highlight: true
                    },
                    infrastructure: {
                        icon: <Server className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'รันบน VPS ของลูกค้าเอง',
                        description: 'ประหยัดแบนด์วิดท์ด้วย Single Domain V2',
                        isSupported: true
                    },
                    dashboard: {
                        icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'Advanced Farm UI',
                        description: 'ข้อมูลเรียลไทม์ 2U พร้อมกราฟเชิงลึก',
                        isSupported: true,
                        highlight: true
                    },
                    control: {
                        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
                        title: 'สั่งเปิด-ปิดคู่เงินผ่านเว็บได้ 100%',
                        description: 'ไม่ต้องล็อกอินเข้า VPS ควบคุมได้ทุกที่',
                        isSupported: true,
                        highlight: true
                    },
                    broker: {
                        icon: <Building2 className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'IB Partner หรือ ปลดล็อกโบรก',
                        description: 'รองรับการปลดล็อกโบรกเกอร์ส่วนตัวได้',
                        isSupported: true
                    },
                    support: {
                        icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'VIP Fast-track Support',
                        description: 'ดูแลความต่อเนื่องและคำแนะนำส่วนตัว',
                        isSupported: true
                    }
                },
                ctaText: 'เลือก EasyM PRIME',
                ctaVariant: 'purple'
            };

            return [miniCard, maxCard, primeCard];
        } else {
            // Managed Mode: MAX Managed & PRIME Managed
            const maxManaged: ProductCardData = {
                id: 'max-managed',
                tier: 'max',
                name: 'EasyM MAX Managed',
                tagline: 'Hands-Free • ทีมงานดูแลเซิร์ฟเวอร์ให้เบ็ดเสร็จ',
                badge: isExisting ? 'ลด 50% สำหรับลูกค้าเดิม' : 'ยอดนิยม ไร้กังวลเรื่อง VPS',
                imageBox: '/assets/easym_max_box.png',
                priceAnnual: isExisting ? 6000 : 12000,
                originalPriceAnnual: isExisting ? 12000 : undefined,
                priceSubtitle: isExisting ? 'พิเศษ ฿6,000 (ปกติ 12,000)' : 'รวมค่า Cloud VPS และทีมดูแลทั้งปี',
                monthlyAvgText: isExisting ? 'เฉลี่ยเพียง ฿500 / เดือน' : 'เฉลี่ย ฿1,000 / เดือน',
                trialBadge: isExisting ? undefined : 'ทดลอง Farm UI 2U ฟรี 2 เดือน',
                rows: {
                    engine: {
                        icon: <Zap className="w-3.5 h-3.5 text-amber-400" />,
                        title: '10 คู่เงิน Multi-Timeframe',
                        description: 'ระบบ Recovery กระจายพอร์ตข้ามคู่เงิน',
                        isSupported: true
                    },
                    infrastructure: {
                        icon: <Cloud className="w-3.5 h-3.5 text-amber-400" />,
                        title: 'รวม Cloud VPS ประสิทธิภาพสูง',
                        description: 'ทีมงานติดตั้ง ดูแลเซิร์ฟเวอร์ และอัปเดต 24/5',
                        isSupported: true,
                        highlight: true
                    },
                    dashboard: {
                        icon: <Activity className="w-3.5 h-3.5 text-amber-400" />,
                        title: 'Standard Farm UI',
                        description: 'ดูผลการเทรดผ่านมือถือและเว็บได้ 24 ชม.',
                        isSupported: true
                    },
                    control: {
                        icon: <Lock className="w-3.5 h-3.5 text-slate-500" />,
                        title: 'สั่งเปิด-ปิดผ่านเว็บ: ไม่รองรับ',
                        description: 'ทีมงานดูแลการรันตามระบบมาตรฐาน',
                        isSupported: false
                    },
                    broker: {
                        icon: <Building2 className="w-3.5 h-3.5 text-amber-400" />,
                        title: 'IB Partner หรือ ปลดล็อกโบรก',
                        description: 'ฟรีค่าบริการเมื่อใช้โบรกเกอร์พาร์ตเนอร์',
                        isSupported: true
                    },
                    support: {
                        icon: <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />,
                        title: 'Full Dedicated Monitoring',
                        description: 'เฝ้าระวังความต่อเนื่องของระบบให้ตลอดเวลา',
                        isSupported: true,
                        highlight: true
                    }
                },
                ctaText: 'เลือก MAX Managed',
                ctaVariant: 'amber'
            };

            const primeManaged: ProductCardData = {
                id: 'prime-managed',
                tier: 'prime',
                name: 'EasyM PRIME Managed',
                tagline: 'Ultimate Experience • ที่สุดแห่งความสมบูรณ์แบบ',
                badge: isExisting ? 'Best Value (จ่ายเท่า MAX แต่ได้ PRIME)' : '★ แนะนำสูงสุด (Best Value)',
                isRecommended: true,
                imageBox: '/assets/easym_farm_box.png',
                priceAnnual: isExisting ? 12000 : 15000,
                originalPriceAnnual: isExisting ? 15000 : undefined,
                priceSubtitle: isExisting ? 'ลูกค้าเก่าได้สิทธิ์ราคา MAX แต่ได้รุ่น PRIME' : 'เพิ่ม ฿3,000 ได้รุ่นท็อปคุ้มค่าที่สุด',
                monthlyAvgText: isExisting ? 'เฉลี่ย ฿1,000 / เดือน' : 'เฉลี่ย ฿1,250 / เดือน',
                trialBadge: 'ทดลอง Farm UI 2U ฟรี 2 เดือน',
                rows: {
                    engine: {
                        icon: <Crown className="w-3.5 h-3.5 text-purple-400" />,
                        title: '10 คู่เงิน + Adaptive Filter',
                        description: 'ระบบป้องกันความผันผวนและสเปรดถ่าง',
                        isSupported: true,
                        highlight: true
                    },
                    infrastructure: {
                        icon: <Cloud className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'รวม Premium Cloud VPS + SLA',
                        description: 'เซิร์ฟเวอร์เสถียรภาพสูง ทีมงานดูแลระดับพรีเมียม',
                        isSupported: true,
                        highlight: true
                    },
                    dashboard: {
                        icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'Advanced Farm UI',
                        description: 'ข้อมูล 2U สด วิเคราะห์ Drawdown ลึกระดับวิ',
                        isSupported: true,
                        highlight: true
                    },
                    control: {
                        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
                        title: 'สั่งเปิด-ปิดคู่เงินผ่านเว็บได้ 100%',
                        description: 'ไม่ต้องล็อกอิน VPS จัดการผ่านเว็บได้ทันที',
                        isSupported: true,
                        highlight: true
                    },
                    broker: {
                        icon: <Building2 className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'IB Partner หรือ ปลดล็อกโบรก',
                        description: 'เลือกเชื่อมต่อบัญชีได้ตามความต้องการ',
                        isSupported: true
                    },
                    support: {
                        icon: <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />,
                        title: 'VIP Dedicated 24/5 Service',
                        description: 'สายด่วนดูแลพิเศษและแจ้งเตือนความเสี่ยง',
                        isSupported: true,
                        highlight: true
                    }
                },
                ctaText: 'เลือก PRIME Managed',
                ctaVariant: 'purple'
            };

            return [maxManaged, primeManaged];
        }
    }, [customerType, vpsOption]);

    // Active Selected Product Details for Order Summary
    const activeSelectedCard = useMemo(() => {
        return comparisonCards.find(c => c.id === selectedCardId) || comparisonCards[comparisonCards.length - 1];
    }, [comparisonCards, selectedCardId]);

    // Calculate Final Cost including Broker Unlock
    const brokerAddonCost = brokerOption === 'own' ? 4000 : 0;
    const finalTotalAnnual = (activeSelectedCard?.priceAnnual || 0) + brokerAddonCost;
    const finalMonthlyAvg = Math.round(finalTotalAnnual / 12);

    const handleCopyProposal = () => {
        const text = `[สรุปข้อเสนอ EasyM Solution]
ประเภทลูกค้า: ${customerType === 'existing' ? 'ลูกค้าเดิม (Existing Customer)' : 'ลูกค้าใหม่ (New Customer)'}
รูปแบบการรัน: ${vpsOption === 'self' ? 'รันบน VPS ของตนเอง (Self-Hosted)' : 'ให้ทีมงานดูแลให้ (EasyM Managed)'}
แพ็กเกจที่เลือก: ${activeSelectedCard?.name}
ราคาแพ็กเกจ: ${activeSelectedCard?.priceAnnual === 0 ? 'ฟรี (0 บาท)' : `฿${activeSelectedCard?.priceAnnual.toLocaleString()} / ปี`}
โบรกเกอร์: ${brokerOption === 'ib' ? 'IB Partner (ฟรีค่าปลดล็อก)' : 'Own Broker Unlock (+฿4,000 / ปี)'}
ยอดรวมทั้งสิ้น: ฿${finalTotalAnnual.toLocaleString()} / ปี (เฉลี่ย ฿${finalMonthlyAvg.toLocaleString()} / เดือน)
สิทธิ์พิเศษ: ${activeSelectedCard?.trialBadge || 'ตามเงื่อนไขแพ็กเกจ'}`;

        navigator.clipboard.writeText(text);
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2500);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-muted-foreground font-mono">กำลังตรวจสอบสิทธิ์ Super Admin...</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 max-w-lg mx-auto text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
                    <Lock className="w-7 h-7" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-white">พื้นที่เฉพาะ Super Admin (Private Only)</h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                    หน้านี้ถูกสงวนไว้สำหรับตรวจสอบแผนการตลาดของบัญชีผู้ดูแลระบบสูงสุด (<span className="text-amber-400 font-mono">{SUPER_ADMIN_EMAIL}</span>) เท่านั้น
                </p>
                <div className="pt-2">
                    <Link href="/admin">
                        <Button variant="outline" size="sm">
                            กลับสู่หน้าแผงควบคุมหลัก
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
            
            {/* Top Minimal Admin Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <Crown className="w-3 h-3 text-amber-400" />
                            Internal Strategy Sandbox
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                            Admin: {userEmail}
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                        EasyM Solution & Pricing Configurator
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400">
                        เปรียบเทียบสเปกและโครงสร้างราคาตามประเภทลูกค้าและรูปแบบเซิร์ฟเวอร์
                    </p>
                </div>

                {/* Sub View Mode Switches */}
                <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setActiveTab('cards')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            activeTab === 'cards'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        หน้าการ์ดเปรียบเทียบ
                    </button>
                    <button
                        onClick={() => setActiveTab('matrix')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            activeTab === 'matrix'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <Table className="w-3.5 h-3.5" />
                        ตารางสรุป 10 แพ็กเกจ
                    </button>
                    <button
                        onClick={() => setActiveTab('farmUi')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            activeTab === 'farmUi'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Farm UI (1U vs 2U)
                    </button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            {activeTab === 'cards' && (
                <div className="space-y-6">

                    {/* ============================================================== */}
                    {/* 1. TOP 2 BIG TABS: ลูกค้าเดิม vs ลูกค้าใหม่ */}
                    {/* ============================================================== */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        
                        {/* Tab 1: Existing Customer */}
                        <button
                            type="button"
                            onClick={() => {
                                setCustomerType('existing');
                                setSelectedCardId(vpsOption === 'self' ? 'prime-self' : 'prime-managed');
                            }}
                            className={`relative text-left p-4 sm:p-5 rounded-xl border-2 transition-all flex items-start gap-4 ${
                                customerType === 'existing'
                                    ? 'bg-gradient-to-r from-blue-950/50 via-slate-900 to-slate-900 border-blue-500 shadow-lg shadow-blue-500/10'
                                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                            }`}
                        >
                            <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                                customerType === 'existing'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-800 text-slate-400'
                            }`}>
                                <Users className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                        ลูกค้าเดิม (Existing Customer)
                                    </h2>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        ลดสูงสุด 50%
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 leading-normal">
                                    ผู้ใช้งาน EasyM mini หรือ MAX เดิม รับสิทธิ์ส่วนลดพิเศษและสิทธิ์อัปเกรดสู่ PRIME
                                </p>
                            </div>
                            {customerType === 'existing' && (
                                <div className="absolute top-3 right-3 text-blue-400">
                                    <CheckCircle2 className="w-5 h-5 fill-blue-500/20" />
                                </div>
                            )}
                        </button>

                        {/* Tab 2: New Customer */}
                        <button
                            type="button"
                            onClick={() => {
                                setCustomerType('new');
                                setSelectedCardId(vpsOption === 'self' ? 'prime-self' : 'prime-managed');
                            }}
                            className={`relative text-left p-4 sm:p-5 rounded-xl border-2 transition-all flex items-start gap-4 ${
                                customerType === 'new'
                                    ? 'bg-gradient-to-r from-purple-950/50 via-slate-900 to-slate-900 border-purple-500 shadow-lg shadow-purple-500/10'
                                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                            }`}
                        >
                            <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                                customerType === 'new'
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-slate-800 text-slate-400'
                            }`}>
                                <UserPlus className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                                        ลูกค้าใหม่ (New Customer)
                                    </h2>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        ทดลองฟรี 2 เดือน
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 leading-normal">
                                    เริ่มต้นเปิดพอร์ตและติดตั้งระบบใหม่ พร้อมสิทธิ์ทดลอง Farm UI 2U ฟรี 2 เดือนเต็ม
                                </p>
                            </div>
                            {customerType === 'new' && (
                                <div className="absolute top-3 right-3 text-purple-400">
                                    <CheckCircle2 className="w-5 h-5 fill-purple-500/20" />
                                </div>
                            )}
                        </button>
                    </div>

                    {/* ============================================================== */}
                    {/* 2. SUB-SELECTOR: รันบน VPS เอง vs ให้เรารันระบบให้ */}
                    {/* ============================================================== */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 sm:p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                                    เลือกรูปแบบการดูแลเซิร์ฟเวอร์ (Hosting Infrastructure)
                                </span>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    กำหนดการติดตั้งระบบระหว่างดูแลเซิร์ฟเวอร์ด้วยตนเอง หรือให้ทีมงาน EasyM มอนิเตอร์แบบครบวงจร
                                </p>
                            </div>

                            <div className="inline-flex p-1 bg-slate-950 rounded-lg border border-slate-800 self-start sm:self-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVpsOption('self');
                                        setSelectedCardId('prime-self');
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                        vpsOption === 'self'
                                            ? 'bg-blue-600 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Server className="w-3.5 h-3.5" />
                                    <span>รันบน VPS ของตนเอง (Self-Hosted)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVpsOption('managed');
                                        setSelectedCardId('prime-managed');
                                    }}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                        vpsOption === 'managed'
                                            ? 'bg-purple-600 text-white shadow'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Cloud className="w-3.5 h-3.5" />
                                    <span>ให้เรารันระบบให้ (EasyM Managed)</span>
                                    <span className="hidden md:inline-block px-1.5 py-0.2 bg-purple-400/20 text-purple-200 text-[10px] rounded">
                                        ไร้กังวล 24/5
                                    </span>
                                </button>
                            </div>
                        </div>

                        {vpsOption === 'managed' && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 text-xs text-slate-400">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>
                                    * บริการ <strong className="text-white">EasyM Managed</strong> รองรับเฉพาะรุ่น <strong className="text-amber-300">MAX</strong> และ <strong className="text-purple-300">PRIME</strong> (รุ่น mini เป็นฟรีแวร์สำหรับรันบน VPS ของลูกค้าเอง)
                                </span>
                            </div>
                        )}
                    </div>

                    {/* ============================================================== */}
                    {/* 3. PRODUCT CARDS GRID (ROWS ALIGNED ACROSS CARDS) */}
                    {/* ============================================================== */}
                    <div className={`grid gap-4 items-stretch ${
                        comparisonCards.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
                    }`}>
                        {comparisonCards.map((card) => {
                            const isSelected = selectedCardId === card.id;

                            // Theme Styling
                            const themeStyles = {
                                mini: {
                                    border: isSelected 
                                        ? 'border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500' 
                                        : 'border-emerald-950/60 hover:border-emerald-500/50',
                                    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                                    accentText: 'text-emerald-400',
                                    priceBg: 'bg-emerald-950/20',
                                    btn: isSelected ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200',
                                },
                                max: {
                                    border: isSelected 
                                        ? 'border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500' 
                                        : 'border-amber-950/60 hover:border-amber-500/50',
                                    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                                    accentText: 'text-amber-400',
                                    priceBg: 'bg-amber-950/20',
                                    btn: isSelected ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200',
                                },
                                prime: {
                                    border: isSelected 
                                        ? 'border-purple-500 shadow-xl shadow-purple-500/20 ring-2 ring-purple-500/40' 
                                        : 'border-purple-900/60 hover:border-purple-500/60',
                                    badgeBg: 'bg-gradient-to-r from-purple-500/20 to-amber-500/20 text-purple-200 border-purple-400/40',
                                    accentText: 'text-purple-300',
                                    priceBg: 'bg-purple-950/30',
                                    btn: isSelected ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200',
                                }
                            }[card.tier];

                            return (
                                <div
                                    key={card.id}
                                    onClick={() => setSelectedCardId(card.id)}
                                    className={`relative flex flex-col rounded-2xl bg-card border-2 transition-all cursor-pointer ${themeStyles.border}`}
                                >
                                    {/* Top Recommended Tag */}
                                    {card.isRecommended && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-purple-600 text-white shadow-md">
                                                <Crown className="w-3 h-3" />
                                                RECOMMENDED FLAGSHIP
                                            </span>
                                        </div>
                                    )}

                                    {/* --- CARD HEADER: Thumbnail + Name + Tagline --- */}
                                    <div className="p-4 sm:p-5 border-b border-border/50">
                                        <div className="flex items-center gap-3">
                                            {/* Product Thumbnail (Sleek Proportions) */}
                                            <div className="w-14 h-14 relative shrink-0 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-1 flex items-center justify-center">
                                                <Image 
                                                    src={card.imageBox} 
                                                    alt={card.name} 
                                                    width={56} 
                                                    height={56} 
                                                    className="object-contain max-h-full drop-shadow"
                                                />
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                {card.badge && (
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border mb-1 ${themeStyles.badgeBg}`}>
                                                        {card.badge}
                                                    </span>
                                                )}
                                                <h3 className={`text-xl font-black tracking-tight ${themeStyles.accentText}`}>
                                                    {card.name}
                                                </h3>
                                                <p className="text-[11px] text-slate-400 truncate">
                                                    {card.tagline}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Price Area: Large and Clear */}
                                        <div className={`mt-3.5 p-3 rounded-xl border border-slate-800/80 ${themeStyles.priceBg}`}>
                                            <div className="flex items-baseline gap-1.5">
                                                {card.originalPriceAnnual && (
                                                    <span className="text-xs text-slate-500 line-through font-mono">
                                                        ฿{card.originalPriceAnnual.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono">
                                                    {card.priceAnnual === 0 ? '฿0' : `฿${card.priceAnnual.toLocaleString()}`}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {card.priceAnnual === 0 ? 'ตลอดชีพ' : '/ ปี'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                                <span>{card.priceSubtitle}</span>
                                                <span className="font-semibold text-slate-300 font-mono">{card.monthlyAvgText}</span>
                                            </div>
                                            {card.trialBadge && (
                                                <div className="mt-1.5 pt-1.5 border-t border-slate-800/50 flex items-center gap-1 text-[10px] text-amber-300">
                                                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                                                    <span>{card.trialBadge}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* --- ALIGNED FEATURE ROWS (Rows match horizontally across all cards) --- */}
                                    <div className="p-4 sm:p-5 flex-1 flex flex-col divide-y divide-border/30 text-xs">
                                        
                                        {/* Row 1: Engine & Strategy */}
                                        <div className="py-2.5 flex items-start gap-2.5 min-h-[58px]">
                                            <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                                                {card.rows.engine.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white leading-tight">
                                                    {card.rows.engine.title}
                                                </p>
                                                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                                    {card.rows.engine.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Row 2: Infrastructure / VPS */}
                                        <div className="py-2.5 flex items-start gap-2.5 min-h-[58px]">
                                            <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                                                {card.rows.infrastructure.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold leading-tight ${card.rows.infrastructure.highlight ? 'text-amber-300' : 'text-white'}`}>
                                                    {card.rows.infrastructure.title}
                                                </p>
                                                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                                    {card.rows.infrastructure.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Row 3: Farm Dashboard */}
                                        <div className="py-2.5 flex items-start gap-2.5 min-h-[58px]">
                                            <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                                                {card.rows.dashboard.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold leading-tight ${card.rows.dashboard.highlight ? 'text-purple-300' : 'text-white'}`}>
                                                    {card.rows.dashboard.title}
                                                </p>
                                                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                                    {card.rows.dashboard.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Row 4: Web Control Ability */}
                                        <div className="py-2.5 flex items-start gap-2.5 min-h-[58px]">
                                            <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                                                {card.rows.control.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold leading-tight ${
                                                    card.rows.control.isSupported ? 'text-emerald-400' : 'text-slate-400'
                                                }`}>
                                                    {card.rows.control.title}
                                                </p>
                                                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                                    {card.rows.control.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Row 5: Broker Freedom */}
                                        <div className="py-2.5 flex items-start gap-2.5 min-h-[58px]">
                                            <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                                                {card.rows.broker.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white leading-tight">
                                                    {card.rows.broker.title}
                                                </p>
                                                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                                    {card.rows.broker.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Row 6: Support Level */}
                                        <div className="py-2.5 flex items-start gap-2.5 min-h-[58px]">
                                            <div className="p-1 rounded bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                                                {card.rows.support.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white leading-tight">
                                                    {card.rows.support.title}
                                                </p>
                                                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                                                    {card.rows.support.description}
                                                </p>
                                            </div>
                                        </div>

                                    </div>

                                    {/* --- CARD FOOTER: CTA Button --- */}
                                    <div className="p-4 border-t border-border/50 bg-slate-950/40 rounded-b-2xl">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedCardId(card.id);
                                            }}
                                            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${themeStyles.btn}`}
                                        >
                                            {isSelected ? (
                                                <>
                                                    <Check className="w-4 h-4" />
                                                    <span>กำลังเลือกแพ็กเกจนี้</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>{card.ctaText}</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ============================================================== */}
                    {/* 4. BROKER UNLOCK ADD-ON & LIVE SUMMARY BAR */}
                    {/* ============================================================== */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-800 pb-4">
                            
                            {/* Broker Selector */}
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 className="w-4 h-4 text-emerald-400" />
                                    ตัวเลือกการเชื่อมต่อโบรกเกอร์ (Broker Connection Mode)
                                </span>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl">
                                    <button
                                        type="button"
                                        onClick={() => setBrokerOption('ib')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            brokerOption === 'ib'
                                                ? 'bg-emerald-950/30 border-emerald-500 text-white shadow-sm'
                                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                เปิดบัญชีพาร์ตเนอร์ IB
                                            </span>
                                            <span className="text-[10px] font-bold text-emerald-400 font-mono">+฿0</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            ฟรีไม่มีค่าธรรมเนียม สมัครผ่านลิงก์ IB พาร์ตเนอร์ของ EasyM
                                        </p>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setBrokerOption('own')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            brokerOption === 'own'
                                                ? 'bg-amber-950/30 border-amber-500 text-white shadow-sm'
                                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                                ปลดล็อกโบรกเกอร์ส่วนตัว
                                            </span>
                                            <span className="text-[10px] font-bold text-amber-400 font-mono">+฿4,000 / ปี</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Own Broker Unlock ใช้งานกับโบรกเกอร์ใดก็ได้ที่รองรับ MT5
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* Summary Calculation */}
                            <div className="lg:text-right space-y-1 bg-slate-950/80 p-4 rounded-xl border border-slate-800 min-w-[280px]">
                                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                                    สรุปยอดรวมทั้งปี (Annual Total)
                                </span>
                                <div className="flex lg:justify-end items-baseline gap-1.5">
                                    <span className="text-3xl font-black text-white font-mono tracking-tight">
                                        ฿{finalTotalAnnual.toLocaleString()}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">/ ปี</span>
                                </div>
                                <p className="text-xs text-slate-400">
                                    เฉลี่ยสุทธิ <span className="text-amber-400 font-semibold font-mono">฿{finalMonthlyAvg.toLocaleString()}</span> / เดือน
                                </p>
                            </div>
                        </div>

                        {/* Order Summary Action Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                            <div className="text-xs text-slate-300 flex items-center gap-2">
                                <span className="p-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                    <Sparkles className="w-3.5 h-3.5" />
                                </span>
                                <span>
                                    แพ็กเกจที่เลือก: <strong className="text-white">{activeSelectedCard?.name}</strong> • {
                                        vpsOption === 'self' ? 'รันบน VPS ลูกค้า' : 'EasyM Managed (รวม VPS)'
                                    } • {
                                        brokerOption === 'ib' ? 'IB Partner' : 'ปลดล็อกโบรกเกอร์ส่วนตัว'
                                    }
                                </span>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopyProposal}
                                    className="text-xs border-slate-700 hover:bg-slate-800 text-slate-300 flex-1 sm:flex-initial"
                                >
                                    {copiedSummary ? (
                                        <>
                                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                                            คัดลอกข้อเสนอแล้ว!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                                            คัดลอกสรุปข้อเสนอ
                                        </>
                                    )}
                                </Button>

                                <Button
                                    size="sm"
                                    className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex-1 sm:flex-initial"
                                    onClick={() => alert(`จำลองการเลือกแพ็กเกจ: ${activeSelectedCard?.name}\nยอดรวม: ฿${finalTotalAnnual.toLocaleString()} / ปี\nระบบพร้อมนำไปต่อยอดเข้าหน้าชำระเงินจริงในลำดับถัดไปครับ`)}
                                >
                                    <span>ทดลองสั่งซื้อจำลอง</span>
                                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                            </div>
                        </div>

                    </div>

                </div>
            )}

            {/* ============================================================== */}
            {/* VIEW 2: FULL PRICING MATRIX SPECIFICATION (10 PACKAGES) */}
            {/* ============================================================== */}
            {activeTab === 'matrix' && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Table className="w-5 h-5 text-blue-400" />
                                ตารางโครงสร้างราคาสรุป 10 แพ็กเกจ (Marketing Specification Matrix)
                            </h2>
                            <p className="text-xs text-slate-400">
                                อ้างอิงจากแผนงานในไฟล์ EasyM_Web_Pricing_Structure_TH.md
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-900/90 text-slate-300 font-semibold border-b border-slate-800">
                                <tr>
                                    <th className="p-3">#</th>
                                    <th className="p-3">ชื่อแพ็กเกจ</th>
                                    <th className="p-3">กลุ่มลูกค้า</th>
                                    <th className="p-3">รูปแบบ VPS</th>
                                    <th className="p-3">Farm UI</th>
                                    <th className="p-3 text-right">ราคาต่อปี</th>
                                    <th className="p-3 text-right">เฉลี่ยต่อเดือน</th>
                                    <th className="p-3">สิทธิ์ทดลอง / หมายเหตุ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40 font-mono">
                                <tr className="hover:bg-slate-900/40">
                                    <td className="p-3 text-slate-500">1</td>
                                    <td className="p-3 font-bold text-emerald-400 font-sans">EasyM mini (เดิม)</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าเดิม</td>
                                    <td className="p-3 text-slate-400 font-sans">VPS ตัวเอง</td>
                                    <td className="p-3 text-slate-500 font-sans">-</td>
                                    <td className="p-3 text-right font-bold text-white">฿0</td>
                                    <td className="p-3 text-right text-slate-400">-</td>
                                    <td className="p-3 text-slate-400 font-sans">ฟรีตลอดชีพ (IB)</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40">
                                    <td className="p-3 text-slate-500">2</td>
                                    <td className="p-3 font-bold text-amber-400 font-sans">EasyM MAX (เดิม)</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าเดิม</td>
                                    <td className="p-3 text-slate-400 font-sans">VPS ตัวเอง</td>
                                    <td className="p-3 text-slate-500 font-sans">-</td>
                                    <td className="p-3 text-right font-bold text-white">฿0</td>
                                    <td className="p-3 text-right text-slate-400">-</td>
                                    <td className="p-3 text-slate-400 font-sans">ฟรีตลอดชีพ (IB)</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40">
                                    <td className="p-3 text-slate-500">3</td>
                                    <td className="p-3 font-bold text-amber-400 font-sans">EasyM MAX + Farm UI</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าเดิม</td>
                                    <td className="p-3 text-slate-400 font-sans">VPS ตัวเอง</td>
                                    <td className="p-3 text-amber-300 font-sans">Standard</td>
                                    <td className="p-3 text-right font-bold text-white">฿4,000</td>
                                    <td className="p-3 text-right text-slate-400">฿333</td>
                                    <td className="p-3 text-emerald-400 font-sans">ราคาพิเศษลูกค้าเดิม</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40 bg-purple-950/15">
                                    <td className="p-3 text-slate-500">4</td>
                                    <td className="p-3 font-bold text-purple-300 font-sans">EasyM PRIME (อัปเกรด)</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าเดิม</td>
                                    <td className="p-3 text-slate-400 font-sans">VPS ตัวเอง</td>
                                    <td className="p-3 text-purple-300 font-sans">Advanced</td>
                                    <td className="p-3 text-right font-bold text-white">฿8,000</td>
                                    <td className="p-3 text-right text-slate-400">฿667</td>
                                    <td className="p-3 text-purple-300 font-sans">ลด ฿2,000 จากราคาเต็ม</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40">
                                    <td className="p-3 text-slate-500">5</td>
                                    <td className="p-3 font-bold text-amber-400 font-sans">EasyM MAX Managed</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าเดิม</td>
                                    <td className="p-3 text-blue-300 font-sans">Managed</td>
                                    <td className="p-3 text-amber-300 font-sans">Standard</td>
                                    <td className="p-3 text-right font-bold text-white">฿6,000</td>
                                    <td className="p-3 text-right text-slate-400">฿500</td>
                                    <td className="p-3 text-emerald-400 font-sans">ลด 50% (จาก 12,000)</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40 bg-purple-950/20">
                                    <td className="p-3 text-slate-500">6</td>
                                    <td className="p-3 font-bold text-purple-300 font-sans flex items-center gap-1.5">
                                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                                        EasyM PRIME Managed
                                    </td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าเดิม</td>
                                    <td className="p-3 text-blue-300 font-sans">Managed</td>
                                    <td className="p-3 text-purple-300 font-sans">Advanced</td>
                                    <td className="p-3 text-right font-bold text-amber-400">฿12,000</td>
                                    <td className="p-3 text-right text-slate-400">฿1,000</td>
                                    <td className="p-3 text-amber-300 font-sans">Best Value (จ่ายเท่า MAX ได้ PRIME)</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40">
                                    <td className="p-3 text-slate-500">7</td>
                                    <td className="p-3 font-bold text-emerald-400 font-sans">EasyM mini Free</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าใหม่</td>
                                    <td className="p-3 text-slate-400 font-sans">VPS ตัวเอง</td>
                                    <td className="p-3 text-slate-500 font-sans">-</td>
                                    <td className="p-3 text-right font-bold text-white">฿0</td>
                                    <td className="p-3 text-right text-slate-400">-</td>
                                    <td className="p-3 text-slate-400 font-sans">ไม่มีค่าบริการรายปี (IB)</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40">
                                    <td className="p-3 text-slate-500">8</td>
                                    <td className="p-3 font-bold text-amber-400 font-sans">EasyM MAX System</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าใหม่</td>
                                    <td className="p-3 text-slate-400 font-sans">VPS ตัวเอง</td>
                                    <td className="p-3 text-amber-300 font-sans">Standard</td>
                                    <td className="p-3 text-right font-bold text-white">฿8,000</td>
                                    <td className="p-3 text-right text-slate-400">฿667</td>
                                    <td className="p-3 text-purple-300 font-sans">ฟรี Farm UI 2 เดือน</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40 bg-purple-950/15">
                                    <td className="p-3 text-slate-500">9</td>
                                    <td className="p-3 font-bold text-purple-300 font-sans">EasyM PRIME System</td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าใหม่</td>
                                    <td className="p-3 text-slate-400 font-sans">VPS ตัวเอง</td>
                                    <td className="p-3 text-purple-300 font-sans">Advanced</td>
                                    <td className="p-3 text-right font-bold text-white">฿10,000</td>
                                    <td className="p-3 text-right text-slate-400">฿833</td>
                                    <td className="p-3 text-purple-300 font-sans">ฟรี Farm UI 2 เดือน</td>
                                </tr>
                                <tr className="hover:bg-slate-900/40 bg-purple-950/20">
                                    <td className="p-3 text-slate-500">10</td>
                                    <td className="p-3 font-bold text-purple-300 font-sans flex items-center gap-1.5">
                                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                                        EasyM PRIME Managed
                                    </td>
                                    <td className="p-3 text-slate-300 font-sans">ลูกค้าใหม่</td>
                                    <td className="p-3 text-blue-300 font-sans">Managed</td>
                                    <td className="p-3 text-purple-300 font-sans">Advanced</td>
                                    <td className="p-3 text-right font-bold text-purple-300">฿15,000</td>
                                    <td className="p-3 text-right text-slate-400">฿1,250</td>
                                    <td className="p-3 text-amber-300 font-sans">แพ็กเกจเรือธงสมบูรณ์แบบ</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* VIEW 3: FARM UI SPECIFICATION (STANDARD VS ADVANCED) */}
            {/* ============================================================== */}
            {activeTab === 'farmUi' && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-400" />
                            เปรียบเทียบฟังก์ชัน Farm UI: Standard (1U) vs Advanced (2U)
                        </h2>
                        <p className="text-xs text-slate-400">
                            มาตรฐานการส่งข้อมูลแบบ Single Domain V2 พร้อมสิทธิประโยชน์ในการควบคุม
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Standard Farm UI */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-amber-400 text-sm">
                                    Standard Farm UI (1U)
                                </h3>
                                <Badge variant="secondary" className="text-[10px]">
                                    ฟรีตลอดชีพใน mini / MAX
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-400">
                                ออกแบบสำหรับการติดตามสถานะพอร์ตเบื้องต้น รายงานผลทุก 12 ชั่วโมง หรือเมื่อมีคำขอตรวจสอบสิทธิ์
                            </p>
                            <ul className="text-xs space-y-2 text-slate-300">
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>แสดง Balance, Equity, Drawdown และกำไรสะสม</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>ดูผ่านหน้าเว็บ Farm Dashboard และบนมือถือ</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>ใช้แบนด์วิดท์ต่ำมาก ประหยัดเน็ต VPS 90%</span>
                                </li>
                                <li className="flex items-start gap-2 text-slate-500">
                                    <X className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                                    <span>ไม่สามารถสั่งเปิด-ปิดคู่เงินผ่านหน้าเว็บได้</span>
                                </li>
                            </ul>
                        </div>

                        {/* Advanced Farm UI */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/40 to-slate-900 border border-purple-500/40 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-purple-300 text-sm flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-400" />
                                    Advanced Farm UI (2U)
                                </h3>
                                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">
                                    เฉพาะ PRIME / ทดลองฟรี 2 เดือน
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-400">
                                แดชบอร์ดแบบโต้ตอบ 2 ทาง (Two-way Control) ส่งข้อมูลสดพร้อมรับคำสั่งควบคุมระยะไกลจากหน้าเว็บ
                            </p>
                            <ul className="text-xs space-y-2 text-slate-300">
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                    <span>ข้อมูลสดเรียลไทม์ พร้อมกราฟวิเคราะห์พอร์ตโฟลิโอเชิงลึก</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                    <span className="font-semibold text-white">สั่งเปิด–ปิดการเทรดแต่ละคู่เงินจากหน้าเว็บได้ทันที</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                    <span>ระบบ Emergency Kill Switch หยุดการทำงานฉุกเฉินได้ทันที</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                    <span>ค่าต่ออายุปีถัดไปเพียง 1,800 บ./ปี (เฉลี่ย 150 บ./เดือน)</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
