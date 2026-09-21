-- ===================================================================
-- Migration: Add last_license_check to farm_port_status
-- Run this script in your Supabase SQL Editor
-- ===================================================================

-- 1. Add last_license_check column
ALTER TABLE public.farm_port_status 
ADD COLUMN IF NOT EXISTS last_license_check TIMESTAMPTZ;

-- 2. Backfill existing ports with last_ping so they show immediately
UPDATE public.farm_port_status 
SET last_license_check = last_ping 
WHERE last_license_check IS NULL AND last_ping IS NOT NULL;
