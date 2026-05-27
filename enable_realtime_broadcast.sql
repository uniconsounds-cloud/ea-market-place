-- SQL to enable Realtime updates for profiles, demo_challenges, and licenses tables
-- Run this in your Supabase SQL Editor

-- 1. Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demo_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.licenses;
