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
        city,
      }),
    [categories, distanceKm, priceTiers, latitude, longitude, showNewThisWeek, showOpenNow, city]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Text style={styles.cityLabel}>{city}</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => setRefreshKey(k => k + 1)} style={styles.iconBtn} accessibilityLabel="Refresh">
            <FontAwesome name="refresh" size={18} color="#111" />
          </Pressable>
          <Pressable onPress={() => setFilterOpen(true)} style={styles.iconBtn} accessibilityLabel="Open filters">
            <FontAwesome name="sliders" size={18} color="#111" />
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
  topBar: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cityLabel: { fontSize: 18, fontWeight: '600' },
  iconBtn: { padding: 10, borderRadius: 999, backgroundColor: '#f2f2f2' },
});


