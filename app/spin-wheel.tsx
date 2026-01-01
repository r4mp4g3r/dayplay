import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSavedStore } from '@/state/savedStore';
import type { Listing } from '@/types/domain';

type Vibe =
  | 'romantic'
  | 'chill'
  | 'fun'
  | 'adventurous'
  | 'family-friendly'
  | 'trendy'
  | 'hidden-gem';

type Step = 'vibe' | 'spinning' | 'result';

const VIBE_LABELS: { id: Vibe; label: string; description: string }[] = [
  { id: 'romantic', label: 'Romantic', description: 'Date-night, cozy, candlelight energy' },
  { id: 'chill', label: 'Chill', description: 'Low-key, mellow, cozy vibes' },
  { id: 'fun', label: 'Fun', description: 'High energy, games, parties, loud' },
  { id: 'adventurous', label: 'Adventurous', description: 'Try something new, explore, surprises' },
  { id: 'family-friendly', label: 'Family', description: 'Good with kids / groups / daytime' },
  { id: 'trendy', label: 'Trendy', description: 'Hot spots, buzzy, very “now”' },
  { id: 'hidden-gem', label: 'Hidden Gem', description: 'Underrated, off-the-path, special' },
];

// Rough mapping from vibe → categories that match that feeling best
const VIBE_CATEGORY_WEIGHTS: Record<Vibe, string[]> = {
  romantic: ['food', 'drinks-bars', 'live-music', 'nightlife'],
  chill: ['coffee', 'relax-recharge', 'outdoors'],
  fun: ['games-entertainment', 'festivals-pop-ups', 'nightlife', 'activities'],
  adventurous: ['activities', 'outdoors', 'road-trip-getaways', 'sports-recreation'],
  'family-friendly': ['family', 'museums', 'activities', 'outdoors', 'festivals-pop-ups'],
  trendy: ['nightlife', 'drinks-bars', 'live-music', 'shopping'],
  'hidden-gem': ['neighborhood', 'coffee', 'food', 'arts-culture'],
};

function scoreListingForVibe(listing: Listing, vibe: Vibe): number {
  const base = 1; // every place has at least a baseline chance
  const cats = (listing.category || '').toLowerCase();
  const tags: string[] = (listing as any).tags || [];
  const vibeCats = VIBE_CATEGORY_WEIGHTS[vibe] || [];

  let bonus = 0;

  // Category matches
  if (vibeCats.some((c) => cats.includes(c))) {
    bonus += 3;
  }

  // Tag matches (if we ever tag places with vibes)
  if (tags.map((t) => t.toLowerCase()).includes(vibe)) {
    bonus += 4;
  }

  // Very rough textual heuristic
  const title = (listing.title || '').toLowerCase();
  const desc = (listing.description || '').toLowerCase();
  const text = `${title} ${desc}`;

  if (vibe === 'romantic' && /romantic|date night|date-night|candlelight|anniversary/.test(text)) {
    bonus += 3;
  }
  if (vibe === 'chill' && /chill|cozy|laid back|laid-back|relax/.test(text)) {
    bonus += 2;
  }
  if (vibe === 'fun' && /fun|party|game|arcade|karaoke|club/.test(text)) {
    bonus += 2;
  }
  if (vibe === 'adventurous' && /hike|trail|escape room|climb|surf|kayak/.test(text)) {
    bonus += 2;
  }
  if (vibe === 'family-friendly' && /family|kids|children|all ages|all-ages/.test(text)) {
    bonus += 2;
  }
  if (vibe === 'trendy' && /trendy|hot spot|hotspot|new|instagrammable|viral/.test(text)) {
    bonus += 2;
  }
  if (vibe === 'hidden-gem' && /hidden gem|hidden-gem|local favorite|locals/.test(text)) {
    bonus += 2;
  }

  return Math.max(1, base + bonus);
}

