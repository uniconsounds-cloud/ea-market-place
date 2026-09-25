'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { User, ShieldCheck, Check, Info, AlertTriangle, Mail } from 'lucide-react';
import { ROOT_ADMINS } from '@/lib/constants';
import { toast } from 'sonner';

// Common domain typos dictionary
const COMMON_DOMAIN_TYPOS: Record<string, string> = {
    'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmaik.com': 'gmail.com',
    'gmai.co.th': 'gmail.com',
    'gmeil.com': 'gmail.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmaill.com': 'hotmail.com',
    'hitmail.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'outlock.com': 'outlook.com',
    'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'yaho.co.th': 'yahoo.com',
};

function RegisterContent() {
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [referralData, setReferralData] = useState<{ code: string, name: string } | null>(null);
    const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);
    const [adminProfiles, setAdminProfiles] = useState<any[]>([]);
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const refParam = searchParams.get('ref');
    const redirectParam = searchParams.get('redirect');

    const queryParams = new URLSearchParams();
    if (redirectParam) queryParams.set('redirect', redirectParam);
    if (refParam) queryParams.set('ref', refParam);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const finalRedirectUrl = refParam && redirectParam === '/demo-challenge'
        ? `/demo-challenge?ref=${refParam}`
        : (redirectParam || '/dashboard');

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

            // Handle ref from query param (which might be a UUID from demo-challenge link)
            if (refParam) {
                // If it looks like a UUID (length > 20)
                if (refParam.length > 20) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('referral_code, full_name')
                        .eq('id', refParam)
                        .single();
                    if (data) {
                        setReferralData({ code: data.referral_code, name: data.full_name });
                        setSelectedAdmin(data.referral_code);
                        // Store it for Google Login
                        if (typeof window !== 'undefined') localStorage.setItem('affiliate_ref', data.referral_code);
                    }
                } else {
                    // It's a standard referral code
                    const { data } = await supabase
                        .from('profiles')
                        .select('referral_code, full_name')
                        .eq('referral_code', refParam)
                        .single();
                    if (data) {
                        setReferralData({ code: data.referral_code, name: data.full_name });
                        setSelectedAdmin(data.referral_code);
                        if (typeof window !== 'undefined') localStorage.setItem('affiliate_ref', data.referral_code);
                    }
                }
            } else if (refCode) {
                const { data } = await supabase
                    .from('profiles')
                    .select('referral_code, full_name')
                    .eq('referral_code', refCode)
                    .single();
                
                if (data) {
                    setReferralData({ code: data.referral_code, name: data.full_name });
                    setSelectedAdmin(data.referral_code);
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

    const suggestEmailCorrection = (input: string): string | null => {
        if (!input || !input.includes('@')) return null;
        const parts = input.split('@');
        if (parts.length !== 2) return null;
        const domain = parts[1].toLowerCase().trim();
        if (COMMON_DOMAIN_TYPOS[domain]) {
            return `${parts[0].trim()}@${COMMON_DOMAIN_TYPOS[domain]}`;
        }
        return null;
    };

    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanEmail = email.trim().toLowerCase();
        const cleanConfirm = confirmEmail.trim().toLowerCase();

        if (!fullName.trim()) {
            setError("กรุณากรอกชื่อ-นามสกุล");
            return;
        }

        if (!cleanEmail) {
            setError("กรุณากรอกอีเมล");
            return;
        }

        if (!cleanConfirm) {
            setError("กรุณายืนยันอีเมลอีกครั้ง");
            return;
        }

        if (cleanEmail !== cleanConfirm) {
            setError("อีเมลทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบตัวสะกด");
            return;
        }

        const refCodeSetting = referralData?.code || selectedAdmin;
        if (!refCodeSetting) {
            setError("กรุณาเลือกผู้แนะนำเพื่อสมัครสมาชิก");
            return;
        }

        if (password.length < 6) {
            setError("รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
            return;
        }

        // Show confirmation modal to verify email
        setShowVerifyModal(true);
    };

    const handleConfirmRegister = async () => {
        setLoading(true);
        setError(null);

        const cleanEmail = email.trim().toLowerCase();
        const refCodeSetting = referralData?.code || selectedAdmin;

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: cleanEmail,
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        referred_by_code: refCodeSetting,
                    },
                },
            });

            if (signUpError) {
                let msg = signUpError.message;
                if (msg.includes('already registered')) {
                    msg = 'อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ หรือใช้อีเมลอื่น';
                }
                throw new Error(msg);
            }

            setShowVerifyModal(false);

            // 1. If confirm email is disabled in Supabase, session is ready immediately!
            if (data?.session) {
                toast.success(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${fullName.trim()}`);
                router.refresh();
                router.push(finalRedirectUrl);
                return;
            }

            // 2. Try direct sign in as fallback
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            });

            if (signInData?.session) {
                toast.success(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${fullName.trim()}`);
                router.refresh();
                router.push(finalRedirectUrl);
                return;
            }

            // 3. Fallback if email confirmation is still active in Supabase
            toast.info("สมัครสมาชิกสำเร็จ! กรุณาเข้าสู่ระบบ");
            router.push(`/login${queryString}`);
        } catch (err: any) {
            setShowVerifyModal(false);
            setError(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            // Extract referral code from state, cookie, or localStorage
            const getCookie = (name: string) => {
                const value = `; ${document.cookie}`;
                const parts = value.split(`; ${name}=`);
                if (parts.length === 2) return parts.pop()?.split(';').shift();
                return null;
            };

            const refCode = (referralData?.code || selectedAdmin || refParam || getCookie('affiliate_ref') || (typeof window !== 'undefined' ? localStorage.getItem('affiliate_ref') : null) || '').trim();

            if (refCode && typeof window !== 'undefined') {
                localStorage.setItem('affiliate_ref', refCode);
                localStorage.setItem('pending_affiliate_ref', refCode);
                document.cookie = `affiliate_ref=${refCode};path=/;max-age=2592000;SameSite=Lax`;
            }

            const refQueryStr = refCode ? `&ref=${encodeURIComponent(refCode)}` : '';
            const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(finalRedirectUrl)}${refQueryStr}`;

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                    redirectTo: callbackUrl,
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

                    <form onSubmit={handlePreSubmit} className="space-y-4">
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

                        {/* Email Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1" htmlFor="email">อีเมล</label>
                            <input
                                id="email"
                                type="email"
                                required
                                className="w-full h-12 rounded-xl border border-border bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 transition-all"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setEmail(val);
                                    setEmailSuggestion(suggestEmailCorrection(val));
                                }}
                            />

                            {/* Suggestion chip if typo detected */}
                            {emailSuggestion && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-500 flex items-center justify-between gap-2 animate-in fade-in duration-200">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Info className="w-4 h-4 shrink-0 text-amber-500" />
                                        <span className="truncate">คุณหมายถึง <strong className="underline">{emailSuggestion}</strong> หรือไม่?</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEmail(emailSuggestion);
                                            setConfirmEmail(emailSuggestion);
                                            setEmailSuggestion(null);
                                        }}
                                        className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-600 dark:text-amber-300 font-bold px-2 py-1 rounded transition-colors shrink-0"
                                    >
                                        แก้ไขให้ฉัน
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Confirm Email Input */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1" htmlFor="confirmEmail">
                                ยืนยันอีเมลอีกครั้ง
                            </label>
                            <input
                                id="confirmEmail"
                                type="email"
                                required
                                className={`w-full h-12 rounded-xl border bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 transition-all ${
                                    confirmEmail && email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()
                                        ? 'border-red-500 focus-visible:ring-red-500'
                                        : 'border-border focus-visible:ring-gold'
                                }`}
                                placeholder="พิมพ์อีเมลเดิมอีกครั้งเพื่อความถูกต้อง"
                                value={confirmEmail}
                                onChange={(e) => setConfirmEmail(e.target.value)}
                            />
                            {confirmEmail && email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase() && (
                                <p className="text-[11px] text-red-500 ml-1">อีเมลทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบตัวสะกด</p>
                            )}
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
                            {loading ? 'กำลังดำเนินการ...' : 'รับสิทธิ์การใช้งานเลย'}
                        </Button>
                    </form>

                    {/* Email Verification / Confirmation Modal */}
                    {showVerifyModal && (
                        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                            <div className="bg-card w-full max-w-md rounded-2xl border border-border p-6 shadow-2xl space-y-5 relative">
                                <div className="text-center space-y-2">
                                    <div className="w-12 h-12 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto mb-2">
                                        <Mail className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-lg font-bold">ตรวจสอบความถูกต้องของอีเมล</h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        ระบบไม่ต้องยืนยันอีเมล จึงสามารถเข้าใช้งานได้ทันที กรุณาตรวจสอบให้แน่ใจว่าอีเมลถูกต้อง เพื่อใช้ล็อกอินและกู้คืนรหัสผ่าน
                                    </p>
                                </div>

                                <div className="bg-muted/40 border border-gold/30 rounded-xl p-4 text-center space-y-1">
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">อีเมลสำหรับเข้าสู่ระบบ</p>
                                    <p className="text-lg font-mono font-bold text-gold break-all">{email.trim().toLowerCase()}</p>
                                    <p className="text-xs text-muted-foreground pt-1">
                                        ชื่อ: <span className="font-semibold text-foreground">{fullName.trim()}</span>
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1 h-11 rounded-xl text-sm"
                                        onClick={() => setShowVerifyModal(false)}
                                        disabled={loading}
                                    >
                                        กลับไปแก้ไข
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="gold"
                                        className="flex-1 h-11 rounded-xl text-sm font-bold shadow-lg shadow-gold/20"
                                        onClick={handleConfirmRegister}
                                        disabled={loading}
                                    >
                                        {loading ? 'กำลังสร้างบัญชี...' : 'ถูกต้อง ยืนยันเลย'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 text-center text-sm">
                        <span className="text-muted-foreground">มีบัญชีอยู่แล้ว? </span>
                        <Link href={`/login${queryString}`} className="text-primary hover:underline font-medium">
                            เข้าสู่ระบบ
                        </Link>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลด...</div>}>
            <RegisterContent />
        </Suspense>
    );
}
