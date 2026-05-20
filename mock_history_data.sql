-- Script to insert mock historical data for UI testing (Market Closed)
-- Run this in your Supabase SQL Editor

-- 1. Insert Mock History for Strategy 1 (Momentum Burst)
INSERT INTO public.tg_virtual_rounds (strategy_id, ticket, type, volume, open_price, close_price, open_time, close_time, profit, max_dd, status)
VALUES 
(1, 1001, 'BUY', 0.10, 2000.50, 2002.50, now() - interval '5 hours', now() - interval '4 hours 50 minutes', 20.00, -2.50, 'CLOSED'),
(1, 1002, 'SELL', 0.10, 2005.00, 2003.50, now() - interval '4 hours', now() - interval '3 hours 45 minutes', 15.00, -1.00, 'CLOSED'),
(1, 1003, 'BUY', 0.10, 2001.00, 2000.00, now() - interval '3 hours', now() - interval '2 hours 55 minutes', -10.00, -15.00, 'CLOSED'),
(1, 1004, 'BUY', 0.10, 2010.00, 2012.00, now() - interval '2 hours', now() - interval '1 hour 45 minutes', 20.00, -5.00, 'CLOSED'),
(1, 1005, 'SELL', 0.10, 2015.00, 2013.00, now() - interval '1 hour', now() - interval '55 minutes', 20.00, -1.50, 'CLOSED');

-- 2. Insert Mock History for Strategy 2 (Micro Pullback)
INSERT INTO public.tg_virtual_rounds (strategy_id, ticket, type, volume, open_price, close_price, open_time, close_time, profit, max_dd, status)
VALUES 
(2, 2001, 'SELL', 0.20, 2008.00, 2009.50, now() - interval '6 hours', now() - interval '5 hours 30 minutes', -30.00, -35.00, 'CLOSED'),
(2, 2002, 'BUY', 0.20, 2002.00, 2004.50, now() - interval '5 hours', now() - interval '4 hours 40 minutes', 50.00, -5.00, 'CLOSED'),
(2, 2003, 'BUY', 0.20, 2005.00, 2007.00, now() - interval '4 hours', now() - interval '3 hours 10 minutes', 40.00, -10.00, 'CLOSED'),
(2, 2004, 'SELL', 0.20, 2012.00, 2013.00, now() - interval '2 hours', now() - interval '1 hour 20 minutes', -20.00, -25.00, 'CLOSED'),
(2, 2005, 'BUY', 0.20, 2010.00, 2012.50, now() - interval '1 hour', now() - interval '30 minutes', 50.00, -8.00, 'CLOSED');

-- 3. Insert Mock History for Strategy 3 (Range Bounce)
INSERT INTO public.tg_virtual_rounds (strategy_id, ticket, type, volume, open_price, close_price, open_time, close_time, profit, max_dd, status)
VALUES 
(3, 3001, 'BUY', 0.50, 1995.00, 1996.00, now() - interval '4 hours', now() - interval '3 hours 55 minutes', 50.00, -10.00, 'CLOSED'),
(3, 3002, 'SELL', 0.50, 1998.00, 1997.50, now() - interval '3 hours', now() - interval '2 hours 50 minutes', 25.00, -5.00, 'CLOSED'),
(3, 3003, 'BUY', 0.50, 1996.00, 1995.00, now() - interval '2 hours 30 minutes', now() - interval '2 hours 15 minutes', -50.00, -60.00, 'CLOSED'),
(3, 3004, 'SELL', 0.50, 2000.00, 1999.00, now() - interval '1 hour 30 minutes', now() - interval '1 hour 25 minutes', 50.00, -2.00, 'CLOSED'),
(3, 3005, 'BUY', 0.50, 1998.00, 1999.50, now() - interval '45 minutes', now() - interval '40 minutes', 75.00, -0.00, 'CLOSED');

-- 4. Insert Mock History for Strategy 4 (Spike Fade)
INSERT INTO public.tg_virtual_rounds (strategy_id, ticket, type, volume, open_price, close_price, open_time, close_time, profit, max_dd, status)
VALUES 
(4, 4001, 'SELL', 1.00, 2025.00, 2020.00, now() - interval '10 hours', now() - interval '9 hours 50 minutes', 500.00, -50.00, 'CLOSED'),
(4, 4002, 'BUY', 1.00, 1980.00, 1975.00, now() - interval '8 hours', now() - interval '7 hours 55 minutes', -500.00, -550.00, 'CLOSED'),
(4, 4003, 'SELL', 1.00, 2030.00, 2028.00, now() - interval '5 hours', now() - interval '4 hours 45 minutes', 200.00, -100.00, 'CLOSED'),
(4, 4004, 'BUY', 1.00, 1990.00, 1993.00, now() - interval '3 hours', now() - interval '2 hours 55 minutes', 300.00, -20.00, 'CLOSED'),
(4, 4005, 'SELL', 1.00, 2015.00, 2017.00, now() - interval '1 hour', now() - interval '50 minutes', -200.00, -250.00, 'CLOSED');
