import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type OnboardingState = {
  completed: boolean;
};

const DEFAULT_STATE: OnboardingState = {
  completed: false,
};

const STORAGE_KEY = 'onboarding-completed';

let listeners: Array<() => void> = [];
let state: OnboardingState = { ...DEFAULT_STATE };
let loaded = false;

// Load from storage (only in browser)
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(STORAGE_KEY).then((data) => {
    if (data) {
      state = { completed: data === 'true' };
      loaded = true;
      listeners.forEach((l) => l());
    }
  }).catch(() => {
    loaded = true;
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

