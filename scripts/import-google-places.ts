/**
 * Import Google Places into Supabase
 * 
 * Usage:
 *   tsx scripts/import-google-places.ts --city "Denver" --lat 39.7392 --lng -104.9903
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  searchNearbyPlaces,
  getPlaceDetails,
  convertGooglePlaceToListing,
  isGooglePlacesConfigured,
} from '../lib/googlePlaces';
import type { Category } from '../types/domain';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

if (!isGooglePlacesConfigured()) {
  console.error('Missing Google Places API key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ImportConfig {
  city: string;
  lat: number;
  lng: number;
  categories?: Category[];
  radius?: number;
  maxPlacesPerType?: number;
}

/**
 * Check if a place already exists in the database
 */
async function placeExists(externalId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('listings')
    .select('id')
    .eq('external_id', externalId)
    .eq('source', 'google_places')
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
    const exists = await placeExists(listingData.external_id);

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
        console.error(`Error updating listing ${listingData.title}:`, updateError);
        return false;
      }

      console.log(`✓ Updated: ${listingData.title}`);
    } else {
      // Insert new listing
      const { error: insertError } = await supabase
        .from('listings')
        .insert(listingData);

      if (insertError) {
        console.error(`Error inserting listing ${listingData.title}:`, insertError);
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
    console.error(`Error upserting listing:`, error);
    return false;
  }
}

/**
 * Import places for a specific place type
 */
async function importPlacesByType(
  lat: number,
  lng: number,
  city: string,
  type: string,
  radius: number = 5000,
  maxPlaces: number = 20
): Promise<number> {
  console.log(`\nSearching for ${type} places...`);

  const places = await searchNearbyPlaces({
    lat,
    lng,
    radius,
    type,
  });

  console.log(`Found ${places.length} ${type} places`);

  let imported = 0;
  const limitedPlaces = places.slice(0, maxPlaces);

  for (const place of limitedPlaces) {
    // Get detailed information
    const details = await getPlaceDetails(place.place_id);
    
    if (!details) {
      console.log(`✗ Could not get details for: ${place.name}`);
      continue;
    }

    // Convert to listing
    const listing = convertGooglePlaceToListing(details, city);

    // Skip if missing coordinates
    if (!listing.latitude || !listing.longitude) {
      console.log(`✗ Skipping ${listing.title} (missing coordinates)`);
      continue;
    }

    // Import to database
    const success = await upsertListing(listing);
    if (success) {
      imported++;
    }

    // Rate limiting: wait 200ms between requests
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return imported;
}

/**
 * Main import function
 */
async function importGooglePlaces(config: ImportConfig) {
  const { city, lat, lng, radius = 5000, maxPlacesPerType = 20 } = config;
  
  console.log('\n🚀 Starting Google Places import...');
  console.log(`City: ${city}`);
  console.log(`Location: ${lat}, ${lng}`);
  console.log(`Radius: ${radius}m`);
  console.log('-----------------------------------');

  // Define place types to import
  const placeTypes = [
    'restaurant',
    'cafe',
    'bar',
    'night_club',
    'park',
    'museum',
    'art_gallery',
    'shopping_mall',
    'tourist_attraction',
    'amusement_park',
    'movie_theater',
    'coffee_shop',
  ];

  let totalImported = 0;

  for (const type of placeTypes) {
    const imported = await importPlacesByType(lat, lng, city, type, radius, maxPlacesPerType);
    totalImported += imported;
    
    console.log(`Imported ${imported} ${type} places`);
    
    // Longer delay between types to be respectful of API limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n-----------------------------------');
  console.log(`✅ Import complete! Total places imported: ${totalImported}`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config: Partial<ImportConfig> = {};

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
    } else if (arg === '--max-places' && nextArg) {
      config.maxPlacesPerType = parseInt(nextArg);
      i++;
    }
  }

  return config as ImportConfig;
}

// Run the import
const config = parseArgs();

if (!config.city || !config.lat || !config.lng) {
  console.error('Usage: tsx scripts/import-google-places.ts --city "City Name" --lat 00.0000 --lng -00.0000 [--radius 5000] [--max-places 20]');
  process.exit(1);
}

importGooglePlaces(config)
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });

