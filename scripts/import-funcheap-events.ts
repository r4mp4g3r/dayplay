#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Import Funcheap SF events into Supabase from RSS
 *
 * Usage:
 *   tsx scripts/import-funcheap-events.ts [--dry] [--limit 200]
 *
 * Environment:
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE
 *   FUNCHEAP_FEED_URL (optional, defaults to FeedBurner recent events feed)
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import { createClient } from '@supabase/supabase-js';

// ---------- CLI & Config ----------

const ARGV = process.argv.slice(2);
const DRY_FLAG = ARGV.includes('--dry');

const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

const FEED_URL =
  process.env.FUNCHEAP_FEED_URL ||
  'https://feeds.feedburner.com/funcheapsf_recent_added_events/';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!FEED_URL) {
  throw new Error('FUNCHEAP_FEED_URL is not set');
}

let supabase: ReturnType<typeof createClient> | null = null;
if (!DRY_FLAG) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

// ---------- Types ----------

type RssItem = {
  title?: string;
  link?: string;
  guid?: string | { '#text'?: string };
  pubDate?: string;
  description?: string;
  category?: string | string[];
};

// ---------- Helpers ----------

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const DEFAULT_EVENT_DURATION_HOURS = 2;

function coerceGuid(item: RssItem): string | undefined {
  if (!item.guid) return undefined;
  if (typeof item.guid === 'string') return item.guid;
  if (typeof item.guid['#text'] === 'string') return item.guid['#text'];
  return undefined;
}

function buildExternalId(item: RssItem): string | undefined {
  const guid = coerceGuid(item);
  const link = item.link;
  const base = guid || link;
  if (!base) return undefined;
  return base.trim();
}

function parseEventDates(item: RssItem, title?: string): { start: Date; end: Date } {
  const now = new Date();

  // 1) Prefer explicit date encoded in the title, e.g. "1/3/26: ..."
  if (title) {
    const m = title.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})/);
    if (m) {
      const month = Number(m[1]); // 1–12
      const day = Number(m[2]);
      const year = 2000 + Number(m[3]); // "26" -> 2026
      if (
        Number.isFinite(month) &&
        Number.isFinite(day) &&
        Number.isFinite(year) &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        // Use 6:00 PM local time as a reasonable default
        const startFromTitle = new Date(year, month - 1, day, 18, 0, 0, 0);
        const endFromTitle = new Date(
          startFromTitle.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000,
        );
        return { start: startFromTitle, end: endFromTitle };
      }
    }
  }

  // 2) Fallback to pubDate from the RSS feed
  let start: Date;
  if (item.pubDate) {
    const parsed = new Date(item.pubDate);
    if (!Number.isNaN(parsed.getTime())) {
      start = parsed;
    } else {
      start = now;
    }
  } else {
    start = now;
  }

  const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);
  return { start, end };
}

