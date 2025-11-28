import { useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getCurrentUser, getSession, onAuthStateChange, signOut as supaSignOut } from '@/lib/auth';

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isGuest: boolean;
};

const DEFAULT_STATE: AuthState = {
  user: null,
  session: null,
  loading: true,
  isGuest: true,
};

let listeners: Array<() => void> = [];
let state: AuthState = { ...DEFAULT_STATE };

// Initialize auth state with timeout
async function initializeAuth() {
  // Set a timeout to ensure loading is always set to false
  const timeout = setTimeout(() => {
    if (state.loading) {
      console.warn('Auth initialization timeout, defaulting to no user');
      state = { ...DEFAULT_STATE, loading: false };
      listeners.forEach((l) => l());
    }
  }, 3000); // 3 second timeout

  try {
    const [user, session] = await Promise.all([
      getCurrentUser().catch((err) => {
        console.error('Error getting current user:', err);
        return null;
      }),
      getSession().catch((err) => {
        console.error('Error getting session:', err);
        return null;
      }),
    ]);
    
    clearTimeout(timeout);
    state = {
      user,
      session,
      loading: false,
      isGuest: user === null,
    };
    listeners.forEach((l) => l());
  } catch (error) {
    clearTimeout(timeout);
    console.error('Auth initialization error:', error);
    state = { ...DEFAULT_STATE, loading: false };
    listeners.forEach((l) => l());
  }
}

// Listen for auth changes
onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', event, session?.user?.email);
  
  // If the refresh token failed (expired/revoked), sign out and reset state gracefully
  if (event === 'TOKEN_REFRESH_FAILED') {
    try {
      await supaSignOut();
    } catch {}
    state = { ...DEFAULT_STATE, loading: false };
    listeners.forEach((l) => l());
    return;
  }
  
  const nowAuthenticated = session?.user !== undefined && session?.user !== null;
  
  state = {
    user: session?.user || null,
    session,
    loading: false,
    isGuest: !nowAuthenticated,
  };
  
  listeners.forEach((l) => l());
});

// Start initialization
if (typeof window !== 'undefined') {
  initializeAuth();
}

function updateState(updates: Partial<AuthState>) {
  state = { ...state, ...updates };
  listeners.forEach((l) => l());
}

export function useAuthStore() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    ...state,
    setUser: (user: User | null, session: Session | null) => {
      updateState({ user, session, isGuest: user === null });
    },
    setLoading: (loading: boolean) => {
      updateState({ loading });
    },
    clearUser: () => {
      updateState({ user: null, session: null, isGuest: true });
    },
  };
}

// For non-hook access
export function getAuthState() {
  return state;
}

