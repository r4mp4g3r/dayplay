import { supabase, isSupabaseConfigured } from './supabase';
import { getFeed as getMockFeed, getListing as getMockListing } from './mockApi';
import type { Listing } from '@/types/domain';
import { haversineKm } from './location';

// Canonicalize categories and expand DB filters to include common synonyms
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'arts-culture': ['arts-culture', 'arts and culture', 'Arts & Culture'],
  'live-music': ['live-music', 'live music', 'Live Music'],
  'games-entertainment': ['games-entertainment', 'games and entertainment', 'Games & Entertainment'],
  'relax-recharge': ['relax-recharge', 'relax and recharge', 'Relax & Recharge', 'Relax and recharge'],
  'sports-recreation': ['sports-recreation', 'sports and recreation', 'Sports & Recreation'],
  'drinks-bars': ['drinks-bars', 'drinks and bars', 'Drinks & Bars'],
  'pet-friendly': ['pet-friendly', 'pet friendly', 'Pet-Friendly'],
  'road-trip-getaways': ['road-trip-getaways', 'road trip getaways', 'Road Trip Getaways'],
  'festivals-pop-ups': ['festivals-pop-ups', 'festivals & pop-ups', 'Festivals & Pop-Ups', 'festivals and pop ups'],
  'fitness-classes': ['fitness-classes', 'fitness classes', 'Fitness & Classes'],
  'museum': ['museum', 'museums'],
  'coffee': ['coffee', 'cafe', 'coffee shops'],
  'food': ['food', 'restaurants'],
  'outdoors': ['outdoors', 'parks'],
  'nightlife': ['nightlife', 'bars'],
  'shopping': ['shopping', 'shops'],
};

function normalizeCategory(cat?: string): string | undefined {
  if (!cat) return undefined;
  const lower = cat.toLowerCase();
  // Exact canonical
  if (CATEGORY_SYNONYMS[lower]) return lower;
  // Find canonical by membership in synonyms
  for (const [canonical, list] of Object.entries(CATEGORY_SYNONYMS)) {
    if (list.map((s) => s.toLowerCase()).includes(lower)) return canonical;
  }
  return cat;
}

function expandCategoriesForDb(cats: string[]): string[] {
  const out = new Set<string>();
  cats.forEach((c) => {
    const canon = normalizeCategory(c) || c;
    const list = CATEGORY_SYNONYMS[canon] || [canon];
    list.forEach((v) => out.add(v));
    // Also include the canonical itself for safety
    out.add(canon);
  });
  return Array.from(out);
}

type FeedParams = {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  categories?: string[];
  priceTiers?: number[];
  vibes?: string[];
  excludeIds?: string[];
  page?: number;
  pageSize?: number;
  showNewThisWeek?: boolean;
  showOpenNow?: boolean;
  city?: string;
};

/**
 * Get feed of listings (uses Supabase if configured, falls back to mock)
 */
