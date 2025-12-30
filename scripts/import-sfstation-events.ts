#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Import SF Station events into Supabase from https://www.sfstation.com/calendar
 *
 * Usage:
 *   tsx scripts/import-sfstation-events.ts [--dry] [--limit 200]
 *
 * Notes:
 *   - This is a best-effort HTML scraper. If SF Station changes their markup,
 *     you may need to adjust the CSS selectors in the SELECTORS section.
 *   - Be respectful of their servers; this script only hits the main calendar
 *     page by default. You can add more URLs or paging if desired.
 *
 * Environment:
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE
 *   GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY (optional, for geocoding)
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// ---------- CLI & Config ----------

const ARGV = process.argv.slice(2);
const DRY_FLAG = ARGV.includes('--dry');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Calendar URLs to scrape
const CALENDAR_URLS = [
  'https://www.sfstation.com/calendar', // main calendar
  // You can add more filtered URLs here if desired.
];

// ---------- Types ----------

type RawEvent = {
  title: string;
  url: string;
  dateText?: string;
  venueName?: string;
  locationText?: string;
  blurb?: string;
  imageUrl?: string;
};

type LatLng = { lat: number; lng: number };

// ---------- Selectors ----------

/**
 * SF Station calendar markup:
 *
 * <div class="event-wrapper" itemscope itemtype="http://schema.org/Event">
 *   <div class="event-date hidden" itemprop="startDate" content="2025-12-29">2025-12-29</div>
 *   <div class="event-time hidden">7:15 pm - 9:00 pm</div>
 *   ...
 *   <h4>
 *     <a href="/haight-laughsbury-comedy-show-e2472489">
 *       <span itemprop="name">Haight Laughsbury Comedy Show</span>
 *     </a>
 *   </h4>
 *   <span itemprop="location" itemscope itemtype="http://schema.org/Place">
 *     at <span><a href="/oreillys-pub-b39009162"><span itemprop="name">O'Reilly's Pub</span></a></span>
 *     ...
 *     <span class="address hidden" itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">
 *       <span itemprop="streetAddress">1840 Haight Street</span>
 *       <span itemprop="addressLocality">San Francisco</span>,
 *       <span itemprop="addressRegion">CA</span>
 *     </span>
 *   </span>
 * </div>
 *
 * We scrape each `.event-wrapper` directly so we don't depend on
 * Angular or client-side JS.
 */

const EVENT_WRAPPER_SELECTOR = '.event-wrapper[itemscope][itemtype*="Event"]';
const DATE_SELECTOR = '.event-date[itemprop="startDate"], .event-date, time, .event-time';
const VENUE_SELECTOR =
  '[itemprop="location"] [itemprop="name"], .venue, .event-venue, .location strong';
const LOCATION_SELECTOR =
  '[itemprop="addressLocality"], .location, .neighborhood, .event-location';
const BLURB_SELECTOR = '.description, .event-description, .summary, .excerpt';

// ---------- Helpers ----------

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
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

function parseDateFromText(dateText?: string): { start?: Date; end?: Date } {
  if (!dateText) return {};
  const cleaned = dateText.replace(/\s+/g, ' ').trim();

  // Try a few common patterns, e.g. "Jan 3, 2026 6:00 pm", "January 3, 2026"
  const tryParse = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };

  let start = tryParse(cleaned);
  if (!start) {
    // Sometimes time is missing; try adding a default time.
    start = tryParse(`${cleaned} 6:00 pm`);
  }

  if (!start) return {};
  const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);
  return { start, end };
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

// ---------- Scraping ----------

