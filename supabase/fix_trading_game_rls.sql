-- 1. Insert default strategies if they do not exist
INSERT INTO public.tg_strategies (id, name, description)
VALUES 
    (1, 'Momentum Burst', 'Breakout momentum using EMA9/21 cross'),
    (2, 'Micro Pullback Trend', 'Trend following pullback using EMA20/50'),
    (3, 'Range Bounce Scalper', 'Sideway ping-pong using RSI bounce'),
    (4, 'Spike Fade', 'Mean reversion on abnormal volatility spikes')
ON CONFLICT (id) DO NOTHING;

-- 2. Disable Row Level Security (RLS) on all Trading Game tables
-- This enables full real-time communication between VPS MT5 EAs, Supabase, and the dashboard.
ALTER TABLE public.tg_strategies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tg_virtual_rounds DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tg_signals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tg_subscriptions DISABLE ROW LEVEL SECURITY;
