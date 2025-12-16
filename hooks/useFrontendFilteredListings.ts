import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Listing } from '@/types/domain';

// Category normalization (from lib/api.ts)
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
    'Georgetown', 'Harpers Ferry', 'Haymarket', 'Kensington', 'Laurel'
  ],
  'San Francisco': [
    'San Francisco', 'Berkeley', 'Oakland', 'Alameda', 'Emeryville', 'Brisbane',
    'Daly City', 'Colma', 'Burlingame', 'Half Moon Bay', 'Bolinas', 'Guerneville',
    'Healdsburg', 'Bodega Bay', 'Castro Valley', 'El Cerrito', 'Fremont', 'Concord',
    'Albany', 'Brentwood', 'Dublin', 'Inverness', 'Belmont Park', 'Bolinas',
    'Brisbane', 'Burlingame', 'Castro Valley', 'Colma', 'Daly City', 'El Cerrito',
    'Emeryville', 'Fremont', 'Guerneville', 'Half Moon Bay', 'Healdsburg'
  ],
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface UseFilteredListingsParams {
  city: string;
  lat: number;
  lng: number;
  categories: string[];
  distanceKm: number;
  priceTiers: number[];
  showNewThisWeek: boolean;
  showOpenNow: boolean;
}

export function useFrontendFilteredListings(params: UseFilteredListingsParams) {
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { city } = params;

  // Fetch ALL listings for the city ONCE
  useEffect(() => {
    let cancelled = false;

    const fetchAllListings = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      try {
        console.log('[useFrontendFilteredListings] Fetching all listings for city:', city);
        setLoading(true);
        setError(null);

        if (!supabase) {
          console.error('[useFrontendFilteredListings] Supabase client is null even though isSupabaseConfigured() returned true');
          throw new Error('Supabase client not initialized');
        }

        // Build query - fetch ALL listings with no filtering except city
        let query = supabase
          .from('listings')
          .select(`
            id,title,subtitle,description,category,price_tier,latitude,longitude,city,is_published,is_featured,created_at,phone,website,source,source_metadata,
            listing_photos(url,sort_order)
          `)
          .eq('is_published', true);
          // Removed .neq('source', 'seed') to fetch ALL listings including seed data

        // Apply city filter
        const metroAreaCities = METRO_AREA_CITIES[city];
        if (metroAreaCities) {
          query = query.in('city', metroAreaCities);
        } else {
          query = query.eq('city', city);
        }

        // Order by newest first so recently imported data (like Funcheap events)
        // is guaranteed to appear in the first page that Supabase returns.
        query = query.order('created_at', { ascending: false, nullsLast: true });

        // Fetch listings (Supabase hard-caps at 1000 rows per request)
        const { data, error: fetchError } = await query.limit(3000);

        if (fetchError) {
          console.error('[useFrontendFilteredListings] Supabase fetch error:', fetchError);
          throw fetchError;
        }

        if (!cancelled) {
          // Transform
          const listings: Listing[] = (data || []).map((item: any) => ({
            ...item,
            category: normalizeCategory(item.category) || item.category,
            images: item.listing_photos
              ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
              .map((p: any) => p.url) || [],
          }));

          console.log('🔥🔥🔥 [useFrontendFilteredListings] Fetched', listings.length, 'listings from database (SEED DATA INCLUDED) 🔥🔥🔥');
          setAllListings(listings);
        }
      } catch (err) {
        console.error('[useFrontendFilteredListings] Error:', err);
        try {
          console.error('[useFrontendFilteredListings] Error (stringified):', JSON.stringify(err, null, 2));
        } catch {
          // ignore stringify errors
        }
        if (!cancelled) {
          if (err instanceof Error && err.message) {
            setError(err.message);
          } else if (typeof err === 'string') {
            setError(err);
          } else {
            setError('Failed to fetch listings');
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchAllListings();
    return () => { cancelled = true; };
  }, [city]); // Only refetch when city changes

  // Filter on frontend (INSTANT)
  const filtered = useMemo(() => {
    const startTime = Date.now();

    let results = allListings;

    // Calculate distances
    results = results.map(listing => ({
      ...listing,
      distanceKm: listing.latitude && listing.longitude
        ? haversineKm(params.lat, params.lng, Number(listing.latitude), Number(listing.longitude))
        : null,
    }));

    // Distance filter
    const beforeDistanceFilter = results.length;
    const distanceStats = results
      .filter(l => l.distanceKm != null)
      .map(l => ({ title: l.title, distance: l.distanceKm }))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    
    results = results.filter(l => l.distanceKm == null || l.distanceKm <= params.distanceKm);
    
    console.log(`[useFrontendFilteredListings] Distance filter (${params.distanceKm}km): ${beforeDistanceFilter} -> ${results.length}`);
    if (beforeDistanceFilter > results.length && distanceStats.length > 0) {
      console.log('[useFrontendFilteredListings] Sample distances:', distanceStats.slice(0, 5));
    }

    // Category filter (0 or all = show all)
    const TOTAL_CATEGORIES = 18;
    if (params.categories.length > 0 && params.categories.length < TOTAL_CATEGORIES) {
      const normalized = params.categories.map(c => normalizeCategory(c) || c);
      console.log('[useFrontendFilteredListings] Category filter:', {
        selected: params.categories,
        normalized,
        sampleListingCategories: allListings.slice(0, 5).map(l => ({
          original: l.category,
          normalized: normalizeCategory(l.category),
        })),
      });
      
      const beforeFilter = results.length;
      
      // For debugging: show all listings with selected categories
      const matchingListings = allListings.filter(l => {
        const listingCategoryNormalized = normalizeCategory(l.category) || l.category;
        return normalized.includes(listingCategoryNormalized);
      });
      console.log(`[useFrontendFilteredListings] Total listings with "${normalized.join(', ')}" in database: ${matchingListings.length}`);
      if (matchingListings.length > 0 && matchingListings.length <= 5) {
        console.log('[useFrontendFilteredListings] Matching listings:', matchingListings.map(l => l.title));
      }
      
      results = results.filter(l => {
        const listingCategoryNormalized = normalizeCategory(l.category) || l.category;
        return normalized.includes(listingCategoryNormalized);
      });
      console.log(`[useFrontendFilteredListings] Category filtered (after distance): ${beforeFilter} -> ${results.length}`);
    }

    // Price tier filter
    if (params.priceTiers.length > 0 && params.priceTiers.length < 4) {
      results = results.filter(l => !l.price_tier || params.priceTiers.includes(l.price_tier));
    }

    // New this week
    if (params.showNewThisWeek) {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      results = results.filter(l => l.created_at && new Date(l.created_at).getTime() > oneWeekAgo);
    }

    // Open now
    if (params.showOpenNow) {
      results = results.filter(l => l.hours);
    }

    // Sort: featured first, then by distance
    results.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
      return a.title.localeCompare(b.title);
    });

    const elapsed = Date.now() - startTime;
    console.log(`[useFrontendFilteredListings] Filtered ${results.length}/${allListings.length} listings in ${elapsed}ms`);

    return results;
  }, [allListings, params.lat, params.lng, params.distanceKm, params.categories, params.priceTiers, params.showNewThisWeek, params.showOpenNow]);

  return { listings: filtered, loading, error, total: filtered.length };
}