export async function getFeed(params: FeedParams): Promise<{ items: Listing[]; total: number }> {
  // If Supabase not configured, use mock data
  if (!isSupabaseConfigured()) {
    console.log('Using mock feed (Supabase not configured)');
    return getMockFeed(params);
  }

  try {
    // Query Supabase directly (simpler than edge function for MVP)
    let query = supabase!
      .from('listings')
      .select(
        `
        id,title,subtitle,description,category,price_tier,latitude,longitude,city,is_published,is_featured,created_at,phone,website,source,source_metadata,
        listing_photos(url,sort_order)
        `
      )
      .eq('is_published', true)
      .neq('source', 'seed');

    // NOTE: No strict city filter; we rely on radiusKm to include nearby towns

    // Filter by categories (expand synonyms for DB-side filtering)
    if (params.categories && params.categories.length > 0) {
      const expanded = expandCategoriesForDb(params.categories);
      query = query.in('category', expanded);
    }

    // Filter by price tiers
    if (params.priceTiers && params.priceTiers.length > 0) {
      query = query.in('price_tier', params.priceTiers);
    }

    // Lower limit to reduce timeout risk
    const { data, error } = await query.limit(250);

    if (error) throw error;

    // Transform and add images
    let items: (Listing & { recommendationScore?: number })[] = (data || []).map((item: any) => ({
      ...item,
      category: normalizeCategory(item.category) || item.category,
      images:
        item.listing_photos?.sort((a: any, b: any) => a.sort_order - b.sort_order).map((p: any) => p.url) || [],
    }));

    const {
      lat = 30.2672,
      lng = -97.7431,
      radiusKm = 15,
      categories = [],
      priceTiers = [1, 2, 3, 4],
      excludeIds = [],
      page = 0,
      pageSize = 50, // default to 50
      showNewThisWeek = false,
      showOpenNow = false,
    } = params;

    // Optional client-side filters to mimic mock logic (uses normalized categories)
    if (categories.length > 0) {
      const normalizedSelected = categories.map((c) => normalizeCategory(c) || c);
      items = items.filter((l) => normalizedSelected.includes(normalizeCategory(l.category) || l.category));
    }
    if (priceTiers.length) {
      items = items.filter((l) => !l.price_tier || priceTiers.includes(l.price_tier));
    }
    if (excludeIds.length) {
      const set = new Set(excludeIds);
      items = items.filter((l) => !set.has(l.id));
    }
    if (showNewThisWeek) {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      items = items.filter((l) => l.created_at && new Date(l.created_at).getTime() > oneWeekAgo);
    }
    if (showOpenNow) {
      items = items.filter((l) => l.hours);
    }

    const withDistance = items.map((l) => ({
      ...l,
      distanceKm:
        l.latitude && l.longitude ? haversineKm(lat, lng, Number(l.latitude), Number(l.longitude)) : null,
      // Keep placeholder for recommendation score if we hook up real engine
      recommendationScore: 0,
    }));

    let filtered = withDistance.filter((l) => l.distanceKm == null || (radiusKm != null && (l.distanceKm as number) <= radiusKm));

    // Sort featured first, then by distance
    filtered.sort((a, b) => {
      const aPromoted = a.is_featured || false;
      const bPromoted = b.is_featured || false;
      if (aPromoted && !bPromoted) return -1;
      if (!aPromoted && bPromoted) return 1;
      if (a.distanceKm != null && b.distanceKm != null) return (a.distanceKm as number) - (b.distanceKm as number);
      return a.title.localeCompare(b.title);
    });

    const total = filtered.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const pageItems = filtered.slice(start, end);

    return { items: pageItems, total };
    
  } catch (error) {
    console.error('Supabase feed error, falling back to mock:', error);
    return getMockFeed(params);
  }
}

/**
 * Get a single listing by ID
 */
export async function getListing(id: string): Promise<Listing | undefined> {
  // If Supabase not configured, use mock data
  if (!isSupabaseConfigured()) {
    return getMockListing(id);
  }

  try {
    const { data, error } = await supabase!
      .from('listings')
      .select(`
        *,
        listing_photos(url, sort_order)
      `)
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (error) throw error;

    // Transform to match our Listing type
    const listing: Listing = {
      ...data,
      category: normalizeCategory(data.category) || data.category,
      images: data.listing_photos
        ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((p: any) => p.url) || [],
    };

    return listing;
  } catch (error) {
    console.error('Supabase listing error, falling back to mock:', error);
    return getMockListing(id);
  }
}

/**
 * Search listings by query
 */
