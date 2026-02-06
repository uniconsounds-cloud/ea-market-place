'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

interface ProductPurchaseSectionProps {
    product: any;
}

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Checkbox } from '@/components/ui/checkbox';

export function ProductPurchaseSection({ product }: ProductPurchaseSectionProps) {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<'monthly' | 'lifetime'>('lifetime');
    const [accountNumber, setAccountNumber] = useState('');
    const [riskAccepted, setRiskAccepted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handlePurchase = async () => {
        if (!accountNumber.trim()) {
            alert('กรุณากรอกหมายเลขพอร์ต (Account Number)');
            return;
        }

        if (!riskAccepted) {
            alert('กรุณายอมรับความเสี่ยงและข้อตกลงก่อนดำเนินการต่อ');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // 1. Check for duplicate License
                const { data: existingLicense } = await supabase
                    .from('licenses')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('account_number', accountNumber.trim())
                    .single();

                if (existingLicense) {
                    alert('คุณมี License สำหรับหมายเลขพอร์ตนี้แล้ว');
                    setLoading(false);
                    return;
                }

                // 2. Check for pending/completed Order (Duplicate request)
                const { data: existingOrder } = await supabase
                    .from('orders')
                    .select('id, status')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('account_number', accountNumber.trim())
                    .in('status', ['pending', 'completed']) // Check both pending and completed
                    .maybeSingle();

                if (existingOrder) {
                    const msg = existingOrder.status === 'pending'
                        ? 'คุณมีคำสั่งซื้อที่รอตรวจสอบสำหรับพอร์ตนี้แล้ว'
                        : 'คุณได้ซื้อสินค้านี้สำหรับพอร์ตนี้ไปแล้ว';
                    alert(msg);
                    setLoading(false);
                    return;
                }
            }

            const queryParams = new URLSearchParams({
                plan: selectedType,
                accountNumber: accountNumber.trim()
            }).toString();

            if (!user) {
                // Not logged in
                // Encode return URL
                const returnUrl = encodeURIComponent(`/products/${product.id}?${queryParams}`);
                router.push(`/login?returnUrl=${returnUrl}`);
                return;
            }

            // Redirect to Checkout Page with params
            router.push(`/checkout/${product.id}?${queryParams}`);

        } catch (error) {
            console.error(error);
            alert('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 rounded-xl bg-gradient-to-br from-card to-background border border-border shadow-lg space-y-6">

            {/* Account Number Input */}
            <div className="space-y-2">
                <Label htmlFor="accountNumber" className="text-base font-semibold">
                    หมายเลขพอร์ต (Account Number) <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="accountNumber"
                    placeholder="Ex. 12345678"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="bg-background/50 border-input font-mono text-lg"
                />
                <p className="text-xs text-muted-foreground">
                    ระบุหมายเลขบัญชีเทรดที่ต้องการใช้งาน (1 หมายเลข)
                </p>
            </div>

            {/* License Type Selection */}
            <div>
                <h3 className="text-lg font-bold mb-4">เลือกรูปแบบลิขสิทธิ์</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {/* Monthly Option */}
                    <div
                        className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'monthly' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background/50 hover:border-primary/50'}`}
                        onClick={() => setSelectedType('monthly')}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className={`font-semibold ${selectedType === 'monthly' ? 'text-primary' : ''}`}>รายเดือน</span>
                            {selectedType === 'monthly' ? <Check className="w-4 h-4 text-primary" /> : <Zap className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div className="text-2xl font-bold">฿{product.price_monthly.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">ชำระทุกเดือน ยกเลิกได้ตลอดเวลา</p>
                    </div>

                    {/* Lifetime Option */}
                    <div
                        className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'lifetime' ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-accent/30 bg-accent/5 hover:bg-accent/10'}`}
                        onClick={() => setSelectedType('lifetime')}
                    >
                        <div className="absolute -top-3 right-4 bg-accent text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-yellow-500/20">
                            คุ้มค่าที่สุด
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className={`font-semibold ${selectedType === 'lifetime' ? 'text-accent' : 'text-accent/80'}`}>ถาวร (Lifetime)</span>
                            {selectedType === 'lifetime' ? <Check className="w-4 h-4 text-accent" /> : <Zap className="w-4 h-4 text-accent" />}
                        </div>
                        <div className="text-2xl font-bold text-accent gold-glow">฿{product.price_lifetime.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">จ่ายครั้งเดียว ใช้ได้ตลอดชีพ</p>
                    </div>
                </div>
            </div>

            {/* Risk Disclosure Section */}
            <div className="space-y-4 pt-4 border-t border-border">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 h-32 overflow-y-auto text-xs text-muted-foreground">
                    <h4 className="font-bold text-destructive mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> คำเตือนความเสี่ยง (Risk Disclosure)
                    </h4>
                    <p className="mb-2">
                        การลงทุนในตลาด Forex และการใช้งาน Expert Advisor (EA) มีความเสี่ยงสูง ผู้ลงทุนอาจสูญเสียเงินลงทุนทั้งหมด ผลการดำเนินงานในอดีตมิได้เป็นสิ่งยืนยันถึงผลการดำเนินงานในอนาคต
                    </p>
                    <p className="mb-2">
                        ผู้ใช้งานควรทำความเข้าใจลักษณะสินค้า เงื่อนไขผลตอบแทน และความเสี่ยงก่อนตัดสินใจลงทุน
                        ทาง EA Market Place ไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดขึ้นจากการใช้งานซอฟต์แวร์นี้ การตัดสินใจลงทุนเป็นความรับผิดชอบของผู้ใช้งานแต่เพียงผู้เดียว
                    </p>
                    <p>
                        การซื้อ License เป็นการซื้อสิทธิ์การใช้งานซอฟต์แวร์เท่านั้น ไม่ใช่การระดมทุนหรือการการันตีผลกำไร
                    </p>
                </div>

                <div className="flex items-start space-x-3 p-2">
                    <Checkbox
                        id="risk-agreement"
                        checked={riskAccepted}
                        onCheckedChange={(checked) => setRiskAccepted(checked as boolean)}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label
                            htmlFor="risk-agreement"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                            ข้าพเจ้าได้อ่านและยอมรับความเสี่ยง รวมถึงข้อตกลงในการใช้งาน
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            คุณต้องยอมรับข้อตกลงก่อนดำเนินการต่อ
                        </p>
                    </div>
                </div>
            </div>

            <Button
                size="lg"
                className="w-full text-base font-semibold shadow-xl shadow-blue-900/20"
                onClick={handlePurchase}
                disabled={loading}
            >
                {loading ? 'กำลังดำเนินการ...' : 'ดำเนินการต่อ'}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                ชำระเงินปลอดภัยผ่าน QR Code รับสินค้าทันที
            </p>
        </div>
    );
}
