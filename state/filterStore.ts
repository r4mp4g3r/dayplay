import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type FilterState = {
  categories: string[];
  priceTiers: number[];
  distanceKm: number;
  vibes: string[];
  showNewThisWeek: boolean;
  showOpenNow: boolean;
};

const DEFAULT_STATE: FilterState = {
  categories: [],
  priceTiers: [1, 2, 3, 4],
  distanceKm: 50,
  vibes: [],
  showNewThisWeek: false,
  showOpenNow: false,
};

const STORAGE_KEY = 'filter-store';

let listeners: Array<() => void> = [];
let state: FilterState = { ...DEFAULT_STATE };
let loaded = false;

// Load from storage (only in browser)
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(STORAGE_KEY).then((data) => {
    if (data) {
      state = { ...DEFAULT_STATE, ...JSON.parse(data) };
      loaded = true;
      listeners.forEach((l) => l());
    }
  }).catch(() => {
    loaded = true;
  });
}

function updateState(updates: Partial<FilterState>) {
  state = { ...state, ...updates };
  if (typeof window !== 'undefined') {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }
  listeners.forEach((l) => l());
}

export function useFilterStore() {
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
    setCategories: (v: string[]) => updateState({ categories: v }),
    setPriceTiers: (v: number[]) => updateState({ priceTiers: v }),
    setDistanceKm: (v: number) => updateState({ distanceKm: v }),
    setVibes: (v: string[]) => updateState({ vibes: v }),
    setShowNewThisWeek: (v: boolean) => updateState({ showNewThisWeek: v }),
    setShowOpenNow: (v: boolean) => updateState({ showOpenNow: v }),
    setInitialFromOnboarding: ({ categories }: { categories: string[] }) => updateState({ categories }),
  };
}
