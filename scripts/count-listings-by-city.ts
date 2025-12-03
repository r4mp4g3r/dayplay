import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('   Make sure your .env file has these values.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const METRO_AREA_CITIES: Record<string, string[]> = {
  'Northern Virginia': [
    'Northern Virginia', 'Fairfax', 'Arlington', 'Alexandria', 'Reston', 'Vienna',
    'Falls Church', 'McLean', 'Tysons', 'Annandale', 'Springfield', 'Centreville',
    'Herndon', 'Chantilly', 'Great Falls', 'Clifton', 'Fairfax Station',
    'Occoquan Historic District', 'Manassas', 'Ashburn', 'Leesburg', 'Sterling',
    'Burke', 'Lorton', 'Mount Vernon', 'Oakton', 'Dunn Loring', 'Merrifield',
    'Woodbridge', 'Dale City', 'Lake Ridge', 'Gainesville', 'Haymarket',
    'Washington', 'Washington, DC', 'District of Columbia',
    'Frederick, MD', 'Solomons', 'Silver Spring', 'National Harbor', 'Bethesda',
    'Middleburg', 'Waterford', 'Fredericksburg', 'Stafford', 'Prince William'
  ],
};

async function countListingsByCity() {
  try {
    console.log('🔍 Counting listings in Supabase...\n');

    // Get ALL unique cities from the database
    const { data: allCities, error: citiesError } = await supabase
      .from('listings')
      .select('city')
      .not('city', 'is', null);

    if (citiesError) throw citiesError;

    const citySet = new Set<string>();
    allCities?.forEach(l => {
      if (l.city) citySet.add(l.city);
    });

    const uniqueCities = Array.from(citySet).sort();

    console.log(`📊 Found ${uniqueCities.length} unique cities in database\n`);
    console.log('='.repeat(80));
    console.log('📈 LISTING COUNTS BY CITY');
    console.log('='.repeat(80));

    // Count for each city
    const cityCounts: Array<{
      city: string;
      total: number;
      published: number;
      unpublished: number;
      seed: number;
      nonSeed: number;
    }> = [];

    for (const city of uniqueCities) {
      // Total count
      const { count: totalCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('city', city);

      // Published count
      const { count: publishedCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('city', city)
        .eq('is_published', true);

      // Unpublished count
      const { count: unpublishedCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('city', city)
        .eq('is_published', false);

      // Seed count (published)
      const { count: seedCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('city', city)
        .eq('is_published', true)
        .eq('source', 'seed');

      // Non-seed count (published)
      const { count: nonSeedCount } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('city', city)
        .eq('is_published', true)
        .neq('source', 'seed');

      cityCounts.push({
        city,
        total: totalCount || 0,
        published: publishedCount || 0,
        unpublished: unpublishedCount || 0,
        seed: seedCount || 0,
        nonSeed: nonSeedCount || 0,
      });
    }

    // Sort by published count (descending)
    cityCounts.sort((a, b) => b.published - a.published);

    // Print table
    console.log('\nCity'.padEnd(35) + 'Total'.padEnd(10) + 'Published'.padEnd(12) + 'Unpub'.padEnd(10) + 'Seed'.padEnd(10) + 'Non-Seed');
    console.log('-'.repeat(80));

    let grandTotal = 0;
    let grandPublished = 0;
    let grandSeed = 0;
    let grandNonSeed = 0;

    for (const stats of cityCounts) {
      if (stats.published > 0) {
        console.log(
          stats.city.padEnd(35) +
          stats.total.toString().padEnd(10) +
          stats.published.toString().padEnd(12) +
          stats.unpublished.toString().padEnd(10) +
          stats.seed.toString().padEnd(10) +
          stats.nonSeed.toString()
        );
        grandTotal += stats.total;
        grandPublished += stats.published;
        grandSeed += stats.seed;
        grandNonSeed += stats.nonSeed;
      }
    }

    console.log('-'.repeat(80));
    console.log(
      'TOTAL'.padEnd(35) +
      grandTotal.toString().padEnd(10) +
      grandPublished.toString().padEnd(12) +
      '-'.padEnd(10) +
      grandSeed.toString().padEnd(10) +
      grandNonSeed.toString()
    );

    // Northern Virginia Metro Area Summary
    console.log('\n' + '='.repeat(80));
    console.log('🗺️  NORTHERN VIRGINIA METRO AREA SUMMARY');
    console.log('='.repeat(80));

    const nvCities = METRO_AREA_CITIES['Northern Virginia'] || [];
    let nvTotal = 0;
    let nvPublished = 0;
    let nvSeed = 0;
    let nvNonSeed = 0;

    for (const city of nvCities) {
      const stats = cityCounts.find(c => c.city === city);
      if (stats) {
        nvTotal += stats.total;
        nvPublished += stats.published;
        nvSeed += stats.seed;
        nvNonSeed += stats.nonSeed;
      }
    }

    console.log(`\n📊 Total NV Metro Listings: ${nvTotal}`);
    console.log(`✅ Published NV Metro Listings: ${nvPublished}`);
    console.log(`🌱 Published Seed Listings: ${nvSeed}`);
    console.log(`📝 Published Non-Seed Listings: ${nvNonSeed}`);
    console.log(`\n🎯 Expected: ~818 listings (from import summary)`);
    console.log(`📉 Difference: ${818 - nvPublished} listings`);

    // Check for cities NOT in our metro list but might be NV-related
    console.log('\n' + '='.repeat(80));
    console.log('🔍 CITIES NOT IN METRO LIST (might be NV-related)');
    console.log('='.repeat(80));

    const nvRelatedCities = cityCounts.filter(c => {
      const cityLower = c.city.toLowerCase();
      return (
        !nvCities.includes(c.city) &&
        c.published > 0 &&
        (cityLower.includes('virginia') ||
         cityLower.includes('fairfax') ||
         cityLower.includes('arlington') ||
         cityLower.includes('alexandria') ||
         cityLower.includes('reston') ||
         cityLower.includes('vienna') ||
         cityLower.includes('mclean') ||
         cityLower.includes('manassas') ||
         cityLower.includes('leesburg') ||
         cityLower.includes('washington') ||
         cityLower.includes('dc') ||
         cityLower.includes('maryland') ||
         cityLower.includes('md'))
      );
    });

    if (nvRelatedCities.length > 0) {
      console.log('\nCity'.padEnd(35) + 'Published');
      console.log('-'.repeat(50));
      for (const city of nvRelatedCities) {
        console.log(city.city.padEnd(35) + city.published.toString());
      }
      console.log(`\n💡 Consider adding these ${nvRelatedCities.length} cities to METRO_AREA_CITIES`);
    } else {
      console.log('\n✅ No additional NV-related cities found');
    }

    // Source breakdown
    console.log('\n' + '='.repeat(80));
    console.log('📦 SOURCE BREAKDOWN (Published Listings Only)');
    console.log('='.repeat(80));

    const { data: sourceData } = await supabase
      .from('listings')
      .select('source')
      .eq('is_published', true);

    const sourceCounts: Record<string, number> = {};
    sourceData?.forEach(l => {
      const source = l.source || 'null';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    });

    console.log('\nSource'.padEnd(30) + 'Count');
    console.log('-'.repeat(50));
    Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log((source || 'null').padEnd(30) + count.toString());
      });

    console.log('\n✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

countListingsByCity();

