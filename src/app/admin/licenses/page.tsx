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

    // Fetch all licenses joined with products and profiles
    const { data: licenses, error } = await supabase
        .from('licenses')
        .select(`
            *,
            products ( name, asset_class, platform ),
            profiles ( email, full_name, ib_account_number )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching licenses:", error);
        return <div className="p-8 text-red-500">เกิดข้อผิดพลาดในการโหลดข้อมูล: {error.message}</div>;
    }

    return (
        <AdminLicensesClient initialLicenses={licenses || []} />
    );
}
