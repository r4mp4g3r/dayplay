import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable, Text } from 'react-native';
import { SwipeCard } from './SwipeCard';
import { LoadingSkeleton } from './LoadingSkeleton';
import type { Listing } from '@/types/domain';
import { useSavedStore } from '@/state/savedStore';
import { recordSwipe } from '@/state/swipeHistoryStore';
import { router } from 'expo-router';
import { capture } from '@/lib/analytics';
import { trackBusinessAnalytics } from '@/lib/businessAuth';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

type Props = {
  fetchFn: (args: { page: number; excludeIds: string[] }) => Promise<{ items: Listing[]; total: number }>;
};

export function SwipeDeck({ fetchFn }: Props) {
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [lastPassedItem, setLastPassedItem] = useState<Listing | null>(null);
  const save = useSavedStore((s) => s.save);

  useEffect(() => {
    let mounted = true;
    (async () => {
      console.log('SwipeDeck: Starting fetch...');
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFn({ page: 0, excludeIds: [] });
        console.log('SwipeDeck: Fetch result:', result);
        if (mounted) {
          setItems(result.items || []);
          setIndex(0);
          setPage(0);
          setExcludeIds([]);
        }
      } catch (e) {
        console.error('SwipeDeck: Fetch error:', e);
        if (mounted) {
          setError(`Failed to load: ${e instanceof Error ? e.message : String(e)}`);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [fetchFn]);

  const topItem = items[index];
  const nextItem = items[index + 1];

  async function onSwiped(liked: boolean) {
    const current = topItem;
    if (!current) return;
    
    // Record swipe for recommendations
    recordSwipe(current.id, liked ? 'right' : 'left', current.category, current.tags || []);
    
    // Track business analytics
    trackBusinessAnalytics(current.id, liked ? 'swipe_right' : 'swipe_left');
    
    if (liked) {
      console.log('SwipeDeck: Saving item', current.id, current.title);
      save(current);
      trackBusinessAnalytics(current.id, 'save');
    } else {
      setLastPassedItem(current);
    }
    capture(liked ? 'swipe_like' : 'swipe_pass', { id: current.id, title: current.title });
    if (!liked) setExcludeIds((prev) => [...prev, current.id]);
    const nextIndex = index + 1;
    setIndex(nextIndex);
    // Prefetch next page when reaching near the end
    if (nextIndex >= items.length - 2) {
      try {
        const nextPage = page + 1;
        const res = await fetchFn({ page: nextPage, excludeIds: [...excludeIds, !liked ? current.id : ''] .filter(Boolean) });
        const deduped = res.items.filter((it) => !new Set(items.map((i) => i.id)).has(it.id));
        if (deduped.length) {
          setItems((prev) => [...prev, ...deduped]);
          setPage(nextPage);
        }
      } catch {}
    }
  }

  function undoLastPass() {
    if (!lastPassedItem) return;
    setExcludeIds((prev) => prev.filter((id) => id !== lastPassedItem.id));
    setIndex((i) => Math.max(0, i - 1));
    setLastPassedItem(null);
  }

  // Capture when card is viewed
  React.useEffect(() => {
    if (topItem) {
      capture('view_card', { id: topItem.id, title: topItem.title });
      trackBusinessAnalytics(topItem.id, 'view');
    }
  }, [topItem?.id]);

  if (loading) return (
    <View style={styles.container}>
      <LoadingSkeleton />
    </View>
  );
  if (error) return (
    <View style={styles.center}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#dc3545' }}>Oops!</Text>
      <Text style={{ fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{error}</Text>
    </View>
  );
  if (!topItem) return (
    <View style={styles.center}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
      <Text style={styles.emptyTitle}>You've seen everything!</Text>
      <Text style={styles.emptySubtitle}>You viewed {items.length} items</Text>
      <Text style={styles.emptySubtitle}>Try adjusting your filters for more</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {nextItem && (
        <View style={[styles.card, { transform: [{ scale: 0.96 }], opacity: 0.5 }]} pointerEvents="none">
          <SwipeCard item={nextItem} />
        </View>
      )}
      <View style={styles.card}>
        <Pressable onPress={() => router.push(`/listing/${topItem.id}`)}>
          <SwipeCard item={topItem} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, { backgroundColor: '#f3f3f3' }]} onPress={() => onSwiped(false)}>
          <FontAwesome name="times" size={24} color="#ff4458" />
        </Pressable>
        {lastPassedItem && (
          <Pressable style={[styles.actionBtn, { backgroundColor: '#fff3cd' }]} onPress={undoLastPass}>
            <FontAwesome name="undo" size={20} color="#856404" />
          </Pressable>
        )}
        <Pressable style={[styles.actionBtn, { backgroundColor: '#111' }]} onPress={() => onSwiped(true)}>
          <FontAwesome name="heart" size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 16 },
  card: { position: 'absolute', top: 24 },
  actions: { position: 'absolute', bottom: 24, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16 },
  actionBtn: { width: 60, height: 60, borderRadius: 999, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 6 },
});

