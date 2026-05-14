-- ====================================================================
-- CREATE OR REPLACE FUNCTION: public.ping_farm_view
-- 
-- Description:
-- Updates or inserts the active viewing timestamp (last_viewed_at) 
-- for a specific port number when the customer loads the web farm dashboard.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.ping_farm_view(p_port_number TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.farm_port_status (port_number, last_viewed_at)
    VALUES (p_port_number, NOW())
    ON CONFLICT (port_number)
    DO UPDATE SET last_viewed_at = NOW();
END;
$$;
