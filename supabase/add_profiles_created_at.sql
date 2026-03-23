-- 1. Add the created_at column (allowing nulls temporarily so we don't overwrite with 'now')
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;

-- 2. Backfill existing profiles with their actual registration date from auth.users
UPDATE public.profiles p
SET created_at = u.created_at
FROM auth.users u
WHERE p.id = u.id AND p.created_at IS NULL;

-- 3. Set the default value to now() for all future signups
ALTER TABLE public.profiles ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());
