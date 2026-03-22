-- Migration to add is_tester flag to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_tester boolean DEFAULT false;

-- Optionally, you can set specific emails to be testers right away if you know them:
-- UPDATE public.profiles SET is_tester = true WHERE email = 'your.test.email@example.com';
