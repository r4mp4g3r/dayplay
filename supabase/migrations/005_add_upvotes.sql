-- Add upvoting system for listings
-- Users can upvote listings (one vote per user per listing)
-- Trending is calculated with weighted scores (recent upvotes count more)

-- Create listing_upvotes table
create table if not exists public.listing_upvotes (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique (listing_id, user_id)
);

-- Indexes for performance
create index if not exists idx_listing_upvotes_listing on public.listing_upvotes(listing_id);
create index if not exists idx_listing_upvotes_created on public.listing_upvotes(created_at desc);
create index if not exists idx_listing_upvotes_user on public.listing_upvotes(user_id);

-- RLS policies
alter table public.listing_upvotes enable row level security;

drop policy if exists upvotes_read on public.listing_upvotes;
drop policy if exists upvotes_insert on public.listing_upvotes;
drop policy if exists upvotes_delete on public.listing_upvotes;

create policy upvotes_read on public.listing_upvotes 
  for select using (true);

create policy upvotes_insert on public.listing_upvotes 
  for insert with check (auth.uid() = user_id);

create policy upvotes_delete on public.listing_upvotes 
  for delete using (auth.uid() = user_id);

-- Helper function to get trending listings with weighted scoring
-- Recent upvotes (last 7 days) count 3x more than older upvotes
drop function if exists get_trending_listings(text, integer);

create or replace function get_trending_listings(location_city text, days_window int default 30)
returns table (
  listing_id text,
  total_upvotes bigint,
  recent_upvotes bigint,
  weighted_score bigint
) as $$
begin
  return query
  select 
    lu.listing_id,
    count(*) as total_upvotes,
    count(*) filter (where lu.created_at > now() - interval '7 days') as recent_upvotes,
    -- Weighted: recent upvotes worth 3x, older upvotes worth 1x
    (count(*) filter (where lu.created_at > now() - interval '7 days') * 3 + 
     count(*) filter (where lu.created_at <= now() - interval '7 days')) as weighted_score
  from public.listing_upvotes lu
  inner join public.listings l on l.id = lu.listing_id
  where (
    l.city = location_city 
    OR l.city ILIKE location_city || '%'
    OR l.city ILIKE '%' || location_city || '%'
  )
    and lu.created_at > now() - make_interval(days => days_window)
  group by lu.listing_id
  order by weighted_score desc
  limit 50;
end;
$$ language plpgsql;

