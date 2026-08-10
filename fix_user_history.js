const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const portNumber = '97053088';
const jsonPath = 'history_data.json';

async function run() {
  if (!fs.existsSync(jsonPath)) {
    console.error(`JSON file ${jsonPath} not found!`);
    return;
  }

  const fileData = fs.readFileSync(jsonPath, 'utf8');
  const records = JSON.parse(fileData);
  console.log(`Loaded ${records.length} records from JSON.`);

  // Map to the RPC history array format
  // [{ date: "YYYY-MM-DD", profit: float, lots: float, max_dd: float }]
  const mappedRecords = records.map(r => ({
    date: r.date,
    profit: r.profit,
    lots: r.lots,
    max_dd: 0.0 // 0.0 will not overwrite existing non-zero drawdown due to the DB function's safeguard
  }));

  console.log('Calling Supabase RPC sync_ea_history_batch...');

  const { data, error } = await supabase.rpc('sync_ea_history_batch', {
    p_api_key: supabaseAnonKey,
    p_port_number: portNumber,
    p_history_array: mappedRecords
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Response:', data);
  }

  console.log('Finished uploading history!');
}

run();
