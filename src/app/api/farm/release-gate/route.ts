import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    );
}

export async function GET() {
    try {
        const supabase = getSupabaseClient();
        const { data: primeProduct, error } = await supabase
            .from('products')
            .select('id, name, product_key, is_active, updated_at')
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
            product_id: primeProduct?.id || null,
            updated_at: primeProduct?.updated_at || new Date().toISOString()
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
        const supabase = getSupabaseClient();

        // 1. Check if EZM-PRIME-V1 product exists in database
        const { data: existingPrime, error: findError } = await supabase
            .from('products')
            .select('id, is_active')
            .eq('product_key', 'EZM-PRIME-V1')
            .maybeSingle();

        if (existingPrime) {
            const { error: updateError } = await supabase
                .from('products')
                .update({ 
                    is_active: released,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingPrime.id);

            if (updateError) {
                console.error('[ReleaseGate POST] Update error:', updateError);
                return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
            }
        } else {
            // Auto-create product record if not yet seeded
            const { error: insertError } = await supabase
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
                    currency: 'USC',
                    updated_at: new Date().toISOString()
                }]);

            if (insertError) {
                console.error('[ReleaseGate POST] Insert error:', insertError);
                return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
            }
        }

        return NextResponse.json({
            success: true,
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
