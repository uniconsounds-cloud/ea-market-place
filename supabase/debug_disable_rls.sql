-- 🚨 DEBUGGING SCRIPT: DISABLE RLS TEMPORARILY 🚨
-- This will Confirm if RLS is the one hiding the data.

-- 1. Disable RLS on relevant tables (Allows EVERYTHING)
alter table orders disable row level security;
alter table profiles disable row level security;
alter table products disable row level security;
alter table licenses disable row level security;

-- 2. Check for "Orphaned" Orders (Orders pointing to non-existent users/products)
-- If these return counts > 0, then your Joins in the frontend will fail/return nulls.
select 'Orphaned Products' as check_type, count(*) as count 
from orders where product_id not in (select id from products);

select 'Orphaned Profiles' as check_type, count(*) as count 
from orders where user_id not in (select id from profiles);

-- 3. Show raw orders (to prove they exist)
select id, user_id, product_id, status from orders limit 5;
