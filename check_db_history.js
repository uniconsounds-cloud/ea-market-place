const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const portNumber = '97053088';

async function run() {
  console.log(`Fetching database daily history for port: ${portNumber}`);

  const { data, error } = await supabase
    .from('farm_daily_history')
    .select('*')
    .eq('port_number', portNumber)
    .order('date', { ascending: true });
  
  if (error) {
    console.error('Error fetching history:', error);
  } else {
    console.log(`Found ${data.length} records in database:`);
    data.forEach(row => {
      console.log(`${row.date}: Profit=${row.profit}, MaxDD=${row.max_drawdown}, Lots=${row.closed_lots}`);
    });
  }
}

run();
