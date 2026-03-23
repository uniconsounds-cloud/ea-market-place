'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Save, Users, Edit2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAffiliatesClient({ initialProfiles }: { initialProfiles: any[] }) {
    const [profiles, setProfiles] = useState(initialProfiles);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingRateId, setEditingRateId] = useState<string | null>(null);
    const [newRate, setNewRate] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [sortOrder, setSortOrder] = useState('newest');

    const filteredProfiles = profiles.filter((profile: any) =>
        (profile.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (profile.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (profile.referral_code?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const sortedProfiles = [...filteredProfiles].sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        if (sortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        if (sortOrder === 'income-high') return (b.accumulated_commission || 0) - (a.accumulated_commission || 0);
        return 0;
    });

    const handleEditStart = (profile: any) => {
        setEditingRateId(profile.id);
        setNewRate(profile.commission_rate?.toString() || '2.0');
    };

    const handleSaveRate = async (id: string) => {
        const rateNumber = parseFloat(newRate);
        if (isNaN(rateNumber) || rateNumber < 0 || rateNumber > 100) {
            toast.error('กรุณาระบุอัตราที่ถูกต้อง (0-100)');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ commission_rate: rateNumber })
                .eq('id', id);

            if (error) throw error;

            // Update local state
            setProfiles(profiles.map(p => p.id === id ? { ...p, commission_rate: rateNumber } : p));
            toast.success('อัพเดทอัตราส่วนแบ่งสำเร็จ');
            setEditingRateId(null);
        } catch (error: any) {
            toast.error('Gเกิดข้อผิดพลาด: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">ระบบแนะนำ & Affiliate</h1>
                    <p className="text-muted-foreground">จัดการอัตราส่วนแบ่ง % และตรวจสอบรายได้ของผู้ใช้งาน</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row bg-card/50 p-4 rounded-xl border border-border/50 items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหา ชื่อ, อีเมล, หรือ Referral Code..."
                        className="pl-9 bg-background/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto ml-auto">
                    <select
                        className="flex h-10 w-full md:w-[150px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                    >
                        <option value="newest">สมัครล่าสุด</option>
                        <option value="oldest">สมัครเก่าสุด</option>
                        <option value="income-high">รายได้สูงสุด</option>
                    </select>
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead>ผู้ใช้งาน</TableHead>
                                <TableHead>วันที่สมัคร</TableHead>
                                <TableHead>สถานะ IB</TableHead>
                                <TableHead>แนะนำโดย (Upline)</TableHead>
                                <TableHead className="text-center">Rate (%)</TableHead>
                                <TableHead className="text-right">รายได้สะสม (฿)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedProfiles.length > 0 ? (
                                sortedProfiles.map((profile: any) => (
                                    <TableRow key={profile.id} className="hover:bg-muted/30 transition-colors">
                                        <TableCell>
                                            <div className="font-medium text-white">{profile.full_name || 'ไม่ได้ระบุชือ'}</div>
                                            <div className="text-xs text-muted-foreground">{profile.email}</div>
                                            <div className="text-xs mt-1 px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded inline-block font-mono">
                                                {profile.referral_code || '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {profile.created_at ? new Date(profile.created_at).toLocaleDateString('th-TH', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                }) : '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {profile.ib_memberships && profile.ib_memberships.some((m: any) => m.status === 'approved') ? (
                                                <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30">
                                                    ใช้งาน EA ฟรี
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">ปกติ</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {profile.upline ? (
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-3 h-3 text-muted-foreground" />
                                                    <span className="text-sm">{profile.upline.full_name || profile.upline.email}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">- ไม่มี -</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {editingRateId === profile.id ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={newRate}
                                                        onChange={(e) => setNewRate(e.target.value)}
                                                        className="w-20 h-8 text-center"
                                                        step="0.1"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveRate(profile.id)}
                                                        disabled={saving}
                                                        className="h-8 px-2"
                                                    >
                                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 group cursor-pointer" onClick={() => handleEditStart(profile)}>
                                                    <span className="font-bold text-accent">{profile.commission_rate || 2}%</span>
                                                    <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="font-bold font-mono">
                                                ฿{Number(profile.accumulated_commission || 0).toLocaleString()}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                        ไม่พบข้อมูลผู้ใช้งาน
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
