import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminLicensesClient from './admin-licenses-client';

export const dynamic = 'force-dynamic';

export default async function AdminLicensesPage() {
    const supabase = await createSupabaseServerClient();

    // Check Auth & Role
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (profile?.role !== 'admin') redirect('/');

    // Opportunistic Update: Auto-deactivate expired licenses before viewing
    const nowISO = new Date().toISOString();
    await supabase.from('licenses')
        .update({ is_active: false })
        .lt('expiry_date', nowISO)
        .eq('is_active', true);

    // Fetch all licenses joined with products (with pagination for >1000 records)
    let rawLicenses: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
        const { data: batch, error } = await supabase
            .from('licenses')
            .select(`
                *,
                products ( name, asset_class, platform )
            `)
            .order('created_at', { ascending: false })
            .range(from, from + batchSize - 1);

        if (error) {
            console.error("Error fetching licenses batch:", error);
            break;
        }
        if (batch) rawLicenses = rawLicenses.concat(batch);
        if (!batch || batch.length < batchSize) break;
        from += batchSize;
    }

    // Manual Join: Fetch Profiles
    const userIds = Array.from(new Set((rawLicenses || []).map(l => l.user_id).filter(Boolean)));
    let profilesMap: Record<string, any> = {};
    let ibMembershipsMap: Record<string, any[]> = {};

    if (userIds.length > 0) {
        // Chunk userIds to avoid URL length issues
        for (let i = 0; i < userIds.length; i += 100) {
            const chunk = userIds.slice(i, i + 100);
            const [profilesRes, ibRes] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, email, full_name, ib_account_number, is_tester')
                    .in('id', chunk),
                supabase
                    .from('ib_memberships')
                    .select('user_id, verification_data, status, brokers(name)')
                    .in('user_id', chunk)
                    .eq('status', 'approved')
            ]);

            if (profilesRes.data) {
                profilesRes.data.forEach((p: any) => {
                    profilesMap[p.id] = p;
                });
            }

            if (ibRes.data) {
                ibRes.data.forEach((ib: any) => {
                    if (!ibMembershipsMap[ib.user_id]) {
                        ibMembershipsMap[ib.user_id] = [];
                    }

                    let bName = 'IB Account';
                    if (ib.brokers) {
                        if (Array.isArray(ib.brokers)) {
                            bName = ib.brokers[0]?.name || 'IB Account';
                        } else {
                            bName = (ib.brokers as any).name || 'IB Account';
                        }
                    }

                    ibMembershipsMap[ib.user_id].push({
                        account_number: ib.verification_data?.trim(),
                        broker_name: bName
                    });
                });
            }
        }
    }

    // Merge Data
    const licenses = (rawLicenses || []).map(l => {
        const port = l.account_number?.trim();
        // Check if this specific license port number is an approved IB port
        const userIbRecords = l.user_id ? ibMembershipsMap[l.user_id] || [] : [];
        const matchedIb = userIbRecords.find(r => r.account_number === port);

        // Fallback: If no port match, check if user has ANY approved IB membership
        const firstAvailableBroker = userIbRecords.length > 0 ? userIbRecords[0].broker_name : undefined;

        // Final label decision
        let finalBrokerName = l.ib_broker_name;
        if (!finalBrokerName) {
            if (matchedIb) {
                finalBrokerName = matchedIb.broker_name;
            } else if (profilesMap[l.user_id]?.ib_account_number?.trim() === port) {
                // If it matches legacy profile port, try to use first available broker name as a hint
                finalBrokerName = firstAvailableBroker || 'IB Account';
            } else if (l.type === 'ib') {
                finalBrokerName = firstAvailableBroker || 'IB Account';
            }
        }

        const isIbLicense = l.type === 'ib' || Boolean(l.is_ib_request) || Boolean(l.ib_broker_name) || Boolean(matchedIb) || (profilesMap[l.user_id]?.ib_account_number?.trim() === port);

        return {
            ...l,
            profiles: l.user_id ? profilesMap[l.user_id] : null,
            is_ib: isIbLicense,
            ib_broker_name: finalBrokerName
        };
    });

    // Fetch all products for the filter dropdown so it shows all EAs, not just the ones with licenses
    const { data: allProducts } = await supabase
        .from('products')
        .select('name, asset_class, platform');

    return (
        <AdminLicensesClient initialLicenses={licenses} allProducts={allProducts || []} />
    );
}
