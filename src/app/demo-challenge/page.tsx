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
    
    const [selectedRisk, setSelectedRisk] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [hasJoined, setHasJoined] = useState(false);

    // Intelligent rotation for recommended risk based on today's signups
    useEffect(() => {
        const getRecommendation = async () => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const { count } = await supabase
                    .from('demo_challenges')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', today.toISOString());
                
                const num = count || 0;
                const risks = [1.0, 1.5, 2.0];
                setSelectedRisk(risks[num % 3]);
            } catch (e) {
                setSelectedRisk(1.0);
            }
        };

        getRecommendation();
        checkAuthAndStatus();
    }, []);

    const checkAuthAndStatus = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setUser(session.user);
            // Check if they already joined
            const { data } = await supabase
                .from('demo_challenges')
                .select('id, risk_level')
                .eq('user_id', session.user.id)
                .single();
                
            if (data) {
                setHasJoined(true);
                setSelectedRisk(Number(data.risk_level));
            }
        }
    };

    const handleJoin = async () => {
        if (!selectedRisk) return;

        // If not logged in, redirect to login with ref
        if (!user) {
            const ref = searchParams.get('ref') || '';
            toast("กรุณาเข้าสู่ระบบก่อน", {
                description: "ระบบกำลังพาท่านไปหน้าเข้าสู่ระบบ...",
            });
            setTimeout(() => {
                router.push(`/login?redirect=/demo-challenge&ref=${ref}`);
            }, 1500);
            return;
        }

        try {
            setLoading(true);
            const ref = searchParams.get('ref');
            
            // Sub-randomize the risk level (e.g. 1.0 -> 1.00, 1.05, 1.10, 1.15, 1.20)
            const offsets = [0, 0.05, 0.10, 0.15, 0.20];
            const randomOffset = offsets[Math.floor(Math.random() * offsets.length)];
            const finalRisk = parseFloat((selectedRisk + randomOffset).toFixed(2));
            
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
                risk_level: finalRisk,
                current_balance: 10000, // 10,000 USC = $100
                referrer_id: finalReferrerId
            };

            const { error } = await supabase
                .from('demo_challenges')
                .insert([payload]);

            if (error) {
                if (error.code === '23505') { // Unique violation
                    toast("คุณได้เข้าร่วมแคมเปญไปแล้ว", {
                        description: "กำลังพาท่านไปหน้าฟาร์มจำลอง...",
                    });
                    setTimeout(() => router.push('/farm/demo'), 1000);
                    return;
                }
                throw error;
            }

            toast.success("เข้าร่วมแคมเปญสำเร็จ! 🎉", {
                description: "ยินดีต้อนรับสู่ $100 Demo Challenge ระบบกำลังพาท่านไปดูฟาร์ม...",
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

    const riskOptions = [
        {
            value: 1.0,
            title: "สายเซฟ (Safe)",
            desc: "เน้นความปลอดภัย โตเรื่อยๆ ไม่เสียวมาก",
            icon: <Shield className="w-8 h-8 text-green-500 mb-2" />,
            color: "border-green-500",
            bg: "bg-green-500/10",
            multiplierText: "x1.0 - 1.2"
        },
        {
            value: 1.5,
            title: "สายเติบโต (Growth)",
            desc: "สายปานกลาง กำไรกำลังดี เหมาะสำหรับนักลงทุนทั่วไป",
            icon: <TrendingUp className="w-8 h-8 text-yellow-500 mb-2" />,
            color: "border-yellow-500",
            bg: "bg-yellow-500/10",
            multiplierText: "x1.5 - 1.7"
        },
        {
            value: 2.0,
            title: "สายซิ่ง (Risky)",
            desc: "กำไรมาไว โตเร็วที่สุด แต่ถ้าเจอกราฟลากก็ต้องใจแข็ง!",
            icon: <Zap className="w-8 h-8 text-red-500 mb-2" />,
            color: "border-red-500",
            bg: "bg-red-500/10",
            multiplierText: "x2.0 - 2.2"
        }
    ];

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center py-16 px-4">
            <div className="max-w-4xl w-full space-y-8 text-center">
                
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600">
                        $100 Demo Challenge
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        จำลองการมีทุน 100 เหรียญและดูมันเติบโตไปพร้อมกับ Master Port ของเรา! 
                        เลือกระดับความเสี่ยงของคุณแล้วมาดูกันว่าสัปดาห์หน้าคุณจะปั้นได้เท่าไหร่
                    </p>
                </div>

                {hasJoined ? (
                    <Card className="max-w-md mx-auto border-orange-500/50 bg-slate-900">
                        <CardHeader>
                            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <CardTitle className="text-2xl text-center">คุณเข้าร่วมแคมเปญแล้ว!</CardTitle>
                            <CardDescription className="text-center">
                                คุณเลือกระดับความเสี่ยง {selectedRisk === 1.0 ? 'สายเซฟ' : selectedRisk === 1.5 ? 'สายเติบโต' : 'สายซิ่ง'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex justify-center">
                            <Button 
                                size="lg" 
                                className="w-full text-lg bg-orange-600 hover:bg-orange-700"
                                onClick={() => router.push('/farm/demo')}
                            >
                                เข้าดูฟาร์มของฉันตอนนี้
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid md:grid-cols-3 gap-6 pt-8">
                            {riskOptions.map((option) => (
                                <Card 
                                    key={option.value}
                                    className={`relative cursor-pointer transition-all hover:-translate-y-1 ${
                                        selectedRisk === option.value 
                                            ? `${option.color} ${option.bg} border-2 shadow-[0_0_20px_rgba(249,115,22,0.3)]` 
                                            : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                                    }`}
                                    onClick={() => setSelectedRisk(option.value)}
                                >
                                    {selectedRisk === option.value && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                            ระบบแนะนำ
                                        </div>
                                    )}
                                    <CardHeader className="text-center pb-2">
                                        <div className="flex justify-center">{option.icon}</div>
                                        <CardTitle className="text-xl">{option.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="text-center text-sm text-muted-foreground">
                                        <p>{option.desc}</p>
                                        <div className="mt-4 font-mono text-lg font-bold text-foreground">
                                            ตัวคูณ {option.multiplierText}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="pt-12 flex justify-center">
                            <Button 
                                size="lg" 
                                className="px-12 py-6 text-xl rounded-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-xl shadow-orange-500/20"
                                onClick={handleJoin}
                                disabled={loading || !selectedRisk}
                            >
                                {loading ? (
                                    "กำลังเข้าร่วม..."
                                ) : !user ? (
                                    <>
                                        <LogIn className="mr-2 h-6 w-6" /> เข้าสู่ระบบเพื่อเข้าร่วม
                                    </>
                                ) : (
                                    "เริ่ม $100 Demo Challenge เลย!"
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
