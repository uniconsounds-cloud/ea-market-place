'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ShieldCheck, Zap, AlertCircle, Info, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface MonitorProductDetailProps {
    product: any;
}

const SKINS = [
    { id: 'spaceship', name: 'Spaceship Skin (ฟรี)', price: 0, desc: 'ธีมคอนโซลควบคุมยานอวกาศกึ่งสถิติมาตรฐาน', image: '/farm/skin_spaceship_preview.png' },
    { id: 'pixel_farm', name: '2.5D Pixel Farm Skin', price: 990, desc: 'ฟาร์มผลไม้สามมิติที่จะงอกงามตามสถานะกำไรพอร์ต', image: '/farm/skin_farm_preview.png' },
    { id: 'f1_cockpit', name: 'F1 Cockpit Skin', price: 1290, desc: 'แผงคอนโซลควบคุมแบบรถแข่งสปอร์ต คอพิวเตอร์วิเคราะห์ข้อมูลสูง', image: '/farm/skin_f1_preview.png' },
    { id: 'fighter_jet', name: 'Fighter Jet Skin', price: 1290, desc: 'หน้าต่างควบคุมห้องนักบินรบไอพ่นสุดล้ำ', image: '/farm/skin_jet_preview.png' },
    { id: 'spaceship_commander', name: 'Spaceship Commander Skin', price: 1590, desc: 'แผงควบคุมระดับกัปตันยานแม่ อภิมหายานวิจัยสถิติตลอดชีพ', image: '/farm/skin_commander_preview.png' }
];

