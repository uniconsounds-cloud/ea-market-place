"use client";

import { useState } from "react";
import { format, addMonths, addYears } from "date-fns";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Link as LinkIcon, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type IBRequest = {
    id: string; // Profile ID
    full_name: string | null;
    ib_status: string;
    ib_account_number: string | null;
    ib_broker_id: string | null;
    updated_at: string;
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
    const [expiryOption, setExpiryOption] = useState("1month");
    const [customDate, setCustomDate] = useState("");

    const handleAction = async (id: string, action: "approve" | "reject", eParams?: any) => {
        setIsLoading(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) throw new Error("Unauthorized");

            const newStatus = action === "approve" ? "approved" : "rejected";
            const updates: any = { ib_status: newStatus };

            if (action === "approve") {
                if (!eParams?.expiryDate) throw new Error("Expiry date is required");
                updates.ib_expiry_date = eParams.expiryDate;
            }

            const { error } = await supabase
                .from("profiles")
                .update(updates)
                .eq("id", id);

            if (error) throw new Error(error.message);

            // Remove from the pending list
            setRequests(requests.filter(r => r.id !== id));

            if (action === "approve") {
                toast.success("อนุมัติสำเร็จ", { description: "ผู้ใช้นี้ได้รับสิทธิ์ IB แล้ว" });
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
        // Default to +1 month setup
        setCustomDate(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
        setExpiryOption("1month");
        setIsApproveOpen(true);
    };

    const submitApproval = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) return;

        let finalExpiryDate: Date;
        const now = new Date();

        if (expiryOption === "1month") {
            finalExpiryDate = addMonths(now, 1);
        } else if (expiryOption === "6months") {
            finalExpiryDate = addMonths(now, 6);
        } else if (expiryOption === "1year") {
            finalExpiryDate = addYears(now, 1);
        } else {
            // custom
            finalExpiryDate = new Date(customDate);
        }

        handleAction(selectedRequest.id, "approve", { expiryDate: finalExpiryDate.toISOString() });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("คัดลอกเลขบัญชีสำเร็จ");
    };

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
                                    <TableHead>เลขบัญชีเทรด (Account)</TableHead>
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
                                                {request.full_name || 'ไม่ได้ระบุชื่อ'}
                                                <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{request.id}</div>
                                            </TableCell>
                                            <TableCell>
                                                {request.brokers ? (
                                                    <span className="font-semibold text-primary/80">
                                                        {Array.isArray(request.brokers) ? request.brokers[0]?.name : request.brokers.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground italic text-sm">ไม่พบข้อมูลโบรกเกอร์</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {request.ib_account_number ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm">{request.ib_account_number}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 shrink-0 hover:bg-muted/50"
                                                            onClick={() => copyToClipboard(request.ib_account_number as string)}
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
                                                        onClick={() => handleRejectClick(request.id, request.full_name || "")}
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
                        <DialogTitle>อนุมัติคำขอสิทธิ์ IB</DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <form onSubmit={submitApproval} className="space-y-6 pt-2">
                            <div className="bg-muted/50 p-3 rounded-md border border-border/50 text-sm space-y-1.5">
                                <p><span className="text-muted-foreground mr-2">ลูกค้า:</span> <strong>{selectedRequest.full_name || 'ไม่มีชื่อ'}</strong></p>
                                <p><span className="text-muted-foreground mr-2">โบรกเกอร์:</span> <strong>{selectedRequest.brokers ? (Array.isArray(selectedRequest.brokers) ? selectedRequest.brokers[0]?.name : selectedRequest.brokers.name) : '-'}</strong></p>
                                <p><span className="text-muted-foreground mr-2">เลขบัญชีเทรด:</span> <strong className="font-mono">{selectedRequest.ib_account_number || '-'}</strong></p>
                            </div>

                            <div className="space-y-3">
                                <Label>ระยะเวลาอนุมัติ (วันหมดอายุสิทธิ์ IB)</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant={expiryOption === "1month" ? "default" : "outline"}
                                        className={expiryOption === "1month" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("1month")}
                                    >
                                        1 เดือน
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={expiryOption === "6months" ? "default" : "outline"}
                                        className={expiryOption === "6months" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("6months")}
                                    >
                                        6 เดือน
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={expiryOption === "1year" ? "default" : "outline"}
                                        className={expiryOption === "1year" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("1year")}
                                    >
                                        1 ปี
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={expiryOption === "custom" ? "default" : "outline"}
                                        className={expiryOption === "custom" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                        onClick={() => setExpiryOption("custom")}
                                    >
                                        กำหนดเอง
                                    </Button>
                                </div>

                                {expiryOption === "custom" && (
                                    <div className="pt-2">
                                        <Label htmlFor="customDate" className="text-muted-foreground text-xs mb-1.5 block">เลือกวันที่หมดอายุ</Label>
                                        <div className="relative">
                                            <Input
                                                id="customDate"
                                                type="date"
                                                value={customDate}
                                                onChange={(e) => setCustomDate(e.target.value)}
                                                className="pl-9"
                                                min={format(new Date(), "yyyy-MM-dd")}
                                                required={expiryOption === "custom"}
                                            />
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </div>
                                )}
                            </div>

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
