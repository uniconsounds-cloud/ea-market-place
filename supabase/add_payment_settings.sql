create table if not exists payment_settings (
  id uuid default uuid_generate_v4() primary key,
  bank_name text not null default 'Bank',
  account_name text not null default '',
  account_number text not null default '',
  qr_image_url text,
  is_active boolean default true,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Insert default row if not exists
insert into payment_settings (bank_name, account_name, account_number)
select 'SCB', 'Company Name', '123-4-56789-0'
where not exists (select 1 from payment_settings);

-- Policy (Admin only update, Public read)
alter table payment_settings enable row level security;

create policy "Public read payment settings"
  on payment_settings for select
  using (true);

create policy "Admin update payment settings"
  on payment_settings for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