function decodeEntities(text: string): string {
  let out = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  // Decode numeric entities like &#038; or &#x2019;
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

function stripHtml(html?: string): string | undefined {
  if (!html) return undefined;
  // Strip tags then decode entities
  const noTags = html.replace(/<[^>]*>/g, ' ');
  let text = decodeEntities(noTags);

  // Remove Funcheap boilerplate like:
  // "The post ... appeared first on Funcheap ."
  text = text.replace(/\s*The post\s+.+?\s+appeared first on\s+Funcheap\s*\./i, '');

  return text.trim();
}

function deriveTags(item: RssItem, plainDescription?: string): string[] {
  const tags = new Set<string>();
  const categories = item.category;
  const text = `${item.title || ''} ${plainDescription || ''}`.toLowerCase();

  if (typeof categories === 'string') tags.add(categories);
  if (Array.isArray(categories)) categories.forEach((c) => tags.add(c));

  if (text.includes('free')) tags.add('free');
  if (text.includes('family') || text.includes('kids')) tags.add('family_friendly');
  if (text.includes('music') || text.includes('concert')) tags.add('music');
  if (text.includes('outdoor') || text.includes('park')) tags.add('outdoors');

  return Array.from(tags).slice(0, 10);
}

// ---------- Google Places helpers (optional enrichment) ----------

type LatLng = { lat: number; lng: number };

async function textSearch(query: string, coords: LatLng): Promise<any | null> {
  if (!GOOGLE_KEY) return null;
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', query);
  url.searchParams.set('location', `${coords.lat},${coords.lng}`);
  url.searchParams.set('radius', String(80000)); // ~80km around SF
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
  if (!supabase) return true; // dry-run mode

  const { images, ...listingToUpsert } = listing;
  const { error } = await (supabase as any).from('listings').upsert(listingToUpsert, {
    onConflict: 'id',
    ignoreDuplicates: false,
  });

  if (error) {
    console.error('  ❌ Upsert failed:', error.message);
    return false;
  }

  return true;
}

// ---------- Main ----------

async function main() {
  const limitMatch = ARGV.join(' ').match(/--limit\s+(\d+)/);
  const LIMIT = limitMatch ? parseInt(limitMatch[1], 10) : 200;

  console.log(`\n🚀 Importing Funcheap events from ${FEED_URL}${DRY_FLAG ? ' [DRY RUN]' : ''}`);

  const res = await fetch(FEED_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch feed: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: 'text',
  });

  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel;
  let items: RssItem[] = [];

  if (Array.isArray(channel?.item)) {
    items = channel.item as RssItem[];
  } else if (channel?.item) {
    items = [channel.item as RssItem];
  }

  console.log(`📥 Fetched ${items.length} items from RSS`);

  let processed = 0;
  let success = 0;
  let skipped = 0;

  for (const item of items.slice(0, LIMIT)) {
    processed++;

    const externalId = buildExternalId(item);
    if (!externalId) {
      console.warn('  ⚠️  Skipping item without guid/link:', item.title);
      skipped++;
      continue;
    }

    const rawTitle = (item.title || '').trim();
    const title = decodeEntities(rawTitle);
    if (!title) {
      console.warn('  ⚠️  Skipping item without title');
      skipped++;
      continue;
    }

    const { start, end } = parseEventDates(item, title);
    const plainDescription = stripHtml(item.description);
    const tags = deriveTags(item, plainDescription);

    // Try to geocode the real venue using Google Places (if configured)
    let subtitle = 'San Francisco Bay Area';
    let latitude = SF_LAT;
    let longitude = SF_LNG;
    let googleMeta: any = undefined;

    if (GOOGLE_KEY) {
      try {
        const coreTitle = title
          .replace(/^\d{1,2}\/\d{1,2}\/\d{2}:\s*/, '')
          .replace(/\s*-\s*FREE$/i, '')
          .trim();

        const query = `${coreTitle} Bay Area`;
        const ts = await textSearch(query, { lat: SF_LAT, lng: SF_LNG });
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
      } catch (e: any) {
        console.warn(
          '  ⚠️  Google enrichment failed for',
          title,
          '-',
          e?.message || e,
        );
      }
    }

    const listing = {
      id: `funcheap_${externalId}`,
      title,
      subtitle,
      description: plainDescription,
      category: 'events',
      price_tier: undefined,
      latitude,
      longitude,
      city: 'San Francisco',
      source: 'funcheap',
      external_id: externalId,
      event_start_date: start.toISOString(),
      event_end_date: end.toISOString(),
      source_metadata: {
        feed: 'funcheap',
        original_pub_date: item.pubDate,
        link: item.link,
        guid: coerceGuid(item),
        categories: item.category,
        google: googleMeta,
      },
      is_published: true,
      last_synced_at: new Date().toISOString(),
      tags,
    };

    if (DRY_FLAG) {
      console.log(`  [DRY] ${listing.title} – ${listing.event_start_date} (${tags.join(', ')})`);
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
  console.log('📊 Funcheap import summary');
  console.log('='.repeat(50));
  console.log(`Processed: ${processed}`);
  console.log(`Imported:  ${success}`);
  console.log(`Skipped:   ${skipped}`);
  console.log('='.repeat(50) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


