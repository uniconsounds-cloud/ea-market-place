-- ==========================================
-- EAEZE Storage Buckets Setup
-- Run this script in your Supabase SQL Editor
-- ==========================================

-- 1. Create the "products" bucket for images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the "ea_files" bucket for EA downloads if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('ea_files', 'ea_files', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Policies for "products" bucket
-- Allow public viewing
CREATE POLICY "Public Access products" ON storage.objects
FOR SELECT USING (bucket_id = 'products');

-- Allow authenticated users (admin) to upload
CREATE POLICY "Admin Upload products" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated');

-- Allow authenticated users (admin) to update
CREATE POLICY "Admin Update products" ON storage.objects
FOR UPDATE USING (bucket_id = 'products' AND auth.role() = 'authenticated');

-- 4. Set up Storage Policies for "ea_files" bucket
-- Allow public viewing (so users can download the EA)
CREATE POLICY "Public Access ea_files" ON storage.objects
FOR SELECT USING (bucket_id = 'ea_files');

-- Allow authenticated users (admin) to upload
CREATE POLICY "Admin Upload ea_files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'ea_files' AND auth.role() = 'authenticated');

-- Allow authenticated users (admin) to update
CREATE POLICY "Admin Update ea_files" ON storage.objects
FOR UPDATE USING (bucket_id = 'ea_files' AND auth.role() = 'authenticated');
