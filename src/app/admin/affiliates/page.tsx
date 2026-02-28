import { createSupabaseServerClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import AdminAffiliatesClient from './admin-affiliates-client';

export const dynamic = 'force-dynamic';

export default async function AdminAffiliatesPage() {
    const supabase = await createSupabaseServerClient();

    // Auth & Role check handled in layout, but double check session to fetch data
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        redirect('/login');
    }

    // Fetch all profiles to show in Affiliate Management
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select(`
            id,
            email,
            full_name,
            referral_code,
            commission_rate,
            accumulated_commission,
            ib_status,
            referred_by,
            upline:profiles!referred_by(full_name, email)
        `);

    if (error) {
        console.error("Error fetching profiles for admin msg:", error?.message, "code:", error?.code, "full:", error);
        return <div className="p-8 text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล: {error?.message || JSON.stringify(error)}</div>;
    }

    return (
        <AdminAffiliatesClient initialProfiles={profiles || []} />
    );
}
