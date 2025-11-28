/* eslint-disable no-console */
/**
 * Script to sync listings for Linköping, Sweden
 * Run with: npx tsx scripts/sync-linkoping.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  searchTicketmasterEvents,
  convertTicketmasterEventToListing,
  isTicketmasterConfigured,
} from '../lib/ticketmaster';

// Environment variables
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) environment variable.');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Linköping, Sweden configuration
const CITY = { name: 'Linköping', lat: 58.4108, lng: 15.6214, country: 'Sweden' };

// Category configurations with Google Places types
const CATEGORY_CONFIGS: Record<string, { types: string[]; useTicketmaster?: boolean }> = {
  'museum': {
    types: ['museum', 'art_gallery'],
  },
  'events': {
    types: ['event_venue', 'stadium', 'amusement_park'],
    useTicketmaster: true,
  },
  'hotels': {
    types: ['lodging', 'hotel'],
  },
  'shopping': {
    types: ['shopping_mall', 'clothing_store', 'store', 'shopping_center', 'jewelry_store', 'shoe_store'],
  },
  'arts-culture': {
    types: ['art_gallery', 'museum', 'cultural_center', 'performing_arts_theater'],
  },
  'live-music': {
    types: ['music_venue', 'concert_hall', 'night_club'],
    useTicketmaster: true,
  },
  'relax-recharge': {
    types: ['spa', 'beauty_salon', 'hair_care', 'massage'],
  },
  'games-entertainment': {
    types: ['amusement_center', 'bowling_alley', 'arcade', 'movie_theater', 'casino'],
  },
  'pet-friendly': {
    types: ['zoo', 'pet_store', 'dog_park', 'veterinary_care'],
  },
  'road-trip-getaways': {
    types: ['natural_feature', 'rv_park', 'campground', 'park', 'tourist_attraction'],
  },
  'festivals-pop-ups': {
    types: ['market', 'fair', 'farmer_market', 'flea_market', 'event_venue', 'convention_center'],
  },
  'fitness-classes': {
    types: ['yoga_studio', 'fitness_center', 'pilates_studio', 'gym', 'sports_club'],
  },
  'food': {
    types: ['restaurant', 'cafe', 'bakery', 'food'],
  },
  'coffee': {
    types: ['cafe', 'coffee_shop'],
  },
  'nightlife': {
    types: ['bar', 'night_club'],
  },
  'outdoors': {
    types: ['park', 'hiking_area', 'beach', 'campground', 'tourist_attraction'],
  },
  'activities': {
    types: ['tourist_attraction', 'amusement_park', 'zoo', 'aquarium'],
  },
};

// Default settings
const RADIUS = 50000; // 50km
const LIMIT_PER_CATEGORY = 100;
const MIN_RATING = 3.0;
const MIN_REVIEWS = 5; // Lower threshold for smaller city
const TICKETMASTER_DAYS_AHEAD = 90;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper functions
function categoryFromTypes(types: string[] = []): string {
  const set = new Set(types);
  
  for (const [category, config] of Object.entries(CATEGORY_CONFIGS)) {
    if (config.types.some(type => set.has(type))) {
      return category;
    }
  }
  
  return 'activities'; // Default fallback
}

function priceFromLevel(level?: number): number | undefined {
  if (level === undefined || level === null) return undefined;
  return Math.min(4, Math.max(1, level + 1));
}

function extractCity(addressComponents: any[]): string | null {
  if (!addressComponents) return null;
  
  for (const comp of addressComponents) {
    if (comp.types.includes('locality')) {
      return comp.long_name;
    }
  }
  
  return null;
}

function photoUrl(photoRef?: string): string | null {
  if (!photoRef) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_KEY}`;
}

// Google Places API functions
async function fetchNearby(lat: number, lng: number, type: string): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${RADIUS}&type=${type}&key=${GOOGLE_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return data.results || [];
    }
    
    if (data.status === 'NEXT_PAGE_TOKEN') {
      console.warn('  ⚠️  More results available (pagination not implemented)');
    }
    
    console.warn(`  ⚠️  API returned status: ${data.status}`);
    return [];
  } catch (error: any) {
    console.error(`  ❌ Error fetching nearby places:`, error.message);
    return [];
  }
}

async function getPlaceDetails(placeId: string): Promise<any | null> {
  if (!placeId || typeof placeId !== 'string' || placeId.trim().length === 0) {
    return null;
  }

  // Use basic fields first - we can add more later if needed
  // Note: 'description' is not a valid field for Place Details API
  const fields = [
    'name',
    'formatted_address',
    'geometry',
    'place_id',
    'types',
    'rating',
    'user_ratings_total',
    'price_level',
    'photos',
    'opening_hours',
    'website',
    'formatted_phone_number',
    'international_phone_number',
    'editorial_summary',
  ].join(',');
  
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId.trim())}&fields=${encodeURIComponent(fields)}&key=${GOOGLE_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      return data.result;
    }
    
    // Suppress common expected errors to reduce noise
    if (data.status === 'ZERO_RESULTS' || data.status === 'NOT_FOUND') {
      return null;
    }
    
    // For INVALID_REQUEST, it might be a temporary issue or invalid place_id
    // Log only occasionally to avoid spam
    if (Math.random() < 0.1) { // Log only 10% of errors
      if (data.error_message) {
        console.warn(`  ⚠️  Place details error (${data.status}): ${data.error_message.substring(0, 80)}`);
      }
    }
    
    return null;
  } catch (error: any) {
    // Only log occasional network errors
    if (Math.random() < 0.1) {
      console.error(`  ❌ Network error fetching place details:`, error.message);
    }
    return null;
  }
}

async function searchText(lat: number, lng: number, query: string): Promise<any[]> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${RADIUS}&key=${GOOGLE_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return data.results || [];
    }
    
    console.warn(`  ⚠️  Text search returned status: ${data.status}`);
    return [];
  } catch (error: any) {
    console.error(`  ❌ Error in text search:`, error.message);
    return [];
  }
}

// Process and upsert a listing
async function upsertListing(listing: any): Promise<boolean> {
  try {
    const { images, tags, ...listingToUpsert } = listing;

    const { error } = await supabase.from('listings').upsert(listingToUpsert, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`  ❌ Failed to upsert ${listing.id}:`, error.message);
      return false;
    } else {
      console.log(`  ✅ Upserted: ${listing.title} (${listing.category})`);
      return true;
    }
  } catch (error: any) {
    console.error(`  ❌ Error upserting ${listing.id}:`, error.message);
    return false;
  }
}

// Fetch events from Ticketmaster
async function fetchTicketmasterEvents(
  lat: number,
  lng: number,
  radius: number,
  classificationName?: string
): Promise<any[]> {
  if (!isTicketmasterConfigured()) {
    console.warn('  ⚠️  Ticketmaster API not configured, skipping events');
    return [];
  }

  try {
    const now = new Date();
    const startDate = now.toISOString().split('.')[0] + 'Z';
    const endDate = new Date(now.getTime() + TICKETMASTER_DAYS_AHEAD * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('.')[0] + 'Z';

    const events = await searchTicketmasterEvents({
      lat,
      lng,
      radius,
      unit: 'km',
      startDateTime: startDate,
      endDateTime: endDate,
      classificationName,
      size: 200,
    });

    return events || [];
  } catch (error) {
    console.error('  ❌ Error fetching Ticketmaster events:', error);
    return [];
  }
}

// Sync Google Places listings for a category
async function syncGooglePlacesCategory(
  category: string,
  types: string[],
  keywords?: string[]
): Promise<number> {
  console.log(`\n📍 Syncing ${category} for ${CITY.name}...`);
  let totalUpserted = 0;
  const seenPlaceIds = new Set<string>();
  const allPlacesToProcess: any[] = [];

  // Fetch by types
  for (const type of types) {
    console.log(`  Searching for type: ${type}`);
    const places = await fetchNearby(CITY.lat, CITY.lng, type);
    allPlacesToProcess.push(...places);
    await sleep(200); // Rate limiting
  }

  // Fetch by keywords (Text Search)
  if (keywords && keywords.length > 0) {
    for (const keyword of keywords) {
      console.log(`  Searching for keyword: "${keyword}"`);
      const textSearchResults = await searchText(CITY.lat, CITY.lng, `${keyword} ${CITY.name}`);
      allPlacesToProcess.push(...textSearchResults);
      await sleep(200); // Rate limiting
    }
  }
  
  // Filter unique places by place_id and apply rating/review filters
  const uniqueFilteredPlaces = allPlacesToProcess.filter(
    (p: any) =>
      p.place_id &&
      (p.rating || 0) >= MIN_RATING &&
      (p.user_ratings_total || 0) >= MIN_REVIEWS &&
      !seenPlaceIds.has(p.place_id) &&
      seenPlaceIds.add(p.place_id)
  );

  console.log(`  Found ${uniqueFilteredPlaces.length} unique places matching criteria`);

  // Process up to LIMIT_PER_CATEGORY places
  let processedCount = 0;
  for (const place of uniqueFilteredPlaces.slice(0, LIMIT_PER_CATEGORY)) {
    if (!place.place_id) {
      console.warn(`  ⚠️  Skipping place without place_id`);
      continue;
    }

    const details = await getPlaceDetails(place.place_id);
    if (!details) {
      // Skip if details fetch failed
      continue;
    }

    processedCount++;
    if (processedCount % 10 === 0) {
      console.log(`  📊 Processed ${processedCount}/${Math.min(uniqueFilteredPlaces.length, LIMIT_PER_CATEGORY)} places...`);
    }

    const finalCategory = categoryFromTypes(details.types || []);
    
    if (finalCategory !== category && !['activities', 'neighborhood'].includes(category)) {
      continue;
    }

    const photos = (details.photos || [])
      .slice(0, 5)
      .map((p: any) => photoUrl(p.photo_reference))
      .filter(Boolean);

    // Validate required fields
    if (!details.name || !details.geometry?.location) {
      console.warn(`  ⚠️  Skipping place with missing required fields: ${details.place_id}`);
      continue;
    }

    const listing: any = {
      id: `gp_${details.place_id}`,
      title: details.name || 'Untitled',
      subtitle: details.formatted_address?.split(',')[0] || undefined,
      description: details.editorial_summary?.overview || undefined,
      category: finalCategory,
      price_tier: priceFromLevel(details.price_level),
      latitude: details.geometry.location.lat,
      longitude: details.geometry.location.lng,
      city: extractCity(details.address_components) || CITY.name,
      source: 'google_places',
      external_id: details.place_id,
      hours: details.opening_hours?.weekday_text?.join('; ') || undefined,
      phone: details.formatted_phone_number || details.international_phone_number || undefined,
      website: details.website || undefined,
      is_published: true,
      source_metadata: {
        place_id: details.place_id,
        types: details.types || [],
        rating: details.rating,
        user_ratings_total: details.user_ratings_total,
      },
      last_synced_at: new Date().toISOString(),
    };

    const listingUpserted = await upsertListing(listing);

    // Insert photos only if listing was successfully upserted
    if (listingUpserted && photos.length > 0) {
      await supabase.from('listing_photos').delete().eq('listing_id', listing.id);

      for (let i = 0; i < photos.length; i++) {
        const { error: photoError } = await supabase.from('listing_photos').insert({
          listing_id: listing.id,
          url: photos[i],
          sort_order: i,
        });
        if (photoError) {
          console.warn(`  ⚠️  Failed to insert photo for ${listing.id}:`, photoError.message);
        }
      }
    }

    totalUpserted++;
    await sleep(100); // Rate limiting
  }

  return totalUpserted;
}

// Sync Ticketmaster events for a category
async function syncTicketmasterCategory(
  category: string,
  classificationName?: string
): Promise<number> {
  if (!isTicketmasterConfigured()) {
    return 0;
  }

  console.log(`\n🎫 Syncing ${category} events from Ticketmaster for ${CITY.name}...`);

  const events = await fetchTicketmasterEvents(
    CITY.lat,
    CITY.lng,
    Math.floor(RADIUS / 1000), // Convert to km
    classificationName
  );

  console.log(`  Found ${events.length} events`);

  let totalUpserted = 0;

  for (const event of events) {
    try {
      const listing = convertTicketmasterEventToListing(event, CITY.name);
      if (!listing) continue;

      if (category === 'events' || category === 'live-music') {
        listing.category = category;
      }

      const listingUpserted = await upsertListing(listing);

      if (listingUpserted && listing.images && listing.images.length > 0) {
        await supabase.from('listing_photos').delete().eq('listing_id', listing.id);

        for (let i = 0; i < listing.images.length; i++) {
          const { error: photoError } = await supabase.from('listing_photos').insert({
            listing_id: listing.id,
            url: listing.images[i],
            sort_order: i,
          });
          if (photoError) {
            console.warn(`  ⚠️  Failed to insert photo for ${listing.id}:`, photoError.message);
          }
        }
      }

      totalUpserted++;
      await sleep(100); // Rate limiting
    } catch (error) {
      console.error(`  ❌ Error processing Ticketmaster event ${event.id}:`, error);
    }
  }
  return totalUpserted;
}

async function main() {
  console.log('🚀 Starting sync for Linköping, Sweden...\n');
  let totalListings = 0;

  for (const [category, config] of Object.entries(CATEGORY_CONFIGS)) {
    if (config.types) {
      totalListings += await syncGooglePlacesCategory(category, config.types);
    }
    if (config.useTicketmaster) {
      totalListings += await syncTicketmasterCategory(
        category,
        category === 'live-music' ? 'Music' : 'All'
      );
    }
  }

  console.log(`\n✅ Sync Complete! Total listings upserted: ${totalListings}`);
  console.log(`\n📍 Linköping is now available in the app!`);
}

main().catch(console.error);

