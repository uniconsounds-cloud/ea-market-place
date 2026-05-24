-- ====================================================================
-- Migration: Add Dashboard Tiers, Skins, and Backend Metrics Tables
-- Run this in your Supabase SQL Editor
-- ====================================================================

-- 1. Add columns to public.licenses to track user dashboard tier and selected skin
ALTER TABLE public.licenses 
ADD COLUMN IF NOT EXISTS license_tier VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS dashboard_skin VARCHAR(30) DEFAULT 'avatar_scifi';

-- Add a check constraint to ensure only valid tiers and skins are input
ALTER TABLE public.licenses
DROP CONSTRAINT IF EXISTS check_license_tier,
ADD CONSTRAINT check_license_tier CHECK (license_tier IN ('free', 'pro', 'max'));

ALTER TABLE public.licenses
DROP CONSTRAINT IF EXISTS check_dashboard_skin,
ADD CONSTRAINT check_dashboard_skin CHECK (dashboard_skin IN ('avatar_scifi', 'pixel_farm', 'f1_cockpit', 'fighter_jet', 'spaceship'));

-- 2. Create the backend_metrics log table for admin traffic and resource tracking
CREATE TABLE IF NOT EXISTS public.backend_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    metric_name VARCHAR(50) NOT NULL,
    metric_value NUMERIC NOT NULL,
    metadata JSONB
);

-- Index for scanning metrics by name and timestamp quickly
CREATE INDEX IF NOT EXISTS idx_metrics_name_time 
ON public.backend_metrics(metric_name, timestamp DESC);

-- Enable RLS for security, ensuring only authenticated Admins can view metrics
ALTER TABLE public.backend_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow admin read access to metrics"
    ON public.backend_metrics
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Comment to document
COMMENT ON TABLE public.backend_metrics IS 'Stores backend performance and Supabase/Vercel request rates for admin analysis.';
