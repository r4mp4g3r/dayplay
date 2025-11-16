-- Business Portal Schema Extension
-- Run this AFTER schema.sql

-- Business profiles (separate from regular user profiles)
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  business_name text not null,
  contact_email text not null,
  contact_phone text,
  website text,
  is_verified boolean default false,
  is_active boolean default true,
  subscription_tier text default 'free' check (subscription_tier in ('free', 'basic', 'premium')),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Promotions (businesses can boost their listings)
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  listing_id text not null references public.listings(id) on delete cascade,
  boost_level int2 default 1 check (boost_level between 1 and 3), -- 1=basic, 2=featured, 3=premium
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  target_cities text[], -- null = all cities
  target_categories text[],
  budget_cents int,
  spent_cents int default 0,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Business analytics (track performance)
create table if not exists public.business_analytics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  listing_id text not null references public.listings(id) on delete cascade,
  metric_type text not null check (metric_type in ('view', 'swipe_right', 'swipe_left', 'save', 'share', 'directions', 'call', 'website_click')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Pending listings (submitted by businesses, awaiting approval)
create table if not exists public.pending_listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles(id) on delete cascade,
  title text not null,
  subtitle text,
  description text,
  category text not null,
  price_tier int2,
  latitude double precision not null,
  longitude double precision not null,
  city text not null,
  hours text,
  phone text,
  website text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  submitted_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid references auth.users(id)
);

-- Indexes for business tables
create index if not exists idx_business_profiles_user on public.business_profiles(user_id);
create index if not exists idx_promotions_active on public.promotions(is_active, end_date);
create index if not exists idx_promotions_listing on public.promotions(listing_id);
create index if not exists idx_analytics_business on public.business_analytics(business_id, created_at desc);
create index if not exists idx_analytics_listing on public.business_analytics(listing_id, created_at desc);
create index if not exists idx_pending_status on public.pending_listings(status, submitted_at);

-- RLS for business tables
alter table public.business_profiles enable row level security;
alter table public.promotions enable row level security;
alter table public.business_analytics enable row level security;
alter table public.pending_listings enable row level security;

-- Drop existing business policies if any
drop policy if exists business_profiles_owner on public.business_profiles;
drop policy if exists business_profiles_insert on public.business_profiles;
drop policy if exists promotions_owner on public.promotions;
drop policy if exists analytics_owner on public.business_analytics;
drop policy if exists analytics_insert on public.business_analytics;
drop policy if exists pending_owner on public.pending_listings;

-- Business profiles: owner can manage
create policy business_profiles_owner on public.business_profiles
  for all using (auth.uid() = user_id);

create policy business_profiles_insert on public.business_profiles
  for insert with check (auth.uid() = user_id);

-- Promotions: business owner can manage
create policy promotions_owner on public.promotions
  for all using (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = business_id and bp.user_id = auth.uid()
    )
  );

-- Analytics: business can read their own, system can insert
create policy analytics_owner on public.business_analytics
  for select using (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = business_id and bp.user_id = auth.uid()
    )
  );

create policy analytics_insert on public.business_analytics
  for insert with check (true); -- Allow system to insert analytics

-- Pending listings: business owner can manage
create policy pending_owner on public.pending_listings
  for all using (
    exists (
      select 1 from public.business_profiles bp
      where bp.id = business_id and bp.user_id = auth.uid()
    )
  );

-- Function to mark a listing as promoted (used by feed algorithm)
create or replace function is_currently_promoted(listing_id_param text)
returns boolean as $$
  select exists (
    select 1 from public.promotions
    where listing_id = listing_id_param
      and is_active = true
      and start_date <= now()
      and end_date >= now()
  );
$$ language sql stable;

