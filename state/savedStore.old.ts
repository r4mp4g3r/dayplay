import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Listing } from '@/types/domain';

export type SavedItem = Listing & {
  listName?: string; // 'default', 'date-ideas', 'weekend-plans', etc.
  savedAt: number;
};

type SavedState = {
  savedItems: SavedItem[];
};

const DEFAULT_STATE: SavedState = {
  savedItems: [],
};

const STORAGE_KEY = 'saved-store';

let listeners: Array<() => void> = [];
let state: SavedState = { ...DEFAULT_STATE };
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

function updateState(updates: Partial<SavedState>) {
  state = { ...state, ...updates };
  if (typeof window !== 'undefined') {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }
  listeners.forEach((l) => l());
}

export function useSavedStore(selector?: (state: SavedState & {
  save: (item: Listing, listName?: string) => void;
  unsave: (id: string) => void;
  isSaved: (id: string) => boolean;
  clear: () => void;
  moveToList: (id: string, listName: string) => void;
  getListItems: (listName?: string) => SavedItem[];
  getAllLists: () => string[];
}) => any) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const fullState = {
    ...state,
    save: (item: Listing, listName = 'default') => {
      console.log('savedStore.save called:', item.id, item.title, 'to list:', listName);
      if (!state.savedItems.find((s) => s.id === item.id)) {
        const savedItem: SavedItem = { ...item, listName, savedAt: Date.now() };
        console.log('savedStore: Adding to state, new count will be:', state.savedItems.length + 1);
        updateState({ savedItems: [savedItem, ...state.savedItems] });
      } else {
        console.log('savedStore: Item already saved, skipping');
      }
    },
    unsave: (id: string) => {
      updateState({ savedItems: state.savedItems.filter((s) => s.id !== id) });
    },
    isSaved: (id: string) => !!state.savedItems.find((s) => s.id === id),
    clear: () => updateState({ savedItems: [] }),
    moveToList: (id: string, listName: string) => {
      const items = state.savedItems.map((s) => s.id === id ? { ...s, listName } : s);
      updateState({ savedItems: items });
    },
    getListItems: (listName?: string) => {
      if (!listName) return state.savedItems;
      return state.savedItems.filter((s) => s.listName === listName);
    },
    getAllLists: () => {
      const lists = new Set(state.savedItems.map((s) => s.listName || 'default'));
      return Array.from(lists);
    },
  };

  return selector ? selector(fullState) : fullState;
}
