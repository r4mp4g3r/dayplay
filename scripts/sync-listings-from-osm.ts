/* eslint-disable no-console */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { Category } from '@/types/domain';
import { fetchOsmPlaces, convertOsmPlaceToListing } from '@/lib/openStreetMap';

type ArgMap = Record<string, string | undefined>;

function parseArgs(argv: string[]): ArgMap {
  const map: ArgMap = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) {
        map[k] = v;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        map[k] = argv[++i];
      } else {
        map[k] = 'true';
      }
    }
  }
  return map;
}

function toNumber(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const args = parseArgs(process.argv.slice(2));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type CityConfig = {
  /** Label used in logs */
  label: string;
  /** City name stored in the `city` column for listings */
  city: string;
  lat: number;
  lng: number;
  radiusMeters: number;
};

/**
 * Default city configurations for the three main app cities.
 * You can override these via CLI args if needed.
 */
const DEFAULT_CITY_CONFIGS: CityConfig[] = [
  {
    label: 'San Francisco',
    city: 'San Francisco',
    lat: 37.7749,
    lng: -122.4194,
    radiusMeters: 8000,
  },
  {
    label: 'Northern Virginia',
    city: 'Northern Virginia',
    lat: 38.9,
    lng: -77.25,
    radiusMeters: 25000,
  },
  {
    label: 'Linköping',
    city: 'Linköping',
    lat: 58.4108,
    lng: 15.6214,
    radiusMeters: 8000,
  },
];

// Categories we want to seed from OSM
const OSM_CATEGORIES: Category[] = [
  'food',
  'coffee',
  'drinks-bars',
  'nightlife',
  'outdoors',
  'museum',
  'arts-culture',
  'shopping',
  'activities',
  'sports-recreation',
  'games-entertainment',
  'relax-recharge',
  'pet-friendly',
  'festivals-pop-ups',
  'road-trip-getaways',
  'fitness-classes',
  'live-music',
];

const MAX_PER_CATEGORY = toNumber(args.maxPerCategory, 40); // per category per city

/**
 * Build CityConfig list from CLI args.
 *
 * Options:
 *  --cities "San Francisco;Northern Virginia;Linköping"
 *  --coords "37.7749,-122.4194;38.9,-77.25"
 *
 * If none provided, we fall back to DEFAULT_CITY_CONFIGS.
 */
function resolveCityConfigs(): CityConfig[] {
  const configs: CityConfig[] = [];

  const citiesArg = args.cities;
  if (citiesArg) {
    const names = String(citiesArg)
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean);

    for (const name of names) {
      const match = DEFAULT_CITY_CONFIGS.find(
        (c) => c.city.toLowerCase() === name.toLowerCase() || c.label.toLowerCase() === name.toLowerCase()
      );
      if (match) {
        configs.push(match);
      } else {
        console.warn(`No default coordinates configured for city "${name}", skipping. Add it to DEFAULT_CITY_CONFIGS to enable.`);
      }
    }
  }

  const coordsArg = args.coords;
  if (coordsArg) {
    const pairs = String(coordsArg)
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean);

    for (const pair of pairs) {
      const [latStr, lngStr] = pair.split(',').map((x) => x.trim());
      const lat = toNumber(latStr, NaN);
      const lng = toNumber(lngStr, NaN);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn(`Invalid coords "${pair}", expected "lat,lng". Skipping.`);
        continue;
      }
      configs.push({
        label: pair,
        city: pair, // caller can override later if desired
        lat,
        lng,
        radiusMeters: toNumber(args.radiusMeters, 8000),
      });
    }
  }

  if (configs.length === 0) {
    return DEFAULT_CITY_CONFIGS;
  }

  return configs;
}

async function upsertListing(record: any) {
  const { id } = record;
  if (!id) {
    console.warn('Skipping OSM record without id');
    return false;
  }

  // Strip fields that are not actual columns on the `listings` table.
  // `images` are handled via listing_photos in other import scripts,
  // and `tags` live in a separate tags/listing_tags join.
  const { images, tags, ...listingData } = record;

  const { error: upsertErr } = await supabase.from('listings').upsert(listingData as any, { onConflict: 'id' });
  if (upsertErr) {
    console.warn('Upsert listings failed:', upsertErr.message);
    return false;
  }

  // We currently don't have photos for OSM listings; nothing to insert into listing_photos.
  return true;
}

async function syncCity(config: CityConfig) {
  console.log(
    `\n=== Syncing OSM places for ${config.label} (city="${config.city}") at ${config.lat},${config.lng} radius ${
      config.radiusMeters / 1000
    }km ===`
  );

  const places = await fetchOsmPlaces({
    lat: config.lat,
    lng: config.lng,
    radiusMeters: config.radiusMeters,
    categories: OSM_CATEGORIES,
    maxPerCategory: MAX_PER_CATEGORY,
  });

  console.log(`Fetched ${places.length} unique OSM places for ${config.label}`);

  let upserts = 0;
  for (const place of places) {
    const record = convertOsmPlaceToListing(place, config.city);
    const ok = await upsertListing(record);
    if (ok) upserts++;
  }

  console.log(`${config.label}: upserted ${upserts} listings from OpenStreetMap.`);
}

async function main() {
  const cityConfigs = resolveCityConfigs();

  if (cityConfigs.length === 0) {
    console.error('No city configurations resolved for OSM sync. Check your --cities/--coords args or DEFAULT_CITY_CONFIGS.');
    process.exit(1);
  }

  console.log('Starting OpenStreetMap sync for listings');
  console.log(
    'Cities:',
    cityConfigs.map((c) => `${c.label} (${c.lat},${c.lng})`).join(' | ')
  );
  console.log('Categories:', OSM_CATEGORIES.join(', '));
  console.log(`Max per category: ${MAX_PER_CATEGORY}`);

  for (const config of cityConfigs) {
    await syncCity(config);
  }

  console.log('\nAll cities processed for OSM sync.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


