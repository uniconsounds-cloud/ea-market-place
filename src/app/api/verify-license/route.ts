import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        // 1. Security Check: API Key (Optional but recommended)
        const apiKey = req.headers.get('x-api-key');
        const validApiKey = process.env.LICENSE_API_KEY;

        // Only verify if ENV is set (to allow testing if not set)
        if (validApiKey && apiKey !== validApiKey) {
            return NextResponse.json({ status: 'error', message: 'Invalid API Key' }, { status: 401 });
        }

        const { account_number, product_id } = await req.json();

        if (!account_number || !product_id) {
            return NextResponse.json({ status: 'error', message: 'Missing parameters' }, { status: 400 });
        }

        // 2. Query Supabase
        // We look for a license that matches product (by UUID OR Key) + account_number

        let targetProductUUID = product_id;

        // If product_id is NOT a UUID (simple check), try to resolve it from product_key
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id);

        if (!isUUID) {
            const { data: product } = await supabase
                .from('products')
                .select('id')
                .eq('product_key', product_id)
                .single();

            if (product) {
                targetProductUUID = product.id;
            } else {
                // Product Key not found
                return NextResponse.json({ status: 'invalid', message: 'Invalid Product ID/Key' }, { status: 200 });
            }
        }

        const { data: license, error } = await supabase
            .from('licenses')
            .select('*')
            .eq('account_number', account_number)
            .eq('product_id', targetProductUUID)
            .eq('is_active', true)
            .single();

        if (error || !license) {
            return NextResponse.json({ status: 'invalid', message: 'License not found or inactive' }, { status: 200 });
            // MT4 often prefers 200 OK even for logical failures, but 404 is semantically correct. 
            // Requirement says: Return JSON { status: "expired" ... }
        }

        // 3. Check Expiry
        if (license.expiry_date) {
            const expiry = new Date(license.expiry_date);
            const now = new Date();
            if (now > expiry) {
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
