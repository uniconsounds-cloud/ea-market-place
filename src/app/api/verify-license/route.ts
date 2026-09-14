import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'edge';


export async function POST(req: Request) {
    try {
        // 1. Security Check: API Key (Optional but recommended)
        const apiKey = req.headers.get('x-api-key');
        const validApiKey = process.env.LICENSE_API_KEY;

        // Only verify if ENV is set (to allow testing if not set)
        const isLegacyKey = (apiKey === 'KHUCHAI_SUPHAKORN');
        if (validApiKey && apiKey !== validApiKey && !isLegacyKey) {
            return NextResponse.json({ status: 'error', message: 'Invalid API Key' }, { status: 401 });
        }

        const { account_number, product_id, balance } = await req.json();

        if (!account_number || !product_id) {
            return NextResponse.json({ status: 'error', message: 'Missing parameters' }, { status: 400 });
        }

        // Check if it is a Super Test Port for the main admin
        const { data: testPort } = await supabase
            .from('admin_test_ports')
            .select('*')
            .eq('account_number', account_number)
            .eq('owner_email', 'juntarasate@gmail.com')
            .single();

        if (testPort) {
            return NextResponse.json({
                status: 'active',
                message: 'License Verified (Admin Test Port)',
                expiry_date: 'Lifetime'
            });
        }

        // 2. Query Supabase
        // We look for a license that matches product (by UUID OR Key) + account_number

        let targetProductUUID = product_id;
        let productMinBalance = 0;
        let resolvedProduct: any = null;

        // If product_id is NOT a UUID (simple check), try to resolve it from product_key
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id);

        if (!isUUID) {
            let { data: product } = await supabase
                .from('products')
                .select('id, min_balance, currency, product_key, name')
                .eq('product_key', product_id)
                .maybeSingle();

            if (!product) {
                const cleanId = product_id.replace(/[-_\s]/g, '').toLowerCase();
                const { data: allProds } = await supabase
                    .from('products')
                    .select('id, min_balance, currency, product_key, name');
                if (allProds) {
                    product = allProds.find(p => 
                        (p.product_key && p.product_key.replace(/[-_\s]/g, '').toLowerCase() === cleanId) ||
                        (p.name && p.name.replace(/[-_\s]/g, '').toLowerCase() === cleanId)
                    ) || null;
                }
            }

            if (product) {
                resolvedProduct = product;
                targetProductUUID = product.id;
                productMinBalance = product.min_balance || 0;
                // If it's a Cent account product, conversion to cents (1 USD = 100 USC)
                if (product.currency === 'USC' && productMinBalance > 0) {
                    productMinBalance = productMinBalance * 100;
                }
            } else {
                // Product Key not found
                return NextResponse.json({ status: 'invalid', message: 'Invalid Product ID/Key' }, { status: 200 });
            }
        } else {
            const { data: product } = await supabase
                .from('products')
                .select('id, min_balance, currency, product_key, name')
                .eq('id', targetProductUUID)
                .single();
            if (product) {
                resolvedProduct = product;
                productMinBalance = product.min_balance || 0;
                // If it's a Cent account product, conversion to cents (1 USD = 100 USC)
                if (product.currency === 'USC' && productMinBalance > 0) {
                    productMinBalance = productMinBalance * 100;
                }
            }
        }

        let { data: license, error } = await supabase
            .from('licenses')
            .select('*')
            .eq('account_number', account_number)
            .eq('product_id', targetProductUUID)
            .eq('is_active', true)
            .single();

        // Fallback check: If EZM-MAX-V1 license is not found, check if a license for EZM-MAX-TEST is active
        if ((error || !license) && product_id === 'EZM-MAX-V1') {
            const { data: testProduct } = await supabase
                .from('products')
                .select('id')
                .eq('product_key', 'EZM-MAX-TEST')
                .single();
            if (testProduct) {
                const { data: fallbackLicense, error: fallbackError } = await supabase
                    .from('licenses')
                    .select('*')
                    .eq('account_number', account_number)
                    .eq('product_id', testProduct.id)
                    .eq('is_active', true)
                    .single();
                if (fallbackLicense && !fallbackError) {
                    license = fallbackLicense;
                    error = null;
                }
            }
        }

        if (error || !license) {
            return NextResponse.json({ status: 'invalid', message: 'License not found or inactive' }, { status: 200 });
        }

        // 3. Telemetry Ingestion: Synchronize live port status to farm_port_status (Telemetry via License Ping)
        if (balance !== undefined && !isNaN(Number(balance))) {
            const numBal = Number(balance);
            try {
                const nowIso = new Date().toISOString();
                const { data: existingStatus } = await supabase
                    .from('farm_port_status')
                    .select('port_number, equity, account_type')
                    .eq('port_number', String(account_number))
                    .maybeSingle();

                if (existingStatus) {
                    await supabase
                        .from('farm_port_status')
                        .update({
                            balance: numBal,
                            equity: (existingStatus.equity && Number(existingStatus.equity) > 0) ? existingStatus.equity : numBal,
                            is_online: true,
                            last_ping: nowIso,
                            updated_at: nowIso
                        })
                        .eq('port_number', String(account_number));
                } else {
                    await supabase
                        .from('farm_port_status')
                        .insert({
                            port_number: String(account_number),
                            balance: numBal,
                            equity: numBal,
                            account_type: resolvedProduct?.currency || 'USC',
                            ea_version: 'v1.16',
                            is_online: true,
                            last_ping: nowIso,
                            updated_at: nowIso
                        });
                }
            } catch (telemetryErr) {
                console.error('License verification status telemetry update error:', telemetryErr);
            }
        }

        // 4. Check Minimum Balance requirement (Prevent accidental lockout for verified active licenses)
        const isBypassBalance = ['97053088'].includes(account_number) || license.is_active === true;
        if (!isBypassBalance && balance !== undefined && productMinBalance > 0 && Number(balance) < productMinBalance) {
            return NextResponse.json({ status: 'insufficient_balance', message: `Insufficient Balance. Minimum required: $${productMinBalance}` }, { status: 200 });
        }

        // 5. Check Expiry
        if (license.expiry_date) {
            const expiry = new Date(license.expiry_date);
            const now = new Date();
            if (now > expiry) {
                // Opportunistic Update: Auto-deactivate it in the database immediately
                await supabase.from('licenses')
                    .update({ is_active: false })
                    .eq('id', license.id);

                return NextResponse.json({ status: 'expired', message: 'License Expired' }, { status: 200 });
            }
        }

        // 6. Success
        return NextResponse.json({
            status: 'active',
            message: 'License Verified',
            expiry_date: license.expiry_date || 'Lifetime'
        });

    } catch (err: any) {
        console.error('API Error:', err);
        return NextResponse.json({
            status: 'error',
            message: 'Server Error: ' + (err.message || JSON.stringify(err))
        }, { status: 500 });
    }
}