export function MonitorProductDetail({ product }: MonitorProductDetailProps) {
    const router = useRouter();
    const [selectedTier, setSelectedTier] = useState<'free' | 'pro' | 'max'>('free');
    const [selectedSkins, setSelectedSkins] = useState<string[]>(['spaceship']);
    const [accountNumber, setAccountNumber] = useState('');
    const [riskAccepted, setRiskAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // IB Status States
    const [ibStatus, setIbStatus] = useState<'none' | 'pending' | 'approved'>('none');
    const [selectedIbBroker, setSelectedIbBroker] = useState('');
    const [approvedBrokersList, setApprovedBrokersList] = useState<string[]>([]);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                // Fetch IB membership info
                const { data: memberships } = await supabase
                    .from('ib_memberships')
                    .select('status, brokers(name)')
                    .eq('user_id', user.id);

                if (memberships && memberships.length > 0) {
                    const approved = memberships.filter(m => m.status === 'approved').map(m => (m.brokers as any)?.name || 'Partner').filter(Boolean);
                    setApprovedBrokersList(approved);
                    if (approved.length > 0) {
                        setIbStatus('approved');
                        setSelectedIbBroker(approved[0]);
                    } else if (memberships.some(m => m.status === 'pending')) {
                        setIbStatus('pending');
                    }
                }
            }
        };
        fetchUser();
    }, []);

    // Toggle skin add-on
    const handleSkinToggle = (skinId: string) => {
        if (skinId === 'spaceship') return; // Cannot toggle off default skin
        if (selectedSkins.includes(skinId)) {
            setSelectedSkins(prev => prev.filter(id => id !== skinId));
        } else {
            setSelectedSkins(prev => [...prev, skinId]);
        }
    };

    // Calculate total price
    const calculateTotal = () => {
        let price = 0;
        // Tier base prices
        if (selectedTier === 'pro') {
            price = (ibStatus === 'approved') ? 0 : 1590;
        } else if (selectedTier === 'max') {
            price = 4990;
        } else {
            price = 0; // Free tier
        }

        // Add-ons skins prices
        selectedSkins.forEach(skinId => {
            const skin = SKINS.find(s => s.id === skinId);
            if (skin) {
                // If Pro, Pixel Farm is included for free
                if (selectedTier === 'pro' && skinId === 'pixel_farm') return;
                // If Max, all skins are included for free
                if (selectedTier === 'max') return;
                price += skin.price;
            }
        });

        return price;
    };

    const handleCheckout = async () => {
        if (!accountNumber.trim()) {
            toast.error('กรุณากรอกหมายเลขพอร์ต MT5 ของคุณ');
            return;
        }
        if (!riskAccepted) {
            toast.error('กรุณายอมรับความเสี่ยงและเงื่อนไขการใช้งาน');
            return;
        }

        setLoading(true);
        try {
            // Build plan parameters based on selection: e.g. monitor_free_skin_pixel_farm
            const planType = `monitor_${selectedTier}${selectedSkins.filter(s => s !== 'spaceship').length > 0 ? '_skin_' + selectedSkins.filter(s => s !== 'spaceship').join('_') : ''}`;
            const isIbRequest = selectedTier === 'pro' && ibStatus === 'approved';

            const queryParams = new URLSearchParams({
                plan: planType,
                accountNumber: accountNumber.trim(),
                isIbRequest: isIbRequest ? 'true' : 'false',
                ibBrokerName: isIbRequest ? selectedIbBroker : ''
            });

            if (!userId) {
                const returnUrl = encodeURIComponent(`/products/${product.id}?${queryParams.toString()}`);
                router.push(`/login?returnUrl=${returnUrl}`);
                return;
            }

            router.push(`/checkout/${product.id}?${queryParams.toString()}`);
        } catch (error) {
            console.error(error);
            toast.error('เกิดข้อผิดพลาดในการตรวจสอบข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-12">
            {/* 1. Comparison Table Grid */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-6 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-stone-900 border-b border-border/50 text-center">
                    <h2 className="text-xl md:text-2xl font-bold text-white">ตารางเปรียบเทียบสิทธิประโยชน์ของแดชบอร์ดแต่ละระดับ</h2>
                    <p className="text-xs text-muted-foreground mt-1">เลือกความเร็วของการซิงก์ข้อมูลและความหรูหราของธีมบอร์ดได้ตามความเหมาะสมของคุณ</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-background/80 border-b border-border">
                                <th className="p-4 font-bold text-muted-foreground w-1/3">คุณสมบัติการซิงก์พอร์ต</th>
                                <th className="p-4 font-bold text-gray-400">Free Tier (ทั่วไป)</th>
                                <th className="p-4 font-bold text-primary">Pro Tier (ลูกค้า EA/IB)</th>
                                <th className="p-4 font-bold text-accent">Max Tier (กองทุน/ฟาร์ม)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            <tr>
                                <td className="p-4 font-medium">ค่าบริการสิทธิ์การใช้</td>
                                <td className="p-4 text-green-500 font-bold">ใช้งานฟรี $0</td>
                                <td className="p-4 font-bold">฿1,590 <span className="text-xs font-normal text-muted-foreground block">(ลูกค้า IB ขอใช้ฟรีได้!)</span></td>
                                <td className="p-4 font-bold text-accent">฿4,990</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium">ความเร็วซิงก์เรียลไทม์ (เมื่อมีคนเปิดบอร์ด)</td>
                                <td className="p-4 text-muted-foreground">ทุกๆ 30 วินาที</td>
                                <td className="p-4 text-primary font-semibold">ทุกๆ 20 วินาที</td>
                                <td className="p-4 text-accent font-bold">ทุกๆ 10 วินาที</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium">ระบบปลุกอัจฉริยะ (เมื่อเปิดหน้าจอ)</td>
                                <td className="p-4 flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> ตื่นใน 10 วินาที</td>
                                <td className="p-4"><Check className="w-4 h-4 text-green-500" /> ตื่นใน 10 วินาที</td>
                                <td className="p-4"><Check className="w-4 h-4 text-green-500" /> ตื่นใน 10 วินาที</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium">ธีมมาตรฐานที่มีให้ใช้ฟรี</td>
                                <td className="p-4 text-muted-foreground">Spaceship Skin เท่านั้น</td>
                                <td className="p-4">Spaceship + <b>Pixel Farm (2.5D)</b></td>
                                <td className="p-4 text-accent font-semibold">ปลดล็อกครบทุกธีมสกิน</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium">ระบบวิเคราะห์ข้อมูลราคา BE และกราฟตั๋ว</td>
                                <td className="p-4 text-muted-foreground flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> ล็อกการแสดงตั๋วแยกไม้ (สีเทา)</td>
                                <td className="p-4 text-green-500"><Check className="w-4 h-4 text-green-500" /> ปลดล็อกข้อมูลแสดงผลแบบสีสันเรียลไทม์</td>
                                <td className="p-4 text-green-500"><Check className="w-4 h-4 text-green-500" /> ปลดล็อกข้อมูลแสดงผลแบบสีสันเรียลไทม์</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium">ระบบแจ้งเตือนผ่าน Line / Telegram</td>
                                <td className="p-4 text-muted-foreground">ไม่มีระบบเตือน</td>
                                <td className="p-4 text-muted-foreground">ไม่มีระบบเตือน</td>
                                <td className="p-4 text-accent font-bold">แจ้งเตือนระดับเสี่ยง Margin / Drawdown ทันที</td>
                            </tr>
                            <tr>
                                <td className="p-4 font-medium">การทดลองใช้ธีม และ Pro Feature</td>
                                <td className="p-4 text-muted-foreground">พรีวิวธีม 1 นาที / ลอง Pro 30 นาที<br/>(จำกัดวันละ 3 ครั้ง)</td>
                                <td className="p-4 text-green-500">ปลดล็อกใช้งานถาวร</td>
                                <td className="p-4 text-green-500">ปลดล็อกใช้งานถาวร</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 2. Choose Skins / Add-on Products Catalog */}
            <div>
                <h3 className="text-lg font-bold mb-4 flex items-center text-white">
                    <Zap className="w-5 h-5 text-accent mr-2" />
                    เลือกซื้อสกินหน้ากากแดชบอร์ดเพิ่มเติม (Optional Add-ons)
                </h3>
                <p className="text-xs text-muted-foreground mb-6">คุณสามารถซื้อสกินเหล่านี้เดี่ยวๆ ไปติดตั้งให้หน้าบอร์ดพอร์ตของคุณได้ หรือรับฟรีตามระดับแพ็กเกจลิขสิทธิ์</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {SKINS.map(skin => {
                        const isDefault = skin.id === 'spaceship';
                        const isIncludedInPro = selectedTier === 'pro' && skin.id === 'pixel_farm';
                        const isIncludedInMax = selectedTier === 'max' && skin.id !== 'spaceship';
                        const isSelected = selectedSkins.includes(skin.id) || isIncludedInPro || isIncludedInMax;

                        return (
                            <div 
                                key={skin.id}
                                className={`border rounded-xl p-4 bg-black/40 backdrop-blur-md transition-all relative ${isSelected ? 'border-primary shadow-lg shadow-primary/5' : 'border-border/60 hover:border-border'}`}
                            >
                                <div className="aspect-video bg-muted/20 rounded-lg mb-4 overflow-hidden relative border border-border/30">
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                                    <span className="absolute bottom-2 left-2 text-xs font-bold text-white z-20">{skin.name}</span>
                                    {isDefault && (
                                        <span className="absolute top-2 right-2 bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                                            ฟรีมาตรฐาน
                                        </span>
                                    )}
                                    {isIncludedInPro && (
                                        <span className="absolute top-2 right-2 bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded text-[10px] font-bold">
                                            แถมฟรีใน Pro
                                        </span>
                                    )}
                                    {isIncludedInMax && (
                                        <span className="absolute top-2 right-2 bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded text-[10px] font-bold">
                                            แถมฟรีใน Max
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-4 h-8 overflow-hidden">{skin.desc}</p>
                                <div className="flex justify-between items-center pt-2 border-t border-border/30">
                                    <span className="font-bold text-white">
                                        {isDefault || isIncludedInPro || isIncludedInMax ? '฿0' : `฿${skin.price.toLocaleString()}`}
                                    </span>
                                    {!isDefault && !isIncludedInPro && !isIncludedInMax && (
                                        <Button 
                                            size="sm"
                                            variant={selectedSkins.includes(skin.id) ? "default" : "outline"}
                                            onClick={() => handleSkinToggle(skin.id)}
                                            className="h-8"
                                        >
                                            {selectedSkins.includes(skin.id) ? 'เลือกแล้ว' : 'เพิ่มสกิน'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3. Configurator and Purchase Card */}
            <div className="bg-stone-900 border border-border p-6 rounded-2xl shadow-xl space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center">
                    <Info className="w-5 h-5 text-primary mr-2" />
                    กำหนดค่าแพ็กเกจแดชบอร์ดของท่าน (Dashboard Configurator)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Select License Tier */}
                    <div className="space-y-3 col-span-2">
                        <Label className="text-sm font-semibold text-gray-300">ขั้นตอนที่ 1: เลือกระดับความเร็วแดชบอร์ด</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${selectedTier === 'free' ? 'border-green-500 bg-green-500/5' : 'border-border bg-black/20 hover:border-border/80'}`}>
                                <input type="radio" name="tier" checked={selectedTier === 'free'} onChange={() => setSelectedTier('free')} className="sr-only" />
                                <span className="font-bold text-white text-base">Free Tier</span>
                                <span className="text-[10px] text-muted-foreground mt-1">ซิงก์ข้อมูลห่าง 30 วินาที หน้าบอร์ดแสดงผลสีเทา</span>
                                <span className="font-bold text-green-500 mt-3 text-sm">฿0 ตลอดชีพ</span>
                            </label>
                            <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${selectedTier === 'pro' ? 'border-primary bg-primary/5' : 'border-border bg-black/20 hover:border-border/80'}`}>
                                <input type="radio" name="tier" checked={selectedTier === 'pro'} onChange={() => {
                                    setSelectedTier('pro');
                                    // Pro auto selects pixel farm
                                    if (!selectedSkins.includes('pixel_farm')) {
                                        setSelectedSkins(prev => [...prev, 'pixel_farm']);
                                    }
                                }} className="sr-only" />
                                <span className="font-bold text-white text-base">Pro Tier</span>
                                <span className="text-[10px] text-muted-foreground mt-1">ซิงก์ข้อมูลเร็ว 20 วินาที ปลดล็อกแสดงออเดอร์เรียลไทม์สีสันสดใส</span>
                                <span className="font-bold text-primary mt-3 text-sm">฿1,590 {(ibStatus === 'approved') && <span className="text-[10px] text-green-500 block">(สิทธิ์ IB ขอใช้ฟรี)</span>}</span>
                            </label>
                            <label className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${selectedTier === 'max' ? 'border-accent bg-accent/5' : 'border-border bg-black/20 hover:border-border/80'}`}>
                                <input type="radio" name="tier" checked={selectedTier === 'max'} onChange={() => setSelectedTier('max')} className="sr-only" />
                                <span className="font-bold text-white text-base">Max Tier</span>
                                <span className="text-[10px] text-muted-foreground mt-1">ซิงก์ข้อมูลเร็วสุด 10 วินาที ปลดล็อกครบทุกหน้าธีมบอร์ดและระบบการเตือน</span>
                                <span className="font-bold text-accent mt-3 text-sm">฿4,990</span>
                            </label>
                        </div>
                    </div>

                    {/* Order Summary & Pricing */}
                    <div className="bg-black/30 border border-border/50 rounded-xl p-4 flex flex-col justify-between space-y-4">
                        <div>
                            <span className="text-xs text-muted-foreground font-semibold block mb-2 uppercase">สรุปราคาสินค้า</span>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">แดชบอร์ดสิทธิ์ระดับ {selectedTier.toUpperCase()}</span>
                                    <span className="font-bold text-white">
                                        {selectedTier === 'free' ? '฿0' : selectedTier === 'pro' ? ((ibStatus === 'approved') ? '฿0 (IB ฟรี)' : '฿1,590') : '฿4,990'}
                                    </span>
                                </div>
                                {selectedSkins.filter(s => s !== 'spaceship').map(skinId => {
                                    const skin = SKINS.find(s => s.id === skinId);
                                    if (!skin) return null;
                                    // check if included in current package for free
                                    const isFree = (selectedTier === 'pro' && skinId === 'pixel_farm') || (selectedTier === 'max');
                                    return (
                                        <div key={skinId} className="flex justify-between">
                                            <span className="text-muted-foreground">+ สกิน {skin.name.split(' ')[0]}</span>
                                            <span className="font-bold text-white">{isFree ? '฿0 (แถมฟรี)' : `฿${skin.price}`}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="border-t border-border/30 pt-3">
                            <div className="flex justify-between items-baseline mb-2">
                                <span className="text-xs text-muted-foreground font-semibold">ยอดรวมทั้งสิ้น:</span>
                                <span className="text-2xl font-bold text-primary">฿{calculateTotal().toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* IB Status Panel Details */}
                {selectedTier === 'pro' && ibStatus === 'approved' && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm flex flex-col gap-2">
                        <span className="font-semibold text-primary flex items-center gap-1.5">
                            <Check className="w-4 h-4" /> สิทธิพิเศษ IB ได้รับการอนุมัติแล้ว
                        </span>
                        <p className="text-xs text-muted-foreground">คุณสามารถกดขอใช้งานระดับ Pro สิทธิ์ IB ฟรีได้ทันทีโดยไม่ต้องจ่ายเงินเพิ่ม</p>
                        {approvedBrokersList.length > 1 && (
                            <div className="mt-1">
                                <label className="text-xs text-muted-foreground block mb-1">เลือกโบรกเกอร์ IB ที่ต้องการใช้สิทธิ์:</label>
                                <select 
                                    className="bg-black/40 border border-border text-white text-xs p-1.5 rounded-lg w-48"
                                    value={selectedIbBroker}
                                    onChange={(e) => setSelectedIbBroker(e.target.value)}
                                >
                                    {approvedBrokersList.map(broker => (
                                        <option key={broker} value={broker}>{broker}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {/* Enter Port Details */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-300">ขั้นตอนที่ 2: ระบุหมายเลขพอร์ต MT5 ของท่าน</Label>
                    <div className="max-w-md">
                        <Input
                            placeholder="Ex. 97021489"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                            className="bg-black/50 border-border text-lg font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">หมายเลขพอร์ตนี้นำไปผูกกับไฟล์ EA EAE_Monitor เพื่ออนุญาตการซิงก์ข้อมูลขึ้นบอร์ด</p>
                    </div>
                </div>

                {/* Risk Acceptance */}
                <div className="flex items-start gap-2 text-xs text-muted-foreground pt-2">
                    <input 
                        type="checkbox" 
                        id="risk_check" 
                        checked={riskAccepted}
                        onChange={(e) => setRiskAccepted(e.target.checked)}
                        className="mt-0.5 rounded border-border accent-primary" 
                    />
                    <label htmlFor="risk_check" className="cursor-pointer select-none">
                        ฉันยอมรับความเสี่ยงในการลงทุนและเข้าใจว่าโปรแกรมเป็นเพียงสื่อกลางแสดงผลข้อมูลของระบบพอร์ตเทรดส่วนตัว
                    </label>
                </div>

                {/* Submit Checkout Button */}
                <Button 
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-black hover:from-amber-400 hover:to-orange-500 font-bold h-12 text-base shadow-lg"
                    disabled={loading}
                    onClick={handleCheckout}
                >
                    {loading ? 'กำลังดำเนินรายการ...' : selectedTier === 'free' && calculateTotal() === 0 ? 'เปิดใช้งานและดาวน์โหลดฟรี' : 'ดำเนินการชำระเงิน'}
                </Button>
            </div>
        </div>
    );
}
