"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, Gift, Loader2, Link as LinkIcon, AlertTriangle } from "lucide-react";

type Broker = {
    id: string;
    name: string;
    ib_link: string;
};

export function HomeIbButton() {
    const [user, setUser] = useState<any>(null);
    const [availableBrokers, setAvailableBrokers] = useState<Broker[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form state
    const [isOpen, setIsOpen] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<string>("");
    const [email, setEmail] = useState("");
    const [verificationData, setVerificationData] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return; // Only fetch when opened to save queries on homepage load

        const fetchUserData = async () => {
            setIsLoading(true);
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

                // 4. Get user's current IB memberships
                const { data: memberships } = await supabase
                    .from('ib_memberships')
                    .select('broker_id, status')
                    .eq('user_id', session.user.id);

                const requestedBrokerIds = (memberships || [])
                    .filter(m => m.status === 'approved' || m.status === 'pending')
                    .map(m => m.broker_id);
                const unappliedBrokers = brokersList.filter(b => !requestedBrokerIds.includes(b.id));

                setAvailableBrokers(unappliedBrokers);
            } else {
                // Guest view: Show all active brokers
                const { data: activeBrokers } = await supabase
                    .from('brokers')
                    .select('id, name, ib_link')
                    .eq('is_active', true);
                setAvailableBrokers(activeBrokers || []);
            }

            setIsLoading(false);
        };

        fetchUserData();
    }, [isOpen]);

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
                .upsert({
                    user_id: user.id,
                    broker_id: selectedBroker,
                    email: email.trim(),
                    verification_data: verificationData.trim(),
                    status: 'pending'
                }, { onConflict: 'user_id,broker_id' })
                .select();

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("คำสั่งถูกปฏิเสธโดยฐานข้อมูล");
            }

            setAvailableBrokers(prev => prev.filter(b => b.id !== selectedBroker));
            setIsOpen(false);
            setVerificationData("");
            setEmail("");
            setSelectedBroker("");
            toast.success("ส่งคำขอสำเร็จ", { description: "ทีมงานจะตรวจสอบและอนุมัติสิทธิ์ให้ท่านโดยเร็วที่สุด" });
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Button variant="gold" size="lg" className="px-8 text-base" onClick={() => setIsOpen(true)}>
                รับสิทธิ์ใช้งาน EA ฟรี (สมัครเป็น IB)
            </Button>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                {isLoading ? (
                    <DialogContent className="sm:max-w-md flex flex-col items-center justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50 mb-4" />
                        <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
                    </DialogContent>
                ) : user ? (
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
                        
                        {availableBrokers.length === 0 ? (
                            <div className="py-6 text-center text-muted-foreground flex flex-col items-center gap-2">
                                <ShieldCheck className="w-12 h-12 text-green-500 mb-2" />
                                <p className="font-semibold text-foreground">คุณได้สมัคร/ยื่นคำขอสิทธิ์โบรกเกอร์ทั้งหมดแล้ว!</p>
                                <p className="text-sm">ขอบคุณที่เข้าร่วมเป็นส่วนหนึ่งกับเรา สามารถตรวจสอบสถานะได้ที่หน้าแดชบอร์ด</p>
                            </div>
                        ) : (
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
                                    <div className="p-3 bg-muted/50 border border-border rounded-md text-sm animate-in fade-in zoom-in-95 duration-200">
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
                                    <Label htmlFor="ib-email">อีเมล (ที่ใช้สมัครกับโบรคเกอร์)</Label>
                                    <Input
                                        id="ib-email"
                                        type="email"
                                        placeholder="youremail@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="ib-account">เลขพอร์ต หรือ ไอดี (สำหรับการยืนยันตัวตนกับโบรกเกอร์)</Label>
                                    <Input
                                        id="ib-account"
                                        placeholder="เช่น 12345678"
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
                        )}
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
                            <Button onClick={() => window.location.href = `/login?returnUrl=/`}>
                                ไปที่หน้าเข้าสู่ระบบ
                            </Button>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                ยกเลิก
                            </Button>
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
}
