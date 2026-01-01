#!/usr/bin/env tsx
/**
 * Import locations from JSON file through Google Places API
 * Usage: tsx scripts/import-from-json.ts <input.json> [--dry] [--limit 500]
 */

/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'fs';
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

// ---------- Types ----------
interface LocationEntry {
  name: string;
  address: string;
}

interface LocationJSON {
  city: string;
  categories: Record<string, LocationEntry[]>;
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
    'editorial_summary',
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

async function upsertListing(listing: any, photos: string[]) {
  if (!supabase) return true; // dry mode or no client
  const { images, ...listingToUpsert } = listing; // keep id in payload
  const { error } = await (supabase as any).from('listings').upsert(listingToUpsert, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });
  if (error) {
    console.error('  ❌ Upsert failed:', error.message);
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
      if (pErr) console.warn('  ⚠️  Photo insert failed:', pErr.message);
    }
  }
  return true;
}

async function main() {
  const argv = ARGV;
  if (argv.length === 0) {
    console.log('Usage: tsx scripts/import-from-json.ts <input.json> [--dry] [--limit 500]');
    process.exit(1);
  }

  const jsonPath = argv[0];
  const DRY = DRY_FLAG;
  const limitMatch = argv.join(' ').match(/--limit\s+(\d+)/);
  const LIMIT = limitMatch ? parseInt(limitMatch[1], 10) : 999999;

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON file not found: ${jsonPath}`);
    process.exit(1);
  }

  const data: LocationJSON = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const CITY = data.city;

  console.log(`\n🚀 Importing locations for ${CITY}${DRY ? ' [DRY RUN]' : ''}`);
  console.log(`📂 Categories: ${Object.keys(data.categories).length}`);
  
  const coords = await geocodeCity(CITY);
  if (coords) {
    console.log(`📍 Geocoded ${CITY}: ${coords.lat}, ${coords.lng}`);
  }

  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  let processedTotal = 0;

  for (const [category, locations] of Object.entries(data.categories)) {
    console.log(`\n📂 ${category.toUpperCase()}: ${locations.length} locations`);
    
    let categorySuccess = 0;
    let categoryFailed = 0;

    for (const loc of locations) {
      stats.total++;
      processedTotal++;

      if (processedTotal > LIMIT) {
        console.log(`  ⏭️  Reached limit of ${LIMIT}, skipping remaining...`);
        stats.skipped++;
        continue;
      }

      const query = `${loc.name} ${loc.address}`;
      
      try {
        const ts = await textSearch(query, coords || undefined);
        if (!ts || !ts.place_id) {
          console.log(`  ❌ ${loc.name} - Not found on Google Places`);
          stats.failed++;
          categoryFailed++;
          await sleep(120);
          continue;
        }

        const det = await placeDetails(ts.place_id);
        if (!det) {
          console.log(`  ❌ ${loc.name} - No place details`);
          stats.failed++;
          categoryFailed++;
          await sleep(120);
          continue;
        }

        const photos = (det.photos || [])
          .slice(0, 7) // Get up to 7 photos
          .map((p: any) => photoUrl(p.photo_reference))
          .filter(Boolean) as string[];

        // TRUST JSON CATEGORY - do not override with Google types
        const finalCategory = category;

        const extractedCity = extractCityFromComponents(det.address_components);

        const listing = {
          id: `gp_${det.place_id}`,
          title: det.name || loc.name,
          subtitle: det.formatted_address?.split(',')[0] || undefined,
          description:
            det.editorial_summary?.overview ||
            det.formatted_address ||
            undefined,
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
          console.log(`  ✓ [DRY] ${listing.title} → ${listing.category} (${photos.length} photos)`);
        } else {
          const ok = await upsertListing(listing, photos);
          if (ok) {
            console.log(`  ✅ ${listing.title}`);
            stats.success++;
            categorySuccess++;
          } else {
            stats.failed++;
            categoryFailed++;
          }
        }

        await sleep(150); // Rate limiting
      } catch (e: any) {
        console.error(`  ❌ ${loc.name} - Error: ${e.message}`);
        stats.failed++;
        categoryFailed++;
        await sleep(200);
      }
    }

    console.log(`  📊 ${category}: ${categorySuccess} success, ${categoryFailed} failed`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total listings processed: ${stats.total}`);
  console.log(`✅ Successfully imported: ${stats.success}`);
  console.log(`❌ Failed: ${stats.failed}`);
  if (stats.skipped > 0) {
    console.log(`⏭️  Skipped (limit): ${stats.skipped}`);
  }
  console.log('='.repeat(60) + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

