-- Add additional_images column to products table
-- Using text array to store up to 3 additional URLs (making it 4 total with image_url)
ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_images text[] DEFAULT '{}';
