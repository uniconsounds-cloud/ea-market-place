'use client';

import { useState, useEffect, useMemo } from 'react';
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
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { 
    Search, 
    Loader2, 
    Users, 
    ShoppingBag, 
    CreditCard, 
    Filter, 
    Beaker, 
    Edit2, 
    Check, 
    X, 
    GitPullRequest,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RefreshCw,
    Copy,
    HardDrive,
    Shield,
    CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

interface CustomerPort {
    account_number: string;
    product_name: string;
    product_key: string;
    is_active: boolean;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Search, Filter & Sort states
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest' | 'ports-high' | 'spent-high' | 'orders-high' | 'name-asc'
    const [selectedAdmin, setSelectedAdmin] = useState<string>('all');
    const [selectedPortStatus, setSelectedPortStatus] = useState<string>('all'); // 'all' | 'has_active' | 'no_active' | 'has_ports' | 'no_ports'
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all'); // 'all' | 'users_only' | 'admins' | 'testers' | 'ibs'

    // Pagination state (10 rows per page)
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [transferRequests, setTransferRequests] = useState<any[]>([]);
    
    // Transfer Dialog State
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [selectedUserForTransfer, setSelectedUserForTransfer] = useState<any>(null);
    const [selectedTargetAdminId, setSelectedTargetAdminId] = useState<string>('');
    const [transferLoading, setTransferLoading] = useState(false);

    // Customer Ports Dialog State
    const [isPortsDialogOpen, setIsPortsDialogOpen] = useState(false);
    const [selectedUserForPorts, setSelectedUserForPorts] = useState<any>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const isSuperAdmin = currentUser?.email === 'juntarasate@gmail.com';

    useEffect(() => {
        fetchUsers();
        fetchCurrentUser();
        fetchTransferRequests();
    }, []);

    // Reset page to 1 whenever any filter/search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedAdmin, selectedPortStatus, selectedRoleFilter, sortOrder]);

    const fetchCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
        }
    };

    const fetchTransferRequests = async () => {
        const { data } = await supabase
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

            if (!isSuperAdmin && !isSourceAdmin && !isTargetAdmin) {
                toast.error("คุณไม่มีสิทธิ์ในการอนุมัติคำขอนี้");
                return;
            }

            if (isSuperAdmin) {
                const res = await fetch('/api/admin/users/transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerId: req.customer_id, targetAdminId: req.target_admin_id }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to transfer user');

                await supabase
                    .from('admin_transfer_requests')
                    .update({ source_approved: true, target_approved: true, status: 'completed' })
                    .eq('id', req.id);

                toast.success("อนุมัติและย้ายสายงานสำเร็จทันทีโดยสิทธิ์ Super Admin!");
                fetchTransferRequests();
                fetchUsers();
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
            fetchUsers();
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

    const handleOpenPortsDialog = (user: any) => {
        setSelectedUserForPorts(user);
        setIsPortsDialogOpen(true);
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        toast.success(`คัดลอก ${label} เรียบร้อยแล้ว`);
        setTimeout(() => setCopiedKey(null), 2000);
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

            if (currentUser?.email === 'juntarasate@gmail.com') {
                const res = await fetch('/api/admin/users/transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ customerId, targetAdminId }),
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to transfer user');

                toast.success("ย้ายสายงานลูกค้าสำเร็จทันทีโดยสิทธิ์ Super Admin!");
                setIsTransferOpen(false);
                fetchUsers();
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
            // 1. Fetch All Profiles
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role, is_tester, referred_by, created_at, referrer:profiles!referred_by(id, full_name, email)');

            if (profileError) throw profileError;

            // 2. Fetch All Completed Orders
            const { data: orders } = await supabase
                .from('orders')
                .select('user_id, amount')
                .eq('status', 'completed');

            // 3. Fetch ALL Licenses with full pagination (supports > 1,000 rows)
            let allLicenses: any[] = [];
            let from = 0;
            const batchSize = 1000;
            while (true) {
                const { data: batch, error: batchErr } = await supabase
                    .from('licenses')
                    .select('user_id, account_number, is_active, products(name, product_key)')
                    .range(from, from + batchSize - 1);

                if (batchErr || !batch || batch.length === 0) break;
                allLicenses = allLicenses.concat(batch);
                if (batch.length < batchSize) break;
                from += batchSize;
            }

            // 4. Fetch IB Memberships
            const { data: ibMemberships } = await supabase
                .from('ib_memberships')
                .select('user_id, brokers(name)')
                .eq('status', 'approved');

            // 5. Build Ports map per user_id
            const userPortsMap = new Map<string, CustomerPort[]>();
            allLicenses.forEach(l => {
                if (!l.user_id) return;
                if (!userPortsMap.has(l.user_id)) {
                    userPortsMap.set(l.user_id, []);
                }
                const prod = Array.isArray(l.products) ? l.products[0] : l.products;
                const rawAcc = String(l.account_number || '').trim();
                if (rawAcc) {
                    rawAcc.split(/[\s,]+/).filter(Boolean).forEach((acc: string) => {
                        const existing = userPortsMap.get(l.user_id)!;
                        // Avoid duplicates of same account and product
                        if (!existing.some(p => p.account_number === acc && p.product_key === (prod?.product_key || ''))) {
                            existing.push({
                                account_number: acc,
                                product_name: prod?.name || 'EA License',
                                product_key: prod?.product_key || '-',
                                is_active: !!l.is_active
                            });
                        }
                    });
                }
            });

            // 6. Process & Merge Data
            const profileMap = new Map((profiles || []).map(p => [p.id, p]));

            const getUplineAdmin = (userId: string) => {
                let current = profileMap.get(userId);
                let visited = new Set();
                let lastAdmin = null;
                
                while (current && !visited.has(current.id)) {
                    visited.add(current.id);
                    
                    const isRoot = current.email === 'juntarasate@gmail.com' || current.email === 'bctutor123@gmail.com';
                    if (isRoot) return current;
                    
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
                const userIbs = ibMemberships?.filter(ib => ib.user_id === profile.id) || [];
                const ports = userPortsMap.get(profile.id) || [];

                const totalSpent = userOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
                const totalOrders = userOrders.length;
                const activePortsCount = ports.filter(p => p.is_active).length;
                const portNumbers = ports.map(p => p.account_number);

                const ibBrokerNames = Array.from(new Set(userIbs.map(ib => {
                    return Array.isArray((ib as any).brokers) ? (ib as any).brokers[0]?.name : (ib as any).brokers?.name;
                }).filter(Boolean)));

                return {
                    ...profile,
                    totalSpent,
                    totalOrders,
                    activeProducts: activePortsCount,
                    ports,
                    totalPortsCount: ports.length,
                    activePortsCount,
                    portNumbers,
                    is_ib: ibBrokerNames.length > 0,
                    ib_broker_names: ibBrokerNames,
                    root_admin: getUplineAdmin(profile.id)
                };
            }) || [];

            setUsers(processedUsers);

        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleTester = async (userId: string, currentStatus: boolean) => {
        try {
            const newStatus = !currentStatus;
            const { error } = await supabase.from('profiles').update({ is_tester: newStatus }).eq('id', userId);
            if (error) throw error;
            setUsers(users.map(u => u.id === userId ? { ...u, is_tester: newStatus } : u));
            toast.success(`อัปเดตสถานะบัญชีทดสอบเรียบร้อยแล้ว`);
        } catch (error: any) {
            alert('ล้มเหลวในการอัปเดตสถานะบัญชีทดสอบ: ' + error.message);
        }
    };

    const uniqueAdmins = useMemo(() => {
        return Array.from(
            new Set(users.filter(u => u.role === 'admin' && u.email).map(u => u.email))
        );
    }, [users]);

    // Filter & Sort Logic
    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            // 1. Search Query (Name, Email, ID, and MT5 PORT NUMBERS!)
            if (searchQuery.trim()) {
                const searchLower = searchQuery.toLowerCase().trim();
                const matchesName = user.full_name?.toLowerCase().includes(searchLower);
                const matchesEmail = user.email?.toLowerCase().includes(searchLower);
                const matchesId = user.id.toLowerCase().includes(searchLower);
                
                // Matches MT5 Account / Port number!
                const matchesPort = user.portNumbers?.some((portNum: string) => portNum.toLowerCase().includes(searchLower));
                
                // Matches EA Product Name or Key
                const matchesProduct = user.ports?.some((p: CustomerPort) => 
                    p.product_name.toLowerCase().includes(searchLower) || 
                    p.product_key.toLowerCase().includes(searchLower)
                );

                if (!matchesName && !matchesEmail && !matchesId && !matchesPort && !matchesProduct) {
                    return false;
                }
            }

            // 2. Admin Upline Filter
            if (selectedAdmin !== 'all') {
                if (user.root_admin?.email !== selectedAdmin) return false;
            }

            // 3. Port Status Filter
            if (selectedPortStatus === 'has_active') {
                if (user.activePortsCount === 0) return false;
            } else if (selectedPortStatus === 'no_active') {
                if (user.activePortsCount > 0) return false;
            } else if (selectedPortStatus === 'has_ports') {
                if (user.totalPortsCount === 0) return false;
            } else if (selectedPortStatus === 'no_ports') {
                if (user.totalPortsCount > 0) return false;
            }

            // 4. Role / Customer Type Filter
            if (selectedRoleFilter === 'users_only') {
                if (user.role === 'admin') return false;
            } else if (selectedRoleFilter === 'admins') {
                if (user.role !== 'admin') return false;
            } else if (selectedRoleFilter === 'testers') {
                if (!user.is_tester) return false;
            } else if (selectedRoleFilter === 'ibs') {
                if (!user.is_ib) return false;
            }

            return true;
        }).sort((a, b) => {
            if (sortOrder === 'ports-high') return b.totalPortsCount - a.totalPortsCount;
            if (sortOrder === 'spent-high') return b.totalSpent - a.totalSpent;
            if (sortOrder === 'orders-high') return b.totalOrders - a.totalOrders;
            if (sortOrder === 'name-asc') return (a.full_name || '').localeCompare(b.full_name || '', 'th');
            if (sortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            // Default: newest
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
    }, [users, searchQuery, selectedAdmin, selectedPortStatus, selectedRoleFilter, sortOrder]);

    // Paginated Users (10 rows per page)
    const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredUsers.slice(startIndex, startIndex + pageSize);
    }, [filteredUsers, currentPage, pageSize]);

    // Reset filters helper
    const handleResetFilters = () => {
        setSearchQuery('');
        setSelectedAdmin('all');
        setSelectedPortStatus('all');
        setSelectedRoleFilter('all');
        setSortOrder('newest');
    };

    const hasActiveFilters = searchQuery !== '' || selectedAdmin !== 'all' || selectedPortStatus !== 'all' || selectedRoleFilter !== 'all' || sortOrder !== 'newest';

    // Page Numbers Helper
    const pageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    }, [totalPages, currentPage]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-16">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight">ลูกค้า (Customers)</h1>
                    <p className="text-muted-foreground mt-1">รายชื่อลูกค้า ตรวจสอบพอร์ต MT5 ของลูกค้าแต่ละคน และสรุปยอดการใช้งาน</p>
                </div>
                <Button variant="outline" onClick={fetchUsers} size="sm" className="gap-2">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 
                    รีเฟรชข้อมูล
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
                                const needsMyApproval = isSuperAdmin || (isSourceAdmin && !req.source_approved) || (isTargetAdmin && !req.target_approved);

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
                                                    className="h-9 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
                                                    onClick={() => handleApproveTransfer(req)}
                                                >
                                                    <Check className="w-3.5 h-3.5 mr-1 stroke-[3]" />
                                                    {isSuperAdmin ? "⚡️ อนุมัติย้ายทันที (Super Admin)" : "ยืนยันสลับสายงาน"}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-card to-card/50 border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">ลูกค้าทั้งหมด</p>
                            <h3 className="text-2xl font-extrabold mt-1 text-foreground font-mono">{users.length}</h3>
                        </div>
                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                            <Users className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-card/50 border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">ลูกค้าที่มียอดซื้อ</p>
                            <h3 className="text-2xl font-extrabold mt-1 text-emerald-400 font-mono">
                                {users.filter(u => u.totalSpent > 0).length}
                            </h3>
                        </div>
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                            <CreditCard className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-card/50 border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">พอร์ต MT5 ที่เปิดรัน (Active)</p>
                            <h3 className="text-2xl font-extrabold mt-1 text-cyan-400 font-mono">
                                {users.reduce((sum, u) => sum + (u.activePortsCount || 0), 0)}
                            </h3>
                        </div>
                        <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                            <HardDrive className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-card to-card/50 border shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">พอร์ต MT5 ทั้งหมดในระบบ</p>
                            <h3 className="text-2xl font-extrabold mt-1 text-amber-400 font-mono">
                                {users.reduce((sum, u) => sum + (u.totalPortsCount || 0), 0)}
                            </h3>
                        </div>
                        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* CONTROLS: ORGANIZED SEARCH & FILTER PANEL */}
            <Card className="border shadow-sm bg-card/70 backdrop-blur-sm">
                <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Row 1: EXPANSIVE SEARCH BAR (Fully visible text, no clipping) */}
                    <div className="relative w-full">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="ค้นหาชื่อลูกค้า, อีเมล, User ID หรือหมายเลขพอร์ต MT5 (เช่น 97088525, 96964122)..."
                            className="pl-10 pr-10 h-11 bg-background text-sm sm:text-base border-border/80 focus-visible:ring-primary/30 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
                                title="ล้างข้อความค้นหา"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Row 2: 4-COLUMN BALANCED FILTER GRID */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Filter 1: Admin Upline */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <Filter className="w-3 h-3 text-primary" /> สายงานผู้แนะนำ (Upline)
                            </Label>
                            <Select value={selectedAdmin} onValueChange={setSelectedAdmin}>
                                <SelectTrigger className="w-full h-9 bg-background text-xs">
                                    <SelectValue placeholder="ผู้แนะนำทั้งหมด" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ผู้แนะนำทั้งหมด</SelectItem>
                                    <SelectItem value="juntarasate@gmail.com">สายงานพี่โจ้ (juntarasate)</SelectItem>
                                    <SelectItem value="bctutor123@gmail.com">สายงานครูชัย (bctutor123)</SelectItem>
                                    {uniqueAdmins.filter(email => email !== 'juntarasate@gmail.com' && email !== 'bctutor123@gmail.com').map((adminEmail: string) => (
                                        <SelectItem key={adminEmail} value={adminEmail}>
                                            แอดมิน: {adminEmail}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filter 2: Port Status */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <HardDrive className="w-3 h-3 text-cyan-400" /> สถานะพอร์ต MT5
                            </Label>
                            <Select value={selectedPortStatus} onValueChange={setSelectedPortStatus}>
                                <SelectTrigger className="w-full h-9 bg-background text-xs">
                                    <SelectValue placeholder="พอร์ตทั้งหมด" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">พอร์ตทั้งหมด</SelectItem>
                                    <SelectItem value="has_active">🟢 มีพอร์ต Active (เปิดรัน)</SelectItem>
                                    <SelectItem value="no_active">⚪ ไม่มีพอร์ต Active</SelectItem>
                                    <SelectItem value="has_ports">📦 มีพอร์ตในระบบ</SelectItem>
                                    <SelectItem value="no_ports">❌ ยังไม่มีพอร์ตในระบบ</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filter 3: Customer Role / Type */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <Users className="w-3 h-3 text-amber-400" /> ประเภทลูกค้า
                            </Label>
                            <Select value={selectedRoleFilter} onValueChange={setSelectedRoleFilter}>
                                <SelectTrigger className="w-full h-9 bg-background text-xs">
                                    <SelectValue placeholder="ลูกค้าทุกประเภท" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ลูกค้าทุกประเภท</SelectItem>
                                    <SelectItem value="users_only">เฉพาะลูกค้าทั่วไป (User)</SelectItem>
                                    <SelectItem value="admins">เฉพาะผู้ดูแลระบบ (Admin)</SelectItem>
                                    <SelectItem value="testers">เฉพาะบัญชีทดสอบ (Tester)</SelectItem>
                                    <SelectItem value="ibs">เฉพาะสมาชิก IB</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Filter 4: Sort Order */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <Filter className="w-3 h-3 text-emerald-400" /> การจัดเรียง (Sorting)
                            </Label>
                            <Select value={sortOrder} onValueChange={setSortOrder}>
                                <SelectTrigger className="w-full h-9 bg-background text-xs">
                                    <SelectValue placeholder="เรียงลำดับ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="newest">สมัครล่าสุด (ใหม่ไปเก่า)</SelectItem>
                                    <SelectItem value="oldest">สมัครเก่าสุด (เก่าไปใหม่)</SelectItem>
                                    <SelectItem value="ports-high">จำนวนพอร์ตมากสุด</SelectItem>
                                    <SelectItem value="spent-high">ยอดใช้จ่ายสูงสุด</SelectItem>
                                    <SelectItem value="orders-high">จำนวนออเดอร์มากสุด</SelectItem>
                                    <SelectItem value="name-asc">ชื่อลูกค้า (ก - ฮ)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Active Filters Summary & Reset Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <span>พบผลลัพธ์: <strong className="text-foreground font-mono">{filteredUsers.length}</strong> คน</span>
                            {hasActiveFilters && (
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[11px] font-medium">
                                    ตัวกรองกำลังทำงาน
                                </span>
                            )}
                        </div>

                        {hasActiveFilters && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleResetFilters} 
                                className="text-xs h-7 text-muted-foreground hover:text-foreground gap-1"
                            >
                                <RefreshCw className="w-3 h-3" /> ล้างตัวกรองทั้งหมด
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Table */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[260px]">ลูกค้า (User)</TableHead>
                                <TableHead className="min-w-[280px]">พอร์ตของลูกค้าคนเดียวกัน (MT5 Ports)</TableHead>
                                <TableHead className="w-[180px]">สายงาน (Upline Admin)</TableHead>
                                <TableHead className="w-[130px]">วันที่สมัคร</TableHead>
                                <TableHead className="text-center w-[90px]">Tester</TableHead>
                                <TableHead className="text-center w-[90px]">Active</TableHead>
                                <TableHead className="text-center w-[90px]">Orders</TableHead>
                                <TableHead className="text-right w-[130px]">ยอดใช้จ่ายรวม</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 className="animate-spin h-6 w-6 text-primary" />
                                            <span className="text-xs">กำลังโหลดข้อมูลลูกค้าและพอร์ต MT5...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedUsers.length > 0 ? (
                                paginatedUsers.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-muted/40 transition-colors">
                                        {/* Customer Name & Email */}
                                        <TableCell>
                                            <Link href={`/admin/users/${user.id}`} className="flex flex-col group p-1 -m-1 rounded">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                                        {user.full_name || 'No Name'}
                                                    </span>
                                                    {user.role === 'admin' && (
                                                        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/40 text-amber-500 bg-amber-500/10">
                                                            Admin
                                                        </Badge>
                                                    )}
                                                    {user.is_ib && (
                                                        <span className="inline-block px-1.5 py-0.5 text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded font-bold border border-blue-200 dark:border-blue-800 uppercase">
                                                            IB {user.ib_broker_names.join('/')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                                                    {user.email || user.id}
                                                </span>
                                            </Link>
                                        </TableCell>

                                        {/* Client Ports (Grouped for same customer) */}
                                        <TableCell>
                                            <div className="space-y-1.5">
                                                {user.ports && user.ports.length > 0 ? (
                                                    <>
                                                        <div className="flex flex-wrap gap-1.5 items-center">
                                                            {user.ports.slice(0, 3).map((port: CustomerPort, pIdx: number) => (
                                                                <button
                                                                    key={`${port.account_number}-${pIdx}`}
                                                                    onClick={() => handleCopy(port.account_number, `เลขพอร์ต ${port.account_number}`)}
                                                                    title={`พอร์ต: ${port.account_number}\nสินค้า: ${port.product_name} (${port.product_key})\nสถานะ: ${port.is_active ? 'Active' : 'Inactive'}\n(คลิกเพื่อคัดลอกเลขพอร์ต)`}
                                                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-bold transition-all border ${
                                                                        port.is_active
                                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_8px_rgba(52,211,153,0.15)]'
                                                                            : 'bg-muted/60 text-muted-foreground border-border/40 hover:bg-muted'
                                                                    }`}
                                                                >
                                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${port.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                                                                    <span>{port.account_number}</span>
                                                                    <span className="text-[10px] font-sans font-normal opacity-75 truncate max-w-[70px]">
                                                                        {port.product_name.replace('EasyM ', '').replace('EASYGOLD ', '')}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                            {user.ports.length > 3 && (
                                                                <button
                                                                    onClick={() => handleOpenPortsDialog(user)}
                                                                    className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                                                                    title="ดูรายการพอร์ตทั้งหมดของลูกค้ารายนี้"
                                                                >
                                                                    +{user.ports.length - 3} พอร์ต
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                            <span>รวม {user.ports.length} พอร์ต</span>
                                                            {user.activePortsCount > 0 && (
                                                                <span className="text-emerald-400 font-medium">({user.activePortsCount} Active)</span>
                                                            )}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground/60 italic">-ไม่มีพอร์ต-</span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Upline Admin with Transfer Button */}
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 group/upline">
                                                {user.root_admin ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-semibold">{user.root_admin.full_name || 'Admin'}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{user.root_admin.email}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-ไม่มี-</span>
                                                )}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="w-7 h-7 opacity-0 group-hover/upline:opacity-100 transition-opacity text-amber-400 hover:bg-amber-400/10"
                                                    onClick={() => handleOpenTransferDialog(user)}
                                                    title="ขอเปลี่ยนสายงานลูกค้า"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>

                                        {/* Registered Date */}
                                        <TableCell>
                                            <div className="text-xs text-muted-foreground">
                                                {user.created_at ? new Date(user.created_at).toLocaleDateString('th-TH', {
                                                    year: '2-digit',
                                                    month: 'short',
                                                    day: 'numeric'
                                                }) : '-'}
                                            </div>
                                        </TableCell>

                                        {/* Tester Switch */}
                                        <TableCell className="text-center">
                                            <div className="flex justify-center flex-col items-center gap-1">
                                                <Switch 
                                                    checked={user.is_tester || false} 
                                                    onCheckedChange={() => handleToggleTester(user.id, user.is_tester || false)} 
                                                />
                                                {user.is_tester && <span className="text-[10px] text-orange-500 font-bold"><Beaker className="w-3 h-3 inline"/> Tester</span>}
                                            </div>
                                        </TableCell>

                                        {/* Active Ports Count */}
                                        <TableCell className="text-center">
                                            {user.activePortsCount > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                                    {user.activePortsCount}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">-</span>
                                            )}
                                        </TableCell>

                                        {/* Completed Orders Count */}
                                        <TableCell className="text-center">
                                            <span className="font-mono text-xs">{user.totalOrders}</span>
                                        </TableCell>

                                        {/* Total Spent */}
                                        <TableCell className="text-right">
                                            <div className="font-mono font-bold text-xs sm:text-sm text-foreground">
                                                ฿{user.totalSpent.toLocaleString()}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                                        ไม่พบรายชื่อลูกค้าที่ตรงกับเงื่อนไขการค้นหา
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* PAGINATION BAR (10 rows per page) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t bg-muted/20 text-xs">
                    <div className="text-muted-foreground">
                        {filteredUsers.length > 0 ? (
                            <>
                                แสดง <strong className="text-foreground">{(currentPage - 1) * pageSize + 1}</strong> - <strong className="text-foreground">{Math.min(currentPage * pageSize, filteredUsers.length)}</strong> จากทั้งหมด <strong className="text-foreground">{filteredUsers.length}</strong> รายการ (หน้า {currentPage} / {totalPages})
                            </>
                        ) : (
                            'ไม่มีรายการ'
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            {/* First Page */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                title="หน้าแรก"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>

                            {/* Previous Page */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                title="หน้าก่อนหน้า"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>

                            {/* Page Numbers */}
                            <div className="flex items-center gap-1 mx-1">
                                {pageNumbers.map((page, idx) => {
                                    if (page === '...') {
                                        return (
                                            <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">
                                                ...
                                            </span>
                                        );
                                    }
                                    const pageNum = Number(page);
                                    const isActive = currentPage === pageNum;
                                    return (
                                        <Button
                                            key={`page-${pageNum}`}
                                            variant={isActive ? 'default' : 'outline'}
                                            size="sm"
                                            className={`h-8 w-8 p-0 font-mono text-xs ${isActive ? 'font-bold' : ''}`}
                                            onClick={() => setCurrentPage(pageNum)}
                                        >
                                            {pageNum}
                                        </Button>
                                    );
                                })}
                            </div>

                            {/* Next Page */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                title="หน้าถัดไป"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>

                            {/* Last Page */}
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                title="หน้าสุดท้าย"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Transfer Line Dialog */}
            <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogContent className="sm:max-w-md bg-background border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            {isSuperAdmin ? (
                                <>
                                    <span className="text-gold">⚡️</span> ย้ายสายงานลูกค้าทันที (Super Admin)
                                </>
                            ) : (
                                "ขอเปลี่ยนสายงานลูกค้า (Transfer Line)"
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground text-xs">
                            {isSuperAdmin 
                                ? "ในฐานะ Super Admin (พี่โจ้) ท่านสามารถเลือกแอดมินปลายทางและกดย้ายสายงานได้ทันที 100% โดยไม่ต้องรอการอนุมัติสองฝ่าย"
                                : "การเปลี่ยนสายงานจะเกิดขึ้นก็ต่อเมื่อได้รับการอนุมัติแบบคู่ (Double Confirmation) จากทั้งแอดมินต้นสายและแอดมินปลายสายเรียบร้อยแล้ว"}
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
                                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-lg shadow-amber-500/25 px-5 py-2.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                                >
                                    {transferLoading ? (
                                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                                    ) : isSuperAdmin ? (
                                        <Check className="w-4 h-4 mr-2 stroke-[3]" />
                                    ) : (
                                        <GitPullRequest className="w-4 h-4 mr-2" />
                                    )}
                                    {isSuperAdmin ? "⚡️ ย้ายสายงานทันที" : "ส่งคำขอยืนยัน"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* CUSTOMER PORTS DETAILS DIALOG (View all ports of same customer) */}
            <Dialog open={isPortsDialogOpen} onOpenChange={setIsPortsDialogOpen}>
                <DialogContent className="sm:max-w-lg bg-background border-border shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <HardDrive className="w-5 h-5 text-primary" />
                            รายการพอร์ต MT5 ของ {selectedUserForPorts?.full_name || 'ลูกค้า'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            อีเมล: <span className="font-mono text-foreground">{selectedUserForPorts?.email}</span> | ทั้งหมด {selectedUserForPorts?.ports?.length || 0} พอร์ต
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto space-y-2 py-2">
                        {selectedUserForPorts?.ports && selectedUserForPorts.ports.length > 0 ? (
                            selectedUserForPorts.ports.map((port: CustomerPort, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${port.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                                        <div>
                                            <div className="font-mono font-bold text-sm text-foreground flex items-center gap-2">
                                                <span>{port.account_number}</span>
                                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${port.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'text-zinc-400 border-zinc-600/30'}`}>
                                                    {port.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                {port.product_name} ({port.product_key})
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-1.5 font-mono text-xs"
                                        onClick={() => handleCopy(port.account_number, `เลขพอร์ต ${port.account_number}`)}
                                        title="คัดลอกเลขพอร์ต"
                                    >
                                        {copiedKey === port.account_number ? (
                                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                        คัดลอก
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                ลูกค้ารายนี้ยังไม่มีพอร์ต MT5 ในระบบ
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
