-- Migration: Add support for Google Places and Eventbrite integration
-- Run this migration on your Supabase database after the base schema

-- Add new columns to listings table
ALTER TABLE public.listings 
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS event_start_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS event_end_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb default '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS hours text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS website text;

-- Add unique constraint on external_id + source combination to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_external_id_source 
  ON public.listings(external_id, source) 
  WHERE external_id IS NOT NULL;

-- Add index for event date queries (find upcoming events)
CREATE INDEX IF NOT EXISTS idx_listings_event_dates 
  ON public.listings(event_start_date, event_end_date) 
  WHERE event_start_date IS NOT NULL;

-- Add index for source queries
CREATE INDEX IF NOT EXISTS idx_listings_source 
  ON public.listings(source);

-- Add index for last_synced_at to identify stale data
CREATE INDEX IF NOT EXISTS idx_listings_last_synced 
  ON public.listings(last_synced_at) 
  WHERE last_synced_at IS NOT NULL;

-- Add comment to document source field values
COMMENT ON COLUMN public.listings.source IS 
  'Data source: seed, business, google_places, eventbrite';

COMMENT ON COLUMN public.listings.external_id IS 
  'External API identifier (Google Place ID or Eventbrite Event ID)';

COMMENT ON COLUMN public.listings.source_metadata IS 
  'JSON metadata from external APIs (ratings, review_count, venue_info, etc.)';

