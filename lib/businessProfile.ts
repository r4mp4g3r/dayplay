/**
 * Business Profile Management
 * Separate from businessAuth.ts for better organization
 */

import { supabase, isSupabaseConfigured } from './supabase';

export interface BusinessProfileData {
  business_name: string;
  contact_email: string;
  contact_phone?: string;
  website?: string;
}

/**
 * Create a business profile for the current user
 */
export async function createBusinessProfile(data: BusinessProfileData): Promise<any> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  console.log('Creating business profile for user:', user.id);
  console.log('Business data:', data);

  try {
    const { data: profile, error } = await supabase!
      .from('business_profiles')
      .insert({
        user_id: user.id,
        business_name: data.business_name,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone || null,
        website: data.website || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating business profile:', error);
      
      // Better error messages
      if (error.code === '42501') {
        throw new Error('Permission denied. Please make sure you are signed in and try again.');
      }
      if (error.code === '23505') {
        throw new Error('You already have a business profile.');
      }
      
      throw new Error(error.message || 'Failed to create business profile');
    }

    console.log('Business profile created:', profile);
    return profile;
  } catch (error: any) {
    console.error('Error in createBusinessProfile:', error);
    throw error;
  }
}

/**
 * Check if current user has a business profile
 */
export async function hasBusinessProfile(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { data, error } = await supabase!
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    return !!data && !error;
  } catch (error) {
    return false;
  }
}

