-- Migration: Fix developer moderation access
-- Allow developers to view pending submissions and moderate them

-- First, ensure is_developer function exists (from migration 003)
-- If migration 003 wasn't run, create it now
CREATE OR REPLACE FUNCTION is_developer(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.developers
    WHERE user_id = check_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies for locals_favorites
DROP POLICY IF EXISTS locals_favorites_read_approved ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_read_own ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_read_developer ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_insert ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_update_own ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_update_developer ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_delete_own ON public.locals_favorites;
DROP POLICY IF EXISTS locals_favorites_moderate ON public.locals_favorites;

-- New comprehensive policies
-- 1. Everyone can read approved favorites
CREATE POLICY locals_favorites_read_approved ON public.locals_favorites
  FOR SELECT USING (status = 'approved');

-- 2. Users can read their own favorites (any status)
CREATE POLICY locals_favorites_read_own ON public.locals_favorites
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Developers can read ALL favorites (including pending) for moderation
CREATE POLICY locals_favorites_read_developer ON public.locals_favorites
  FOR SELECT USING (is_developer(auth.uid()));

-- 4. Authenticated users can insert their own favorites
CREATE POLICY locals_favorites_insert ON public.locals_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Users can update their own pending favorites
CREATE POLICY locals_favorites_update_own ON public.locals_favorites
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- 6. Developers can update any favorite (for moderation)
CREATE POLICY locals_favorites_update_developer ON public.locals_favorites
  FOR UPDATE USING (is_developer(auth.uid()));

-- 7. Users can delete their own favorites
CREATE POLICY locals_favorites_delete_own ON public.locals_favorites
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON POLICY locals_favorites_read_developer ON public.locals_favorites IS 
  'Developers can read all favorites including pending ones for moderation';
COMMENT ON POLICY locals_favorites_update_developer ON public.locals_favorites IS 
  'Developers can update status, moderated_by, moderated_at fields for moderation';

