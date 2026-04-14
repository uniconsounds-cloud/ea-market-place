import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Historical Data Export API
 * 
 * Generates a CSV file of batch events for a specific port.
 * Used by users to archive data before it's pruned by the 90-day retention policy.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const port_number = searchParams.get('port');
    const apiKey = req.headers.get('x-api-key') || searchParams.get('key');

    if (!port_number) {
        return NextResponse.json({ error: 'Missing port number' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    try {
        // 1. Validate API Key
        const { data: keyRecord, error: keyError } = await supabaseAdmin
            .from('api_keys')
            .select('status')
            .eq('key_value', apiKey)
            .single();

        if (keyError || !keyRecord || keyRecord.status !== 'active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch last 90 days of events
        const { data: events, error: fetchError } = await supabaseAdmin
            .from('farm_batch_events')
            .select('event_timestamp, total_orders, total_lots, total_profit')
            .eq('port_number', port_number)
            .order('event_timestamp', { ascending: false });

        if (fetchError) {
            console.error('Export Fetch Error:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
        }

        // 3. Convert to CSV
        const header = 'Timestamp,Orders,Lots,Profit\n';
        const rows = events.map(e => (
            `${e.event_timestamp},${e.total_orders},${e.total_lots},${e.total_profit}`
        )).join('\n');
        
        const csvContent = header + rows;

        // 4. Return as File Download
        return new Response(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="port_${port_number}_history.csv"`,
            },
        });

    } catch (error: any) {
        console.error('Export Panic:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
