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
    UserCheck,
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
    LayoutGrid,
    Flame,
    Eye,
    Maximize2,
    Laptop,
    Radio,
    FileText,
    TrendingUp,
    Gauge,
    Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Allowed Super Admin Email
const SUPER_ADMIN_EMAIL = 'juntarasate@gmail.com';

// User Persona Definition for Super Admin Simulator
export type PersonaType = 'new_visitor' | 'active_mini' | 'active_max' | 'active_prime' | 'real_user';

// 3 Core Edition / Hosting Choices per Product
export type PlanEditionMode = 'free_no_ui' | 'self_ui' | 'managed_ui';
export type BrokerMode = 'ib' | 'own';

interface ProductConfig {
    id: string;
    tier: 'mini' | 'max' | 'prime';
    name: string;
    subtitle: string;
    description: string;
    imageBox: string;
    imagePromote: string;
    pairsCount: string;
    minCapital: string;
    strategyType: string;
    platform: string;
    ribbonText?: string;
    ribbonColor?: string;
    theme: {
        border: string;
        glow: string;
        accentText: string;
        badgeBg: string;
        btnPrimary: string;
        tagGradient: string;
        dotColor: string;
    };
    pricing: {
        // 1. ฟรี ไม่มีฟาร์ม UI
        free_no_ui: {
            available: boolean;
            priceNew: number;
            priceExisting: number;
            noteNew: string;
            noteExisting: string;
            ctaText: string;
            unavailableReason?: string;
        };
        // 2. รัน VPS เอง + ฟาร์ม UI
        self_ui: {
            available: boolean;
            priceNew: number;
            priceExisting?: number;
            originalPrice?: number;
            noteNew: string;
            noteExisting: string;
            trialBadgeNew?: string;
            trialBadgeExisting?: string;
            farmUi: '1u' | '2u';
            webControl: boolean;
            ctaText: string;
        };
        // 3. ให้เรารันให้ (EasyM Managed)
        managed_ui: {
            available: boolean;
            priceNew?: number;
            priceExisting?: number;
            originalPrice?: number;
            noteNew?: string;
            noteExisting?: string;
            trialBadgeNew?: string;
            trialBadgeExisting?: string;
            farmUi?: '1u' | '2u';
            webControl?: boolean;
            ctaText: string;
            unavailableReason?: string;
        };
    };
    features: {
        engine: string;
        hostingSelf: string;
        hostingManaged: string;
        dashboard: string;
        webControl: string;
        broker: string;
        support: string;
    };
}

