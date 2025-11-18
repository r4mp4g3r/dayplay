-- Migration: Add Locals' Favorites (User-Generated Content) feature
-- This enables users to share hidden gems and local recommendations

-- Create locals_favorites table
CREATE TABLE IF NOT EXISTS public.locals_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  name text NOT NULL,
  category text NOT NULL,
  description text,
  
  -- Location
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  city text,
  
  -- Media
  photo_url text,
  
  -- Optional Details
  hours text,
  price_tier int2 CHECK (price_tier BETWEEN 1 AND 4),
  website text,
  
  -- Tags & Vibes
  tags text[] DEFAULT '{}',
  vibes text[] DEFAULT '{}', -- romantic, chill, fun, adventurous, etc.
  
  -- Moderation
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  moderated_by uuid REFERENCES auth.users(id),
  moderated_at timestamp with time zone,
  
  -- Engagement Metrics
  likes_count int DEFAULT 0,
  saves_count int DEFAULT 0,
  views_count int DEFAULT 0,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create likes table for locals_favorites
CREATE TABLE IF NOT EXISTS public.locals_favorites_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_id uuid NOT NULL REFERENCES public.locals_favorites(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, favorite_id)
);

-- Create saves table for locals_favorites (different from general saves)
CREATE TABLE IF NOT EXISTS public.locals_favorites_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_id uuid NOT NULL REFERENCES public.locals_favorites(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, favorite_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_locals_favorites_user_id ON public.locals_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_status ON public.locals_favorites(status);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_category ON public.locals_favorites(category);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_city ON public.locals_favorites(city);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_created_at ON public.locals_favorites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_likes_count ON public.locals_favorites(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_location ON public.locals_favorites(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_locals_favorites_likes_user ON public.locals_favorites_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_likes_favorite ON public.locals_favorites_likes(favorite_id);

CREATE INDEX IF NOT EXISTS idx_locals_favorites_saves_user ON public.locals_favorites_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_locals_favorites_saves_favorite ON public.locals_favorites_saves(favorite_id);

-- Row Level Security (RLS)
ALTER TABLE public.locals_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locals_favorites_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locals_favorites_saves ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS locals_favorites_read_approved ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_read_own ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_insert ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_update_own ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_delete_own ON public.locals_favorites;

DROP POLICY IF EXISTS locals_favorites_likes_read ON public.locals_favorites_likes;
DROP POLICY IF EXISTS locals_favorites_likes_insert ON public.locals_favorites_likes;
DROP POLICY IF EXISTS locals_favorites_likes_delete ON public.locals_favorites_likes;

DROP POLICY IF EXISTS locals_favorites_saves_read ON public.locals_favorites_saves;
DROP POLICY IF EXISTS locals_favorites_saves_insert ON public.locals_favorites_saves;
DROP POLICY IF EXISTS locals_favorites_saves_delete ON public.locals_favorites_saves;

-- Policies for locals_favorites
-- Everyone can read approved favorites
CREATE POLICY locals_favorites_read_approved ON public.locals_favorites
  FOR SELECT USING (status = 'approved');

-- Users can read their own favorites (any status)
CREATE POLICY locals_favorites_read_own ON public.locals_favorites
  FOR SELECT USING (auth.uid() = user_id);

-- Authenticated users can insert their own favorites
CREATE POLICY locals_favorites_insert ON public.locals_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending favorites
CREATE POLICY locals_favorites_update_own ON public.locals_favorites
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Users can delete their own favorites
CREATE POLICY locals_favorites_delete_own ON public.locals_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for likes
CREATE POLICY locals_favorites_likes_read ON public.locals_favorites_likes
  FOR SELECT USING (true);

CREATE POLICY locals_favorites_likes_insert ON public.locals_favorites_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY locals_favorites_likes_delete ON public.locals_favorites_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for saves
CREATE POLICY locals_favorites_saves_read ON public.locals_favorites_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY locals_favorites_saves_insert ON public.locals_favorites_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY locals_favorites_saves_delete ON public.locals_favorites_saves
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update likes_count when a like is added/removed
CREATE OR REPLACE FUNCTION update_locals_favorites_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.locals_favorites
    SET likes_count = likes_count + 1
    WHERE id = NEW.favorite_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.locals_favorites
    SET likes_count = likes_count - 1
    WHERE id = OLD.favorite_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update saves_count when a save is added/removed
CREATE OR REPLACE FUNCTION update_locals_favorites_saves_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.locals_favorites
    SET saves_count = saves_count + 1
    WHERE id = NEW.favorite_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.locals_favorites
    SET saves_count = saves_count - 1
    WHERE id = OLD.favorite_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS locals_favorites_likes_count_trigger ON public.locals_favorites_likes;
CREATE TRIGGER locals_favorites_likes_count_trigger
  AFTER INSERT OR DELETE ON public.locals_favorites_likes
  FOR EACH ROW EXECUTE FUNCTION update_locals_favorites_likes_count();

DROP TRIGGER IF EXISTS locals_favorites_saves_count_trigger ON public.locals_favorites_saves;
CREATE TRIGGER locals_favorites_saves_count_trigger
  AFTER INSERT OR DELETE ON public.locals_favorites_saves
  FOR EACH ROW EXECUTE FUNCTION update_locals_favorites_saves_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_locals_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS locals_favorites_updated_at_trigger ON public.locals_favorites;
CREATE TRIGGER locals_favorites_updated_at_trigger
  BEFORE UPDATE ON public.locals_favorites
  FOR EACH ROW EXECUTE FUNCTION update_locals_favorites_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.locals_favorites IS 'User-generated content: locals share hidden gems and favorite spots';
COMMENT ON COLUMN public.locals_favorites.status IS 'Moderation status: pending, approved, rejected';
COMMENT ON COLUMN public.locals_favorites.vibes IS 'Mood tags: romantic, chill, fun, adventurous, etc.';
COMMENT ON COLUMN public.locals_favorites.likes_count IS 'Cached count of likes for sorting';
COMMENT ON COLUMN public.locals_favorites.saves_count IS 'Cached count of saves for trending';

