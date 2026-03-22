'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });

            if (error) {
                throw error;
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาด โปรดลองใหม่อีกครั้ง');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="glass-card w-full max-w-md p-8 rounded-xl border border-border">
                    <div className="mb-6">
                        <Link href="/login" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            กลับไปหน้าเข้าสู่ระบบ
                        </Link>
                    </div>

                    <div className="text-center mb-8">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">ลืมรหัสผ่าน?</h1>
                        <p className="text-muted-foreground text-sm">
                            กรอกอีเมลของคุณเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่
                        </p>
                    </div>

                    {success ? (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <h3 className="font-semibold text-green-600 dark:text-green-500 mb-2">ส่งลิงก์สำเร็จ!</h3>
                            <p className="text-sm text-muted-foreground">
                                เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปที่ <br/>
                                <span className="font-medium text-foreground">{email}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-4">
                                โปรดตรวจสอบในกล่องข้อความ (รวมถึงโฟลเดอร์จดหมายขยะ/สแปม)
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="email">อีเมลที่ใช้สมัคร</label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={loading || !email}>
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        กำลังส่งลิงก์...
                                    </>
                                ) : (
                                    'ส่งลิงก์ตั้งรหัสผ่านใหม่'
                                )}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}
