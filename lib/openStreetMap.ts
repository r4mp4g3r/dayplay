/**
 * OpenStreetMap / Overpass integration helpers
 *
 * This module lets us query OSM via Overpass for interesting places
 * around a city center and convert them into our internal Listing shape.
 *
 * IMPORTANT: Be a good API citizen.
 * - Keep queries small (limited radius + result counts)
 * - Sleep between requests when running scripts in a loop
 * - Identify your app via a User-Agent including contact info
 */

import type { Category, Listing } from '@/types/domain';

// Overpass public endpoint. You can change this to a mirror if needed.
const OVERPASS_URL = process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

// Required by OSM/Overpass: identify your application + contact
const DEFAULT_USER_AGENT = 'SwipelyApp/1.0 (https://example.com; contact: you@example.com)';
const OSM_USER_AGENT = process.env.OSM_USER_AGENT || DEFAULT_USER_AGENT;

/**
 * Raw Overpass element types
 */
export type OsmElementType = 'node' | 'way' | 'relation';

export interface OsmRawElement {
  id: number;
  type: OsmElementType;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

export interface OsmPlace {
  osmId: number;
  osmType: OsmElementType;
  lat: number;
  lon: number;
  name: string;
  tags: Record<string, string>;
}

export interface OverpassResponse {
  elements: OsmRawElement[];
}

export interface OsmQueryConfig {
  lat: number;
  lng: number;
  radiusMeters: number;
  /**
   * High-level categories we care about, mapped to OSM tag filters internally.
   * These should line up reasonably with our `Category` union.
   */
  categories: Category[];
  /**
   * Maximum number of places to return per category.
   */
  maxPerCategory?: number;
}

/**
 * Map high-level Swipely categories to primitive OSM selectors.
 * We return bare selectors (e.g. node["amenity"="restaurant"]) and
 * add geometry filters like (around:...) in the query builder.
 */
function osmSelectorsForCategory(category: Category): string[] {
  switch (category) {
    case 'food':
      return [
        'node["amenity"~"restaurant|fast_food|food_court"]',
        'way["amenity"~"restaurant|fast_food|food_court"]',
        'relation["amenity"~"restaurant|fast_food|food_court"]',
        'node["cuisine"]',
        'way["cuisine"]',
        'relation["cuisine"]',
      ];
    case 'coffee':
      return [
        'node["amenity"="cafe"]',
        'way["amenity"="cafe"]',
        'relation["amenity"="cafe"]',
      ];
    case 'drinks-bars':
    case 'nightlife':
      return [
        'node["amenity"~"bar|pub|nightclub"]',
        'way["amenity"~"bar|pub|nightclub"]',
        'relation["amenity"~"bar|pub|nightclub"]',
      ];
    case 'outdoors':
      return [
        'node["leisure"~"park|garden"]',
        'way["leisure"~"park|garden"]',
        'relation["leisure"~"park|garden"]',
        'node["natural"]',
        'way["natural"]',
        'relation["natural"]',
      ];
    case 'museum':
    case 'arts-culture':
      return [
        'node["tourism"~"museum|gallery"]',
        'way["tourism"~"museum|gallery"]',
        'relation["tourism"~"museum|gallery"]',
      ];
    case 'shopping':
      return [
        'node["shop"]',
        'way["shop"]',
        'relation["shop"]',
      ];
    case 'events':
      // OSM has limited explicit event tagging; we focus on venues likely to host events
      return [
        'node["amenity"~"theatre|arts_centre|community_centre"]',
        'way["amenity"~"theatre|arts_centre|community_centre"]',
        'relation["amenity"~"theatre|arts_centre|community_centre"]',
      ];
    case 'sports-recreation':
      return [
        'node["leisure"~"sports_centre|stadium|pitch|track"]',
        'way["leisure"~"sports_centre|stadium|pitch|track"]',
        'relation["leisure"~"sports_centre|stadium|pitch|track"]',
      ];
    case 'pet-friendly':
      return [
        'node["leisure"="dog_park"]',
        'way["leisure"="dog_park"]',
        'relation["leisure"="dog_park"]',
        'node["amenity"="veterinary"]',
        'way["amenity"="veterinary"]',
        'relation["amenity"="veterinary"]',
      ];
    case 'festivals-pop-ups':
      return [
        'node["amenity"~"marketplace|community_centre"]',
        'way["amenity"~"marketplace|community_centre"]',
        'relation["amenity"~"marketplace|community_centre"]',
      ];
    case 'games-entertainment':
      return [
        'node["leisure"~"amusement_arcade|bowling_alley"]',
        'way["leisure"~"amusement_arcade|bowling_alley"]',
        'relation["leisure"~"amusement_arcade|bowling_alley"]',
      ];
    case 'relax-recharge':
      return [
        'node["amenity"="spa"]',
        'way["amenity"="spa"]',
        'relation["amenity"="spa"]',
      ];
    case 'live-music':
      return [
        'node["amenity"="theatre"]',
        'way["amenity"="theatre"]',
        'relation["amenity"="theatre"]',
      ];
    case 'fitness-classes':
      return [
        'node["leisure"="fitness_centre"]',
        'way["leisure"="fitness_centre"]',
        'relation["leisure"="fitness_centre"]',
      ];
    case 'road-trip-getaways':
      return [
        'node["tourism"~"viewpoint|attraction"]',
        'way["tourism"~"viewpoint|attraction"]',
        'relation["tourism"~"viewpoint|attraction"]',
        'node["natural"]',
        'way["natural"]',
        'relation["natural"]',
      ];
    case 'hotels':
      return [
        'node["tourism"="hotel"]',
        'way["tourism"="hotel"]',
        'relation["tourism"="hotel"]',
      ];
    case 'neighborhood':
      // Very loosely approximate by using named quarters / districts
      return [
        'node["place"~"quarter|suburb|neighbourhood"]',
      ];
    default:
      // Fallback: generic points of interest
      return [
        'node["tourism"="attraction"]',
        'way["tourism"="attraction"]',
        'relation["tourism"="attraction"]',
      ];
  }
}

/**
 * Build an Overpass QL query for a single category around a point.
 */
function buildOverpassQueryForCategory(
  lat: number,
  lng: number,
  radiusMeters: number,
  category: Category
): string {
  const selectors = osmSelectorsForCategory(category);
  const lines = selectors.map(
    (sel) => `  ${sel}(around:${radiusMeters},${lat},${lng});`
  );

  return `
  [out:json][timeout:25];
  (
${lines.join('\n')}
  )
  ;
  out center 200;
  `;
}

async function fetchOverpass(query: string): Promise<OverpassResponse | null> {
  try {
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': OSM_USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.error('Overpass HTTP error:', response.status, await response.text());
      return null;
    }

    const json = (await response.json()) as OverpassResponse;
    return json;
  } catch (error) {
    console.error('Overpass fetch error:', error);
    return null;
  }
}

