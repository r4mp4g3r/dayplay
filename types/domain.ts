export type Category =
  | 'food'
  | 'outdoors'
  | 'nightlife'
  | 'events'
  | 'coffee'
  | 'museum'
  | 'activities'
  | 'shopping'
  | 'neighborhood';

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
  images?: string[];
  tags?: string[];
  distanceKm?: number | null;
  hours?: string;
  phone?: string;
  website?: string;
  is_featured?: boolean;
  created_at?: string; // ISO date
}


