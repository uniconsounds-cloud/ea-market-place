-- SYNC USERS TO PROFILES & SET ADMIN
-- Run this if your "Customers" list is empty or you can't see data.

-- 1. Sync all users from auth.users (Supabase Auth) to public.profiles (Our App Table)
-- This ensures every user has a Profile record.
-- REMOVED 'created_at' as it seems to not exist in your profiles table schema.
INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', email) as full_name, 
    'customer' -- Default role
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. IMPORTANT: Set yourself as Admin
-- REPLACE 'your_email@example.com' with your actual email!
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'juntarasate@gmail.com'; -- <--- UPDATED WITH YOUR EMAIL

-- 3. Verify Result
SELECT count(*) as total_profiles FROM public.profiles;
SELECT * FROM public.profiles WHERE role = 'admin';
