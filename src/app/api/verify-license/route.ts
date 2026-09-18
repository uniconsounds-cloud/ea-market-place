import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'edge';


// Calculates Forex market trading date (rolls over at 05:00 AM Bangkok)
function getMarketTradingDate(date: Date): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) {
        partMap[p.type] = p.value;
    }
    const year = parseInt(partMap.year, 10);
    const month = parseInt(partMap.month, 10) - 1;
    const day = parseInt(partMap.day, 10);
    const hour = parseInt(partMap.hour, 10);

    const bkkDate = new Date(year, month, day);
    if (hour < 5) {
        bkkDate.setDate(bkkDate.getDate() - 1);
    }
    return bkkDate;
}

function getMarketTradingDateStr(date: Date = new Date()): string {
    const d = getMarketTradingDate(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

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

        const body = await req.json();
        const { account_number, product_id, balance, equity, today_profit } = body;

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
                const now = new Date();
                const nowIso = now.toISOString();
                const currentMarketDateStr = getMarketTradingDateStr(now);

                const { data: existingStatus } = await supabase
                    .from('farm_port_status')
                    .select('port_number, equity, account_type, balance, today_pnl, updated_at')
                    .eq('port_number', String(account_number))
                    .maybeSingle();

                if (existingStatus) {
                    const lastMarketDateStr = existingStatus.updated_at 
                        ? getMarketTradingDateStr(new Date(existingStatus.updated_at)) 
                        : null;

                    let todayPnl = Number(existingStatus.today_pnl) || 0;
                    let shouldSyncDailyHistory = false;

                    if (today_profit !== undefined && today_profit !== null && !isNaN(Number(today_profit))) {
                        // Priority 1: Direct MT5 Deal History Profit (impervious to deposits/withdrawals)
                        const exactPnl = Math.max(0, Number(Number(today_profit).toFixed(2)));
                        todayPnl = exactPnl;
                        shouldSyncDailyHistory = todayPnl > 0;
                    } else if (lastMarketDateStr && lastMarketDateStr !== currentMarketDateStr) {
                        // Rollover to new market trading day (started at 05:00 AM Bangkok)!
                        // Archive yesterday's accumulated profit to farm_daily_history if not already saved
                        if (todayPnl > 0) {
                            try {
                                await supabase.rpc('sync_ea_history_batch', {
                                    p_api_key: 'KHUCHAI_SUPHAKORN',
                                    p_port_number: String(account_number),
                                    p_history_array: [{
                                        date: lastMarketDateStr,
                                        profit: todayPnl,
                                        max_dd: 0,
                                        lots: 0
                                    }]
                                });
                            } catch (archiveErr) {
                                console.error('Error archiving previous day history:', archiveErr);
                            }
                        }

                        // For the new market trading day: current balance is the day's baseline, profit starts at 0
                        todayPnl = 0;
                        shouldSyncDailyHistory = false;
                    } else {
                        // Same market trading day: calculate incremental profit if balance increased
                        const prevBal = Number(existingStatus.balance) || numBal;
                        const delta = numBal - prevBal;
                        
                        // Smart deposit detection without arbitrary low caps:
                        // Normal EA trading profit can easily reach $90-$150+ (9,000-15,000+ USC).
                        // A deposit/top-up is characterized by a disproportionate instant jump:
                        // > 20% of account balance AND > 5,000 USC ($50), or an absolute jump > 30,000 USC ($300).
                        const isDeposit = (delta > 0.20 * prevBal && delta > 5000) || delta > 30000;
                        if (delta > 0 && !isDeposit) {
                            todayPnl = Number((todayPnl + delta).toFixed(2));
                            shouldSyncDailyHistory = true;
                        }
                    }

                    const numEquity = (equity !== undefined && !isNaN(Number(equity)) && Number(equity) > 0)
                        ? Number(equity)
                        : ((existingStatus.equity && Number(existingStatus.equity) > 0) ? Number(existingStatus.equity) : numBal);

                    await supabase
                        .from('farm_port_status')
                        .update({
                            balance: numBal,
                            equity: numEquity,
                            today_pnl: todayPnl,
                            is_online: true,
                            last_ping: nowIso,
                            updated_at: nowIso
                        })
                        .eq('port_number', String(account_number));

                    if (shouldSyncDailyHistory && todayPnl > 0) {
                        try {
                            await supabase.rpc('sync_ea_history_batch', {
                                p_api_key: 'KHUCHAI_SUPHAKORN',
                                p_port_number: String(account_number),
                                p_history_array: [{
                                    date: currentMarketDateStr,
                                    profit: todayPnl,
                                    max_dd: 0,
                                    lots: 0
                                }]
                            });
                        } catch (syncErr) {
                            console.error('Error auto-syncing daily history via license ping:', syncErr);
                        }
                    }
                } else {
                    const initialTodayPnl = (today_profit !== undefined && today_profit !== null && !isNaN(Number(today_profit)))
                        ? Math.max(0, Number(Number(today_profit).toFixed(2)))
                        : 0;
                    const numEquity = (equity !== undefined && !isNaN(Number(equity)) && Number(equity) > 0)
                        ? Number(equity)
                        : numBal;

                    await supabase
                        .from('farm_port_status')
                        .insert({
                            port_number: String(account_number),
                            balance: numBal,
                            equity: numEquity,
                            today_pnl: initialTodayPnl,
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

        // 4. Check Minimum Balance requirement (Enforce minimum balance strictly)
        const isBypassBalance = ['97053088', '21692434'].includes(account_number);
        if (!isBypassBalance && balance !== undefined && productMinBalance > 0 && Number(balance) < productMinBalance) {
            const displayMin = resolvedProduct?.currency === 'USC' 
                ? `$${resolvedProduct.min_balance || (productMinBalance / 100)} (${productMinBalance.toLocaleString()} USC)`
                : `$${productMinBalance}`;
            return NextResponse.json({ 
                status: 'insufficient_balance', 
                message: `Insufficient Balance. Minimum required: ${displayMin}` 
            }, { status: 200 });
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
