import { capture } from '@/lib/analytics';
import { useSavedStore } from '@/state/savedStore';
import { recordSwipe as recordSwipeEvent, useSwipeHistoryStore } from '@/state/swipeHistoryStore';
import type { Listing } from '@/types/domain';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { LoadingSkeleton } from './LoadingSkeleton';
import { PhotoGalleryModal } from './PhotoGalleryModal';
import { SwipeCard } from './SwipeCard';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;
const SWIPE_UP_THRESHOLD = -100;

type Props = {
  fetchFn: (args: { page: number; excludeIds: string[] }) => Promise<{ items: Listing[]; total: number }>;
};

// ============================================================================
// CardWrapper - Individual card component with gesture handling
// ============================================================================
interface CardWrapperProps {
  item: Listing;
  index: number;
  totalStackSize: number;
  activeTranslation: SharedValue<number>;
  activeTranslationY: SharedValue<number>;
  onSwipeComplete: (direction: 'left' | 'right') => void;
  onSwipeUp: () => void;
  onCardPress: () => void;
}

const CardWrapper = ({
  item,
  index,
  totalStackSize,
  activeTranslation,
  activeTranslationY,
  onSwipeComplete,
  onSwipeUp,
  onCardPress,
}: CardWrapperProps) => {
  const rotate = useSharedValue(0);
  const isActive = index === 0;

  const panGesture = Gesture.Pan()
    .enabled(isActive)
    .onUpdate((event) => {
      if (!isActive) return;
      activeTranslation.value = event.translationX;
      activeTranslationY.value = event.translationY;
      rotate.value = interpolate(
        event.translationX,
        [-width / 2, 0, width / 2],
        [-10, 0, 10],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      if (!isActive) return;

      const swipeUp = activeTranslationY.value < SWIPE_UP_THRESHOLD && Math.abs(activeTranslation.value) < SWIPE_THRESHOLD;
      const shouldAccept = activeTranslation.value > SWIPE_THRESHOLD;
      const shouldReject = activeTranslation.value < -SWIPE_THRESHOLD;

      if (swipeUp) {
        // Swipe up detected - open gallery
        activeTranslation.value = withSpring(0);
        activeTranslationY.value = withSpring(0);
        rotate.value = withSpring(0);
        runOnJS(onSwipeUp)();
      } else if (shouldAccept || shouldReject) {
        const toX = shouldAccept ? width * 1.5 : -width * 1.5;
        activeTranslation.value = withTiming(toX, { duration: 160 }, () => {
          runOnJS(onSwipeComplete)(shouldAccept ? 'right' : 'left');
          activeTranslation.value = 0;
          activeTranslationY.value = 0;
          rotate.value = 0;
        });
      } else {
        activeTranslation.value = withSpring(0);
        activeTranslationY.value = withSpring(0);
        rotate.value = withSpring(0);
      }
    });

  // --- Animated Styles ---
  const animatedStyle = useAnimatedStyle(() => {
    // 1. ACTIVE CARD BEHAVIOR
    if (isActive) {
      return {
        transform: [
          { translateX: activeTranslation.value },
          { translateY: activeTranslationY.value },
          { rotate: `${rotate.value}deg` },
          { scale: 1 },
        ],
        zIndex: 100,
      };
    }

    // 2. BACKGROUND CARD BEHAVIOR (Synced Scaling)
    const depth = index - 1; // 0 for Next, 1 for Third
    const absTrans = Math.abs(activeTranslation.value);

    let startScale = 0.95;
    let endScale = 1.0;

    if (depth === 1) {
      // Third card
      startScale = 0.90;
      endScale = 0.95;
    }

    const scale = interpolate(
      absTrans,
      [0, width],
      [startScale, endScale],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      zIndex: 100 - index,
    };
  });

  const likeOverlayStyle = useAnimatedStyle(() => ({
    opacity: isActive ? interpolate(activeTranslation.value, [0, width / 4], [0, 1]) : 0,
  }));

  const nopeOverlayStyle = useAnimatedStyle(() => ({
    opacity: isActive ? interpolate(activeTranslation.value, [0, -width / 4], [0, 1]) : 0,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <Pressable onPress={onCardPress}>
          <SwipeCard item={item} />
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
  );
};

// ============================================================================
// Main SwipeDeck Component
// ============================================================================
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

  // Get available items from current index
  const availableItems = items.slice(index);
  const topItem = availableItems[0];

  // DOUBLE BUFFERING STRATEGY
  const translateX_A = useSharedValue(0);
  const translateY_A = useSharedValue(0);
  const translateX_B = useSharedValue(0);
  const translateY_B = useSharedValue(0);

  // 0 means Buffer A is active, 1 means Buffer B is active
  const [activeBuffer, setActiveBuffer] = useState<0 | 1>(0);

  // The shared values exposed to the UI depending on active buffer
  const currentTranslateX = activeBuffer === 0 ? translateX_A : translateX_B;
  const currentTranslateY = activeBuffer === 0 ? translateY_A : translateY_B;

  // Prefetch images for the next few items
  useEffect(() => {
    const urls = [1, 2, 3]
      .map((offset) => items[index + offset]?.images?.[0])
      .filter((u): u is string => !!u);
    urls.forEach((u) => {
      try { Image.prefetch(u); } catch { }
    });
  }, [index, items]);

  const openGallery = () => {
    if (topItem) {
      setGalleryItem(topItem);
      setShowGallery(true);
    }
  };

  async function onSwiped(liked: boolean) {
    const current = topItem;
    if (!current) return;

    if (liked) {
      save(current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
      setLastPassedItem(current);
    }

    // Record swipe
    try {
      recordSwipeEvent(current.id, liked ? 'right' : 'left', current.category, (current as any).tags || []);
    } catch { }

    capture(liked ? 'swipe_like' : 'swipe_pass', { id: current.id, title: current.title });
    setExcludeIds((prev) => Array.from(new Set([...prev, current.id])));
    setViewedCount((c) => c + 1);

    // CRITICAL: Prepare for next card by switching buffers
    const oldBuffer = activeBuffer;
    const newBuffer = activeBuffer === 0 ? 1 : 0;

    // 1. Advance Index (new card becomes top)
    const nextIndex = index + 1;
    setIndex(nextIndex);

    // 2. Switch active buffer to the clean one (which is at 0)
    setActiveBuffer(newBuffer);

    // 3. Reset the OLD buffer (which currently holds the off-screen swipe value)
    if (oldBuffer === 0) {
      translateX_A.value = 0;
      translateY_A.value = 0;
    } else {
      translateX_B.value = 0;
      translateY_B.value = 0;
    }

    // Prefetch next page when reaching near the end
    if (nextIndex >= items.length - 5) {
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
    } catch { }
  }

  function undoLastPass() {
    if (!lastPassedItem) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExcludeIds((prev) => prev.filter((id) => id !== lastPassedItem.id));
    setIndex((i) => Math.max(0, i - 1));
    setLastPassedItem(null);
  }

  const handleCardPress = () => {
    if (topItem) {
      router.push({ pathname: '/listing/[id]', params: { id: topItem.id } });
    }
  };

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

  // Stack of 3 cards max
  const stack = availableItems.slice(0, 3);

  return (
    <View style={styles.container}>
      <View style={styles.cardContainer}>
        {/* Render cards in reverse order for correct z-index */}
        {stack.reverse().map((item, reverseIndex) => {
          const realIndex = (stack.length - 1) - reverseIndex;

          return (
            <CardWrapper
              key={item.id}
              item={item}
              index={realIndex}
              totalStackSize={stack.length}
              activeTranslation={currentTranslateX}
              activeTranslationY={currentTranslateY}
              onSwipeComplete={(direction) => onSwiped(direction === 'right')}
              onSwipeUp={openGallery}
              onCardPress={handleCardPress}
            />
          );
        })}
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
  cardContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    position: 'absolute',
    top: 24,
    width: '90%',
    height: '75%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 14, color: '#999', marginTop: 6 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  likeOverlay: { alignItems: 'flex-start', paddingLeft: 32, paddingTop: 60 },
  nopeOverlay: { alignItems: 'flex-end', paddingRight: 32, paddingTop: 60 },
  overlayBadge: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 4 },
  likeBadge: { borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)' },
  nopeBadge: { borderColor: '#ff4458', backgroundColor: 'rgba(255, 68, 88, 0.1)' },
  overlayText: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
});
