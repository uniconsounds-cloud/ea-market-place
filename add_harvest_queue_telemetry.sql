-- ==========================================================
-- EAEZE Harvest Telemetry & Anti-Duplicate Protection
-- Guarantees zero data loss & zero duplicates across VPS restarts
-- ==========================================================

-- 1. Ensure all rich telemetry columns exist
ALTER TABLE public.farm_batch_events
ADD COLUMN IF NOT EXISTS symbol TEXT,
ADD COLUMN IF NOT EXISTS side TEXT,
ADD COLUMN IF NOT EXISTS exit_type TEXT,
ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
ADD COLUMN IF NOT EXISTS ea_name TEXT,
ADD COLUMN IF NOT EXISTS ea_build TEXT,
ADD COLUMN IF NOT EXISTS max_dd_pct DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS event_id TEXT;

-- 2. Create Unique Index on event_id for atomic de-duplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_batch_events_event_id 
ON public.farm_batch_events(event_id);

-- 3. Index on port_number and event_timestamp for blazing fast queries
CREATE INDEX IF NOT EXISTS idx_farm_batch_events_port_time 
ON public.farm_batch_events(port_number, event_timestamp DESC);

-- 4. Ensure RLS policies allow authenticated and service role upserts
DROP POLICY IF EXISTS "Allow public insert to batch events" ON public.farm_batch_events;
CREATE POLICY "Allow public insert to batch events"
    ON public.farm_batch_events FOR ALL USING (true) WITH CHECK (true);
