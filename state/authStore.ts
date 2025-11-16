import { useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getCurrentUser, getSession, onAuthStateChange } from '@/lib/auth';

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

// Initialize auth state
async function initializeAuth() {
  try {
    const [user, session] = await Promise.all([getCurrentUser(), getSession()]);
    state = {
      user,
      session,
      loading: false,
      isGuest: user === null,
    };
    listeners.forEach((l) => l());
  } catch (error) {
    console.error('Auth initialization error:', error);
    state = { ...DEFAULT_STATE, loading: false };
    listeners.forEach((l) => l());
  }
}

// Listen for auth changes
onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event, session?.user?.email);
  
  const wasGuest = state.isGuest;
  const nowAuthenticated = session?.user !== undefined && session?.user !== null;
  
  state = {
    user: session?.user || null,
    session,
    loading: false,
    isGuest: !nowAuthenticated,
  };
  
  // Trigger sync prompt if user just signed in/up from guest
  if (wasGuest && nowAuthenticated && event === 'SIGNED_IN') {
    // Trigger will be handled by components listening to auth state
    console.log('User signed in - components should show sync prompt if needed');
  }
  
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

