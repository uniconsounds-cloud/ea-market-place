const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: { user } } = await supabase.auth.getUser();
    console.log("RLS Check via Anon Key...");
    // Just simple check if we can insert orders
    console.log("We are anonymous, can we insert an order?", user ? "Yes, user is somewhat authenticated" : "No user");
}
run();
