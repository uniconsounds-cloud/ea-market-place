-- Update admin_demo_challenges_view to fallback to referred_by
DROP VIEW IF EXISTS admin_demo_challenges_view;
CREATE OR REPLACE VIEW admin_demo_challenges_view AS
SELECT 
    dc.id,
    dc.user_id,
    p.email AS user_email,
    p.full_name AS user_name,
    COALESCE(dc.referrer_id, p.referred_by) AS referrer_id,
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
    public.profiles rp ON COALESCE(dc.referrer_id, p.referred_by) = rp.id;

-- Ensure admins can query the view
GRANT SELECT ON admin_demo_challenges_view TO authenticated;
