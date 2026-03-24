-- Add currency column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Update existing products to have 'USD' if not already set
UPDATE public.products SET currency = 'USD' WHERE currency IS NULL;
