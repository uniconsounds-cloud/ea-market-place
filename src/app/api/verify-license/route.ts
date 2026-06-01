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

        // If product_id is NOT a UUID (simple check), try to resolve it from product_key
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id);

        if (!isUUID) {
            const { data: product } = await supabase
                .from('products')
                .select('id, min_balance, currency')
                .eq('product_key', product_id)
                .single();

            if (product) {
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
                .select('min_balance, currency')
                .eq('id', targetProductUUID)
                .single();
            if (product) {
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

        // 3. Check Minimum Balance requirement (Bypass for test account 97053088)
        const isBypassBalance = ['97053088'].includes(account_number);
        if (!isBypassBalance && balance !== undefined && productMinBalance > 0 && Number(balance) < productMinBalance) {
            return NextResponse.json({ status: 'insufficient_balance', message: `Insufficient Balance. Minimum required: $${productMinBalance}` }, { status: 200 });
        }

        // 4. Check Expiry
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

        // 4. Success
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
