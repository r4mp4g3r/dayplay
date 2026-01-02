#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Import events into Supabase using SerpApi Google Events API.
 *
 * Docs: https://serpapi.com/google-events-api
 *
 * Usage examples:
 *   tsx scripts/import-google-events.ts --city "San Francisco" --country us --limit 100
 *   tsx scripts/import-google-events.ts --query "Events in San Francisco" --limit 50 --dry
 *
 * Environment:
 *   SERPAPI_API_KEY             (required)
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE
 *   GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY (optional, for geocoding venue)
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// ---------- CLI & Config ----------

const ARGV = process.argv.slice(2);
const DRY_FLAG = ARGV.includes('--dry');

function getArg(flag: string, fallback?: string): string | undefined {
  const idx = ARGV.indexOf(flag);
  if (idx !== -1 && idx + 1 < ARGV.length) return ARGV[idx + 1];
  return fallback;
}

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

if (!SERPAPI_API_KEY) {
  throw new Error('SERPAPI_API_KEY (or SERP_API_KEY) is required to use Google Events API');
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Query parameters
const DEFAULT_CITY = 'San Francisco';
const DEFAULT_COUNTRY = 'us';

const userQuery = getArg('--query');
const CITY = getArg('--city', DEFAULT_CITY);
const COUNTRY = getArg('--country', DEFAULT_COUNTRY);

// If user did not pass a custom query, build "Events in {city}"
const QUERY = userQuery || `Events in ${CITY}`;

const limitMatch = ARGV.join(' ').match(/--limit\s+(\d+)/);
const LIMIT = limitMatch ? parseInt(limitMatch[1], 10) : 200;

// ---------- Types ----------

type GoogleEventDate = {
  start_date?: string;
  end_date?: string;
  when?: string;
};

type GoogleEvent = {
  title?: string;
  date?: GoogleEventDate;
  address?: string[]; // often venue line, city
  link?: string;
  description?: string;
  thumbnail?: string;
  image?: string;
  event_location_map?: {
    image?: string;
    link?: string;
  };
  venue?: {
    name?: string;
    rating?: number;
    reviews?: number;
    link?: string;
  };
};

type LatLng = { lat: number; lng: number };

// ---------- Helpers ----------

const FALLBACK_LAT = 37.7749;
const FALLBACK_LNG = -122.4194;
const DEFAULT_EVENT_DURATION_HOURS = 2;

function decodeEntities(text: string): string {
  let out = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  out = out.replace(/&#(\d+);/g, (_, code) => {
    const n = Number(code);
    return Number.isFinite(n) ? String.fromCharCode(n) : _;
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const n = parseInt(hex, 16);
    return Number.isFinite(n) ? String.fromCharCode(n) : _;
  });

  return out;
}

function parseEventDates(dateInfo?: GoogleEventDate): { start: Date; end: Date } {
  const now = new Date();

  // Try explicit ISO-ish dates first
  if (dateInfo?.start_date) {
    const d = new Date(dateInfo.start_date);
    if (!Number.isNaN(d.getTime())) {
      const end =
        dateInfo.end_date && !Number.isNaN(new Date(dateInfo.end_date).getTime())
          ? new Date(dateInfo.end_date)
          : new Date(d.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);
      return { start: d, end };
    }
  }

  // Try parsing the human "when" string
  if (dateInfo?.when) {
    const d = new Date(dateInfo.when);
    if (!Number.isNaN(d.getTime())) {
      const end = new Date(d.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);
      return { start: d, end };
    }
  }

  const end = new Date(now.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);
  return { start: now, end };
}

async function textSearch(query: string, coords: LatLng): Promise<any | null> {
  if (!GOOGLE_KEY) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', `${coords.lat},${coords.lng}`);
  url.searchParams.set('radius', String(80000));
  url.searchParams.set('key', GOOGLE_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.status === 'OK' && data.results && data.results.length) return data.results[0];
  return null;
}

async function placeDetails(placeId: string): Promise<any | null> {
  if (!GOOGLE_KEY) return null;
  const fields = [
    'name',
    'formatted_address',
    'geometry',
    'place_id',
    'types',
    'rating',
    'user_ratings_total',
  ].join(',');
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.result) return data.result;
  return null;
}

async function upsertListing(listing: any) {
  if (DRY_FLAG) return true;

  const { images, ...listingToUpsert } = listing;

  // Upsert into listings table
  const { error } = await (supabase as any).from('listings').upsert(listingToUpsert, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });

  if (error) {
    console.error('  ❌ Upsert failed:', error.message);
    return false;
  }

  // If we have image URLs from SerpApi, persist them into listing_photos
  if (images && Array.isArray(images) && images.length > 0) {
    try {
      // Clear existing photos for this listing
      await supabase
        .from('listing_photos')
        .delete()
        .eq('listing_id', listingToUpsert.id);

      const photos = images.map((url: string, index: number) => ({
        listing_id: listingToUpsert.id,
        url,
        sort_order: index,
      }));

      const { error: photoError } = await supabase
        .from('listing_photos')
        .insert(photos);

      if (photoError) {
        console.error(
          `  ⚠️  Failed to insert photos for ${listingToUpsert.title}:`,
          photoError.message,
        );
      }
    } catch (e: any) {
      console.error(
        `  ⚠️  Unexpected error while inserting photos for ${listingToUpsert.title}:`,
        e?.message || e,
      );
    }
  }

  return true;
}

