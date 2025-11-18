import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, Text, Pressable, Platform, ScrollView } from 'react-native';
import { getFeed } from '@/lib/api';
import { useFilterStore } from '@/state/filterStore';
import { useLocationStore } from '@/state/locationStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { ExploreMap } from '@/components/ExploreMap';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { categories, distanceKm, priceTiers, setCategories } = useFilterStore();
  const { latitude, longitude } = useLocationStore();
  const [items, setItems] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const feedQuery = useMemo(
    () => ({ 
      lat: latitude ?? 30.2672, 
      lng: longitude ?? -97.7431, 
      radiusKm: distanceKm, 
      categories, 
      priceTiers, 
      excludeIds: [], 
      page: 0 
    }),
    [categories, distanceKm, priceTiers, latitude, longitude]
  );

  useEffect(() => {
    (async () => {
      const res = await getFeed(feedQuery);
      setItems(res.items);
    })();
  }, [feedQuery]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Modern Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Explore 🗺️</Text>
          <Text style={styles.headerSubtitle}>
            {items.length} {items.length === 1 ? 'place' : 'places'} nearby
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable 
            onPress={() => setViewMode('list')}
            style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
          >
            <FontAwesome name="list" size={16} color={viewMode === 'list' ? '#fff' : '#007AFF'} />
          </Pressable>
          <Pressable 
            onPress={() => setViewMode('map')}
            style={[styles.viewBtn, viewMode === 'map' && styles.viewBtnActive]}
          >
            <FontAwesome name="map" size={16} color={viewMode === 'map' ? '#fff' : '#007AFF'} />
          </Pressable>
        </View>
      </View>

      {viewMode === 'map' ? (
        <ExploreMap 
          items={items} 
          latitude={latitude ?? 30.2672} 
          longitude={longitude ?? -97.7431} 
        />
      ) : (
        <View style={{ flex: 1 }}>
          {/* Category Filter Pills */}
          <View style={styles.categoryRow}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {['food','outdoors','nightlife','events','coffee'].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    const curr = categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c];
                    setCategories(curr);
                  }}
                  style={[styles.categoryChip, categories.includes(c) && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, categories.includes(c) && styles.categoryChipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/listing/${item.id}`)} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listItemTitle}>{item.title}</Text>
                  <Text style={styles.listItemSubtitle}>{item.subtitle || item.category}</Text>
                {item.distanceKm != null && (
                    <Text style={styles.listItemDistance}>📍 {item.distanceKm.toFixed(1)} km away</Text>
                )}
                </View>
                <FontAwesome name="chevron-right" size={16} color="#ccc" />
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🗺️</Text>
                <Text style={styles.emptyStateTitle}>No places found</Text>
                <Text style={styles.emptyStateText}>
                  Try adjusting your filters or location
                </Text>
              </View>
            }
          />
        </View>
      )}
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
  viewBtn: { 
    padding: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewBtnActive: { backgroundColor: '#007AFF' },
  categoryRow: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
  },
  categoryChipActive: { backgroundColor: '#007AFF' },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: '#666', textTransform: 'capitalize' },
  categoryChipTextActive: { color: '#fff' },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  listItemTitle: { fontWeight: '700', fontSize: 16, marginBottom: 4 },
  listItemSubtitle: { color: '#666', fontSize: 14, marginBottom: 2 },
  listItemDistance: { color: '#999', fontSize: 12 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 80,
  },
  emptyStateIcon: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  map: { flex: 1 },
});
