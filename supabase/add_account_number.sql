-- ADD ACCOUNT NUMBER TO ORDERS
-- This column will store the "Port Number" entered by the user.

-- 1. Add column if it doesn't exist
alter table public.orders 
add column if not exists account_number text;

-- 2. Verify it was added
select column_name, data_type 
from information_schema.columns 
where table_name = 'orders' 
and column_name = 'account_number';
