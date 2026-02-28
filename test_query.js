const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mfrspvzxmpksqnzcrysz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo');

async function run() {
    const { data, error } = await supabase
        .from('profiles')
        .select(`
            id,
            email,
            referred_by,
            upline:profiles!referred_by(full_name, email)
        `)
        .limit(1);

    console.log("Error:", JSON.stringify(error, null, 2));
    console.log("Data:", data);
}
run();
