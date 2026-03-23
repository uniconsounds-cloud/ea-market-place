'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mail, Shield, CheckCircle2, XCircle, Clock, ShoppingCart, CreditCard, Package, Loader2, Pencil, Trash2, Zap, User, Key, Calendar, ArrowUpDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch";

export default function CustomerDetailsPage() {
    const params = useParams();
    const id = params?.id as string;

    const [profile, setProfile] = useState<any>(null);
    const [activeLicenses, setActiveLicenses] = useState<any[]>([]);
    const [expiredLicenses, setExpiredLicenses] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [groupingMode, setGroupingMode] = useState<'account' | 'product'>('account');

    // --- OTP State & Actions ---
    const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
    const [otpAction, setOtpAction] = useState<'edit_license' | null>(null);
    const [otpCode, setOtpCode] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState('');
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isProcessingOtp, setIsProcessingOtp] = useState(false);

    // --- License Editing State ---
    const [isEditLicenseDialogOpen, setIsEditLicenseDialogOpen] = useState(false);
    const [editingLicense, setEditingLicense] = useState<any | null>(null);
    const [editExpiryDate, setEditExpiryDate] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);

    // License UI Math
    const [expiryOption, setExpiryOption] = useState<string>("custom");
    const [customDate, setCustomDate] = useState<string>("");

    useEffect(() => {
        if (id) fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (profileData) setProfile(profileData);

            // 1.5 Fetch IB Memberships
            const { data: ibData } = await supabase
                .from('ib_memberships')
                .select('verification_data, brokers(name)')
                .eq('user_id', id)
                .eq('status', 'approved');

            let approvedIbAccounts: Record<string, string> = {};
            if (ibData) {
                ibData.forEach(ib => {
                    if (ib.verification_data) {
                        approvedIbAccounts[ib.verification_data] = Array.isArray((ib as any).brokers) ? (ib as any).brokers[0]?.name : (ib as any).brokers?.name || 'Customer';
                    }
                });
            }

            // 2. Fetch Licenses (Active & Expired)
            // Note: We need product details for display
            const { data: rawLicenses } = await supabase
                .from('licenses')
                .select('*, products(name, image_url, platform)')
                .eq('user_id', id)
                .order('expiry_date', { ascending: true });

            const active: any[] = [];
            const expired: any[] = [];

            // Map IB ports
            const mappedLicenses = (rawLicenses || []).map((l: any) => ({
                ...l,
                is_ib: !!approvedIbAccounts[l.account_number] || (profileData?.ib_account_number === l.account_number),
                ib_broker_name: approvedIbAccounts[l.account_number] || (profileData?.ib_account_number === l.account_number ? 'Customer' : undefined)
            }));

            mappedLicenses.forEach((l: any) => {
                if (l.is_active) {
                    active.push(l);
                } else {
                    expired.push(l);
                }
            });

            setActiveLicenses(active);
            setExpiredLicenses(expired);

            // 3. Fetch Orders
            const { data: ordersData } = await supabase
                .from('orders')
                .select('*, products(name)')
                .eq('user_id', id)
                .order('created_at', { ascending: false });

            setOrders(ordersData || []);

        } catch (error) {
            console.error('Error fetching customer details:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateDaysRemaining = (expiryDate: string | null, type: string, isIbPort: boolean) => {
        if (!isIbPort && type === 'lifetime') return 999;
        if (!expiryDate) return 0;

        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleEditLicenseClick = (license: any) => {
        setEditingLicense(license);
        setEditIsActive(license.is_active);
        if (license.expiry_date) {
            const date = new Date(license.expiry_date);
            setEditExpiryDate(date.toISOString().split('T')[0]); // YYYY-MM-DD
            setCustomDate(date.toISOString().split('T')[0]); // For custom option
            setExpiryOption('custom'); // Default to custom if there's an existing date
        } else {
            setEditExpiryDate('');
            setCustomDate('');
            setExpiryOption('custom'); // Default to custom if no existing date
        }
        setIsEditLicenseDialogOpen(true);
    };

    // --- OTP & License Edit Handlers ---
    const handleInitiateOtp = async (action: 'edit_license') => {
        if (!profile) return;
        setIsSendingOtp(true);
        try {
            // Generate a 6-digit basic OTP
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(code);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error("Admin user not found");

            let actionText = action === 'edit_license' ? 'แก้ไขสิทธิ์การใช้งานของลูกค้า (Edit License)' : 'ลบข้อมูล';
            if (action === 'edit_license' && editingLicense) {
                if (editingLicense.is_active && !editIsActive) {
                    actionText = 'ปิดการใช้งานรูท/พอร์ตลูกค้า (Inactive)';
                } else if (!editingLicense.is_active && editIsActive) {
                    actionText = 'เปิดการใช้งานรูท/พอร์ตลูกค้า (Active)';
                }
            }
            const customerName = profile.full_name || profile.email;

            // Call the universal API
            const response = await fetch('/api/admin/send-delete-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    otp: code,
                    actionText: actionText,
                    targetName: customerName
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to send OTP');
            }

            setOtpAction(action);
            setIsOtpDialogOpen(true);

            // Close the edit modal so OTP takes precedence
            if (action === 'edit_license') {
                setIsEditLicenseDialogOpen(false);
            }
        } catch (error) {
            console.error('Error initiating OTP:', error);
            alert('เกิดข้อผิดพลาดในการส่ง OTP กรุณาลองใหม่');
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleConfirmOtp = async () => {
        if (otpCode !== generatedOtp) {
            alert('รหัส OTP ไม่ถูกต้อง!');
            return;
        }

        setIsProcessingOtp(true);
        try {
            if (otpAction === 'edit_license' && editingLicense) {
                await executeEditLicense();
            }
        } catch (error: any) {
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsProcessingOtp(false);
        }
    };

    const executeEditLicense = async () => {
        if (!editingLicense) return;

        try {
            let finalExpiryDate: Date | null = null;
            const now = new Date();

            if (editingLicense.is_ib) {
                if (expiryOption === "1month") {
                    now.setMonth(now.getMonth() + 1);
                    finalExpiryDate = now;
                } else if (expiryOption === "6months") {
                    now.setMonth(now.getMonth() + 6);
                    finalExpiryDate = now;
                } else if (expiryOption === "1year") {
                    now.setFullYear(now.getFullYear() + 1);
                    finalExpiryDate = now;
                } else if (expiryOption === "custom" && customDate) { // custom
                    finalExpiryDate = new Date(customDate);
                }
            } else if (editingLicense.type !== 'lifetime' && editExpiryDate) {
                finalExpiryDate = new Date(editExpiryDate);
            }

            const { error } = await supabase
                .from('licenses')
                .update({
                    expiry_date: finalExpiryDate ? finalExpiryDate.toISOString() : null,
                    is_active: editIsActive
                })
                .eq('id', editingLicense.id);

            if (error) throw error;

            alert('แก้ไขสิทธิ์การใช้งานสำเร็จแล้ว');

            // Cleanup
            setEditingLicense(null);
            setOtpAction(null);
            setOtpCode('');
            setIsOtpDialogOpen(false);
            setIsEditLicenseDialogOpen(false); // Close edit dialog as well

            // Refresh purely licenses data
            fetchData();
        } catch (err: any) {
            console.error("Failed to update license:", err);
            throw new Error(err.message || "Failed to update license data to database.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-muted-foreground">กำลังโหลดข้อมูลลูกค้า...</div>;
    }

    if (!profile) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold mb-4">ไม่พบข้อมูลลูกค้า</h2>
                <Link href="/admin/users">
                    <Button>กลับหน้ารายชื่อ</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/users">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">{profile.full_name || 'No Name'}</h1>
                    <div className="flex items-center gap-4 text-muted-foreground text-sm mt-1">
                        <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {profile.email}
                        </span>
                        <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" /> {profile.role}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-card to-card/50 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">สินค้าที่ใช้งานอยู่ (Active)</CardTitle>
                        <Package className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeLicenses.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-card/50 border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">คำสั่งซื้อทั้งหมด (Orders)</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{orders.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-card/50 border-orange-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">ยอดใช้จ่ายรวม (Total Spent)</CardTitle>
                        <CreditCard className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ฿{orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (o.amount || 0), 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="products" className="w-full">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                    <TabsTrigger value="products">สินค้า & Licenses</TabsTrigger>
                    <TabsTrigger value="orders">ประวัติคำสั่งซื้อ</TabsTrigger>
                </TabsList>

                {/* --- TAB 1: PRODUCTS --- */}
                <TabsContent value="products" className="space-y-8 mt-6">

                    {/* Active Products Section */}
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <CheckCircle2 className="text-green-500 w-5 h-5" /> สินค้าที่ใช้งานอยู่ (Active Products)
                                </h2>
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                    {activeLicenses.length} รายการ
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
                                <span className="text-xs text-muted-foreground px-2">Group by:</span>
                                <Tabs value={groupingMode} onValueChange={(v) => setGroupingMode(v as 'account' | 'product')} className="w-auto">
                                    <TabsList className="h-8">
                                        <TabsTrigger value="account" className="text-xs px-3">Account (Port)</TabsTrigger>
                                        <TabsTrigger value="product" className="text-xs px-3">Product Name</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        </div>

                        <div className="grid gap-6">
                            {activeLicenses.length > 0 ? (
                                Object.entries(
                                    activeLicenses.reduce((acc: any, license) => {
                                        const key = groupingMode === 'account'
                                            ? (license.account_number || 'No Account')
                                            : (license.products?.name || 'Unknown Product');

                                        if (!acc[key]) acc[key] = [];
                                        acc[key].push(license);
                                        return acc;
                                    }, {})
                                ).map(([groupKey, licenses]: [string, any]) => (
                                    <div key={groupKey} className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            {groupingMode === 'account' ? (
                                                <div className="flex items-center gap-2 bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-sm font-medium">
                                                    <Shield className="w-4 h-4" /> Port: {groupKey}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 bg-purple-500/10 text-purple-500 px-3 py-1 rounded-full text-sm font-medium">
                                                    <Package className="w-4 h-4" /> Product: {groupKey}
                                                </div>
                                            )}
                                            <div className="h-px bg-border flex-1"></div>
                                        </div>

                                        <div className="grid gap-4 pl-4 border-l-2 border-muted ml-4">
                                            {licenses.map((license: any) => {
                                                const daysRemaining = calculateDaysRemaining(license.expiry_date, license.type, license.is_ib);
                                                const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;

                                                return (
                                                    <Card key={license.id} className="overflow-hidden hover:bg-muted/30 transition-colors">
                                                        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                            <div className="flex items-center gap-4">
                                                                <div className="h-10 w-10 rounded-lg bg-gray-900 border border-border flex items-center justify-center overflow-hidden shrink-0">
                                                                    {license.products?.image_url ? (
                                                                        <img src={license.products.image_url} alt={license.products.name} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        <Package className="text-muted-foreground w-5 h-5" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-bold text-base">{license.products?.name || 'Unknown Product'}</h3>
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                        <Badge variant="secondary" className="text-[10px] h-5">{license.products?.platform || 'MT4'}</Badge>
                                                                        {license.is_ib && (
                                                                            <Badge variant="outline" className="text-[10px] h-5 bg-blue-500/10 text-blue-500 border-blue-500/20">
                                                                                IB {license.ib_broker_name || 'Port'}
                                                                            </Badge>
                                                                        )}
                                                                        <span>Account: <span className="font-mono text-foreground font-medium">{license.account_number}</span></span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                                                <div className="text-right">
                                                                    <div className={`font-mono text-sm flex items-center justify-end gap-2 ${isExpiringSoon ? 'text-orange-500 font-bold' : ''}`}>
                                                                        <Clock className="w-3 h-3" />
                                                                        {(!license.is_ib && license.type === 'lifetime') ? 'ตลอดชีพ' : (license.expiry_date ? new Date(license.expiry_date).toLocaleDateString('th-TH') : '-')}
                                                                    </div>
                                                                    <div className="text-[10px] text-green-500">
                                                                        {(!license.is_ib && license.type === 'lifetime') ? '' : `เหลือ ${daysRemaining} วัน`}
                                                                    </div>
                                                                </div>
                                                                <Badge className="bg-green-500 hover:bg-green-600 h-6">Active</Badge>

                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="shrink-0"
                                                                    onClick={() => {
                                                                        setEditingLicense(license);
                                                                        setIsEditLicenseDialogOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 border border-dashed rounded-xl text-muted-foreground bg-muted/20">
                                    ลูกค้ายังไม่มีสินค้าที่ใช้งานอยู่ในขณะนี้
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Expired/History Section */}
                    <div className="space-y-4 pt-8 border-t">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-muted-foreground">
                                <Clock className="w-5 h-5" /> ประวัติการใช้งาน (History / Expired)
                            </h2>
                            <Badge variant="outline">{expiredLicenses.length} รายการ</Badge>
                        </div>

                        <div className="bg-muted/20 rounded-xl overflow-hidden border border-border/50">
                            {expiredLicenses.length > 0 ? (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">สินค้า</th>
                                            <th className="px-6 py-4">Account</th>
                                            <th className="px-6 py-4">หมดอายุเมื่อ</th>
                                            <th className="px-6 py-4 text-center">สถานะ</th>
                                            <th className="px-6 py-4 text-right">จัดการ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {expiredLicenses.map((license) => (
                                            <tr key={license.id} className="hover:bg-muted/30">
                                                <td className="px-6 py-4 font-medium text-muted-foreground">
                                                    {license.products?.name || 'Unknown'}
                                                </td>
                                                <td className="px-6 py-4 font-mono text-muted-foreground">
                                                    {license.account_number}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    {new Date(license.expiry_date).toLocaleDateString('th-TH')}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Badge variant="secondary" className="bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                                        Inactive / Expired
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditLicenseClick(license)}
                                                        className="text-primary hover:text-primary hover:bg-primary/10"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    ไม่มีประวัติการใช้งานเดิม
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                {/* --- TAB 2: ORDERS --- */}
                <TabsContent value="orders" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>ประวัติการสั่งซื้อ (Order History)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="relative overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                                        <tr>
                                            <th className="px-6 py-3">Order ID</th>
                                            <th className="px-6 py-3">วันที่สั่งซื้อ</th>
                                            <th className="px-6 py-3">สินค้า</th>
                                            <th className="px-6 py-3 text-right">ยอดชำระ</th>
                                            <th className="px-6 py-3 text-center">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {orders.length > 0 ? orders.map((order) => (
                                            <tr key={order.id} className="hover:bg-muted/30">
                                                <td className="px-6 py-4 font-mono text-xs">
                                                    {order.id.slice(0, 8)}...
                                                </td>
                                                <td className="px-6 py-4">
                                                    {new Date(order.created_at).toLocaleString('th-TH')}
                                                </td>
                                                <td className="px-6 py-4 font-medium">
                                                    {order.products?.name || 'Unknown Product'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold">
                                                    ฿{order.amount?.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {order.status === 'completed' ? (
                                                        <Badge className="bg-green-500">Completed</Badge>
                                                    ) : order.status === 'pending' ? (
                                                        <Badge variant="outline" className="text-yellow-500 border-yellow-500">Pending</Badge>
                                                    ) : (
                                                        <Badge variant="destructive">{order.status}</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                                    ยังไม่มีประวัติการสั่งซื้อ
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit License Dialog */}
            <Dialog open={isEditLicenseDialogOpen} onOpenChange={setIsEditLicenseDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-primary" /> จัดการสิทธิ์การใช้งาน
                        </DialogTitle>
                    </DialogHeader>

                    {editingLicense && (
                        <div className="space-y-6 my-4">
                            {/* Read-only Data */}
                            <div className="bg-muted p-4 rounded-lg space-y-3 text-sm">
                                <div className="flex gap-2 items-start">
                                    <User className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                                    <div>
                                        <div className="font-bold">{profile?.full_name || 'ผู้ใช้งาน'}</div>
                                        <div className="text-muted-foreground">{profile?.email}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div>
                                        <strong>{editingLicense.products?.name}</strong>
                                        <span className="text-muted-foreground ml-2">({editingLicense.type})</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Key className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div>
                                        พอร์ตหมายเลข: <strong className="font-mono">{editingLicense.account_number}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border rounded-lg p-3">
                                    <div className="space-y-0.5">
                                        <Label>สถานะการใช้งาน (Active Target)</Label>
                                        <p className="text-xs text-muted-foreground">เปิด/ปิด สิทธิ์การใช้ EA พอร์ตนี้</p>
                                    </div>
                                    <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
                                </div>

                                {editingLicense.is_ib ? (
                                    <div className="space-y-3 pt-2 border-t border-border">
                                        <Label className="flex items-center gap-2 text-blue-600 font-bold">
                                            <Zap className="w-4 h-4" /> ปรับอายุสิทธิ์ IB (IB {editingLicense.ib_broker_name || 'Customer'})
                                        </Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={expiryOption === "1month" ? "default" : "outline"}
                                                className={expiryOption === "1month" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                                onClick={() => setExpiryOption("1month")}
                                            >
                                                1 เดือน
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={expiryOption === "6months" ? "default" : "outline"}
                                                className={expiryOption === "6months" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                                onClick={() => setExpiryOption("6months")}
                                            >
                                                6 เดือน
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={expiryOption === "1year" ? "default" : "outline"}
                                                className={expiryOption === "1year" ? "bg-primary text-primary-foreground" : "text-foreground"}
                                                onClick={() => setExpiryOption("1year")}
                                            >
                                                1 ปี
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
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
                                                        min={new Date().toISOString().split('T')[0]}
                                                        required={expiryOption === "custom"}
                                                    />
                                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">วันหมดอายุเดิม: {editingLicense.expiry_date ? formatDate(editingLicense.expiry_date) : '-'}</p>
                                    </div>
                                ) : (!editingLicense.is_ib && editingLicense.type !== 'lifetime') ? (
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" /> วันหมดอายุ (Expiry Date)
                                        </Label>
                                        <Input
                                            type="datetime-local"
                                            value={editExpiryDate}
                                            onChange={(e) => setEditExpiryDate(e.target.value)}
                                        />
                                    </div>
                                ) : (
                                    <div className="text-center p-3 border border-orange-200 bg-orange-50 text-orange-800 rounded-lg text-sm">
                                        สิทธิ์การใช้งานแบบตลอดชีพ ไม่ต้องตั้งวันหมดอายุ
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditLicenseDialogOpen(false)} disabled={isSendingOtp}>
                            ยกเลิก
                        </Button>
                        <Button onClick={() => handleInitiateOtp('edit_license')} disabled={isSendingOtp}>
                            {isSendingOtp ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่ง OTP...
                                </>
                            ) : (
                                'บันทึกด้วย OTP'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* OTP Confirmation Dialog */}
            <Dialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>ยืนยันการทำรายการด้วยรหัส OTP</DialogTitle>
                        <DialogDescription>
                            ระบบได้ส่งรหัส OTP แบบใช้ครั้งเดียวไปที่อีเมลของแอดมินแล้ว โปรดนำรหัสมากรอกเพื่อยืนยันการตั้งค่า
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="otp">รหัส OTP 6 หลัก</Label>
                            <Input
                                id="otp"
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                placeholder="123456"
                                className="text-center font-mono text-2xl tracking-widest h-14"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setIsOtpDialogOpen(false);
                            setOtpCode('');
                            setOtpAction(null);
                        }} disabled={isProcessingOtp}>
                            ยกเลิก
                        </Button>
                        <Button
                            variant="default" // always default for edit
                            onClick={handleConfirmOtp}
                            disabled={!otpCode || otpCode.length !== 6 || isProcessingOtp}
                        >
                            {isProcessingOtp ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังตรวจสอบ...
                                </>
                            ) : (
                                'ยืนยัน OTP'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
