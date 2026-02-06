-- Add missing columns to ORDERS table
do $$ 
begin 
  -- Add 'slip_url'
  if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'slip_url') then
    alter table orders add column slip_url text;
  end if;

  -- Add 'plan_type' (monthly/lifetime) - useful for admin to know what to approve
  if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'plan_type') then
    alter table orders add column plan_type text default 'lifetime';
  end if;

-- Ensure LICENSES table has necessary columns too
   if not exists (select 1 from information_schema.columns where table_name = 'licenses' and column_name = 'type') then
    alter table licenses add column type text;
  end if;
end $$;