const EASYM_PRODUCTS: ProductConfig[] = [
    // -------------------------------------------------------------
    // 1. EasyM mini
    // -------------------------------------------------------------
    {
        id: 'easym-mini',
        tier: 'mini',
        name: 'EasyM mini',
        subtitle: 'Conservative Multi-Pair • จุดเริ่มต้นพอร์ตเทรดอัตโนมัติ',
        description: 'อัลกอริทึมเทรดกระจายความเสี่ยง 5 คู่เงินหลัก ออกแบบสำหรับผู้เริ่มต้นหรือบัญชี Cent/Micro ใช้งานฟรีตลอดชีพผ่าน IB พาร์ตเนอร์',
        imageBox: '/assets/easym_mini_box.png',
        imagePromote: '/assets/easym_mini_promote1.png',
        pairsCount: '5 คู่เงินหลัก',
        minCapital: '50,000 USC ($500)',
        strategyType: 'Multi-Currency Conservative',
        platform: 'MT5 Expert Advisor',
        ribbonText: '🌱 FREE STARTER',
        theme: {
            border: 'border-emerald-500/50 hover:border-emerald-400 group-hover:shadow-[0_0_35px_rgba(16,185,129,0.22)]',
            glow: 'from-emerald-500/15 via-emerald-950/20 to-transparent',
            accentText: 'text-emerald-400',
            badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
            btnPrimary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20',
            tagGradient: 'from-emerald-600 to-teal-700',
            dotColor: 'bg-emerald-400'
        },
        pricing: {
            free_no_ui: {
                available: true,
                priceNew: 0,
                priceExisting: 0,
                noteNew: 'ใช้งานฟรีตลอดชีพ • ตรวจสอบผ่าน MT5',
                noteExisting: 'สิทธิ์ใช้งานฟรีตลอดอายุการใช้งาน',
                ctaText: 'เริ่มต้นใช้งานฟรี (Start Free)'
            },
            self_ui: {
                available: true,
                priceNew: 0,
                priceExisting: 0,
                noteNew: 'รวม Farm UI 1U ฟรีตลอดชีพ',
                noteExisting: 'สิทธิ์ใช้งานฟรี + Farm UI 1U',
                trialBadgeNew: '🌱 ฟรี Farm UI 1U ตลอดชีพ',
                trialBadgeExisting: '🌱 ฟรี Farm UI 1U ตลอดชีพ',
                farmUi: '1u',
                webControl: false,
                ctaText: 'เริ่มต้นใช้งานฟรี (Start Free)'
            },
            managed_ui: {
                available: false,
                ctaText: 'ไม่รองรับ Managed',
                unavailableReason: 'รุ่น mini ออกแบบสำหรับติดตั้งบน VPS ส่วนตัวเท่านั้น หากต้องการให้ทีมงานดูแล แนะนำรุ่น MAX หรือ PRIME'
            }
        },
        features: {
            engine: 'เทรด 5 คู่เงินหลักความเสี่ยงต่ำ ป้องกันพอร์ตด้วย Drawdown Guard',
            hostingSelf: 'ติดตั้งและดูแลบน VPS ของลูกค้าเอง (Self-Hosted)',
            hostingManaged: 'ไม่รองรับในระบบ EasyM Managed',
            dashboard: 'Standard Farm UI (1U) มอนิเตอร์สถิติพอร์ตพื้นฐานฟรีตลอดชีพ',
            webControl: 'ควบคุมผ่านโปรแกรม MT5 (ไม่รองรับการสั่งเปิด-ปิดผ่านเว็บ)',
            broker: 'ใช้งานผ่านบัญชีพาร์ตเนอร์ IB ของ EasyM',
            support: 'คู่มือการติดตั้ง + ซัพพอร์ต Community'
        }
    },

    // -------------------------------------------------------------
    // 2. EasyM MAX
    // -------------------------------------------------------------
    {
        id: 'easym-max',
        tier: 'max',
        name: 'EasyM MAX',
        subtitle: 'Multi-Timeframe Recovery • กระจาย 10 คู่เงินเต็มสูบ',
        description: 'ระบบเทรดอัจฉริยะ 10 คู่เงิน กระจายออเดอร์หลายช่วงเวลา พร้อมฟังก์ชันกู้พอร์ต Dynamic Recovery รับมือสภาวะตลาดผันผวนได้อย่างทรงพลัง',
        imageBox: '/assets/easym_max_box.png',
        imagePromote: '/assets/easym_max_promote1.png',
        pairsCount: '10 คู่เงินครบวงจร',
        minCapital: '100,000 USC ($1,000)',
        strategyType: 'Multi-Timeframe Recovery',
        platform: 'MT5 Expert Advisor',
        ribbonText: '🔥 POPULAR CHOICE',
        theme: {
            border: 'border-amber-500/50 hover:border-amber-400 group-hover:shadow-[0_0_35px_rgba(245,158,11,0.22)]',
            glow: 'from-amber-500/15 via-amber-950/20 to-transparent',
            accentText: 'text-amber-400',
            badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
            btnPrimary: 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20',
            tagGradient: 'from-amber-600 to-orange-700',
            dotColor: 'bg-amber-400'
        },
        pricing: {
            free_no_ui: {
                available: true,
                priceNew: 0,
                priceExisting: 0,
                noteNew: 'ใช้งานฟรี ไม่มี Farm UI (มอนิเตอร์บน MT5)',
                noteExisting: 'สิทธิ์ใช้งานฟรีเดิม (มอนิเตอร์บน MT5)',
                ctaText: 'เริ่มต้นใช้งานฟรี (Start Free)'
            },
            self_ui: {
                available: true,
                priceNew: 8000,
                priceExisting: 4000,
                originalPrice: 8000,
                noteNew: 'ระบบ MAX + Standard Farm UI (เฉลี่ย ฿667/ด.)',
                noteExisting: 'ส่วนลด 50% สำหรับลูกค้าเดิม (เฉลี่ย ฿333/ด.)',
                trialBadgeNew: '🎁 ทดลอง Farm UI 2U ฟรี 2 เดือน',
                trialBadgeExisting: '⭐ สิทธิ์ต่ออายุราคาพิเศษเฉพาะคุณ',
                farmUi: '1u',
                webControl: false,
                ctaText: 'ทดลองใช้ฟรี 2 เดือน (Start Trial)'
            },
            managed_ui: {
                available: true,
                priceNew: 12000,
                priceExisting: 6000,
                originalPrice: 12000,
                noteNew: 'รวม Cloud VPS + ทีมงานดูแล 24/5 (เฉลี่ย ฿1,000/ด.)',
                noteExisting: 'ส่วนลดพิเศษ 50% สำหรับลูกค้าเดิม (เฉลี่ยเพียง ฿500/ด.)',
                trialBadgeNew: '🎁 ทดลอง Farm UI 2U ฟรี 2 เดือน',
                trialBadgeExisting: '⭐ สิทธิ์ลูกค้าเดิมลด 50% ประหยัด ฿6,000',
                farmUi: '1u',
                webControl: false,
                ctaText: 'เลือกแพ็กเกจ MAX Managed'
            }
        },
        features: {
            engine: '10 คู่เงิน กระจายพอร์ตข้ามสกุลเงิน พร้อมระบบแก้ไม้ Dynamic Basket',
            hostingSelf: 'ติดตั้งบน VPS ส่วนตัวของคุณ พร้อมสิทธิ์อัปเดตระบบตลอดปี',
            hostingManaged: 'รวม Cloud VPS สเปกสูง ทีมงานติดตั้งและเฝ้าระวังระบบตลอด 24/5',
            dashboard: 'Standard Farm UI ดูยอด Balance, Equity, Drawdown สดผ่านเว็บและมือถือ',
            webControl: 'มอนิเตอร์สด (ไม่รองรับการสั่งเปิด-ปิดผ่านเว็บ ต้องปรับบน MT5)',
            broker: 'ใช้งานฟรีผ่าน IB พาร์ตเนอร์ หรือปลดล็อกโบรกส่วนตัว (+4,000 บ./ปี)',
            support: 'Priority Line Support + ตรวจสอบสุขภาพพอร์ตรายสัปดาห์'
        }
    },

    // -------------------------------------------------------------
    // 3. EasyM PRIME
    // -------------------------------------------------------------
    {
        id: 'easym-prime',
        tier: 'prime',
        name: 'EasyM PRIME',
        subtitle: 'Flagship Adaptive Architecture • สั่งการและควบคุมสมบูรณ์แบบ',
        description: 'รุ่นเรือธงระดับสูงสุด ผสาน Adaptive Filter กรองข่าวและความผันผวน พร้อมควบคุมสั่งเปิด–ปิดคู่เงินผ่านหน้าเว็บได้แบบ 100% สถาปัตยกรรม Single Domain V2 ประหยัดแบนด์วิดท์',
        imageBox: '/assets/easym_prime_box.png',
        imagePromote: '/assets/easym_prime_promote1.png',
        pairsCount: '10 คู่เงิน + Adaptive Filter',
        minCapital: '100,000 USC ($1,000)',
        strategyType: 'Adaptive Neural Filter & Recovery',
        platform: 'MT5 Expert Advisor (v2.0)',
        ribbonText: '👑 RECOMMENDED FLAGSHIP',
        theme: {
            border: 'border-purple-500/70 hover:border-purple-400 group-hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] ring-1 ring-purple-500/40',
            glow: 'from-purple-500/20 via-indigo-950/25 to-transparent',
            accentText: 'text-purple-300',
            badgeBg: 'bg-gradient-to-r from-purple-500/20 to-amber-500/20 text-purple-200 border-purple-400/40',
            btnPrimary: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-600/30',
            tagGradient: 'from-purple-600 via-indigo-600 to-amber-600',
            dotColor: 'bg-purple-400'
        },
        pricing: {
            free_no_ui: {
                available: false,
                priceNew: 0,
                priceExisting: 0,
                noteNew: 'PRIME ต้องใช้งานคู่กับ Advanced Farm UI เพื่อสั่งงาน 2 ทิศทาง',
                noteExisting: 'PRIME ต้องใช้งานคู่กับ Advanced Farm UI เพื่อสั่งงาน 2 ทิศทาง',
                ctaText: 'ต้องใช้ Farm UI',
                unavailableReason: 'รุ่น PRIME ถูกออกแบบเฉพาะสำหรับสั่งงาน 2 ทิศทางผ่าน Farm UI หากต้องการใช้งานฟรีไม่มี Farm UI แนะนำเลือกรุ่น mini หรือ MAX'
            },
            self_ui: {
                available: true,
                priceNew: 10000,
                priceExisting: 8000,
                originalPrice: 10000,
                noteNew: 'ระบบเรือธงครบวงจร (เฉลี่ย ฿833/ด.)',
                noteExisting: 'อัปเกรดลูกค้าเดิม ลด ฿2,000 (เฉลี่ย ฿667/ด.)',
                trialBadgeNew: '🎁 ทดลอง Farm UI 2U ฟรี 2 เดือน',
                trialBadgeExisting: '⭐ ราคาอัปเกรดพิเศษจากรุ่น MAX/mini',
                farmUi: '2u',
                webControl: true,
                ctaText: 'ทดลองใช้ฟรี 2 เดือน (Start Trial)'
            },
            managed_ui: {
                available: true,
                priceNew: 15000,
                priceExisting: 12000,
                originalPrice: 15000,
                noteNew: 'พรีเมียม Cloud VPS + จูนเนอร์ส่วนตัว + ดูแล 24/5 (฿1,250/ด.)',
                noteExisting: 'จ่ายเท่า MAX Managed ของลูกค้าใหม่ แต่ได้รุ่น PRIME ทันที!',
                trialBadgeNew: '🎁 ทดลอง Farm UI 2U ฟรี 2 เดือน',
                trialBadgeExisting: '⭐ Best Value: ประหยัด ฿3,000 สำหรับลูกค้าเดิม',
                farmUi: '2u',
                webControl: true,
                ctaText: 'เลือกแพ็กเกจ PRIME Managed'
            }
        },
        features: {
            engine: '10 คู่เงิน + Adaptive Filter กรองความผันผวน & ข่าวรุนแรงอัตโนมัติ',
            hostingSelf: 'ติดตั้งบน VPS ส่วนตัว พร้อม Single Domain V2 ประหยัดเน็ตสูงสุด 90%',
            hostingManaged: 'รวม Premium Cloud VPS + SLA 99.9% ทีมงานมืออาชีพดูแลครบ 24/5',
            dashboard: 'Advanced Farm UI (2U) ข้อมูลสดพร้อมวิเคราะห์ Drawdown เชิงลึก',
            webControl: '✨ สั่งเปิด–ปิดคู่เงินผ่านหน้าเว็บได้ 100% ไม่ต้องเข้า VPS',
            broker: 'ใช้งานฟรีผ่าน IB พาร์ตเนอร์ หรือปลดล็อกโบรกส่วนตัว (+4,000 บ./ปี)',
            support: 'VIP Direct Fast-Track Support + แจ้งเตือนความเสี่ยงส่วนบุคคล'
        }
    }
];

