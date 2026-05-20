-- Trading Game Database Schema
-- Run this in your Supabase SQL Editor

-- 1. Strategies Table
CREATE TABLE IF NOT EXISTS public.tg_strategies (
    id integer PRIMARY KEY,
    name text NOT NULL,
    description text,
    current_status text DEFAULT 'IDLE', -- IDLE, ACTIVE
    virtual_balance numeric(10, 2) DEFAULT 100.00,
    win_rate numeric(5, 2) DEFAULT 0.00,
    total_trades integer DEFAULT 0,
    floating_pl numeric(10, 2) DEFAULT 0.00,
    last_updated timestamp with time zone DEFAULT now()
);

-- Insert the 4 default strategies
INSERT INTO public.tg_strategies (id, name, description)
VALUES 
    (1, 'Momentum Burst', 'Breakout momentum using EMA9/21 cross'),
    (2, 'Micro Pullback Trend', 'Trend following pullback using EMA20/50'),
    (3, 'Range Bounce Scalper', 'Sideway ping-pong using RSI bounce'),
    (4, 'Spike Fade', 'Mean reversion on abnormal volatility spikes')
ON CONFLICT (id) DO NOTHING;

-- 2. Virtual Rounds Table (Tracks the history of simulated rounds)
CREATE TABLE IF NOT EXISTS public.tg_virtual_rounds (
    round_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    strategy_id integer REFERENCES public.tg_strategies(id),
    ticket bigint NOT NULL,
    type text NOT NULL, -- BUY, SELL
    volume numeric(10, 2) NOT NULL,
    open_price numeric(10, 3) NOT NULL,
    sl numeric(10, 3),
    tp numeric(10, 3),
    open_time timestamp with time zone DEFAULT now(),
    close_price numeric(10, 3),
    close_time timestamp with time zone,
    profit numeric(10, 2),
    max_dd numeric(10, 2) DEFAULT 0.00,
    status text DEFAULT 'OPEN' -- OPEN, CLOSED
);

-- 3. Signals Table (For Execution EA to copy)
CREATE TABLE IF NOT EXISTS public.tg_signals (
    signal_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    strategy_id integer REFERENCES public.tg_strategies(id),
    action text NOT NULL, -- OPEN_BUY, OPEN_SELL, CLOSE
    ticket bigint NOT NULL,
    price numeric(10, 3) NOT NULL,
    sl numeric(10, 3),
    tp numeric(10, 3),
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Subscriptions Table (Tracks which user wants to copy which strategy)
CREATE TABLE IF NOT EXISTS public.tg_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL, -- Assuming integration with Supabase Auth or your existing users table
    strategy_id integer REFERENCES public.tg_strategies(id),
    status text DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, STOPPED
    subscribed_at timestamp with time zone DEFAULT now()
);

-- Enable Realtime for Dashboard
alter publication supabase_realtime add table public.tg_strategies;
alter publication supabase_realtime add table public.tg_virtual_rounds;
alter publication supabase_realtime add table public.tg_signals;
