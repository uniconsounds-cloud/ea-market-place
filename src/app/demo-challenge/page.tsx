'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Shield, TrendingUp, Zap, LogIn, CheckCircle2 } from 'lucide-react';

function DemoChallengeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [hasJoined, setHasJoined] = useState(false);

    useEffect(() => {
        checkAuthAndStatus();
    }, []);

    const checkAuthAndStatus = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setUser(session.user);
            // Check if they already joined
            const { data } = await supabase
                .from('demo_challenges')
                .select('id')
                .eq('user_id', session.user.id)
                .single();
                
            if (data) {
                setHasJoined(true);
            }
        }
    };

    const handleJoin = async () => {
        // If not logged in, redirect to login with ref
        if (!user) {
            const ref = searchParams.get('ref') || '';
            toast("กรุณาสมัครสมาชิกก่อน", {
                description: "ระบบกำลังพาท่านไปหน้าสมัครสมาชิก...",
            });
            setTimeout(() => {
                window.location.href = `/register?redirect=/demo-challenge&ref=${ref}`;
            }, 1500);
            return;
        }

        try {
            setLoading(true);
            const ref = searchParams.get('ref');
            
            let finalReferrerId = ref || null;
            if (!finalReferrerId) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('referred_by')
                    .eq('id', user.id)
                    .single();
                if (profile && profile.referred_by) {
                    finalReferrerId = profile.referred_by;
                }
            }

            const payload = {
                user_id: user.id,
                risk_level: 1.0,
                current_balance: 100000, // 100,000 USC
                referrer_id: finalReferrerId
            };

            const { error } = await supabase
                .from('demo_challenges')
                .insert([payload]);

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toast("คุณได้เข้าร่วมโครงการไปแล้ว", {
                        description: "กำลังพาท่านไปหน้าฟาร์มติดตาม...",
                    });
                    setTimeout(() => router.push('/farm/demo'), 1000);
                    return;
                }
                throw error;
            }

            toast.success("เข้าร่วมติดตามพอร์ตสำเร็จ! 🎉", {
                description: "ยินดีต้อนรับสู่ระบบติดตามพอร์ตหลัก ระบบกำลังพาท่านไปดูฟาร์ม...",
            });
            
            setHasJoined(true);
            setTimeout(() => {
                router.push('/farm/demo');
            }, 1500);

        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", {
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center py-16 px-4">
            <div className="max-w-4xl w-full space-y-8 text-center">
                
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600">
                        EasyM Live Tracker
                    </h1>
                    <p className="text-lg md:text-xl text-amber-200/60 max-w-2xl mx-auto">
                        โครงการติดตามพอร์ตจริงแบบเรียลไทม์ (Copy Trade) ประสิทธิภาพสูง
                    </p>
                </div>

                {hasJoined ? (
                    <Card className="max-w-md mx-auto border-orange-500/50 bg-slate-900">
                        <CardHeader>
                            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <CardTitle className="text-2xl text-center">คุณเข้าร่วมติดตามพอร์ตแล้ว!</CardTitle>
                            <CardDescription className="text-center">
                                พอร์ตติดตามของคุณเริ่มต้นที่ 100,000 USC และกำลังติดตามพอร์ตจริงแบบเรียลไทม์
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex justify-center">
                            <Button 
                                size="lg" 
                                className="w-full text-lg bg-orange-600 hover:bg-orange-700"
                                onClick={() => router.push('/farm/demo')}
                            >
                                เข้าดูฟาร์มติดตามของฉันตอนนี้
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="max-w-2xl mx-auto bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-left space-y-6">
                            <h2 className="text-2xl font-bold text-orange-400 text-center border-b border-slate-800 pb-4">
                                เงื่อนไขและข้อมูลการติดตามพอร์ตหลัก
                            </h2>
                            <div className="space-y-4 text-slate-300 text-sm md:text-base">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p>
                                        <strong className="text-white">ทุนตั้งต้นสมมติ 100,000 USC:</strong> ทุกคนจะได้รับยอดเงินเริ่มต้นเท่ากัน ณ วันที่กดเข้าร่วมแคมเปญ
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p>
                                        <strong className="text-white">ระบบกำไร 1:1 สะสมรายวัน:</strong> กำไรจริงรายวันจากพอร์ตต้นแบบ (Master Port) จะถูกบวกทบเข้าบัญชีของคุณโดยตรง เสมือนว่าคุณเปิดรัน EA ตั้งแต่วันสมัคร
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p>
                                        <strong className="text-white">ดูข้อมูลเรียลไทม์ 1:1:</strong> เห็นข้อมูลออเดอร์ ล็อต และผลการรันพอร์ตจริงแบบเรียลไทม์ผ่านกราฟิกหน้าฟาร์มติดตาม
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p>
                                        <strong className="text-white">ศึกษาผลงานย้อนหลัง 60 วัน:</strong> มีฟังก์ชันแยกสำหรับตรวจสอบสถิติผลงานพอร์ตต้นแบบย้อนหลัง 60 วัน เพื่อการเรียนรู้เชิงลึก
                                    </p>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                    <p>
                                        <strong className="text-white">ตารางจัดอันดับความเก๋า (Leaderboard):</strong> จัดอันดับนักลงทุนที่มีกำไรสะสมสูงสุดนับจากวันที่เริ่มเข้าร่วมโครงการ
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 flex justify-center">
                            <Button 
                                size="lg" 
                                className="px-12 py-6 text-xl rounded-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-xl shadow-orange-500/20"
                                onClick={handleJoin}
                                disabled={loading}
                            >
                                {loading ? (
                                    "กำลังเข้าร่วม..."
                                ) : !user ? (
                                    <>
                                        <LogIn className="mr-2 h-6 w-6" /> สมัครสมาชิก / เข้าสู่ระบบเพื่อเข้าร่วม
                                    </>
                                ) : (
                                    "เริ่มเข้าร่วมโครงการติดตามพอร์ตหลัก!"
                                )}
                            </Button>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}

export default function DemoChallengePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">กำลังโหลดข้อมูล...</div>}>
            <DemoChallengeContent />
        </Suspense>
    );
}