function weightedPick<T>(items: T[], weights: number[]): T | null {
  if (!items.length || items.length !== weights.length) return null;
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return items[Math.floor(Math.random() * items.length)];
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

export default function SpinWheelScreen() {
  const insets = useSafeAreaInsets();
  const { savedItems, getListItems } = useSavedStore() as any;
  const [step, setStep] = useState<Step>('vibe');
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finalChoice, setFinalChoice] = useState<Listing | null>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // For now, we use ALL saved items; later we could scope to a specific saved list.
  const candidates: Listing[] = useMemo(() => {
    // `getListItems` might exist; but default is all saved
    return savedItems || [];
  }, [savedItems]);

  useEffect(() => {
    return () => {
      // Clear any remaining timeouts when leaving the screen
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, []);

  const canSpin = selectedVibe && candidates.length >= 2;

  const startSpin = () => {
    if (!selectedVibe) return;
    if (candidates.length < 2) return;

    // Clear old timers
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];

    // Compute weights and final choice
    const weights = candidates.map((c) => scoreListingForVibe(c, selectedVibe));
    const chosen = weightedPick(candidates, weights);
    const chosenIndex = chosen ? candidates.findIndex((c) => c.id === chosen.id) : -1;

    setStep('spinning');
    setFinalChoice(null);

    const sequenceLength = Math.min(24, candidates.length * 4);
    const indices: number[] = [];
    for (let i = 0; i < sequenceLength - 1; i++) {
      indices.push(i % candidates.length);
    }
    // Ensure we land on the chosen one at the end
    if (chosenIndex >= 0) {
      indices[indices.length - 1] = chosenIndex;
    }

    const baseDelay = 80;
    let accumulated = 0;

    indices.forEach((idx, i) => {
      // Gradually slow down by increasing delay
      const delay = baseDelay + i * 25;
      accumulated += delay;
      const timeout = setTimeout(() => {
        setCurrentIndex(idx);
        if (i === indices.length - 1) {
          setStep('result');
          setFinalChoice(candidates[idx]);
        }
      }, accumulated);
      timeoutsRef.current.push(timeout);
    });
  };

  const current = candidates[currentIndex] || candidates[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={18} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Decision Helper</Text>
        <Text style={styles.headerSubtitle}>Let DayPlay pick your next move</Text>
      </View>

      {candidates.length < 2 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎡</Text>
          <Text style={styles.emptyTitle}>Not enough saved places</Text>
          <Text style={styles.emptyText}>
            Save at least 2 spots, then come back to spin the wheel.
          </Text>
        </View>
      ) : (
        <>
          {step === 'vibe' && (
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>What’s your vibe right now?</Text>
              <Text style={styles.sectionSubtitle}>
                We’ll bias the wheel toward places that match how you’re feeling.
              </Text>
              <ScrollView contentContainerStyle={styles.vibeList} showsVerticalScrollIndicator={false}>
                {VIBE_LABELS.map((v) => {
                  const active = selectedVibe === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      style={[styles.vibeChip, active && styles.vibeChipActive]}
                      onPress={() => setSelectedVibe(v.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <FontAwesome
                          name={active ? 'circle' : 'circle-o'}
                          size={18}
                          color={active ? '#fff' : '#999'}
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.vibeLabel,
                              active && { color: '#fff' },
                            ]}
                          >
                            {v.label}
                          </Text>
                          <Text
                            style={[
                              styles.vibeDescription,
                              active && { color: 'rgba(255,255,255,0.85)' },
                            ]}
                          >
                            {v.description}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                style={[
                  styles.spinButton,
                  (!canSpin || !selectedVibe) && { opacity: 0.4 },
                ]}
                disabled={!canSpin}
                onPress={startSpin}
              >
                <Text style={styles.spinButtonText}>Spin the wheel</Text>
              </Pressable>
            </View>
          )}

          {step !== 'vibe' && (
            <View style={styles.wheelContainer}>
              <View style={styles.wheel}>
                <Text style={styles.wheelEmoji}>{step === 'spinning' ? '🎡' : '✅'}</Text>
                <Text style={styles.wheelTitle}>
                  {step === 'spinning' ? 'Spinning...' : 'Tonight you’re going to'}
                </Text>
                {current && (
                  <>
                    <Text style={styles.wheelPlaceTitle} numberOfLines={2}>
                      {current.title}
                    </Text>
                    {current.subtitle && (
                      <Text style={styles.wheelPlaceSubtitle} numberOfLines={1}>
                        {current.subtitle}
                      </Text>
                    )}
                  </>
                )}
              </View>

              {step === 'result' && finalChoice && (
                <View style={styles.resultActions}>
                  <Pressable
                    style={[styles.resultBtn, { backgroundColor: '#111' }]}
                    onPress={() =>
                      router.push({
                        pathname: '/listing/[id]',
                        params: { id: finalChoice.id },
                      })
                    }
                  >
                    <Text style={styles.resultBtnText}>View details</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.resultBtn, { backgroundColor: '#f2f2f2' }]}
                    onPress={startSpin}
                  >
                    <Text style={[styles.resultBtnText, { color: '#111' }]}>
                      Spin again
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 6,
    marginBottom: 6,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111' },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#777',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  vibeList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  vibeChip: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#f5f5f5',
  },
  vibeChipActive: {
    backgroundColor: '#111',
  },
  vibeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  vibeDescription: {
    fontSize: 12,
    color: '#666',
  },
  spinButton: {
    marginHorizontal: 20,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  spinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  wheelContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  wheel: {
    width: '100%',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  wheelTitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 8,
  },
  wheelPlaceTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 12,
  },
  wheelPlaceSubtitle: {
    fontSize: 14,
    color: '#ddd',
    marginTop: 6,
  },
  resultActions: {
    marginTop: 24,
    width: '100%',
    gap: 10,
  },
  resultBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  resultBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});


