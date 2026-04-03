'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { User, ShieldCheck, Check, Info, AlertTriangle } from 'lucide-react';
import { ROOT_ADMINS } from '@/lib/constants';
import { toast } from 'sonner';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [referralData, setReferralData] = useState<{ code: string, name: string } | null>(null);
    const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
    const [adminProfiles, setAdminProfiles] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        const fetchReferrerAndAdmins = async () => {
            // 1. Check for existing referral code
            const getCookie = (name: string) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
                return null;
            };

            const refCode = getCookie('affiliate_ref') || (typeof window !== 'undefined' ? localStorage.getItem('affiliate_ref') : null);

            if (refCode) {
                const { data } = await supabase
                    .from('profiles')
                    .select('referral_code, full_name')
                    .eq('referral_code', refCode)
                    .single();
                
                if (data) {
                    setReferralData({ code: data.referral_code, name: data.full_name });
                }
            }

            // 2. Fetch the 2 Root Admins to get their current Referral Codes
            const { data: admins } = await supabase
                .from('profiles')
                .select('id, email, full_name, referral_code')
                .in('email', ROOT_ADMINS.map(a => a.email));
            
            if (admins) {
                setAdminProfiles(admins);
            }
        };

        fetchReferrerAndAdmins();
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let refCodeSetting = referralData?.code || selectedAdmin;

            if (!refCodeSetting) {
                setError("กรุณาเลือกผู้แนะนำเพื่อสมัครสมาชิก");
                setLoading(false);
                return;
            }

            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        referred_by_code: refCodeSetting,
                    },
                },
            });

            if (error) {
                throw error;
            }

            // Check if email confirmation is required (default in Supabase)
            alert("สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีของคุณ");
            router.push('/login');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            // Extract referral code from cookie if it exists
            const getCookie = (name: string) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
                return null;
            };

            const refCode = getCookie('affiliate_ref') || localStorage.getItem('affiliate_ref');

            // To pass metadata with OAuth, we have to store it locally before redirect
            // or pass it via queryParams (though Supabase strips some custom params).
            // A more reliable way is to let the callback process the cookie, OR pass it here:
            if (refCode) {
                // We'll set a local storage item just in case the cookie is lost
                localStorage.setItem('pending_affiliate_ref', refCode);
            }

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="glass-card w-full max-w-md p-8 rounded-xl border border-border shadow-2xl relative overflow-hidden group">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-gold/10 rounded-full blur-3xl group-hover:bg-gold/20 transition-all duration-500"></div>
                    
                    <div className="text-center mb-8 relative">
                        <h1 className="text-2xl font-bold mb-2">สร้างบัญชีใหม่</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed">ร่วมเป็นส่วนหนึ่งของสังคมนักเทรด และรับการดูแลจากผู้เชี่ยวชาญ</p>
                    </div>

                    {/* Referrer Section */}
                    <div className="mb-8 space-y-4 relative">
                        {referralData ? (
                            <div className="bg-green-500/5 border border-green-500/20 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center text-green-600">
                                        <Check className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-green-600/70 font-bold uppercase tracking-wider">ผู้แนะนำของคุณ</p>
                                        <p className="font-bold text-foreground">{referralData.name}</p>
                                    </div>
                                </div>
                                <div className="text-[10px] text-muted-foreground/50 italic px-2">
                                    สมัครผ่านลิงก์
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Info className="w-4 h-4 text-gold" />
                                    <p className="text-sm font-semibold">กรุณาเลือกผู้แนะนำ (Mentor)</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {(adminProfiles.length > 0 ? adminProfiles : ROOT_ADMINS).map((admin) => (
                                        <button
                                            key={admin.email}
                                            type="button"
                                            onClick={() => setSelectedAdmin(admin.referral_code || admin.email)}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center group ${
                                                selectedAdmin === (admin.referral_code || admin.email)
                                                ? 'border-gold bg-gold/10 scale-[1.02] shadow-lg'
                                                : 'border-border bg-muted/30 hover:border-gold/30'
                                            }`}
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                                                selectedAdmin === (admin.referral_code || admin.email)
                                                ? 'bg-gold text-white'
                                                : 'bg-muted-foreground/20 text-muted-foreground'
                                            }`}>
                                                <User className="w-6 h-6" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className={`font-bold text-sm ${selectedAdmin === (admin.referral_code || admin.email) ? 'text-gold' : ''}`}>
                                                    {admin.name || admin.full_name}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground opacity-60">แอดมินใจดี</p>
                                            </div>
                                            {selectedAdmin === (admin.referral_code || admin.email) && (
                                                <div className="absolute top-2 right-2">
                                                    <ShieldCheck className="w-4 h-4 text-gold" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md mb-6 text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-4 mb-6">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full relative py-6 hover:bg-muted/50 transition-colors"
                            onClick={handleGoogleLogin}
                            disabled={!referralData && !selectedAdmin}
                        >
                            <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                            </svg>
                            สมัครด้วย Google
                        </Button>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border/50" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                                <span className="bg-background px-4 text-muted-foreground/60">
                                    หรือสมัครด้วยอีเมล
                                </span>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1" htmlFor="fullName">ชื่อ-นามสกุล</label>
                            <input
                                id="fullName"
                                type="text"
                                required
                                className="w-full h-12 rounded-xl border border-border bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 transition-all placeholder:text-muted-foreground/40"
                                placeholder="ภาษาไทยหรืออังกฤษ"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1" htmlFor="email">อีเมล</label>
                            <input
                                id="email"
                                type="email"
                                required
                                className="w-full h-12 rounded-xl border border-border bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 transition-all"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1" htmlFor="password">รหัสผ่าน</label>
                            <input
                                id="password"
                                type="password"
                                required
                                className="w-full h-12 rounded-xl border border-border bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 transition-all"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <Button type="submit" className="w-full h-12 rounded-xl mt-4 font-bold text-base shadow-lg shadow-gold/20 hover:shadow-gold/40 transition-all" variant="gold" disabled={loading || (!referralData && !selectedAdmin)}>
                            {loading ? 'กำลังสร้างบัญชี...' : 'รับสิทธิ์การใช้งานเลย'}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className="text-muted-foreground">มีบัญชีอยู่แล้ว? </span>
                        <Link href="/login" className="text-primary hover:underline font-medium">
                            เข้าสู่ระบบ
                        </Link>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}
