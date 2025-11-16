import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getAuthState } from './authStore';

type SwipeRecord = {
  listingId: string;
  direction: 'left' | 'right';
  category: string;
  tags: string[];
  timestamp: number;
};

type SwipeHistoryState = {
  history: SwipeRecord[];
};

const DEFAULT_STATE: SwipeHistoryState = {
  history: [],
};

const STORAGE_KEY = 'swipe-history';
const MAX_HISTORY = 200; // Keep last 200 swipes

let listeners: Array<() => void> = [];
let state: SwipeHistoryState = { ...DEFAULT_STATE };

// Load from storage (only in browser)
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(STORAGE_KEY).then((data) => {
    if (data) {
      state = JSON.parse(data);
      listeners.forEach((l) => l());
    }
  }).catch(() => {});
}

function updateState(updates: Partial<SwipeHistoryState>) {
  state = { ...state, ...updates };
  if (typeof window !== 'undefined') {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }
  listeners.forEach((l) => l());
}

export function recordSwipe(listingId: string, direction: 'left' | 'right', category: string, tags: string[] = []) {
  const record: SwipeRecord = {
    listingId,
    direction,
    category,
    tags,
    timestamp: Date.now(),
  };
  
  const newHistory = [record, ...state.history].slice(0, MAX_HISTORY);
  updateState({ history: newHistory });

  // Also save to Supabase if authenticated
  const { user } = getAuthState();
  if (user && isSupabaseConfigured()) {
    supabase!
      .from('swipes')
      .insert({
        user_id: user.id,
        listing_id: listingId,
        direction,
      })
      .then(({ error }) => {
        if (error) console.error('Failed to record swipe in Supabase:', error);
      });
  }
}

export function getRecommendationScore(category: string, tags: string[]): number {
  // Calculate score based on swipe history
  const recentSwipes = state.history.slice(0, 50); // Last 50 swipes
  const likedSwipes = recentSwipes.filter(s => s.direction === 'right');
  
  if (likedSwipes.length === 0) return 0;
  
  let score = 0;
  
  // Category match: +10 points
  const categoryMatches = likedSwipes.filter(s => s.category === category).length;
  score += (categoryMatches / likedSwipes.length) * 10;
  
  // Tag overlap: +5 points per matching tag
  const likedTags = new Set(likedSwipes.flatMap(s => s.tags));
  const matchingTags = tags.filter(t => likedTags.has(t)).length;
  score += matchingTags * 5;
  
  return score;
}

export function getTrendingListings(): Set<string> {
  // Find listings with multiple right swipes (popular)
  const likesByListing = new Map<string, number>();
  
  state.history
    .filter(s => s.direction === 'right')
    .forEach(s => {
      likesByListing.set(s.listingId, (likesByListing.get(s.listingId) || 0) + 1);
    });
  
  // Trending = 3+ likes
  const trending = new Set<string>();
  likesByListing.forEach((count, id) => {
    if (count >= 3) trending.add(id);
  });
  
  return trending;
}

export function useSwipeHistoryStore() {
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
    recordSwipe,
    getRecommendationScore,
    getTrendingListings,
  };
}

