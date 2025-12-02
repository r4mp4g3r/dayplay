#!/usr/bin/env tsx
/**
 * Remove all listings for a specific city
 * Usage: tsx scripts/remove-city-listings.ts <city-name>
 * Example: tsx scripts/remove-city-listings.ts "Denver"
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function removeCityListings(cityName: string) {
  console.log(`\n🗑️  Removing all listings for: ${cityName}\n`);
  
  // First, count how many listings will be deleted
  const { count, error: countError } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .ilike('city', `%${cityName}%`);
  
  if (countError) {
    console.error('Error counting listings:', countError);
    return;
  }
  
  if (!count || count === 0) {
    console.log(`No listings found for ${cityName}`);
    return;
  }
  
  console.log(`📊 Found ${count} listings to delete\n`);
  console.log(`⚠️  This will also delete all associated photos\n`);
  
  // Delete all listings for the city
  // Photos will be automatically deleted due to cascade delete
  const { error } = await supabase
    .from('listings')
    .delete()
    .ilike('city', `%${cityName}%`);
  
  if (error) {
    console.error('❌ Error deleting listings:', error);
    return;
  }
  
  console.log('✅ Successfully deleted all listings and their photos!\n');
  
  // Verify deletion
  const { count: remainingCount } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .ilike('city', `%${cityName}%`);
  
  console.log(`📊 Remaining listings for ${cityName}: ${remainingCount || 0}\n`);
}

async function main() {
  const cityName = process.argv[2];
  
  if (!cityName) {
    console.error('Usage: tsx scripts/remove-city-listings.ts <city-name>');
    console.error('Example: tsx scripts/remove-city-listings.ts "Denver"');
    process.exit(1);
  }
  
  await removeCityListings(cityName);
}

main().catch(console.error);

