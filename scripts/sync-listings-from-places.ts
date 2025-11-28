/* eslint-disable no-console */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

type ArgMap = Record<string, string | undefined>;

function parseArgs(argv: string[]): ArgMap {
  const map: ArgMap = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) {
        map[k] = v;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        map[k] = argv[++i];
      } else {
        map[k] = 'true';
      }
    }
  }
  return map;
}

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const args = parseArgs(process.argv.slice(2));

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

const TYPES = (args.types ? String(args.types).split(',') : ['cafe', 'restaurant', 'bar', 'park', 'museum', 'tourist_attraction']).map((t) => t.trim());
const RADIUS = toNumber(args.radius as string | undefined, 12000);
const LIMIT = toNumber(args.limit as string | undefined, 50); // per city
const MIN_RATING = toNumber(args.minRating as string | undefined, 4.0);
const MIN_REVIEWS = toNumber(args.minReviews as string | undefined, 20);
const CITIES = args.cities ? String(args.cities).split(';').map((c) => c.trim()).filter(Boolean) : [];
const COORDS = args.coords
  ? String(args.coords)
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const [latStr, lngStr] = pair.split(',').map((x) => x.trim());
        return { lat: toNumber(latStr, NaN), lng: toNumber(lngStr, NaN) };
      })
      .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
  : [];

type GeocodeResult = { lat: number; lng: number; city: string };
type NearbyResult = { place_id: string; name: string; rating?: number; user_ratings_total?: number };
type PlaceDetails = { result?: any; status: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function categoryFromTypes(types: string[] = []): string {
  const set = new Set(types);
  
  // New categories first (more specific)
  if (set.has('art_gallery') || set.has('museum') || set.has('cultural_center')) return 'arts-culture';
  if (set.has('night_club') || set.has('bar') || set.has('liquor_store') || set.has('brewery') || set.has('wine_bar')) return 'drinks-bars';
  if (set.has('gym') || set.has('stadium') || set.has('sports_complex') || set.has('basketball_court') || set.has('soccer_field')) return 'sports-recreation';
  if (set.has('spa') || set.has('beauty_salon') || set.has('hair_care')) return 'relax-recharge';
  if (set.has('amusement_center') || set.has('bowling_alley') || set.has('arcade') || set.has('movie_theater')) return 'games-entertainment';
  if (set.has('yoga_studio') || set.has('fitness_center') || set.has('pilates_studio')) return 'fitness-classes';
  
  // Festivals & Pop-ups: markets, fairs, event venues that host temporary events
  if (set.has('festival') || set.has('fair') || set.has('market') || set.has('farmer_market') || 
      set.has('flea_market') || set.has('event_venue') || set.has('convention_center')) return 'festivals-pop-ups';
  
  // Pet-friendly: zoos, dog parks, pet stores, and places that commonly allow pets
  // Note: Google Places doesn't have a direct "pet-friendly" flag, so we use heuristics
  if (set.has('zoo') || set.has('pet_store') || set.has('dog_park') || 
      (set.has('park') && (set.has('dog_park') || types.some(t => t.includes('dog') || t.includes('pet'))))) {
    return 'pet-friendly';
  }
  
  // Live music (specific venues)
  if (set.has('music_venue') || set.has('concert_hall') || set.has('performing_arts_theater')) return 'live-music';
  
  // Original categories
  if (set.has('cafe') || set.has('coffee_shop')) return 'coffee';
  if (set.has('restaurant') || set.has('bakery') || set.has('food')) return 'food';
  if (set.has('bar') || set.has('night_club')) return 'nightlife';
  if (set.has('park') || set.has('tourist_attraction') || set.has('hiking_area') || set.has('beach') || set.has('campground')) return 'outdoors';
  if (set.has('museum') || set.has('art_gallery')) return 'museum';
  if (set.has('shopping_mall') || set.has('clothing_store') || set.has('store') || set.has('shopping_center')) return 'shopping';
  if (set.has('event') || set.has('stadium') || set.has('amusement_park')) return 'events';
  
  // Road trip getaways (parks, scenic areas far from city)
  if (set.has('natural_feature') || set.has('rv_park') || set.has('campground')) return 'road-trip-getaways';
  
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

// Use Places Text Search to resolve a city center (avoids separate Geocoding API)
async function geocodeCity(q: string): Promise<GeocodeResult | undefined> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', q);
  url.searchParams.set('key', GOOGLE_KEY!);
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== 'OK' || !json.results?.[0]) {
    console.warn('TextSearch failed:', q, json.status, json.error_message || '');
    return undefined;
  }
  const r = json.results[0];
  const lat = r.geometry?.location?.lat;
  const lng = r.geometry?.location?.lng;
  const city = r.formatted_address || r.name || q;
  return { lat, lng, city };
}

