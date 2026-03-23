-- Add multi-port settings to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS is_multi_port BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS port_count INTEGER DEFAULT 1;
