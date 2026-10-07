import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { parsePoolConfig, getSyntheticLiveTrackerData } from '@/lib/liveTrackerSynthetic';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = await createSupabaseServerClient();

        // 1. Fetch current pool configuration from admin profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('demo_master_port')
            .eq('email', 'juntarasate@gmail.com')
            .maybeSingle();

        const poolConfig = parsePoolConfig(profile?.demo_master_port);

        // 2. Fetch full synthetic data starting April 1, 2026
        const synthetic = await getSyntheticLiveTrackerData(supabase, poolConfig, '2026-04-01');

        return NextResponse.json({
            success: true,
            portStatus: synthetic.portStatus,
            dailyHistory: synthetic.dailyHistory,
            activeOrders: synthetic.activeOrders,
            config: poolConfig
        });
    } catch (error: any) {
        console.error('Error in /api/farm/demo-synthetic GET:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
