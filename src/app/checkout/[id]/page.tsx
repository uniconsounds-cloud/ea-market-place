'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Upload, BadgeCheck, QrCode } from 'lucide-react';
import Image from 'next/image';

export default function CheckoutPage(props: { params: Promise<{ id: string }> }) {
    // Unwrap params using React.use() or await in async component. 
    // Since this is a client component, we need to handle the promise or just use 'useParams' from next/navigation
    // But `props.params` is a standard way in Next.js 15+ for Server Components. 
    // For Client Component, it's safer to use `useParams` hook or await props in a parent Server Component.
    // Let's make this a Client Component that fetches data, simpler for now.

    // Actually, let's use the hook for params
    return <CheckoutContent paramsPromise={props.params} />;
}

function CheckoutContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
    const router = useRouter();
    const [id, setId] = useState<string>('');
    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [planType, setPlanType] = useState<'monthly' | 'lifetime'>('lifetime');
    const [slipFile, setSlipFile] = useState<File | null>(null);

    useEffect(() => {
        paramsPromise.then((p) => {
            setId(p.id);
            fetchProduct(p.id);
        });
    }, [paramsPromise]);

    const fetchProduct = async (productId: string) => {
        const { data } = await supabase.from('products').select('*').eq('id', productId).single();
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

        // Sanitize filename to avoid "Invalid Key" errors
        const fileExt = slipFile.name.split('.').pop();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileName = `${userId}/${Date.now()}_${randomString}.${fileExt}`;

        try {
            const { data, error } = await supabase.storage.from('slips').upload(fileName, slipFile);

            if (error) {
                console.error('Upload info:', { bucket: 'slips', fileName, error });
                // If bucket not found, it gives a specific error usually.
                // "Invalid key" is usually bad chars.
                throw error;
            }
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
                amount: planType === 'monthly' ? product.price_monthly : product.price_lifetime,
                status: 'pending',
                slip_url: slipUrl,
                plan_type: planType
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

                {/* Plan Selection */}
                <Card>
                    <CardHeader>
                        <CardTitle>รูปแบบลิขสิทธิ์</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup defaultValue="lifetime" onValueChange={(v: any) => setPlanType(v)} className="grid grid-cols-2 gap-4">
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
                            <div>
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
                                    ฿{planType === 'monthly' ? product.price_monthly.toLocaleString() : product.price_lifetime.toLocaleString()}
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
        </div>
    );
}
