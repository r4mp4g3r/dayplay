/**
 * Ticketmaster Discovery API Integration
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */

import type { Listing } from '@/types/domain';

const TICKETMASTER_API_KEY = 
  process.env.TICKETMASTER_API_KEY || 
  process.env.EXPO_PUBLIC_TICKETMASTER_API_KEY;

// Ticketmaster Discovery API v2 (as per official docs)
// https://app.ticketmaster.com/{package}/{version}/{resource}.json?apikey={API key}
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

// Ticketmaster API Types
interface TicketmasterImage {
  url: string;
  ratio?: string;
  width: number;
  height: number;
}

interface TicketmasterVenue {
  name: string;
  id: string;
  location?: {
    latitude: string;
    longitude: string;
  };
  address?: {
    line1?: string;
    line2?: string;
  };
  city?: {
    name: string;
  };
  state?: {
    name: string;
    stateCode: string;
  };
  postalCode?: string;
}

interface TicketmasterPriceRange {
  type: string;
  currency: string;
  min: number;
  max: number;
}

interface TicketmasterClassification {
  primary: boolean;
  segment: {
    id: string;
    name: string;
  };
  genre?: {
    id: string;
    name: string;
  };
  subGenre?: {
    id: string;
    name: string;
  };
}

interface TicketmasterEvent {
  id: string;
  name: string;
  type: string;
  url: string;
  locale: string;
  images: TicketmasterImage[];
  dates: {
    start: {
      localDate: string;
      localTime?: string;
      dateTime?: string;
    };
    end?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
    timezone?: string;
    status: {
      code: string;
    };
  };
  classifications?: TicketmasterClassification[];
  priceRanges?: TicketmasterPriceRange[];
  info?: string;
  pleaseNote?: string;
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
}

interface EventSearchResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

interface SearchParams {
  lat?: number;
  lng?: number;
  radius?: number; // in miles
  unit?: 'miles' | 'km';
  startDateTime?: string; // ISO
  endDateTime?: string; // ISO
  classificationName?: string; // Music, Sports, Arts, etc.
  size?: number; // results per page
  page?: number;
  sort?: 'date,asc' | 'date,desc' | 'relevance,desc' | 'name,asc';
}

/**
 * Search for events using Ticketmaster Discovery API
 */
export async function searchTicketmasterEvents(params: SearchParams): Promise<TicketmasterEvent[]> {
  if (!TICKETMASTER_API_KEY) {
    console.warn('Ticketmaster API key not configured');
    return [];
  }

  // Discovery API v2 endpoint: /discovery/v2/events.json
  const url = new URL(`${BASE_URL}/events.json`);
  
  // API Key (required) - as per Ticketmaster docs
  url.searchParams.append('apikey', TICKETMASTER_API_KEY);

  // Location - use geoPoint parameter (lat,lng format)
  // As per docs: geoPoint=latitude,longitude
  if (params.lat && params.lng) {
    url.searchParams.append('geoPoint', `${params.lat},${params.lng}`);
    
    // Radius (optional) - default unit is miles
    if (params.radius) {
      url.searchParams.append('radius', params.radius.toString());
      url.searchParams.append('unit', params.unit || 'miles');
    }
  }

  // Date range - ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ
  if (params.startDateTime) {
    url.searchParams.append('startDateTime', params.startDateTime);
  }
  if (params.endDateTime) {
    url.searchParams.append('endDateTime', params.endDateTime);
  }

  // Classification (Music, Sports, Arts & Theatre, etc.)
  // As per docs: classificationName parameter
  if (params.classificationName) {
    url.searchParams.append('classificationName', params.classificationName);
  }

  // Pagination - as per Discovery API v2 docs
  // size: number of results (max 200)
  // page: page number (0-based)
  url.searchParams.append('size', (params.size || 20).toString());
  url.searchParams.append('page', (params.page || 0).toString());

  // Sorting - as per docs: date,asc | date,desc | relevance,desc | name,asc
  url.searchParams.append('sort', params.sort || 'date,asc');

  try {
    console.log('Fetching from URL:', url.toString().replace(TICKETMASTER_API_KEY, 'API_KEY_HIDDEN'));
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ticketmaster API error:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return [];
    }

    const data: EventSearchResponse = await response.json();
    return data._embedded?.events || [];
  } catch (error) {
    console.error('Error fetching Ticketmaster events:', error);
    return [];
  }
}

