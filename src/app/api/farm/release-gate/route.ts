import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function getServiceSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
}

export async function GET() {
    try {
        const serverClient = await createSupabaseServerClient().catch(() => null);
        const supabase = serverClient || getServiceSupabaseClient();

        const { data: primeProduct, error } = await supabase
            .from('products')
            .select('id, name, product_key, is_active')
            .eq('product_key', 'EZM-PRIME-V1')
            .maybeSingle();

        if (error) {
            console.warn('[ReleaseGate GET] Error fetching product:', error);
            return NextResponse.json({ success: true, released: false, error: error.message });
        }

        const released = Boolean(primeProduct?.is_active);
        return NextResponse.json({
            success: true,
            released,
            product_id: primeProduct?.id || null
        });
    } catch (err: any) {
        console.error('[ReleaseGate GET] Server error:', err);
        return NextResponse.json({ success: false, released: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const released = Boolean(body.released);

        // Try server client with user session first (for logged-in admin)
        let dbClient = await createSupabaseServerClient().catch(() => null);
        if (!dbClient) {
            dbClient = getServiceSupabaseClient();
        }

        // 1. Check if EZM-PRIME-V1 product exists in database
        const { data: existingPrime } = await dbClient
            .from('products')
            .select('id, is_active')
            .eq('product_key', 'EZM-PRIME-V1')
            .maybeSingle();

        let updateSuccess = false;

        if (existingPrime) {
            const { error: updateError } = await dbClient
                .from('products')
                .update({ 
                    is_active: released
                })
                .eq('id', existingPrime.id);

            if (!updateError) {
                updateSuccess = true;
            } else {
                console.warn('[ReleaseGate POST] Primary update error, trying service client fallback:', updateError);
                const serviceClient = getServiceSupabaseClient();
                const { error: serviceError } = await serviceClient
                    .from('products')
                    .update({ 
                        is_active: released
                    })
                    .eq('id', existingPrime.id);

                if (!serviceError) updateSuccess = true;
                else console.error('[ReleaseGate POST] Service client update failed:', serviceError);
            }
        } else {
            // Auto-create product record if not yet seeded
            const { error: insertError } = await dbClient
                .from('products')
                .insert([{
                    name: 'EasyM Prime',
                    product_key: 'EZM-PRIME-V1',
                    description: 'เรือธงใหม่ล่าสุด ระบบกู้พอร์ตอัจฉริยะ ห้องฟื้นฟู Dynamic Rescue Sniper และ Cross-Pair Drawdown Offset',
                    version: '2.00',
                    is_active: released,
                    platform: 'mt5',
                    asset_class: 'currency',
                    strategy: 'grid',
                    min_balance: 1000,
                    currency: 'USC'
                }]);

            if (!insertError) updateSuccess = true;
        }

        return NextResponse.json({
            success: updateSuccess,
            released,
            message: released 
                ? 'EasyM Prime Farm released to all customers globally' 
                : 'EasyM Prime Farm reverted to private developer mode'
        });
    } catch (err: any) {
        console.error('[ReleaseGate POST] Server error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