export async function searchListings(query: string, params: Partial<FeedParams> = {}): Promise<Listing[]> {
  if (!isSupabaseConfigured()) {
    // Simple mock search
    const { items } = await getMockFeed({ ...params, page: 0, pageSize: 50 });
    const lowerQuery = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery) ||
        (normalizeCategory(item.category)?.toLowerCase() || item.category.toLowerCase()).includes(lowerQuery)
    );
  }

  try {
    const { data, error } = await supabase!
      .from('listings')
      .select('*')
      .eq('is_published', true)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return (data as Listing[]).map((l) => ({ ...l, category: normalizeCategory(l.category) || l.category }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Upvote a listing (authenticated users only)
 * Returns:
 *  - 'inserted' when a new upvote row was created
 *  - 'already' when the user had already upvoted (unique constraint hit)
 *  - 'error' on any other failure
 */
export async function upvoteListing(listingId: string): Promise<'inserted' | 'already' | 'error'> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured, upvote not saved');
    return 'error';
  }

  try {
    const { data: userData, error: userError } = await supabase!.auth.getUser();
    if (userError || !userData?.user?.id) {
      console.warn('No authenticated user for upvote');
      return 'error';
    }

    const { error } = await supabase!
      .from('listing_upvotes')
      .insert({ listing_id: listingId, user_id: userData.user.id });

    if (error) {
      // Unique constraint violation means already upvoted
      if (error.code === '23505') {
        console.log('Already upvoted');
        return 'already';
      }
      throw error;
    }
    return 'inserted';
  } catch (error) {
    console.error('Upvote error:', error);
    return 'error';
  }
}

/**
 * Remove upvote from a listing
 */
export async function removeUpvote(listingId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const userId = (await supabase!.auth.getUser()).data.user?.id;
    if (!userId) return false;

    const { error } = await supabase!
      .from('listing_upvotes')
      .delete()
      .eq('listing_id', listingId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Remove upvote error:', error);
    return false;
  }
}

/**
 * Get upvote count for a listing
 */
export async function getUpvoteCount(listingId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const { count, error } = await supabase!
      .from('listing_upvotes')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Get upvote count error:', error);
    return 0;
  }
}

/**
 * Check if the currently authenticated user has upvoted a listing
 */
export async function hasUserUpvoted(listingId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data: userData, error: userError } = await supabase!.auth.getUser();
    if (userError || !userData?.user?.id) {
      return false;
    }

    const { data, error } = await supabase!
      .from('listing_upvotes')
      .select('id')
      .eq('listing_id', listingId)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error('Check upvote error:', error);
    return false;
  }
}

/**
 * Get trending listings for a city using weighted scoring
 */
export async function getTrendingListings(city: string): Promise<Listing[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    // Call the stored function to get trending listing IDs
    const { data: trendingData, error: trendingError } = await supabase!
      .rpc('get_trending_listings', { location_city: city, days_window: 30 });

    if (trendingError) throw trendingError;
    if (!trendingData || trendingData.length === 0) return [];

    // Get full listing details for trending listings
    const listingIds = trendingData.map((t: any) => t.listing_id);
    const { data: listings, error: listingsError } = await supabase!
      .from('listings')
      .select(`
        id,title,subtitle,description,category,price_tier,latitude,longitude,city,is_published,is_featured,created_at,phone,website,source,source_metadata,
        listing_photos(url,sort_order)
      `)
      .in('id', listingIds)
      .eq('is_published', true);

    if (listingsError) throw listingsError;

    // Transform and add upvote counts
    const listingsWithUpvotes: Listing[] = (listings || []).map((item: any) => {
      const trendingInfo = trendingData.find((t: any) => t.listing_id === item.id);
      return {
        ...item,
        category: normalizeCategory(item.category) || item.category,
        images: item.listing_photos
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((p: any) => p.url) || [],
        upvoteCount: trendingInfo?.total_upvotes || 0,
      };
    });

    // Sort by weighted score (same order as trending function)
    const scoreMap = new Map<string, number>(
      trendingData.map((t: any) => [t.listing_id as string, Number(t.weighted_score) || 0])
    );
    listingsWithUpvotes.sort(
      (a, b) => (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0)
    );

    return listingsWithUpvotes;
  } catch (error) {
    console.error('Get trending listings error:', error);
    return [];
  }
}

