/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// Read argv first so we can honor --dry before env validation
const ARGV = process.argv.slice(2);
const DRY_FLAG = ARGV.includes('--dry');

// ---------- Config ----------
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!GOOGLE_KEY) throw new Error('Missing GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY)');

// Only require Supabase when not running in --dry mode
let supabase: ReturnType<typeof createClient> | null = null;
if (!DRY_FLAG) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

// ---------- Helpers ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const u = new URL(withProto);
    return u.host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Map section headings in the PDF to our internal category slugs
const CATEGORY_MAP: Record<string, string> = {
  'museums': 'museum',
  'games & entertainment': 'games-entertainment',
  'games & entertainment spots (name + address)': 'games-entertainment',
  'games and entertainment': 'games-entertainment',
  'games and entertainment spots': 'games-entertainment',
  'arts & culture': 'arts-culture',
  'arts and culture': 'arts-culture',
  'live music': 'live-music',
  'relax & recharge': 'relax-recharge',
  'relax and recharge': 'relax-recharge',
  'sports & recreation': 'sports-recreation',
  'sports and recreation': 'sports-recreation',
  'drinks & bars': 'drinks-bars',
  'drinks and bars': 'drinks-bars',
  'pet-friendly': 'pet-friendly',
  'pet friendly': 'pet-friendly',
  'road trip getaways': 'road-trip-getaways',
  'festivals & pop-ups': 'festivals-pop-ups',
  'festivals and pop-ups': 'festivals-pop-ups',
  'fitness & classes': 'fitness-classes',
  'fitness and classes': 'fitness-classes',
  'shopping': 'shopping',
  'coffee': 'coffee',
  'coffee shops and cafes': 'coffee',
  'coffee shops & cafes': 'coffee',
  'nightlife': 'nightlife',
  'sf nightlife': 'nightlife',
  'outdoors': 'outdoors',
  'activities': 'activities',
  'food': 'food',
};

function normalizeHeading(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseLines(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, ' ').trim())
    .filter((l) => l.length > 0);

  const out: Array<{ name: string; address: string; category?: string }> = [];
  let currentCategory: string | undefined;

  for (const raw of lines) {
    const l = raw.replace(/^\d+\.?\s*/, '');

    const key = normalizeHeading(l);
    if (CATEGORY_MAP[key]) {
      currentCategory = CATEGORY_MAP[key];
      continue;
    }
    // Fuzzy heading detection: if a line contains the heading words (helps with PDF formatting)
    for (const [h, slug] of Object.entries(CATEGORY_MAP)) {
      const hNorm = normalizeHeading(h);
      if (key.includes(hNorm) && Math.abs(key.length - hNorm.length) < 10) {
        currentCategory = slug;
        continue;
      }
    }

    // Split on em-dash (—), en-dash (-), or pipe (|) with surrounding whitespace
    const parts = l.split(/\s+[—|\-|]\s+/);
    if (parts.length >= 2) {
      const name = parts[0].trim();
      let address = parts.slice(1).join(' - ').trim();
      
      // Strip source citations that break Google Places matching
      // Match pattern: address ends with capitalized word(s) optionally followed by +number
      // Examples: "...CA 94111 Stacker+1", "...CA 94102 Society of Behavioral Medicine (SBM)"
      
      // First, remove anything after the last occurrence of a CA zip code pattern
      const zipMatch = address.match(/(.*\b(?:CA|California)\s+\d{5}(?:-\d{4})?)/);
      if (zipMatch) {
        address = zipMatch[1].trim();
      }
      
      if (name && address) out.push({ name, address, category: currentCategory });
    }
  }

  return out;
}

async function geocodeCity(q: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data.results?.[0];
    if (r?.geometry?.location) return { lat: r.geometry.location.lat, lng: r.geometry.location.lng };
  } catch {}
  return null;
}

async function textSearch(query: string, coords?: { lat: number; lng: number }): Promise<any | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  if (coords) {
    url.searchParams.set('location', `${coords.lat},${coords.lng}`);
    url.searchParams.set('radius', String(50000));
  }
  url.searchParams.set('key', GOOGLE_KEY!);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status === 'OK' && data.results && data.results.length) return data.results[0];
  return null;
}

async function placeDetails(placeId: string): Promise<any | null> {
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
    'address_components',
  ].join(',');
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.result) return data.result;
  return null;
}

