'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Upload, Loader2, Save, CreditCard, ShoppingCart, Users, CheckCircle2, Clock, Search, Trash2, Mail, Pencil } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import Link from 'next/link';

// Use 'new' as a special ID for creating
export default function ProductFormPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const isNew = id === 'new';

    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // --- Data for Overview Tab ---
    interface LicenseData {
        id: string;
        user_id: string;
        account_number: string;
        expiry_date: string;
        is_active: boolean;
        profiles?: {
            email: string;
            full_name: string;
        };
    }

    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalSales: 0,
        activeUsers: 0
    });
    const [activeLicenses, setActiveLicenses] = useState<LicenseData[]>([]);
    const [loadingStats, setLoadingStats] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // --- OTP & Flow State ---
    const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
    const [otpAction, setOtpAction] = useState<'delete_product' | 'edit_license' | null>(null);
    const [otpCode, setOtpCode] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState('');
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isProcessingOtp, setIsProcessingOtp] = useState(false);

    // --- License Edit State ---
    const [isEditLicenseDialogOpen, setIsEditLicenseDialogOpen] = useState(false);
    const [editingLicense, setEditingLicense] = useState<LicenseData | null>(null);

    // --- Data for Edit Tab ---
    const [formData, setFormData] = useState({
        name: '',
        product_key: '',
        description: '',
        price_monthly: '',
        price_quarterly: '',
        price_lifetime: '',
        image_url: '',
        file_url: '',
        version: '1.0',
        is_active: true,
        platform: 'mt4',
        asset_class: 'gold',
        strategy: 'trend_following'
    });

    useEffect(() => {
        if (!isNew && id) {
            fetchProduct();
            // If not new, fetch stats
            fetchStats();
        } else {
            // If new product, default to edit tab
            setActiveTab('edit');
        }
    }, [id]);

    const fetchProduct = async () => {
        const { data } = await supabase.from('products').select('*').eq('id', id).single();
        if (data) {
            setFormData({
                name: data.name,
                product_key: data.product_key || '',
                description: data.description || '',
                price_monthly: data.price_monthly,
                price_quarterly: data.price_quarterly || '',
                price_lifetime: data.price_lifetime,
                image_url: data.image_url || '',
                file_url: data.file_url || '',
                version: data.version || '1.0',
                is_active: data.is_active,
                platform: data.platform || 'mt4',
                asset_class: data.asset_class || 'gold',
                strategy: data.strategy || 'trend_following'
            });
        }
    };

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            // 1. Get Orders (Completed) for Revenue & Sales
            const { data: orders } = await supabase
                .from('orders')
                .select('amount')
                .eq('product_id', id)
                .eq('status', 'completed');

            const totalSales = orders?.length || 0;
            const totalRevenue = orders?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;

            // 2. Get Active Licenses (Step 1: Fetch Licenses)
            const { data: licenses, error: licenseError } = await supabase
                .from('licenses')
                .select('*')
                .eq('product_id', id)
                .eq('is_active', true)
                .order('expiry_date', { ascending: true });

            if (licenseError) throw licenseError;

            const licensesData: LicenseData[] = [];
            const rawLicenses = licenses || [];

            if (rawLicenses.length > 0) {
                // Step 2: Extract User IDs
                const userIds = Array.from(new Set(rawLicenses.map(l => l.user_id)));

                // Step 3: Fetch Profiles
                const { data: profiles, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, email, full_name') // Explicitly select columns, NO created_at
                    .in('id', userIds);

                if (profileError) console.error("Error fetching profiles:", profileError);

                // Step 4: Map Profiles to Licenses
                const profileMap = new Map(profiles?.map(p => [p.id, p]));

                rawLicenses.forEach((l: any) => {
                    licensesData.push({
                        ...l,
                        profiles: profileMap.get(l.user_id) || { email: 'Unknown', full_name: 'Unknown' }
                    });
                });
            }

            const activeUsers = licensesData.length;

            setStats({ totalRevenue, totalSales, activeUsers });
            setActiveLicenses(licensesData);

        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    // ... (handleChange and handleImageUpload remain the same) ...
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0) return;
            setUploading(true);
            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('products').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('products').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
            alert('อัพโหลดรูปภาพสำเร็จ!');
        } catch (error: any) {
            alert('Error uploading image: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            if (!e.target.files || e.target.files.length === 0) return;
            setUploading(true);
            const file = e.target.files[0];
            const randomPrefix = Math.floor(1000 + Math.random() * 9000);
            const fileName = `${randomPrefix}_${file.name}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage.from('ea_files').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('ea_files').getPublicUrl(filePath);
            setFormData(prev => ({ ...prev, file_url: data.publicUrl }));
            alert('อัพโหลดไฟล์ EA สำเร็จ!');
        } catch (error: any) {
            alert('Error uploading file: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name: formData.name,
                product_key: formData.product_key || null,
                description: formData.description,
                price_monthly: parseFloat(formData.price_monthly),
                price_quarterly: formData.price_quarterly ? parseFloat(formData.price_quarterly) : null,
                price_lifetime: parseFloat(formData.price_lifetime),
                image_url: formData.image_url,
                file_url: formData.file_url,
                version: formData.version,
                is_active: formData.is_active,
                platform: formData.platform,
                asset_class: formData.asset_class,
                strategy: formData.strategy,
            };

            let error;
            if (isNew) {
                const { error: insertError } = await supabase.from('products').insert([payload]);
                error = insertError;
            } else {
                const { error: updateError } = await supabase.from('products').update(payload).eq('id', id);
                error = updateError;
            }

            if (error) throw error;
            alert('บันทึกข้อมูลสำเร็จ!');
            router.push('/admin/products');
            router.refresh();
        } catch (error: any) {
            alert('Error saving product: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateDaysRemaining = (expiryDate: string) => {
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const filteredLicenses = activeLicenses.filter(license => {
        const query = searchQuery.toLowerCase();
        const portMatch = license.account_number.toLowerCase().includes(query);
        const nameMatch = (license.profiles?.full_name || '').toLowerCase().includes(query);
        const emailMatch = (license.profiles?.email || '').toLowerCase().includes(query);
        return portMatch || nameMatch || emailMatch;
    });

    // --- OTP Handlers ---
    const handleInitiateOtp = async (action: 'delete_product' | 'edit_license') => {
        setIsSendingOtp(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) {
                alert('ไม่พบข้อมูลอีเมลของแอดมิน');
                return;
            }

            let actionText = '';
            let targetName = '';

            if (action === 'delete_product') {
                actionText = 'การลบสินค้า';
                targetName = `สินค้า: ${formData.name || id}`;
            } else if (action === 'edit_license') {
                actionText = 'การแก้ไขข้อมูล License';
                targetName = `License พอร์ต ${editingLicense?.account_number} ของคุณ ${editingLicense?.profiles?.full_name || 'ไม่ระบุชื่อ'}`;
            }

            const res = await fetch('/api/admin/send-delete-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, productId: id, actionText, targetName })
            });

            const result = await res.json();
            if (res.ok) {
                setGeneratedOtp(result.otp);
                setOtpAction(action);
                setIsOtpDialogOpen(true);

                // Close the license dialog if we were in it so OTP dialog is clearer
                if (action === 'edit_license') {
                    setIsEditLicenseDialogOpen(false);
                }

                if (result.devMode) {
                    alert(`[DEV MODE] ⚠️ ยังไม่ได้ตั้งค่าระบบส่งอีเมล\n\nรหัส OTP จำลองสำหรับทดสอบคือ: ${result.otp}`);
                }
            } else {
                alert('ส่งขอ OTP ล้มเหลว: ' + result.error);
            }
        } catch (err: any) {
            alert('เกิดข้อผิดพลาดในการส่งรหัส: ' + err.message);
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleConfirmOtp = async () => {
        if (!otpCode || otpCode.trim() !== generatedOtp) {
            alert('รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
            return;
        }

        setIsProcessingOtp(true);
        if (otpAction === 'delete_product') {
            await executeDeleteProduct();
        } else if (otpAction === 'edit_license') {
            await executeEditLicense();
        }
        setIsProcessingOtp(false);
    };

    const executeDeleteProduct = async () => {
        try {
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) throw error;

            alert('ลบสินค้าและข้อมูลเรียบร้อยแล้ว');
            setIsOtpDialogOpen(false);
            router.push('/admin/products');
            router.refresh();
        } catch (error: any) {
            alert('ลบไม่สำเร็จ: ' + error.message);
        }
    };

    const executeEditLicense = async () => {
        if (!editingLicense) return;
        try {
            const { error } = await supabase
                .from('licenses')
                .update({
                    expiry_date: editingLicense.expiry_date,
                    is_active: editingLicense.is_active
                })
                .eq('id', editingLicense.id);

            if (error) throw error;

            alert('อัพเดท License สำเร็จ!');
            setIsOtpDialogOpen(false);
            setEditingLicense(null);
            fetchStats(); // Refresh table
        } catch (error: any) {
            alert('อัพเดท License ไม่สำเร็จ: ' + error.message);
        }
    };

    const openEditLicense = (license: LicenseData) => {
        setEditingLicense({ ...license }); // Copy to avoid mutating display data immediately
        setIsEditLicenseDialogOpen(true);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">
                        {isNew ? 'เพิ่มสินค้าใหม่' : formData.name || 'Loading...'}
                    </h1>
                    {!isNew && <p className="text-muted-foreground text-sm">จัดการข้อมูลและดูสถิติสินค้า</p>}
                </div>
            </div>

            {isNew ? (
                // If creating new, just show the form directly (no tabs needed really, but kept simple)
                <div className="bg-card p-8 rounded-xl border border-border">
                    <EditForm
                        formData={formData}
                        setFormData={setFormData}
                        handleChange={handleChange}
                        handleImageUpload={handleImageUpload}
                        handleFileUpload={handleFileUpload}
                        handleSubmit={handleSubmit}
                        loading={loading}
                        uploading={uploading}
                    />
                </div>
            ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full md:w-[400px] grid-cols-2">
                        <TabsTrigger value="overview">ภาพรวม & ผู้ใช้ (Overview)</TabsTrigger>
                        <TabsTrigger value="edit">แก้ไขสินค้า (Edit)</TabsTrigger>
                    </TabsList>

                    {/* --- TAB 1: OVERVIEW --- */}
                    <TabsContent value="overview" className="space-y-6 mt-6">
                        {/* Stats Cards */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card className="bg-gradient-to-br from-card to-card/50 border-green-500/20 shadow-lg shadow-green-500/5">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">รายได้รวม (Total Revenue)</CardTitle>
                                    <CreditCard className="h-4 w-4 text-green-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">฿{stats.totalRevenue.toLocaleString()}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-card to-card/50 border-blue-500/20 shadow-lg shadow-blue-500/5">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขาย (Sales)</CardTitle>
                                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.totalSales}</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-gradient-to-br from-card to-card/50 border-orange-500/20 shadow-lg shadow-orange-500/5">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">ผู้ใช้งาน (Active Users)</CardTitle>
                                    <Users className="h-4 w-4 text-orange-500" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{stats.activeUsers}</div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Active Licenses Table */}
                        <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
                            <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b">
                                <div className="space-y-1.5">
                                    <h3 className="font-semibold leading-none tracking-tight">Active Licenses (ลูกค้าที่ใช้งานอยู่)</h3>
                                    <p className="text-sm text-muted-foreground">รายชื่อลูกค้าและสถานะพอร์ตการลงทุน</p>
                                </div>
                                <div className="relative w-full md:w-72">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        type="search"
                                        placeholder="ค้นหา พอร์ต, ชื่อ, หรือ อีเมล..."
                                        className="pl-8"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="p-0 overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4 font-medium">ลูกค้า (User)</th>
                                            <th className="px-6 py-4 font-medium">Account / Port</th>
                                            <th className="px-6 py-4 font-medium">วันหมดอายุ (Expiry)</th>
                                            <th className="px-6 py-4 font-medium text-center">สถานะ</th>
                                            <th className="px-6 py-4 font-medium string-center w-[80px]"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {loadingStats ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                                    <Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />
                                                    กำลังโหลดข้อมูล...
                                                </td>
                                            </tr>
                                        ) : filteredLicenses.length > 0 ? (
                                            filteredLicenses.map((license) => {
                                                const daysRemaining = calculateDaysRemaining(license.expiry_date);
                                                const isExpiringSoon = daysRemaining <= 7 && daysRemaining > 0;
                                                const isExpired = daysRemaining <= 0;

                                                return (
                                                    <tr key={license.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-foreground">
                                                                {license.profiles?.full_name || 'Unknown'}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {license.profiles?.email || license.user_id}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="font-mono bg-muted/50 px-2 py-1 rounded w-fit text-xs">
                                                                {license.account_number}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`flex items-center gap-2 ${isExpiringSoon ? 'text-orange-500 font-bold' : isExpired ? 'text-red-500' : ''}`}>
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(license.expiry_date).toLocaleDateString('th-TH')}
                                                                <span className="text-xs opacity-70">
                                                                    ({isExpired ? 'หมดอายุ' : `เหลือ ${daysRemaining} วัน`})
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {license.is_active ? (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">
                                                                    Inactive
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <Button variant="ghost" size="icon" onClick={() => openEditLicense(license)} title="แก้ไข License">
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                                    {searchQuery ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'ยังไม่มีลูกค้าใช้งานสินค้านี้'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>

                    {/* --- TAB 2: EDIT FORM --- */}
                    <TabsContent value="edit" className="mt-6">
                        <div className="bg-card p-8 rounded-xl border border-border">
                            <EditForm
                                formData={formData}
                                setFormData={setFormData}
                                handleChange={handleChange}
                                handleImageUpload={handleImageUpload}
                                handleFileUpload={handleFileUpload}
                                handleSubmit={handleSubmit}
                                loading={loading}
                                uploading={uploading}
                            />

                            {!isNew && (
                                <div className="mt-12 pt-8 border-t border-red-500/20">
                                    <div className="flex items-center justify-between p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                                        <div className="space-y-1">
                                            <h4 className="font-semibold text-red-500 flex items-center gap-2">
                                                <Trash2 className="h-4 w-4" /> เขตอันตราย (Danger Zone)
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                การลบสินค้าจะลบข้อมูลประวัติการทำรายการและใบอนุญาตทั้งหมดที่เชื่อมโยงกับสินค้านี้
                                            </p>
                                        </div>
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleInitiateOtp('delete_product')}
                                            disabled={isSendingOtp || uploading}
                                        >
                                            {isSendingOtp && otpAction === 'delete_product' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                            {isSendingOtp && otpAction === 'delete_product' ? 'กำลังส่งรหัสผ่าน...' : 'ลบสินค้านี้'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            )}

            {/* OTP Confirmation Dialog */}
            <Dialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className={`flex items-center gap-2 ${otpAction === 'delete_product' ? 'text-red-500' : 'text-primary'}`}>
                            {otpAction === 'delete_product' ? <Trash2 className="h-5 w-5" /> : <Save className="h-5 w-5" />}
                            {otpAction === 'delete_product' ? 'ยืนยันการลบสินค้า' : 'ยืนยันการอัพเดท License'}
                        </DialogTitle>
                        <DialogDescription className="space-y-4 pt-4">
                            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                                <Mail className="h-8 w-8 text-primary shrink-0 mt-1" />
                                <div>
                                    <h4 className="font-medium text-foreground">ระบบได้ส่งรหัส OTP 6 หลักไปที่อีเมลแอดมินของคุณแล้ว</h4>
                                    <p className="text-sm mt-1">กรุณานำรหัสจากอีเมลมากรอกเพื่อยืนยันรายการ (ป้องกันความผิดพลาด)</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="otp">รหัส OTP 6 หลัก</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    maxLength={6}
                                    placeholder="XXXXXX"
                                    className="text-center text-xl tracking-[0.5em] font-mono h-14"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                                />
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsOtpDialogOpen(false)} disabled={isProcessingOtp}>
                            ยกเลิก
                        </Button>
                        <Button
                            variant={otpAction === 'delete_product' ? 'destructive' : 'default'}
                            onClick={handleConfirmOtp}
                            disabled={isProcessingOtp || otpCode.length !== 6}
                        >
                            {isProcessingOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            ยืนยัน
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* License Edit Dialog */}
            <Dialog open={isEditLicenseDialogOpen} onOpenChange={setIsEditLicenseDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>แก้ไข License</DialogTitle>
                    </DialogHeader>
                    {editingLicense && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                                    <Label className="text-xs text-muted-foreground">ลูกค้า</Label>
                                    <p className="font-medium text-sm">{editingLicense.profiles?.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{editingLicense.profiles?.email}</p>
                                </div>
                                <div className="space-y-2 bg-muted/50 p-3 rounded-lg">
                                    <Label className="text-xs text-muted-foreground">หมายเลขพอร์ต</Label>
                                    <p className="font-mono font-medium text-sm">{editingLicense.account_number}</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>วันหมดอายุ (Expiry Date)</Label>
                                <Input
                                    type="datetime-local"
                                    value={new Date(new Date(editingLicense.expiry_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                                    onChange={(e) => {
                                        setEditingLicense({
                                            ...editingLicense,
                                            expiry_date: new Date(e.target.value).toISOString()
                                        });
                                    }}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>สถานะการใช้งาน (Active Status)</Label>
                                <Select
                                    value={editingLicense.is_active ? 'active' : 'inactive'}
                                    onValueChange={(v) => setEditingLicense({ ...editingLicense, is_active: v === 'active' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกสถานะ" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">
                                            <div className="flex items-center text-green-500 font-medium">
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> ใช้งานได้ (Active)
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="inactive">
                                            <div className="flex items-center text-red-500 font-medium">
                                                ระงับการใช้งาน (Inactive)
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditLicenseDialogOpen(false)} disabled={isSendingOtp}>
                            ยกเลิก
                        </Button>
                        <Button onClick={() => handleInitiateOtp('edit_license')} disabled={isSendingOtp}>
                            {isSendingOtp && otpAction === 'edit_license' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSendingOtp && otpAction === 'edit_license' ? 'กำลังขอรหัส OTP...' : 'บันทึกและขอ OTP'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Extracted Form Component for cleanliness
function EditForm({ formData, setFormData, handleChange, handleImageUpload, handleFileUpload, handleSubmit, loading, uploading }: any) {
    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            {/* Image Upload Block */}
            <div className="space-y-2">
                <label className="text-sm font-medium">รูปภาพสินค้า</label>
                <div className="flex items-center gap-4">
                    <div className="h-32 w-32 bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden border border-dashed border-gray-600">
                        {formData.image_url ? (
                            <img src={formData.image_url} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-xs text-muted-foreground">No Image</span>
                        )}
                    </div>
                    <div className="flex-1">
                        <input
                            type="file"
                            accept="image/*"
                            id="image-upload"
                            className="hidden"
                            onChange={handleImageUpload}
                            disabled={uploading}
                        />
                        <label htmlFor="image-upload">
                            <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2 cursor-pointer">
                                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดรูปภาพ'}
                            </div>
                        </label>
                        <p className="text-xs text-muted-foreground mt-2">
                            รองรับไฟล์ JPG, PNG (แนะนำขนาด 1280x1280px หรือรูปแนวนอน)
                        </p>
                    </div>
                </div>
            </div>

            {/* File Upload Block */}
            <div className="space-y-2">
                <label className="text-sm font-medium">ไฟล์ EA (.ex4, .ex5, .zip)</label>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Input
                                value={formData.file_url}
                                readOnly
                                placeholder="URL ของไฟล์ (อัพโหลดหรือใส่เอง)"
                                className="bg-muted"
                            />
                        </div>
                        <input
                            type="file"
                            accept=".ex4,.ex5,.zip,.rar"
                            id="file-upload"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                        <label htmlFor="file-upload">
                            <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 cursor-pointer w-full">
                                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                {uploading ? 'กำลังอัพโหลด...' : 'อัพโหลดไฟล์ EA'}
                            </div>
                        </label>
                        <p className="text-xs text-muted-foreground mt-2">
                            อัพโหลดไฟล์ EA ที่ลูกค้าจะได้รับเมื่อชำระเงิน
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">ชื่อ EA</label>
                    <Input
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="Ex. Gold Scalper Pro"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Product Key (สำหรับ EA)</label>
                    <Input
                        name="product_key"
                        value={formData.product_key}
                        onChange={handleChange}
                        placeholder="Ex. GOLD-EA-V1"
                        className="font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">ใช้ใส่ในโค้ด EA (ถ้าว่างไว้จะใช้ UUID)</p>
                </div>
            </div>

            <div className="space-y-6 p-6 bg-muted/20 rounded-lg border border-border/50">
                <h3 className="text-lg font-semibold">ข้อมูลจำเพาะ (Specifications)</h3>

                {/* Platform Radio Group */}
                <div className="space-y-3">
                    <Label>Platform (แพลตฟอร์ม)</Label>
                    <RadioGroup
                        value={formData.platform}
                        onValueChange={(value) => setFormData((prev: any) => ({ ...prev, platform: value }))}
                        className="flex space-x-4"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mt4" id="mt4" />
                            <Label htmlFor="mt4" className="cursor-pointer">MetaTrader 4 (MT4)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mt5" id="mt5" />
                            <Label htmlFor="mt5" className="cursor-pointer">MetaTrader 5 (MT5)</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Asset Class Select */}
                    <div className="space-y-2">
                        <Label>Asset Class (สินทรัพย์ที่เทรด)</Label>
                        <Select
                            value={formData.asset_class}
                            onValueChange={(value) => setFormData((prev: any) => ({ ...prev, asset_class: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="เลือกสินทรัพย์" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="gold">Gold (XAUUSD)</SelectItem>
                                <SelectItem value="silver">Silver (XAGUSD)</SelectItem>
                                <SelectItem value="currency">Forex Currency Pairs</SelectItem>
                                <SelectItem value="crypto">Cryptocurency</SelectItem>
                                <SelectItem value="indices">Indices</SelectItem>
                                <SelectItem value="commodities">Commodities</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Strategy Select */}
                    <div className="space-y-2">
                        <Label>Strategy (กลยุทธ์)</Label>
                        <Select
                            value={formData.strategy}
                            onValueChange={(value) => setFormData((prev: any) => ({ ...prev, strategy: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="เลือกกลยุทธ์" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="scalping">Scalping (ทำกำไรระยะสั้น)</SelectItem>
                                <SelectItem value="trend_following">Trend Following (ตามเทรนด์)</SelectItem>
                                <SelectItem value="grid">Grid System (แก้ไม้)</SelectItem>
                                <SelectItem value="martingale">Martingale (เบิ้ลไม้)</SelectItem>
                                <SelectItem value="hedging">Hedging</SelectItem>
                                <SelectItem value="swing_trading">Swing Trading</SelectItem>
                                <SelectItem value="day_trading">Day Trading</SelectItem>
                                <SelectItem value="news_trading">News Trading (ชนข่าว)</SelectItem>
                                <SelectItem value="arbitrage">Arbitrage</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">รายละเอียด</label>
                <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="รายละเอียดของระบบ..."
                />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">ราคา (รายเดือน) ฿</label>
                    <Input
                        type="number"
                        name="price_monthly"
                        value={formData.price_monthly}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">ราคา (3 เดือน) ฿</label>
                    <Input
                        type="number"
                        name="price_quarterly"
                        value={formData.price_quarterly}
                        onChange={handleChange}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">ราคา (ถาวร) ฿</label>
                    <Input
                        type="number"
                        name="price_lifetime"
                        value={formData.price_lifetime}
                        onChange={handleChange}
                        required
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Version</label>
                    <Input
                        name="version"
                        value={formData.version}
                        onChange={handleChange}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">สถานะ</label>
                    <div className="flex items-center gap-2 h-10">
                        <input
                            type="checkbox"
                            checked={formData.is_active}
                            onChange={(e) => setFormData((p: any) => ({ ...p, is_active: e.target.checked }))}
                            className="h-5 w-5"
                        />
                        <span className="text-sm">เปิดขาย</span>
                    </div>
                </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || uploading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                บันทึกข้อมูล
            </Button>
        </form>
    );
}
