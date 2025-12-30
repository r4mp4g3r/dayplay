import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, Pressable, Text, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS, interpolate } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SwipeCard } from './SwipeCard';
import { LoadingSkeleton } from './LoadingSkeleton';
import { PhotoGalleryModal } from './PhotoGalleryModal';
import type { Listing } from '@/types/domain';
import { useSavedStore } from '@/state/savedStore';
import { router } from 'expo-router';
import { capture } from '@/lib/analytics';
import * as Haptics from 'expo-haptics';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSwipeHistoryStore, recordSwipe as recordSwipeEvent } from '@/state/swipeHistoryStore';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_UP_THRESHOLD = -100;

type Props = {
  fetchFn: (args: { page: number; excludeIds: string[] }) => Promise<{ items: Listing[]; total: number }>;
};

export function SwipeDeck({ fetchFn }: Props) {
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [lastPassedItem, setLastPassedItem] = useState<Listing | null>(null);
  const [viewedCount, setViewedCount] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItem, setGalleryItem] = useState<Listing | null>(null);
  const save = useSavedStore((s) => s.save);
  const swipeHistory = useSwipeHistoryStore();

  // Build initial exclude set from all previous swipes (left or right), once per mount.
  // We intentionally DO NOT react to subsequent history changes here to avoid
  // re-fetching the first page on every swipe.
  const initialExcludeRef = useRef<string[] | null>(null);
  if (!initialExcludeRef.current) {
    const set = new Set<string>();
    (swipeHistory.history || []).forEach((r) => set.add(r.listingId));
    initialExcludeRef.current = Array.from(set);
  }
  const initialExclude = initialExcludeRef.current || [];

  useEffect(() => {
    let mounted = true;
    (async () => {
      console.log('SwipeDeck: Starting fetch...');
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFn({ page: 0, excludeIds: initialExclude });
        console.log('SwipeDeck: Fetch result:', result);
        if (mounted) {
          setItems(result.items || []);
          setTotal(typeof result.total === 'number' ? result.total : null);
          setIndex(0);
          setViewedCount(0);
          setPage(0);
          setExcludeIds(initialExclude);
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

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateZ = useSharedValue(0);

  // Prefetch images for the next few items to avoid perceived loading
  useEffect(() => {
    const urls = [1, 2, 3]
      .map((offset) => items[index + offset]?.images?.[0])
      .filter((u): u is string => !!u);
    urls.forEach((u) => {
      try { Image.prefetch(u); } catch {}
    });
  }, [index, items]);

  const openGallery = () => {
    if (topItem) {
      setGalleryItem(topItem);
      setShowGallery(true);
    }
  };

  const gesture = Gesture.Pan()
    .onChange((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      rotateZ.value = (e.translationX / width) * 0.15;
    })
    .onEnd((e) => {
      const swipeUp = translateY.value < SWIPE_UP_THRESHOLD && Math.abs(translateX.value) < SWIPE_THRESHOLD;
      const shouldAccept = translateX.value > SWIPE_THRESHOLD;
      const shouldReject = translateX.value < -SWIPE_THRESHOLD;
      
      if (swipeUp) {
        // Swipe up detected - open gallery
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotateZ.value = withSpring(0);
        runOnJS(openGallery)();
      } else if (shouldAccept || shouldReject) {
        const toX = shouldAccept ? width * 1.1 : -width * 1.1;
        translateX.value = withTiming(toX, { duration: 160 }, () => {
          runOnJS(onSwiped)(shouldAccept);
          translateX.value = 0;
          translateY.value = 0;
          rotateZ.value = 0;
        });
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotateZ.value = withSpring(0);
      }
    });

  async function onSwiped(liked: boolean) {
    const current = topItem;
    if (!current) return;
    if (liked) {
      save(current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
      setLastPassedItem(current);
      // Move the current card to the back of the stack instead of discarding it.
      setItems((prev) => {
        if (!prev.length) return prev;
        const arr = [...prev];
        const idx = arr.findIndex((i) => i.id === current.id);
        if (idx === -1) return prev;
        const [removed] = arr.splice(idx, 1);
        if (removed) arr.push(removed);
        return arr;
      });
    }
    // Record swipe (both liked and passed) to persist exclusion
    try { recordSwipeEvent(current.id, liked ? 'right' : 'left', current.category, (current as any).tags || []); } catch {}

    capture(liked ? 'swipe_like' : 'swipe_pass', { id: current.id, title: current.title });
    // Only permanently exclude items that were liked/saved.
    if (liked) {
      setExcludeIds((prev) => Array.from(new Set([...prev, current.id])));
    }

    setViewedCount((c) => c + 1);

    // For liked items, advance the index; for passes, keep index pointing to the next card.
    const nextIndex = liked ? index + 1 : index;
    setIndex(nextIndex);
    // Prefetch next page when reaching near the end (keep a buffer of 5)
    if (liked && nextIndex >= items.length - 5) {
      // Fire-and-forget to avoid blocking the swipe transition
      loadMoreInternal();
    }
  }

  async function loadMoreInternal() {
    try {
      const nextPage = page + 1;
      const exclude = Array.from(new Set([...excludeIds, ...items.map((i) => i.id)]));
      const res = await fetchFn({ page: nextPage, excludeIds: exclude });
      if (typeof res.total === 'number') {
        setTotal(res.total);
      }
      const seen = new Set(items.map((i) => i.id));
      const deduped = (res.items || []).filter((it) => !seen.has(it.id));
      if (deduped.length) {
        setItems((prev) => [...prev, ...deduped]);
        setPage(nextPage);
      }
    } catch {}
  }

  function undoLastPass() {
    if (!lastPassedItem) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Bring the last passed card back to the front of the stack.
    setItems((prev) => {
      const arr = [...prev];
      const idx = arr.findIndex((i) => i.id === lastPassedItem.id);
      if (idx === -1) return prev;
      const [card] = arr.splice(idx, 1);
      arr.splice(index, 0, card);
      return arr;
    });
    setLastPassedItem(null);
  }

  const cardStyle = useAnimatedStyle(() => {
    const likeOpacity = interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1]);
    const nopeOpacity = interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0]);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotateZ: `${rotateZ.value}rad` },
      ],
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1]),
  }));

  const nopeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0]),
  }));

  // Capture when card is viewed
  React.useEffect(() => {
    if (topItem) capture('view_card', { id: topItem.id, title: topItem.title });
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
  if (!topItem) {
    // If we've truly exhausted all items (items length >= total), show the completion message.
    // Otherwise, we're likely between pages – show a lightweight loading state instead of a hard stop.
    if (total != null && items.length >= total) {
      return (
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
          <Text style={styles.emptyTitle}>You've seen everything!</Text>
          <Text style={styles.emptySubtitle}>You viewed {viewedCount} items</Text>
          <Text style={styles.emptySubtitle}>Try adjusting your filters for more</Text>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <LoadingSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {nextItem && (
        <View style={[styles.card, { transform: [{ scale: 0.96 }] }]} pointerEvents="none">
          <SwipeCard item={nextItem} />
        </View>
      )}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/listing/[id]', params: { id: topItem.id } })
            }
          >
            <SwipeCard item={topItem} />
          </Pressable>
          
          {/* LIKE Overlay */}
          <Animated.View style={[styles.overlay, styles.likeOverlay, likeOverlayStyle]} pointerEvents="none">
            <View style={[styles.overlayBadge, styles.likeBadge]}>
              <Text style={styles.overlayText}>LIKE</Text>
            </View>
          </Animated.View>

          {/* NOPE Overlay */}
          <Animated.View style={[styles.overlay, styles.nopeOverlay, nopeOverlayStyle]} pointerEvents="none">
            <View style={[styles.overlayBadge, styles.nopeBadge]}>
              <Text style={styles.overlayText}>NOPE</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

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

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        visible={showGallery}
        listing={galleryItem}
        onClose={() => setShowGallery(false)}
      />
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
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  likeOverlay: { alignItems: 'flex-start', paddingLeft: 32, paddingTop: 60 },
  nopeOverlay: { alignItems: 'flex-end', paddingRight: 32, paddingTop: 60 },
  overlayBadge: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 4 },
  likeBadge: { borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)' },
  nopeBadge: { borderColor: '#ff4458', backgroundColor: 'rgba(255, 68, 88, 0.1)' },
  overlayText: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
});
