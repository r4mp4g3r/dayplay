import React, { useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { SwipeDeck } from '@/components/SwipeDeck';
import { FilterSheet } from '@/components/FilterSheet';
import { useFilterStore } from '@/state/filterStore';
import { useLocationStore } from '@/state/locationStore';
import { getFeed } from '@/lib/api';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { categories, distanceKm, priceTiers, showNewThisWeek, showOpenNow } = useFilterStore();
  const { latitude, longitude, city } = useLocationStore();
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const toggleRef = useRef(() => setFilterOpen((v) => !v));

  const fetchFn = useMemo(
    () => ({ page, excludeIds }: { page: number; excludeIds: string[] }) => 
      getFeed({ 
        lat: latitude ?? 30.2672, 
        lng: longitude ?? -97.7431, 
        radiusKm: distanceKm, 
        categories: categories.length > 0 ? categories : [], 
        priceTiers, 
        excludeIds, 
        page,
        showNewThisWeek,
        showOpenNow,
      }),
    [categories, distanceKm, priceTiers, latitude, longitude, showNewThisWeek, showOpenNow]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Discover</Text>
          <Text style={styles.headerSubtitle}>📍 {city}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setRefreshKey(k => k + 1)} style={styles.iconBtn} accessibilityLabel="Refresh">
            <FontAwesome name="refresh" size={18} color="#007AFF" />
          </Pressable>
          <Pressable onPress={() => setFilterOpen(true)} style={styles.iconBtn} accessibilityLabel="Open filters">
            <FontAwesome name="sliders" size={18} color="#007AFF" />
          </Pressable>
        </View>
      </View>

      <SwipeDeck key={refreshKey} fetchFn={fetchFn} />

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


