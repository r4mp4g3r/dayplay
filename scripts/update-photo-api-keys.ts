#!/usr/bin/env tsx
/**
 * Update all listing photo URLs to use the current API key
 * Usage: tsx scripts/update-photo-api-keys.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const CURRENT_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

if (!CURRENT_API_KEY) {
  throw new Error('Missing GOOGLE_MAPS_API_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function updatePhotoUrls() {
  console.log('🔄 Fetching all listing photos...\n');
  
  // Get all photos in batches (Supabase has a limit)
  let allPhotos: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: photos, error } = await supabase
      .from('listing_photos')
      .select('id, url')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching photos:', error);
      break;
    }
    
    if (!photos || photos.length === 0) {
      break;
    }
    
    allPhotos = allPhotos.concat(photos);
    console.log(`  Fetched ${allPhotos.length} photos so far...`);
    
    if (photos.length < batchSize) {
      break; // Last batch
    }
    
    from += batchSize;
  }
  
  if (allPhotos.length === 0) {
    console.log('No photos found.');
    return;
  }
  
  console.log(`\n📊 Found ${allPhotos.length} photos to update\n`);
  const photos = allPhotos;
  
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const photo of photos) {
    const url = photo.url;
    
    // Check if it's a Google Places photo URL
    if (!url.includes('maps.googleapis.com/maps/api/place/photo')) {
      skipped++;
      continue;
    }
    
    // Replace the API key in the URL
    const urlObj = new URL(url);
    const oldKey = urlObj.searchParams.get('key');
    
    if (oldKey === CURRENT_API_KEY) {
      skipped++;
      continue;
    }
    
    urlObj.searchParams.set('key', CURRENT_API_KEY);
    const newUrl = urlObj.toString();
    
    // Update in database
    const { error: updateError } = await supabase
      .from('listing_photos')
      .update({ url: newUrl })
      .eq('id', photo.id);
    
    if (updateError) {
      console.error(`❌ Failed to update photo ${photo.id}:`, updateError.message);
      failed++;
    } else {
      updated++;
      if (updated % 100 === 0) {
        console.log(`  ✅ Updated ${updated} photos...`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Updated: ${updated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📷 Total: ${photos.length}`);
  console.log('='.repeat(60));
}

updatePhotoUrls().catch(console.error);

