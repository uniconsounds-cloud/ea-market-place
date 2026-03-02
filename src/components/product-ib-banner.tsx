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

export function ProductIbBanner({ productId }: { productId: string }) {
    const [user, setUser] = useState<any>(null);
    const [hasApproved, setHasApproved] = useState(false);
    const [hasPending, setHasPending] = useState(false);
    const [availableBrokers, setAvailableBrokers] = useState<Broker[]>([]);
    const [allBrokers, setAllBrokers] = useState<Broker[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [isOpen, setIsOpen] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<string>("");
    const [verificationData, setVerificationData] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);

                // 1. Get user profile for root admin tracing
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('referred_by')
                    .eq('id', session.user.id)
                    .single();

                // 2. Find Root Admin Owner
                let rootOwnerId = profile?.referred_by;
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

                // 3. Get active brokers owned by that Root Admin (or all if no root)
                let brokerQuery = supabase
                    .from('brokers')
                    .select('id, name, ib_link')
                    .eq('is_active', true);

                if (rootOwnerId) {
                    brokerQuery = brokerQuery.eq('owner_id', rootOwnerId);
                }

                const { data: activeBrokers } = await brokerQuery;
                const brokersList = activeBrokers || [];
                setAllBrokers(brokersList);

                // 4. Get user's current IB memberships
                const { data: memberships } = await supabase
                    .from('ib_memberships')
                    .select('broker_id, status')
                    .eq('user_id', session.user.id);

                const mems = memberships || [];

                const approvedCount = mems.filter(m => m.status === 'approved').length;
                const pendingCount = mems.filter(m => m.status === 'pending').length;

                setHasApproved(approvedCount > 0);
                setHasPending(pendingCount > 0);

                // 5. Filter unapplied brokers
                const requestedBrokerIds = mems.map(m => m.broker_id);
                const unappliedBrokers = brokersList.filter(b => !requestedBrokerIds.includes(b.id));

                setAvailableBrokers(unappliedBrokers);
            } else {
                // Guest view: Show all active brokers
                const { data: activeBrokers } = await supabase
                    .from('brokers')
                    .select('id, name, ib_link')
                    .eq('is_active', true);
                if (activeBrokers) setAllBrokers(activeBrokers);
                setAvailableBrokers(activeBrokers || []);
            }

            setIsLoading(false);
        };

        fetchUserData();
    }, []);

    const handleApplyIb = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) {
            toast.error("กรุณาเข้าสู่ระบบก่อนสมัครรับสิทธิ์");
            return;
        }

        if (!selectedBroker || !verificationData) {
            toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
            return;
        }

        setIsSubmitting(true);
        try {
            // Check if someone else already used this verification data for this broker
            const { data: duplicateCheck } = await supabase
                .from('ib_memberships')
                .select('id')
                .eq('broker_id', selectedBroker)
                .eq('verification_data', verificationData.trim())
                .in('status', ['pending', 'approved'])
                .neq('user_id', user.id)
                .limit(1);

            if (duplicateCheck && duplicateCheck.length > 0) {
                toast.error("ไม่สามารถทำรายการได้", { description: "ข้อมูลยืนยันตัวตนนี้ถูกลงทะเบียนขอสิทธิ์ไปแล้วโดยผู้ใช้อื่น" });
                setIsSubmitting(false);
                return;
            }

            // Insert into ib_memberships
            const { data, error } = await supabase
                .from('ib_memberships')
                .insert({
                    user_id: user.id,
                    broker_id: selectedBroker,
                    verification_data: verificationData.trim(),
                    status: 'pending'
                })
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("คำสั่งถูกปฏิเสธโดยฐานข้อมูล");
            }

            setHasPending(true);
            setAvailableBrokers(prev => prev.filter(b => b.id !== selectedBroker));
            setIsOpen(false);
            setVerificationData("");
            setSelectedBroker("");
            toast.success("ส่งคำขอสำเร็จ", { description: "ทีมงานจะตรวจสอบและอนุมัติสิทธิ์ให้ท่านโดยเร็วที่สุด" });
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return null;

    // Do not show banner if they are already approved for at least 1 broker
    if (hasApproved) return null;

    // If they applied to all possible brokers and they are all pending/rejected
    if (availableBrokers.length === 0) {
        if (hasPending) {
            return (
                <Card className="mb-8 border-orange-500/50 bg-gradient-to-r from-orange-500/10 via-background to-background shadow-sm overflow-hidden relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500"></div>
                    <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                        <div className="bg-orange-500/20 p-3 rounded-full shrink-0">
                            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg font-bold text-foreground mb-1">
                                คำขอสิทธิ์ IB ของท่านกำลังรอการตรวจสอบ
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                ทีมงานกำลังตรวจสอบข้อมูลของคุณกับโบรกเกอร์ โปรดรอการอนุมัติภายใน 24 ชั่วโมง
                            </p>
                        </div>
                    </CardContent>
                </Card>
            );
        }
        return null;
    }

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
                        เพียงเปิดบัญชีเทรดภายใต้ลิงก์ตัวแทน (IB) ของเรา คุณจะได้รับสิทธิ์ใช้งาน Expert Advisor แบบฟรีทันทีเมื่อผ่านการอนุมัติ (สามารถสมัครได้หลายโบรกเกอร์)
                    </p>
                    {hasPending && (
                        <p className="text-xs text-orange-500 mt-1">
                            * คุณมีคำขอสิทธิ์ที่กำลังรอการตรวจสอบอยู่ แต่คุณยังสามารถสมัครเปิดกับโบรกเกอร์อื่นๆ เพิ่มเติมได้
                        </p>
                    )}
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
                                    เลือกโบรกเกอร์ที่คุณสมัครผ่านลิงก์ของเรา และกรอกข้อมูลเพื่อแสดงตัวตน
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
                                            {availableBrokers.map((b) => (
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
                                            href={availableBrokers.find(b => b.id === selectedBroker)?.ib_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-primary hover:underline break-all"
                                        >
                                            {availableBrokers.find(b => b.id === selectedBroker)?.ib_link}
                                        </a>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="ib-account">เลขพอร์ต หรือ อีเมล (สำหรับการยืนยันตัวตนกับโบรกเกอร์)</Label>
                                    <Input
                                        id="ib-account"
                                        placeholder="เช่น 12345678 หรือ youremail@gmail.com"
                                        value={verificationData}
                                        onChange={(e) => setVerificationData(e.target.value)}
                                        required
                                        className="font-mono"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                                        ทีมงานจะใช้ข้อมูลนี้เพื่อตรวจสอบในระบบหลังบ้านของโบรกเกอร์เท่านั้น
                                        *คุณจะสามารถกรอกหมายเลขบัญชีเทรดที่จะใช้ผูกกับ EA ได้ในขั้นตอนถัดไป*
                                    </p>
                                </div>

                                <div className="bg-blue-500/10 text-blue-800 dark:text-blue-300 p-3 rounded-md text-xs flex gap-2 items-start mt-4">
                                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p>หลังจากส่งข้อมูลแล้ว ทีมงานจะตรวจสอบว่าคุณอยู่ภายใต้ IB ของเราหรือไม่ และจะอนุมัติสิทธิ์ให้ภายใน 24 ชั่วโมง</p>
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
