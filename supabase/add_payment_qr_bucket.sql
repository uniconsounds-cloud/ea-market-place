-- Create 'payment_qr' bucket if not exists
insert into storage.buckets (id, name, public)
values ('payment_qr', 'payment_qr', true)
on conflict (id) do nothing;

-- Allow Public Read
create policy "Public Read Payment QR"
on storage.objects for select
using ( bucket_id = 'payment_qr' );

-- Allow Admin Upload/Update/Delete (authenticated users for now, can refine later)
create policy "Authenticated Upload Payment QR"
on storage.objects for insert
with check ( bucket_id = 'payment_qr' and auth.role() = 'authenticated' );

create policy "Authenticated Update Payment QR"
on storage.objects for update
with check ( bucket_id = 'payment_qr' and auth.role() = 'authenticated' );

create policy "Authenticated Delete Payment QR"
on storage.objects for delete
using ( bucket_id = 'payment_qr' and auth.role() = 'authenticated' );
