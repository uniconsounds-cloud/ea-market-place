-- Create 'ea_files' bucket if not exists
insert into storage.buckets (id, name, public)
values ('ea_files', 'ea_files', true)
on conflict (id) do nothing;

-- Allow Public Read (Users need to download)
-- In a stricter system, we might want signed URLs, but for now Public is requested/easier.
create policy "Public Read EA Files"
on storage.objects for select
using ( bucket_id = 'ea_files' );

-- Allow Admin Upload/Update/Delete
create policy "Authenticated Upload EA Files"
on storage.objects for insert
with check ( bucket_id = 'ea_files' and auth.role() = 'authenticated' );

create policy "Authenticated Update EA Files"
on storage.objects for update
with check ( bucket_id = 'ea_files' and auth.role() = 'authenticated' );

create policy "Authenticated Delete EA Files"
on storage.objects for delete
using ( bucket_id = 'ea_files' and auth.role() = 'authenticated' );
