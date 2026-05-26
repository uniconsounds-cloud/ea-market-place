-- Update admin_demo_challenges_view to dynamically calculate real-time balance
-- 1. Cumulative profit from farm_daily_history since join date
-- 2. Plus live today_pnl from farm_port_status (for real-time intraday updates before midnight batch sync)
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
    -- Real-time dynamic balance/equity calculation (100k starting balance, 1:1 master copy)
    100000 + COALESCE((
        SELECT SUM(profit) 
        FROM public.farm_daily_history 
        WHERE port_number = COALESCE(rp.demo_master_port, dc.master_port_number, '100000') 
          AND date >= dc.join_date::date
    ), 0) + 
    COALESCE((
        SELECT today_pnl 
        FROM public.farm_port_status 
        WHERE port_number = COALESCE(rp.demo_master_port, dc.master_port_number, '100000')
          AND NOT EXISTS (
              SELECT 1 
              FROM public.farm_daily_history 
              WHERE port_number = COALESCE(rp.demo_master_port, dc.master_port_number, '100000') 
                AND date = (timezone('Asia/Bangkok', now())::date)
          )
    ), 0) AS current_balance,
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