async function scrapeCalendarPage(url: string): Promise<RawEvent[]> {
  console.log(`📄 Fetching calendar: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ⚠️ Failed to fetch calendar ${url}: ${res.status} ${res.statusText}`);
    return [];
  }
  const html = await res.text();
  const $ = cheerio.load(html);

  const events: RawEvent[] = [];
  const seen = new Set<string>();

  $(EVENT_WRAPPER_SELECTOR).each((_, el) => {
    const card = $(el);

    const titleLink =
      card.find('h4 a span[itemprop="name"]').first().closest('a') ||
      card.find('h4 a').first();

    const href = titleLink.attr('href') || '';
    let titleText =
      card.find('h4 a span[itemprop="name"]').first().text().trim() ||
      card.find('h4').first().text().trim() ||
      titleLink.text().trim();

    titleText = decodeEntities(titleText);

    if (!href || !titleText) return;

    // Skip obvious non-event CTAs, just in case
    if (/^add\s+event$/i.test(titleText)) return;

    const absoluteUrl = href.startsWith('http') ? href : new URL(href, url).toString();
    if (seen.has(absoluteUrl)) return;
    seen.add(absoluteUrl);

    // Date + time
    const dateAttr =
      card.find('.event-date[itemprop="startDate"]').first().attr('content') ||
      card.find('.event-date').first().attr('content') ||
      undefined;
    const timeText = card.find('.event-time').first().text().replace(/\s+/g, ' ').trim();
    const combinedDate =
      dateAttr && timeText ? `${dateAttr} ${timeText}` : dateAttr || timeText || undefined;

    const venueName =
      card.find(VENUE_SELECTOR).first().text().trim() || undefined;

    const locationText =
      card.find(LOCATION_SELECTOR).first().text().trim() || undefined;

    const blurb =
      card.find(BLURB_SELECTOR).first().text().trim() || undefined;

    // Event image (thumbnail)
    let imageUrl =
      card.find('img[itemprop="image"]').first().attr('src') ||
      card.find('img').first().attr('src') ||
      undefined;

    if (imageUrl) {
      // Make URL absolute
      imageUrl = imageUrl.startsWith('http') ? imageUrl : new URL(imageUrl, url).toString();
    }

    events.push({
      title: titleText,
      url: absoluteUrl,
      dateText: combinedDate,
      venueName,
      locationText,
      blurb,
      imageUrl,
    });
  });

  console.log(`  ➜ Parsed ${events.length} raw events from calendar`);
  return events;
}

// ---------- Main ----------

async function main() {
  const limitMatch = ARGV.join(' ').match(/--limit\s+(\d+)/);
  const LIMIT = limitMatch ? parseInt(limitMatch[1], 10) : 200;

  console.log(
    `\n🚀 Importing SF Station events from ${CALENDAR_URLS.length} calendar page(s)${
      DRY_FLAG ? ' [DRY RUN]' : ''
    }`,
  );

  const allRaw: RawEvent[] = [];
  for (const url of CALENDAR_URLS) {
    const events = await scrapeCalendarPage(url);
    allRaw.push(...events);
  }

  console.log(`📥 Total raw events scraped: ${allRaw.length}`);

  let processed = 0;
  let success = 0;
  let skipped = 0;

  for (const raw of allRaw.slice(0, LIMIT)) {
    processed++;

    const externalId = raw.url;
    if (!externalId || !raw.title) {
      console.warn('  ⚠️ Skipping item without URL/title');
      skipped++;
      continue;
    }

    // Parse date from dateText if available; otherwise leave undefined.
    const { start, end } = parseDateFromText(raw.dateText);
    const startDate = start ?? new Date(); // fallback to now if missing
    const endDate =
      end ??
      new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000);

    // Geocode venue if possible
    let subtitle = raw.venueName || 'San Francisco Bay Area';
    let latitude = SF_LAT;
    let longitude = SF_LNG;
    let googleMeta: any = undefined;

    if (GOOGLE_KEY) {
      try {
        const queryParts = [
          raw.venueName,
          raw.locationText,
          'San Francisco Bay Area',
        ].filter(Boolean);
        const query = queryParts.join(' ');
        if (query) {
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
        }
      } catch (e: any) {
        console.warn(
          '  ⚠️  Google enrichment failed for',
          raw.title,
          '-',
          e?.message || e,
        );
      }
    }

    const description = raw.blurb ? decodeEntities(raw.blurb) : undefined;

    // Use a slug derived from the URL for the primary id so that route params remain simple.
    const slugFromUrl = (url: string): string => {
      try {
        const u = new URL(url);
        const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
        const last = parts[parts.length - 1];
        if (last) return last;
      } catch {
        // ignore
      }
      return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    };

    const listing = {
      id: `sfstation_${slugFromUrl(externalId)}`,
      title: raw.title,
      subtitle,
      description,
      category: 'events',
      price_tier: undefined,
      latitude,
      longitude,
      city: 'San Francisco',
      source: 'sfstation',
      external_id: externalId,
      event_start_date: startDate.toISOString(),
      event_end_date: endDate.toISOString(),
      source_metadata: {
        sfstation: {
          calendar_url: externalId,
          date_text: raw.dateText,
          venue_name: raw.venueName,
          location_text: raw.locationText,
          image_url: raw.imageUrl,
        },
        google: googleMeta,
      },
      is_published: true,
      last_synced_at: new Date().toISOString(),
    };

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
  console.log('📊 SF Station import summary');
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


