-- Migration: Add product_key to products
-- Purpose: Allow human-readable identifiers for EA licensing

do $$ 
begin 
  -- Add 'product_key' column if it doesn't exist
  if not exists (select 1 from information_schema.columns where table_name = 'products' and column_name = 'product_key') then
    alter table products add column product_key text unique;
  end if;
end $$;
