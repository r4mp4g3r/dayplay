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
  // Use real listings as mock data for Local Suggestions
  const {
    city,
    sortBy = 'newest',
    limit = 50,
  } = params;

  console.log('[getLocalsFavorites] Fetching real listings as mock data for city:', city);

  if (!isSupabaseConfigured()) {
    console.log('[getLocalsFavorites] Supabase not configured, returning empty');
    return [];
  }

  try {
    // Metro area mappings - must match lib/api.ts
    const METRO_AREA_CITIES: Record<string, string[]> = {
      'Northern Virginia': [
        'Northern Virginia', 'Fairfax', 'Arlington', 'Alexandria', 'Reston', 'Vienna',
        'Falls Church', 'McLean', 'Tysons', 'Annandale', 'Springfield', 'Centreville',
        'Herndon', 'Chantilly', 'Great Falls', 'Clifton', 'Fairfax Station',
        'Occoquan Historic District', 'Manassas', 'Ashburn', 'Leesburg', 'Sterling',
        'Burke', 'Lorton', 'Mount Vernon', 'Oakton', 'Dunn Loring', 'Merrifield',
        'Woodbridge', 'Dale City', 'Lake Ridge', 'Gainesville', 'Haymarket',
        // DC area (included in NV dataset)
        'Washington', 'Washington, DC', 'District of Columbia',
        // Maryland areas near NV (included in imports)
        'Frederick, MD', 'Solomons', 'Silver Spring', 'National Harbor', 'Bethesda',
        // Other VA cities from the import
        'Middleburg', 'Waterford', 'Fredericksburg', 'Stafford', 'Prince William',
        // Additional cities found in database
        'Fairfax County', 'Franconia', 'Lincolnia', 'Dulles', 'Dumfries', 'Fort Belvoir',
        'Gaithersburg', 'Kensington', 'Darnestown', 'Accokeek', 'Aldie', 'Annapolis',
        'Ashton-Sandy Spring', 'Bluemont', 'Delaplane', 'Dickerson', 'Easton', 'Frederick',
        'Georgetown', 'Harpers Ferry', 'Laurel'
      ],
      'San Francisco': [
        'San Francisco', 'Berkeley', 'Oakland', 'Alameda', 'Emeryville', 'Brisbane',
        'Daly City', 'Colma', 'Burlingame', 'Half Moon Bay', 'Bolinas', 'Guerneville',
        'Healdsburg', 'Bodega Bay', 'Castro Valley', 'El Cerrito', 'Fremont', 'Concord',
        'Albany', 'Brentwood', 'Dublin', 'Inverness', 'Belmont Park'
      ],
    };

    // Build query with city filter
    let query = supabase!
      .from('listings')
      .select(`
        id,title,description,category,latitude,longitude,city,created_at,
        listing_photos(url,sort_order)
      `)
      .eq('is_published', true);

    // Apply city filter
    if (city) {
      const metroAreaCities = METRO_AREA_CITIES[city];
      if (metroAreaCities) {
        query = query.in('city', metroAreaCities);
      } else {
        query = query.eq('city', city);
      }
    }

    // Get random listings (limit to 10 for mock data)
    const { data: listings, error } = await query.limit(100);

    if (error) {
      console.error('[getLocalsFavorites] Error fetching listings:', error);
      return [];
    }

    if (!listings || listings.length === 0) {
      console.log('[getLocalsFavorites] No listings found');
      return [];
    }

    // Transform listings to LocalFavorite format
    const mockFavorites: LocalFavorite[] = listings
      .filter(l => l.listing_photos && l.listing_photos.length > 0) // Only listings with photos
      .map((listing: any, index) => ({
        id: `mock-${listing.id}`, // Prefix with mock- to indicate it's not a real favorite
        user_id: 'mock-user',
        name: listing.title,
        description: listing.description || 'A great local spot recommended by the community',
        category: listing.category,
        address: listing.city,
        city: listing.city,
        latitude: listing.latitude,
        longitude: listing.longitude,
        photos: listing.listing_photos
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((p: any) => p.url) || [],
        status: 'approved' as const,
        created_at: listing.created_at,
        updated_at: listing.created_at,
        likes_count: Math.floor(Math.random() * 50) + 5, // Random likes between 5-55
        saves_count: Math.floor(Math.random() * 30) + 2, // Random saves between 2-32
        views_count: Math.floor(Math.random() * 200) + 10, // Random views between 10-210
      }));

    // Sort based on sortBy parameter
    let sorted = mockFavorites;
    if (sortBy === 'trending') {
      sorted = [...mockFavorites].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else if (sortBy === 'newest') {
      sorted = [...mockFavorites].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // Limit results
    const limited = sorted.slice(0, Math.min(limit, 10)); // Show max 10 mock favorites

    console.log('[getLocalsFavorites] Returning', limited.length, 'mock favorites from real listings');
    return limited;
  } catch (error) {
    console.error('[getLocalsFavorites] Error:', error);
    return [];
  }
}

/**
 * Get a single local favorite by ID
 */
export async function getLocalFavorite(id: string): Promise<LocalFavorite | null> {
  // Handle mock IDs (format: mock-gp_xxx or mock-listing_id)
  if (id.startsWith('mock-')) {
    console.log('[getLocalFavorite] Mock ID detected, fetching real listing:', id);
    
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      // Extract the real listing ID (remove 'mock-' prefix)
      const realListingId = id.replace('mock-', '');
      
      const { data: listing, error } = await supabase!
        .from('listings')
        .select(`
          id,title,description,category,latitude,longitude,city,created_at,
          listing_photos(url,sort_order)
        `)
        .eq('id', realListingId)
        .eq('is_published', true)
        .single();

      if (error || !listing) {
        console.error('[getLocalFavorite] Error fetching listing:', error);
        return null;
      }

      // Transform to LocalFavorite format
      return {
        id: `mock-${listing.id}`,
        user_id: 'mock-user',
        name: listing.title,
        description: listing.description || 'A great local spot recommended by the community',
        category: listing.category,
        address: listing.city,
        city: listing.city,
        latitude: listing.latitude,
        longitude: listing.longitude,
        photos: listing.listing_photos
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((p: any) => p.url) || [],
        status: 'approved',
        created_at: listing.created_at,
        updated_at: listing.created_at,
        likes_count: Math.floor(Math.random() * 50) + 5,
        saves_count: Math.floor(Math.random() * 30) + 2,
        views_count: Math.floor(Math.random() * 200) + 10,
      };
    } catch (error) {
      console.error('[getLocalFavorite] Error:', error);
      return null;
    }
  }

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
  // Handle mock IDs - just return success
  if (favoriteId.startsWith('mock-')) {
    console.log('[likeLocalFavorite] Mock ID detected, simulating success');
    return true;
  }

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
  // Handle mock IDs - just return success
  if (favoriteId.startsWith('mock-')) {
    console.log('[unlikeLocalFavorite] Mock ID detected, simulating success');
    return true;
  }

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
  // Handle mock IDs - just return success
  if (favoriteId.startsWith('mock-')) {
    console.log('[saveLocalFavorite] Mock ID detected, simulating success');
    return true;
  }

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
  // Handle mock IDs - just return success
  if (favoriteId.startsWith('mock-')) {
    console.log('[unsaveLocalFavorite] Mock ID detected, simulating success');
    return true;
  }

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
  // Handle mock IDs - return false (not liked)
  if (favoriteId.startsWith('mock-')) {
    return false;
  }

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
  // Handle mock IDs - return false (not saved)
  if (favoriteId.startsWith('mock-')) {
    return false;
  }

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

