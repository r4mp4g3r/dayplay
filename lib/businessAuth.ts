import { supabase, isSupabaseConfigured } from './supabase';
import { signUp as userSignUp, signIn as userSignIn, signOut } from './auth';

export type BusinessProfile = {
  id: string;
  user_id: string;
  business_name: string;
  contact_email: string;
  contact_phone?: string;
  website?: string;
  is_verified: boolean;
  is_active: boolean;
  subscription_tier: 'free' | 'basic' | 'premium';
  created_at: string;
};

/**
 * Sign up as a business (creates user account + business profile)
 */
export async function businessSignUp(
  email: string,
  password: string,
  businessName: string,
  phone?: string,
  website?: string
) {
  // First create user account
  const authResult = await userSignUp(email, password);
  
  if (!authResult.user) {
    throw new Error('Failed to create user account');
  }

  // Wait a moment for auth session to establish
  await new Promise(resolve => setTimeout(resolve, 500));

  // Refresh the session to ensure auth.uid() is available
  await supabase!.auth.refreshSession();

  // Then create business profile
  const { data, error } = await supabase!
    .from('business_profiles')
    .insert({
      user_id: authResult.user.id,
      business_name: businessName,
      contact_email: email,
      contact_phone: phone,
      website,
    })
    .select()
    .single();

  if (error) {
    console.error('Business profile creation error:', error);
    // If RLS error, provide helpful message
    if (error.code === '42501') {
      throw new Error('Session not ready. Please try signing in instead, then create your business profile from the Business Portal.');
    }
    throw error;
  }
  
  return { user: authResult.user, businessProfile: data as BusinessProfile };
}

/**
 * Sign in as a business (same as regular sign-in, then fetch business profile)
 */
export async function businessSignIn(email: string, password: string) {
  const authResult = await userSignIn(email, password);
  
  if (!authResult.user) {
    throw new Error('Failed to sign in');
  }

  // Fetch business profile
  const { data, error } = await supabase!
    .from('business_profiles')
    .select('*')
    .eq('user_id', authResult.user.id)
    .single();

  if (error) {
    throw new Error('No business profile found. Are you sure you have a business account?');
  }

  return { user: authResult.user, businessProfile: data as BusinessProfile };
}

/**
 * Get current business profile
 */
export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  if (!isSupabaseConfigured()) return null;

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase!
    .from('business_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) return null;
  return data as BusinessProfile;
}

/**
 * Update business profile
 */
export async function updateBusinessProfile(updates: Partial<BusinessProfile>) {
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase!
    .from('business_profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data as BusinessProfile;
}

/**
 * Submit a new listing for approval
 */
export async function submitListingForApproval(listingData: {
  title: string;
  subtitle?: string;
  description?: string;
  category: string;
  price_tier?: number;
  latitude: number;
  longitude: number;
  city: string;
  hours?: string;
  phone?: string;
  website?: string;
}) {
  const businessProfile = await getBusinessProfile();
  if (!businessProfile) throw new Error('No business profile found');

  const { data, error } = await supabase!
    .from('pending_listings')
    .insert({
      business_id: businessProfile.id,
      ...listingData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get business's listings (approved)
 */
export async function getBusinessListings() {
  const businessProfile = await getBusinessProfile();
  if (!businessProfile) return [];

  // Find listings created by this business (via pending_listings that were approved)
  const { data, error } = await supabase!
    .from('listings')
    .select('*')
    .eq('source', `business-${businessProfile.id}`)
    .eq('is_published', true);

  if (error) throw error;
  return data || [];
}

/**
 * Create a promotion for a listing
 */
export async function createPromotion(
  listingId: string,
  boostLevel: 1 | 2 | 3,
  durationDays: number,
  targetCities?: string[]
) {
  const businessProfile = await getBusinessProfile();
  if (!businessProfile) throw new Error('No business profile found');

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  // Calculate budget based on boost level and duration
  const dailyRate = boostLevel === 1 ? 500 : boostLevel === 2 ? 1500 : 5000; // cents
  const budgetCents = dailyRate * durationDays;

  const { data, error } = await supabase!
    .from('promotions')
    .insert({
      business_id: businessProfile.id,
      listing_id: listingId,
      boost_level: boostLevel,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      target_cities: targetCities,
      budget_cents: budgetCents,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get analytics for business
 */
export async function getBusinessAnalytics(dateRange: { start: Date; end: Date }) {
  const businessProfile = await getBusinessProfile();
  if (!businessProfile) return [];

  const { data, error } = await supabase!
    .from('business_analytics')
    .select('*')
    .eq('business_id', businessProfile.id)
    .gte('created_at', dateRange.start.toISOString())
    .lte('created_at', dateRange.end.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Track analytics event (called from app when users interact)
 */
export async function trackBusinessAnalytics(
  listingId: string,
  metricType: 'view' | 'swipe_right' | 'swipe_left' | 'save' | 'share' | 'directions' | 'call' | 'website_click'
) {
  if (!isSupabaseConfigured()) return;

  // Find if this listing belongs to a business
  const { data: listing } = await supabase!
    .from('listings')
    .select('source')
    .eq('id', listingId)
    .single();

  if (!listing || !listing.source.startsWith('business-')) return;

  const businessId = listing.source.replace('business-', '');
  
  const { data: { user } } = await supabase!.auth.getUser();

  await supabase!
    .from('business_analytics')
    .insert({
      business_id: businessId,
      listing_id: listingId,
      metric_type: metricType,
      user_id: user?.id || null,
    });
}

