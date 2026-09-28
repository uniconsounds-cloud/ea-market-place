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
    Copy, 
    Check, 
    Cpu, 
    Coins, 
    Bot,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Package,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface DownloadableProduct {
    id: string;
    name: string;
    product_key: string;
    category: 'easym' | 'gold' | 'semiauto' | 'silver' | 'other';
    category_label: string;
    version: string;
    min_balance: number;
    currency: string;
    platform: string;
    strategy?: string;
    file_url: string | null;
    file_name: string;
    has_file: boolean;
    is_active: boolean;
    description?: string;
}

export default function AdminTestPortsPage() {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [ports, setPorts] = useState<any[]>([]);
    const [loadingPorts, setLoadingPorts] = useState(false);
    const [newAccountNumber, setNewAccountNumber] = useState('');
    const [submitting, setSubmitting] = useState(false);
    
    // EA Products list states
    const [products, setProducts] = useState<DownloadableProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
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
                fetchProducts();
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

    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const res = await fetch('/api/admin/ea-download');
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
            } else {
                toast.error('ไม่สามารถโหลดรายการสินค้าได้');
            }
        } catch (err) {
            console.error(err);
            toast.error('เกิดข้อผิดพลาดในการโหลดรายการสินค้า');
        } finally {
            setLoadingProducts(false);
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

    const handleDownload = (prod: DownloadableProduct) => {
        if (!prod.file_url) {
            toast.error(`ยังไม่มีไฟล์อัปโหลดสำหรับสินค้า ${prod.name}`);
            return;
        }
        toast.info(`กำลังเริ่มดาวน์โหลด ${prod.name}...`);
        const link = document.createElement('a');
        link.href = prod.file_url;
        link.download = prod.file_name;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter products by search, status, and category
    const filteredProducts = useMemo(() => {
        return products.filter(prod => {
            // Status filter
            if (statusFilter === 'active' && !prod.is_active) return false;
            if (statusFilter === 'inactive' && prod.is_active) return false;

            // Category filter
            const matchesCategory = 
                selectedCategory === 'all' ||
                (selectedCategory === 'easym' && prod.category === 'easym') ||
                (selectedCategory === 'gold' && prod.category === 'gold') ||
                (selectedCategory === 'semiauto' && prod.category === 'semiauto') ||
                (selectedCategory === 'silver' && prod.category === 'silver');

            if (!matchesCategory) return false;

            // Search query
            if (!searchQuery.trim()) return true;

            const q = searchQuery.toLowerCase();
            return (
                prod.name.toLowerCase().includes(q) ||
                prod.product_key.toLowerCase().includes(q) ||
                prod.file_name.toLowerCase().includes(q) ||
                (prod.description && prod.description.toLowerCase().includes(q))
            );
        });
    }, [products, statusFilter, selectedCategory, searchQuery]);

    // Summary counts
    const stats = useMemo(() => {
        const total = products.length;
        const active = products.filter(p => p.is_active).length;
        const inactive = total - active;
        const withFile = products.filter(p => p.has_file).length;
        const easymCount = products.filter(p => p.category === 'easym').length;
        const goldCount = products.filter(p => p.category === 'gold').length;
        const semiCount = products.filter(p => p.category === 'semiauto').length;
        const silverCount = products.filter(p => p.category === 'silver').length;
        return { total, active, inactive, withFile, easymCount, goldCount, semiCount, silverCount };
    }, [products]);

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
                        กำหนดพอร์ต MT5 พิเศษที่ผ่านสิทธิ์ทุกเงื่อนไข พร้อมดาวน์โหลดไฟล์ EA ทุกตัวบนหน้าสินค้า (Active &amp; Inactive) ไปรันทดสอบได้ทันที
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => { fetchTestPorts(); fetchProducts(); }} 
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
                            <p className="text-xs font-medium text-muted-foreground">สินค้าทั้งหมดบนเว็บ</p>
                            <p className="text-2xl font-extrabold mt-1 text-cyan-400 font-mono">{stats.total}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                            <Package className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">วางจำหน่าย (Active)</p>
                            <p className="text-2xl font-extrabold mt-1 text-emerald-400 font-mono">{stats.active}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <CheckCircle2 className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border bg-card/60 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">ปิดการขาย (Inactive)</p>
                            <p className="text-2xl font-extrabold mt-1 text-zinc-400 font-mono">{stats.inactive}</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-500/10 text-zinc-400">
                            <XCircle className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* SECTION 1: ALL WEB PRODUCTS EA DOWNLOAD HUB */}
            <Card className="border shadow-md bg-card/80">
                <CardHeader className="border-b bg-muted/20 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Download className="h-5 w-5 text-primary" />
                                <CardTitle className="text-xl">ศูนย์ดาวน์โหลด EA บนหน้าสินค้า (Client Download Hub)</CardTitle>
                            </div>
                            <CardDescription className="mt-1">
                                แสดงเฉพาะ EA ที่อัปโหลดขึ้นเว็บและเป็นสินค้าตัวเดียวกันที่ส่งมอบให้ลูกค้าดาวน์โหลดไปใช้งาน (รวมทั้งที่ Active และ Inactive)
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

                    {/* Filter Pills (Status & Categories) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                        {/* Categories */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedCategory('all')}
                                className="text-xs h-8"
                            >
                                สินค้าทั้งหมด ({products.length})
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
                            {stats.silverCount > 0 && (
                                <Button
                                    variant={selectedCategory === 'silver' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedCategory('silver')}
                                    className="text-xs h-8"
                                >
                                    Silver ({stats.silverCount})
                                </Button>
                            )}
                        </div>

                        {/* Status Toggle */}
                        <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border text-xs">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === 'all' ? 'bg-background font-bold shadow-sm' : 'text-muted-foreground'}`}
                            >
                                ทั้งหมด
                            </button>
                            <button
                                onClick={() => setStatusFilter('active')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === 'active' ? 'bg-background text-emerald-400 font-bold shadow-sm' : 'text-muted-foreground'}`}
                            >
                                ✅ Active ({stats.active})
                            </button>
                            <button
                                onClick={() => setStatusFilter('inactive')}
                                className={`px-2.5 py-1 rounded-md transition-colors ${statusFilter === 'inactive' ? 'bg-background text-zinc-400 font-bold shadow-sm' : 'text-muted-foreground'}`}
                            >
                                ⛔ Inactive ({stats.inactive})
                            </button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {loadingProducts ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm">กำลังโหลดรายการสินค้าและไฟล์ EA...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow>
                                        <TableHead className="w-[320px]">ชื่อสินค้า (Product Name)</TableHead>
                                        <TableHead className="w-[180px]">รหัสสินค้า (Product Key)</TableHead>
                                        <TableHead>หมวดหมู่</TableHead>
                                        <TableHead>ทุนขั้นต่ำ</TableHead>
                                        <TableHead className="w-[280px]">ไฟล์ EA ที่อัปโหลดบนเว็บ</TableHead>
                                        <TableHead className="text-right">ดาวน์โหลด</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts.map((prod) => (
                                        <TableRow key={prod.id} className="hover:bg-muted/30 transition-colors">
                                            {/* Name & Status */}
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                                        <span>{prod.name}</span>
                                                        {prod.is_active ? (
                                                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4">
                                                                Active
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-zinc-500 border-zinc-600/40 text-[10px] px-1.5 py-0 h-4">
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                        <span>{prod.platform}</span>
                                                        {prod.strategy && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="capitalize">{prod.strategy}</span>
                                                            </>
                                                        )}
                                                        <span>•</span>
                                                        <span>v{prod.version}</span>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            {/* Product Key with Copy */}
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-xs bg-muted px-2 py-1 rounded border">
                                                        {prod.product_key}
                                                    </span>
                                                    {prod.product_key !== '-' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                                            onClick={() => handleCopy(prod.product_key, `รหัสสินค้า ${prod.product_key}`)}
                                                            title="คัดลอกรหัสสินค้า"
                                                        >
                                                            {copiedKey === prod.product_key ? (
                                                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5" />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>

                                            {/* Category Badge */}
                                            <TableCell>
                                                {prod.category === 'easym' ? (
                                                    <Badge className="bg-blue-500/15 text-blue-300 border-blue-500/30 text-xs">
                                                        EasyM
                                                    </Badge>
                                                ) : prod.category === 'gold' ? (
                                                    <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                                                        EASYGOLD
                                                    </Badge>
                                                ) : prod.category === 'semiauto' ? (
                                                    <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-xs">
                                                        Semi Auto
                                                    </Badge>
                                                ) : prod.category === 'silver' ? (
                                                    <Badge className="bg-slate-500/15 text-slate-300 border-slate-500/30 text-xs">
                                                        Silver
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-xs">
                                                        ทั่วไป
                                                    </Badge>
                                                )}
                                            </TableCell>

                                            {/* Min Balance */}
                                            <TableCell>
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {prod.min_balance > 0 ? (
                                                        `$${prod.min_balance.toLocaleString()} (${(prod.min_balance * 100).toLocaleString()} USC)`
                                                    ) : (
                                                        'ไม่จำกัดทุน'
                                                    )}
                                                </span>
                                            </TableCell>

                                            {/* File Name & Status */}
                                            <TableCell>
                                                {prod.has_file ? (
                                                    <div className="space-y-0.5">
                                                        <div className="text-xs font-mono text-foreground font-medium truncate max-w-[260px]" title={prod.file_name}>
                                                            {prod.file_name}
                                                        </div>
                                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 h-4">
                                                            .EX5 พร้อมรัน
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 italic">
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                        ยังไม่มีไฟล์ในระบบ
                                                    </div>
                                                )}
                                            </TableCell>

                                            {/* Download Action */}
                                            <TableCell className="text-right">
                                                {prod.has_file ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1.5 h-8 font-medium hover:bg-primary hover:text-primary-foreground border-primary/30"
                                                        onClick={() => handleDownload(prod)}
                                                    >
                                                        <Download className="h-3.5 w-3.5" />
                                                        ดาวน์โหลด
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        disabled
                                                        className="h-8 text-xs text-muted-foreground opacity-50"
                                                    >
                                                        ไม่มีไฟล์
                                                    </Button>
                                                )}
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
                            กรอกหมายเลขพอร์ต MT5 ที่ต้องการให้ผ่านสิทธิ์ทุกเงื่อนไข (Balance &amp; Product ID) โดยอัตโนมัติ
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
                                    เมื่อเพิ่มแล้ว พอร์ตนี้จะสามารถรัน EA ทุกตัวที่ดาวน์โหลดจากแผงด้านบนได้ทันทีโดยไม่ติดลิขสิทธิ์
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
                    <p className="font-bold text-blue-400">วิธีการทำงานของระบบพอร์ตทดสอบพิเศษ &amp; การทดสอบ EA</p>
                    <p className="text-muted-foreground leading-relaxed">
                        1. <strong>ดาวน์โหลด EA</strong> จากตารางศูนย์ดาวน์โหลดด้านบน ซึ่งเป็นไฟล์ <code>.ex5</code> ตัวเดียวกับที่ส่งมอบให้ลูกค้าบนเว็บ นำไปใส่ในโฟลเดอร์ <code>MQL5/Experts</code> ของ MT5<br />
                        2. <strong>กรอกเลขพอร์ต MT5</strong> ที่เตรียมไว้ในฟอร์มด้านบนเพื่อเปิดสิทธิ์พิเศษข้ามการตรวจสิทธิ์<br />
                        3. <strong>ใน MT5 Options &gt; Expert Advisors</strong> ติ๊ก <em>Allow WebRequest for listed URL</em> แล้วใส่ <code>https://eaeze.com</code><br />
                        4. เมื่อเปิด EA บนชาร์ต ระบบจะตอบกลับสถานะ <strong>"active: License Verified"</strong> ทันที โดยข้ามการตรวจสอบ Balance และ Product ID ช่วยให้ทดสอบการทำงานของ EA ได้อย่างอิสระครับ
                    </p>
                </div>
            </div>
        </div>
    );
}
