/**
 * Google Places API Integration
 * Docs: https://developers.google.com/maps/documentation/places/web-service
 */

import type { Category, Listing } from '@/types/domain';

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Google Places API Types
interface GooglePlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
}

interface GooglePlaceGeometry {
  location: {
    lat: number;
    lng: number;
  };
}

interface GooglePlaceResult {
  place_id: string;
  name: string;
  vicinity?: string;
  formatted_address?: string;
  types: string[];
  geometry: GooglePlaceGeometry;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: GooglePlacePhoto[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  business_status?: string;
}

interface GooglePlaceDetails extends GooglePlaceResult {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  editorial_summary?: {
    overview?: string;
  };
}

interface NearbySearchParams {
  lat: number;
  lng: number;
  radius?: number; // meters, max 50000
  type?: string; // Google place type
  keyword?: string;
  rankby?: 'prominence' | 'distance';
}

interface NearbySearchResponse {
  results: GooglePlaceResult[];
  status: string;
  next_page_token?: string;
}

interface PlaceDetailsResponse {
  result: GooglePlaceDetails;
  status: string;
}

/**
 * Category mapping from Google place types to Swipely categories
 */
const GOOGLE_TYPE_TO_CATEGORY: Record<string, Category> = {
  // Food
  restaurant: 'food',
  cafe: 'food',
  bakery: 'food',
  meal_takeaway: 'food',
  meal_delivery: 'food',
  
  // Coffee
  coffee_shop: 'coffee',
  
  // Nightlife
  bar: 'nightlife',
  night_club: 'nightlife',
  liquor_store: 'nightlife',
  
  // Outdoors
  park: 'outdoors',
  campground: 'outdoors',
  rv_park: 'outdoors',
  
  // Museum
  museum: 'museum',
  art_gallery: 'museum',
  
  // Shopping
  shopping_mall: 'shopping',
  store: 'shopping',
  clothing_store: 'shopping',
  book_store: 'shopping',
  
  // Activities
  amusement_park: 'activities',
  aquarium: 'activities',
  bowling_alley: 'activities',
  movie_theater: 'activities',
  spa: 'activities',
  gym: 'activities',
  stadium: 'activities',
  tourist_attraction: 'activities',
  zoo: 'activities',
};

/**
 * Map Google place types to Swipely category
 */
function mapGoogleTypeToCategory(types: string[]): Category {
  // Find first matching type
  for (const type of types) {
    if (GOOGLE_TYPE_TO_CATEGORY[type]) {
      return GOOGLE_TYPE_TO_CATEGORY[type];
    }
  }
  
  // Default fallback
  return 'activities';
}

/**
 * Get relevant tags from Google place types
 */
function extractTags(types: string[]): string[] {
  const relevantTags = [
    'family_friendly',
    'romantic',
    'outdoor_seating',
    'wheelchair_accessible',
    'good_for_groups',
    'pet_friendly',
  ];
  
  return types.filter(type => relevantTags.includes(type));
}

/**
 * Search for places near a location
 */
export async function searchNearbyPlaces(
  params: NearbySearchParams
): Promise<GooglePlaceResult[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Google Places API key not configured');
    return [];
  }

  const { lat, lng, radius = 5000, type, keyword, rankby = 'prominence' } = params;
  
  const url = new URL(`${BASE_URL}/nearbysearch/json`);
  url.searchParams.append('location', `${lat},${lng}`);
  url.searchParams.append('key', GOOGLE_PLACES_API_KEY);
  
  if (rankby === 'prominence') {
    url.searchParams.append('radius', radius.toString());
  } else {
    url.searchParams.append('rankby', rankby);
  }
  
  if (type) {
    url.searchParams.append('type', type);
  }
  
  if (keyword) {
    url.searchParams.append('keyword', keyword);
  }

  try {
    const response = await fetch(url.toString());
    const data: NearbySearchResponse = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status);
      return [];
    }

    return data.results || [];
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    return [];
  }
}

/**
 * Get detailed information about a place
 */
export async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('Google Places API key not configured');
    return null;
  }

  const url = new URL(`${BASE_URL}/details/json`);
  url.searchParams.append('place_id', placeId);
  url.searchParams.append('key', GOOGLE_PLACES_API_KEY);
  url.searchParams.append('fields', [
    'place_id',
    'name',
    'formatted_address',
    'geometry',
    'types',
    'rating',
    'user_ratings_total',
    'price_level',
    'photos',
    'opening_hours',
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'url',
    'editorial_summary',
    'business_status',
  ].join(','));

  try {
    const response = await fetch(url.toString());
    const data: PlaceDetailsResponse = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places Details API error:', data.status);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error('Error fetching place details:', error);
    return null;
  }
}

/**
 * Get photo URL from Google Places photo reference
 */
export function getPlacePhotoUrl(
  photoReference: string,
  maxWidth: number = 800
): string {
  if (!GOOGLE_PLACES_API_KEY) {
    return '';
  }

  return `${BASE_URL}/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

/**
 * Convert Google Place to Swipely Listing
 */
export function convertGooglePlaceToListing(
  place: GooglePlaceDetails,
  city: string
): Partial<Listing> {
  const category = mapGoogleTypeToCategory(place.types);
  const tags = extractTags(place.types);
  
  // Build images array from photos
  const images = place.photos?.slice(0, 5).map(photo => 
    getPlacePhotoUrl(photo.photo_reference)
  ) || [];

  // Format hours if available
  const hours = place.opening_hours?.weekday_text?.join('\n');
  
  // Build description from editorial summary or address
  const description = place.editorial_summary?.overview || 
    place.formatted_address || 
    place.vicinity || 
    '';

  return {
    id: `gp_${place.place_id}`,
    external_id: place.place_id,
    source: 'google_places',
    title: place.name,
    subtitle: place.vicinity || place.formatted_address,
    description,
    category,
    price_tier: place.price_level ? place.price_level + 1 : undefined, // Google uses 0-4, we use 1-5
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    city,
    images,
    tags,
    hours,
    phone: place.formatted_phone_number || place.international_phone_number,
    website: place.website,
    is_published: place.business_status === 'OPERATIONAL',
    source_metadata: {
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      google_maps_url: place.url,
      types: place.types,
      business_status: place.business_status,
    },
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Batch search for places by category
 */
export async function searchPlacesByCategory(
  lat: number,
  lng: number,
  category: Category,
  radius: number = 5000
): Promise<Partial<Listing>[]> {
  // Find Google types for this category
  const googleTypes = Object.entries(GOOGLE_TYPE_TO_CATEGORY)
    .filter(([_, cat]) => cat === category)
    .map(([type]) => type);

  const allPlaces: Partial<Listing>[] = [];
  
  // Search for each type
  for (const type of googleTypes.slice(0, 3)) { // Limit to 3 types to avoid API quota
    const results = await searchNearbyPlaces({
      lat,
      lng,
      radius,
      type,
    });

    // Get details for each place and convert to listing
    for (const place of results.slice(0, 10)) { // Limit results per type
      const details = await getPlaceDetails(place.place_id);
      if (details) {
        const listing = convertGooglePlaceToListing(details, 'Unknown'); // City should be determined by caller
        allPlaces.push(listing);
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return allPlaces;
}

/**
 * Check if Google Places API is configured
 */
export function isGooglePlacesConfigured(): boolean {
  return !!GOOGLE_PLACES_API_KEY;
}