/**
 * Get event details by ID
 */
export async function getTicketmasterEvent(eventId: string): Promise<TicketmasterEvent | null> {
  if (!TICKETMASTER_API_KEY) {
    console.warn('Ticketmaster API key not configured');
    return null;
  }

  const url = new URL(`${BASE_URL}/events/${eventId}.json`);
  url.searchParams.append('apikey', TICKETMASTER_API_KEY);

  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error('Ticketmaster API error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching event details:', error);
    return null;
  }
}

/**
 * Determine price tier from Ticketmaster price ranges
 */
function calculatePriceTier(priceRanges?: TicketmasterPriceRange[]): number {
  if (!priceRanges || priceRanges.length === 0) return 1;

  // Use the minimum price to determine tier
  const minPrice = Math.min(...priceRanges.map(pr => pr.min));

  // Map to 1-4 scale
  if (minPrice === 0) return 1; // Free
  if (minPrice <= 30) return 1; // Budget
  if (minPrice <= 75) return 2; // Moderate
  if (minPrice <= 150) return 3; // Pricey
  return 4; // Premium
}

/**
 * Get best quality image from Ticketmaster images
 */
function getBestImages(images: TicketmasterImage[], count: number = 5): string[] {
  if (!images || images.length === 0) return [];

  // Sort by resolution (width * height)
  const sorted = [...images]
    .filter(img => img.url)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));

  return sorted.slice(0, count).map(img => img.url);
}

/**
 * Extract venue coordinates
 */
function extractVenueCoordinates(event: TicketmasterEvent): { lat: number; lng: number } | null {
  const venue = event._embedded?.venues?.[0];
  if (!venue?.location) return null;

  const lat = parseFloat(venue.location.latitude);
  const lng = parseFloat(venue.location.longitude);

  if (isNaN(lat) || isNaN(lng)) return null;

  return { lat, lng };
}

/**
 * Extract city from venue
 */
function extractCity(event: TicketmasterEvent, defaultCity?: string): string {
  const venue = event._embedded?.venues?.[0];
  return venue?.city?.name || defaultCity || 'Unknown';
}

/**
 * Generate subtitle from date and venue
 */
function generateSubtitle(event: TicketmasterEvent): string {
  const dateStr = event.dates.start.localDate;
  const timeStr = event.dates.start.localTime;
  const venue = event._embedded?.venues?.[0];

  const date = new Date(event.dates.start.dateTime || event.dates.start.localDate);
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const formattedTime = timeStr 
    ? new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const venueName = venue?.name;

  if (venueName && formattedTime) {
    return `${formattedDate} at ${formattedTime} • ${venueName}`;
  } else if (venueName) {
    return `${formattedDate} • ${venueName}`;
  } else if (formattedTime) {
    return `${formattedDate} at ${formattedTime}`;
  }

  return formattedDate;
}

/**
 * Extract tags from classification
 */
function extractTags(event: TicketmasterEvent): string[] {
  const tags: string[] = [];

  if (!event.classifications) return tags;

  const primary = event.classifications.find(c => c.primary);
  if (!primary) return tags;

  // Add genre and subgenre as tags
  if (primary.genre?.name) {
    tags.push(primary.genre.name.toLowerCase());
  }
  if (primary.subGenre?.name) {
    tags.push(primary.subGenre.name.toLowerCase());
  }

  // Check price
  if (event.priceRanges) {
    const minPrice = Math.min(...event.priceRanges.map(pr => pr.min));
    if (minPrice === 0) {
      tags.push('free');
    }
  }

  return tags;
}

/**
 * Convert Ticketmaster Event to Swipely Listing
 */
