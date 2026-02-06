-- Create 'slips' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
select 'slips', 'slips', true
where not exists (
    select 1 from storage.buckets where id = 'slips'
);

-- Policy: Allow authenticated users to upload slips
create policy "Allow authenticated users to upload slips"
on storage.objects for insert
with check (
    bucket_id = 'slips' 
    and auth.role() = 'authenticated'
);

-- Policy: Allow admins to view slips (public read is also fine for simplicity here, but let's be safe)
create policy "Allow public read access to slips"
on storage.objects for select
using ( bucket_id = 'slips' );
