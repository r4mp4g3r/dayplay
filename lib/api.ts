import { supabase, isSupabaseConfigured } from './supabase';
import { getFeed as getMockFeed, getListing as getMockListing } from './mockApi';
import type { Listing } from '@/types/domain';
import { haversineKm } from './location';

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
      .select(`
        *,
        listing_photos(url, sort_order)
      `)
      .eq('is_published', true)
      .neq('source', 'seed');

    // Filter by categories
    if (params.categories && params.categories.length > 0) {
      query = query.in('category', params.categories);
    }

    // Filter by price tiers
    if (params.priceTiers && params.priceTiers.length > 0) {
      query = query.in('price_tier', params.priceTiers);
    }

    const { data, error } = await query.limit(300);

    if (error) throw error;

    // Transform and add images
    let items: (Listing & { recommendationScore?: number })[] = (data || []).map((item: any) => ({
      ...item,
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
      pageSize = 20,
      showNewThisWeek = false,
      showOpenNow = false,
    } = params;

    // Optional client-side filters to mimic mock logic
    if (categories.length > 0) {
      items = items.filter((l) => categories.includes(l.category));
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
        item.category.toLowerCase().includes(lowerQuery)
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
    return data as Listing[];
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

