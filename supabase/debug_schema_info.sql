-- INSPECT SCHEMA & RELATIONS
-- Use this to see exactly what columns and keys Supabase sees.

-- 1. Check Columns in 'licenses' table (Verify 'type' exists)
select column_name, data_type 
from information_schema.columns 
where table_name = 'licenses';

-- 2. Check Foreign Keys on 'orders' (Verify constraint names for Joins)
select
    tc.constraint_name, 
    kcu.column_name, 
    ccu.table_name as references_table,
    ccu.column_name as references_column
from information_schema.table_constraints AS tc 
join information_schema.key_column_usage AS kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage AS ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.table_name = 'orders';

-- 3. Reload Schema Cache (Force Supabase to refresh)
NOTIFY pgrst, 'reload config';
