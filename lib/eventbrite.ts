/**
 * Eventbrite API Integration
 * Docs: https://www.eventbrite.com/platform/api
 */

import type { Listing } from '@/types/domain';

const EVENTBRITE_API_TOKEN = process.env.EVENTBRITE_API_TOKEN || process.env.EXPO_PUBLIC_EVENTBRITE_API_TOKEN;
const BASE_URL = 'https://www.eventbriteapi.com/v3';

// Eventbrite API Types
interface EventbriteVenue {
  id: string;
  name: string;
  address?: {
    address_1?: string;
    address_2?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    country?: string;
    latitude?: string;
    longitude?: string;
    localized_address_display?: string;
  };
}

interface EventbriteImage {
  id: string;
  url: string;
  original?: {
    url: string;
    width: number;
    height: number;
  };
}

interface EventbriteTicketClass {
  id: string;
  name: string;
  free: boolean;
  cost?: {
    display: string;
    currency: string;
    value: number;
  };
}

interface EventbriteEvent {
  id: string;
  name: {
    text: string;
  };
  description: {
    text: string;
    html: string;
  };
  url: string;
  start: {
    timezone: string;
    local: string;
    utc: string;
  };
  end: {
    timezone: string;
    local: string;
    utc: string;
  };
  organization_id: string;
  created: string;
  changed: string;
  published: string;
  capacity?: number;
  capacity_is_custom?: boolean;
  status: string;
  currency: string;
  listed: boolean;
  shareable: boolean;
  online_event: boolean;
  tx_time_limit?: number;
  hide_start_date: boolean;
  hide_end_date: boolean;
  locale: string;
  is_locked: boolean;
  privacy_setting: string;
  is_series: boolean;
  is_series_parent: boolean;
  inventory_type: string;
  is_reserved_seating: boolean;
  show_pick_a_seat: boolean;
  show_seatmap_thumbnail: boolean;
  show_colors_in_seatmap_thumbnail: boolean;
  source: string;
  is_free: boolean;
  version?: string;
  summary: string;
  logo_id?: string;
  organizer_id: string;
  venue_id?: string;
  category_id?: string;
  subcategory_id?: string;
  format_id?: string;
  resource_uri: string;
  is_externally_ticketed: boolean;
  venue?: EventbriteVenue;
  logo?: EventbriteImage;
  ticket_classes?: EventbriteTicketClass[];
}

interface EventSearchResponse {
  pagination: {
    object_count: number;
    page_number: number;
    page_size: number;
    page_count: number;
    has_more_items: boolean;
  };
  events: EventbriteEvent[];
}

interface EventSearchParams {
  lat?: number;
  lng?: number;
  radius?: string; // e.g., '10km', '5mi'
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  categories?: string; // comma-separated category IDs
  priceType?: 'free' | 'paid';
  page?: number;
}

/**
 * Eventbrite category IDs mapping
 * Full list: https://www.eventbrite.com/platform/api#/reference/category
 */
const EVENTBRITE_CATEGORIES = {
  MUSIC: '103',
  BUSINESS: '101',
  FOOD_AND_DRINK: '110',
  COMMUNITY: '113',
  ARTS: '105',
  FILM_AND_MEDIA: '104',
  SPORTS_AND_FITNESS: '108',
  HEALTH: '107',
  SCIENCE_AND_TECH: '102',
  TRAVEL: '109',
  CHARITY: '111',
  RELIGION: '114',
  FAMILY: '115',
  EDUCATION: '116',
  HOLIDAY: '119',
  GOVERNMENT: '112',
  FASHION: '106',
  HOME_AND_LIFESTYLE: '117',
  AUTO: '118',
  HOBBIES: '119',
  SCHOOL_ACTIVITIES: '120',
};

/**
 * Search for events by location
 */
export async function searchEvents(params: EventSearchParams): Promise<EventbriteEvent[]> {
  if (!EVENTBRITE_API_TOKEN) {
    console.warn('Eventbrite API token not configured');
    return [];
  }

  const url = new URL(`${BASE_URL}/events/search/`);
  
  // Location parameters
  if (params.lat && params.lng) {
    url.searchParams.append('location.latitude', params.lat.toString());
    url.searchParams.append('location.longitude', params.lng.toString());
    url.searchParams.append('location.within', params.radius || '10km');
  }
  
  // Date parameters
  if (params.startDate) {
    url.searchParams.append('start_date.range_start', params.startDate);
  }
  
  if (params.endDate) {
    url.searchParams.append('start_date.range_end', params.endDate);
  }
  
  // Category filter
  if (params.categories) {
    url.searchParams.append('categories', params.categories);
  }
  
  // Price filter
  if (params.priceType === 'free') {
    url.searchParams.append('price', 'free');
  }
  
  // Pagination
  url.searchParams.append('page', (params.page || 1).toString());
  url.searchParams.append('expand', 'venue,logo,ticket_classes');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${EVENTBRITE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error('Eventbrite API error:', response.status, response.statusText);
      return [];
    }

    const data: EventSearchResponse = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Error fetching Eventbrite events:', error);
    return [];
  }
}

