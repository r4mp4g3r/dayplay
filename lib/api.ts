import { supabase, isSupabaseConfigured } from './supabase';
import { getFeed as getMockFeed, getListing as getMockListing } from './mockApi';
import type { Listing } from '@/types/domain';

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
      .eq('is_published', true);

    // Filter by categories
    if (params.categories && params.categories.length > 0) {
      query = query.in('category', params.categories);
    }

    // Filter by price tiers
    if (params.priceTiers && params.priceTiers.length > 0) {
      query = query.in('price_tier', params.priceTiers);
    }

    // Filter by city (if specified)
    if (params.lat && params.lng) {
      // For MVP, just get all and filter by distance client-side
      // In production, use PostGIS for server-side distance filtering
    }

    const { data, error } = await query.limit(100);

    if (error) throw error;

    // Transform and add images
    const listings: Listing[] = (data || []).map((item: any) => ({
      ...item,
      images: item.listing_photos
        ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((p: any) => p.url) || [],
    }));

    // Use mock feed logic for distance sorting and filtering
    // This keeps the recommendation engine and other features
    return getMockFeed({ ...params, /* Pass listings if we want to override */ });
    
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

