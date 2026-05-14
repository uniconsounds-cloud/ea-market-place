-- Update admin_demo_challenges_view to dynamically calculate real-time balance
-- based on master port profit from farm_daily_history since join date!
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
    -- Dynamically calculate current balance/equity based on master port cumulative profit
    10000 + (COALESCE((
        SELECT SUM(profit) 
        FROM public.farm_daily_history 
        WHERE port_number = COALESCE(dc.master_port_number, '100000') 
          AND date >= dc.join_date::date
    ), 0) * 0.1 * dc.risk_level) AS current_balance,
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
