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

    const scaleFactor = Number(challenge.risk_level) || 0.1;
    let currentBalance = Number(challenge.current_balance) || 10000;

    // Determine custom port name with emoji and multiplier
    const rawPortName = challenge.port_name || user.email || 'My Demo Port';
    
    let riskEmoji = '🛡️';
    if (scaleFactor >= 2.0) riskEmoji = '🔥';
    else if (scaleFactor >= 1.5) riskEmoji = '🚀';
    
    const customName = `${riskEmoji} x${scaleFactor.toFixed(2)} PORT: ${rawPortName}`;

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
                adminMessage = referrer.demo_broadcast_message;
            }
            if (referrer.demo_master_port) {
                customMasterPort = referrer.demo_master_port;
            }
        }
    }

    const finalAdminMessage = adminMessage || "💬 ADMIN: ยินดีต้อนรับสู่แคมเปญ Demo Challenge! 🚀";
    const masterPortNumber = customMasterPort || challenge.master_port_number || '100000';

    // Fetch initial active orders from master port
    const { data: initialOrders } = await supabase
        .from('farm_active_orders')
        .select('*')
        .eq('port_number', masterPortNumber);

    // Fetch initial port status from master port
    const { data: portStatus } = await supabase
        .from('farm_port_status')
        .select('*')
        .eq('port_number', masterPortNumber)
        .single();

    // Calculate Proportional Scaling based on Fixed 1/10 Ratio
    // Demo balance is $10k, Master balance is roughly $100k
    // scaleFactor is now the exact leverage multiplier (e.g. 1.5x)
    const proportionalRatio = 0.1 * scaleFactor;

    // Use actual master balance ONLY for rendering HUD stats correctly if needed,
    // but scaling relies purely on proportionalRatio
    const masterBalance = Number(portStatus?.balance) || 100000;

    // Scale initial orders
    const scaledOrders = (initialOrders || []).map(order => ({
        ...order,
        current_pnl: Number(order.current_pnl) * proportionalRatio,
        raw_lot_size: Number(order.raw_lot_size) * proportionalRatio
    }));

    // Scale port status
    const floatingPnl = Number(portStatus?.floating_pnl || 0) * proportionalRatio;
    const scaledPortStatus = portStatus ? {
        ...portStatus,
        master_balance: masterBalance, // Keep reference to original balance for real-time order updates
        floating_pnl: floatingPnl,
        total_lots: Number(portStatus.total_lots) * proportionalRatio,
        buy_pnl: Number(portStatus.buy_pnl) * proportionalRatio,
        sell_pnl: Number(portStatus.sell_pnl) * proportionalRatio,
        today_pnl: Number(portStatus.today_pnl) * proportionalRatio,
        today_closed_lots: Number(portStatus.today_closed_lots) * proportionalRatio,
        daily_max_drawdown: Number(portStatus.daily_max_drawdown) * scaleFactor,
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
            />
        </div>
    );
}
