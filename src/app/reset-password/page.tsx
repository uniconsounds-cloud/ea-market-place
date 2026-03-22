'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { Key, Loader2, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Verify that the user has a valid active session to reset password
        // The recovery email link should have logged them in.
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // If they land here without a session, they might need to go to login
                // We'll give them a small warning but don't force redirect immediately 
                // in case the session is setting up.
                setTimeout(async () => {
                    const { data } = await supabase.auth.getSession();
                    if (!data.session) {
                        setError('ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาทำรายการลืมรหัสผ่านใหม่อีกครั้ง');
                    }
                }, 1500);
            }
        };
        
        // Supabase sometimes puts hash params like #access_token= in the URL instead of using SSR callback
        // This useEffect will capture the session implicitly via the client library
        checkSession();

        // Listen for auth state changes specific to password recovery
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                // User is verified and ready to change password
                setError(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.length < 6) {
            setError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        if (password !== confirmPassword) {
            setError('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                throw error;
            }

            setSuccess(true);
            // Sign out the user after password change for security, or keep them logged in.
            // Keeping them logged in is smoother.
            setTimeout(() => {
                router.push('/dashboard');
            }, 3000);
            
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Navbar />
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="glass-card w-full max-w-md p-8 rounded-xl border border-border">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Key className="w-6 h-6 text-primary" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">ตั้งรหัสผ่านใหม่</h1>
                        <p className="text-muted-foreground text-sm">
                            กรุณากำหนดรหัสผ่านใหม่เพื่อเข้าใช้งานบัญชีของคุณ
                        </p>
                    </div>

                    {success ? (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 text-center animate-in fade-in zoom-in duration-300">
                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <h3 className="font-semibold text-green-600 dark:text-green-500 mb-2">เปลี่ยนรหัสผ่านสำเร็จ!</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                รหัสผ่านของคุณถูกอัพเดทเรียบร้อยแล้ว
                            </p>
                            <p className="text-xs text-muted-foreground">
                                ระบบกำลังพาคุณกลับไปที่ Dashboard...
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-md text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="password">รหัสผ่านใหม่</label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="รหัสผ่านอย่างน้อย 6 ตัวอักษร"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    minLength={6}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    minLength={6}
                                />
                            </div>

                            <Button type="submit" className="w-full mt-6" disabled={loading || !password || !confirmPassword}>
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    'บันทึกรหัสผ่านใหม่'
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
