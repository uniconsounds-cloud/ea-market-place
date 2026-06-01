'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, ShieldAlert, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminTestPortsPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [ports, setPorts] = useState<any[]>([]);
    const [loadingPorts, setLoadingPorts] = useState(false);
    const [newAccountNumber, setNewAccountNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUserEmail(user.email || null);
            setLoadingAuth(false);

            if (user.email === 'juntarasate@gmail.com') {
                fetchTestPorts();
            }
        };
        checkAuth();
    }, [router]);

    const fetchTestPorts = async () => {
        setLoadingPorts(true);
        try {
            const res = await fetch('/api/admin/test-ports');
            if (res.ok) {
                const data = await res.json();
                setPorts(data.ports || []);
            } else {
                toast.error('ไม่สามารถโหลดข้อมูลพอร์ตทดสอบได้');
            }
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoadingPorts(false);
        }
    };

    const handleAddPort = async (e: React.FormEvent) => {
        e.preventDefault();
        const account = newAccountNumber.trim();
        if (!account) {
            toast.error('กรุณากรอกเลขพอร์ต');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/test-ports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ account_number: account }),
            });

            if (res.ok) {
                toast.success(`เพิ่มพอร์ตทดสอบ ${account} เรียบร้อยแล้ว`);
                setNewAccountNumber('');
                fetchTestPorts();
            } else {
                const data = await res.json();
                toast.error(data.error || 'เกิดข้อผิดพลาดในการเพิ่มพอร์ตทดสอบ');
            }
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePort = async (id: string, account: string) => {
        if (!confirm(`ต้องการลบพอร์ตทดสอบ ${account} หรือไม่?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/test-ports?id=${id}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                toast.success(`ลบพอร์ตทดสอบ ${account} เรียบร้อยแล้ว`);
                fetchTestPorts();
            } else {
                const data = await res.json();
                toast.error(data.error || 'ไม่สามารถลบพอร์ตทดสอบได้');
            }
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาดในการลบพอร์ตทดสอบ');
        }
    };

    if (loadingAuth) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (userEmail !== 'juntarasate@gmail.com') {
        return (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h1 className="text-2xl font-bold text-destructive">เข้าถึงถูกปฏิเสธ (Access Denied)</h1>
                <p className="text-muted-foreground text-center max-w-md">
                    หน้านี้อนุญาตให้เฉพาะผู้ดูแลระบบหลัก (juntarasate@gmail.com) เข้าใช้งานเพื่อจัดการระบบพอร์ตทดสอบข้ามสิทธิ์เท่านั้น
                </p>
                <Button onClick={() => router.push('/admin')}>กลับสู่แดชบอร์ด</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">พอร์ตทดสอบพิเศษ (Super Test Ports)</h1>
                <p className="text-muted-foreground">
                    กำหนดหมายเลขพอร์ตทดสอบของ MT5 ที่สามารถผ่านสิทธิ์การใช้งาน (เช็ค Balance และ Product ID) ได้ทั้งหมดโดยไม่ต้องมีลิขสิทธิ์จริง
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-1 border shadow-sm">
                    <CardHeader>
                        <CardTitle>เพิ่มพอร์ตทดสอบใหม่</CardTitle>
                        <CardDescription>
                            กรอกหมายเลขพอร์ต MT5 ของลูกค้า หรือพอร์ตสำหรับทดสอบ เพื่อเปิดใช้งานระบบ bypass ลิขสิทธิ์ชั่วคราว
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddPort} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">หมายเลขพอร์ต (Account Number)</label>
                                <Input
                                    type="text"
                                    placeholder="เช่น 97021489"
                                    value={newAccountNumber}
                                    onChange={(e) => setNewAccountNumber(e.target.value)}
                                    disabled={submitting}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="mr-2 h-4 w-4" />
                                        เพิ่มพอร์ตทดสอบ
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>รายการพอร์ตทดสอบที่เปิดสิทธิ์พิเศษ</CardTitle>
                            <CardDescription>
                                รายการพอร์ตทั้งหมดที่สามารถ bypass ระบบตรวจเช็คลิขสิทธิ์ทั้งหมดได้ขณะนี้
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-1 text-sm bg-yellow-500/10 text-yellow-600 px-3 py-1.5 rounded-full border border-yellow-500/20">
                            <ShieldAlert className="h-4 w-4 text-yellow-600" />
                            Admin Bypass
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loadingPorts ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : ports.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
                                ไม่มีพอร์ตทดสอบพิเศษในระบบขณะนี้
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>หมายเลขพอร์ต</TableHead>
                                            <TableHead>ผู้เพิ่มสิทธิ์</TableHead>
                                            <TableHead>วันที่สร้าง</TableHead>
                                            <TableHead className="text-right">จัดการ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {ports.map((port) => (
                                            <TableRow key={port.id}>
                                                <TableCell className="font-mono font-bold text-foreground">
                                                    {port.account_number}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {port.owner_email}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {new Date(port.created_at).toLocaleString('th-TH')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeletePort(port.id, port.account_number)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <div className="bg-blue-500/10 border border-blue-500/20 text-foreground p-4 rounded-xl flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                    <p className="font-bold text-blue-500">วิธีการทำงานของระบบพอร์ตทดสอบพิเศษ</p>
                    <p className="text-muted-foreground">
                        พอร์ตที่ระบุในรายการนี้จะข้ามผ่านการตรวจสอบลิขสิทธิ์ทั้งหมดของ EasyM MAX, EasyM mini และ EA อื่นๆ ที่เชื่อมต่อผ่านระบบ eaeze.com 
                        โดยเซิร์ฟเวอร์จะตอบกลับผลลัพธ์ว่า "มีลิขสิทธิ์ถูกต้อง" ทันที ไม่ว่าลูกค้าจะเคยสมัครสมาชิกหรือสั่งซื้อหรือไม่ก็ตาม 
                        และระบบจะข้ามการตรวจสอบขั้นต่ำของ Balance และ Product ID ทำให้ทดสอบได้ทันที
                    </p>
                </div>
            </div>
        </div>
    );
}
