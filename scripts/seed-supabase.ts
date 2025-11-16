/**
 * Seed Script - Import local seed data to Supabase
 * 
 * Run with: npx tsx scripts/seed-supabase.ts
 * 
 * Prerequisites:
 * 1. Create .env with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * 2. Run schema.sql in Supabase dashboard
 * 3. Install tsx: npm install -D tsx
 */

import { createClient } from '@supabase/supabase-js';
import { multiCitySeedData } from '../data/multi-city-seed';
import { config } from 'dotenv';

// Load .env file
config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env');
  console.error('   Add EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Get service_role key from: Supabase Dashboard → Settings → API');
  process.exit(1);
}

// Use service_role key to bypass RLS for seeding
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedListings() {
  console.log('🌱 Starting seed...\n');

  // Insert listings
  console.log(`📝 Inserting ${multiCitySeedData.length} listings...`);
  
  for (const item of multiCitySeedData) {
    const { images, tags, ...listingData } = item;
    
    // Insert listing
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .upsert({
        id: listingData.id,
        title: listingData.title,
        subtitle: listingData.subtitle,
        description: listingData.description,
        category: listingData.category,
        price_tier: listingData.price_tier,
        latitude: listingData.latitude,
        longitude: listingData.longitude,
        city: listingData.city,
        is_published: true,
        is_featured: listingData.is_featured || false,
        created_at: listingData.created_at || new Date().toISOString(),
        source: 'seed',
      })
      .select()
      .single();

    if (listingError) {
      console.error(`❌ Error inserting ${listingData.title}:`, listingError.message);
      continue;
    }

    // Insert photos
    if (images && images.length > 0) {
      const photos = images.map((url, idx) => ({
        listing_id: listingData.id,
        url,
        sort_order: idx,
      }));

      const { error: photoError } = await supabase
        .from('listing_photos')
        .upsert(photos);

      if (photoError) {
        console.error(`  ⚠️  Photo error for ${listingData.title}`);
      }
    }

    // Insert tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // Upsert tag
        const { data: tag } = await supabase
          .from('tags')
          .upsert({ name: tagName })
          .select()
          .single();

        if (tag) {
          // Link to listing
          await supabase
            .from('listing_tags')
            .upsert({ listing_id: listingData.id, tag_id: tag.id });
        }
      }
    }

    console.log(`  ✅ ${listingData.title}`);
  }

  console.log(`\n✨ Seed complete! ${multiCitySeedData.length} listings imported.\n`);
}

// Run seed
seedListings().catch((error) => {
  console.error('💥 Seed failed:', error);
  process.exit(1);
});

