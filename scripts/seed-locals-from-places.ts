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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = parseArgs(process.argv.slice(2));

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEED_USER_ID = (process.env.SEED_USER_ID || args['user-id']) as string | undefined;

if (!GOOGLE_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY) environment variable.');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}
if (!SEED_USER_ID) {
  console.error('Missing SEED_USER_ID (or pass --user-id <uuid>) for the submitter user id.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const LAT = toNumber(args.lat as string | undefined, 30.2672); // Austin default
const LNG = toNumber(args.lng as string | undefined, -97.7431);
const RADIUS = toNumber(args.radius as string | undefined, 5000); // meters
const LIMIT = toNumber(args.limit as string | undefined, 25);
const TYPES = (args.types ? String(args.types).split(',') : ['cafe', 'restaurant', 'bar', 'park', 'museum', 'tourist_attraction']).map((t) => t.trim());
const MIN_RATING = toNumber(args.minRating as string | undefined, 4.5);
const MIN_REVIEWS = toNumber(args.minReviews as string | undefined, 50);

type NearbyResult = {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
};

type PlaceDetails = {
  result?: any;
  status: string;
};

function categoryFromTypes(types: string[] = []): string {
  const set = new Set(types);
  if (set.has('cafe') || set.has('coffee_shop')) return 'coffee';
  if (set.has('restaurant') || set.has('bakery')) return 'food';
  if (set.has('bar') || set.has('night_club')) return 'nightlife';
  if (set.has('park') || set.has('tourist_attraction') || set.has('hiking_area') || set.has('beach')) return 'outdoors';
  if (set.has('museum') || set.has('art_gallery')) return 'museum';
  if (set.has('shopping_mall') || set.has('clothing_store') || set.has('store')) return 'shopping';
  return 'activities';
}

function priceFromLevel(level?: number | null): number | undefined {
  if (level == null) return undefined;
  // Google: 0 (free) to 4 (very expensive); our app: 1-4
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

async function fetchNearby(type: string): Promise<NearbyResult[]> {
  const results: NearbyResult[] = [];
  let pagetoken: string | undefined;
  let attempts = 0;
  do {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${LAT},${LNG}`);
    url.searchParams.set('radius', String(RADIUS));
    url.searchParams.set('type', type);
    url.searchParams.set('key', GOOGLE_KEY!);
    if (pagetoken) url.searchParams.set('pagetoken', pagetoken);
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      if (json.status === 'INVALID_REQUEST' && attempts < 5) {
        attempts++;
        await sleep(2000);
        continue;
      }
      console.warn('Nearby search status:', json.status, json.error_message);
      break;
    }
    results.push(...(json.results || []));
    pagetoken = json.next_page_token;
    if (pagetoken) await sleep(2000);
  } while (pagetoken && results.length < LIMIT * 3);
  return results;
}

async function fetchDetails(placeId: string): Promise<PlaceDetails['result'] | undefined> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set(
    'fields',
    [
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

async function main() {
  console.log('Seeding Locals’ Favorites from Google Places…');
  console.log(`Location: ${LAT},${LNG} | radius ${RADIUS}m | min rating ${MIN_RATING}+ | min reviews ${MIN_REVIEWS}+`);

  const nearbyAll: NearbyResult[] = [];
  for (const t of TYPES) {
    const chunk = await fetchNearby(t);
    nearbyAll.push(...chunk);
  }

  // Dedupe by place_id
  const byId = new Map<string, NearbyResult>();
  for (const r of nearbyAll) {
    if (!byId.has(r.place_id)) byId.set(r.place_id, r);
  }

  // Filter by rating
  const filtered = Array.from(byId.values())
    .filter((r) => (r.rating || 0) >= MIN_RATING && (r.user_ratings_total || 0) >= MIN_REVIEWS)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
    .slice(0, LIMIT);

  console.log(`Found ${filtered.length} candidates. Fetching details…`);

  let inserted = 0;
  for (const r of filtered) {
    const d = await fetchDetails(r.place_id);
    if (!d) continue;
    const lat = d.geometry?.location?.lat;
    const lng = d.geometry?.location?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    const cat = categoryFromTypes(d.types || []);
    // Skip duplicates by (name + address) if already present
    const { data: existingRows, error: existErr } = await supabase
      .from('locals_favorites')
      .select('id')
      .eq('name', d.name)
      .eq('address', d.formatted_address)
      .limit(1);
    if (!existErr && existingRows && existingRows.length > 0) {
      console.log(`• Skipped existing: ${d.name}`);
      continue;
    }
    const fav = {
      user_id: SEED_USER_ID!,
      name: d.name as string,
      category: cat,
      description: d.editorial_summary?.overview as string | undefined,
      latitude: lat,
      longitude: lng,
      address: d.formatted_address as string | undefined,
      city: extractCity(d.address_components),
      photo_url: photoUrl(d.photos?.[0]?.photo_reference),
      hours: Array.isArray(d.opening_hours?.weekday_text) ? (d.opening_hours.weekday_text as string[]).join('\n') : undefined,
      price_tier: priceFromLevel(d.price_level as number | undefined),
      website: d.website as string | undefined,
      tags: (d.types || []).slice(0, 6),
      vibes: ['hidden-gem'],
      status: 'approved',
    };
    const { error } = await supabase.from('locals_favorites').insert(fav);
    if (error) {
      console.warn('Insert failed for', d.name, error.message);
      continue;
    }
    inserted++;
    console.log(`✓ Inserted: ${d.name}`);
  }

  console.log(`Done. Inserted ${inserted} favorites.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


