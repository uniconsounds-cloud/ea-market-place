-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Sync with Auth)
create table profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- PRODUCTS
create table products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price_monthly numeric,
  price_lifetime numeric,
  image_url text,
  file_url text, -- Secure URL or bucket path
  version text default '1.0',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ORDERS
create table orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  product_id uuid references products(id) not null,
  amount numeric not null,
  payment_method text, -- 'stripe', 'promptpay'
  status text default 'pending', -- 'pending', 'paid', 'cancelled'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- LICENSES
create table licenses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  product_id uuid references products(id) not null,
  order_id uuid references orders(id),
  account_number text, -- MT4/MT5 Account Number
  license_key text default uuid_generate_v4()::text,
  type text check (type in ('monthly', 'lifetime')),
  expiry_date timestamp with time zone, -- NULL for lifetime
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- TRIGGER for Profile Creation
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SAMPLE DATA
insert into products (name, description, price_monthly, price_lifetime, image_url, is_active)
values 
('Gold Scalper Pro', 'Advanced EA for Gold trading. High Winrate.', 29.00, 299.00, '/images/ea1.jpg', true),
('Forex Grid Master', 'Grid trading strategy for major pairs.', 19.00, 199.00, '/images/ea2.jpg', true),
('Trend Hunter', 'Follow the trend with AI precision.', 25.00, 250.00, '/images/ea3.jpg', true);
