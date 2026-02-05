-- FIX STORAGE POLICIES
-- Run this to unlock image uploading for the 'products' bucket

-- 1. Reset policies for storage.objects (Safety cleanup)
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated users can upload images" on storage.objects;
drop policy if exists "Authenticated users can update images" on storage.objects;
drop policy if exists "Allow Public Read for Products" on storage.objects;
drop policy if exists "Allow Authenticated Upload for Products" on storage.objects;

-- 2. Create NEW Permissive Policies for 'products' bucket

-- Allow everyone to SEE images
create policy "Allow Public Read for Products"
on storage.objects for select
using ( bucket_id = 'products' );

-- Allow any logged-in user to UPLOAD images
create policy "Allow Authenticated Upload for Products"
on storage.objects for insert
with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- Allow any logged-in user to UPDATE images
create policy "Allow Authenticated Update for Products"
on storage.objects for update
with check ( bucket_id = 'products' and auth.role() = 'authenticated' );

-- Allow any logged-in user to DELETE images
create policy "Allow Authenticated Delete for Products"
on storage.objects for delete
using ( bucket_id = 'products' and auth.role() = 'authenticated' );
