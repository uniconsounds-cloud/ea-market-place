const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mfrspvzxmpksqnzcrysz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo');

async function run() {
    // Note: PostgREST doesn't directly expose information_schema via standard API easily,
    // so let's just make the exact failing query with the Admin access token if we can,
    // otherwise we rely on the Anon key.
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, referred_by, upline:profiles!referred_by(full_name, email)')
        .limit(1);

    console.log("Anon Error:", JSON.stringify(error, null, 2));
    
    // Let's also try joining without !referred_by constraint
    const { data: d2, error: e2 } = await supabase
        .from('profiles')
        .select('*, upline:profiles(full_name, email)')
        .limit(1);
        
    console.log("No Constraint Error:", JSON.stringify(e2, null, 2));
}
run();
