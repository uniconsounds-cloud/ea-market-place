-- ====================================================================
-- Migration: Update all EasyM MAX licenses to Pro tier
-- Run this in your Supabase SQL Editor
-- ====================================================================

-- Update all existing active/inactive licenses of EasyM MAX (EZM-MAX-V1 & EZM-MAX-TEST) to Pro tier
UPDATE public.licenses
SET license_tier = 'pro'
WHERE product_id IN (
    SELECT id FROM public.products 
    WHERE product_key IN ('EZM-MAX-V1', 'EZM-MAX-TEST')
);

-- Show count of updated rows (optional verification check)
SELECT COUNT(*) as updated_licenses_count 
FROM public.licenses 
WHERE license_tier = 'pro' 
AND product_id IN (
    SELECT id FROM public.products 
    WHERE product_key IN ('EZM-MAX-V1', 'EZM-MAX-TEST')
);
