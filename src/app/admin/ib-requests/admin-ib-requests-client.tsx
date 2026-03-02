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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type IBRequest = {
    id: string; // ib_memberships ID
    verification_data: string | null;
    status: string;
    updated_at: string;
    profiles: {
        full_name: string | null;
        email: string | null;
    } | {
        full_name: string | null;
        email: string | null;
    }[] | null;
    brokers: {
        name: string;
        ib_link: string;
    } | {
        name: string;
        ib_link: string;
    }[] | null;
};

export default function AdminIbRequestsClient({ initialRequests }: { initialRequests: IBRequest[] }) {
    const [requests, setRequests] = useState<IBRequest[]>(initialRequests);
    const [isLoading, setIsLoading] = useState(false);

    // Approval Modal State
    const [isApproveOpen, setIsApproveOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<IBRequest | null>(null);

    const handleAction = async (id: string, action: "approve" | "reject") => {
        setIsLoading(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) throw new Error("Unauthorized");

            const newStatus = action === "approve" ? "approved" : "rejected";

            const { error } = await supabase
                .from("ib_memberships")
                .update({ status: newStatus })
                .eq("id", id);

            if (error) throw new Error(error.message);

            // Remove from the pending list
            setRequests(requests.filter(r => r.id !== id));

            if (action === "approve") {
                toast.success("อนุมัติสำเร็จ", { description: "ผู้ใช้นี้ได้รับสิทธิ์ IB ของโบรกเกอร์นี้แล้ว" });
                setIsApproveOpen(false);
            } else {
                toast.success("ปฏิเสธสำเร็จ", { description: "คำขอ IB ถูกปฏิเสธแล้ว" });
            }
        } catch (error: any) {
            toast.error("เกิดข้อผิดพลาด", { description: error.message || "Failed to communicate with the server." });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectClick = (id: string, name: string) => {
        if (!confirm(`คุณแน่ใจหรือไม่ที่จะปฏิเสธคำขอ IB ของ ${name || 'ผู้ใช้งาน'} ?\nลูกค้ารายนี้จะสามารถกดขอสมัครเข้ามาใหม่ได้`)) {
            return;
        }
        handleAction(id, "reject");
    };

    const openApproveModal = (request: IBRequest) => {
        setSelectedRequest(request);
        setIsApproveOpen(true);
    };

    const submitApproval = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) return;
        handleAction(selectedRequest.id, "approve");
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("คัดลอกข้อมูลสำเร็จ");
    };

    const getName = (req: IBRequest) => {
        if (!req.profiles) return 'ไม่ได้ระบุชื่อ';
        if (Array.isArray(req.profiles)) {
            return req.profiles[0]?.full_name || req.profiles[0]?.email || 'ไม่ได้ระบุชื่อ';
        }
        return req.profiles.full_name || req.profiles.email || 'ไม่ได้ระบุชื่อ';
    };

    const getBrokerName = (req: IBRequest) => {
        if (!req.brokers) return 'ไม่พบข้อมูลโบรกเกอร์';
        if (Array.isArray(req.brokers)) {
            return req.brokers[0]?.name || 'ไม่พบข้อมูลโบรกเกอร์';
        }
        return req.brokers.name || 'ไม่พบข้อมูลโบรกเกอร์';
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">คำขออนุมัติใช้งาน IB</h1>
                <p className="text-muted-foreground mt-1">
                    พิจารณาและอนุมัติคำขอสิทธิ์การเป็น IB จากลูกค้า (ลูกค้ารอเปิดการใช้งาน EA พิเศษ)
                </p>
            </div>

            <Card className="border-border/40 shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border/40 pb-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>รายการรออนุมัติ</span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-400">
                            รอตรวจสอบ {requests.length} รายการ
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="w-[200px]">ลูกค้า</TableHead>
                                    <TableHead>โบรกเกอร์ (Broker)</TableHead>
                                    <TableHead>ข้อมูลรอยืนยัน</TableHead>
                                    <TableHead className="w-[180px]">วันที่ขอสิทธิ์</TableHead>
                                    <TableHead className="text-right w-[180px]">การจัดการ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground flex-col gap-2">
                                            <div className="flex justify-center mb-2">
                                                <CheckCircle2 className="w-10 h-10 text-muted-foreground/30" />
                                            </div>
                                            ไม่มีคำขอ IB ที่รอการอนุมัติ
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.map((request) => (
                                        <TableRow key={request.id} className="hover:bg-muted/5">
                                            <TableCell className="font-medium">
                                                {getName(request)}
                                                <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">ID: {request.id.substring(0, 8)}...</div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-semibold text-primary/80">
                                                    {getBrokerName(request)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {request.verification_data ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm">{request.verification_data}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 shrink-0 hover:bg-muted/50"
                                                            onClick={() => copyToClipboard(request.verification_data as string)}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground italic text-sm">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {format(new Date(request.updated_at), 'd MMM yyyy HH:mm', { locale: th })} น.
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                                                        onClick={() => handleRejectClick(request.id, getName(request))}
                                                        disabled={isLoading}
                                                    >
                                                        <XCircle className="w-3.5 h-3.5 mr-1" /> ปฏิเสธ
                                                    </Button>
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="h-8 bg-green-500 hover:bg-green-600 text-white"
                                                        onClick={() => openApproveModal(request)}
                                                        disabled={isLoading}
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> อนุมัติ
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

            {/* Approve Modal */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>ยืนยันการอนุมัติสิทธิ์ IB</DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <form onSubmit={submitApproval} className="space-y-6 pt-2">
                            <div className="bg-muted/50 p-4 rounded-md border border-border/50 text-sm space-y-2">
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">ลูกค้า:</span> <strong>{getName(selectedRequest)}</strong></p>
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">โบรกเกอร์:</span> <strong>{getBrokerName(selectedRequest)}</strong></p>
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">ข้อมูลยืนยัน:</span> <strong className="font-mono text-primary">{selectedRequest.verification_data || '-'}</strong></p>
                            </div>

                            <p className="text-sm text-muted-foreground">
                                การกดอนุมัติจะเป็นการให้สิทธิ์ผู้ใช้รายนี้สำหรับโบรกเกอร์ที่ระบุไว้ เพื่อนำไปใช้เป็นส่วนลด 100% ในช่องทางการสั่งซื้อ
                            </p>

                            <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white" disabled={isLoading}>
                                {isLoading ? "กำลังดำเนินการ..." : "ยืนยันการอนุมัติสิทธิ์ IB"}
                            </Button>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
