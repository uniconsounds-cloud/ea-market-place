-- Add columns for controlling sales channels for each EA product
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allow_rent boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS allow_ib boolean DEFAULT true;
