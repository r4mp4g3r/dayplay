-- Swipely MVP schema (Postgres / Supabase)

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  preferences_json jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.listings (
  id text primary key,
  title text not null,
  subtitle text,
  description text,
  category text not null,
  price_tier int2 check (price_tier between 1 and 4),
  latitude double precision not null,
  longitude double precision not null,
  city text not null,
  source text default 'seed',
  is_published boolean default true,
  is_featured boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references public.listings(id) on delete cascade,
  url text not null,
  sort_order int2 default 0
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists public.listing_tags (
  listing_id text not null references public.listings(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (listing_id, tag_id)
);

create table if not exists public.swipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null references public.listings(id) on delete cascade,
  direction text not null check (direction in ('right','left')),
  created_at timestamp with time zone default now()
);

create table if not exists public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id text not null references public.listings(id) on delete cascade,
  list_name text,
  created_at timestamp with time zone default now(),
  unique (user_id, listing_id)
);

-- Indexes
create index if not exists idx_listings_city_category on public.listings(city, category);
create index if not exists idx_listings_featured on public.listings(is_featured);
create index if not exists idx_swipes_user_created on public.swipes(user_id, created_at desc);
create index if not exists idx_saves_user_created on public.saves(user_id, created_at desc);

-- RLS
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.tags enable row level security;
alter table public.listing_tags enable row level security;
alter table public.swipes enable row level security;
alter table public.saves enable row level security;
alter table public.profiles enable row level security;

-- Drop existing policies if any (to make script re-runnable)
drop policy if exists listings_read_published on public.listings;
drop policy if exists listing_photos_read on public.listing_photos;
drop policy if exists tags_read on public.tags;
drop policy if exists listing_tags_read on public.listing_tags;
drop policy if exists swipes_owner_select on public.swipes;
drop policy if exists swipes_owner_insert on public.swipes;
drop policy if exists saves_owner_select on public.saves;
drop policy if exists saves_owner_insert on public.saves;
drop policy if exists saves_owner_delete on public.saves;
drop policy if exists saves_owner_update on public.saves;
drop policy if exists profiles_owner_select on public.profiles;
drop policy if exists profiles_owner_upsert on public.profiles;

-- Listings: public read where published
create policy listings_read_published on public.listings
  for select using (is_published = true);

-- Listing photos: follow listing visibility
create policy listing_photos_read on public.listing_photos
  for select using (exists (
    select 1 from public.listings l where l.id = listing_id and l.is_published = true
  ));

-- Tags: public read
create policy tags_read on public.tags for select using (true);
create policy listing_tags_read on public.listing_tags for select using (true);

-- Swipes: user can manage own
create policy swipes_owner_select on public.swipes
  for select using (auth.uid() = user_id);
create policy swipes_owner_insert on public.swipes
  for insert with check (auth.uid() = user_id);

-- Saves: user can manage own
create policy saves_owner_select on public.saves
  for select using (auth.uid() = user_id);
create policy saves_owner_insert on public.saves
  for insert with check (auth.uid() = user_id);
create policy saves_owner_delete on public.saves
  for delete using (auth.uid() = user_id);
create policy saves_owner_update on public.saves
  for update using (auth.uid() = user_id);

-- Profiles: user can read own
create policy profiles_owner_select on public.profiles
  for select using (auth.uid() = user_id);
create policy profiles_owner_upsert on public.profiles
  for insert with check (auth.uid() = user_id);


