'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, Save, Loader2, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);

    // Profile State
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    setUser(user);
                    setEmail(user.email || '');

                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    if (profile) {
                        setFullName(profile.full_name || '');
                    }
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', user.id);

            if (error) throw error;
            alert('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert('รหัสผ่านไม่ตรงกัน');
            return;
        }
        if (newPassword.length < 6) {
            alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        setSavingPassword(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            alert('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('Error updating password:', error);
            alert('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน: ' + (error as any).message);
        } finally {
            setSavingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center min-h-[500px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-2xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                ตั้งค่าบัญชี
            </h1>

            {/* Profile Section */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-6">
                <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                    <div className="p-3 bg-primary/20 rounded-full">
                        <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">ข้อมูลส่วนตัว</h2>
                        <p className="text-sm text-muted-foreground">จัดการข้อมูลบัญชีผู้ใช้ของคุณ</p>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">อีเมล (Email)</Label>
                        <Input
                            id="email"
                            value={email}
                            disabled
                            className="bg-muted/50 border-input/50"
                        />
                        <p className="text-xs text-muted-foreground">อีเมลไม่สามารถเปลี่ยนแปลงได้</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="fullName">ชื่อ-นามสกุล (Full Name)</Label>
                        <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="กรอกชื่อ-นามสกุลของคุณ"
                            className="bg-background/50"
                        />
                    </div>

                    <Button type="submit" disabled={savingProfile} className="w-full sm:w-auto">
                        {savingProfile ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                บันทึกการเปลี่ยนแปลง
                            </>
                        )}
                    </Button>
                </form>
            </div>

            {/* Security Section */}
            <div className="glass-card p-6 rounded-xl border border-white/10 space-y-6">
                <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                    <div className="p-3 bg-accent/20 rounded-full">
                        <Lock className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold">ความปลอดภัย</h2>
                        <p className="text-sm text-muted-foreground">เปลี่ยนรหัสผ่านเพื่อความปลอดภัย</p>
                    </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="newPassword">รหัสผ่านใหม่ (New Password)</Label>
                        <Input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                            className="bg-background/50"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่ (Confirm Password)</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            className="bg-background/50"
                        />
                    </div>

                    <Button type="submit" variant="outline" disabled={savingPassword} className="w-full sm:w-auto">
                        {savingPassword ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                กำลังดำเนินการ...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                เปลี่ยนรหัสผ่าน
                            </>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
