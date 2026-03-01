const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mfrspvzxmpksqnzcrysz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo');

async function run() {
    const { data: licenses, error } = await supabase.from('licenses').select('*').limit(1);
    console.log("Licenses schema:", JSON.stringify(licenses?.[0], null, 2), error);

    const { data: products } = await supabase.from('products').select('*').limit(1);
    console.log("Products schema:", JSON.stringify(products?.[0], null, 2));

    const { data: profiles } = await supabase.from('profiles').select('*').limit(1);
    console.log("Profiles schema:", JSON.stringify(profiles?.[0], null, 2));
}
run();
