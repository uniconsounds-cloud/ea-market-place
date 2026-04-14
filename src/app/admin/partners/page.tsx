'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Users, 
    Key, 
    Plus, 
    RefreshCcw, 
    Trash2, 
    ShieldCheck, 
    ShieldAlert,
    Search,
    Loader2,
    Copy,
    Check
} from 'lucide-react';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AdminPartnersPage() {
    const [partners, setPartners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [copyId, setCopyId] = useState<string | null>(null);

    useEffect(() => {
        fetchPartners();
    }, []);

    const fetchPartners = async () => {
        setLoading(true);
        try {
            // Get all profiles first
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .order('created_at', { ascending: false });

            if (profileError) throw profileError;

            // Get all API keys
            const { data: apiKeys, error: keyError } = await supabase
                .from('api_keys')
                .select('*');

            if (keyError) throw keyError;

            // Map keys to profiles
            const merged = profiles.map(profile => ({
                ...profile,
                apiKey: apiKeys.find(k => k.user_id === profile.id) || null
            }));

            setPartners(merged);
        } catch (error) {
            console.error('Error fetching partners:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateRandomKey = () => {
        const digits = Math.floor(100000 + Math.random() * 900000);
        return `EZE-${digits}`;
    };

    const handleCreateKey = async (userId: string, partnerName: string) => {
        setActionLoading(userId);
        const newKey = generateRandomKey();
        
        try {
            const { error } = await supabase
                .from('api_keys')
                .insert({
                    user_id: userId,
                    key_value: newKey,
                    partner_name: partnerName || 'Unnamed Partner',
                    status: 'active'
                });

            if (error) throw error;
            await fetchPartners();
        } catch (error: any) {
            alert('Error creating key: ' + error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleStatus = async (keyId: string, currentStatus: string) => {
        setActionLoading(keyId);
        const newStatus = currentStatus === 'active' ? 'revoked' : 'active';
        
        try {
            const { error } = await supabase
                .from('api_keys')
                .update({ status: newStatus })
                .eq('id', keyId);

            if (error) throw error;
            await fetchPartners();
        } catch (error: any) {
            alert('Error updating status: ' + error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteKey = async (keyId: string) => {
        if (!confirm('ยืนยันการลบ API Key นี้? ลูกค้าจะไม่สามารถ Sync ข้อมูลได้อีก')) return;
        
        setActionLoading(keyId);
        try {
            const { error } = await supabase
                .from('api_keys')
                .delete()
                .eq('id', keyId);

            if (error) throw error;
            await fetchPartners();
        } catch (error: any) {
            alert('Error deleting key: ' + error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredPartners = partners.filter(p => 
        (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.email?.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.apiKey?.key_value?.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopyId(id);
        setTimeout(() => setCopyId(null), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">พาร์ทเนอร์ & API Keys</h1>
                    <p className="text-muted-foreground mt-1">จัดการรหัสการเชื่อมต่อ EA สำหรับลูกค้าแต่ละราย</p>
                </div>
            </div>

            <Card className="border-white/10 glass-card">
                <CardHeader className="pb-3 text-white">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        รายชื่อลูกค้าทั้งหมด
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                placeholder="ค้นหาชื่อ, อีเมล หรือ API Key..." 
                                className="pl-9 bg-background/50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button variant="outline" onClick={fetchPartners}>
                            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    <div className="rounded-md border border-white/10">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent border-white/10">
                                    <TableHead>ลูกค้า (User)</TableHead>
                                    <TableHead>API Key</TableHead>
                                    <TableHead>สถานะ</TableHead>
                                    <TableHead className="text-right">จัดการ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredPartners.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            ไม่พบข้อมูลลูกค้า
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredPartners.map((partner) => (
                                        <TableRow key={partner.id} className="border-white/10">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{partner.full_name || 'No Name'}</span>
                                                    <span className="text-xs text-muted-foreground">{partner.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {partner.apiKey ? (
                                                    <div className="flex items-center gap-2">
                                                        <code className="bg-purple-500/10 text-purple-300 px-2 py-1 rounded font-mono text-xs">
                                                            {partner.apiKey.key_value}
                                                        </code>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-6 w-6"
                                                            onClick={() => handleCopy(partner.apiKey.key_value, partner.id)}
                                                        >
                                                            {copyId === partner.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">ยังไม่มีรหัส</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {partner.apiKey ? (
                                                    <Badge className={partner.apiKey.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>
                                                        {partner.apiKey.status === 'active' ? 'Active' : 'Revoked'}
                                                    </Badge>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {!partner.apiKey ? (
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleCreateKey(partner.id, partner.full_name)}
                                                            disabled={actionLoading === partner.id}
                                                        >
                                                            {actionLoading === partner.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                                                            สร้างรหัส
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline"
                                                                className={partner.apiKey.status === 'active' ? 'text-amber-400 border-amber-400/50 hover:bg-amber-400/10' : 'text-green-400 border-green-400/50 hover:bg-green-400/10'}
                                                                onClick={() => handleToggleStatus(partner.apiKey.id, partner.apiKey.status)}
                                                                disabled={actionLoading === partner.apiKey.id}
                                                            >
                                                                {actionLoading === partner.apiKey.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : 
                                                                 partner.apiKey.status === 'active' ? <ShieldAlert className="w-3 h-3 mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                                                                {partner.apiKey.status === 'active' ? 'ระงับ' : 'ปลดล็อค'}
                                                            </Button>
                                                            <Button 
                                                                size="sm" 
                                                                variant="ghost" 
                                                                className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                                                onClick={() => handleDeleteKey(partner.apiKey.id)}
                                                                disabled={actionLoading === partner.apiKey.id}
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </>
                                                    )}
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
        </div>
    );
}
