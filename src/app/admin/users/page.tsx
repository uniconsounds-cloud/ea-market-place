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
import { Search, Loader2, Users, ShoppingBag, CreditCard, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('spent-high');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // 1. Fetch Profiles (assuming admin RLS allows this)
            // We need to fetch ALL profiles.
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role'); // Removed created_at

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

            // 3. Process & Merge Data
            const processedUsers = profiles?.map(profile => {
                const userOrders = orders?.filter(o => o.user_id === profile.id) || [];
                const userLicenses = licenses?.filter(l => l.user_id === profile.id) || [];

                const totalSpent = userOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
                const totalOrders = userOrders.length;
                const activeProducts = userLicenses.length;

                return {
                    ...profile,
                    totalSpent,
                    totalOrders,
                    activeProducts
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
    const filteredUsers = users.filter(user => {
        const searchLower = searchQuery.toLowerCase();
        return (
            user.email?.toLowerCase().includes(searchLower) ||
            user.full_name?.toLowerCase().includes(searchLower) ||
            user.id.toLowerCase().includes(searchLower)
        );
    }).sort((a, b) => {
        if (sortOrder === 'spent-high') return b.totalSpent - a.totalSpent;
        if (sortOrder === 'spent-low') return a.totalSpent - b.totalSpent;
        if (sortOrder === 'orders-high') return b.totalOrders - a.totalOrders;
        // created_at removed
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
                    <Select value={sortOrder} onValueChange={setSortOrder}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="เรียงลำดับ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="spent-high">ยอดซื้อสูงสุด</SelectItem>
                            <SelectItem value="spent-low">ยอดซื้อต่ำสุด</SelectItem>
                            <SelectItem value="orders-high">จำนวนออเดอร์มากสุด</SelectItem>
                            <SelectItem value="newest">สมัครล่าสุด</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-[300px]">ลูกค้า (User)</TableHead>
                            <TableHead className="text-center">Active Products</TableHead>
                            <TableHead className="text-center">Orders (สำเร็จ)</TableHead>
                            <TableHead className="text-right">ยอดใช้จ่ายรวม</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    <Loader2 className="animate-spin h-6 w-6 mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <TableRow key={user.id} className="hover:bg-muted/50">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.full_name || 'No Name'}</span>
                                            <span className="text-xs text-muted-foreground">{user.email || user.id}</span>
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
                                    <TableCell>
                                        <Button variant="ghost" size="icon" disabled>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    ไม่พบรายชื่อลูกค้า
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
