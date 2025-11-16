import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, Text, Pressable, Platform } from 'react-native';
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
      <View style={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>Explore</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable 
            onPress={() => setViewMode('list')}
            style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}
          >
            <FontAwesome name="list" size={16} color={viewMode === 'list' ? '#fff' : '#111'} />
          </Pressable>
          <Pressable 
            onPress={() => setViewMode('map')}
            style={[styles.viewBtn, viewMode === 'map' && styles.viewBtnActive]}
          >
            <FontAwesome name="map" size={16} color={viewMode === 'map' ? '#fff' : '#111'} />
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
          <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {['food','outdoors','nightlife','events','coffee'].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    const curr = categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c];
                    setCategories(curr);
                  }}
                  style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: categories.includes(c) ? '#111' : '#eee' }}
                >
                  <Text style={{ color: categories.includes(c) ? '#fff' : '#111', fontWeight: '700' }}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`/listing/${item.id}`)} style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                <Text style={{ fontWeight: '700', fontSize: 15 }}>{item.title}</Text>
                <Text style={{ color: '#666', fontSize: 13, marginTop: 2 }}>{item.subtitle || item.category}</Text>
                {item.distanceKm != null && (
                  <Text style={{ color: '#999', fontSize: 12, marginTop: 2 }}>{item.distanceKm.toFixed(1)} km away</Text>
                )}
              </Pressable>
            )}
            contentContainerStyle={{ paddingBottom: 80 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  viewBtn: { padding: 8, borderRadius: 8, backgroundColor: '#f0f0f0', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  viewBtnActive: { backgroundColor: '#111' },
});
