const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, referrer:profiles!referred_by(id, email)')
        .limit(10);
    
    if (error) {
        console.error("Error:", error);
    } else {
        console.dir(data, { depth: null });
    }
}
main();