/**
 * Normalize an Overpass element into an OsmPlace with stable lat/lon.
 */
function normalizeElement(element: OsmRawElement): OsmPlace | null {
  const tags = element.tags || {};
  const name = tags.name;
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;

  if (!name || typeof lat !== 'number' || typeof lon !== 'number') {
    return null;
  }

  return {
    osmId: element.id,
    osmType: element.type,
    lat,
    lon,
    name,
    tags,
  };
}

/**
 * Map OSM tags to one of our categories.
 * This is a best-effort heuristic that should roughly align with the filters UI.
 */
export function mapOsmTagsToCategory(tags: Record<string, string>): Category {
  const amenity = tags.amenity;
  const tourism = tags.tourism;
  const leisure = tags.leisure;
  const shop = tags.shop;
  const natural = tags.natural;

  if (amenity) {
    if (/(restaurant|fast_food|food_court)/.test(amenity)) return 'food';
    if (amenity === 'cafe') return 'coffee';
    if (/(bar|pub|nightclub)/.test(amenity)) return 'drinks-bars';
    if (/(theatre|arts_centre|community_centre)/.test(amenity)) return 'arts-culture';
    if (amenity === 'spa') return 'relax-recharge';
    if (amenity === 'veterinary') return 'pet-friendly';
  }

  if (tourism) {
    if (/(museum|gallery)/.test(tourism)) return 'museum';
    if (/(attraction|viewpoint)/.test(tourism)) return 'outdoors';
    if (tourism === 'hotel') return 'hotels';
  }

  if (leisure) {
    if (/(park|garden)/.test(leisure)) return 'outdoors';
    if (/(sports_centre|stadium|pitch|track)/.test(leisure)) return 'sports-recreation';
    if (/(amusement_arcade|bowling_alley)/.test(leisure)) return 'games-entertainment';
    if (leisure === 'dog_park') return 'pet-friendly';
    if (leisure === 'fitness_centre') return 'fitness-classes';
  }

  if (shop) {
    return 'shopping';
  }

  if (natural) {
    return 'road-trip-getaways';
  }

  // Fallback: generic activities
  return 'activities';
}

