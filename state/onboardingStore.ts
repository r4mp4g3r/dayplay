import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type OnboardingState = {
  completed: boolean;
  loaded: boolean;
};

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  loaded: false,
};

const STORAGE_KEY = 'onboarding-completed';

let listeners: Array<() => void> = [];
let state: OnboardingState = { ...DEFAULT_STATE };

// Load from storage with timeout
if (typeof window !== 'undefined') {
  // Set a timeout to ensure loaded is always set (safety net)
  const timeout = setTimeout(() => {
    if (!state.loaded) {
      console.warn('Onboarding store load timeout, defaulting to not completed');
      state = { completed: false, loaded: true };
      listeners.forEach((l) => l());
    }
  }, 2000); // 2 second timeout

  AsyncStorage.getItem(STORAGE_KEY)
    .then((data) => {
      clearTimeout(timeout);
      // CRITICAL FIX: Always set loaded and notify, even if data is null
      if (data) {
        state = { completed: data === 'true', loaded: true };
      } else {
        state = { completed: false, loaded: true };
      }
      // Always notify listeners, regardless of data value
      listeners.forEach((l) => l());
    })
    .catch((error) => {
      clearTimeout(timeout);
      console.error('Error loading onboarding state:', error);
      // CRITICAL FIX: Also set loaded on error
      state = { completed: false, loaded: true };
      listeners.forEach((l) => l());
    });
}

function updateState(updates: Partial<OnboardingState>) {
  state = { ...state, ...updates };
  if (typeof window !== 'undefined') {
    AsyncStorage.setItem(STORAGE_KEY, String(state.completed)).catch(() => {});
  }
  listeners.forEach((l) => l());
}

export function useOnboardingStore() {
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
    setCompleted: (completed: boolean) => updateState({ completed }),
  };
}

