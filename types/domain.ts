export type Category =
  | 'food'
  | 'outdoors'
  | 'nightlife'
  | 'events'
  | 'coffee'
  | 'museum'
  | 'activities'
  | 'shopping'
  | 'neighborhood'
  | 'arts-culture'
  | 'live-music'
  | 'games-entertainment'
  | 'relax-recharge'
  | 'sports-recreation'
  | 'drinks-bars'
  | 'pet-friendly'
  | 'road-trip-getaways'
  | 'festivals-pop-ups'
  | 'fitness-classes'
  | 'hotels';

export type DataSource = 'seed' | 'business' | 'google_places' | 'eventbrite';

export interface Listing {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  category: Category | string;
  price_tier?: number;
  latitude: number;
  longitude: number;
  city: string;
  source?: DataSource;
  external_id?: string;
  event_start_date?: string; // ISO date
  event_end_date?: string; // ISO date
  source_metadata?: Record<string, any>;
  last_synced_at?: string; // ISO date
  images?: string[];
  tags?: string[];
  distanceKm?: number | null;
  hours?: string;
  phone?: string;
  website?: string;
  is_published?: boolean;
  is_featured?: boolean;
  created_at?: string; // ISO date
  upvoteCount?: number;
  hasUserUpvoted?: boolean;
}

// Locals' Favorites (User-Generated Content)
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type Vibe = 'romantic' | 'chill' | 'fun' | 'adventurous' | 'family-friendly' | 'trendy' | 'hidden-gem';

export interface LocalFavorite {
  id: string;
  user_id: string;
  
  // Basic Info
  name: string;
  category: Category | string;
  description?: string;
  
  // Location
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  
  // Media
  photo_url?: string;
  photos?: string[];
  
  // Optional Details
  hours?: string;
  price_tier?: number;
  website?: string;
  
  // Tags & Vibes
  tags?: string[];
  vibes?: Vibe[];
  
  // Moderation
  status: ModerationStatus;
  rejection_reason?: string;
  moderated_by?: string;
  moderated_at?: string; // ISO date
  
  // Engagement
  likes_count: number;
  saves_count: number;
  views_count: number;
  
  // Metadata
  created_at: string; // ISO date
  updated_at: string; // ISO date
  
  // Computed/joined fields
  distanceKm?: number | null;
  is_liked?: boolean;
  is_saved?: boolean;
  user_display_name?: string;
}

