-- Migration: Add is_tester flag to licenses table for port-level testing
-- Run this in your Supabase SQL Editor

ALTER TABLE public.licenses ADD COLUMN IF NOT EXISTS is_tester BOOLEAN DEFAULT false;

-- Index for filtering test ports quickly
CREATE INDEX IF NOT EXISTS idx_licenses_is_tester ON public.licenses(is_tester);
