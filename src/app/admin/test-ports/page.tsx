'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Trash2, 
    Plus, 
    Loader2, 
    ShieldAlert, 
    HelpCircle, 
    Download, 
    Search, 
    FileCode, 
    Copy, 
    Check, 
    Sparkles, 
    Cpu, 
    Coins, 
    Bot,
    ExternalLink,
    RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface DownloadableEA {
    id: string;
    name: string;
    product_key: string;
    category: 'v2_suite' | 'easym' | 'gold' | 'semiauto' | 'other';
    category_label: string;
    version: string;
    min_balance: number;
    currency: string;
    file_type: '.ex5' | '.mq5';
    file_name: string;
    download_url: string;
    is_local: boolean;
    is_active_product: boolean;
    description?: string;
}

export default function AdminTestPortsPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [ports, setPorts] = useState<any[]>([]);
    const [loadingPorts, setLoadingPorts] = useState(false);
    const [newAccountNumber, setNewAccountNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    // EA Download Hub states
    const [eas, setEas] = useState<DownloadableEA[]>([]);
    const [loadingEas, setLoadingEas] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
                fetchDownloadableEas();
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

    const fetchDownloadableEas = async () => {
        setLoadingEas(true);
        try {
            const res = await fetch('/api/admin/ea-download');
            if (res.ok) {
                const data = await res.json();
                setEas(data.eas || []);
            } else {
                toast.error('ไม่สามารถโหลดรายการไฟล์ EA ได้');
            }
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาดในการโหลดรายการ EA');
        } finally {
            setLoadingEas(false);
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

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        toast.success(`คัดลอก ${label} เรียบร้อยแล้ว`);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handleDownload = (ea: DownloadableEA) => {
        toast.info(`กำลังเริ่มดาวน์โหลด ${ea.name}...`);
        const link = document.createElement('a');
        link.href = ea.download_url;
        link.download = ea.file_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter EAs by search and category
    const filteredEas = useMemo(() => {
        return eas.filter(ea => {
            const matchesCategory = 
                selectedCategory === 'all' ||
                (selectedCategory === 'v2_suite' && ea.category === 'v2_suite') ||
                (selectedCategory === 'easym' && (ea.category === 'easym' || ea.category === 'v2_suite')) ||
                (selectedCategory === 'gold' && ea.category === 'gold') ||
                (selectedCategory === 'semiauto' && ea.category === 'semiauto');

            if (!matchesCategory) return false;

            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase();
            return (
                ea.name.toLowerCase().includes(q) ||
                ea.product_key.toLowerCase().includes(q) ||
                ea.file_name.toLowerCase().includes(q) ||
                (ea.description && ea.description.toLowerCase().includes(q))
            );
        });
    }, [eas, selectedCategory, searchQuery]);

    // Counts for stats
    const stats = useMemo(() => {
        const v2Count = eas.filter(e => e.category === 'v2_suite').length;
        const easymCount = eas.filter(e => e.category === 'easym' || e.category === 'v2_suite').length;
        const goldCount = eas.filter(e => e.category === 'gold').length;
        const semiCount = eas.filter(e => e.category === 'semiauto').length;
        return { total: eas.length, v2Count, easymCount, goldCount, semiCount };
    }, [eas]);

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
                    หน้านี้อนุญาตให้เฉพาะผู้ดูแลระบบหลัก (juntarasate@gmail.com) เข้าใช้งานเพื่อจัดการระบบพอร์ตทดสอบข้ามสิทธิ์และดาวน์โหลด EA เท่านั้น
                </p>
                <Button onClick={() => router.push('/admin')}>กลับสู่แดชบอร์ด</Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        พอร์ตทดสอบพิเศษ & ศูนย์ดาวน์โหลด EA
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs px-2.5 py-0.5 font-mono">
                            SUPER ADMIN
                        </Badge>
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        กำหนดพอร์ต MT5 พิเศษที่ผ่านสิทธิ์ทุกเงื่อนไข พร้อมดาวน์โหลดไฟล์ EA ทุกตัวบนระบบไปรันทดสอบได้ทันที
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { fetchTestPorts(); fetchDownloadableEas(); }} 
                        className="gap-1.5"
                    >
                        <RefreshCw className="h-4 w-4" />
                        รีเฟรชข้อมูล
                    </Button>
                </div>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">พอร์ตทดสอบเปิดสิทธิ์</p>
                            <p className="text-2xl font-extrabold mt-1 text-amber-500 font-mono">{ports.length}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">EA ทั้งหมดพร้อมโหลด</p>
                            <p className="text-2xl font-extrabold mt-1 text-cyan-400 font-mono">{stats.total}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                            <Download className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">EasyM v2.00 Suite</p>
                            <p className="text-2xl font-extrabold mt-1 text-emerald-400 font-mono">{stats.v2Count}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <Sparkles className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">EASYGOLD Family</p>
                            <p className="text-2xl font-extrabold mt-1 text-yellow-400 font-mono">{stats.goldCount}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-400">
                            <Coins className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* SECTION 1: EA DOWNLOAD HUB */}
            <Card className="border shadow-md bg-card/80">
                <CardHeader className="border-b bg-muted/20 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Download className="h-5 w-5 text-primary" />
                                <CardTitle className="text-xl">ศูนย์ดาวน์โหลด EA สำหรับพอร์ตทดสอบ (Super Admin EA Hub)</CardTitle>
                            </div>
                            <CardDescription className="mt-1">
                                รวมไฟล์ติดตั้ง EA (.EX5) และซอร์สโค้ด (.MQ5) ทุกตัวบนระบบ eaeze.com สำหรับ Super Admin ดาวน์โหลดไปรันทดสอบ
                            </CardDescription>
                        </div>

                        {/* Search Bar */}
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="ค้นหา EA, รหัสสินค้า, ชื่อไฟล์..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-background/80"
                            />
                        </div>
                    </div>

                    {/* Category Filter Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-3">
                        <Button
                            variant={selectedCategory === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory('all')}
                            className="text-xs h-8"
                        >
                            ทั้งหมด ({eas.length})
                        </Button>
                        <Button
                            variant={selectedCategory === 'v2_suite' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory('v2_suite')}
                            className={`text-xs h-8 ${selectedCategory === 'v2_suite' ? 'bg-cyan-600 hover:bg-cyan-700' : 'text-cyan-400 border-cyan-500/30'}`}
                        >
                            <Sparkles className="w-3.5 h-3.5 mr-1" />
                            ⚡ EasyM v2.00 Suite ({stats.v2Count})
                        </Button>
                        <Button
                            variant={selectedCategory === 'easym' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory('easym')}
                            className="text-xs h-8"
                        >
                            <Cpu className="w-3.5 h-3.5 mr-1" />
                            ตระกูล EasyM ({stats.easymCount})
                        </Button>
                        <Button
                            variant={selectedCategory === 'gold' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory('gold')}
                            className="text-xs h-8"
                        >
                            <Coins className="w-3.5 h-3.5 mr-1" />
                            ตระกูล EASYGOLD ({stats.goldCount})
                        </Button>
                        <Button
                            variant={selectedCategory === 'semiauto' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory('semiauto')}
                            className="text-xs h-8"
                        >
                            <Bot className="w-3.5 h-3.5 mr-1" />
                            ตระกูล Semi Auto ({stats.semiCount})
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {loadingEas ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm">กำลังโหลดรายการไฟล์ EA ทั้งหมด...</p>
                        </div>
                    ) : filteredEas.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            ไม่พบไฟล์ EA ที่ตรงกับเงื่อนไขการค้นหา
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow>
                                        <TableHead className="w-[300px]">ชื่อ EA / สินค้า</TableHead>
                                        <TableHead className="w-[180px]">รหัสสินค้า (Product Key)</TableHead>
                                        <TableHead>หมวดหมู่</TableHead>
                                        <TableHead>ประเภทไฟล์</TableHead>
                                        <TableHead>ทุนขั้นต่ำ</TableHead>
                                        <TableHead className="text-right">ดาวน์โหลด</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEas.map((ea) => (
                                        <TableRow key={ea.id} className="hover:bg-muted/30 transition-colors">
                                            {/* EA Name & Description */}
                                            <TableCell>
                                                <div className="space-y-0.5">
                                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                        {ea.name}
                                                        {ea.category === 'v2_suite' && (
                                                            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] px-1.5 py-0 h-4">
                                                                Universal v2
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                                                        <span>{ea.file_name}</span>
                                                    </div>
                                                    {ea.description && (
                                                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                                                            {ea.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Product Key with Copy */}
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-xs bg-muted px-2 py-1 rounded border">
                                                        {ea.product_key}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                        onClick={() => handleCopy(ea.product_key, `รหัสสินค้า ${ea.product_key}`)}
                                                        title="คัดลอกรหัสสินค้า"
                                                    >
                                                        {copiedKey === ea.product_key ? (
                                                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>

                                            {/* Category Badge */}
                                            <TableCell>
                                                {ea.category === 'v2_suite' ? (
                                                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs">
                                                        ⚡ v2.00 Suite
                                                    </Badge>
                                                ) : ea.category === 'easym' ? (
                                                    <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-xs">
                                                        EasyM
                                                    </Badge>
                                                ) : ea.category === 'gold' ? (
                                                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                                                        EASYGOLD
                                                    </Badge>
                                                ) : ea.category === 'semiauto' ? (
                                                    <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-xs">
                                                        Semi Auto
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs">
                                                        ทั่วไป
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            {/* File Type */}
                                            <TableCell>
                                                {ea.file_type === '.ex5' ? (
                                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-mono text-xs">
                                                        .EX5 รันได้ทันที
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 font-mono text-xs">
                                                        .MQ5 Source
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            {/* Min Balance */}
                                            <TableCell>
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {ea.min_balance > 0 ? (
                                                        `$${ea.min_balance.toLocaleString()} (${(ea.min_balance * 100).toLocaleString()} USC)`
                                                    ) : (
                                                        'ไม่จำกัดทุน'
                                                    )}
                                                </span>
                                            </TableCell>

                                            {/* Download Action */}
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant={ea.category === 'v2_suite' ? 'default' : 'outline'}
                                                    className={`gap-1.5 h-8 font-medium ${
                                                        ea.category === 'v2_suite'
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                            : 'hover:bg-primary hover:text-primary-foreground'
                                                    }`}
                                                    onClick={() => handleDownload(ea)}
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    ดาวน์โหลด
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

            {/* SECTION 2: TEST PORTS MANAGEMENT */}
            <div className="grid gap-6 md:grid-cols-3">
                {/* Add Test Port Form */}
                <Card className="md:col-span-1 border shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-primary" />
                            เพิ่มพอร์ตทดสอบใหม่
                        </CardTitle>
                        <CardDescription>
                            กรอกหมายเลขพอร์ต MT5 ที่ต้องการให้ผ่านสิทธิ์ทุกเงื่อนไข (Balance & Product ID) โดยอัตโนมัติ
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddPort} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">หมายเลขพอร์ต MT5 (Account Number)</label>
                                <Input
                                    type="text"
                                    placeholder="เช่น 97088525 หรือ 97021489"
                                    value={newAccountNumber}
                                    onChange={(e) => setNewAccountNumber(e.target.value)}
                                    disabled={submitting}
                                    className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                    เมื่อเพิ่มแล้ว พอร์ตนี้จะสามารถรัน EA ทุกตัวที่ดาวน์โหลดจากแผงด้านบนได้ทันที
                                </p>
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

                {/* Test Ports Table */}
                <Card className="md:col-span-2 border shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle>รายการพอร์ตทดสอบพิเศษที่เปิดสิทธิ์ ({ports.length})</CardTitle>
                            <CardDescription>
                                พอร์ตทั้งหมดที่ระบบอนุญาตให้ bypass การตรวจสอบลิขสิทธิ์ทั้งหมด
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-full border border-amber-500/20 font-medium">
                            <ShieldAlert className="h-4 w-4 text-amber-500" />
                            Super Admin Bypass Active
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
                                                <TableCell className="font-mono font-bold text-foreground flex items-center gap-2">
                                                    <span>{port.account_number}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                        onClick={() => handleCopy(port.account_number, `เลขพอร์ต ${port.account_number}`)}
                                                        title="คัดลอกเลขพอร์ต"
                                                    >
                                                        {copiedKey === port.account_number ? (
                                                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {port.owner_email}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {new Date(port.created_at).toLocaleString('th-TH')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:bg-destructive/10 h-8 w-8"
                                                        onClick={() => handleDeletePort(port.id, port.account_number)}
                                                        title="ลบพอร์ตทดสอบ"
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
            
            {/* Help Guide Box */}
            <div className="bg-blue-500/10 border border-blue-500/20 text-foreground p-5 rounded-xl flex items-start gap-3.5">
                <HelpCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1.5">
                    <p className="font-bold text-blue-400">วิธีการทำงานของระบบพอร์ตทดสอบพิเศษ & การทดสอบ EA</p>
                    <p className="text-muted-foreground leading-relaxed">
                        1. <strong>ดาวน์โหลด EA</strong> จากตารางศูนย์ดาวน์โหลดด้านบน นำไฟล์ <code>.ex5</code> ไปใส่ในโฟลเดอร์ <code>MQL5/Experts</code> ของโปรแกรม MT5 หรือเปิดไฟล์ <code>.mq5</code> ใน MetaEditor แล้วกด Compile<br />
                        2. <strong>กรอกเลขพอร์ต MT5</strong> ที่ต้องการทดสอบในฟอร์มด้านบนเพื่อเพิ่มเข้าสู่ระบบ Bypass ลิขสิทธิ์พิเศษ<br />
                        3. <strong>ใน MT5 Options &gt; Expert Advisors</strong> ให้ติ๊ก <em>Allow WebRequest for listed URL</em> แล้วใส่ <code>https://eaeze.com</code><br />
                        4. เมื่อนำ EA ไปลากลงชาร์ต ตัว EA จะส่งคำขอตรวจสอบสิทธิ์มาที่เซิร์ฟเวอร์ และระบบจะตอบกลับว่า <strong>"active: License Verified"</strong> ทันที โดยข้ามการตรวจสอบ Balance และ Product ID ทำให้ทดสอบการเทรดได้อิสระครับ
                    </p>
                </div>
            </div>
        </div>
    );
}
