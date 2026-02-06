-- CHECK IF LICENSE WAS CREATED
-- Replace 'completed' with the status you want to check

select 
  o.id as order_id, 
  o.status as order_status,
  o.user_id,
  o.product_id,
  case when l.id is not null then '✅ License Created' else '❌ NO LICENSE Found' end as license_status,
  l.expiry_date
from orders o
left join licenses l 
  on o.user_id = l.user_id 
  and o.product_id = l.product_id
where o.status = 'completed';