async function fetchNearby(lat: number, lng: number, type: string): Promise<NearbyResult[]> {
  const results: NearbyResult[] = [];
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
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      if (json.status === 'INVALID_REQUEST' && attempts < 5) {
        attempts++;
        await sleep(1500);
        continue;
      }
      console.warn('Nearby search status:', json.status, json.error_message);
      break;
    }
    results.push(...(json.results || []));
    pagetoken = json.next_page_token;
    if (pagetoken) await sleep(1500);
  } while (pagetoken && results.length < LIMIT * 3);
  return results;
}

async function fetchDetails(placeId: string): Promise<PlaceDetails['result'] | undefined> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set(
    'fields',
    [
      'place_id',
      'name',
      'website',
      'formatted_address',
      'geometry',
      'opening_hours',
      'types',
      'rating',
      'user_ratings_total',
      'price_level',
      'photos',
      'address_components',
      'editorial_summary',
      'formatted_phone_number',
      'international_phone_number',
      'url',
    ].join(',')
  );
  url.searchParams.set('key', GOOGLE_KEY!);
  const res = await fetch(url);
  const json: PlaceDetails = await res.json();
  if (json.status !== 'OK') {
    console.warn('Details status:', json.status);
    return undefined;
  }
  return json.result;
}

async function upsertListingFromDetails(cityName: string, d: any, placeId: string) {
  const lat = d.geometry?.location?.lat;
  const lng = d.geometry?.location?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  const cat = categoryFromTypes(d.types || []);
  const id = `gp_${placeId}`;
  const city = extractCity(d.address_components) || cityName;
  const record = {
    id,
    title: d.name as string,
    subtitle: null,
    description: d.editorial_summary?.overview as string | null,
    category: cat,
    price_tier: priceFromLevel(d.price_level as number | undefined),
    latitude: lat,
    longitude: lng,
    city,
    source: 'google_places',
    external_id: placeId,
    source_metadata: {
      rating: d.rating,
      user_ratings_total: d.user_ratings_total,
      types: d.types,
      google_url: d.url,
    },
    last_synced_at: new Date().toISOString(),
    hours: Array.isArray(d.opening_hours?.weekday_text) ? (d.opening_hours.weekday_text as string[]).join('\n') : null,
    phone: d.formatted_phone_number || d.international_phone_number || null,
    website: d.website || null,
    is_published: true,
    is_featured: false,
  };

  const { error: upsertErr } = await supabase
    .from('listings')
    .upsert(record as any, { onConflict: 'id' });
  if (upsertErr) {
    console.warn('Upsert listings failed:', upsertErr.message);
    return false;
  }

  // Refresh photos - for events, fetch at least 4-5 photos
  const isEvent = !!d.event_start_date || (d.types || []).some((t: string) => 
    t.includes('event') || t.includes('festival') || t.includes('concert')
  );
  const photoLimit = isEvent ? 5 : 5; // Always fetch up to 5, but prioritize for events
  const photoRefs: string[] = (d.photos || []).map((p: any) => p.photo_reference).filter(Boolean).slice(0, photoLimit);
  const photos = photoRefs.map((ref, idx) => ({
    listing_id: id,
    url: photoUrl(ref)!,
    sort_order: idx,
  }));
  // Clear existing photos then insert
  await supabase.from('listing_photos').delete().eq('listing_id', id);
  if (photos.length > 0) {
    const { error: insErr } = await supabase.from('listing_photos').insert(photos as any);
    if (insErr) {
      console.warn('Insert photos failed:', insErr.message);
    }
  }

  return true;
}