/**
 * Get detailed event information
 */
export async function getEventDetails(eventId: string): Promise<EventbriteEvent | null> {
  if (!EVENTBRITE_API_TOKEN) {
    console.warn('Eventbrite API token not configured');
    return null;
  }

  const url = new URL(`${BASE_URL}/events/${eventId}/`);
  url.searchParams.append('expand', 'venue,logo,ticket_classes');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${EVENTBRITE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error('Eventbrite API error:', response.status, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching event details:', error);
    return null;
  }
}

/**
 * Determine price tier from ticket classes
 */
function calculatePriceTier(ticketClasses?: EventbriteTicketClass[]): number {
  if (!ticketClasses || ticketClasses.length === 0) return 1;
  
  // If all tickets are free
  if (ticketClasses.every(tc => tc.free)) return 1;
  
  // Find the cheapest paid ticket
  const paidTickets = ticketClasses.filter(tc => !tc.free && tc.cost?.value);
  if (paidTickets.length === 0) return 1;
  
  const minPrice = Math.min(...paidTickets.map(tc => tc.cost!.value / 100)); // Convert cents to dollars
  
  // Map to tier (1-4 scale)
  if (minPrice <= 20) return 1;
  if (minPrice <= 50) return 2;
  if (minPrice <= 100) return 3;
  return 4;
}

/**
 * Extract city from venue or default
 */
function extractCity(event: EventbriteEvent, defaultCity: string = 'Unknown'): string {
  return event.venue?.address?.city || defaultCity;
}

/**
 * Generate subtitle from date and venue
 */
function generateSubtitle(event: EventbriteEvent): string {
  const date = new Date(event.start.local);
  const dateStr = date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  
  const venueName = event.venue?.name;
  
  if (venueName) {
    return `${dateStr} • ${venueName}`;
  }
  
  return dateStr;
}

/**
 * Convert Eventbrite Event to Swipely Listing
 */
export function convertEventbriteEventToListing(
  event: EventbriteEvent,
  defaultCity?: string
): Partial<Listing> {
  const city = extractCity(event, defaultCity);
  const priceTier = calculatePriceTier(event.ticket_classes);
  
  // Extract coordinates from venue
  const latitude = event.venue?.address?.latitude 
    ? parseFloat(event.venue.address.latitude) 
    : 0;
  const longitude = event.venue?.address?.longitude 
    ? parseFloat(event.venue.address.longitude) 
    : 0;
  
  // Build images array
  const images: string[] = [];
  if (event.logo?.original?.url) {
    images.push(event.logo.original.url);
  }
  
  // Generate tags based on event properties
  const tags: string[] = [];
  if (event.is_free) tags.push('free');
  if (event.online_event) tags.push('virtual');
  if (event.is_series) tags.push('series');
  
  return {
    id: `eb_${event.id}`,
    external_id: event.id,
    source: 'eventbrite',
    title: event.name.text,
    subtitle: generateSubtitle(event),
    description: event.description.text || event.summary,
    category: 'events',
    price_tier: priceTier,
    latitude,
    longitude,
    city,
    event_start_date: event.start.utc,
    event_end_date: event.end.utc,
    images,
    tags,
    website: event.url,
    is_published: event.listed && event.status === 'live',
    source_metadata: {
      eventbrite_url: event.url,
      online_event: event.online_event,
      capacity: event.capacity,
      is_free: event.is_free,
      venue_name: event.venue?.name,
      venue_address: event.venue?.address?.localized_address_display,
      category_id: event.category_id,
      format_id: event.format_id,
    },
    last_synced_at: new Date().toISOString(),
  };
}

/**
 * Get upcoming events for a location
 */
export async function getUpcomingEvents(
  lat: number,
  lng: number,
  radius: string = '25km',
  daysAhead: number = 30
): Promise<Partial<Listing>[]> {
  const startDate = new Date().toISOString();
  const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  
  const events = await searchEvents({
    lat,
    lng,
    radius,
    startDate,
    endDate,
  });
  
  return events.map(event => convertEventbriteEventToListing(event));
}

/**
 * Get events by category
 */
export async function getEventsByCategory(
  lat: number,
  lng: number,
  categoryIds: string[],
  radius: string = '25km'
): Promise<Partial<Listing>[]> {
  const startDate = new Date().toISOString();
  const endDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ahead
  
  const events = await searchEvents({
    lat,
    lng,
    radius,
    startDate,
    endDate,
    categories: categoryIds.join(','),
  });
  
  return events.map(event => convertEventbriteEventToListing(event));
}

/**
 * Check if Eventbrite API is configured
 */
export function isEventbriteConfigured(): boolean {
  return !!EVENTBRITE_API_TOKEN;
}

export { EVENTBRITE_CATEGORIES };

