import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, Text, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { SwipeDeck } from '@/components/SwipeDeck';
import { FilterSheet } from '@/components/FilterSheet';
import { useFilterStore } from '@/state/filterStore';
import { useLocationStore } from '@/state/locationStore';
import { useFrontendFilteredListings } from '@/hooks/useFrontendFilteredListings';
import { ExploreMap } from '@/components/ExploreMap';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { categories, distanceKm, priceTiers, showNewThisWeek, showOpenNow } = useFilterStore();
  const { latitude, longitude, city } = useLocationStore();
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toggleRef = useRef(() => setFilterOpen((v) => !v));
  const [viewMode, setViewMode] = useState<'deck' | 'map'>('deck');

  // Use frontend filtering for INSTANT results
  const { listings, loading, error, total } = useFrontendFilteredListings({
    city,
    lat: latitude ?? 30.2672,
    lng: longitude ?? -97.7431,
    categories,
    distanceKm,
    priceTiers,
    showNewThisWeek,
    showOpenNow,
  });

  // Create a fetch function that returns chunks from the already-filtered listings.
  // NOTE: We ignore the "page" offset and instead always return the first N unseen items.
  // SwipeDeck passes an ever-growing excludeIds list (including previously fetched items),
  // so we just filter by that and slice from the start. This avoids pagination bugs where
  // the offset is larger than the remaining (post-exclusion) list.
  const fetchFn = useMemo(
    () => ({ page, excludeIds }: { page: number; excludeIds: string[] }) => {
      const excludeSet = new Set(excludeIds);
      const filtered = listings.filter((l) => !excludeSet.has(l.id));
      const pageSize = 50;
      const items = filtered.slice(0, pageSize);
      
      return Promise.resolve({ items, total: filtered.length });
    },
    [listings]
  );

  // Map items - show all filtered listings
  const mapItems = useMemo(() => listings, [listings]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, fontSize: 16, color: '#666' }}>Loading {city} listings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Error</Text>
        <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSubtitle}>📍 {city} • {total} spots</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => setViewMode(v => (v === 'map' ? 'deck' : 'map'))}
            style={styles.iconBtn}
            accessibilityLabel={viewMode === 'map' ? 'Show cards' : 'Open map view'}
          >
            <FontAwesome name={viewMode === 'map' ? 'list' : 'map'} size={18} color="#007AFF" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/submit-gem')}
            style={styles.iconBtn}
            accessibilityLabel="Submit a local suggestion"
          >
            <FontAwesome name="plus" size={18} color="#007AFF" />
          </Pressable>
          <Pressable onPress={() => setRefreshKey(k => k + 1)} style={styles.iconBtn} accessibilityLabel="Refresh">
            <FontAwesome name="refresh" size={18} color="#007AFF" />
          </Pressable>
          <Pressable onPress={() => setFilterOpen(true)} style={styles.iconBtn} accessibilityLabel="Open filters">
            <FontAwesome name="sliders" size={18} color="#007AFF" />
          </Pressable>
        </View>
      </View>

      {viewMode === 'map' ? (
        <ExploreMap
          items={mapItems}
          latitude={latitude ?? 30.2672}
          longitude={longitude ?? -97.7431}
        />
      ) : (
        <SwipeDeck key={refreshKey} fetchFn={fetchFn} />
      )}

      <FilterSheet open={isFilterOpen} onClose={() => setFilterOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#666' },
  iconBtn: { 
    padding: 12,
    borderRadius: 999,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});


