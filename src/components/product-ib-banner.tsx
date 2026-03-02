"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, Gift, Loader2, Link as LinkIcon } from "lucide-react";

type Broker = {
    id: string;
    name: string;
    ib_link: string;
};

type IBStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'expired';

export function ProductIbBanner({ productId }: { productId: string }) {
    const [user, setUser] = useState<any>(null);
    const [ibStatus, setIbStatus] = useState<IBStatus>('none');
    const [brokers, setBrokers] = useState<Broker[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [isOpen, setIsOpen] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<string>("");
    const [accountNumber, setAccountNumber] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);

                // Get IB status & upline
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('ib_status, referred_by')
                    .eq('id', session.user.id)
                    .single();

                if (profile) {
                    setIbStatus(profile.ib_status as IBStatus);

                    // Traverse Upline to find Root Admin Owner
                    let rootOwnerId = profile.referred_by;
                    // Max depth to prevent infinite loops (though single tier + root means max 2-3)
                    for (let i = 0; i < 5; i++) {
                        if (!rootOwnerId) break;

                        const { data: uplineProfile } = await supabase
                            .from('profiles')
                            .select('id, email, referred_by')
                            .eq('id', rootOwnerId)
                            .single();

                        if (!uplineProfile) break;

                        if (uplineProfile.email === 'juntarasate@gmail.com' || uplineProfile.email === 'bctutor123@gmail.com') {
                            rootOwnerId = uplineProfile.id;
                            break;
                        }
                        rootOwnerId = uplineProfile.referred_by;
                    }

                    // Get active brokers owned by that Root Admin
                    let brokerQuery = supabase
                        .from('brokers')
                        .select('id, name, ib_link')
                        .eq('is_active', true);

                    if (rootOwnerId) {
                        brokerQuery = brokerQuery.eq('owner_id', rootOwnerId);
                    }

                    const { data: activeBrokers } = await brokerQuery;

                    if (activeBrokers) {
                        setBrokers(activeBrokers);
                    }
                }
            } else {
                // Guest view: Show all active brokers as fallback
                const { data: activeBrokers } = await supabase
                    .from('brokers')
                    .select('id, name, ib_link')
                    .eq('is_active', true);
                if (activeBrokers) setBrokers(activeBrokers);
            }

            setIsLoading(false);
        };

        fetchUserData();
    }, []);

    const handleApplyIb = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            toast.error("กรุณาเข้าสู่ระบบก่อนสมัครรับสิทธิ์");
            // Optionally redirect to login
            return;
        }

        if (!selectedBroker || !accountNumber) {
            toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Check if port is already active in global licenses
            const { data: globalLicenses } = await supabase
                .from('licenses')
                .select('id')
                .eq('account_number', accountNumber.trim())
                .eq('is_active', true)
                .gte('expiry_date', new Date().toISOString())
                .limit(1);

            if (globalLicenses && globalLicenses.length > 0) {
                toast.error("ไม่สามารถทำรายการได้", { description: "หมายเลขพอร์ตนี้ถูกใช้งานไปแล้วและยังมีอายุการใช้งานอยู่" });
                setIsSubmitting(false);
                return;
            }

            // 2. Check if port is already attached to another profile (approved or pending)
            const { data: duplicateProfiles } = await supabase
                .from('profiles')
                .select('id')
                .eq('ib_account_number', accountNumber.trim())
                .in('ib_status', ['pending', 'approved'])
                .neq('id', user.id)
                .limit(1);

            if (duplicateProfiles && duplicateProfiles.length > 0) {
                toast.error("ไม่สามารถทำรายการได้", { description: "หมายเลขพอร์ตนี้ถูกลงทะเบียนขอสิทธิ์ไปแล้วโดยผู้ใช้อื่น" });
                setIsSubmitting(false);
                return;
            }

            const { error } = await supabase
                .from('profiles')
                .update({
                    ib_status: 'pending',
                    ib_broker_id: selectedBroker,
                    ib_account_number: accountNumber
                })
                .eq('id', user.id);

            if (error) throw error;

            setIbStatus('pending');
            setIsOpen(false);
            toast.success("ส่งคำขอสำเร็จ", { description: "ทีมงานจะตรวจสอบและอนุมัติสิทธิ์ให้ท่านโดยเร็วที่สุด" });
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return null;

    // Do not show banner if they are already approved or pending
    if (ibStatus === 'approved' || ibStatus === 'pending') return null;

    return (
        <Card className="mb-8 border-primary/50 bg-gradient-to-r from-primary/10 via-background to-background shadow-sm overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="bg-primary/20 p-3 rounded-full shrink-0">
                    <Gift className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-lg font-bold text-foreground mb-1">
                        สิทธิพิเศษสำหรับ IB (รับสิทธิ์ใช้ EA ฟรี!)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        เพียงเปิดบัญชีเทรดภายใต้ลิงก์ตัวแทน (IB) ของเรา คุณจะได้รับสิทธิ์ใช้งาน Expert Advisor ตัวนี้ได้ฟรีทันทีเมื่อผ่านการอนุมัติ
                    </p>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <Button className="shrink-0 w-full sm:w-auto shadow-md shadow-primary/20">
                            สมัครเป็น IB ตอนนี้
                        </Button>
                    </DialogTrigger>
                    {user ? (
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Gift className="w-5 h-5 text-primary" />
                                    ลงทะเบียนรับสิทธิ์ใช้งานฟรี (IB)
                                </DialogTitle>
                                <DialogDescription>
                                    เลือกโบรกเกอร์และกรอกเลขบัญชีเทรดที่คุณสมัครผ่านลิงก์ของเรา
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleApplyIb} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>เลือกโบรกเกอร์</Label>
                                    <Select value={selectedBroker} onValueChange={setSelectedBroker} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="-- เลือกโบรกเกอร์ --" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {brokers.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    {b.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedBroker && (
                                    <div className="p-3 bg-muted/50 border border-border rounded-md text-sm">
                                        <div className="font-semibold mb-1 flex items-center gap-1.5">
                                            <LinkIcon className="w-3.5 h-3.5" /> ลิงก์สมัคร (IB Link)
                                        </div>
                                        <a
                                            href={brokers.find(b => b.id === selectedBroker)?.ib_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-primary hover:underline break-all"
                                        >
                                            {brokers.find(b => b.id === selectedBroker)?.ib_link}
                                        </a>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="ib-account">หมายเลขบัญชีเทรด (MT4/MT5)</Label>
                                    <Input
                                        id="ib-account"
                                        placeholder="Ex. 12345678"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value)}
                                        required
                                        className="font-mono"
                                    />
                                </div>

                                <div className="bg-blue-500/10 text-blue-800 dark:text-blue-300 p-3 rounded-md text-xs flex gap-2 items-start mt-4">
                                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p>หลังจากส่งข้อมูลแล้ว ทีมงานจะตรวจสอบว่าบัญชีนี้อยู่ภายใต้ IB ของเราหรือไม่ และจะอนุมัติสิทธิ์ให้ภายใน 24 ชั่วโมง</p>
                                </div>

                                <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่งข้อมูล...</> : "ส่งคำขอรับสิทธิ์"}
                                </Button>
                            </form>
                        </DialogContent>
                    ) : (
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>กรุณาเข้าสู่ระบบ</DialogTitle>
                                <DialogDescription>
                                    คุณต้องเป็นสมาชิกและเข้าสู่ระบบก่อน จึงจะสามารถสมัครรับสิทธิ์ IB ได้
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 flex flex-col gap-3">
                                <Button onClick={() => window.location.href = `/login?returnUrl=/products/${productId}`}>
                                    ไปที่หน้าเข้าสู่ระบบ
                                </Button>
                                <Button variant="outline" onClick={() => setIsOpen(false)}>
                                    ยกเลิก
                                </Button>
                            </div>
                        </DialogContent>
                    )}
                </Dialog>
            </CardContent>
        </Card>
    );
}