export function convertTicketmasterEventToListing(
  event: TicketmasterEvent,
  defaultCity?: string
): Partial<Listing> | null {
  // Extract coordinates
  const coords = extractVenueCoordinates(event);
  if (!coords) {
    console.warn(`Event ${event.name} has no coordinates, skipping`);
    return null;
  }

  const city = extractCity(event, defaultCity);
  const priceTier = calculatePriceTier(event.priceRanges);
  const images = getBestImages(event.images);
  const tags = extractTags(event);
  const venue = event._embedded?.venues?.[0];

  // Build description
  const description = event.info || event.pleaseNote || `${event.name} at ${venue?.name || 'TBA'}`;

  // Calculate event dates
  const startDateTime = event.dates.start.dateTime || 
    `${event.dates.start.localDate}T${event.dates.start.localTime || '00:00:00'}`;
  
  const endDateTime = event.dates.end?.dateTime || 
    event.dates.end?.localDate ? 
    `${event.dates.end.localDate}T${event.dates.end.localTime || '23:59:59'}` :
    startDateTime; // Default to same as start if no end date

  return {
    id: `tm_${event.id}`,
    external_id: event.id,
    source: 'google_places', // Using existing source type, or we can add 'ticketmaster'
    title: event.name,
    subtitle: generateSubtitle(event),
    description,
    category: 'events',
    price_tier: priceTier,
    latitude: coords.lat,
    longitude: coords.lng,
    city,
    event_start_date: startDateTime,
    event_end_date: endDateTime,
    images,
    tags,
    website: event.url,
    is_published: event.dates.status.code !== 'cancelled' && event.dates.status.code !== 'postponed',
    source_metadata: {
      ticketmaster_url: event.url,
      venue_name: venue?.name,
      venue_address: venue?.address?.line1,
      venue_id: venue?.id,
      classification: event.classifications?.[0],
      price_ranges: event.priceRanges,
      event_type: event.type,
      locale: event.locale,
    },
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Get upcoming events for a location
 */
export async function getUpcomingTicketmasterEvents(
  lat: number,
  lng: number,
  radiusMiles: number = 25,
  daysAhead: number = 60
): Promise<Partial<Listing>[]> {
  // Ticketmaster requires format: YYYY-MM-DDTHH:mm:ssZ
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  
  const startDateTime = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const endDateTime = future.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const events = await searchTicketmasterEvents({
    lat,
    lng,
    radius: radiusMiles,
    unit: 'miles',
    startDateTime,
    endDateTime,
    size: 200, // Max results
    sort: 'date,asc',
  });

  const listings: Partial<Listing>[] = [];

  for (const event of events) {
    const listing = convertTicketmasterEventToListing(event);
    if (listing) {
      listings.push(listing);
    }
  }

  return listings;
}

/**
 * Get events by classification (Music, Sports, Arts & Theatre, etc.)
 */
export async function getTicketmasterEventsByCategory(
  lat: number,
  lng: number,
  classification: string,
  radiusMiles: number = 25,
  daysAhead: number = 60
): Promise<Partial<Listing>[]> {
  const startDateTime = new Date().toISOString();
  const endDateTime = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const events = await searchTicketmasterEvents({
    lat,
    lng,
    radius: radiusMiles,
    unit: 'miles',
    startDateTime,
    endDateTime,
    classificationName: classification,
    size: 200,
    sort: 'date,asc',
  });

  const listings: Partial<Listing>[] = [];

  for (const event of events) {
    const listing = convertTicketmasterEventToListing(event);
    if (listing) {
      listings.push(listing);
    }
  }

  return listings;
}

/**
 * Ticketmaster Classification Names
 */
export const TICKETMASTER_CLASSIFICATIONS = {
  MUSIC: 'Music',
  SPORTS: 'Sports',
  ARTS_THEATRE: 'Arts & Theatre',
  FILM: 'Film',
  MISCELLANEOUS: 'Miscellaneous',
  FAMILY: 'Family',
};

/**
 * Check if Ticketmaster API is configured
 */
export function isTicketmasterConfigured(): boolean {
  return !!TICKETMASTER_API_KEY;
}

