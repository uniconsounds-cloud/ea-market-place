'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Users, Wallet, TrendingUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface AffiliateUser {
    id: string;
    full_name: string;
    email: string;
    referral_code: string;
    commission_rate: number;
    accumulated_commission: number;
    ib_status: string;
}

export default function AffiliateClient({ user }: { user: AffiliateUser }) {
    const [referralLink, setReferralLink] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && user.referral_code) {
            setReferralLink(`${window.location.origin}/?ref=${user.referral_code}`);
        }
    }, [user.referral_code]);

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        toast.success('คัดลอกลิ้งค์สำเร็จ');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                    ระบบแนะนำเพื่อน (Affiliate)
                </h1>
                <p className="text-muted-foreground mt-2">
                    แชร์ลิ้งค์ของคุณเพื่อรับส่วนแบ่ง {user.commission_rate}% จากยอดเช่า EA ของผู้ที่สมัครผ่านลิ้งค์ของคุณ
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Cards */}
                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-accent" />
                            รายได้สะสม
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white">
                            ฿{Number(user.accumulated_commission || 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">อัพเดทล่าสุดเมื่อมีการอนุมัติยอดเช่า</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" />
                            อัตราส่วนแบ่ง
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-white">
                            {user.commission_rate || 2}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">จากยอดชำระจริงทุกบิล</p>
                    </CardContent>
                </Card>

                <Card className="bg-card/50 border-border/50 md:col-span-1 border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            รหัสผู้แนะนำของคุณ
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-mono font-bold text-white">
                            {user.referral_code || '-'}
                        </div>
                        {user.ib_status === 'approved' && (
                            <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> คุณเป็นพาร์ทเนอร์ IB
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-card border-border shadow-lg">
                <CardHeader>
                    <CardTitle>ลิ้งค์แนะนำเพื่อนของคุณ</CardTitle>
                    <CardDescription>
                        คัดลอกลิ้งค์นี้ไปแชร์ให้เพื่อนสมัครสมาชิก เมื่อเพื่อนเช่า EA คุณจะได้รับส่วนแบ่งทันที
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            value={referralLink}
                            readOnly
                            className="bg-muted/50 font-mono text-sm"
                        />
                        <Button
                            onClick={handleCopy}
                            className="shrink-0 w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    คัดลอกแล้ว
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 mr-2" />
                                    คัดลอกลิ้งค์
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Note: In the future, we can add a table here to show recent commissions or list of invited users */}
        </div>
    );
}
