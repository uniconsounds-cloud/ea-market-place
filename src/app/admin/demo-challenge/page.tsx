'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
    Copy, Users, TrendingUp, ShieldCheck, AlertCircle, MessageSquare, 
    Trash2, Trophy, Filter, ShieldAlert, Activity, RefreshCw, 
    ArrowRightLeft, CheckCircle2, AlertTriangle, XCircle, Search, ChevronLeft, ChevronRight, Layers
} from 'lucide-react';
import { 
    LiveTrackerPoolConfig, 
    DEFAULT_LIVE_TRACKER_CONFIG, 
    parsePoolConfig 
} from '@/lib/liveTrackerSynthetic';

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
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [adminId, setAdminId] = useState<string | null>(null);
    const [originUrl, setOriginUrl] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [demoMasterPort, setDemoMasterPort] = useState('');
    const [savingBroadcast, setSavingBroadcast] = useState(false);
    const router = useRouter();
    
    // Tab states
    const [activeTab, setActiveTab] = useState<'model_pool' | 'team' | 'leaderboard'>('model_pool');
    const [allUsers, setAllUsers] = useState<DemoUser[]>([]);
    const [leaderboardFilter, setLeaderboardFilter] = useState<'all' | number>('all');

    // Pool states
    const [poolConfig, setPoolConfig] = useState<LiveTrackerPoolConfig>(DEFAULT_LIVE_TRACKER_CONFIG);
    const [poolStatuses, setPoolStatuses] = useState<Record<string, any>>({});
    const [poolLoading, setPoolLoading] = useState(false);
    const [swapping, setSwapping] = useState(false);
    const [selectedOutPort, setSelectedOutPort] = useState<string | null>(null);
    const [selectedInPort, setSelectedInPort] = useState<string>('');

    // Pagination & Search states
    const [teamSearch, setTeamSearch] = useState('');
    const [teamPage, setTeamPage] = useState(1);
    const PAGE_SIZE = 10;

    const [leaderboardSearch, setLeaderboardSearch] = useState('');
    const [leaderboardPage, setLeaderboardPage] = useState(1);

    useEffect(() => {
        setOriginUrl(window.location.origin);
        fetchData();
        fetchPoolData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            
            setUserEmail(user.email || null);
            if (user.email !== 'juntarasate@gmail.com') {
                setLoading(false);
                return;
            }
            
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
                if (profile.demo_broadcast_message) setBroadcastMessage(profile.demo_broadcast_message.replaceAll('$100 Demo Challenge', 'EasyM Live Tracker'));
                else setBroadcastMessage("💬 ADMIN: ยินดีต้อนรับสู่โครงการ EasyM Live Tracker! 🚀");
                
                if (profile.demo_master_port) {
                    setDemoMasterPort(profile.demo_master_port);
                    setPoolConfig(parsePoolConfig(profile.demo_master_port));
                }
            }
        } catch (error: any) {
            console.error('Error fetching demo users:', error);
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchPoolData = async () => {
        try {
            setPoolLoading(true);
            const res = await fetch('/api/admin/live-tracker-pool');
            if (res.ok) {
                const data = await res.json();
                if (data.config) setPoolConfig(data.config);
                if (data.statuses) setPoolStatuses(data.statuses);
            }
        } catch (err) {
            console.error('Failed to load pool data:', err);
        } finally {
            setPoolLoading(false);
        }
    };

    const campaignLink = adminId ? `${originUrl}/demo-challenge?ref=${adminId}&openExternalBrowser=1` : '';

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(campaignLink);
            toast.success("คัดลอกลิ้งก์แล้ว");
        } catch (err) {
            console.error("Failed to copy", err);
        }
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
        if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบลูกค้ารายนี้ออกจากโครงการ EasyM Live Tracker? (ลูกค้าจะสามารถสมัครใหม่ได้)')) {
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
            const growth = Number(u.current_balance) - 100000;
            return `🏆 อันดับ ${i + 1}: ${u.user_name || u.user_email?.split('@')[0]} ยอดรวม $${Number(u.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (+${growth.toFixed(2)} USC)`;
        }).join('\n');

        try {
            await navigator.clipboard.writeText(text);
            toast.success("คัดลอกผลงาน Top 3 เรียบร้อยแล้ว");
        } catch (err) {
            console.error(err);
        }
    };

    // Health check & Auto-swap action
    const handleRunHealthCheck = async () => {
        setSwapping(true);
        try {
            const res = await fetch('/api/admin/live-tracker-pool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'health_check' })
            });
            const data = await res.json();
            if (data.success && data.config) {
                setPoolConfig(data.config);
                await fetchPoolData();
                toast.success('ตรวจสอบสุขภาพพอร์ตและอัปเดตระบบเรียบร้อย');
            } else {
                toast.error(data.error || 'เกิดข้อผิดพลาดในการตรวจสอบ');
            }
        } catch (err: any) {
            toast.error(err.message || 'Health check failed');
        } finally {
            setSwapping(false);
        }
    };

    // Manual Swap action
    const handleManualSwap = async () => {
        if (!selectedOutPort || !selectedInPort) {
            toast.error('กรุณาเลือกพอร์ตออกและพอร์ตเข้า');
            return;
        }
        setSwapping(true);
        try {
            const res = await fetch('/api/admin/live-tracker-pool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'manual_swap',
                    outPort: selectedOutPort,
                    inPort: selectedInPort,
                    reason: `แอดมินสลับพอร์ตด้วยตนเอง (#${selectedOutPort} -> #${selectedInPort})`
                })
            });
            const data = await res.json();
            if (data.success && data.config) {
                setPoolConfig(data.config);
                setSelectedOutPort(null);
                setSelectedInPort('');
                await fetchPoolData();
                toast.success(`สลับพอร์ต #${selectedOutPort} กับ #${selectedInPort} สำเร็จ`);
            } else {
                toast.error(data.error || 'เกิดข้อผิดพลาดในการสลับพอร์ต');
            }
        } catch (err: any) {
            toast.error(err.message || 'Swap failed');
        } finally {
            setSwapping(false);
        }
    };

    // Filtered & Paginated Team Users
    const filteredUsers = useMemo(() => {
        if (!teamSearch.trim()) return users;
        const q = teamSearch.toLowerCase().trim();
        return users.filter(u => 
            (u.user_email || '').toLowerCase().includes(q) || 
            (u.user_name || '').toLowerCase().includes(q)
        );
    }, [users, teamSearch]);

    const totalTeamPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
    const paginatedTeamUsers = useMemo(() => {
        const start = (teamPage - 1) * PAGE_SIZE;
        return filteredUsers.slice(start, start + PAGE_SIZE);
    }, [filteredUsers, teamPage]);

    // Filtered & Paginated Leaderboard Users
    const filteredLeaderboardUsers = useMemo(() => {
        let list = allUsers;
        if (leaderboardFilter !== 'all') {
            list = list.filter(u => {
                const r = Number(u.risk_level);
                if (leaderboardFilter === 1.0) return r <= 1.25;
                if (leaderboardFilter === 1.5) return r > 1.25 && r <= 1.75;
                return r > 1.75;
            });
        }
        if (leaderboardSearch.trim()) {
            const q = leaderboardSearch.toLowerCase().trim();
            list = list.filter(u => 
                (u.user_email || '').toLowerCase().includes(q) || 
                (u.user_name || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [allUsers, leaderboardFilter, leaderboardSearch]);

    const totalLeaderboardPages = Math.max(1, Math.ceil(filteredLeaderboardUsers.length / PAGE_SIZE));
    const paginatedLeaderboardUsers = useMemo(() => {
        const start = (leaderboardPage - 1) * PAGE_SIZE;
        return filteredLeaderboardUsers.slice(start, start + PAGE_SIZE);
    }, [filteredLeaderboardUsers, leaderboardPage]);

    // Compute live stats for 10 Active Ports
    const activeStats = useMemo(() => {
        const ports = poolConfig.activePorts;
        let totalBal = 0;
        let totalTodayProfit = 0;
        let totalFloating = 0;
        let healthyCount = 0;

        ports.forEach(p => {
            const s = poolStatuses[p];
            if (s) {
                const bal = Number(s.balance) || 0;
                totalBal += s.account_type === 'USD' ? bal * 100 : bal;
                totalTodayProfit += Number(s.today_pnl) || 0;
                totalFloating += Number(s.floating_pnl) || 0;

                const pingTime = s.last_ping ? new Date(s.last_ping).getTime() : 0;
                const hoursSincePing = (Date.now() - pingTime) / (1000 * 60 * 60);
                if (bal >= 100000 && hoursSincePing <= 48) {
                    healthyCount++;
                }
            }
        });

        const count = Math.max(1, ports.length);
        return {
            avgBalance: totalBal / count,
            avgTodayProfit: totalTodayProfit / count,
            avgFloating: totalFloating / count,
            healthyCount,
            totalPorts: ports.length
        };
    }, [poolConfig.activePorts, poolStatuses]);

    if (!loading && userEmail !== 'juntarasate@gmail.com') {
        return (
            <div className="flex h-[70vh] items-center justify-center p-4">
                <Card className="max-w-md w-full border-red-500/20 bg-red-950/10 text-center">
                    <CardHeader>
                        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-2" />
                        <CardTitle className="text-xl text-red-500">สิทธิ์การเข้าถึงถูกจำกัด</CardTitle>
                        <CardDescription>
                            หน้านี้อนุญาตให้เฉพาะผู้ดูแลระบบหลัก (juntarasate@gmail.com) เข้าใช้งานเท่านั้น
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" onClick={() => router.push('/admin')}>
                            กลับสู่หน้า Admin
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-orange-500 flex items-center gap-2">
                    <span>🎮 EasyM Live Tracker</span>
                </h1>
                <p className="text-muted-foreground mt-2">
                    จัดการระบบติดตามพอร์ตจริงเรียลไทม์ พร้อมระบบโมเดลพอร์ตต้นแบบเฉลี่ย (Synthetic Model)
                </p>
            </div>

            {/* Campaign Summary & Affiliate Link */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-orange-500/50 bg-orange-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-orange-500" />
                            ลิ้งก์ชวนลูกค้าของคุณ (Affiliate Link)
                        </CardTitle>
                        <CardDescription>
                            คัดลอกลิ้งก์นี้ไปให้ลูกค้าสมัคร เมื่อลูกค้าเข้าร่วมโครงการจะถูกนับเป็นสายงานของคุณทันที
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
                                <span className="text-sm text-muted-foreground">ลูกทีมในโครงการ</span>
                                <span className="text-3xl font-bold text-foreground">{users.length} <span className="text-lg font-normal text-muted-foreground">คน</span></span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm text-muted-foreground">รวมยอดพอร์ต EasyM Live Tracker</span>
                                <span className="text-3xl font-bold text-foreground">
                                    {users.reduce((sum, u) => sum + Number(u.current_balance), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    <span className="text-lg font-normal text-muted-foreground"> USC</span>
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Broadcast Message Settings */}
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
                        <div className="flex justify-end">
                            <Button onClick={handleSaveBroadcast} disabled={savingBroadcast}>
                                {savingBroadcast ? 'กำลังบันทึก...' : 'บันทึกข้อความ'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* TAB SWITCHER */}
            <div className="flex items-center gap-2 border-b pb-4 overflow-x-auto no-scrollbar">
                <Button 
                    variant={activeTab === 'model_pool' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('model_pool')}
                    className="flex items-center gap-2"
                >
                    <Layers className="h-4 w-4 text-emerald-400" />
                    🎯 พอร์ตต้นแบบเฉลี่ย (Synthetic Model Pool)
                </Button>
                <Button 
                    variant={activeTab === 'team' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('team')}
                    className="flex items-center gap-2"
                >
                    <Users className="h-4 w-4" /> ลูกทีมของฉัน ({users.length} คน)
                </Button>
                <Button 
                    variant={activeTab === 'leaderboard' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('leaderboard')}
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white border-none shadow-md"
                >
                    <Trophy className="h-4 w-4" /> กระดานจัดอันดับ (Global Leaderboard)
                </Button>
            </div>

            {/* ═══ TAB 1: MODEL POOL MANAGEMENT ═══ */}
            {activeTab === 'model_pool' && (
                <div className="space-y-6">
                    {/* Header Card & Quick Stats */}
                    <Card className="border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-black to-slate-950/40">
                        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                                    <CardTitle className="text-xl text-emerald-400 font-mono">
                                        ระบบค่าเฉลี่ย 10 พอร์ตต้นแบบ (10-Port Synthetic Engine)
                                    </CardTitle>
                                </div>
                                <CardDescription className="mt-1 text-xs">
                                    เริ่มต้นใช้งาน: <strong className="text-white">22 มิถุนายน 2026</strong> • กติกา: ทุน <strong>$1,000 – $2,000 (100,000 – 200,000 USC)</strong> • ระบบสลับอัตโนมัติเมื่อพอร์ตมีปัญหา
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button 
                                    size="sm" 
                                    onClick={fetchPoolData} 
                                    disabled={poolLoading}
                                    variant="outline"
                                    className="border-emerald-500/40 hover:bg-emerald-500/10"
                                >
                                    <RefreshCw className={`h-4 w-4 mr-1.5 ${poolLoading ? 'animate-spin' : ''}`} />
                                    รีเฟรชข้อมูล
                                </Button>
                                <Button 
                                    size="sm" 
                                    onClick={handleRunHealthCheck} 
                                    disabled={swapping}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                                >
                                    <Activity className={`h-4 w-4 mr-1.5 ${swapping ? 'animate-pulse' : ''}`} />
                                    {swapping ? 'กำลังตรวจสอบ...' : '⚡ ตรวจสอบสุขภาพ & สลับอัตโนมัติ'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-emerald-500/20">
                                <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/20">
                                    <span className="text-[11px] font-mono text-muted-foreground block">ทุนเฉลี่ย 10 พอร์ตหลัก</span>
                                    <span className="text-xl font-bold font-mono text-emerald-400">
                                        {activeStats.avgBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })} USC
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block">(${(activeStats.avgBalance / 100).toFixed(0)})</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/20">
                                    <span className="text-[11px] font-mono text-muted-foreground block">กำไรเฉลี่ยวันนี้</span>
                                    <span className={`text-xl font-bold font-mono ${activeStats.avgTodayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {activeStats.avgTodayProfit >= 0 ? '+' : ''}{activeStats.avgTodayProfit.toFixed(2)} USC
                                    </span>
                                    <span className="text-[10px] text-muted-foreground block">เฉลี่ยต่อพอร์ต</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/20">
                                    <span className="text-[11px] font-mono text-muted-foreground block">สุขภาพพอร์ตหลัก</span>
                                    <span className="text-xl font-bold font-mono text-foreground flex items-center gap-1.5">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        {activeStats.healthyCount} / {activeStats.totalPorts} สมบูรณ์
                                    </span>
                                    <span className="text-[10px] text-emerald-400/80 block">ทุนถึง &amp; สื่อสารสม่ำเสมอ</span>
                                </div>
                                <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/20">
                                    <span className="text-[11px] font-mono text-muted-foreground block">พอร์ตสำรองสแตนด์บาย</span>
                                    <span className="text-xl font-bold font-mono text-cyan-400">
                                        {poolConfig.reservePorts.length} พอร์ต
                                    </span>
                                    <span className="text-[10px] text-cyan-400/70 block">พร้อมสลับทันที</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Active Pool Table (10 Ports) */}
                    <Card className="border-border">
                        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 gap-2">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                    10 พอร์ตหลักที่ใช้อ้างอิงผลงาน (Active Model Pool)
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    พอร์ตเหล่านี้ถูกนำข้อมูลกำไรรายวันและ DD มารวมคำนวณเป็นเส้นทางข้อมูลของ Live Tracker
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="w-12 text-center">#</TableHead>
                                            <TableHead>เลขพอร์ต</TableHead>
                                            <TableHead>บอท</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                            <TableHead className="text-right">Equity</TableHead>
                                            <TableHead className="text-right">Floating PnL</TableHead>
                                            <TableHead className="text-right">กำไรวันนี้</TableHead>
                                            <TableHead className="text-center">สื่อสารล่าสุด</TableHead>
                                            <TableHead className="text-center">สถานะสุขภาพ</TableHead>
                                            <TableHead className="text-right">สลับพอร์ต</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {poolConfig.activePorts.map((portNum, idx) => {
                                            const s = poolStatuses[portNum];
                                            const bal = Number(s?.balance) || 0;
                                            const balUSC = s?.account_type === 'USD' ? bal * 100 : bal;
                                            const eq = Number(s?.equity) || bal;
                                            const fp = Number(s?.floating_pnl) || 0;
                                            const tp = Number(s?.today_pnl) || 0;

                                            const pingTime = s?.last_ping ? new Date(s.last_ping).getTime() : 0;
                                            const hoursSincePing = (Date.now() - pingTime) / (1000 * 60 * 60);

                                            const isBalOk = balUSC >= 100000;
                                            const isOnlineOk = hoursSincePing <= 48;
                                            const isHealthy = isBalOk && isOnlineOk;

                                            return (
                                                <TableRow key={portNum} className="hover:bg-muted/40 font-mono text-xs">
                                                    <TableCell className="text-center font-bold text-muted-foreground">{idx + 1}</TableCell>
                                                    <TableCell className="font-bold text-foreground">
                                                        <a 
                                                            href={`/farm/${portNum}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="hover:underline hover:text-blue-400"
                                                        >
                                                            #{portNum}
                                                        </a>
                                                    </TableCell>
                                                    <TableCell className="text-blue-400 font-sans">{s?.system_code || 'EasyM Max'}</TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        {balUSC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {s?.account_type || 'USC'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {eq.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-bold ${fp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {fp >= 0 ? '+' : ''}{fp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                    <TableCell className={`text-right font-bold ${tp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {tp >= 0 ? '+' : ''}{tp.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-center text-[11px] text-muted-foreground">
                                                        {hoursSincePing < 1 ? 'เมื่อสักครู่' : `${Math.round(hoursSincePing)} ชม. ที่แล้ว`}
                                                    </TableCell>
                                                    <TableCell className="text-center font-sans">
                                                        {isHealthy ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                                                🟢 สมบูรณ์
                                                            </span>
                                                        ) : !isBalOk ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                                                                ⚠️ ทุนต่ำ
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                                                🔴 ขาดการติดต่อ
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                setSelectedOutPort(portNum);
                                                                setSelectedInPort(poolConfig.reservePorts[0] || '');
                                                            }}
                                                            className="h-7 px-2 text-[11px] font-sans text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                                                        >
                                                            <ArrowRightLeft className="w-3 h-3 mr-1" />
                                                            สลับ
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Manual Swap Dialog Card (when selected) */}
                    {selectedOutPort && (
                        <Card className="border-cyan-500/50 bg-cyan-950/20 p-4 animate-fade-in">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <h4 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
                                        <ArrowRightLeft className="w-4 h-4" />
                                        ต้องการสลับพอร์ตหลัก #{selectedOutPort} ออก
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        เลือกพอร์ตสำรองที่ต้องการนำเข้ามาแทนใน Active Model Pool
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <select
                                        value={selectedInPort}
                                        onChange={(e) => setSelectedInPort(e.target.value)}
                                        className="bg-black/60 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                                    >
                                        <option value="">-- เลือกพอร์ตสำรอง --</option>
                                        {poolConfig.reservePorts.map(rp => (
                                            <option key={rp} value={rp}>
                                                พอร์ต #{rp} ({Number(poolStatuses[rp]?.balance || 0).toLocaleString()} USC)
                                            </option>
                                        ))}
                                    </select>
                                    <Button size="sm" onClick={handleManualSwap} disabled={swapping} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                                        ยืนยันสลับ
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setSelectedOutPort(null)}>
                                        ยกเลิก
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Reserve Pool Table (10 Reserve Ports) */}
                    <Card className="border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Layers className="w-5 h-5 text-cyan-400" />
                                10 พอร์ตสำรองที่เตรียมไว้ (Reserve Model Pool)
                            </CardTitle>
                            <CardDescription className="text-xs">
                                หากพอร์ตหลักตัวใดทุนต่ำกว่า $1,000 หรือหยุดรัน ระบบจะดึงพอร์ตจากคิวนี้เข้ามาทดแทนอัตโนมัติ
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="w-16 text-center">คิว</TableHead>
                                            <TableHead>เลขพอร์ต</TableHead>
                                            <TableHead>บอท</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                            <TableHead className="text-center">สื่อสารล่าสุด</TableHead>
                                            <TableHead className="text-center">ความพร้อมใช้งาน</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {poolConfig.reservePorts.map((portNum, idx) => {
                                            const s = poolStatuses[portNum];
                                            const bal = Number(s?.balance) || 0;
                                            const balUSC = s?.account_type === 'USD' ? bal * 100 : bal;
                                            const pingTime = s?.last_ping ? new Date(s.last_ping).getTime() : 0;
                                            const hoursSincePing = (Date.now() - pingTime) / (1000 * 60 * 60);
                                            const isReady = balUSC >= 100000 && hoursSincePing <= 48;

                                            return (
                                                <TableRow key={portNum} className="hover:bg-muted/40 font-mono text-xs">
                                                    <TableCell className="text-center font-bold text-muted-foreground">#{idx + 1}</TableCell>
                                                    <TableCell className="font-bold text-foreground">
                                                        <a href={`/farm/${portNum}`} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-blue-400">
                                                            #{portNum}
                                                        </a>
                                                    </TableCell>
                                                    <TableCell className="text-blue-400 font-sans">{s?.system_code || 'EasyM Max'}</TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        {balUSC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USC
                                                    </TableCell>
                                                    <TableCell className="text-center text-[11px] text-muted-foreground">
                                                        {hoursSincePing < 1 ? 'เมื่อสักครู่' : `${Math.round(hoursSincePing)} ชม. ที่แล้ว`}
                                                    </TableCell>
                                                    <TableCell className="text-center font-sans">
                                                        {isReady ? (
                                                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                                                                สแตนด์บายพร้อม
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 text-[10px]">
                                                                ยังไม่พร้อม
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Swap Logs Table (Audit History) */}
                    <Card className="border-border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Activity className="w-5 h-5 text-amber-400" />
                                ประวัติการเปลี่ยนแปลงและสลับพอร์ต (Swap Audit Log)
                            </CardTitle>
                            <CardDescription className="text-xs">
                                บันทึกทุกครั้งที่มีการสลับพอร์ตเข้า-ออก พร้อมเหตุผลและเวลาที่ดำเนินการ
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30 text-xs">
                                            <TableHead className="w-32">วันที่ดำเนินการ</TableHead>
                                            <TableHead className="w-28">พอร์ตออก</TableHead>
                                            <TableHead className="w-28">พอร์ตเข้า</TableHead>
                                            <TableHead>เหตุผลและรายละเอียด</TableHead>
                                            <TableHead className="text-right w-44">เวลาบันทึก</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {poolConfig.swapLogs.map((log) => (
                                            <TableRow key={log.id} className="text-xs font-mono hover:bg-muted/30">
                                                <TableCell className="font-bold text-foreground">{log.date}</TableCell>
                                                <TableCell className="text-rose-400">
                                                    {log.outPort ? `#${log.outPort}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-emerald-400 font-bold">
                                                    {log.inPort ? `#${log.inPort}` : '-'}
                                                </TableCell>
                                                <TableCell className="font-sans text-muted-foreground">{log.reason}</TableCell>
                                                <TableCell className="text-right text-[11px] text-muted-foreground">
                                                    {new Date(log.swappedAt).toLocaleString('th-TH')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ═══ TAB 2: MY TEAM MEMBERS (PAGINATED) ═══ */}
            {activeTab === 'team' && (
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                รายชื่อลูกทีมที่เข้าร่วมโครงการ
                            </CardTitle>
                            <CardDescription>
                                แสดงรายการลูกค้าที่สมัครผ่านลิ้งก์ของคุณ (แสดงหน้าละ {PAGE_SIZE} รายการ)
                            </CardDescription>
                        </div>
                        {/* Search Input */}
                        <div className="relative w-full sm:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="ค้นหาชื่อหรืออีเมล..."
                                value={teamSearch}
                                onChange={(e) => {
                                    setTeamSearch(e.target.value);
                                    setTeamPage(1);
                                }}
                                className="pl-9 h-9 text-xs"
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="py-12 text-center border rounded-lg border-dashed">
                                <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-3 opacity-50" />
                                <h3 className="text-lg font-medium text-foreground">
                                    {teamSearch ? 'ไม่พบข้อมูลที่ตรงกับการค้นหา' : 'ยังไม่มีลูกทีมในโครงการ'}
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                                    ก็อปปี้ลิ้งก์ด้านบนส่งให้ลูกค้าเพื่อชวนพวกเขามาร่วมสัมผัสประสบการณ์ EasyM Live Tracker
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>อีเมลลูกค้า</TableHead>
                                                <TableHead className="text-right">พอร์ต Live Tracker (USC)</TableHead>
                                                <TableHead className="text-right">เข้าร่วมเมื่อ</TableHead>
                                                <TableHead className="text-right">จัดการ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedTeamUsers.map((user) => {
                                                const growth = Number(user.current_balance) - 100000;
                                                return (
                                                    <TableRow key={user.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{user.user_name || 'ลูกค้า'}</div>
                                                            <div className="text-xs text-muted-foreground">{user.user_email}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            <div className="font-bold">{Number(user.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                            <div className={`text-xs ${growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {growth > 0 ? '+' : ''}{growth.toFixed(2)}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm text-muted-foreground font-mono">
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

                                {/* Pagination Controls */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                                    <div>
                                        แสดง {Math.min((teamPage - 1) * PAGE_SIZE + 1, filteredUsers.length)} - {Math.min(teamPage * PAGE_SIZE, filteredUsers.length)} จากทั้งหมด {filteredUsers.length} รายการ
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setTeamPage(p => Math.max(1, p - 1))}
                                            disabled={teamPage <= 1}
                                            className="h-8 px-2.5"
                                        >
                                            <ChevronLeft className="w-4 h-4 mr-1" />
                                            ก่อนหน้า
                                        </Button>
                                        <span className="px-3 font-mono font-bold text-foreground">
                                            หน้า {teamPage} / {totalTeamPages}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setTeamPage(p => Math.min(totalTeamPages, p + 1))}
                                            disabled={teamPage >= totalTeamPages}
                                            className="h-8 px-2.5"
                                        >
                                            ถัดไป
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* ═══ TAB 3: GLOBAL LEADERBOARD (PAGINATED) ═══ */}
            {activeTab === 'leaderboard' && (
                <Card className="border-orange-500/30 shadow-lg">
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl text-orange-500">
                                <Trophy className="h-6 w-6 animate-pulse" />
                                Global Challenge Leaderboard
                            </CardTitle>
                            <CardDescription>
                                กระดานจัดอันดับผู้ทำกำไรสูงสุดในโครงการทั้งหมดของบริษัท (แสดงหน้าละ {PAGE_SIZE} รายการ)
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="relative w-48 sm:w-56">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="ค้นหา..."
                                    value={leaderboardSearch}
                                    onChange={(e) => {
                                        setLeaderboardSearch(e.target.value);
                                        setLeaderboardPage(1);
                                    }}
                                    className="pl-9 h-8 text-xs"
                                />
                            </div>
                            <Button size="sm" variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500/10 h-8" onClick={copyTop3}>
                                <Copy className="h-4 w-4 mr-1" /> คัดลอก Top 3
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground">กำลังโหลดกระดานจัดอันดับ...</div>
                        ) : filteredLeaderboardUsers.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">ยังไม่มีผู้เข้าร่วมแคมเปญ</div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-md border overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-16 text-center">อันดับ</TableHead>
                                                <TableHead>นักลงทุน</TableHead>
                                                <TableHead className="text-right">พอร์ต Live Tracker (USC)</TableHead>
                                                <TableHead className="text-right">กำไรสุทธิ</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedLeaderboardUsers.map((user, idx) => {
                                                const globalIndex = (leaderboardPage - 1) * PAGE_SIZE + idx;
                                                const growth = Number(user.current_balance) - 100000;
                                                let badge = <span className="font-bold text-muted-foreground">{globalIndex + 1}</span>;
                                                if (globalIndex === 0) badge = <span className="text-xl">🏆</span>;
                                                else if (globalIndex === 1) badge = <span className="text-xl">🥈</span>;
                                                else if (globalIndex === 2) badge = <span className="text-xl">🥉</span>;

                                                return (
                                                    <TableRow key={user.id} className={globalIndex < 3 ? 'bg-orange-500/5' : ''}>
                                                        <TableCell className="text-center font-mono">{badge}</TableCell>
                                                        <TableCell>
                                                            <div className="font-bold text-foreground">{user.user_name || 'Trader'}</div>
                                                            <div className="text-xs text-muted-foreground">{user.user_email}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono font-bold text-base text-foreground">
                                                            ${Number(user.current_balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className="text-right font-mono">
                                                            <div className={`font-bold text-sm ${growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {growth >= 0 ? '+' : ''}{growth.toFixed(2)} USC
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination Controls */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                                    <div>
                                        แสดง {Math.min((leaderboardPage - 1) * PAGE_SIZE + 1, filteredLeaderboardUsers.length)} - {Math.min(leaderboardPage * PAGE_SIZE, filteredLeaderboardUsers.length)} จากทั้งหมด {filteredLeaderboardUsers.length} อันดับ
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setLeaderboardPage(p => Math.max(1, p - 1))}
                                            disabled={leaderboardPage <= 1}
                                            className="h-8 px-2.5"
                                        >
                                            <ChevronLeft className="w-4 h-4 mr-1" />
                                            ก่อนหน้า
                                        </Button>
                                        <span className="px-3 font-mono font-bold text-foreground">
                                            หน้า {leaderboardPage} / {totalLeaderboardPages}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setLeaderboardPage(p => Math.min(totalLeaderboardPages, p + 1))}
                                            disabled={leaderboardPage >= totalLeaderboardPages}
                                            className="h-8 px-2.5"
                                        >
                                            ถัดไป
                                            <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
