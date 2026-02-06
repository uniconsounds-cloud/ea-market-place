-- MASTER FIX: SCHEMA & KEYS & CACHE
-- This script fixes "Missing Column" and "Raw Product" issues permanently.

-- 1. Fix 'licenses' table (Add missing 'type' column)
alter table public.licenses add column if not exists type text default 'lifetime';

-- 2. Fix Foreign Keys (Force rename to match Frontend Code)
-- Re-create Product FK with exact name 'orders_product_id_fkey'
alter table orders drop constraint if exists orders_product_id_fkey;
alter table orders add constraint orders_product_id_fkey 
  foreign key (product_id) references products(id);

-- Re-create Profile FK with exact name 'orders_user_id_profiles_fkey'
alter table orders drop constraint if exists orders_user_id_profiles_fkey;
alter table orders drop constraint if exists orders_user_id_fkey; -- Remove potential duplicate
alter table orders add constraint orders_user_id_profiles_fkey 
  foreign key (user_id) references profiles(id);

-- 3. Force Supabase to Reload Schema Cache (Fixes 'Could not find column in cache')
NOTIFY pgrst, 'reload config';
