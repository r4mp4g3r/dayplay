import { multiCitySeedData } from '@/data/multi-city-seed';
import type { Listing } from '@/types/domain';
import { haversineKm } from './location';
import { getRecommendationScore } from '@/state/swipeHistoryStore';

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

const DEFAULT_PAGE_SIZE = 20;

export async function getFeed(params: FeedParams): Promise<{ items: Listing[]; total: number }> {
  console.log('mockApi.getFeed called with params:', params);
  const {
    lat = 30.2672,
    lng = -97.7431,
    radiusKm = 15,
    categories = [],
    priceTiers = [1, 2, 3, 4],
    excludeIds = [],
    page = 0,
    pageSize = DEFAULT_PAGE_SIZE,
    showNewThisWeek = false,
    showOpenNow = false,
    city,
  } = params;

  console.log('mockApi: seed data length:', multiCitySeedData.length);
  let items = (multiCitySeedData as Listing[]).map((l) => ({ ...l }));

  // Filter by city if specified
  if (city) {
    items = items.filter((l) => l.city === city);
    console.log(`Filtered to ${city}: ${items.length} items`);
  }

  // Only filter by categories if provided AND not empty - otherwise show all
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

  // Filter by "New This Week"
  if (showNewThisWeek) {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    items = items.filter((l) => l.created_at && new Date(l.created_at).getTime() > oneWeekAgo);
  }

  // Filter by "Open Now" - simple check (would be more complex with real hours parsing)
  if (showOpenNow) {
    items = items.filter((l) => l.hours); // Just show items with hours for now
  }

  const withDistance = items.map((l) => ({
    ...l,
    distanceKm: l.latitude && l.longitude ? haversineKm(lat, lng, l.latitude, l.longitude) : null,
    recommendationScore: getRecommendationScore(l.category, l.tags || []),
  }));

  let filtered = withDistance.filter((l) => l.distanceKm == null || l.distanceKm <= radiusKm);

  // Sort: promoted/featured first, then by recommendation score, then by distance
  filtered.sort((a, b) => {
    // Promoted or featured items always come first
    const aPromoted = a.is_featured || false;
    const bPromoted = b.is_featured || false;
    
    if (aPromoted && !bPromoted) return -1;
    if (!aPromoted && bPromoted) return 1;
    
    // Then by recommendation score (higher = better match)
    if (a.recommendationScore !== b.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }
    
    // Then by distance
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    
    // Finally alphabetically
    return a.title.localeCompare(b.title);
  });

  const total = filtered.length;
  const start = page * pageSize;
  const end = start + pageSize;
  const pageItems = filtered.slice(start, end);

  console.log('mockApi: returning', pageItems.length, 'items out of', total, 'total');

  // simulate latency
  await new Promise((res) => setTimeout(res, 150));

  return { items: pageItems, total };
}

export async function getListing(id: string): Promise<Listing | undefined> {
  // simulate latency
  await new Promise((res) => setTimeout(res, 120));
  return (multiCitySeedData as Listing[]).find((l) => l.id === id);
}


