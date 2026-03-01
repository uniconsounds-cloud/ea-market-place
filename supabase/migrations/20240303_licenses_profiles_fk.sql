-- Add foreign key constraint from licenses.user_id to profiles.id
ALTER TABLE public.licenses
ADD CONSTRAINT licenses_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Also check if orders needs it (optional, but good practice)
-- ALTER TABLE public.orders
-- ADD CONSTRAINT orders_user_id_fkey 
-- FOREIGN KEY (user_id) 
-- REFERENCES public.profiles(id) 
-- ON DELETE CASCADE;
