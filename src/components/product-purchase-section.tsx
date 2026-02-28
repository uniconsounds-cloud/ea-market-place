'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Zap, Check, AlertCircle, Loader2 } from 'lucide-react';
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
    const [selectedType, setSelectedType] = useState<'monthly' | 'quarterly' | 'lifetime'>('lifetime');
    const [accountNumber, setAccountNumber] = useState('');
    const [riskAccepted, setRiskAccepted] = useState(false);
    const [loading, setLoading] = useState(false);

    // New State for active licenses and pending orders
    const [userLicenses, setUserLicenses] = useState<any[]>([]);
    const [userOrders, setUserOrders] = useState<any[]>([]);
    const [isRenewal, setIsRenewal] = useState(false);

    // IB Status
    const [ibStatus, setIbStatus] = useState<'none' | 'pending' | 'approved' | 'rejected' | 'expired'>('none');
    const [ibAccountNumber, setIbAccountNumber] = useState<string | null>(null);
    const [useIbQuota, setUseIbQuota] = useState(true);

    // Fetch user licenses and orders on mount
    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // 1. Fetch Active Licenses
                const { data: licenses } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('is_active', true);

                if (licenses) setUserLicenses(licenses);

                // 2. Fetch Pending Orders
                const { data: orders } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('status', 'pending');

                if (orders) setUserOrders(orders);

                // 3. Fetch IB Status
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('ib_status, ib_account_number')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setIbStatus(profile.ib_status as any);
                    setIbAccountNumber(profile.ib_account_number);
                    if (profile.ib_status === 'approved' && profile.ib_account_number) {
                        setAccountNumber(profile.ib_account_number);
                    }
                }
            }
        };
        fetchData();
    }, [product.id]);

    // Helper for date formatting
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const calculateNewExpiry = (currentExpiry: string, type: 'monthly' | 'quarterly' | 'lifetime') => {
        if (type === 'lifetime') return 'ตลอดชีพ';

        let startDate = new Date();
        const expiryDate = new Date(currentExpiry);

        // If current expiry is in the future, start from there
        if (expiryDate > startDate) {
            startDate = expiryDate;
        }

        const newDate = new Date(startDate);
        if (type === 'monthly') {
            newDate.setMonth(newDate.getMonth() + 1);
        } else if (type === 'quarterly') {
            newDate.setMonth(newDate.getMonth() + 3);
        }

        return formatDate(newDate.toISOString());
    };

    // Check if entered account number matches an existing license
    useEffect(() => {
        const existing = userLicenses.find(l => l.account_number === accountNumber.trim());
        setIsRenewal(!!existing);
    }, [accountNumber, userLicenses]);


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

            // 0. Check for duplicate License GLOBAL (Prevent hijacking active ports)
            // Query for ANY active license with this account number (ANY PRODUCT)
            const { data: globalLicenses } = await supabase
                .from('licenses')
                .select('user_id, product_id, expiry_date')
                .eq('account_number', accountNumber.trim())
                .eq('is_active', true)
                .gte('expiry_date', new Date().toISOString()) // Only check if not expired
                .limit(1);

            const globalLicense = globalLicenses?.[0];

            if (globalLicense) {
                // If license exists
                if (!user || (globalLicense.user_id !== user.id) || (globalLicense.product_id !== product.id)) {
                    // Block if: not logged in OR logged in but user ID doesn't match OR product doesn't match
                    // This means you cannot use the same port for a DIFFERENT product, or by a DIFFERENT user.
                    alert('หมายเลขพอร์ตนี้ถูกใช้งานแล้วและยังไม่หมดอายุ ไม่สามารถใช้ซ้ำได้');
                    setLoading(false);
                    return;
                }
            }

            if (user) {
                // 1. Check for duplicate License (SKIP IF RENEWAL)
                if (!isRenewal) {
                    const { data: existingLicense } = await supabase
                        .from('licenses')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('product_id', product.id)
                        .eq('account_number', accountNumber.trim())
                        .single();

                    if (existingLicense) {
                        alert('คุณมี License สำหรับหมายเลขพอร์ตนี้แล้ว (สามารถเลือกต่ออายุได้)');
                        setIsRenewal(true);
                        setLoading(false);
                        return;
                    }
                }

                // 2. Check for pending/completed Order (Duplicate request in short time)
                // We might want to allow multiple pending orders if they are for renewals, 
                // but generally safer to block duplicates unless status is rejected.
                const { data: existingOrder } = await supabase
                    .from('orders')
                    .select('id, status')
                    .eq('user_id', user.id)
                    .eq('product_id', product.id)
                    .eq('account_number', accountNumber.trim())
                    .eq('status', 'pending') // Only block pending
                    .maybeSingle();

                if (existingOrder) {
                    alert('คุณมีคำสั่งซื้อที่รอตรวจสอบสำหรับพอร์ตนี้แล้ว');
                    setLoading(false);
                    return;
                }
            }

            const queryParams = new URLSearchParams({
                plan: selectedType,
                accountNumber: accountNumber.trim()
            });

            if (ibStatus === 'approved' && useIbQuota && accountNumber.trim() === ibAccountNumber) {
                queryParams.append('isIbRequest', 'true');
            }

            if (!user) {
                // Not logged in
                // Encode return URL
                const returnUrl = encodeURIComponent(`/products/${product.id}?${queryParams.toString()}`);
                router.push(`/login?returnUrl=${returnUrl}`);
                return;
            }

            // Redirect to Checkout Page with params
            router.push(`/checkout/${product.id}?${queryParams.toString()}`);

        } catch (error) {
            console.error(error);
            alert('Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    // Helper for progress bar
    const calculateDaysRemaining = (expiryDate: string, type: string) => {
        if (type === 'lifetime') return 999;
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Get current license details for display
    const currentLicense = userLicenses.find(l => l.account_number === accountNumber.trim());

    return (
        <div className="p-6 rounded-xl bg-gradient-to-br from-card to-background border border-border shadow-lg space-y-6">

            {/* Active & Pending Ports Display */}
            {(userLicenses.length > 0 || userOrders.length > 0) && (
                <div className="space-y-3 mb-6 p-4 bg-muted/30 rounded-lg border border-border">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        สถานะพอร์ตของคุณ
                    </h4>
                    <div className="space-y-2">
                        {/* Active Licenses */}
                        {userLicenses.map((license) => {
                            const days = calculateDaysRemaining(license.expiry_date, license.type);
                            return (
                                <div
                                    key={`license-${license.id}`}
                                    className={`text-sm p-3 rounded-md border cursor-pointer hover:bg-muted transition-colors flex justify-between items-center ${accountNumber === license.account_number ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}
                                    onClick={() => setAccountNumber(license.account_number)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-green-500/10 p-1.5 rounded-full">
                                            <Check className="w-3 h-3 text-green-600" />
                                        </div>
                                        <div>
                                            <div className="font-mono font-bold text-base">{license.account_number}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-green-600 font-medium bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">ใช้งานได้ (Active)</span>
                                                {license.type !== 'lifetime' && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${days <= 7 ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-gray-100 text-gray-600 dark:bg-gray-800'}`}>
                                                        เหลือ {days} วัน
                                                    </span>
                                                )}
                                                {license.type === 'lifetime' && <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Lifetime</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {accountNumber === license.account_number && <Check className="w-4 h-4 text-primary" />}
                                </div>
                            );
                        })}

                        {/* Pending Orders */}
                        {userOrders.map((order) => (
                            <div
                                key={`order-${order.id}`}
                                className="text-sm p-3 rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-900/50 dark:bg-yellow-900/10 flex justify-between items-center opacity-80"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-yellow-500/10 p-1.5 rounded-full">
                                        <Loader2 className="w-3 h-3 text-yellow-600 animate-spin" />
                                    </div>
                                    <div>
                                        <div className="font-mono font-bold text-base">{order.account_number}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-yellow-700 dark:text-yellow-500 font-medium bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded">รอตรวจสอบ (Pending)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* IB User Options */}
            {ibStatus === 'approved' && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3 mb-2">
                    <h4 className="font-semibold text-primary flex items-center gap-2">
                        <Zap className="w-4 h-4" /> สิทธิพิเศษ IB ของคุณ
                    </h4>
                    <div className="flex flex-col gap-2 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors border border-transparent has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                            <input
                                type="radio"
                                name="ib_choice"
                                checked={useIbQuota}
                                onChange={() => {
                                    setUseIbQuota(true);
                                    if (ibAccountNumber) setAccountNumber(ibAccountNumber);
                                }}
                                className="accent-primary"
                            />
                            <span>ขอสิทธิ์ใช้งานฟรี (บัญชี IB: {ibAccountNumber})</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors border border-transparent has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5">
                            <input
                                type="radio"
                                name="ib_choice"
                                checked={!useIbQuota}
                                onChange={() => {
                                    setUseIbQuota(false);
                                    if (accountNumber === ibAccountNumber) setAccountNumber('');
                                }}
                                className="accent-primary"
                            />
                            <span>เช่า/ซื้อ ปกติ (สำหรับบัญชีอื่น)</span>
                        </label>
                    </div>
                </div>
            )}

            {/* Account Number Input */}
            <div className="space-y-2">
                <Label htmlFor="accountNumber" className="text-base font-semibold">
                    หมายเลขพอร์ต (Account Number) <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                    <Input
                        id="accountNumber"
                        placeholder="Ex. 12345678"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        disabled={ibStatus === 'approved' && useIbQuota}
                        className={`bg-background/50 border-input font-mono text-lg ${isRenewal ? 'border-green-500 ring-1 ring-green-500/50' : ''}`}
                    />
                    {isRenewal && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-500 font-medium flex items-center gap-1 bg-background px-2">
                            <Check className="w-3 h-3" /> ต่ออายุ
                        </div>
                    )}
                </div>

                {/* Renewal Info Display */}
                {isRenewal && currentLicense && (
                    <div className="grid grid-cols-2 gap-2 mt-2 p-3 bg-muted/40 rounded-lg border border-dashed border-border text-xs">
                        <div>
                            <span className="text-muted-foreground block mb-0.5">วันหมดอายุปัจจุบัน:</span>
                            <span className="font-semibold text-foreground">
                                {currentLicense.type === 'lifetime' ? 'ตลอดชีพ' : formatDate(currentLicense.expiry_date)}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-muted-foreground block mb-0.5">หมดอายุหลังต่ออายุ:</span>
                            <span className="font-bold text-green-600 dark:text-green-500">
                                {calculateNewExpiry(currentLicense.expiry_date, selectedType)}
                            </span>
                        </div>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    ระบุหมายเลขบัญชีเทรดที่ต้องการใช้งาน (1 หมายเลข)
                </p>
            </div>

            {/* License Type Selection */}
            <div>
                <h3 className="text-lg font-bold mb-4">เลือกรูปแบบลิขสิทธิ์</h3>
                <div className="grid grid-cols-1 gap-3 mb-6">
                    {/* Monthly Option */}
                    <div
                        className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'monthly' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background/50 hover:border-primary/50'}`}
                        onClick={() => setSelectedType('monthly')}
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedType === 'monthly' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                                    {selectedType === 'monthly' && <div className="w-2 h-2 bg-black rounded-full" />}
                                </div>
                                <div>
                                    <span className={`font-semibold block ${selectedType === 'monthly' ? 'text-primary' : ''}`}>รายเดือน (1 Month)</span>
                                    <span className="text-xs text-muted-foreground">เหมาะสำหรับทดลองใช้</span>
                                </div>
                            </div>
                            <div className="text-xl font-bold">฿{product.price_monthly?.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Quarterly Option */}
                    {product.price_quarterly && (
                        <div
                            className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'quarterly' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border bg-background/50 hover:border-primary/50'}`}
                            onClick={() => setSelectedType('quarterly')}
                        >
                            {/* Best Value Tag for Quarterly if needed */}
                            <div className="absolute -top-2 right-4 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                แนะนำ
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedType === 'quarterly' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                                        {selectedType === 'quarterly' && <div className="w-2 h-2 bg-black rounded-full" />}
                                    </div>
                                    <div>
                                        <span className={`font-semibold block ${selectedType === 'quarterly' ? 'text-primary' : ''}`}>ราย 3 เดือน (Quarterly)</span>
                                        <span className="text-xs text-muted-foreground">ประหยัดกว่ารายเดือน</span>
                                    </div>
                                </div>
                                <div className="text-xl font-bold">฿{product.price_quarterly?.toLocaleString()}</div>
                            </div>
                        </div>
                    )}

                    {/* Lifetime Option */}
                    <div
                        className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${selectedType === 'lifetime' ? 'border-accent bg-accent/10 ring-1 ring-accent' : 'border-accent/30 bg-accent/5 hover:bg-accent/10'}`}
                        onClick={() => setSelectedType('lifetime')}
                    >
                        <div className="absolute -top-3 right-4 bg-accent text-black text-xs font-bold px-2 py-0.5 rounded-full shadow-lg shadow-yellow-500/20">
                            คุ้มค่าที่สุด
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedType === 'lifetime' ? 'border-accent bg-accent' : 'border-muted-foreground'}`}>
                                    {selectedType === 'lifetime' && <div className="w-2 h-2 bg-black rounded-full" />}
                                </div>
                                <div>
                                    <span className={`font-semibold block ${selectedType === 'lifetime' ? 'text-accent' : 'text-accent/80'}`}>ถาวร (Lifetime)</span>
                                    <span className="text-xs text-muted-foreground">จ่ายครั้งเดียว ใช้ได้ตลอดชีพ</span>
                                </div>
                            </div>
                            <div className="text-2xl font-bold text-accent gold-glow">฿{product.price_lifetime?.toLocaleString()}</div>
                        </div>
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
                        ทาง EA Easy Shop ไม่รับผิดชอบต่อความเสียหายใดๆ ที่เกิดขึ้นจากการใช้งานซอฟต์แวร์นี้ การตัดสินใจลงทุนเป็นความรับผิดชอบของผู้ใช้งานแต่เพียงผู้เดียว
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
                className={`w-full text-base font-semibold shadow-xl transition-all duration-300 ${isRenewal ? 'bg-green-600 hover:bg-green-700 shadow-green-900/20' : ibStatus === 'approved' && useIbQuota ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20' : 'shadow-blue-900/20'}`}
                onClick={handlePurchase}
                disabled={loading}
            >
                {loading ? 'กำลังดำเนินการ...' : isRenewal ? 'ต่ออายุ License (Renew)' : ibStatus === 'approved' && useIbQuota ? 'ขอรับสิทธิ์ใช้งานฟรี (0 ฿)' : 'ดำเนินการต่อ'}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" />
                ชำระเงินปลอดภัยผ่าน QR Code รับสินค้าทันที
            </p>
        </div>
    );
}
