/**
 * Import Ticketmaster events into Supabase
 * 
 * Usage:
 *   tsx scripts/import-ticketmaster.ts --city "Denver" --lat 39.7392 --lng -104.9903
 */

// Load environment variables FIRST before any other imports
import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';
import {
  getUpcomingTicketmasterEvents,
  isTicketmasterConfigured,
  convertTicketmasterEventToListing,
  searchTicketmasterEvents,
  TICKETMASTER_CLASSIFICATIONS,
} from '../lib/ticketmaster';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

if (!isTicketmasterConfigured()) {
  console.error('Missing Ticketmaster API key');
  console.log('\nGet your free API key from: https://developer.ticketmaster.com/');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ImportConfig {
  city: string;
  lat: number;
  lng: number;
  radius?: number; // miles
  daysAhead?: number;
  classifications?: string[];
}

/**
 * Check if an event already exists in the database
 */
async function eventExists(externalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .eq('external_id', externalId)
    .eq('source', 'google_places') // Using existing source type
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
        .eq('source', 'google_places');

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
    .eq('source', 'google_places') // Our Ticketmaster events use this source
    .eq('category', 'events')
    .lt('event_end_date', now)
    .select('id');

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
async function importTicketmasterEvents(config: ImportConfig) {
  const { city, lat, lng, radius = 25, daysAhead = 60, classifications } = config;
  
  console.log('\n🎫 Starting Ticketmaster import...');
  console.log(`City: ${city}`);
  console.log(`Location: ${lat}, ${lng}`);
  console.log(`Radius: ${radius} miles`);
  console.log(`Looking ahead: ${daysAhead} days`);
  console.log('-----------------------------------');

  // First, remove expired events
  await removeExpiredEvents();

  let allListings: Partial<any>[] = [];

  // If specific classifications requested
  if (classifications && classifications.length > 0) {
    console.log(`\nFetching events for: ${classifications.join(', ')}`);
    
    for (const classification of classifications) {
      const startDateTime = new Date().toISOString();
      const endDateTime = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

      const events = await searchTicketmasterEvents({
        lat,
        lng,
        radius,
        unit: 'miles',
        startDateTime,
        endDateTime,
        classificationName: classification,
        size: 200,
      });

      console.log(`  ${classification}: Found ${events.length} events`);

      for (const event of events) {
        const listing = convertTicketmasterEventToListing(event, city);
        if (listing) {
          allListings.push(listing);
        }
      }

      // Rate limiting - wait between classification searches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } else {
    // Get all upcoming events
    console.log('\nFetching all upcoming events...');
    const listings = await getUpcomingTicketmasterEvents(lat, lng, radius, daysAhead);
    allListings = listings;
  }

  console.log(`\nTotal events found: ${allListings.length}`);

  let imported = 0;
  let skipped = 0;

  for (const listing of allListings) {
    // Skip if missing required fields
    if (!listing.latitude || !listing.longitude) {
      console.log(`✗ Skipping ${listing.title} (missing coordinates)`);
      skipped++;
      continue;
    }

    // Import to database
    const success = await upsertListing(listing);
    if (success) {
      imported++;
    }

    // Rate limiting: wait 100ms between inserts
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n-----------------------------------');
  console.log(`✅ Import complete!`);
  console.log(`   Total events found: ${allListings.length}`);
  console.log(`   Successfully imported: ${imported}`);
  console.log(`   Skipped (no coordinates): ${skipped}`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config: Partial<ImportConfig> = {
    classifications: [],
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
      config.radius = parseInt(nextArg);
      i++;
    } else if (arg === '--days-ahead' && nextArg) {
      config.daysAhead = parseInt(nextArg);
      i++;
    } else if (arg === '--classifications' && nextArg) {
      config.classifications = nextArg.split(',').map(c => c.trim());
      i++;
    }
  }

  return config as ImportConfig;
}

// Run the import
const config = parseArgs();

if (!config.city || !config.lat || !config.lng) {
  console.error('Usage: tsx scripts/import-ticketmaster.ts --city "City Name" --lat 00.0000 --lng -00.0000 [--radius 25] [--days-ahead 60] [--classifications "Music,Sports"]');
  console.log('\nAvailable classifications:');
  Object.entries(TICKETMASTER_CLASSIFICATIONS).forEach(([key, name]) => {
    console.log(`  ${name}`);
  });
  console.log('\nExample:');
  console.log('  tsx scripts/import-ticketmaster.ts --city "Denver" --lat 39.7392 --lng -104.9903 --radius 50 --classifications "Music,Sports"');
  process.exit(1);
}

importTicketmasterEvents(config)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

