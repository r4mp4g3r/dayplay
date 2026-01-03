import 'dotenv/config';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// --- Configuration ---
const TARGET_URLS = [
  { 
    id: 'dothebay_today', 
    url: 'https://dothebay.com/events/today', 
    city: 'San Francisco',
    category: 'nightlife'
  },
  { 
    id: 'dothebay_weekend', 
    url: 'https://dothebay.com/events/weekend', 
    city: 'San Francisco',
    category: 'nightlife'
  }
];

// --- Setup ---
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

// Allow running without DB for testing
const DRY_RUN = !SUPABASE_URL || !SERVICE_ROLE_KEY;
const supabase = !DRY_RUN ? createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!) : null;

async function scrapeJsonLd(target: typeof TARGET_URLS[0]) {
  console.log(`\n🕵️  Scanning ${target.url}...`);
  
  // Fake a browser User-Agent to avoid being blocked
  const res = await fetch(target.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  const html = await res.text();
  const $ = cheerio.load(html);
  const listings: any[] = [];

  // Strategy 1: Look for JSON-LD (Standard Schema.org data)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      const items = Array.isArray(json) ? json : [json];

      for (const item of items) {
        if (item['@type'] === 'Event' || item['@type'] === 'MusicEvent') {
          listings.push(mapSchemaToLcListing(item, target));
        }
        // Sometimes it's a list of items
        if (item['itemListElement']) {
           item['itemListElement'].forEach((sub: any) => {
             if (sub.item && (sub.item['@type'] === 'Event' || sub.item['@type'] === 'MusicEvent')) {
               listings.push(mapSchemaToLcListing(sub.item, target));
             }
           });
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  // Strategy 2: Fallback to DoTheBay specific classes if JSON-LD fails
  // (Updated based on common DoStuff structures: .ds-listing, .event-card, etc)
  if (listings.length === 0) {
    console.log('   ⚠️  No JSON-LD found. Trying fallback selectors...');
    $('.ds-listing-event-title, .event-card-title, .ds-event-title').each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href') || $(el).find('a').attr('href');
      
      if (title && href) {
        const fullUrl = href.startsWith('http') ? href : `https://dothebay.com${href}`;
        listings.push({
          id: `dothebay_${href.split('/').pop()}`,
          title: title,
          external_id: fullUrl,
          description: `Found on DoTheBay: ${title}`,
          category: target.category,
          source: 'dothebay',
          city: target.city,
          latitude: 37.7749,
          longitude: -122.4194,
          event_start_date: new Date().toISOString(), // Fallback to now
          event_end_date: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
          is_published: true,
          last_synced_at: new Date().toISOString()
        });
      }
    });
  }

  return listings;
}

function mapSchemaToLcListing(schema: any, target: any) {
  const startDate = schema.startDate || new Date().toISOString();
  // Safe ID generation
  const safeId = (schema.url || schema.name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);

  return {
    id: `jsonld_${safeId}`,
    title: schema.name,
    description: schema.description || `Event at ${schema.location?.name || 'SF'}`,
    subtitle: schema.location?.name,
    category: target.category,
    source: 'dothebay',
    external_id: schema.url || target.url,
    city: schema.location?.address?.addressLocality || target.city,
    // Try to get lat/long if available in schema
    latitude: schema.location?.geo?.latitude || 37.7749,
    longitude: schema.location?.geo?.longitude || -122.4194,
    event_start_date: startDate,
    event_end_date: schema.endDate || new Date(new Date(startDate).getTime() + 7200000).toISOString(),
    hours: schema.startDate ? new Date(schema.startDate).toLocaleTimeString() : undefined,
    image_url: schema.image,
    is_published: true,
    last_synced_at: new Date().toISOString()
  };
}

async function main() {
  console.log('🚀 Starting Universal JSON-LD Scraper...');
  
  for (const target of TARGET_URLS) {
    const events = await scrapeJsonLd(target);
    console.log(`   Found ${events.length} events from ${target.id}`);

    if (DRY_RUN) {
      if (events.length > 0) console.log(`   [DRY RUN] First event: ${events[0].title}`);
    } else if (supabase) {
      for (const ev of events) {
        const { error } = await supabase.from('listings').upsert(ev, { onConflict: 'id' });
        if (error) console.error(`   ❌ Error saving ${ev.title}:`, error.message);
        else console.log(`   ✅ Saved: ${ev.title}`);
      }
    }
  }
}

main();