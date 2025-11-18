/**
 * Developer account management
 * Developers have access to moderation features
 */

import { supabase, isSupabaseConfigured } from './supabase';

export interface DeveloperAccount {
  id: string;
  user_id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

/**
 * Register current user as a developer
 */
export async function registerAsDeveloper(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured');
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) {
    console.error('User not authenticated');
    return false;
  }

  try {
    const { error } = await supabase!
      .from('developers')
      .insert({
        user_id: user.id,
        email: user.email,
      });

    if (error) {
      // Check if already registered
      if (error.code === '23505') {
        console.log('Already registered as developer');
        return true;
      }
      console.error('Error registering as developer:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error registering as developer:', error);
    return false;
  }
}

/**
 * Check if current user is a developer
 */
export async function isDeveloper(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return false;

  try {
    const { data, error } = await supabase!
      .from('developers')
      .select('is_active')
      .eq('user_id', user.id)
      .single();

    if (error) return false;
    return data?.is_active === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get developer account info
 */
export async function getDeveloperAccount(): Promise<DeveloperAccount | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase!
      .from('developers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) return null;
    return data as DeveloperAccount;
  } catch (error) {
    return null;
  }
}

