'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search, Loader2, Users, ShoppingBag, CreditCard, ChevronRight, Filter, Beaker, Edit2, Check, X, GitPullRequest } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest'); // Default to สมัครล่าสุด
    const [selectedAdmin, setSelectedAdmin] = useState<string>('all');

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [transferRequests, setTransferRequests] = useState<any[]>([]);
    
    // Dialog State
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [selectedUserForTransfer, setSelectedUserForTransfer] = useState<any>(null);
    const [selectedTargetAdminId, setSelectedTargetAdminId] = useState<string>('');
    const [transferLoading, setTransferLoading] = useState(false);

    useEffect(() => {
        fetchUsers();
        fetchCurrentUser();
        fetchTransferRequests();
    }, []);

    const fetchCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
        }
    };

    const fetchTransferRequests = async () => {
        const { data, error } = await supabase
            .from('admin_transfer_requests')
            .select(`
                *,
                customer:profiles!customer_id(full_name, email),
                source_admin:profiles!source_admin_id(full_name, email),
                target_admin:profiles!target_admin_id(full_name, email),
                requester:profiles!requester_id(full_name, email)
            `)
            .eq('status', 'pending');
        
        if (data) {
            setTransferRequests(data);
        }
    };

    const handleApproveTransfer = async (req: any) => {
        try {
            const isSourceAdmin = currentUser && req.source_admin_id === currentUser.id;
            const isTargetAdmin = currentUser && req.target_admin_id === currentUser.id;

            if (!isSourceAdmin && !isTargetAdmin) {
                toast.error("คุณไม่มีสิทธิ์ในการอนุมัติคำขอนี้");
                return;
            }

            const updates: any = {};
            if (isSourceAdmin) updates.source_approved = true;
            if (isTargetAdmin) updates.target_approved = true;

            const { error } = await supabase
                .from('admin_transfer_requests')
                .update(updates)
                .eq('id', req.id);

            if (error) throw error;
            
            toast.success("อนุมัติคำขอเปลี่ยนสายงานสำเร็จ!");
            fetchTransferRequests();
            fetchUsers(); // Refresh user list
        } catch (e: any) {
            alert("ล้มเหลวในการอนุมัติ: " + e.message);
        }
    };

    const handleRejectTransfer = async (requestId: string) => {
        if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธและยกเลิกคำขอนี้?")) return;
        try {
            const { error } = await supabase
                .from('admin_transfer_requests')
                .update({ status: 'rejected' })
                .eq('id', requestId);

            if (error) throw error;
            
            toast.success("ปฏิเสธคำขอเปลี่ยนสายงานแล้ว");
            fetchTransferRequests();
        } catch (e: any) {
            alert("ล้มเหลวในการปฏิเสธ: " + e.message);
        }
    };

    const handleOpenTransferDialog = (user: any) => {
        setSelectedUserForTransfer(user);
        setSelectedTargetAdminId('');
        setIsTransferOpen(true);
    };

    const handleCreateTransferRequest = async () => {
        if (!selectedUserForTransfer || !selectedTargetAdminId) return;
        
        setTransferLoading(true);
        try {
            const sourceAdminId = selectedUserForTransfer.root_admin?.id || null;
            const targetAdminId = selectedTargetAdminId;
            const customerId = selectedUserForTransfer.id;
            const requesterId = currentUser?.id;

            if (!requesterId) throw new Error("กรุณาเข้าสู่ระบบก่อนทำรายการ");
            if (sourceAdminId === targetAdminId) {
                toast.error("ไม่สามารถเปลี่ยนสายงานไปยังแอดมินคนเดิมได้");
                setTransferLoading(false);
                return;
            }

            const { error } = await supabase
                .from('admin_transfer_requests')
                .insert([{
                    customer_id: customerId,
                    source_admin_id: sourceAdminId,
                    target_admin_id: targetAdminId,
                    requester_id: requesterId,
                    source_approved: (requesterId === sourceAdminId || sourceAdminId === null),
                    target_approved: (requesterId === targetAdminId),
                    status: 'pending'
                }]);

            if (error) throw error;

            toast.success("ส่งคำขอเปลี่ยนสายงานเรียบร้อยแล้ว! รอการยืนยันจากแอดมินที่เกี่ยวข้อง");
            setIsTransferOpen(false);
            fetchTransferRequests();
        } catch (e: any) {
            alert("ล้มเหลวในการสร้างคำขอ: " + e.message);
        } finally {
            setTransferLoading(false);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // 1. Fetch Profiles (assuming admin RLS allows this)
            // We need to fetch ALL profiles.
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, is_tester, referred_by, created_at, referrer:profiles!referred_by(id, full_name, email)');

            if (profileError) throw profileError;

            // 2. Fetch Aggregated Stats
            // Fetch all COMPLETED orders to calculate spending
            const { data: orders } = await supabase
                .from('orders')
                .select('user_id, amount')
                .eq('status', 'completed');

            // Fetch all ACTIVE licenses to count products
            const { data: licenses } = await supabase
                .from('licenses')
                .select('user_id')
                .eq('is_active', true);

            // Fetch IB Memberships to display broker names
            const { data: ibMemberships } = await supabase
                .from('ib_memberships')
                .select('user_id, brokers(name)')
                .eq('status', 'approved');

            // 3. Process & Merge Data
            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            const getUplineAdmin = (userId: string) => {
                let current = profileMap.get(userId);
                let visited = new Set();
                let lastAdmin = null;
                
                while (current && !visited.has(current.id)) {
                    visited.add(current.id);
                    
                    // Root Admin Emails
                    const isRoot = current.email === 'juntarasate@gmail.com' || current.email === 'bctutor123@gmail.com';
                    if (isRoot) return current;
                    
                    // Keep track of any intermediary admin as a fallback
                    if (current.role === 'admin') {
                        lastAdmin = current;
                    }
                    
                    if (!current.referred_by) break;
                    current = profileMap.get(current.referred_by);
                }
                return lastAdmin;
            };

            const processedUsers = profiles?.map(profile => {
                const userOrders = orders?.filter(o => o.user_id === profile.id) || [];
                const userLicenses = licenses?.filter(l => l.user_id === profile.id) || [];
                const userIbs = ibMemberships?.filter(ib => ib.user_id === profile.id) || [];

                const totalSpent = userOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
                const totalOrders = userOrders.length;
                const activeProducts = userLicenses.length;

                const ibBrokerNames = Array.from(new Set(userIbs.map(ib => {
                    return Array.isArray((ib as any).brokers) ? (ib as any).brokers[0]?.name : (ib as any).brokers?.name;
                }).filter(Boolean)));

                return {
                    ...profile,
                    totalSpent,
                    totalOrders,
                    activeProducts,
                    is_ib: ibBrokerNames.length > 0,
                    ib_broker_names: ibBrokerNames,
                    root_admin: getUplineAdmin(profile.id)
                };
            }) || [];

            setUsers(processedUsers);

        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter & Sort
    const handleToggleTester = async (userId: string, currentStatus: boolean) => {
        try {
            const newStatus = !currentStatus;
            const { error } = await supabase.from('profiles').update({ is_tester: newStatus }).eq('id', userId);
            if (error) throw error;
            setUsers(users.map(u => u.id === userId ? { ...u, is_tester: newStatus } : u));
        } catch (error: any) {
            alert('ล้มเหลวในการอัปเดตสถานะบัญชีทดสอบ: ' + error.message);
        }
    };

    const uniqueAdmins = Array.from(
        new Set(users.filter(u => u.role === 'admin' && u.email).map(u => u.email))
    );

    const filteredUsers = users.filter(user => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = user.email?.toLowerCase().includes(searchLower) ||
                              user.full_name?.toLowerCase().includes(searchLower) ||
                              user.id.toLowerCase().includes(searchLower);
        
        const matchesAdmin = selectedAdmin === 'all' || user.root_admin?.email === selectedAdmin;

        return matchesSearch && matchesAdmin;
    }).sort((a, b) => {
        if (sortOrder === 'spent-high') return b.totalSpent - a.totalSpent;
        if (sortOrder === 'spent-low') return a.totalSpent - b.totalSpent;
        if (sortOrder === 'orders-high') return b.totalOrders - a.totalOrders;
        if (sortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        if (sortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        return 0;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">ลูกค้า (Customers)</h1>
                    <p className="text-muted-foreground">รายชื่อลูกค้าและสรุปยอดการใช้งาน</p>
                </div>
                <Button variant="outline" onClick={fetchUsers} size="sm">
                    <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </Button>
            </div>

            {/* Pending Transfer Requests */}
            {transferRequests.length > 0 && (
                <Card className="border-gold/20 bg-gold/5 mb-6">
                    <CardContent className="p-4">
                        <h3 className="font-bold text-gold flex items-center gap-2 mb-3">
                            <GitPullRequest className="w-5 h-5 animate-pulse" />
                            คำขอเปลี่ยนสายงานรอยืนยัน ({transferRequests.length})
                        </h3>
                        <div className="space-y-3">
                            {transferRequests.map((req) => {
                                const isSourceAdmin = currentUser && req.source_admin_id === currentUser.id;
                                const isTargetAdmin = currentUser && req.target_admin_id === currentUser.id;
                                const needsMyApproval = (isSourceAdmin && !req.source_approved) || (isTargetAdmin && !req.target_approved);

                                return (
                                    <div key={req.id} className="bg-card p-4 rounded-xl border border-border/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-foreground">
                                                ย้ายลูกค้า: <span className="text-gold font-bold">{req.customer?.full_name || 'ลูกค้า'}</span> ({req.customer?.email})
                                            </p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                                <span>ผู้แนะนำเดิม: <strong className="text-red-400 font-medium">{req.source_admin?.full_name || '-ไม่มี-'}</strong></span>
                                                <span>➡️</span>
                                                <span>ผู้แนะนำใหม่: <strong className="text-green-400 font-medium">{req.target_admin?.full_name || 'แอดมินปลายทาง'}</strong></span>
                                                <span className="px-1.5 py-0.5 bg-muted rounded">ผู้ส่งคำขอ: {req.requester?.full_name || 'แอดมิน'}</span>
                                            </div>
                                            <div className="flex gap-2 text-[10px] mt-2">
                                                <span className={`px-2 py-0.5 rounded font-bold ${req.source_approved ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                                                    แอดมินต้นสาย: {req.source_approved ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded font-bold ${req.target_approved ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                                                    แอดมินปลายสาย: {req.target_approved ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                                                </span>
                                            </div>
                                        </div>
                                        {needsMyApproval ? (
                                            <div className="flex gap-2 shrink-0">
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="h-9 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                    onClick={() => handleRejectTransfer(req.id)}
                                                >
                                                    <X className="w-3.5 h-3.5 mr-1" /> ปฏิเสธ
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    className="h-9 bg-gold hover:bg-gold/85 text-black font-bold shadow-md shadow-gold/10"
                                                    onClick={() => handleApproveTransfer(req)}
                                                >
                                                    <Check className="w-3.5 h-3.5 mr-1" /> ยืนยันสลับสายงาน
                                                </Button>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/60 italic bg-muted/30 px-3 py-1.5 rounded-lg">
                                                กำลังรอการอนุมัติจากอีกฝ่าย...
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-card to-card/50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-full">
                            <Users className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground w-full">ลูกค้าทั้งหมด</p>
                            <h3 className="text-2xl font-bold">{users.length}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-card/50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-full">
                            <CreditCard className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">ลูกค้าที่มียอดซื้อ</p>
                            <h3 className="text-2xl font-bold">{users.filter(u => u.totalSpent > 0).length}</h3>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-card/50">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-full">
                            <ShoppingBag className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Active Licenses รวม</p>
                            <h3 className="text-2xl font-bold">
                                {users.reduce((sum, u) => sum + u.activeProducts, 0)}
                            </h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-card/50 p-4 rounded-xl border border-border/50">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาชื่อ, อีเมล..."
                        className="pl-9 bg-background/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto ml-auto">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="ผู้แนะนำ (Admin)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ผู้แนะนำทั้งหมด</SelectItem>
                            {uniqueAdmins.map((adminEmail: string) => (
                                <SelectItem key={adminEmail} value={adminEmail}>
                                    แสดงของ: {adminEmail}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={sortOrder} onValueChange={setSortOrder}>
                        <SelectTrigger className="w-full md:w-[150px]">
                            <SelectValue placeholder="เรียงลำดับ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="spent-high">ยอดซื้อสูงสุด</SelectItem>
                            <SelectItem value="spent-low">ยอดซื้อต่ำสุด</SelectItem>
                            <SelectItem value="orders-high">จำนวนออเดอร์มากสุด</SelectItem>
                            <SelectItem value="newest">สมัครล่าสุด</SelectItem>
                            <SelectItem value="oldest">สมัครเก่าสุด</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead>ลูกค้า (User)</TableHead>
                            <TableHead>สายงาน (Upline Admin)</TableHead>
                            <TableHead>วันที่สมัคร</TableHead>
                            <TableHead className="text-center">บัญชีทดสอบ</TableHead>
                            <TableHead className="text-center">Active Products</TableHead>
                            <TableHead className="text-center">Orders (สำเร็จ)</TableHead>
                            <TableHead className="text-right">ยอดใช้จ่ายรวม</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="hover:bg-muted/50">
                                    <TableCell>
                                        <Link href={`/admin/users/${user.id}`} className="flex flex-col hover:bg-muted/50 p-2 -m-2 rounded transition-colors group">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium group-hover:text-primary transition-colors">{user.full_name || 'No Name'}</span>
                                                {user.is_ib && (
                                                    <span className="inline-block px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded font-bold border border-blue-200 uppercase tracking-wide">
                                                        IB {user.ib_broker_names.join(' / ')}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{user.email || user.id}</span>
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 group/upline">
                                            {user.root_admin ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{user.root_admin.full_name || 'Admin'}</span>
                                                    <span className="text-[10px] text-muted-foreground">{user.root_admin.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-ไม่มี-</span>
                                            )}
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="w-8 h-8 opacity-0 group-hover/upline:opacity-100 transition-opacity"
                                                onClick={() => handleOpenTransferDialog(user)}
                                            >
                                                <Edit2 className="w-3.5 h-3.5 text-gold" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">
                                            {user.created_at ? new Date(user.created_at).toLocaleString('th-TH', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            }) + ' น.' : '-'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex justify-center flex-col items-center gap-1">
                                            <Switch 
                                                checked={user.is_tester || false} 
                                                onCheckedChange={() => handleToggleTester(user.id, user.is_tester || false)} 
                                            />
                                            {user.is_tester && <span className="text-[10px] text-orange-500 font-bold"><Beaker className="w-3 h-3 inline"/> Tester</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {user.activeProducts > 0 ? (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                                {user.activeProducts}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="font-mono">{user.totalOrders}</span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="font-mono font-bold">
                                            ฿{user.totalSpent.toLocaleString()}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    ไม่พบรายชื่อลูกค้า
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Transfer Line Dialog */}
            <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogContent className="sm:max-w-md bg-background border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">ขอเปลี่ยนสายงานลูกค้า (Transfer Line)</DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs">
                            การเปลี่ยนสายงานจะเกิดขึ้นก็ต่อเมื่อได้รับการอนุมัติแบบคู่ (Double Confirmation) จากทั้งแอดมินต้นสายและแอดมินปลายสายเรียบร้อยแล้ว
                        </DialogDescription>
                    </DialogHeader>
                    {selectedUserForTransfer && (
                        <div className="space-y-4 pt-2">
                            <div className="bg-muted/50 p-4 rounded-xl border border-border/50 text-sm space-y-2.5">
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">ลูกค้า:</span> <strong>{selectedUserForTransfer.full_name || 'No Name'}</strong></p>
                                <p><span className="text-muted-foreground mr-2 inline-block w-[100px]">อีเมล:</span> <strong className="font-mono">{selectedUserForTransfer.email}</strong></p>
                                <p>
                                    <span className="text-muted-foreground mr-2 inline-block w-[100px]">ผู้แนะนำปัจจุบัน:</span> 
                                    <strong className="text-red-400">{selectedUserForTransfer.root_admin?.full_name || '-ไม่มี-'}</strong>
                                    {selectedUserForTransfer.root_admin && <span className="text-xs text-muted-foreground block ml-[108px]">{selectedUserForTransfer.root_admin.email}</span>}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">เลือกผู้แนะนำใหม่ (แอดมินปลายสาย)</Label>
                                <Select value={selectedTargetAdminId} onValueChange={setSelectedTargetAdminId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="เลือกแอดมินปลายทาง..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.filter(u => u.role === 'admin' && u.email && u.id !== selectedUserForTransfer.root_admin?.id).map((admin) => (
                                            <SelectItem key={admin.id} value={admin.id}>
                                                {admin.full_name || admin.email} ({admin.email})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-3 justify-end pt-3">
                                <Button variant="outline" onClick={() => setIsTransferOpen(false)} disabled={transferLoading}>
                                    ยกเลิก
                                </Button>
                                <Button 
                                    onClick={handleCreateTransferRequest} 
                                    disabled={transferLoading || !selectedTargetAdminId}
                                    className="bg-gold hover:bg-gold/85 text-black font-bold"
                                >
                                    {transferLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <GitPullRequest className="w-4 h-4 mr-2" />}
                                    ส่งคำขอยืนยัน
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
