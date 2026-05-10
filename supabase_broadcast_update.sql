-- ==========================================
-- Add Columns for Custom Port Name & Broadcast Message
-- ==========================================

-- 1. Add port_name to demo_challenges
ALTER TABLE public.demo_challenges ADD COLUMN IF NOT EXISTS port_name TEXT;

-- 2. Add demo_broadcast_message to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_broadcast_message TEXT;

-- 3. Update the view to include these new columns
DROP VIEW IF EXISTS admin_demo_challenges_view;
CREATE OR REPLACE VIEW admin_demo_challenges_view AS
SELECT 
    dc.id,
    dc.user_id,
    p.email AS user_email,
    p.full_name AS user_name,
    dc.referrer_id,
    rp.email AS referrer_email,
    rp.full_name AS referrer_name,
    dc.risk_level,
    dc.current_balance,
    dc.join_date,
    dc.created_at,
    dc.port_name,
    rp.demo_broadcast_message
FROM 
    public.demo_challenges dc
JOIN 
    public.profiles p ON dc.user_id = p.id
LEFT JOIN 
    public.profiles rp ON dc.referrer_id = rp.id;

-- Ensure admins can query the view
GRANT SELECT ON admin_demo_challenges_view TO authenticated;
