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
      .eq('is_published', true);
      // Removed .neq('source', 'seed') to fetch ALL listings

    // Filter by city if provided - this ensures we only show listings for the selected region
    // Some "cities" in our app are actually metro areas that span multiple municipalities
    if (params.city) {
      // Metro area mappings: maps display name -> array of actual city names in database
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
          'Middleburg', 'Waterford', 'Fredericksburg', 'Stafford', 'Prince William'
        ],
        // Add more metro areas here as needed:
        // 'Bay Area': ['San Francisco', 'Oakland', 'Berkeley', 'San Jose', ...],
        // 'Greater Austin': ['Austin', 'Round Rock', 'Cedar Park', 'Georgetown', ...],
      };

      // Check if this is a metro area with multiple cities
      const metroAreaCities = METRO_AREA_CITIES[params.city];
      if (metroAreaCities) {
        query = query.in('city', metroAreaCities);
        console.log(`[getFeed] Filtering by metro area "${params.city}" (${metroAreaCities.length} cities)`);
      } else {
        // Single city - do exact match
        query = query.eq('city', params.city);
        console.log(`[getFeed] Filtering by single city: "${params.city}"`);
      }
    } else {
      console.log('[getFeed] No city filter applied - showing all cities');
    }

    // NO DATABASE-LEVEL FILTERING - fetch everything and filter on frontend
    // This ensures the frontend has access to all data for instant filtering

    // Increased limit to handle cities with many listings
    const { data, error } = await query.limit(2000);

    if (error) throw error;

    // Transform and add images - NO FILTERING AT ALL
    // All filtering happens on the frontend in useFrontendFilteredListings
    const items: Listing[] = (data || []).map((item: any) => ({
      ...item,
      category: normalizeCategory(item.category) || item.category,
      images:
        item.listing_photos?.sort((a: any, b: any) => a.sort_order - b.sort_order).map((p: any) => p.url) || [],
    }));

    console.log(`[getFeed] Fetched ${items.length} total listings from database for ${params.city || 'all cities'} (NO FILTERING APPLIED)`);

    // Return ALL items - frontend will handle all filtering
    return { items, total: items.length };
    
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
 * Get trending listings for a city based on upvotes
 * Shows top 5 most upvoted listings from the selected city/metro area
 */
export async function getTrendingListings(city: string): Promise<Listing[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    console.log('[getTrendingListings] Fetching for city:', city);

    // Use the same metro area mapping as getFeed
    const METRO_AREA_CITIES: Record<string, string[]> = {
      'Northern Virginia': [
        'Northern Virginia', 'Fairfax', 'Arlington', 'Alexandria', 'Reston', 'Vienna',
        'Falls Church', 'McLean', 'Tysons', 'Annandale', 'Springfield', 'Centreville',
        'Herndon', 'Chantilly', 'Great Falls', 'Clifton', 'Fairfax Station',
        'Occoquan Historic District', 'Manassas', 'Ashburn', 'Leesburg', 'Sterling',
        'Burke', 'Lorton', 'Mount Vernon', 'Oakton', 'Dunn Loring', 'Merrifield',
        'Woodbridge', 'Dale City', 'Lake Ridge', 'Gainesville', 'Haymarket'
      ],
    };

    // Build query with city filter
    let query = supabase!
      .from('listings')
      .select(`
        id,title,subtitle,description,category,price_tier,latitude,longitude,city,is_published,is_featured,created_at,phone,website,source,source_metadata,
        listing_photos(url,sort_order)
      `)
      .eq('is_published', true);

    // Apply city filter (metro area or single city)
    const metroAreaCities = METRO_AREA_CITIES[city];
    if (metroAreaCities) {
      query = query.in('city', metroAreaCities);
      console.log('[getTrendingListings] Filtering by metro area:', metroAreaCities.length, 'cities');
    } else {
      query = query.eq('city', city);
      console.log('[getTrendingListings] Filtering by single city:', city);
    }

    const { data: listings, error: listingsError } = await query.limit(500); // Fetch more to get upvotes

    if (listingsError) throw listingsError;
    if (!listings || listings.length === 0) {
      console.log('[getTrendingListings] No listings found');
      return [];
    }

    console.log('[getTrendingListings] Found', listings.length, 'listings, fetching upvotes...');

    // Get upvote counts for all listings
    const listingIds = listings.map(l => l.id);
    const { data: upvotesData, error: upvotesError } = await supabase!
      .from('listing_upvotes')
      .select('listing_id')
      .in('listing_id', listingIds);

    if (upvotesError) {
      console.error('[getTrendingListings] Error fetching upvotes:', upvotesError);
    }

    // Count upvotes per listing
    const upvoteCounts = new Map<string, number>();
    (upvotesData || []).forEach((upvote: any) => {
      const count = upvoteCounts.get(upvote.listing_id) || 0;
      upvoteCounts.set(upvote.listing_id, count + 1);
    });

    // Transform listings and add upvote counts
    const listingsWithUpvotes: Listing[] = listings.map((item: any) => ({
      ...item,
      category: normalizeCategory(item.category) || item.category,
      images: item.listing_photos
        ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((p: any) => p.url) || [],
      upvoteCount: upvoteCounts.get(item.id) || 0,
    }));

    // Sort by upvote count (descending) and take top 5
    const sorted = listingsWithUpvotes
      .sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0))
      .slice(0, 5); // Top 5

    console.log('[getTrendingListings] Returning top', sorted.length, 'listings');
    if (sorted.length > 0) {
      console.log('[getTrendingListings] Top listing:', sorted[0].title, 'upvotes:', sorted[0].upvoteCount);
    }

    return sorted;
  } catch (error) {
    console.error('Get trending listings error:', error);
    return [];
  }
}

