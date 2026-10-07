import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { 
    DEFAULT_LIVE_TRACKER_CONFIG, 
    parsePoolConfig, 
    evaluateAndAutoSwap, 
    LiveTrackerPoolConfig 
} from '@/lib/liveTrackerSynthetic';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || user.email !== 'juntarasate@gmail.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch current profile config
        const { data: profile } = await supabase
            .from('profiles')
            .select('demo_master_port, id')
            .eq('id', user.id)
            .single();

        const config = parsePoolConfig(profile?.demo_master_port);

        // Fetch live statuses for all active and reserve ports
        const allPorts = Array.from(new Set([...config.activePorts, ...config.reservePorts]));
        const { data: statuses } = await supabase
            .from('farm_port_status')
            .select('*')
            .in('port_number', allPorts);

        const statusMap = new Map<string, any>();
        (statuses || []).forEach(s => statusMap.set(s.port_number, s));

        return NextResponse.json({
            config,
            statuses: Object.fromEntries(statusMap),
            allPorts
        });
    } catch (err: any) {
        console.error('Error in GET /api/admin/live-tracker-pool:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || user.email !== 'juntarasate@gmail.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const action = body.action; // 'save' | 'health_check' | 'manual_swap'

        // Fetch current profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('demo_master_port, id')
            .eq('id', user.id)
            .single();

        let currentConfig = parsePoolConfig(profile?.demo_master_port);

        if (action === 'save' && body.config) {
            currentConfig = body.config;
        } else if (action === 'health_check') {
            const { updatedConfig, swappedCount } = await evaluateAndAutoSwap(supabase, currentConfig);
            currentConfig = updatedConfig;
        } else if (action === 'manual_swap') {
            const { outPort, inPort, reason } = body;
            if (outPort && inPort) {
                const activeIdx = currentConfig.activePorts.indexOf(outPort);
                const reserveIdx = currentConfig.reservePorts.indexOf(inPort);

                if (activeIdx !== -1 && reserveIdx !== -1) {
                    currentConfig.activePorts[activeIdx] = inPort;
                    currentConfig.reservePorts[reserveIdx] = outPort;

                    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
                    currentConfig.swapLogs.unshift({
                        id: `swap-manual-${Date.now()}`,
                        date: todayStr,
                        outPort,
                        inPort,
                        reason: reason || `แอดมินสลับพอร์ตด้วยตนเอง (#${outPort} -> #${inPort})`,
                        swappedAt: new Date().toISOString()
                    });
                }
            }
        }

        // Save updated config to profile.demo_master_port
        const serialized = JSON.stringify(currentConfig);
        const { error: updateErr } = await supabase
            .from('profiles')
            .update({ demo_master_port: serialized })
            .eq('id', user.id);

        if (updateErr) throw updateErr;

        return NextResponse.json({
            success: true,
            config: currentConfig
        });
    } catch (err: any) {
        console.error('Error in POST /api/admin/live-tracker-pool:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