async function syncCity(cityQuery: string) {
  const geo = await geocodeCity(cityQuery);
  if (!geo) {
    console.warn('Skipping city due to geocode failure:', cityQuery);
    return;
  }
  console.log(`Syncing ${cityQuery} → ${geo.city} at ${geo.lat},${geo.lng}`);
  const nearbyAll: NearbyResult[] = [];
  for (const t of TYPES) {
    const chunk = await fetchNearby(geo.lat, geo.lng, t);
    nearbyAll.push(...chunk);
  }
  // Deduplicate by place_id
  const map = new Map<string, NearbyResult>();
  for (const r of nearbyAll) if (!map.has(r.place_id)) map.set(r.place_id, r);

  // Filter by score thresholds
  const filtered = Array.from(map.values())
    .filter((r) => (r.rating || 0) >= MIN_RATING && (r.user_ratings_total || 0) >= MIN_REVIEWS)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
    .slice(0, LIMIT);

  console.log(`${geo.city}: ${filtered.length} candidates; fetching details & upserting…`);

  let upserts = 0;
  for (const r of filtered) {
    const d = await fetchDetails(r.place_id);
    if (!d) continue;
    const ok = await upsertListingFromDetails(geo.city, d, r.place_id);
    if (ok) upserts++;
  }
  console.log(`${geo.city}: upserted ${upserts} listings`);
}

async function syncLatLng(lat: number, lng: number, label?: string) {
  const cityLabel = label || `${lat.toFixed(4)},${lng.toFixed(4)}`;
  console.log(`Syncing coordinates ${cityLabel}`);
  const nearbyAll: NearbyResult[] = [];
  for (const t of TYPES) {
    const chunk = await fetchNearby(lat, lng, t);
    nearbyAll.push(...chunk);
  }
  const map = new Map<string, NearbyResult>();
  for (const r of nearbyAll) if (!map.has(r.place_id)) map.set(r.place_id, r);
  const filtered = Array.from(map.values())
    .filter((r) => (r.rating || 0) >= MIN_RATING && (r.user_ratings_total || 0) >= MIN_REVIEWS)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
    .slice(0, LIMIT);
  console.log(`${cityLabel}: ${filtered.length} candidates; fetching details & upserting…`);
  let upserts = 0;
  for (const r of filtered) {
    const d = await fetchDetails(r.place_id);
    if (!d) continue;
    const ok = await upsertListingFromDetails(cityLabel, d, r.place_id);
    if (ok) upserts++;
  }
  console.log(`${cityLabel}: upserted ${upserts} listings`);
}

async function main() {
  if (CITIES.length === 0 && COORDS.length === 0) {
    console.error('Provide cities via --cities "Austin, TX; New York, NY" or coordinates via --coords "30.2672,-97.7431;40.7128,-74.0060"');
    process.exit(1);
  }
  console.log('Starting Google Places sync for listings');
  if (CITIES.length > 0) {
    console.log('Cities:', CITIES.join(' | '));
    for (const city of CITIES) {
      await syncCity(city);
    }
  }
  if (COORDS.length > 0) {
    console.log('Coordinates:', COORDS.map(({ lat, lng }) => `${lat},${lng}`).join(' | '));
    for (const { lat, lng } of COORDS) {
      await syncLatLng(lat, lng);
    }
  }
  console.log('All cities processed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


