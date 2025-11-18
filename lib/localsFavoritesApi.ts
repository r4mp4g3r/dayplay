/**
 * Locals' Favorites API
 * CRUD operations for user-generated content (hidden gems)
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { LocalFavorite, Category, Vibe, ModerationStatus } from '@/types/domain';

interface CreateFavoriteParams {
  name: string;
  category: Category | string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  photo_url?: string;
  hours?: string;
  price_tier?: number;
  website?: string;
  tags?: string[];
  vibes?: Vibe[];
}

interface GetFavoritesParams {
  status?: ModerationStatus;
  category?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: 'newest' | 'trending' | 'nearby';
  limit?: number;
  offset?: number;
}

/**
 * Create a new local favorite (user submission)
 */
export async function createLocalFavorite(params: CreateFavoriteParams): Promise<LocalFavorite | null> {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured');
    return null;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  try {
    const { data, error } = await supabase!
      .from('locals_favorites')
      .insert({
        user_id: user.id,
        ...params,
        status: 'pending', // All submissions start as pending
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating local favorite:', error);
      return null;
    }

    return data as LocalFavorite;
  } catch (error) {
    console.error('Error creating local favorite:', error);
    return null;
  }
}

/**
 * Get locals' favorites feed
 */
export async function getLocalsFavorites(params: GetFavoritesParams = {}): Promise<LocalFavorite[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const {
    status = 'approved',
    category,
    city,
    lat,
    lng,
    radiusKm = 25,
    sortBy = 'newest',
    limit = 50,
    offset = 0,
  } = params;

  try {
    let query = supabase!
      .from('locals_favorites')
      .select('*')
      .eq('status', status);

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Filter by city
    if (city) {
      query = query.eq('city', city);
    }

    // Sorting
    if (sortBy === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'trending') {
      query = query.order('likes_count', { ascending: false });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching locals favorites:', error);
      return [];
    }

    // Calculate distance if user location provided
    let favorites = (data || []) as LocalFavorite[];

    if (lat && lng) {
      favorites = favorites.map((fav: LocalFavorite) => ({
        ...fav,
        distanceKm: calculateDistance(lat, lng, fav.latitude, fav.longitude),
      }));

      // Filter by radius
      favorites = favorites.filter((fav) => !fav.distanceKm || fav.distanceKm <= radiusKm);

      // Sort by distance if sortBy is 'nearby'
      if (sortBy === 'nearby') {
        favorites.sort((a, b) => (a.distanceKm || 999) - (b.distanceKm || 999));
      }
    }

    return favorites as LocalFavorite[];
  } catch (error) {
    console.error('Error fetching locals favorites:', error);
    return [];
  }
}

/**
 * Get a single local favorite by ID
 */
export async function getLocalFavorite(id: string): Promise<LocalFavorite | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase!
      .from('locals_favorites')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching local favorite:', error);
      return null;
    }

    // Increment views count
    await supabase!
      .from('locals_favorites')
      .update({ views_count: (data.views_count || 0) + 1 })
      .eq('id', id);

    return data as LocalFavorite;
  } catch (error) {
    console.error('Error fetching local favorite:', error);
    return null;
  }
}

/**
 * Update a local favorite (own submissions only, pending status)
 */
export async function updateLocalFavorite(
  id: string,
  updates: Partial<CreateFavoriteParams>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase!
      .from('locals_favorites')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating local favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating local favorite:', error);
    return false;
  }
}

/**
 * Delete a local favorite (own submissions only)
 */
export async function deleteLocalFavorite(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase!
      .from('locals_favorites')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting local favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting local favorite:', error);
    return false;
  }
}

/**
 * Like a local favorite
 */
export async function likeLocalFavorite(favoriteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { error } = await supabase!
      .from('locals_favorites_likes')
      .insert({
        user_id: user.id,
        favorite_id: favoriteId,
      });

    if (error) {
      console.error('Error liking favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error liking favorite:', error);
    return false;
  }
}

/**
 * Unlike a local favorite
 */
export async function unlikeLocalFavorite(favoriteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { error } = await supabase!
      .from('locals_favorites_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('favorite_id', favoriteId);

    if (error) {
      console.error('Error unliking favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error unliking favorite:', error);
    return false;
  }
}

/**
 * Save a local favorite to user's collection
 */
export async function saveLocalFavorite(favoriteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { error } = await supabase!
      .from('locals_favorites_saves')
      .insert({
        user_id: user.id,
        favorite_id: favoriteId,
      });

    if (error) {
      console.error('Error saving favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving favorite:', error);
    return false;
  }
}

/**
 * Unsave a local favorite
 */
export async function unsaveLocalFavorite(favoriteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { error } = await supabase!
      .from('locals_favorites_saves')
      .delete()
      .eq('user_id', user.id)
      .eq('favorite_id', favoriteId);

    if (error) {
      console.error('Error unsaving favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error unsaving favorite:', error);
    return false;
  }
}

/**
 * Check if user has liked a favorite
 */
export async function isLocalFavoriteLiked(favoriteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { data, error } = await supabase!
      .from('locals_favorites_likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('favorite_id', favoriteId)
      .single();

    return !!data && !error;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user has saved a favorite
 */
export async function isLocalFavoriteSaved(favoriteId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { data, error } = await supabase!
      .from('locals_favorites_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('favorite_id', favoriteId)
      .single();

    return !!data && !error;
  } catch (error) {
    return false;
  }
}

/**
 * Get user's submitted favorites
 */
export async function getMySubmissions(): Promise<LocalFavorite[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return [];

  try {
    const { data, error } = await supabase!
      .from('locals_favorites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }

    return (data || []) as LocalFavorite[];
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// MODERATION FUNCTIONS (Admin only)

/**
 * Approve a local favorite (admin function)
 */
export async function approveLocalFavorite(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { error } = await supabase!
      .from('locals_favorites')
      .update({
        status: 'approved',
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error approving favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error approving favorite:', error);
    return false;
  }
}

/**
 * Reject a local favorite (admin function)
 */
export async function rejectLocalFavorite(id: string, reason?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { error } = await supabase!
      .from('locals_favorites')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        moderated_by: user.id,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error rejecting favorite:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error rejecting favorite:', error);
    return false;
  }
}

/**
 * Get pending favorites for moderation
 */
export async function getPendingFavorites(): Promise<LocalFavorite[]> {
  return getLocalsFavorites({ status: 'pending', sortBy: 'newest', limit: 100 });
}

