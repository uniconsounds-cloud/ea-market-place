import { createSupabaseServerClient } from '@/lib/supabase-server';
import DemoFarmClient from './DemoFarmClient';
import { redirect } from 'next/navigation';
import { parsePoolConfig, getSyntheticLiveTrackerData } from '@/lib/liveTrackerSynthetic';

export default async function DemoFarmPage(props: {
    searchParams?: Promise<{ preview?: string; embed?: string }> | { preview?: string; embed?: string };
}) {
    const rawParams = props.searchParams ? await props.searchParams : {};
    const isPreview = rawParams?.preview === '1' || rawParams?.preview === 'true' || rawParams?.embed === '1';

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user && !isPreview) {
        redirect('/login?redirect=/farm/demo');
    }

    // Fetch user's demo challenge details
    let challenge: any = null;
    if (user) {
        const { data } = await supabase
            .from('demo_challenges')
            .select('*')
            .eq('user_id', user.id)
            .single();
        challenge = data;
    }

    if (!challenge) {
        if (isPreview || user?.email === 'juntarasate@gmail.com') {
            // Admin or Preview Demo Mode: Load real master port '21692434'
            challenge = {
                id: 'preview-challenge',
                user_id: user?.id || '47db9b29-7688-41b5-8469-10994f9a5b1a',
                port_name: 'EasyM Live Tracker',
                master_port_number: '21692434',
                risk_level: 1.0,
                join_date: '2026-05-09',
                created_at: '2026-05-09T00:00:00Z',
                referrer_id: '47db9b29-7688-41b5-8469-10994f9a5b1a'
            };
        } else {
            redirect('/demo-challenge');
        }
    }

    // Determine custom port name with emoji
    const rawPortName = challenge.port_name || user?.email || 'EasyM Live Tracker';
    const customName = rawPortName;

    // Fallback: Check if user has an upline in profiles if they don't have a referrer_id
    let finalReferrerId = challenge.referrer_id;
    if (!finalReferrerId && user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('referred_by')
            .eq('id', user.id)
            .single();
        if (profile && profile.referred_by) {
            finalReferrerId = profile.referred_by;
        }
    }

    // Fetch referrer's broadcast message and master port
    const referrerIdToCheck = finalReferrerId || user?.id || '47db9b29-7688-41b5-8469-10994f9a5b1a';
    let adminMessage = null;
    let customMasterPort = null;

    if (referrerIdToCheck) {
        const { data: referrer } = await supabase
            .from('profiles')
            .select('demo_broadcast_message, demo_master_port')
            .eq('id', referrerIdToCheck)
            .single();
        if (referrer) {
            if (referrer.demo_broadcast_message) {
                adminMessage = referrer.demo_broadcast_message.replaceAll('$100 Demo Challenge', 'EasyM Live Tracker');
            }
            if (referrer.demo_master_port) {
                customMasterPort = referrer.demo_master_port;
            }
        }
    }

    const finalAdminMessage = adminMessage || "💬 ADMIN: ยินดีต้อนรับสู่โครงการ EasyM Live Tracker! 🚀";
    const masterPortNumber = customMasterPort || challenge.master_port_number || '21692434';
    const poolConfig = parsePoolConfig(customMasterPort || challenge.master_port_number);
    const joinDateStr = challenge.join_date ? challenge.join_date.split('T')[0] : '2026-05-09';

    let initialOrders: any[] = [];
    let portStatus: any = null;
    let dailyHistory: any[] = [];
    let currentBalance = 100000;

    if (poolConfig.mode === 'synthetic_10') {
        // High-fidelity 10-port synthetic model
        const synthetic = await getSyntheticLiveTrackerData(supabase, poolConfig, joinDateStr);
        initialOrders = synthetic.activeOrders;
        portStatus = synthetic.portStatus;
        dailyHistory = synthetic.dailyHistory;
        currentBalance = synthetic.portStatus.balance;
    } else {
        // Fallback to legacy single master port
        const [viewRes, historyRes, ordersRes, statusRes] = await Promise.all([
            user ? supabase.from('admin_demo_challenges_view').select('current_balance').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
            supabase.from('farm_daily_history').select('profit, date').eq('port_number', masterPortNumber).gte('date', joinDateStr),
            supabase.from('farm_active_orders').select('*').eq('port_number', masterPortNumber),
            supabase.from('farm_port_status').select('*').eq('port_number', masterPortNumber).single()
        ]);

        initialOrders = ordersRes.data || [];
        portStatus = statusRes.data;
        dailyHistory = historyRes.data || [];
        const challengeView = viewRes.data;

        const bkkTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        const historyProfitSum = dailyHistory.reduce((sum, h) => sum + (Number(h.profit) || 0), 0);
        const isTodayRecorded = dailyHistory.some(h => h.date === bkkTodayStr);
        const todayPnlToAdd = isTodayRecorded ? 0 : (Number(portStatus?.today_pnl) || 0);

        const computedCumulativeBalance = 100000 + historyProfitSum + todayPnlToAdd;
        currentBalance = Number(challengeView?.current_balance || computedCumulativeBalance) || 100000;
    }

    // 1:1 Replication with Master Port
    const proportionalRatio = 1.0;
    const masterBalance = Number(portStatus?.balance) || 100000;

    // Scale initial orders (1:1)
    const scaledOrders = (initialOrders || []).map(order => ({
        ...order,
        current_pnl: Number(order.current_pnl) * proportionalRatio,
        raw_lot_size: Number(order.raw_lot_size) * proportionalRatio
    }));

    // Scale port status (1:1 except balance starting at 100,000 USC + cumulative profits)
    const floatingPnl = Number(portStatus?.floating_pnl || 0) * proportionalRatio;
    const scaledPortStatus = portStatus ? {
        ...portStatus,
        master_balance: masterBalance, // Keep reference to original balance
        floating_pnl: floatingPnl,
        total_lots: Number(portStatus.total_lots || 0) * proportionalRatio,
        buy_pnl: Number(portStatus.buy_pnl || 0) * proportionalRatio,
        sell_pnl: Number(portStatus.sell_pnl || 0) * proportionalRatio,
        today_pnl: Number(portStatus.today_pnl || 0) * proportionalRatio,
        today_closed_lots: Number(portStatus.today_closed_lots || 0) * proportionalRatio,
        daily_max_drawdown: Number(portStatus.daily_max_drawdown || 0),
        balance: currentBalance,
        equity: currentBalance + floatingPnl
    } : {
        balance: currentBalance,
        equity: currentBalance,
        account_type: 'USC'
    };

    return (
        <div className="min-h-screen bg-[#1a120b] text-amber-50">
            <DemoFarmClient
                portNumber={masterPortNumber}
                initialOrders={scaledOrders}
                initialPortStatus={scaledPortStatus}
                scaleFactor={proportionalRatio}
                demoBalance={currentBalance}
                customName={customName}
                adminMessage={finalAdminMessage}
                challengeStartDate={challenge.created_at}
                userId={user?.id || '47db9b29-7688-41b5-8469-10994f9a5b1a'}
                referrerId={referrerIdToCheck}
            />
        </div>
    );
}
