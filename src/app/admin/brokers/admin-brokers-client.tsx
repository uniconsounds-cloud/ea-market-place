"use client";

import { useState } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Link, Plus, Trash2, Edit2, Copy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Broker = {
    id: string;
    name: string;
    ib_link: string;
    is_active: boolean;
    created_at: string;
};

export default function AdminBrokersClient({ initialBrokers }: { initialBrokers: Broker[] }) {
    const [brokers, setBrokers] = useState<Broker[]>(initialBrokers);
    const [isLoading, setIsLoading] = useState(false);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Form States
    const [currentBrokerId, setCurrentBrokerId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [ibLink, setIbLink] = useState("");

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) throw new Error("Unauthorized");

            const { data: newBroker, error } = await supabase
                .from("brokers")
                .insert({
                    name,
                    ib_link: ibLink || null,
                    is_active: true,
                    owner_id: sessionData.session.user.id
                })
                .select()
                .single();

            if (error) throw new Error(error.message);

            setBrokers([newBroker, ...brokers]);
            toast.success("เพิ่มโบรกเกอร์สำเร็จ", { description: `${name} ถูกเพิ่มเข้าระบบแล้ว` });
            setIsAddOpen(false);
            setName("");
            setIbLink("");
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentBrokerId) return;

        setIsLoading(true);
        try {
            const updates = {
                name,
                ib_link: ibLink
            };

            const { error } = await supabase
                .from("brokers")
                .update(updates)
                .eq("id", currentBrokerId);

            if (error) throw new Error(error.message);

            setBrokers(brokers.map(b => b.id === currentBrokerId ? { ...b, name, ib_link: ibLink } : b));
            toast.success("แก้ไขสำเร็จ", { description: `อัปเดตข้อมูลโบรกเกอร์เรียบร้อยแล้ว` });
            setIsEditOpen(false);
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    const toggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("brokers")
                .update({ is_active: !currentStatus })
                .eq("id", id);

            if (error) throw new Error(error.message);

            setBrokers(brokers.map(b => b.id === id ? { ...b, is_active: !currentStatus } : b));
            toast.success("อัปเดตสถานะสำเร็จ");
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message });
        }
    };

    const handleDelete = async (id: string) => {
        // In a real app we'd confirm this first
        if (!confirm("คุณแน่ใจหรือไม่ที่จะลบโบรกเกอร์นี้?")) return;

        try {
            const { error } = await supabase
                .from("brokers")
                .delete()
                .eq("id", id);

            if (error) throw new Error(error.message);

            setBrokers(brokers.filter(b => b.id !== id));
            toast.success("ลบโบรกเกอร์สำเร็จ");
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("คัดลอกลิงก์สำเร็จ");
    };

    const openEditModal = (broker: Broker) => {
        setCurrentBrokerId(broker.id);
        setName(broker.name);
        setIbLink(broker.ib_link);
        setIsEditOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">ระบบจัดการ Brokers & IB</h1>
                    <p className="text-muted-foreground mt-1">
                        จัดการรายชื่อโบรกเกอร์พาร์ทเนอร์และลิงก์สมัคร IB สำหรับให้ลูกค้าใช้งาน EA ฟรี
                    </p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="flex items-center gap-2">
                            <Plus className="w-4 h-4" /> เพิ่มโบรกเกอร์ใหม่
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>เพิ่มโบรกเกอร์ใหม่</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAdd} className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">ชื่อโบรกเกอร์</Label>
                                <Input
                                    id="name"
                                    placeholder="เช่น Exness, XM, FBS"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ibLink">IB Link (ลิงก์สมัครต่อ)</Label>
                                <Input
                                    id="ibLink"
                                    placeholder="https://..."
                                    value={ibLink}
                                    onChange={e => setIbLink(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Edit Modal */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>แก้ไขข้อมูลโบรกเกอร์</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleEdit} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">ชื่อโบรกเกอร์</Label>
                            <Input
                                id="edit-name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-ibLink">IB Link</Label>
                            <Input
                                id="edit-ibLink"
                                value={ibLink}
                                onChange={e => setIbLink(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? "กำลังบันทึก..." : "อัปเดตข้อมูล"}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Card className="border-border/40 shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border/40 pb-4">
                    <CardTitle className="text-lg">รายชื่อ Brokers ทั้งหมด ({brokers.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="w-[200px]">ชื่อโบรกเกอร์</TableHead>
                                    <TableHead>IB Link</TableHead>
                                    <TableHead className="w-[150px] text-center">สถานะใช้งาน</TableHead>
                                    <TableHead className="w-[180px]">วันที่เพิ่ม</TableHead>
                                    <TableHead className="text-right w-[120px]">จัดการ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {brokers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            ยังไม่มีรายชื่อโบรกเกอร์ในระบบ
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    brokers.map((broker) => (
                                        <TableRow key={broker.id} className="hover:bg-muted/5">
                                            <TableCell className="font-medium">{broker.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground max-w-[300px]">
                                                    <span className="truncate">{broker.ib_link}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 shrink-0"
                                                        onClick={() => copyToClipboard(broker.ib_link)}
                                                    >
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Switch
                                                        checked={broker.is_active}
                                                        onCheckedChange={() => toggleActive(broker.id, broker.is_active)}
                                                        className="data-[state=checked]:bg-green-500"
                                                    />
                                                    <span className="text-xs text-muted-foreground w-12 text-left">
                                                        {broker.is_active ? 'เปิดใช้งาน' : 'ปิดไว้'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {format(new Date(broker.created_at), 'd MMM yyyy', { locale: th })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => openEditModal(broker)}>
                                                        <Edit2 className="h-4 w-4 text-primary/70 hover:text-primary" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(broker.id)}>
                                                        <Trash2 className="h-4 w-4 text-destructive/70 hover:text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