export default function EasyMPlansPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Super Admin Persona Simulator State
    const [persona, setPersona] = useState<PersonaType>('new_visitor');
    const [realDetectedLicenses, setRealDetectedLicenses] = useState<string[]>([]);

    // Per-card Selected Edition / Hosting: [productId]: 'free_no_ui' | 'self_ui' | 'managed_ui'
    const [cardEditionMap, setCardEditionMap] = useState<Record<string, PlanEditionMode>>({
        'easym-mini': 'self_ui',
        'easym-max': 'self_ui',
        'easym-prime': 'managed_ui'
    });

    // Detail Modal / Drawer State
    const [detailProduct, setDetailProduct] = useState<ProductConfig | null>(null);
    const [detailEdition, setDetailEdition] = useState<PlanEditionMode>('self_ui');
    const [detailBroker, setDetailBroker] = useState<BrokerMode>('ib');
    const [copiedSummary, setCopiedSummary] = useState(false);

    // Verify Super Admin & Query Real User Licenses from Supabase
    useEffect(() => {
        const checkAccessAndLicenses = async () => {
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

                // Check active licenses owned by this account
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('product_id, products(name, product_key)')
                    .eq('user_id', user.id)
                    .eq('is_active', true);

                const keys = (licenses || []).map((l: any) => l.products?.product_key || l.product_id);
                setRealDetectedLicenses(keys);

            } catch (err) {
                console.error('Check access failed:', err);
                setIsAuthorized(false);
            } finally {
                setLoading(false);
            }
        };

        checkAccessAndLicenses();
    }, [router]);

    // Determine whether current persona qualifies as an "Existing Customer"
    const isExistingCustomer = useMemo(() => {
        if (persona === 'real_user') {
            return realDetectedLicenses.length > 0;
        }
        return persona !== 'new_visitor';
    }, [persona, realDetectedLicenses]);

    // Handle Edition toggle on a specific card
    const setCardEdition = (productId: string, mode: PlanEditionMode) => {
        setCardEditionMap(prev => ({
            ...prev,
            [productId]: mode
        }));
    };

    // Calculate Price for a specific product and edition mode under current persona
    const getCardPriceInfo = (product: ProductConfig, mode: PlanEditionMode) => {
        const pricingTier = product.pricing[mode];

        if (!pricingTier.available) {
            return {
                available: false,
                price: 0,
                monthlyAvg: 0,
                originalPrice: undefined,
                note: (pricingTier as any).unavailableReason || 'ไม่รองรับในรุ่นนี้',
                trialBadge: undefined,
                ctaText: pricingTier.ctaText
            };
        }

        const isDiscounted = isExistingCustomer && (pricingTier as any).priceExisting !== undefined;
        const finalPrice = isDiscounted ? ((pricingTier as any).priceExisting ?? 0) : ((pricingTier as any).priceNew ?? 0);
        const originalPrice = isDiscounted ? (pricingTier as any).originalPrice : undefined;
        const monthlyAvg = finalPrice > 0 ? Math.round(finalPrice / 12) : 0;
        const note = isDiscounted ? (pricingTier.noteExisting || '') : (pricingTier.noteNew || '');
        const trialBadge = isDiscounted ? (pricingTier as any).trialBadgeExisting : (pricingTier as any).trialBadgeNew;

        return {
            available: true,
            price: finalPrice,
            monthlyAvg,
            originalPrice,
            note,
            trialBadge,
            ctaText: pricingTier.ctaText
        };
    };

    // Calculate Modal Total Price
    const detailPriceInfo = useMemo(() => {
        if (!detailProduct) return null;
        return getCardPriceInfo(detailProduct, detailEdition);
    }, [detailProduct, detailEdition, isExistingCustomer]);

    const detailTotalAnnual = (detailPriceInfo?.price || 0) + (detailBroker === 'own' ? 4000 : 0);
    const detailMonthlyAvg = detailTotalAnnual > 0 ? Math.round(detailTotalAnnual / 12) : 0;

    const handleCopyProposal = () => {
        if (!detailProduct) return;
        const editionLabels: Record<PlanEditionMode, string> = {
            free_no_ui: 'ใช้งานฟรี (ไม่มีฟาร์ม UI)',
            self_ui: 'รันบน VPS ของตนเอง (+ ฟาร์ม UI)',
            managed_ui: 'ให้ทีมงานดูแลให้ (EasyM Managed)'
        };

        const text = `[ใบเสนอราคา EasyM Ecosystem]
สินค้า: ${detailProduct.name} (${detailProduct.subtitle})
ประเภทลูกค้า: ${isExistingCustomer ? 'ลูกค้าเดิม (Existing Customer)' : 'ลูกค้าใหม่ (New Customer)'}
รูปแบบการใช้งาน: ${editionLabels[detailEdition]}
ราคาแพ็กเกจ: ${detailPriceInfo?.price === 0 ? 'ฟรี (0 บาท)' : `฿${detailPriceInfo?.price.toLocaleString()} / ปี`}
โบรกเกอร์: ${detailBroker === 'ib' ? 'IB Partner (ฟรีไม่มีค่าธรรมเนียม)' : 'Own Broker Unlock (+฿4,000 / ปี)'}
ยอดรวมทั้งสิ้น: ฿${detailTotalAnnual.toLocaleString()} / ปี (เฉลี่ย ฿${detailMonthlyAvg.toLocaleString()} / เดือน)
สิทธิ์พิเศษ: ${detailPriceInfo?.trialBadge || 'ตามเงื่อนไขแพ็กเกจ'}`;

        navigator.clipboard.writeText(text);
        setCopiedSummary(true);
        setTimeout(() => setCopiedSummary(false), 2500);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-sm text-slate-400 font-mono">กำลังตรวจสอบสิทธิ์ Super Admin...</p>
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
        <div className="space-y-8 pb-28 max-w-7xl mx-auto px-2 sm:px-4">

            {/* ============================================================== */}
            {/* 1. SUPER ADMIN SIMULATOR TOOLBAR (สถานการณ์สมมุติบนสุด) */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                            <Radio className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                                    Customer Persona Simulator
                                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        Admin Preview Only
                                    </span>
                                </h2>
                            </div>
                            <p className="text-xs text-slate-400">
                                จำลองมุมมองลูกค้าเพื่อทดสอบระบบคัดกรองอัตโนมัติ (ตรวจจับสิทธิ์พอร์ตที่กำลังรันอยู่)
                            </p>
                        </div>
                    </div>

                    {/* Status Pill Indicator */}
                    <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                        <span className="text-slate-400">สถานะที่กำลังจำลอง:</span>
                        <span className={`font-bold ${
                            isExistingCustomer ? 'text-emerald-400 flex items-center gap-1' : 'text-blue-400 flex items-center gap-1'
                        }`}>
                            {isExistingCustomer ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                            {persona === 'new_visitor' && 'ลูกค้าใหม่ (New Visitor)'}
                            {persona === 'active_mini' && 'ลูกค้าเดิม (ถือ mini)'}
                            {persona === 'active_max' && 'ลูกค้าเดิม (ถือ MAX)'}
                            {persona === 'active_prime' && 'ลูกค้าเดิม (ถือ PRIME)'}
                            {persona === 'real_user' && `ตรวจพบจริง (${realDetectedLicenses.length > 0 ? 'ลูกค้าเดิม' : 'ลูกค้าใหม่'})`}
                        </span>
                    </div>
                </div>

                {/* Persona Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    
                    <button
                        type="button"
                        onClick={() => setPersona('new_visitor')}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            persona === 'new_visitor'
                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                                <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                                1. ลูกค้าใหม่ทั่วไป
                            </span>
                            {persona === 'new_visitor' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1">ยังไม่มีพอร์ต EasyM • ได้สิทธิ์ทดลองฟรี 2 ด.</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setPersona('active_mini')}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            persona === 'active_mini'
                                ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                2. ลูกค้าเดิม: ถือ mini
                            </span>
                            {persona === 'active_mini' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <span className="text-[10px] text-emerald-400/80 mt-1">ตรวจพบพอร์ต mini รันอยู่ • สิทธิ์อัปเกรด</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setPersona('active_max')}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            persona === 'active_max'
                                ? 'bg-amber-600/20 border-amber-500 text-white shadow-md'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                3. ลูกค้าเดิม: ถือ MAX
                            </span>
                            {persona === 'active_max' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <span className="text-[10px] text-amber-400/80 mt-1">ตรวจพบพอร์ต MAX • ลด 50% Managed</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setPersona('active_prime')}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                            persona === 'active_prime'
                                ? 'bg-purple-600/20 border-purple-500 text-white shadow-md'
                                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-purple-400" />
                                4. ลูกค้าเดิม: ถือ PRIME
                            </span>
                            {persona === 'active_prime' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <span className="text-[10px] text-purple-400/80 mt-1">ตรวจพบพอร์ต PRIME • สิทธิ์เรือธง VIP</span>
                    </button>

                </div>
            </div>

            {/* ============================================================== */}
            {/* 2. PROMINENT TOP HIGHLIGHT BANNER (ข้อความไฮไลต์โดดเด่นมองเห็นชัดเจน) */}
            {/* ============================================================== */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/20 via-purple-600/25 to-blue-600/20 border-2 border-amber-400/60 p-5 sm:p-6 shadow-2xl shadow-amber-500/15">
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -left-8 -bottom-8 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-5 text-center lg:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-purple-600 text-white shadow-xl shadow-amber-500/30 shrink-0">
                            <Smartphone className="w-8 h-8 animate-pulse text-white" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                                <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow">
                                    ★ EXCLUSIVE FEATURE
                                </span>
                                <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    นวัตกรรม Single Domain V2
                                </span>
                            </div>
                            
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
                                EA หนึ่งเดียวที่เปิดดูและสั่งงานผ่านหน้าฟาร์ม UI บนมือถือได้{' '}
                                <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent underline decoration-amber-400/80 decoration-wavy underline-offset-4">
                                    ทุกตัวทดลองใช้ฟรี 2 เดือน
                                </span>
                            </h2>
                            
                            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
                                มอนิเตอร์ผลงาน Balance, Equity, Drawdown สดระดับวินาที และสั่งเปิด-ปิดคู่เงินผ่านหน้าเว็บได้ทุกที่ตลอด 24 ชั่วโมง โดยไม่ต้องเปิดรีโมต VPS
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <div className="px-4 py-2.5 rounded-2xl bg-slate-950/90 border border-amber-400/40 text-center shadow-lg">
                            <span className="text-[10px] text-amber-300 uppercase tracking-wider block font-bold">สิทธิ์พิเศษทันที</span>
                            <span className="text-lg font-black text-white font-mono">ฟรี 60 วัน</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================== */}
            {/* 3. STORE HEADER & AUTO DETECTION STATUS */}
            {/* ============================================================== */}
            <div className="text-center space-y-2.5 pt-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-slate-900 border border-slate-800 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-slate-300">หมวดหมู่สินค้า</span>
                    <span className="text-slate-500">•</span>
                    <span className="bg-gradient-to-r from-amber-400 via-purple-400 to-blue-400 bg-clip-text text-transparent font-black tracking-wider">
                        EASYM FAMILY
                    </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                    เลือกระบบเทรด EasyM ที่เหมาะกับพอร์ตของคุณ
                </h1>
                
                {/* Auto Detection Status Banner for User */}
                <div className="inline-flex items-center gap-2 text-xs py-1.5 px-4 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>
                        ระบบตรวจสอบสิทธิ์อัตโนมัติ: {
                            isExistingCustomer ? (
                                <strong className="text-emerald-300 font-semibold">
                                    ตรวจพบสถานะลูกค้าเดิม (ระบบปรับใช้ราคาพิเศษและส่วนลดอัปเกรดทันที)
                                </strong>
                            ) : (
                                <strong className="text-blue-300 font-semibold">
                                    ผู้ใช้งานใหม่ (รับสิทธิ์ทดลอง Farm UI 2U ฟรี 2 เดือนเต็มเมื่อเปิดใช้งาน)
                                </strong>
                            )
                        }
                    </span>
                </div>
            </div>

            {/* ============================================================== */}
            {/* 4. LUXURY PRODUCT CARDS GRID (ภาพเต็มความกว้าง + ตัวเลือกใช้ฟรี) */}
            {/* ============================================================== */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-7 items-stretch">
                {EASYM_PRODUCTS.map((product) => {
                    const currentEdition = cardEditionMap[product.id] || 'self_ui';
                    const priceInfo = getCardPriceInfo(product, currentEdition);

                    return (
                        <div
                            key={product.id}
                            className={`group relative flex flex-col rounded-3xl bg-slate-950 border-2 transition-all duration-300 overflow-hidden ${product.theme.border}`}
                        >
                            {/* Ambient Top Glow */}
                            <div className={`absolute top-0 inset-x-0 h-40 bg-gradient-to-b ${product.theme.glow} pointer-events-none z-10`} />

                            {/* --- LUXURY RIBBON SASH (ป้ายคาดสินค้าไฮไลท์) --- */}
                            {product.ribbonText && (
                                <div className="absolute top-4 left-4 z-20">
                                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-xl bg-gradient-to-r ${product.theme.tagGradient}`}>
                                        {product.ribbonText}
                                    </span>
                                </div>
                            )}

                            {/* Active Holder Status Badge (Top Right) */}
                            {((persona === 'active_mini' && product.tier === 'mini') ||
                              (persona === 'active_max' && product.tier === 'max') ||
                              (persona === 'active_prime' && product.tier === 'prime')) && (
                                <div className="absolute top-4 right-4 z-20">
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 backdrop-blur-md shadow-lg">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        กำลังใช้งานอยู่
                                    </span>
                                </div>
                            )}

                            {/* --- FULL-WIDTH SHOWCASE IMAGE (ปรับให้เต็มความกว้างของกรอบเหมือนหน้าเดิม) --- */}
                            <div className="relative aspect-square w-full overflow-hidden bg-slate-900 border-b border-border/50">
                                <Image
                                    src={product.imageBox}
                                    alt={product.name}
                                    fill
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                                    priority
                                />
                                
                                {/* Bottom Dark Gradient Fade */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent z-10" />

                                {/* Platform & Pair Badge Overlay on Image Bottom */}
                                <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center justify-between text-xs">
                                    <span className="px-2.5 py-0.5 rounded-md font-mono font-bold bg-slate-950/90 text-slate-300 border border-slate-800 shadow">
                                        {product.platform}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-md font-semibold bg-slate-950/90 text-amber-300 border border-slate-800 shadow">
                                        {product.pairsCount}
                                    </span>
                                </div>
                            </div>

                            {/* --- PRODUCT BODY CONTENT --- */}
                            <div className="p-5 sm:p-6 flex-1 flex flex-col space-y-4">
                                
                                {/* Header: Title & Subtitle */}
                                <div>
                                    <h3 className={`text-2xl font-black tracking-tight text-white flex items-center gap-2 group-hover:${product.theme.accentText} transition-colors`}>
                                        {product.name}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 leading-normal line-clamp-2 min-h-[32px]">
                                        {product.subtitle}
                                    </p>
                                </div>

                                {/* ============================================================== */}
                                {/* 3-WAY IN-CARD SELECTOR: ฟรีไม่มี UI vs รัน VPS เอง vs ให้เรารันให้ */}
                                {/* ============================================================== */}
                                <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                                        <span className="font-semibold flex items-center gap-1 text-slate-300">
                                            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                                            เลือกแพ็กเกจ & รูปแบบการรัน
                                        </span>
                                        {currentEdition === 'free_no_ui' && (
                                            <span className="text-[10px] text-emerald-400 font-bold">
                                                ไม่มีค่าบริการ
                                            </span>
                                        )}
                                        {currentEdition === 'self_ui' && (
                                            <span className="text-[10px] text-blue-300 font-bold">
                                                Farm UI + ทดลองฟรี
                                            </span>
                                        )}
                                        {currentEdition === 'managed_ui' && (
                                            <span className="text-[10px] text-purple-300 font-bold">
                                                ทีมงานดูแล 24/5
                                            </span>
                                        )}
                                    </div>

                                    {/* 3 Buttons Grid */}
                                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px]">
                                        
                                        {/* Button 1: ใช้ฟรี ไม่มีฟาร์ม UI */}
                                        <button
                                            type="button"
                                            disabled={!product.pricing.free_no_ui.available}
                                            onClick={() => setCardEdition(product.id, 'free_no_ui')}
                                            className={`py-2 px-1 rounded-lg font-bold transition-all flex flex-col items-center justify-center text-center leading-tight ${
                                                !product.pricing.free_no_ui.available
                                                    ? 'opacity-30 cursor-not-allowed text-slate-600'
                                                    : currentEdition === 'free_no_ui'
                                                        ? 'bg-emerald-600 text-white shadow-md'
                                                        : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <span>ใช้ฟรี</span>
                                            <span className="text-[9px] font-normal opacity-80">(ไม่มี Farm UI)</span>
                                        </button>

                                        {/* Button 2: รัน VPS เอง (+ Farm UI) */}
                                        <button
                                            type="button"
                                            onClick={() => setCardEdition(product.id, 'self_ui')}
                                            className={`py-2 px-1 rounded-lg font-bold transition-all flex flex-col items-center justify-center text-center leading-tight ${
                                                currentEdition === 'self_ui'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <span>รัน VPS เอง</span>
                                            <span className="text-[9px] font-normal opacity-80">(+ Farm UI)</span>
                                        </button>

                                        {/* Button 3: ให้เรารันให้ (Managed) */}
                                        <button
                                            type="button"
                                            disabled={!product.pricing.managed_ui.available}
                                            onClick={() => setCardEdition(product.id, 'managed_ui')}
                                            className={`py-2 px-1 rounded-lg font-bold transition-all flex flex-col items-center justify-center text-center leading-tight ${
                                                !product.pricing.managed_ui.available
                                                    ? 'opacity-30 cursor-not-allowed text-slate-600'
                                                    : currentEdition === 'managed_ui'
                                                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                                                        : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <span>ให้เรารันให้</span>
                                            <span className="text-[9px] font-normal opacity-80">(Managed)</span>
                                        </button>

                                    </div>

                                    {/* Notice text for disabled options */}
                                    {!product.pricing.managed_ui.available && currentEdition === 'managed_ui' && (
                                        <p className="text-[10px] text-amber-400 px-1 leading-tight">
                                            * รุ่น mini รองรับเฉพาะรันบน VPS ตนเอง
                                        </p>
                                    )}
                                    {!product.pricing.free_no_ui.available && currentEdition === 'free_no_ui' && (
                                        <p className="text-[10px] text-purple-300 px-1 leading-tight">
                                            * PRIME ต้องใช้งานร่วมกับ Advanced Farm UI เพื่อสั่งงาน 2 ทิศทาง
                                        </p>
                                    )}
                                </div>

                                {/* ============================================================== */}
                                {/* DYNAMIC PRICE DISPLAY (ราคาตัวใหญ่ ชัดเจน) */}
                                {/* ============================================================== */}
                                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                                    {priceInfo.available ? (
                                        <>
                                            <div className="flex items-baseline gap-2">
                                                {priceInfo.originalPrice && (
                                                    <span className="text-xs text-slate-500 line-through font-mono">
                                                        ฿{priceInfo.originalPrice.toLocaleString()}
                                                    </span>
                                                )}
                                                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                                                    {priceInfo.price === 0 ? '฿0' : `฿${priceInfo.price.toLocaleString()}`}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {priceInfo.price === 0 ? 'ตลอดชีพ' : '/ ปี'}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-xs text-slate-400">
                                                <span className="truncate pr-1">{priceInfo.note}</span>
                                                {priceInfo.price > 0 && (
                                                    <span className="font-bold text-amber-300 font-mono shrink-0">
                                                        ~฿{priceInfo.monthlyAvg.toLocaleString()}/ด.
                                                    </span>
                                                )}
                                            </div>

                                            {priceInfo.trialBadge && (
                                                <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5 text-[11px] text-purple-300">
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                    <span className="font-semibold">{priceInfo.trialBadge}</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="py-2 text-center text-xs text-slate-400 leading-relaxed">
                                            {priceInfo.note}
                                        </div>
                                    )}
                                </div>

                                {/* --- HIGHLIGHT FEATURES CHECKLIST --- */}
                                <div className="space-y-2 pt-1 text-xs text-slate-300 flex-1">
                                    <div className="flex items-start gap-2">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <span>{product.features.engine}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        {currentEdition === 'free_no_ui' ? (
                                            <>
                                                <X className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                                                <span className="text-slate-400">ไม่มี Farm UI (มอนิเตอร์บนโปรแกรม MT5)</span>
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                <span>{product.features.dashboard}</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-start gap-2">
                                        {product.tier === 'prime' && currentEdition !== 'free_no_ui' ? (
                                            <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                        ) : (
                                            <X className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                                        )}
                                        <span className={product.tier === 'prime' && currentEdition !== 'free_no_ui' ? 'text-purple-300 font-semibold' : 'text-slate-400'}>
                                            {product.features.webControl}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                        <span>เงินทุนเริ่มต้นแนะนำ: <strong className="text-white">{product.minCapital}</strong></span>
                                    </div>
                                </div>

                                {/* --- CARD ACTION BUTTON (เปิดดูรายละเอียดเพิ่มเติม) --- */}
                                <div className="pt-2">
                                    <Button
                                        onClick={() => {
                                            setDetailProduct(product);
                                            setDetailEdition(currentEdition);
                                            setDetailBroker('ib');
                                        }}
                                        className={`w-full py-6 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 ${product.theme.btnPrimary}`}
                                    >
                                        <Eye className="w-4 h-4" />
                                        <span>ดูรายละเอียด & สั่งซื้อ ({product.name})</span>
                                        <ArrowRight className="w-4 h-4 ml-0.5" />
                                    </Button>
                                </div>

                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ============================================================== */}
            {/* 5. INTERACTIVE PRODUCT DETAIL MODAL / DRAWER */}
            {/* ============================================================== */}
            {detailProduct && (
                <div 
                    className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
                    onClick={() => setDetailProduct(null)}
                >
                    <div 
                        className="relative w-full max-w-4xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Modal Button */}
                        <button
                            type="button"
                            onClick={() => setDetailProduct(null)}
                            className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Modal Header: Image Gallery + Title */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-b border-slate-800 pb-6">
                            
                            {/* Images showcase (Box Art + Promote Banner) */}
                            <div className="md:col-span-5 flex flex-col gap-3">
                                <div className="relative aspect-square w-full rounded-2xl bg-slate-900 overflow-hidden border border-slate-800">
                                    <Image
                                        src={detailProduct.imageBox}
                                        alt={detailProduct.name}
                                        fill
                                        className="object-cover"
                                    />
                                    {detailProduct.ribbonText && (
                                        <div className="absolute top-3 left-3 z-10">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${detailProduct.theme.tagGradient}`}>
                                                {detailProduct.ribbonText}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {detailProduct.imagePromote && (
                                    <div className="relative h-20 w-full rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                                        <Image
                                            src={detailProduct.imagePromote}
                                            alt={`${detailProduct.name} promote banner`}
                                            fill
                                            className="object-cover opacity-85 hover:opacity-100 transition"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Details Header Text */}
                            <div className="md:col-span-7 space-y-3">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300">
                                    <Badge variant="outline" className="text-amber-400 border-amber-500/40">
                                        {detailProduct.platform}
                                    </Badge>
                                    <span>{detailProduct.strategyType}</span>
                                </div>

                                <h2 className="text-3xl font-black text-white tracking-tight">
                                    {detailProduct.name}
                                </h2>

                                <p className="text-xs text-amber-300 font-medium">
                                    {detailProduct.subtitle}
                                </p>

                                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                                    {detailProduct.description}
                                </p>

                                {/* Specifications Chips */}
                                <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                                        <span className="text-slate-500 block text-[10px]">คู่เงินที่เทรด</span>
                                        <span className="font-bold text-white">{detailProduct.pairsCount}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                                        <span className="text-slate-500 block text-[10px]">เงินทุนเริ่มต้นแนะนำ</span>
                                        <span className="font-bold text-white">{detailProduct.minCapital}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body: Interactive Configuration */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                                ปรับแต่งตัวเลือกก่อนสั่งซื้อ (Customization)
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* 1. Edition & Hosting Option */}
                                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                                    <span className="text-xs font-bold text-slate-300 block">
                                        1. แพ็กเกจและการดูแล (Edition & Hosting)
                                    </span>

                                    <div className="space-y-2">
                                        
                                        {/* Option: ฟรี ไม่มี Farm UI */}
                                        <button
                                            type="button"
                                            disabled={!detailProduct.pricing.free_no_ui.available}
                                            onClick={() => setDetailEdition('free_no_ui')}
                                            className={`w-full p-3 rounded-xl border text-left transition-all ${
                                                !detailProduct.pricing.free_no_ui.available
                                                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800'
                                                    : detailEdition === 'free_no_ui'
                                                        ? 'bg-emerald-600/20 border-emerald-500 text-white'
                                                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                    ใช้งานฟรี (ไม่มี Farm UI)
                                                </span>
                                                {detailEdition === 'free_no_ui' && <Check className="w-4 h-4 text-emerald-400" />}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                {detailProduct.pricing.free_no_ui.available
                                                    ? 'รันบน VPS ลูกค้าเอง มอนิเตอร์บนโปรแกรม MT5 โดยตรง'
                                                    : 'รุ่นนี้ต้องใช้งานร่วมกับ Farm UI เพื่อสั่งงาน 2 ทิศทาง'}
                                            </p>
                                        </button>

                                        {/* Option: รัน VPS เอง (+ Farm UI) */}
                                        <button
                                            type="button"
                                            onClick={() => setDetailEdition('self_ui')}
                                            className={`w-full p-3 rounded-xl border text-left transition-all ${
                                                detailEdition === 'self_ui'
                                                    ? 'bg-blue-600/20 border-blue-500 text-white'
                                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <Server className="w-3.5 h-3.5 text-blue-400" />
                                                    รันบน VPS ของตนเอง (+ Farm UI)
                                                </span>
                                                {detailEdition === 'self_ui' && <Check className="w-4 h-4 text-blue-400" />}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                ลูกค้าดูแล VPS เอง พร้อมเชื่อมต่อ Farm Dashboard บนมือถือ
                                            </p>
                                        </button>

                                        {/* Option: ให้ทีมงานดูแลให้ (Managed) */}
                                        <button
                                            type="button"
                                            disabled={!detailProduct.pricing.managed_ui.available}
                                            onClick={() => setDetailEdition('managed_ui')}
                                            className={`w-full p-3 rounded-xl border text-left transition-all ${
                                                !detailProduct.pricing.managed_ui.available
                                                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800'
                                                    : detailEdition === 'managed_ui'
                                                        ? 'bg-purple-600/20 border-purple-500 text-white'
                                                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <Cloud className="w-3.5 h-3.5 text-purple-400" />
                                                    ให้ทีมงานดูแลให้ (EasyM Managed)
                                                </span>
                                                {detailEdition === 'managed_ui' && <Check className="w-4 h-4 text-purple-400" />}
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                {detailProduct.pricing.managed_ui.available 
                                                    ? 'รวม Cloud VPS คุณภาพสูง พร้อมทีมงานมอนิเตอร์ 24/5' 
                                                    : 'ไม่รองรับในรุ่นนี้ (เฉพาะ MAX และ PRIME)'}
                                            </p>
                                        </button>

                                    </div>
                                </div>

                                {/* 2. Broker Connection Mode */}
                                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                                    <span className="text-xs font-bold text-slate-300 block">
                                        2. การเชื่อมต่อโบรกเกอร์ (Broker Unlock)
                                    </span>

                                    <div className="space-y-2">
                                        <button
                                            type="button"
                                            onClick={() => setDetailBroker('ib')}
                                            className={`w-full p-3 rounded-xl border text-left transition-all ${
                                                detailBroker === 'ib'
                                                    ? 'bg-emerald-600/20 border-emerald-500 text-white'
                                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                    เปิดบัญชีผ่าน IB พาร์ตเนอร์
                                                </span>
                                                <span className="text-[10px] font-bold text-emerald-400 font-mono">+฿0</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                ฟรีค่าธรรมเนียม สมัครผ่านพาร์ตเนอร์ EasyM
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDetailBroker('own')}
                                            className={`w-full p-3 rounded-xl border text-left transition-all ${
                                                detailBroker === 'own'
                                                    ? 'bg-amber-600/20 border-amber-500 text-white'
                                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                                    ปลดล็อกโบรกเกอร์ส่วนตัว (Own Broker)
                                                </span>
                                                <span className="text-[10px] font-bold text-amber-400 font-mono">+฿4,000 / ปี</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-1">
                                                เชื่อมต่อกับโบรกเกอร์ใดก็ได้ที่รองรับ MT5
                                            </p>
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Modal Footer: Live Price Summary & Checkout */}
                        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div>
                                <span className="text-[11px] text-slate-400 block font-medium">
                                    สรุปราคาสุทธิ (Annual Total) • {isExistingCustomer ? 'สิทธิ์ลูกค้าเดิม' : 'ลูกค้าใหม่'}
                                </span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-white font-mono">
                                        {detailTotalAnnual === 0 ? '฿0' : `฿${detailTotalAnnual.toLocaleString()}`}
                                    </span>
                                    <span className="text-xs text-slate-400 font-medium">/ ปี</span>
                                    {detailTotalAnnual > 0 && (
                                        <span className="text-xs text-amber-400 font-mono font-semibold ml-2">
                                            (เฉลี่ย ฿{detailMonthlyAvg.toLocaleString()}/ด.)
                                        </span>
                                    )}
                                </div>
                                {detailPriceInfo?.trialBadge && (
                                    <span className="text-[11px] text-purple-300 flex items-center gap-1 mt-0.5">
                                        <Sparkles className="w-3 h-3 text-amber-400" />
                                        {detailPriceInfo.trialBadge}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                <Button
                                    variant="outline"
                                    onClick={handleCopyProposal}
                                    className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs flex-1 sm:flex-initial"
                                >
                                    {copiedSummary ? (
                                        <>
                                            <CheckCheck className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
                                            คัดลอกสำเร็จ!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                                            คัดลอกข้อเสนอ
                                        </>
                                    )}
                                </Button>

                                <Button
                                    onClick={() => alert(`จำลองการสั่งซื้อสำเร็จ!\nสินค้า: ${detailProduct.name}\nตัวเลือก: ${detailEdition}\nยอดรวม: ฿${detailTotalAnnual.toLocaleString()} / ปี\nพร้อมเชื่อมต่อไปยังหน้า Checkout หลักของระบบแล้วครับ`)}
                                    className={`text-xs sm:text-sm font-bold flex-1 sm:flex-initial ${detailProduct.theme.btnPrimary}`}
                                >
                                    <span>ยืนยันการสั่งซื้อจำลอง</span>
                                    <ArrowRight className="w-4 h-4 ml-1.5" />
                                </Button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}
