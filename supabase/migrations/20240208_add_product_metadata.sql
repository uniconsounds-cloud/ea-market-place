-- Add new columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS platform text DEFAULT 'mt4',
ADD COLUMN IF NOT EXISTS asset_class text DEFAULT 'forex',
ADD COLUMN IF NOT EXISTS strategy text DEFAULT 'trend_following';

-- Comment on columns for clarity (Standardizing values)
-- platform: 'mt4', 'mt5'
-- asset_class: 'gold', 'silver', 'crypto', 'currency', 'indices', 'commodities'
-- strategy: 'scalping', 'grid', 'martingale', 'trend_following', 'hedging', 'news_trading', 'arbitrage', 'day_trading', 'swing_trading'
