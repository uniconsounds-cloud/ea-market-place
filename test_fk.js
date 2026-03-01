const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://mfrspvzxmpksqnzcrysz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo');

async function run() {
    console.log("Testing explicit relation 'profiles!licenses_user_id_fkey'...");
    const { data: licenses1, error: err1 } = await supabase
        .from('licenses')
        .select(`
            *,
            profiles!licenses_user_id_fkey ( email, full_name, ib_account_number )
        `)
        .limit(1);
    console.log("Licenses query 1 error:", err1?.message || "Success");

    console.log("Testing general relation 'profiles'...");
    const { data: licenses2, error: err2 } = await supabase
        .from('licenses')
        .select(`
            *,
            profiles ( email, full_name, ib_account_number )
        `)
        .limit(1);
    console.log("Licenses query 2 error:", err2?.message || "Success");
}
run();
