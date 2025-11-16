import { supabase, isSupabaseConfigured } from './supabase';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export type AuthUser = User | null;
export type AuthSession = Session | null;

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' && window.location.origin
        ? `${window.location.origin}/`
        : process.env.EXPO_PUBLIC_SITE_URL || 'swipely://',
    },
  });

  if (error) {
    // Supabase error messages for common issues
    if (error.message.toLowerCase().includes('user already registered')) {
      throw new Error('This email is already registered. Try signing in instead.');
    }
    if (error.message.toLowerCase().includes('invalid email')) {
      throw new Error('Please enter a valid email address.');
    }
    if (error.message.toLowerCase().includes('password')) {
      throw new Error('Password must be at least 6 characters.');
    }
    throw error;
  }

  // Check if user was created or already exists
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    // Email exists but not confirmed - Supabase returns user but with empty identities
    throw new Error('This email is already registered. Please check your email to confirm your account, or sign in.');
  }
  
  return data;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase!.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with magic link (passwordless)
 */
export async function signInWithMagicLink(email: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error} = await supabase!.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: process.env.EXPO_PUBLIC_SITE_URL || 'swipely://',
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase!.auth.resetPasswordForEmail(email, {
    redirectTo: process.env.EXPO_PUBLIC_SITE_URL || 'swipely://',
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase!.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  return user;
}

/**
 * Get the current session
 */
export async function getSession(): Promise<AuthSession> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data: { session } } = await supabase!.auth.getSession();
  return session;
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: AuthSession) => void
) {
  if (!isSupabaseConfigured()) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  return supabase!.auth.onAuthStateChange(callback);
}

/**
 * Refresh the current session
 */
export async function refreshSession() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase!.auth.refreshSession();
  if (error) throw error;
  return data.session;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get user ID (or null if not authenticated)
 */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

/**
 * Sign in with Apple (iOS only)
 */
export async function signInWithApple() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign-In is only available on iOS');
  }

  try {
    const nonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString()
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const { data, error } = await supabase!.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken!,
      nonce,
    });

    if (error) throw error;
    return data;
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Apple Sign-In was canceled');
    }
    throw error;
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured');
  }

  // For web, use Supabase's OAuth flow
  if (Platform.OS === 'web') {
    const { data, error } = await supabase!.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' && window.location.origin
          ? `${window.location.origin}/`
          : 'swipely://',
      },
    });

    if (error) throw error;
    return data;
  }

  // For native, would use @react-native-google-signin/google-signin
  // Requires Google Cloud Console setup with OAuth client IDs
  throw new Error('Google Sign-In on mobile requires additional setup. Use web for now or see docs.');
}

/**
 * Check if Apple Sign-In is available
 */
export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return await AppleAuthentication.isAvailableAsync();
}

