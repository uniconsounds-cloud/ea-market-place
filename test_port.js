const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mfrspvzxmpksqnzcrysz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo');

async function run() {
    const { data: globalLicense, error } = await supabase
        .from('licenses')
        .select('user_id, product_id, expiry_date')
        .eq('account_number', '12121210')
        .eq('is_active', true)
        .gte('expiry_date', new Date().toISOString())
        .maybeSingle();

    console.log("Global License:", globalLicense, error);
}
run();
