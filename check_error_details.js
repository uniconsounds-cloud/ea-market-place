const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mfrspvzxmpksqnzcrysz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mcnNwdnp4bXBrc3FuemNyeXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTcwMzMsImV4cCI6MjA4NTc5MzAzM30.Fm-h9TJTAUbBw_T6gj2IRwcy5xZMsw_SORv0Lvoxpgo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.rpc('sync_ea_data', {
        p_payload: {
            port_number: '97021489',
            server_time: Math.floor(Date.now() / 1000),
            ping_only: 'false',
            snapshot: {
                account: { balance: 10490.46, equity: 10444.96 },
                buy_state: { open_count: 0 },
                sell_state: { open_count: 0 }
            }
        },
        p_api_key: 'KHUCHAI_SUPHAKORN'
    });
    console.log('Error details:', JSON.stringify(error, null, 2));
}

check();
