const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log("Fetching ALL IB memberships...");
    const { data: ibMemberships, error: ibError } = await supabase
        .from('ib_memberships')
        .select('*');

    console.log("IB Error:", ibError);
    console.log("All IB Memberships count:", ibMemberships?.length);
    console.log("Data:", ibMemberships);
}
test();