function buildSerpApiUrl(): string {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_events');
  url.searchParams.set('q', QUERY);
  url.searchParams.set('api_key', SERPAPI_API_KEY!);
  // Let caller refine further in the future with extra flags if needed.
  return url.toString();
}

function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  } catch {
    // ignore
  }
  return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
}

// ---------- Main ----------

async function main() {
  console.log(
    `\n🚀 Importing Google Events via SerpApi for query "${QUERY}"${
      DRY_FLAG ? ' [DRY RUN]' : ''
    }`,
  );

  const url = buildSerpApiUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`SerpApi request failed: ${res.status} ${res.statusText}`);
  }
  const json: any = await res.json();

  const events: GoogleEvent[] = Array.isArray(json.events_results)
    ? json.events_results
    : [];

  console.log(`📥 Received ${events.length} events from SerpApi`);

  let processed = 0;
  let success = 0;
  let skipped = 0;

  for (const ev of events.slice(0, LIMIT)) {
    processed++;

    const link = ev.link || '';
    const titleRaw = (ev.title || '').trim();
    const title = decodeEntities(titleRaw);

    if (!link || !title) {
      console.warn('  ⚠️ Skipping event without link/title');
      skipped++;
      continue;
    }

    const { start, end } = parseEventDates(ev.date);

    // Address / city
    const addressLines = ev.address || [];
    const fullAddress = addressLines.join(', ');
    // Try to guess city; if none, fallback to configured CITY
    const lowerAddr = fullAddress.toLowerCase();
    const cityGuess =
      CITY ||
      (lowerAddr.includes('san francisco') ? 'San Francisco' : undefined) ||
      CITY;

    // Geocode venue if possible
    let subtitle = ev.venue?.name || cityGuess || 'Unknown venue';
    let latitude = FALLBACK_LAT;
    let longitude = FALLBACK_LNG;
    let googleMeta: any = undefined;

    if (GOOGLE_KEY) {
      try {
        const queryParts = [
          ev.venue?.name,
          fullAddress,
          cityGuess,
          COUNTRY && COUNTRY.toUpperCase(),
        ].filter(Boolean);
        const placeQuery = queryParts.join(' ');
        if (placeQuery) {
          const ts = await textSearch(placeQuery, { lat: FALLBACK_LAT, lng: FALLBACK_LNG });
          if (ts?.place_id) {
            const det = await placeDetails(ts.place_id);
            if (det?.geometry?.location) {
              latitude = det.geometry.location.lat;
              longitude = det.geometry.location.lng;
              subtitle =
                det.name || det.formatted_address?.split(',')[0] || subtitle;
              googleMeta = {
                place_id: det.place_id,
                formatted_address: det.formatted_address,
                types: det.types || [],
                rating: det.rating,
                user_ratings_total: det.user_ratings_total,
              };
            }
          }
        }
      } catch (e: any) {
        console.warn(
          '  ⚠️ Google enrichment failed for',
          title,
          '-',
          e?.message || e,
        );
      }
    }

    // Choose best image
    const imageUrl = ev.image || ev.thumbnail;

    const idSlug = slugFromUrl(link);
    const listing = {
      id: `google_events_${idSlug}`,
      title,
      subtitle,
      description: ev.description ? decodeEntities(ev.description) : undefined,
      category: 'events',
      latitude,
      longitude,
      city: cityGuess || CITY || 'San Francisco',
      source: 'google_events',
      external_id: link,
      event_start_date: start.toISOString(),
      event_end_date: end.toISOString(),
      source_metadata: {
        google_events: {
          raw_date: ev.date,
          address: ev.address,
          venue: ev.venue,
          event_location_map: ev.event_location_map,
          image: ev.image,
          thumbnail: ev.thumbnail,
        },
        google: googleMeta,
      },
      is_published: true,
      last_synced_at: new Date().toISOString(),
    };

    if (imageUrl) {
      (listing as any).images = [imageUrl];
    }

    if (DRY_FLAG) {
      console.log(
        `  [DRY] ${listing.title} @ ${listing.subtitle} – ${listing.event_start_date}`,
      );
      success++;
    } else {
      const ok = await upsertListing(listing);
      if (ok) {
        console.log(`  ✅ Upserted: ${listing.title}`);
        success++;
      } else {
        skipped++;
      }
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Google Events (SerpApi) import summary');
  console.log('='.repeat(50));
  console.log(`Query:     ${QUERY}`);
  console.log(`Processed: ${processed}`);
  console.log(`Imported:  ${success}`);
  console.log(`Skipped:   ${skipped}`);
  console.log('='.repeat(50) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


