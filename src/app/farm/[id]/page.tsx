import { createSupabaseServerClient } from '@/lib/supabase-server';
import FarmClient from './FarmClient';
import { notFound, redirect } from 'next/navigation';

export default async function FarmPage({ params }: { params: { id: string } }) {
    const supabase = await createSupabaseServerClient();
    // Await params as required by Next.js 15+ in app directory structure
    const unwrappedParams = await params;
    const portNumber = unwrappedParams.id;

    // 1. Check Authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        redirect('/login?redirectTo=' + encodeURIComponent(`/farm/${portNumber}`));
    }

    // 2. Fetch User Profile (Role)
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
    const isAdmin = profile?.role === 'admin';

    // 3. Fetch License Owner, registration date, and tier details
    const { data: license } = await supabase
        .from('licenses')
        .select('user_id, created_at, port_name, license_tier, dashboard_skin')
        .eq('account_number', portNumber)
        .single();

    if (!isAdmin && (!license || license.user_id !== session.user.id)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#1c1917] text-white p-4">
                <script dangerouslySetInnerHTML={{ __html: `
                    setTimeout(function() {
                        window.location.href = '/farm/demo';
                    }, 3500);
                ` }} />
                <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl">
                    <h1 className="text-2xl font-bold text-red-400 mb-3">เข้าถึงไม่ได้ (Access Denied)</h1>
                    <p className="text-gray-300 text-sm mb-4">
                        ขออภัย คุณไม่มีสิทธิ์เข้าดูหน้าฟาร์มของบัญชีนี้ เฉพาะเจ้าของบัญชีและผู้ดูแลระบบเท่านั้นที่มีสิทธิ์เข้าถึง
                    </p>
                    <p className="text-amber-500 text-xs animate-pulse mb-6">
                        ระบบกำลังนำทางคุณไปยังหน้าฟาร์มจำลอง (Demo Farm) ภายใน 3 วินาที...
                    </p>
                    <div className="flex gap-3 justify-center">
                        <a href="/farm/demo" className="inline-block bg-amber-600 hover:bg-amber-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm">
                            ไปหน้าฟาร์มจำลอง
                        </a>
                        <a href="/dashboard" className="inline-block bg-stone-700 hover:bg-stone-600 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm">
                            กลับแดชบอร์ด
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Fetch initial active orders
    const { data: initialOrders } = await supabase
        .from('farm_active_orders')
        .select('*')
        .eq('port_number', portNumber);

    // Fetch initial port status
    const { data: portStatus } = await supabase
        .from('farm_port_status')
        .select('*')
        .eq('port_number', portNumber)
        .single();

    return (
        <div className="min-h-screen bg-[#1a120b] text-amber-50">
            <FarmClient
                portNumber={portNumber}
                initialOrders={initialOrders || []}
                initialPortStatus={portStatus || null}
                licenseCreatedAt={license?.created_at || null}
                customName={license?.port_name || null}
                licenseTier={license?.license_tier || 'free'}
                dashboardSkin={license?.dashboard_skin || 'avatar_scifi'}
            />
        </div>
    );
}
