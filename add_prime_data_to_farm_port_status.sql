-- ==========================================================
-- EAEZE Prime Farm Realtime Telemetry Migration
-- Adds prime_data JSONB column to public.farm_port_status
-- ==========================================================

ALTER TABLE public.farm_port_status 
ADD COLUMN IF NOT EXISTS prime_data JSONB;

COMMENT ON COLUMN public.farm_port_status.prime_data IS 'Realtime Prime EA telemetry including modes, DDs, rescue, relief fund, quarantined pairs and settings';
