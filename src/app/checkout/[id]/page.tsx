'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, BadgeCheck, QrCode, ArrowLeft } from 'lucide-react';

export default function CheckoutPage(props: { params: Promise<{ id: string }> }) {
    // Unwrap params using React.use()
    const params = use(props.params);
    return <CheckoutContent productId={params.id} />;
}

function CheckoutContent({ productId }: { productId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initial state from URL params
    const initialPlan = (searchParams.get('plan') as 'monthly' | 'quarterly' | 'lifetime') || 'lifetime';
    const initialAccountNumber = searchParams.get('accountNumber') || '';

    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [planType, setPlanType] = useState<'monthly' | 'quarterly' | 'lifetime'>(initialPlan);
    const [accountNumber, setAccountNumber] = useState(initialAccountNumber);
    const [slipFile, setSlipFile] = useState<File | null>(null);

    useEffect(() => {
        fetchProduct(productId);
    }, [productId]);

    const fetchProduct = async (id: string) => {
        const { data } = await supabase.from('products').select('*').eq('id', id).single();
        if (data) {
            setProduct(data);
        } else {
            alert('ไม่พบสินค้า');
            router.push('/');
        }
        setLoading(false);
    };

    const handleUpload = async (userId: string) => {
        if (!slipFile) return null;
        const fileExt = slipFile.name.split('.').pop();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileName = `${userId}/${Date.now()}_${randomString}.${fileExt}`;

        try {
            const { error } = await supabase.storage.from('slips').upload(fileName, slipFile);
            if (error) throw error;
        } catch (originalError: any) {
            console.error('Upload Block Error:', originalError);
            throw new Error(`Upload failed: ${originalError.message || 'Unknown error'}`);
        }

        const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(fileName);
        return publicUrl;
    };

    const handleSubmit = async () => {
        if (!slipFile) {
            alert('กรุณาแนบสลิปโอนเงิน');
            return;
        }
        if (!accountNumber.trim()) {
            alert('กรุณากรอกหมายเลขพอร์ต (Account Number)');
            return;
        }

        setSubmitting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }

            // 1. Upload Slip
            const slipUrl = await handleUpload(user.id);

            // 2. Create Order
            const { error } = await supabase.from('orders').insert({
                user_id: user.id,
                product_id: product.id,
                amount: planType === 'monthly' ? product.price_monthly : (planType === 'quarterly' ? product.price_quarterly : product.price_lifetime),
                status: 'pending',
                slip_url: slipUrl,
                plan_type: planType,
                account_number: accountNumber.trim() // Save account number
            });

            if (error) throw error;

            alert('แจ้งชำระเงินเรียบร้อย! กรุณารอแอดมินตรวจสอบ');
            router.push('/dashboard/billing');

        } catch (error: any) {
            alert('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto px-4 py-12 max-w-2xl">
            <Link href={`/products/${productId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" />
                ย้อนกลับไปหน้ารายละเอียดสินค้า
            </Link>
            <h1 className="text-3xl font-bold mb-8 text-center">ยืนยันคำสั่งซื้อ</h1>

            <div className="grid gap-8">
                {/* Product Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle>รายการสินค้า</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gray-800 rounded-md overflow-hidden">
                            {product.image_url && <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{product.name}</h3>
                            <p className="text-sm text-muted-foreground">{product.description}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Account Number & Plan */}
                <Card>
                    <CardHeader>
                        <CardTitle>ข้อมูลการใช้งาน</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="accountNumber">หมายเลขพอร์ต (Account Number)</Label>
                            <Input
                                id="accountNumber"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                placeholder="Ex. 12345678"
                                className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground">โปรดตรวจสอบให้ถูกต้อง (ระบบจะอนุญาตให้ใช้สิทธิ์เฉพาะเลขพอร์ตนี้)</p>
                        </div>

                        <div className="space-y-2">
                            <Label>แพ็กเกจที่เลือก</Label>
                            <RadioGroup value={planType} onValueChange={(v: any) => setPlanType(v)} className={`grid gap-4 ${product.price_quarterly ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
                                <div>
                                    <RadioGroupItem value="monthly" id="monthly" className="peer sr-only" />
                                    <Label
                                        htmlFor="monthly"
                                        className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${planType === 'monthly' ? 'border-primary bg-primary/5' : ''}`}
                                    >
                                        <span className="mb-2 text-sm font-semibold">รายเดือน</span>
                                        <span className="text-xl font-bold">฿{product.price_monthly.toLocaleString()}</span>
                                    </Label>
                                </div>
                                {product.price_quarterly && (
                                    <div>
                                        <RadioGroupItem value="quarterly" id="quarterly" className="peer sr-only" />
                                        <Label
                                            htmlFor="quarterly"
                                            className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${planType === 'quarterly' ? 'border-primary bg-primary/5' : ''}`}
                                        >
                                            <span className="mb-2 text-sm font-semibold">3 เดือน</span>
                                            <span className="text-xl font-bold">฿{product.price_quarterly.toLocaleString()}</span>
                                        </Label>
                                    </div>
                                )}
                                <div className={product.price_quarterly ? "col-span-2 md:col-span-1" : ""}>
                                    <RadioGroupItem value="lifetime" id="lifetime" className="peer sr-only" />
                                    <Label
                                        htmlFor="lifetime"
                                        className={`flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary ${planType === 'lifetime' ? 'border-primary bg-primary/5' : ''}`}
                                    >
                                        <span className="mb-2 text-sm font-semibold">ถาวร (Lifetime)</span>
                                        <span className="text-xl font-bold">฿{product.price_lifetime.toLocaleString()}</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment */}
                <Card>
                    <CardHeader>
                        <CardTitle>ชำระเงิน</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center p-6 border rounded-lg bg-white/5">
                            <QrCode className="w-32 h-32 text-white mb-4" />
                            <p className="font-mono text-lg font-bold tracking-widest text-primary">SCB 123-4-56789-0</p>
                            <p className="text-sm text-muted-foreground">บริษัท ยูนิคอร์น ซาวด์ จำกัด</p>
                            <div className="mt-4 text-center">
                                <p className="text-sm">ยอดชำระ</p>
                                <p className="text-3xl font-bold text-primary">
                                    ฿{planType === 'monthly' ? product.price_monthly.toLocaleString() : (planType === 'quarterly' ? product.price_quarterly.toLocaleString() : product.price_lifetime.toLocaleString())}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>แนบหลักฐานการโอนเงิน</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setSlipFile(e.target.files?.[0] || null)}
                                />
                            </div>
                        </div>

                        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังบันทึก...
                                </>
                            ) : (
                                <>
                                    <BadgeCheck className="mr-2 h-4 w-4" /> ยืนยันการแจ้งชำระเงิน
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div >
    );
}
