-- ADD ACCOUNT NUMBER TO LICENSES
alter table public.licenses 
add column if not exists account_number text;

-- Verify
select column_name, data_type 
from information_schema.columns 
where table_name = 'licenses';