/**
 * Fetch OSM places around a point for a set of categories.
 * Deduplicates places across categories by (osmType, osmId).
 */
export async function fetchOsmPlaces(config: OsmQueryConfig): Promise<OsmPlace[]> {
  const { lat, lng, radiusMeters, categories, maxPerCategory = 50 } = config;

  const seen = new Map<string, OsmPlace>();

  for (const category of categories) {
    const q = buildOverpassQueryForCategory(lat, lng, radiusMeters, category);
    const res = await fetchOverpass(q);
    if (!res?.elements) continue;

    let count = 0;
    for (const el of res.elements) {
      if (count >= maxPerCategory) break;
      const place = normalizeElement(el);
      if (!place) continue;

      const key = `${place.osmType}:${place.osmId}`;
      if (!seen.has(key)) {
        seen.set(key, place);
        count++;
      }
    }

    // Simple throttle to be gentle with Overpass
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  return Array.from(seen.values());
}

/**
 * Convert an OsmPlace into a Listing-like object that matches our DB schema.
 * The caller (scripts) is responsible for upserting into Supabase.
 */
export function convertOsmPlaceToListing(place: OsmPlace, city: string): Partial<Listing> {
  const tags = place.tags || {};
  const id = `osm_${place.osmType}_${place.osmId}`;
  const category = mapOsmTagsToCategory(tags);

  const description =
    tags.description ||
    tags['short_description'] ||
    tags.note ||
    tags['addr:street'] ||
    '';

  const openingHours = tags.opening_hours;
  const website = tags.website || tags.url || tags['contact:website'];
  const phone = tags.phone || tags['contact:phone'];

  // Derive tags array from some interesting OSM attributes
  const derivedTags: string[] = [];
  if (tags.cuisine) derivedTags.push(tags.cuisine);
  if (tags['outdoor_seating'] === 'yes') derivedTags.push('outdoor-seating');
  if (tags.wheelchair === 'yes') derivedTags.push('wheelchair-accessible');
  if (tags.dog === 'yes' || tags['dog:conditional']) derivedTags.push('pet-friendly');

  return {
    id,
    external_id: `${place.osmType}/${place.osmId}`,
    source: 'openstreetmap',
    title: place.name,
    subtitle: tags['addr:street'] || tags['addr:full'] || undefined,
    description,
    category,
    // OSM doesn't have a concept of price tiers; leave undefined
    latitude: place.lat,
    longitude: place.lon,
    city,
    images: [], // OSM itself doesn't provide photos; callers may attach generic images later
    tags: derivedTags.length > 0 ? derivedTags : undefined,
    hours: openingHours,
    phone,
    website,
    is_published: true,
    is_featured: false,
    source_metadata: {
      osmType: place.osmType,
      osmId: place.osmId,
      tags,
    },
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Simple check to see if OSM/Overpass is configured.
 * We don't strictly require env vars, but we can warn when running in production.
 */
export function isOsmConfigured(): boolean {
  return !!OVERPASS_URL;
}


