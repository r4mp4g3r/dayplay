import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type UpvoteState = {
  upvotedListings: Set<string>;
  upvoteCounts: Record<string, number>;
};

const DEFAULT_STATE: UpvoteState = {
  upvotedListings: new Set<string>(),
  upvoteCounts: {},
};

let listeners: Array<() => void> = [];
let state: UpvoteState = { ...DEFAULT_STATE };

function emitChange() {
  listeners.forEach((listener) => listener());
}

function addUpvote(listingId: string) {
  state.upvotedListings = new Set(state.upvotedListings).add(listingId);
  emitChange();
}

function removeUpvote(listingId: string) {
  const newSet = new Set(state.upvotedListings);
  newSet.delete(listingId);
  state.upvotedListings = newSet;
  emitChange();
}

function setUpvoteCount(listingId: string, count: number) {
  state.upvoteCounts = {
    ...state.upvoteCounts,
    [listingId]: count,
  };
  emitChange();
}

function incrementUpvoteCount(listingId: string) {
  state.upvoteCounts = {
    ...state.upvoteCounts,
    [listingId]: (state.upvoteCounts[listingId] || 0) + 1,
  };
  emitChange();
}

function decrementUpvoteCount(listingId: string) {
  state.upvoteCounts = {
    ...state.upvoteCounts,
    [listingId]: Math.max(0, (state.upvoteCounts[listingId] || 0) - 1),
  };
  emitChange();
}

async function loadUserUpvotes(userId: string) {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('listing_upvotes')
      .select('listing_id')
      .eq('user_id', userId);

    if (error) throw error;

    state.upvotedListings = new Set(data.map((row: any) => row.listing_id));
    emitChange();
  } catch (error) {
    console.error('Load user upvotes error:', error);
  }
}

function hasUpvoted(listingId: string): boolean {
  return state.upvotedListings.has(listingId);
}

export function useUpvoteStore() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    upvotedListings: state.upvotedListings,
    upvoteCounts: state.upvoteCounts,
    addUpvote,
    removeUpvote,
    setUpvoteCount,
    incrementUpvoteCount,
    decrementUpvoteCount,
    loadUserUpvotes,
    hasUpvoted,
  };
}

