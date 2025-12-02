/* eslint-disable no-console */
/**
 * Comprehensive script to sync listings for all categories
 * Uses Google Places API for most categories and Ticketmaster API for events
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
const TICKETMASTER_KEY = process.env.TICKETMASTER_API_KEY;

if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) environment variable.');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// City configurations (removed Austin & Denver)
const CITIES = [
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, state: 'CA' },
  { name: 'Northern Virginia', lat: 38.8462, lng: -77.3064, state: 'VA' },
  { name: 'Linköping', lat: 58.4108, lng: 15.6214, state: 'Sweden' },
];

// Category configurations with Google Places types
const CATEGORY_CONFIGS: Record<string, { types: string[]; useTicketmaster?: boolean }> = {
  'museum': {
    types: ['museum', 'art_gallery'],
  },
  'events': {
    types: ['event_venue', 'stadium', 'amusement_park'],
    useTicketmaster: true, // Also use Ticketmaster for events
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
    useTicketmaster: true, // Also use Ticketmaster for live music events
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
};

// Default settings
const RADIUS = 50000; // 50km
const LIMIT_PER_CITY = 200;
const MIN_RATING = 3.0;
const MIN_REVIEWS = 10;
const TICKETMASTER_DAYS_AHEAD = 90; // Fetch events up to 90 days ahead

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Helper functions
function categoryFromTypes(types: string[] = []): string {
  const set = new Set(types);
  
  // Check each category config
  for (const [category, config] of Object.entries(CATEGORY_CONFIGS)) {
    if (config.types.some(type => set.has(type))) {
      return category;
    }
  }
  
  // Fallback mappings
  if (set.has('cafe') || set.has('coffee_shop')) return 'coffee';
  if (set.has('restaurant') || set.has('bakery')) return 'food';
  if (set.has('bar') || set.has('night_club')) return 'nightlife';
  if (set.has('park') || set.has('tourist_attraction')) return 'outdoors';
  
  return 'activities';
}

function priceFromLevel(level?: number | null): number | undefined {
  if (level == null) return undefined;
  if (level <= 0) return 1;
  if (level >= 4) return 4;
  return Math.max(1, Math.min(4, level));
}

function extractCity(addressComponents?: any[]): string | undefined {
  if (!Array.isArray(addressComponents)) return undefined;
  const byType = (t: string) => addressComponents.find((c) => (c.types || []).includes(t))?.long_name;
  return byType('locality') || byType('sublocality') || byType('postal_town') || byType('administrative_area_level_2');
}

function photoUrl(photoRef?: string): string | undefined {
  if (!photoRef) return undefined;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(photoRef)}&key=${encodeURIComponent(GOOGLE_KEY!)}`;
}

// Geocode city using Places Text Search
async function geocodeCity(q: string): Promise<{ lat: number; lng: number; city: string } | undefined> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', q);
  url.searchParams.set('key', GOOGLE_KEY!);
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' || !json.results?.[0]) {
    console.warn('TextSearch failed:', q, json.status);
    return undefined;
  }
  const r = json.results[0];
  return {
    lat: r.geometry?.location?.lat,
    lng: r.geometry?.location?.lng,
    city: r.formatted_address || r.name || q,
  };
}

// Fetch nearby places from Google Places API
async function fetchNearby(lat: number, lng: number, type: string): Promise<any[]> {
  const results: any[] = [];
  let pagetoken: string | undefined;
  let attempts = 0;
  
  do {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', String(RADIUS));
    url.searchParams.set('type', type);
    url.searchParams.set('key', GOOGLE_KEY!);
    if (pagetoken) url.searchParams.set('pagetoken', pagetoken);
    
    const res = await fetch(url);
    const json = await res.json();
    
    if (json.status === 'OK') {
      results.push(...(json.results || []));
      pagetoken = json.next_page_token;
      if (pagetoken) {
        await sleep(2000); // Wait for pagetoken to become valid
      }
    } else if (json.status === 'ZERO_RESULTS') {
      break;
    } else {
      console.warn(`Nearby search failed for ${type}:`, json.status, json.error_message);
      break;
    }
    
    attempts++;
  } while (pagetoken && attempts < 3);
  
  return results;
}

// Get place details from Google Places API
async function getPlaceDetails(placeId: string): Promise<any | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'place_id,name,formatted_address,geometry,rating,user_ratings_total,photos,types,price_level,opening_hours,website,phone_number,description,address_components');
  url.searchParams.set('key', GOOGLE_KEY!);
  
  const res = await fetch(url);
  const json = await res.json();
  
  if (json.status === 'OK' && json.result) {
    return json.result;
  }
  return null;
}

// Format date for Ticketmaster API (YYYY-MM-DDTHH:mm:ssZ without milliseconds)
function formatTicketmasterDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

// Fetch events from Ticketmaster
async function fetchTicketmasterEvents(
  lat: number,
  lng: number,
  radius: number,
  classificationName?: string
): Promise<any[]> {
  if (!isTicketmasterConfigured()) {
    console.warn('Ticketmaster API not configured, skipping events');
    return [];
  }

  try {
    const now = new Date();
    const future = new Date(Date.now() + TICKETMASTER_DAYS_AHEAD * 24 * 60 * 60 * 1000);
    
    const startDate = formatTicketmasterDate(now);
    const endDate = formatTicketmasterDate(future);

    const events = await searchTicketmasterEvents({
      lat,
      lng,
      radius,
      unit: 'km',
      startDateTime: startDate,
      endDateTime: endDate,
      classificationName,
      size: 200, // Max per request
    });

    return events || [];
  } catch (error) {
    console.error('Error fetching Ticketmaster events:', error);
    return [];
  }
}

// Process and upsert a listing
async function upsertListing(listing: any): Promise<boolean> {
  try {
    // Remove fields that don't exist in listings table
    const { images, tags, ...listingData } = listing;
    
    const { error } = await supabase.from('listings').upsert(listingData, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error(`Failed to upsert ${listing.id}:`, error.message);
      return false;
    } else {
      console.log(`✓ Upserted: ${listing.title} (${listing.category})`);
      return true;
    }
  } catch (error: any) {
    console.error(`Error upserting ${listing.id}:`, error.message);
    return false;
  }
}

// Sync Google Places listings for a category
async function syncGooglePlacesCategory(
  city: { name: string; lat: number; lng: number },
  category: string,
  types: string[]
): Promise<number> {
  console.log(`\n📍 Syncing ${category} for ${city.name}...`);
  let totalUpserted = 0;
  const seenPlaceIds = new Set<string>();

  for (const type of types) {
    console.log(`  Searching for type: ${type}`);
    const places = await fetchNearby(city.lat, city.lng, type);
    
    // Filter by rating and reviews
    const filtered = places.filter(
      (p: any) =>
        (p.rating || 0) >= MIN_RATING &&
        (p.user_ratings_total || 0) >= MIN_REVIEWS &&
        !seenPlaceIds.has(p.place_id)
    );

    console.log(`  Found ${filtered.length} places matching criteria`);

    // Process up to LIMIT_PER_CITY places
    for (const place of filtered.slice(0, LIMIT_PER_CITY)) {
      if (seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);

      const details = await getPlaceDetails(place.place_id);
      if (!details) continue;

      // Determine category from types
      const finalCategory = categoryFromTypes(details.types || []);
      
      // Skip if category doesn't match (unless it's a general category)
      if (finalCategory !== category && category !== 'activities') {
        continue;
      }

      // Get photos (up to 5)
      const photos = (details.photos || [])
        .slice(0, 5)
        .map((p: any) => photoUrl(p.photo_reference))
        .filter(Boolean);

      const listing = {
        id: `gp_${details.place_id}`,
        title: details.name || 'Untitled',
        subtitle: details.formatted_address?.split(',')[0] || undefined,
        description: details.editorial_summary?.overview || details.description || undefined,
        category: finalCategory,
        price_tier: priceFromLevel(details.price_level),
        latitude: details.geometry?.location?.lat || city.lat,
        longitude: details.geometry?.location?.lng || city.lng,
        city: extractCity(details.address_components) || city.name,
        source: 'google_places' as const,
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

      const success = await upsertListing(listing);

      // Only insert photos if listing was successfully upserted
      if (success && photos.length > 0) {
        // Delete existing photos for this listing
        await supabase.from('listing_photos').delete().eq('listing_id', listing.id);
        
        // Insert new photos
        for (let i = 0; i < photos.length; i++) {
          const { error: photoError } = await supabase.from('listing_photos').insert({
            listing_id: listing.id,
            url: photos[i],
            sort_order: i,
          });
          if (photoError) {
            console.warn(`Failed to insert photo for ${listing.id}:`, photoError.message);
          }
        }
      }

      totalUpserted++;
      await sleep(100); // Rate limiting
    }

    await sleep(1000); // Rate limiting between types
  }

  return totalUpserted;
}

// Sync Ticketmaster events for a category
async function syncTicketmasterCategory(
  city: { name: string; lat: number; lng: number },
  category: string,
  classificationName?: string
): Promise<number> {
  if (!isTicketmasterConfigured()) {
    return 0;
  }

  console.log(`\n🎫 Syncing ${category} events from Ticketmaster for ${city.name}...`);

  const events = await fetchTicketmasterEvents(
    city.lat,
    city.lng,
    Math.floor(RADIUS / 1000), // Convert to km
    classificationName
  );

  console.log(`  Found ${events.length} events`);

  let totalUpserted = 0;

  for (const event of events) {
    try {
      const listingData = convertTicketmasterEventToListing(event, city.name);
      if (!listingData) continue;

      // Override category if needed
      if (category === 'events' || category === 'live-music') {
        listingData.category = category;
      }

      // Extract images and tags before upserting (these fields don't exist in listings table)
      const images = listingData.images || [];
      const tags = listingData.tags || [];
      const { images: _, tags: __, ...listing } = listingData; // Remove images and tags fields

      const success = await upsertListing(listing);

      // Only insert photos if listing was successfully upserted
      if (success && images.length > 0) {
        // Delete existing photos for this listing
        await supabase.from('listing_photos').delete().eq('listing_id', listing.id);
        
        // Insert new photos
        for (let i = 0; i < images.length; i++) {
          const { error: photoError } = await supabase.from('listing_photos').insert({
            listing_id: listing.id,
            url: images[i],
            sort_order: i,
          });
          if (photoError) {
            console.warn(`Failed to insert photo for ${listing.id}:`, photoError.message);
          }
        }
      }

      // Note: Tags would need to be inserted into listing_tags table if needed
      // This requires tag IDs from the tags table, which is more complex

      totalUpserted++;
      await sleep(100); // Rate limiting
    } catch (error: any) {
      console.error(`Error processing event ${event.id}:`, error.message);
    }
  }

  return totalUpserted;
}

// Main sync function
async function syncAllCategories() {
  console.log('🚀 Starting comprehensive category sync...\n');
  console.log(`Cities: ${CITIES.map(c => c.name).join(', ')}`);
  console.log(`Categories: ${Object.keys(CATEGORY_CONFIGS).join(', ')}\n`);

  let totalUpserted = 0;

  for (const city of CITIES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏙️  Processing ${city.name}, ${city.state}`);
    console.log('='.repeat(60));

    for (const [category, config] of Object.entries(CATEGORY_CONFIGS)) {
      try {
        // Sync from Google Places
        const googleCount = await syncGooglePlacesCategory(city, category, config.types);
        totalUpserted += googleCount;

        // Also sync from Ticketmaster if configured
        if (config.useTicketmaster && isTicketmasterConfigured()) {
          const ticketmasterCount = await syncTicketmasterCategory(
            city,
            category,
            category === 'live-music' ? 'Music' : undefined
          );
          totalUpserted += ticketmasterCount;
        }

        await sleep(2000); // Rate limiting between categories
      } catch (error: any) {
        console.error(`Error syncing ${category} for ${city.name}:`, error.message);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Sync complete! Total listings upserted: ${totalUpserted}`);
  console.log('='.repeat(60));
}

// Run the sync
syncAllCategories().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

