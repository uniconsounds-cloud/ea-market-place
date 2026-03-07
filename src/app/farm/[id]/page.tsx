import { createSupabaseServerClient } from '@/lib/supabase-server';
import FarmClient from './FarmClient';
import { notFound } from 'next/navigation';

export default async function FarmPage({ params }: { params: { id: string } }) {
    const supabase = await createSupabaseServerClient();
    // Await params as required by Next.js 15+ in app directory structure
    const unwrappedParams = await params;
    const portNumber = unwrappedParams.id;

    // Fetch initial active orders
    const { data: initialOrders } = await supabase
        .from('farm_active_orders')
        .select('*')
        .eq('port_number', portNumber);

    return (
        <div className="min-h-screen bg-[#1a120b] text-amber-50 selection:bg-amber-500/30">
            <FarmClient portNumber={portNumber} initialOrders={initialOrders || []} />
        </div>
    );
}
