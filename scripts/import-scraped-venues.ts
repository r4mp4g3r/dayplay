import 'dotenv/config';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

// --- Setup ---
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase Credentials');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Scraper Logic ---
async function scrapeDoTheBay() {
  console.log('\n🕵️  Scraping DoTheBay (Today)...');
  
  const url = 'https://dothebay.com/events/today';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  const listings: any[] = [];

  // Selector logic for DoTheBay's current HTML structure
  $('.ds-listing-event-title').each((_, element) => {
    try {
      const titleLink = $(element).find('.ds-listing-event-title-text');
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      const fullUrl = href ? `https://dothebay.com${href}` : '';
      
      // Navigate up to find venue
      const card = $(element).closest('.ds-events-group-item');
      const venueName = card.find('.ds-venue-name').text().trim();
      
      if (!title || !fullUrl) return;

      // Extract ID from URL (e.g., /events/2023/10/5/event-name)
      const slug = href?.split('/').pop() || '';
      
      listings.push({
        id: `dothebay_${slug}`,
        title: title,
        subtitle: venueName,
        description: `Discovered on DoTheBay. Venue: ${venueName}`,
        category: 'nightlife', // DoTheBay is mostly nightlife/music
        source: 'dothebay',
        external_id: fullUrl,
        city: 'San Francisco',
        latitude: 37.7749, // Placeholder
        longitude: -122.4194, // Placeholder
        is_published: true,
        last_synced_at: new Date().toISOString(),
        event_start_date: new Date().toISOString(), // Today
        // End date defaults to +3 hours
        event_end_date: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      });
    } catch (e) {
      console.warn('   Error parsing element', e);
    }
  });

  return listings;
}

// --- Main Execution ---
async function main() {
  console.log('🚀 Starting Scraper Pipeline...');

  // 1. Run Scraper
  const scrapedItems = await scrapeDoTheBay();
  console.log(`   Found ${scrapedItems.length} items.`);

  // 2. Upsert to Database
  for (const item of scrapedItems) {
    const { error } = await supabase.from('listings').upsert(item, {
      onConflict: 'id'
    });

    if (error) {
      console.error(`   ❌ Failed to save ${item.title}:`, error.message);
    } else {
      console.log(`   ✅ Saved: ${item.title}`);
    }
  }
}

main();