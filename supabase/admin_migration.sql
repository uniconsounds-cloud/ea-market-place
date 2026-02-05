-- Add role column to profiles table
ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user';

-- Create products bucket if not exists (This usually needs to be done via UI/API, but policy can be SQL)
-- Note: You need to create a public bucket named 'products' in Supabase Dashboard first.

-- Policy to allow public read access to product images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- Policy to allow admin upload (for now, allow authenticated users to simplify, or check role)
--Ideally check for (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'products' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
WITH CHECK ( bucket_id = 'products' AND auth.role() = 'authenticated' );

-- Update RLS for products table to allow admin management
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
ON products FOR SELECT
USING (true);

CREATE POLICY "Enable insert for admins"
ON products FOR INSERT
WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Enable update for admins"
ON products FOR UPDATE
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Enable delete for admins"
ON products FOR DELETE
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Set your user as admin (Replace with your actual UUID after running this)
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';
