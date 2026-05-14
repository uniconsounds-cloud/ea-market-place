'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy, Users, TrendingUp, ShieldCheck, AlertCircle, MessageSquare, Trash2, Trophy, Filter, Download } from 'lucide-react';

interface DemoUser {
    id: string;
    user_id: string;
    user_email: string;
    user_name: string;
    risk_level: number;
    current_balance: number;
    join_date: string;
}

export default function DemoChallengeAdminPage() {
    const [users, setUsers] = useState<DemoUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [originUrl, setOriginUrl] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [demoMasterPort, setDemoMasterPort] = useState('');
    const [savingBroadcast, setSavingBroadcast] = useState(false);
    
    // Leaderboard states
    const [activeTab, setActiveTab] = useState<'team' | 'leaderboard'>('team');
    const [allUsers, setAllUsers] = useState<DemoUser[]>([]);
    const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | number>('all');

    useEffect(() => {
        setOriginUrl(window.location.origin);
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            setAdminId(user.id);

            // Fetch users referred by this admin
            const { data, error } = await supabase
                .from('admin_demo_challenges_view')
                .select('*')
                .eq('referrer_id', user.id)
                .order('join_date', { ascending: false });

            if (error) throw error;
            setUsers(data || []);

            // Fetch ALL users for leaderboard
            const { data: allData, error: allErr } = await supabase
                .from('admin_demo_challenges_view')
                .select('*')
                .order('current_balance', { ascending: false });

            if (!allErr && allData) setAllUsers(allData);

            // Fetch current admin broadcast message and master port
            const { data: profile } = await supabase
                .from('profiles')
                .select('demo_broadcast_message, demo_master_port')
                .eq('id', user.id)
                .single();
            if (profile) {
                if (profile.demo_broadcast_message) setBroadcastMessage(profile.demo_broadcast_message);
                else setBroadcastMessage("💬 ADMIN: ยินดีต้อนรับสู่แคมเปญ Demo Challenge! 🚀");
                
                if (profile.demo_master_port) setDemoMasterPort(profile.demo_master_port);
            }
        } catch (error: any) {
            console.error('Error fetching demo users:', error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const campaignLink = adminId ? `${originUrl}/demo-challenge?ref=${adminId}` : '';

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(campaignLink);
            toast.success("คัดลอกลิ้งก์แล้ว");
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    const getRiskLabel = (level: number) => {
        if (level <= 1.2) return <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded text-xs font-bold">สายเซฟ (x{level.toFixed(2)})</span>;
        if (level <= 1.7) return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-bold">สายเติบโต (x{level.toFixed(2)})</span>;
        return <span className="px-2 py-1 bg-red-500/20 text-red-500 rounded text-xs font-bold">สายซิ่ง (x{level.toFixed(2)})</span>;
    };

    const handleSaveBroadcast = async () => {
        if (!adminId) return;
        setSavingBroadcast(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    demo_broadcast_message: broadcastMessage,
                    demo_master_port: demoMasterPort || null 
                })
                .eq('id', adminId);

            if (error) throw error;
            toast.success("บันทึกข้อความประกาศเรียบร้อยแล้ว");
        } catch (error: any) {
            console.error('Error saving broadcast:', error);
            toast.error(error.message);
        } finally {
            setSavingBroadcast(false);
        }
    };

    const handleDeleteParticipant = async (challengeId: string) => {
        if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้ารายนี้ออกจากแคมเปญเดโม? (ลูกค้าจะสามารถสมัครใหม่ได้)')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('demo_challenges')
                .delete()
                .eq('id', challengeId);

            if (error) throw error;
            
            toast.success('ลบลูกค้ารายนี้ออกจากแคมเปญเรียบร้อยแล้ว');
            fetchData();
        } catch (error: any) {
            console.error('Error deleting participant:', error);
            toast.error(error.message);
        }
    };

    const copyTop3 = async () => {
        const top3 = allUsers.slice(0, 3);
        if (top3.length === 0) {
            toast.error("ยังไม่มีข้อมูลผู้ชนะ");
            return;
        }
        const text = top3.map((u, i) => {
            const growth = Number(u.current_balance) - 10000;
            return `🏆 อันดับ ${i + 1}: ${u.user_name || u.user_email?.split('@')[0]} (${Number(u.risk_level) <= 1.2 ? 'สายเซฟ' : Number(u.risk_level) <= 1.7 ? 'สายเติบโต' : 'สายซิ่ง'}) ยอดรวม $${Number(u.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${growth.toFixed(2)} USC)`;
        }).join('\n');

        try {
            await navigator.clipboard.writeText(text);
            toast.success("คัดลอกผลงาน Top 3 เรียบร้อยแล้ว");
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-orange-500">🎮 $100 Demo Challenge</h1>
                <p className="text-muted-foreground mt-2">
                    จัดการแคมเปญการตลาดสำหรับดึงดูดลูกค้าใหม่ด้วยพอร์ตจำลอง
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-orange-500/50 bg-orange-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-orange-500" />
                            ลิ้งก์ชวนลูกค้าของคุณ (Affiliate Link)
                        </CardTitle>
                        <CardDescription>
                            คัดลอกลิ้งก์นี้ไปให้ลูกค้าสมัคร เมื่อลูกค้าเข้าร่วมแคมเปญจะถูกนับเป็นสายงานของคุณทันที
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex space-x-2 mt-4">
                            <Input value={campaignLink} readOnly className="bg-background font-mono text-sm" />
                            <Button onClick={copyToClipboard} variant="outline">
                                <Copy className="h-4 w-4 mr-2" />
                                คัดลอก
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                            สถิติแคมเปญของคุณ
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">ลูกทีมในแคมเปญ</span>
                                <span className="text-3xl font-bold text-foreground">{users.length} <span className="text-lg font-normal text-muted-foreground">คน</span></span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">รวมยอดพอร์ตจำลอง</span>
                                <span className="text-3xl font-bold text-foreground">
                                    {users.reduce((sum, u) => sum + Number(u.current_balance), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    <span className="text-lg font-normal text-muted-foreground"> USC</span>
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-blue-500/30">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-blue-500" />
                        ข้อความประกาศถึงลูกทีม (Broadcast Message)
                    </CardTitle>
                    <CardDescription>
                        ข้อความนี้จะแสดงผลบนหน้า Farm HUD ของลูกทีมทุกคนที่เข้าร่วมผ่านลิ้งก์ของคุณ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col space-y-4 mt-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">ข้อความประกาศ Ticker</label>
                            <Input 
                                value={broadcastMessage} 
                                onChange={(e) => setBroadcastMessage(e.target.value)}
                                placeholder="เช่น ยินดีต้อนรับทุกคน! วันนี้ตลาดทองคำน่าลุ้นมาก" 
                                maxLength={100}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">เลขพอร์ตต้นแบบ (Master Port)</label>
                            <div className="flex space-x-2">
                                Input 
                                    value={demoMasterPort} 
                                    onChange={(e) => setDemoMasterPort(e.target.value)}
                                    placeholder="เช่น 100000 (ถ้าเว้นว่างจะใช้พอร์ตหลักของบริษัท)" 
                                />
                                <Button onClick={handleSaveBroadcast} disabled={savingBroadcast} className="whitespace-nowrap">
                                    {savingBroadcast ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* TAB SWITCHER */}
            <div className="flex items-center gap-2 border-b pb-4">
                <Button 
                    variant={activeTab === 'team' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('team')}
                    className="flex items-center gap-2"
                >
                    <Users className="h-4 w-4" /> ลูกทีมของฉัน (My Team)
                </Button>
                <Button 
                    variant={activeTab === 'leaderboard' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('leaderboard')}
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-none shadow-md"
                >
                    <Trophy className="h-4 w-4" /> กระดานจัดอันดับทั้งหมด (Global Leaderboard)
                </Button>
            </div>

            {activeTab === 'team' ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            รายชื่อลูกทีมที่เข้าร่วมแคมเปญ
                        </CardTitle>
                        <CardDescription>
                            แสดงรายการลูกค้าที่สมัครผ่านลิ้งก์ของคุณ และระดับความเสี่ยงที่พวกเขาเลือก
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
                        ) : users.length === 0 ? (
                            <div className="py-12 text-center border rounded-lg border-dashed">
                                <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                                <h3 className="text-lg font-medium text-foreground">ยังไม่มีลูกทีมในแคมเปญ</h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                                    ก็อปปี้ลิ้งก์ด้านบนส่งให้ลูกค้าเพื่อชวนพวกเขามาร่วมสัมผัสประสบการณ์เทรดแบบ $100 Demo Challenge
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>อีเมลลูกค้า</TableHead>
                                            <TableHead>ระดับความเสี่ยง</TableHead>
                                            <TableHead className="text-right">พอร์ตจำลอง (USC)</TableHead>
                                            <TableHead className="text-right">เข้าร่วมเมื่อ</TableHead>
                                            <TableHead className="text-right">จัดการ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => {
                                            const growth = Number(user.current_balance) - 10000;
                                            return (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{user.user_name || 'ลูกค้า'}</div>
                                                        <div className="text-xs text-muted-foreground">{user.user_email}</div>
                                                    </TableCell>
                                                    <TableCell>{getRiskLabel(user.risk_level)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="font-bold">{Number(user.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                        <div className={`text-xs ${growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {growth > 0 ? '+' : ''}{growth.toFixed(2)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-muted-foreground">
                                                        {new Date(user.join_date).toLocaleDateString('th-TH')}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            onClick={() => handleDeleteParticipant(user.id)}
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-500/10"
                                                            title="ลบลูกค้ารายนี้"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-orange-500/30 shadow-lg">
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl text-orange-500">
                                <Trophy className="h-6 w-6 animate-pulse" />
                                Global Challenge Leaderboard
                            </CardTitle>
                            <CardDescription>
                                กระดานจัดอันดับผู้ทำกำไรสูงสุดในแคมเปญทั้งหมดของบริษัท
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {(['all', 1.0, 1.5, 2.0] as const).map((filter) => (
                                <Button
                                    key={String(filter)}
                                    size="sm"
                                    variant={leaderboardFilter === filter ? 'default' : 'outline'}
                                    onClick={() => setLeaderboardFilter(filter)}
                                    className={`text-xs ${leaderboardFilter === filter ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}`}
                                >
                                    {filter === 'all' ? '🌟 ทั้งหมด' : filter === 1.0 ? '🛡️ สายเซฟ' : filter === 1.5 ? '🚀 สายเติบโต' : '🔥 สายซิ่ง'}
                                </Button>
                            ))}
                            <Button size="sm" variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10" onClick={copyTop3}>
                                <Copy className="h-4 w-4 mr-1" /> คัดลอก Top 3
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground">กำลังโหลดกระดานจัดอันดับ...</div>
                        ) : allUsers.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">ยังไม่มีผู้เข้าร่วมแคมเปญ</div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16 text-center">อันดับ</TableHead>
                                            <TableHead>นักลงทุน</TableHead>
                                            <TableHead>ความเสี่ยง</TableHead>
                                            <TableHead className="text-right">พอร์ตจำลอง (USC)</TableHead>
                                            <TableHead className="text-right">กำไรสุทธิ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(leaderboardFilter === 'all' ? allUsers : allUsers.filter(u => Number(u.risk_level) === leaderboardFilter)).map((user, idx) => {
                                            const growth = Number(user.current_balance) - 10000;
                                            let badge = <span className="font-bold text-muted-foreground">{idx + 1}</span>;
                                            if (idx === 0) badge = <span className="text-xl">🏆</span>;
                                            else if (idx === 1) badge = <span className="text-xl">🥈</span>;
                                            else if (idx === 2) badge = <span className="text-xl">🥉</span>;

                                            return (
                                                <TableRow key={user.id} className={idx < 3 ? 'bg-orange-500/5' : ''}>
                                                    <TableCell className="text-center font-mono">{badge}</TableCell>
                                                    <TableCell>
                                                        <div className="font-bold text-foreground">{user.user_name || 'Trader'}</div>
                                                        <div className="text-xs text-muted-foreground">{user.user_email}</div>
                                                    </TableCell>
                                                    <TableCell>{getRiskLabel(user.risk_level)}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold text-base text-foreground">
                                                        ${Number(user.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className={`font-mono font-bold text-sm ${growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {growth >= 0 ? '+' : ''}{growth.toFixed(2)} USC
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
