-- Add is_ib_request flag to licenses to track IB status independently
ALTER TABLE public.licenses 
ADD COLUMN IF NOT EXISTS is_ib_request BOOLEAN DEFAULT false;

-- Update existing licenses that have ib_broker_name to be marked as is_ib_request
UPDATE public.licenses 
SET is_ib_request = true 
WHERE ib_broker_name IS NOT NULL;
