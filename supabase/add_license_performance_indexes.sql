-- 1. Create a non-blocking composite index on licenses
-- Optimizes: SELECT * FROM licenses WHERE account_number = ? AND product_id = ? AND is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS licenses_account_product_active_idx 
ON licenses (account_number, product_id, is_active);

-- 2. Create a non-blocking index on products
-- Optimizes: SELECT * FROM products WHERE product_key = ?;
CREATE INDEX CONCURRENTLY IF NOT EXISTS products_product_key_idx 
ON products (product_key);
