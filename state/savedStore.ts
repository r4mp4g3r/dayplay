import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getAuthState } from './authStore';
import type { Listing } from '@/types/domain';

export type SavedItem = Listing & {
  listName?: string;
  savedAt: number;
};

type SavedState = {
  savedItems: SavedItem[];
  syncing: boolean;
};

const DEFAULT_STATE: SavedState = {
  savedItems: [],
  syncing: false,
};

const STORAGE_KEY = 'saved-store';

let listeners: Array<() => void> = [];
let state: SavedState = { ...DEFAULT_STATE };
let subscription: any = null;

// Load from local storage
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(STORAGE_KEY).then((data) => {
    if (data) {
      state = { ...DEFAULT_STATE, ...JSON.parse(data) };
      listeners.forEach((l) => l());
    }
  }).catch(() => {});
}

function updateState(updates: Partial<SavedState>) {
  state = { ...state, ...updates };
  // Save to local storage
  if (typeof window !== 'undefined') {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ savedItems: state.savedItems })).catch(() => {});
  }
  listeners.forEach((l) => l());
}

/**
 * Load saves from Supabase for authenticated user
 */
async function loadFromSupabase() {
  if (!isSupabaseConfigured()) return;
  
  const { user } = getAuthState();
  if (!user) return;

  try {
    const { data, error } = await supabase!
      .from('saves')
      .select(`
        id,
        list_name,
        created_at,
        listing:listings(*, listing_photos(url, sort_order))
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const items: SavedItem[] = (data || []).map((save: any) => ({
      ...save.listing,
      // Transform listing_photos into images array
      images: save.listing?.listing_photos
        ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((p: any) => p.url) || [],
      listName: save.list_name || 'default',
      savedAt: new Date(save.created_at).getTime(),
    }));

    updateState({ savedItems: items });
  } catch (error) {
    console.error('Failed to load saves from Supabase:', error);
  }
}

/**
 * Subscribe to real-time changes
 */
function subscribeToChanges() {
  if (!isSupabaseConfigured()) return;
  
  const { user } = getAuthState();
  if (!user) return;

  subscription = supabase!
    .channel('saves-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'saves',
        filter: `user_id=eq.${user.id}`,
      },
      () => {
        // Reload on any change
        loadFromSupabase();
      }
    )
    .subscribe();
}

/**
 * Unsubscribe from real-time
 */
function unsubscribe() {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }
}

export function useSavedStore(selector?: (state: SavedState & {
  save: (item: Listing, listName?: string) => Promise<void>;
  unsave: (id: string) => Promise<void>;
  isSaved: (id: string) => boolean;
  clear: () => Promise<void>;
  moveToList: (id: string, listName: string) => Promise<void>;
  getListItems: (listName?: string) => SavedItem[];
  getAllLists: () => string[];
  syncToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;
}) => any) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);

    // Load from cloud if authenticated
    const { user } = getAuthState();
    if (user && isSupabaseConfigured()) {
      loadFromSupabase();
      subscribeToChanges();
    }

    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const fullState = {
    ...state,
    
    save: async (item: Listing, listName = 'default') => {
      console.log('savedStore.save called:', item.id, item.title, 'to list:', listName);
      
      // Check if already saved
      if (state.savedItems.find((s) => s.id === item.id)) {
        console.log('savedStore: Item already saved, skipping');
        return;
      }

      const savedItem: SavedItem = { ...item, listName, savedAt: Date.now() };
      
      // Optimistic update
      updateState({ savedItems: [savedItem, ...state.savedItems] });

      // Save to Supabase if authenticated
      const { user } = getAuthState();
      if (user && isSupabaseConfigured()) {
        try {
          const { error } = await supabase!
            .from('saves')
            .insert({
              user_id: user.id,
              listing_id: item.id,
              list_name: listName,
            });

          if (error) throw error;
        } catch (error: any) {
          console.error('Failed to save to Supabase:', error);
          // Revert optimistic update on error
          updateState({ savedItems: state.savedItems.filter((s) => s.id !== item.id) });
          throw error;
        }
      }
    },

    unsave: async (id: string) => {
      // Optimistic update
      const filtered = state.savedItems.filter((s) => s.id !== id);
      updateState({ savedItems: filtered });

      // Delete from Supabase if authenticated
      const { user } = getAuthState();
      if (user && isSupabaseConfigured()) {
        try {
          const { error } = await supabase!
            .from('saves')
            .delete()
            .eq('user_id', user.id)
            .eq('listing_id', id);

          if (error) throw error;
        } catch (error) {
          console.error('Failed to delete from Supabase:', error);
          // Could revert here, but delete is idempotent so not critical
        }
      }
    },

    isSaved: (id: string) => !!state.savedItems.find((s) => s.id === id),

    clear: async () => {
      updateState({ savedItems: [] });
      
      const { user } = getAuthState();
      if (user && isSupabaseConfigured()) {
        try {
          await supabase!
            .from('saves')
            .delete()
            .eq('user_id', user.id);
        } catch (error) {
          console.error('Failed to clear from Supabase:', error);
        }
      }
    },

    moveToList: async (id: string, listName: string) => {
      const items = state.savedItems.map((s) => s.id === id ? { ...s, listName } : s);
      updateState({ savedItems: items });

      const { user } = getAuthState();
      if (user && isSupabaseConfigured()) {
        try {
          await supabase!
            .from('saves')
            .update({ list_name: listName })
            .eq('user_id', user.id)
            .eq('listing_id', id);
        } catch (error) {
          console.error('Failed to move item in Supabase:', error);
        }
      }
    },

    getListItems: (listName?: string) => {
      if (!listName) return state.savedItems;
      return state.savedItems.filter((s) => s.listName === listName);
    },

    getAllLists: () => {
      const lists = new Set(state.savedItems.map((s) => s.listName || 'default'));
      return Array.from(lists);
    },

    syncToCloud: async () => {
      const { user } = getAuthState();
      if (!user || !isSupabaseConfigured()) return;

      updateState({ syncing: true });
      try {
        // Bulk insert current saved items
        const saves = state.savedItems.map((item) => ({
          user_id: user.id,
          listing_id: item.id,
          list_name: item.listName || 'default',
        }));

        const { error } = await supabase!
          .from('saves')
          .upsert(saves);

        if (error) throw error;
        console.log(`Synced ${saves.length} items to cloud`);
      } catch (error) {
        console.error('Sync to cloud failed:', error);
        throw error;
      } finally {
        updateState({ syncing: false });
      }
    },

    loadFromCloud: async () => {
      await loadFromSupabase();
    },
  };

  return selector ? selector(fullState) : fullState;
}

