import 'dotenv/config';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import { convertEventbriteEventToListing } from '../lib/eventbrite';

// --- Configuration ---
// UPDATED: You will need to verify these IDs (see Step 2 below)
const VENUES = [
  { name: 'Spark Social SF', organizerId: '11045011638', defaultCategory: 'food' },
  // These IDs failed. You must replace them with the correct ones you find.
  // { name: 'The Midway', organizerId: 'REPLACE_WITH_REAL_ID', defaultCategory: 'nightlife' }, 
];

// --- Setup ---
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const EVENTBRITE_TOKEN = process.env.EVENTBRITE_API_TOKEN || process.env.EXPO_PUBLIC_EVENTBRITE_API_TOKEN;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !EVENTBRITE_TOKEN) {
  throw new Error('Missing Env Vars: SUPABASE_URL, SERVICE_ROLE, or EVENTBRITE_API_TOKEN');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Logic ---
async function fetchOrganizerEvents(organizerId: string) {
  // Note: page_size removed as per previous fix
  const url = `https://www.eventbriteapi.com/v3/organizers/${organizerId}/events/?status=live&expand=venue,logo,ticket_classes`;
  
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${EVENTBRITE_TOKEN}` }
  });

  if (!res.ok) {
    // If 404, it means the ID is wrong
    if (res.status === 404) {
      console.warn(`   ⚠️  Organizer ID ${organizerId} not found (404).`);
      return [];
    }
    const txt = await res.text();
    console.error(`   Eventbrite API Error: ${res.status}`, txt);
    return [];
  }

  const data = await res.json();
  return data.events || [];
}

async function main() {
  console.log('🚀 Starting Venue Organizer Import...');

  for (const venue of VENUES) {
    console.log(`\n🏟️  Checking venue: ${venue.name} (ID: ${venue.organizerId})...`);
    
    try {
      const events = await fetchOrganizerEvents(venue.organizerId);
      console.log(`   Found ${events.length} live events.`);

      for (const event of events) {
        const fullListing = convertEventbriteEventToListing(event);

        // 1. Separate images from the main listing object
        // The DB schema doesn't have an 'images' column on 'listings'
        const { images, ...listingData } = fullListing;

        // Customize metadata
        listingData.source = 'tier2_venue';
        listingData.category = venue.defaultCategory; 
        listingData.source_metadata = {
          ...listingData.source_metadata,
          organizer: venue.name,
          is_verified_venue: true
        };

        if (!listingData.id) listingData.id = `venue_eb_${event.id}`;

        // 2. Upsert Listing
        const { error: listingError } = await supabase.from('listings').upsert(listingData, {
          onConflict: 'id',
        });

        if (listingError) {
          console.error(`   ❌ Error saving ${listingData.title}:`, listingError.message);
          continue; // Skip photos if listing failed
        }

        console.log(`   ✅ Saved: ${listingData.title}`);

        // 3. Insert Photos (if any)
        if (images && images.length > 0) {
          // Delete old photos first to avoid duplicates
          await supabase.from('listing_photos').delete().eq('listing_id', listingData.id);
          
          const photoRecords = images.map((url, index) => ({
            listing_id: listingData.id,
            url: url,
            sort_order: index
          }));

          const { error: photoError } = await supabase.from('listing_photos').insert(photoRecords);
          if (photoError) console.warn(`      ⚠️ Could not save photos: ${photoError.message}`);
        }
      }
    } catch (err) {
      console.error(`   ⚠️ Error processing venue ${venue.name}:`, err);
    }
  }
}

main();