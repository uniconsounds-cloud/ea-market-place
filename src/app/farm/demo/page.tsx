import { createSupabaseServerClient } from '@/lib/supabase-server';
import DemoFarmClient from './DemoFarmClient';
import { redirect } from 'next/navigation';

export default async function DemoFarmPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login?redirect=/farm/demo');
    }

    // Fetch user's demo challenge details
    const { data: challenge, error } = await supabase
        .from('demo_challenges')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error || !challenge) {
        console.error("Error fetching challenge:", error);
        // Not joined yet
        redirect('/demo-challenge');
    }

    // Fetch user's dynamic challenge balance (cumulative profits starting from join_date)
    const { data: challengeView } = await supabase
        .from('admin_demo_challenges_view')
        .select('current_balance')
        .eq('user_id', user.id)
        .maybeSingle();

    const scaleFactor = 1.0;
    let currentBalance = Number(challengeView?.current_balance || challenge.current_balance) || 100000;

    // Determine custom port name with emoji
    const rawPortName = challenge.port_name || user.email || 'My Demo Port';
    const customName = rawPortName;

    // Fallback: Check if user has an upline in profiles if they don't have a referrer_id
    let finalReferrerId = challenge.referrer_id;
    if (!finalReferrerId) {
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
    const referrerIdToCheck = finalReferrerId || user.id; // Also fallback to user's own if admin
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
    const masterPortNumber = customMasterPort || challenge.master_port_number || '100000';
    const joinDateStr = challenge.join_date ? challenge.join_date.split('T')[0] : '2026-05-09';

    // Fetch dynamic history & status in parallel
    const [viewRes, historyRes, ordersRes, statusRes] = await Promise.all([
        supabase.from('admin_demo_challenges_view').select('current_balance').eq('user_id', user.id).maybeSingle(),
        supabase.from('farm_daily_history').select('profit, date').eq('port_number', masterPortNumber).gte('date', joinDateStr),
        supabase.from('farm_active_orders').select('*').eq('port_number', masterPortNumber),
        supabase.from('farm_port_status').select('*').eq('port_number', masterPortNumber).single()
    ]);

    const initialOrders = ordersRes.data || [];
    const portStatus = statusRes.data;
    const dailyHistory = historyRes.data || [];
    const challengeView = viewRes.data;

    // Calculate dynamic balance (100,000 + profits accumulated since user's join_date + unrecorded today_pnl)
    const bkkTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    const historyProfitSum = dailyHistory.reduce((sum, h) => sum + (Number(h.profit) || 0), 0);
    const isTodayRecorded = dailyHistory.some(h => h.date === bkkTodayStr);
    const todayPnlToAdd = isTodayRecorded ? 0 : (Number(portStatus?.today_pnl) || 0);

    const computedCumulativeBalance = 100000 + historyProfitSum + todayPnlToAdd;
    let currentBalance = Number(challengeView?.current_balance || computedCumulativeBalance) || 100000;

    // 1:1 Replication with Master Port
    const scaleFactor = 1.0;
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
        total_lots: Number(portStatus.total_lots) * proportionalRatio,
        buy_pnl: Number(portStatus.buy_pnl) * proportionalRatio,
        sell_pnl: Number(portStatus.sell_pnl) * proportionalRatio,
        today_pnl: Number(portStatus.today_pnl) * proportionalRatio,
        today_closed_lots: Number(portStatus.today_closed_lots) * proportionalRatio,
        daily_max_drawdown: Number(portStatus.daily_max_drawdown),
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
                scaleFactor={scaleFactor}
                demoBalance={currentBalance}
                customName={customName}
                adminMessage={finalAdminMessage}
                challengeStartDate={challenge.created_at}
                userId={user.id}
                referrerId={referrerIdToCheck}
            />
        </div>
    );
}
