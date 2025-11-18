/**
 * Import Eventbrite events into Supabase
 * 
 * Usage:
 *   tsx scripts/import-eventbrite.ts --city "Denver" --lat 39.7392 --lng -104.9903
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  getUpcomingEvents,
  isEventbriteConfigured,
  convertEventbriteEventToListing,
  searchEvents,
  EVENTBRITE_CATEGORIES,
} from '../lib/eventbrite';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

if (!isEventbriteConfigured()) {
  console.error('Missing Eventbrite API token');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ImportConfig {
  city: string;
  lat: number;
  lng: number;
  radius?: string;
  daysAhead?: number;
  categories?: string[];
}

/**
 * Check if an event already exists in the database
 */
async function eventExists(externalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .eq('external_id', externalId)
    .eq('source', 'eventbrite')
    .single();

  return !!data && !error;
}

/**
 * Insert or update a listing in the database
 */
async function upsertListing(listing: any): Promise<boolean> {
  try {
    // Separate images from listing data
    const { images, tags, ...listingData } = listing;

    // Check if listing already exists
    const exists = await eventExists(listingData.external_id);

    if (exists) {
      // Update existing listing
      const { error: updateError } = await supabase
        .from('listings')
        .update({
          ...listingData,
          last_synced_at: new Date().toISOString(),
        })
        .eq('external_id', listingData.external_id)
        .eq('source', 'eventbrite');

      if (updateError) {
        console.error(`Error updating event ${listingData.title}:`, updateError);
        return false;
      }

      console.log(`✓ Updated: ${listingData.title}`);
    } else {
      // Insert new listing
      const { error: insertError } = await supabase
        .from('listings')
        .insert(listingData);

      if (insertError) {
        console.error(`Error inserting event ${listingData.title}:`, insertError);
        return false;
      }

      console.log(`✓ Added: ${listingData.title}`);
    }

    // Insert photos if provided
    if (images && images.length > 0) {
      // Delete existing photos
      await supabase
        .from('listing_photos')
        .delete()
        .eq('listing_id', listingData.id);

      // Insert new photos
      const photos = images.map((url: string, index: number) => ({
        listing_id: listingData.id,
        url,
        sort_order: index,
      }));

      const { error: photoError } = await supabase
        .from('listing_photos')
        .insert(photos);

      if (photoError) {
        console.error(`Error inserting photos for ${listingData.title}:`, photoError);
      }
    }

    // Handle tags if provided
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // Get or create tag
        let { data: tag, error: tagError } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .single();

        if (tagError || !tag) {
          // Create tag
          const { data: newTag } = await supabase
            .from('tags')
            .insert({ name: tagName })
            .select()
            .single();
          
          tag = newTag;
        }

        if (tag) {
          // Link tag to listing
          await supabase
            .from('listing_tags')
            .upsert({
              listing_id: listingData.id,
              tag_id: tag.id,
            }, {
              onConflict: 'listing_id,tag_id',
            });
        }
      }
    }

    return true;
  } catch (error) {
    console.error(`Error upserting event:`, error);
    return false;
  }
}

/**
 * Remove expired events from the database
 */
async function removeExpiredEvents(): Promise<number> {
  console.log('\n🗑️  Removing expired events...');
  
  const now = new Date().toISOString();
  
  const { data, error, count } = await supabase
    .from('listings')
    .delete({ count: 'exact' })
    .eq('source', 'eventbrite')
    .lt('event_end_date', now)
    .select('id'); // return deleted rows to get a count

  if (error) {
    console.error('Error removing expired events:', error);
    return 0;
  }

  const removed = typeof count === 'number' ? count : (data?.length || 0);
  console.log(`Removed ${removed} expired events`);
  return removed;
}

/**
 * Main import function
 */
async function importEventbriteEvents(config: ImportConfig) {
  const { city, lat, lng, radius = '25km', daysAhead = 60, categories } = config;
  
  console.log('\n🚀 Starting Eventbrite import...');
  console.log(`City: ${city}`);
  console.log(`Location: ${lat}, ${lng}`);
  console.log(`Radius: ${radius}`);
  console.log(`Looking ahead: ${daysAhead} days`);
  console.log('-----------------------------------');

  // First, remove expired events
  await removeExpiredEvents();

  // Calculate date range
  const startDate = new Date().toISOString();
  const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  let allEvents: any[] = [];
  let page = 1;
  const maxPages = 5; // Limit to avoid excessive API calls

  // If categories specified, search by category
  if (categories && categories.length > 0) {
    console.log(`\nFiltering by categories: ${categories.join(', ')}`);
    
    const events = await searchEvents({
      lat,
      lng,
      radius,
      startDate,
      endDate,
      categories: categories.join(','),
    });

    allEvents = events;
  } else {
    // Otherwise, get all upcoming events
    console.log('\nFetching all upcoming events...');
    
    while (page <= maxPages) {
      const events = await searchEvents({
        lat,
        lng,
        radius,
        startDate,
        endDate,
        page,
      });

      if (events.length === 0) break;

      allEvents = allEvents.concat(events);
      page++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\nFound ${allEvents.length} events`);

  let imported = 0;
  let skipped = 0;

  for (const event of allEvents) {
    const listing = convertEventbriteEventToListing(event, city);

    // Skip if missing coordinates
    if (!listing.latitude || !listing.longitude || listing.latitude === 0) {
      console.log(`✗ Skipping ${listing.title} (missing coordinates)`);
      skipped++;
      continue;
    }

    // Import to database
    const success = await upsertListing(listing);
    if (success) {
      imported++;
    }

    // Rate limiting: wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n-----------------------------------');
  console.log(`✅ Import complete!`);
  console.log(`   Total events found: ${allEvents.length}`);
  console.log(`   Successfully imported: ${imported}`);
  console.log(`   Skipped (no coordinates): ${skipped}`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config: Partial<ImportConfig> = {
    categories: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === '--city' && nextArg) {
      config.city = nextArg;
      i++;
    } else if (arg === '--lat' && nextArg) {
      config.lat = parseFloat(nextArg);
      i++;
    } else if (arg === '--lng' && nextArg) {
      config.lng = parseFloat(nextArg);
      i++;
    } else if (arg === '--radius' && nextArg) {
      config.radius = nextArg;
      i++;
    } else if (arg === '--days-ahead' && nextArg) {
      config.daysAhead = parseInt(nextArg);
      i++;
    } else if (arg === '--categories' && nextArg) {
      config.categories = nextArg.split(',').map(c => c.trim());
      i++;
    }
  }

  return config as ImportConfig;
}

// Run the import
const config = parseArgs();

if (!config.city || !config.lat || !config.lng) {
  console.error('Usage: tsx scripts/import-eventbrite.ts --city "City Name" --lat 00.0000 --lng -00.0000 [--radius 25km] [--days-ahead 60] [--categories 103,110]');
  console.log('\nAvailable category IDs:');
  Object.entries(EVENTBRITE_CATEGORIES).forEach(([name, id]) => {
    console.log(`  ${id}: ${name}`);
  });
  process.exit(1);
}

importEventbriteEvents(config)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

