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

export function ProductPurchaseSection({ product }: ProductPurchaseSectionProps) {
    const router = useRouter();
    const [selectedType, setSelectedType] = useState<'monthly' | 'lifetime'>('lifetime');
    const [accountNumber, setAccountNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePurchase = async () => {
        if (!accountNumber.trim()) {
            alert('กรุณากรอกหมายเลขพอร์ต (Account Number)');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

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
