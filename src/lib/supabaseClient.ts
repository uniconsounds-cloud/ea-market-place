import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://example.com') {
    console.error('❌ Supabase credentials missing! Please check .env.local and restart the server.');
}

export const supabase = createClient(supabaseUrl || 'https://example.com', supabaseAnonKey || 'placeholder-key');
