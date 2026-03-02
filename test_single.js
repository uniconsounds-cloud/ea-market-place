const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('id', '99999999-9999-9999-9999-999999999999')
        .single();
    console.log("Data:", data);
    console.log("Error:", error);
}
run();
