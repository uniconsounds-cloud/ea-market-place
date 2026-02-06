-- CHECK DATA INTEGRITY
-- Run this to see what is actually in your database

-- 1. Count Total Orders
select count(*) as total_orders from orders;

-- 2. Show Top 5 Orders (Raw Data)
select id, user_id, product_id, status, created_at from orders order by created_at desc limit 5;

-- 3. Check Relationships
-- Do the user_ids in orders actually exist in profiles?
select 
  o.id as order_id, 
  o.user_id, 
  case when p.id is not null then 'Found' else 'MISSING' end as profile_status
from orders o
left join profiles p on o.user_id = p.id
limit 5;

-- 4. Check Product Link
select 
  o.id as order_id, 
  o.product_id, 
  case when p.id is not null then 'Found' else 'MISSING' end as product_status
from orders o
left join products p on o.product_id = p.id
limit 5;
