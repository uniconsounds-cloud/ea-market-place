-- Ensure Foreign Keys exist for proper Joins with Supabase

-- 1. Link orders.product_id -> products.id
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'orders_product_id_fkey') then
    alter table orders add constraint orders_product_id_fkey foreign key (product_id) references products(id);
  end if;
end $$;

-- 2. Link orders.user_id -> profiles.id
-- Note: Usually user_id refs auth.users, but for the join "profiles (...)" to work easily, 
-- we can reference profiles(id) since profiles.id is also auth.users.id
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'orders_user_id_profiles_fkey') then
    alter table orders add constraint orders_user_id_profiles_fkey foreign key (user_id) references profiles(id);
  end if;
end $$;
