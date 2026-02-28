import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AffiliateClient from './affiliate-client';

export const dynamic = 'force-dynamic';

export default async function AffiliateDashboardPage() {
    const supabase = await createSupabaseServerClient();

    // 1. Get Session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        redirect('/login');
    }

    // 2. Fetch User Profile for Referral Data
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
            full_name,
            email,
            referral_code,
            commission_rate,
            accumulated_commission,
            ib_status
        `)
        .eq('id', session.user.id)
        .single();

    if (profileError || !profile) {
        console.error("Error fetching profile details:", profileError?.message || profileError);
        return <div>Error loading profile data.</div>;
    }

    // 3. (Optional Server Fetch) Get recent referrals/history here if needed
    // But passing it to client cleanly is usually easier for tables

    return (
        <AffiliateClient
            user={{
                id: session.user.id,
                ...profile
            }}
        />
    );
}
