-- 1. Check if ANY orders exist (to verify if inserts are working)
select count(*) as total_orders from orders;

-- 2. Force update YOUR user to be an admin
-- (This updates the user running the query, enabling them to see all orders)
update profiles 
set role = 'admin' 
where id = auth.uid();

-- 3. Verify your role
select id, email, role from profiles where id = auth.uid();
