-- Migration: Add developer accounts for moderation access
-- Developers can approve/reject user-submitted local favorites

-- Create developers table
CREATE TABLE IF NOT EXISTS public.developers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_developers_user_id ON public.developers(user_id);
CREATE INDEX IF NOT EXISTS idx_developers_active ON public.developers(is_active);

-- Row Level Security
ALTER TABLE public.developers ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS developers_read_own ON public.developers;
DROP POLICY IF EXISTS developers_insert_self ON public.developers;

-- Developers can read their own record
CREATE POLICY developers_read_own ON public.developers
  FOR SELECT USING (auth.uid() = user_id);

-- Any authenticated user can register as developer (self-service)
CREATE POLICY developers_insert_self ON public.developers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to check if user is a developer
CREATE OR REPLACE FUNCTION is_developer(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.developers
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update locals_favorites policies to allow developers to moderate
DROP POLICY IF EXISTS locals_favorites_moderate ON public.locals_favorites;

CREATE POLICY locals_favorites_moderate ON public.locals_favorites
  FOR UPDATE USING (
    is_developer(auth.uid())
  );

-- Also create business_profiles table if it doesn't exist (from business-schema.sql)
-- This ensures business signup works even if business-schema.sql wasn't run

CREATE TABLE IF NOT EXISTS public.business_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  website text,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_user ON public.business_profiles(user_id);

ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS business_profiles_owner ON public.business_profiles;
DROP POLICY IF EXISTS business_profiles_insert ON public.business_profiles;

-- Business profiles: owner can manage
CREATE POLICY business_profiles_owner ON public.business_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY business_profiles_insert ON public.business_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY business_profiles_update ON public.business_profiles
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.developers IS 'Developer accounts with moderation privileges';
COMMENT ON FUNCTION is_developer IS 'Check if a user has active developer privileges';
COMMENT ON TABLE public.business_profiles IS 'Business accounts for listing management';

