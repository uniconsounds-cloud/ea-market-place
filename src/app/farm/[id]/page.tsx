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

    // 3. Fetch License Owner, registration date, tier, and product details
    const { data: licenses } = await supabase
        .from('licenses')
        .select('id, user_id, created_at, port_name, license_tier, dashboard_skin, is_active, products:product_id(id, name, product_key, min_balance, currency)')
        .eq('account_number', portNumber);

    const license = licenses?.find(l => l.is_active) || licenses?.[0];
    const product = Array.isArray(license?.products) ? license?.products[0] : (license?.products as any);

    const prodKey = (product?.product_key || '').toUpperCase();
    const prodName = (product?.name || '').toLowerCase();
    const isEasyM = prodKey.includes('EZM') || prodName.includes('easym') || prodName.includes('easy m');

    // For EasyM / EasyM MAX products, ensure licenseTier defaults to 'pro' for full 2.5D tree farm access
    const effectiveLicenseTier = (isEasyM && license?.license_tier === 'free') ? 'pro' : (license?.license_tier || 'free');

    // Asynchronously ensure the license tier is updated in DB if needed
    if (license?.id && isEasyM && license.license_tier !== 'pro') {
        supabase.from('licenses').update({ license_tier: 'pro' }).eq('id', license.id).then();
    }

    const sessionEmail = session.user.email;
    const isSuperAdmin = sessionEmail === 'juntarasate@gmail.com' || sessionEmail === 'juntatasate@gmail.com';

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

    // Fetch all active EasyM MAX & EasyM Prime ports belonging to this customer (for Multi-Port 2x2 View)
    const ownerUserId = license?.user_id || session.user.id;
    const trimmedPort = String(portNumber || '').trim();
    const isOwnerDevPort =
        trimmedPort === '97053088' || trimmedPort.endsWith('3088') || trimmedPort === '3088' ||
        trimmedPort === '21692434' || trimmedPort.endsWith('2434') || trimmedPort === '2434';

    const { data: ownerLicensesRaw } = await supabase
        .from('licenses')
        .select('id, user_id, account_number, port_name, is_active, expiry_date, type, created_at, license_tier, dashboard_skin, products:product_id(id, name, product_key, min_balance, currency)')
        .eq('user_id', ownerUserId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

    let ownerLicenses = ownerLicensesRaw || [];
    if (isOwnerDevPort) {
        const { data: devPairLicenses } = await supabase
            .from('licenses')
            .select('id, user_id, account_number, port_name, is_active, expiry_date, type, created_at, license_tier, dashboard_skin, products:product_id(id, name, product_key, min_balance, currency)')
            .in('account_number', ['97053088', '21692434'])
            .order('created_at', { ascending: true });
        if (devPairLicenses && devPairLicenses.length > 0) {
            const existingIds = new Set(ownerLicenses.map((l: any) => l.id));
            for (const dl of devPairLicenses) {
                if (!existingIds.has(dl.id)) {
                    ownerLicenses.push(dl);
                }
            }
        }
    }

    const ownerAccountNumbers = Array.from(new Set([
        ...ownerLicenses
            .map((l: any) => String(l.account_number || '').trim())
            .filter(Boolean),
        ...(isOwnerDevPort ? ['97053088', '21692434'] : [])
    ]));

    const { data: ownerPortStatuses } = ownerAccountNumbers.length > 0
        ? await supabase
            .from('farm_port_status')
            .select('*')
            .in('port_number', ownerAccountNumbers)
        : { data: [] as any[] };

    const statusByPort = new Map((ownerPortStatuses || []).map((ps: any) => [String(ps.port_number).trim(), ps]));
    const nowMs = Date.now();
    const seenPorts = new Set<string>();
    const initialUserFarmPorts: Array<{
        portNumber: string;
        portName: string | null;
        eaType: 'PRIME' | 'MAX';
        createdAt: string | null;
        portStatus: any | null;
        licenseInfo: any;
    }> = [];

    for (const lic of (ownerLicenses || [])) {
        const accNum = String(lic.account_number || '').trim();
        if (!accNum || seenPorts.has(accNum)) continue;
        if (lic.is_active === false) continue;
        if (lic.type !== 'lifetime' && lic.expiry_date) {
            const expMs = new Date(lic.expiry_date).getTime();
            if (expMs <= nowMs && accNum !== String(portNumber).trim()) continue;
        }

        const prod = Array.isArray(lic.products) ? lic.products[0] : (lic.products as any);
        const pKey = String(prod?.product_key || '').toUpperCase();
        const pName = String(prod?.name || '').toLowerCase();
        const ps = statusByPort.get(accNum) || (accNum === String(portNumber).trim() ? portStatus : null);
        const rawSys = String(ps?.system_code || '');
        const sys = rawSys.split(':::')[0].toLowerCase();
        const eaVer = String(ps?.ea_version || '').toLowerCase();

        // Exclude Gold, Mini, Turbo
        if (
            pName.includes('gold') || pKey.includes('GOLD') || pKey.includes('EZG') || sys.includes('gold') ||
            pName.includes('mini') || pKey.includes('MINI') || sys.includes('mini') ||
            sys.includes('turbo')
        ) {
            continue;
        }

        const isPrimePort =
            pName.includes('prime') ||
            pKey.includes('PRIME') ||
            sys.includes('prime') ||
            rawSys.includes(':::') ||
            eaVer.startsWith('2.') ||
            eaVer.startsWith('v2.');

        const isMaxPort =
            pName.includes('max') ||
            pKey.includes('MAX') ||
            sys.includes('max') ||
            ((pKey.startsWith('EZM') || pName.includes('easym') || pName.includes('easy m')) && !pName.includes('farm') && !sys.includes('farm'));

        if (!isPrimePort && !isMaxPort) continue;

        seenPorts.add(accNum);
        initialUserFarmPorts.push({
            portNumber: accNum,
            portName: lic.port_name || null,
            eaType: isPrimePort ? 'PRIME' : 'MAX',
            createdAt: lic.created_at || null,
            portStatus: ps || null,
            licenseInfo: {
                isActive: true,
                productName: prod?.name || (isPrimePort ? 'EasyM Prime' : 'EasyM MAX'),
                productKey: prod?.product_key || '',
                minBalance: prod?.min_balance || 0,
                currency: prod?.currency || 'USC',
                createdAt: lic.created_at || null
            }
        });
    }

    // Ensure current opened port is always present if it's an EasyM port
    if (!seenPorts.has(String(portNumber).trim()) && isEasyM) {
        const rawSys = String(portStatus?.system_code || '');
        const isCurrentPrime = prodKey.includes('PRIME') || prodName.includes('prime') || rawSys.toLowerCase().includes('prime') || rawSys.includes(':::');
        initialUserFarmPorts.unshift({
            portNumber: String(portNumber).trim(),
            portName: license?.port_name || null,
            eaType: isCurrentPrime ? 'PRIME' : 'MAX',
            createdAt: license?.created_at || null,
            portStatus: portStatus || null,
            licenseInfo: {
                isActive: true,
                productName: product?.name || (isCurrentPrime ? 'EasyM Prime' : 'EasyM MAX'),
                productKey: product?.product_key || '',
                minBalance: product?.min_balance || 0,
                currency: product?.currency || 'USC',
                createdAt: license?.created_at || null
            }
        });
        seenPorts.add(String(portNumber).trim());
    }

    // For developer ports (97053088 & 21692434), ensure both ports are visible so developer can switch between them
    if (isOwnerDevPort) {
        for (const devAcc of ['97053088', '21692434']) {
            if (!seenPorts.has(devAcc)) {
                const ps = statusByPort.get(devAcc) || null;
                const rawSys = String(ps?.system_code || '');
                const isPrimeDev = rawSys.toLowerCase().includes('prime') || rawSys.includes(':::') || devAcc === '97053088';
                initialUserFarmPorts.push({
                    portNumber: devAcc,
                    portName: null,
                    eaType: isPrimeDev ? 'PRIME' : 'MAX',
                    createdAt: null,
                    portStatus: ps,
                    licenseInfo: {
                        isActive: true,
                        productName: isPrimeDev ? 'EasyM Prime' : 'EasyM MAX',
                        productKey: isPrimeDev ? 'EZM_PRIME' : 'EZM_MAX',
                        minBalance: 0,
                        currency: 'USC',
                        createdAt: null
                    }
                });
                seenPorts.add(devAcc);
            }
        }
    }

    // Fetch Global Prime Release Gate status (persisted in farm_port_status prime_release_gate_config)
    const { data: releaseGateRow } = await supabase
        .from('farm_port_status')
        .select('system_code')
        .eq('port_number', 'prime_release_gate_config')
        .maybeSingle();

    let initialIsGlobalPrimeReleased = false;
    let initialIsPhase2Released = false;
    if (releaseGateRow?.system_code && releaseGateRow.system_code.includes(':::')) {
        try {
            const parsed = JSON.parse(releaseGateRow.system_code.split(':::').slice(1).join(':::'));
            initialIsGlobalPrimeReleased = Boolean(parsed.released);
            initialIsPhase2Released = Boolean(parsed.phase2_released);
        } catch (e) {}
    }

    return (
        <div className="min-h-screen bg-[#1a120b] text-amber-50">
            <FarmClient
                portNumber={portNumber}
                initialOrders={initialOrders || []}
                initialPortStatus={portStatus || null}
                initialUserFarmPorts={initialUserFarmPorts}
                ownerUserId={ownerUserId}
                initialIsGlobalPrimeReleased={initialIsGlobalPrimeReleased}
                initialIsPhase2Released={initialIsPhase2Released}
                licenseCreatedAt={license?.created_at || null}
                customName={license?.port_name || null}
                licenseTier={effectiveLicenseTier}
                dashboardSkin={license?.dashboard_skin || 'avatar_scifi'}
                isAdmin={isAdmin}
                isSuperAdmin={isSuperAdmin}
                licenseInfo={license ? {
                    isActive: license.is_active !== false,
                    productName: product?.name || 'EasyM',
                    productKey: product?.product_key || '',
                    minBalance: product?.min_balance || 0,
                    currency: product?.currency || 'USC',
                    createdAt: license.created_at
                } : null}
            />
        </div>
    );
}