function photoUrl(ref?: string): string | null {
  if (!ref) return null;
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_KEY}`;
}

function extractCityFromComponents(components?: any[]): string | undefined {
  if (!Array.isArray(components)) return undefined;
  const byType = (t: string) => components.find((c) => (c.types || []).includes(t))?.long_name;
  return (
    byType('locality') ||
    byType('sublocality') ||
    byType('postal_town') ||
    byType('administrative_area_level_2') ||
    byType('administrative_area_level_1')
  );
}

function categoryFromTypes(types: string[] = []): string | undefined {
  const set = new Set(types);
  
  // Relax & Recharge
  if (set.has('spa') || set.has('beauty_salon') || set.has('hair_care') || set.has('massage') || set.has('sauna')) {
    return 'relax-recharge';
  }
  
  // Fitness & Classes
  if (set.has('yoga_studio') || set.has('fitness_center') || set.has('gym') || set.has('pilates_studio') || set.has('sports_club')) {
    return 'fitness-classes';
  }
  
  // Road Trip Getaways
  if (set.has('natural_feature') || set.has('campground') || set.has('rv_park') || set.has('beach') || set.has('locality') || set.has('sublocality')) {
    return 'road-trip-getaways';
  }
  
  // Other categories
  if (set.has('cafe') || set.has('coffee_shop')) return 'coffee';
  if (set.has('restaurant') || set.has('bakery')) return 'food';
  if (set.has('bar') || set.has('night_club')) return 'nightlife';
  if (set.has('museum') || set.has('art_gallery')) return 'museum';
  if (set.has('shopping_mall') || set.has('clothing_store') || set.has('store')) return 'shopping';
  if (set.has('amusement_center') || set.has('bowling_alley') || set.has('arcade')) return 'games-entertainment';
  if (set.has('music_venue')) return 'live-music';
  if (set.has('park') || set.has('tourist_attraction')) return 'outdoors';
  
  return undefined;
}

async function upsertListing(listing: any, photos: string[]) {
  if (!supabase) return true; // dry mode or no client
  const { images, ...listingToUpsert } = listing; // keep id in payload
  const { error } = await (supabase as any).from('listings').upsert(listingToUpsert, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });
  if (error) {
    console.error('Upsert failed:', error.message);
    return false;
  }
  if (photos.length) {
    await (supabase as any).from('listing_photos').delete().eq('listing_id', listing.id);
    for (let i = 0; i < photos.length; i++) {
      const { error: pErr } = await (supabase as any).from('listing_photos').insert({
        listing_id: listing.id,
        url: photos[i],
        sort_order: i,
      });
      if (pErr) console.warn('Photo insert failed:', pErr.message);
    }
  }
  return true;
}

async function main() {
  const pdfPath = path.resolve('San Francisco spot location addresses .pdf');
  const CITY = 'San Francisco, CA';
  const DRY = DRY_FLAG;
  const limitMatch = ARGV.join(' ').match(/--limit\s+(\d+)/);
  const LIMIT = limitMatch ? parseInt(limitMatch[1], 10) : 999999;

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const parsed = await pdf(buffer);
  const rows = parseLines(parsed.text);

  const coords = await geocodeCity(CITY);

  console.log(`Parsed ${rows.length} rows from SF PDF. City bias: ${CITY}${DRY ? ' [dry-run]' : ''}`);

  let processed = 0;
  for (const row of rows.slice(0, LIMIT)) {
    const query = `${row.name} ${row.address} ${CITY}`;
    try {
      const ts = await textSearch(query, coords || undefined);
      if (!ts || !ts.place_id) {
        console.warn('No match:', row.name, '-', row.address);
        await sleep(120);
        continue;
      }
      const det = await placeDetails(ts.place_id);
      if (!det) {
        console.warn('No details:', row.name);
        await sleep(120);
        continue;
      }

      const photos = (det.photos || [])
        .slice(0, 5)
        .map((p: any) => photoUrl(p.photo_reference))
        .filter(Boolean) as string[];

      // TRUST the PDF category assignment first, only use Google types as fallback
      const fromTypes = categoryFromTypes(det.types || []);
      
      // If the PDF specified a category, use it. Otherwise derive from Google types.
      let finalCategory = row.category || fromTypes || 'activities';

      const extractedCity = extractCityFromComponents(det.address_components);

      const listing = {
        id: `gp_${det.place_id}`,
        title: det.name || row.name,
        subtitle: det.formatted_address?.split(',')[0] || undefined,
        description: undefined,
        category: finalCategory,
        price_tier: det.price_level != null ? Math.min(4, Math.max(1, det.price_level + 1)) : undefined,
        latitude: det.geometry?.location?.lat,
        longitude: det.geometry?.location?.lng,
        city: extractedCity || CITY.split(',')[0],
        source: 'google_places',
        external_id: det.place_id,
        hours: det.opening_hours?.weekday_text?.join('; '),
        phone: det.formatted_phone_number || det.international_phone_number || undefined,
        website: det.website || undefined,
        is_published: true,
        source_metadata: {
          rating: det.rating,
          user_ratings_total: det.user_ratings_total,
          types: det.types || [],
        },
        last_synced_at: new Date().toISOString(),
      };

      if (DRY) {
        console.log(`[dry] ${listing.title} → ${listing.category} (from PDF: ${row.category || 'none'})`);
      } else {
        const ok = await upsertListing(listing, photos);
        if (ok) console.log(`✓ Upserted: ${listing.title} → ${listing.category}`);
      }

      processed++;
      await sleep(150);
    } catch (e: any) {
      console.error('Error for', row.name, e.message);
      await sleep(200);
    }
  }

  console.log(`Done. Processed ${processed}/${Math.min(rows.length, LIMIT)} entries.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

