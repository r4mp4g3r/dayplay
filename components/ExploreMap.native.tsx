import React, { useState, useMemo, useEffect, useRef } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import { StyleSheet, View, Text, Image, Pressable, Animated } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';
import { useSavedStore } from '@/state/savedStore';

type Props = {
  items: any[];
  latitude: number;
  longitude: number;
  showOnlySaved?: boolean;
  onToggleSaved?: () => void;
};

export function ExploreMap({ items, latitude, longitude, showOnlySaved = false, onToggleSaved }: Props) {
  const [selected, setSelected] = useState<any | null>(null);
  const { isSaved } = useSavedStore();
  
  // Animated values for smooth toggle
  const toggleAnim = useRef(new Animated.Value(showOnlySaved ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: showOnlySaved ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showOnlySaved, toggleAnim]);

  // Filter items by saved status if toggle is on
  const filteredItems = useMemo(() => {
    if (!showOnlySaved) return items;
    return items.filter((item) => isSaved(item.id));
  }, [items, showOnlySaved, isSaved]);

  // Filter items with valid coordinates
  const validItems = useMemo(() => {
    const valid = filteredItems.filter((item: any) => {
      const lat = item.latitude;
      const lng = item.longitude;

      // Require numeric, finite coordinates
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

      // Basic world bounds guard (defensive; should never be hit if data is clean)
      if (lat < -90 || lat > 90) return false;
      if (lng < -180 || lng > 180) return false;

      return true;
    });

    console.log(
      `[ExploreMap] Render – total items: ${filteredItems.length}, valid coords: ${valid.length}`,
    );
    if (valid.length > 0) {
      console.log(`[ExploreMap] Sample location: ${valid[0].title} at (${valid[0].latitude}, ${valid[0].longitude})`);
    }
    return valid;
  }, [filteredItems]);

  // Calculate region to fit all markers
  const region = useMemo(() => {
    if (validItems.length === 0) {
      return {
        latitude,
        longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }

    // Find bounds
    let minLat = validItems[0].latitude;
    let maxLat = validItems[0].latitude;
    let minLng = validItems[0].longitude;
    let maxLng = validItems[0].longitude;

    validItems.forEach((item: any) => {
      minLat = Math.min(minLat, item.latitude);
      maxLat = Math.max(maxLat, item.latitude);
      minLng = Math.min(minLng, item.longitude);
      maxLng = Math.max(maxLng, item.longitude);
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.3; // Add 30% padding
    const lngDelta = (maxLng - minLng) * 1.3;

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.1), // Minimum delta of 0.1
      longitudeDelta: Math.max(lngDelta, 0.1),
    };
  }, [validItems, latitude, longitude]);

  const handleMapPress = (_e: MapPressEvent) => {
    if (selected) setSelected(null);
  };

  const selectedImage = useMemo(() => {
    if (!selected) return undefined;
    const src = selected.images?.[0] || selected.image || selected.photo_url;
    return src;
  }, [selected]);

  const rating = selected?.source_metadata?.rating ?? selected?.rating;
  const address = selected?.address || selected?.subtitle || selected?.city;
  const phone = selected?.phone as string | undefined;
  const website = selected?.website as string | undefined;
  const websiteDomain = useMemo(() => {
    if (!website) return undefined;
    try {
      const withProto = /^https?:\/\//i.test(website) ? website : `https://${website}`;
      const u = new URL(withProto);
      return u.host.replace(/^www\./, '');
    } catch {
      return website;
    }
  }, [website]);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={true}
        loadingEnabled={true}
        onPress={handleMapPress}
      >
        {validItems.map((it: any) => (
          <Marker
            key={it.id}
            coordinate={{ latitude: Number(it.latitude), longitude: Number(it.longitude) }}
            title={''}
            description={undefined}
            onPress={() => setSelected(it)}
            onCalloutPress={() =>
              router.push({ pathname: '/listing/[id]', params: { id: it.id } })
            }
          />
        ))}
      </MapView>

      {/* Saved Places Toggle Switch */}
      {onToggleSaved && (
        <View style={styles.toggleContainer}>
          <Pressable
            onPress={onToggleSaved}
            accessibilityLabel={showOnlySaved ? 'Show all places' : 'Show saved places only'}
            accessibilityRole="switch"
            accessibilityState={{ checked: showOnlySaved }}
          >
            <Animated.View
              style={[
                styles.toggleSwitch,
                {
                  backgroundColor: toggleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#ccc', '#FF2D55'],
                  }),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.toggleThumb,
                  {
                    transform: [
                      {
                        translateX: toggleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [2, 22],
                        }),
                      },
                    ],
                  },
                ]}
              />
            </Animated.View>
          </Pressable>
          <Text style={styles.toggleLabel}>
             Saved
          </Text>
        </View>
      )}
      
      {validItems.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No listings with valid locations found</Text>
          <Text style={styles.emptySubtext}>{showOnlySaved ? 'Try saving some places first' : 'Try adjusting your filters'}</Text>
        </View>
      )}
      
      {validItems.length > 0 && filteredItems.length > validItems.length && (
        <View style={styles.warningBanner}>
          <FontAwesome name="info-circle" size={14} color="#FF9500" />
          <Text style={styles.warningText}>
            {filteredItems.length - validItems.length} listing(s) have invalid locations
          </Text>
        </View>
      )}

      {selected && (
        <View style={styles.cardWrap} pointerEvents="box-none">
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/listing/[id]', params: { id: selected.id } })
            }
          >
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.cardImage} resizeMode="cover" />
            ) : (
              <View style={[styles.cardImage, { backgroundColor: '#eee' }]} />
            )}
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle} numberOfLines={1}>{selected.title}</Text>
              {/* Show compact contact row; if present, suppress address to save space */}
              {(phone || websiteDomain) ? (
                <View style={styles.contactRow}>
                  {phone && (
                    <View style={styles.contactPill}>
                      <FontAwesome name="phone" size={11} color="#666" />
                      <Text style={styles.contactText} numberOfLines={1}>{phone}</Text>
                    </View>
                  )}
                  {websiteDomain && (
                    <View style={styles.contactPill}>
                      <FontAwesome name="external-link" size={11} color="#666" />
                      <Text style={styles.contactText} numberOfLines={1}>{websiteDomain}</Text>
                    </View>
                  )}
                </View>
              ) : (
                address && (
                  <View style={styles.addrRow}>
                    <FontAwesome name="map-marker" size={12} color="#666" />
                    <Text style={styles.addrText} numberOfLines={1}>{address}</Text>
                  </View>
                )
              )}
              <View style={styles.metaRow}>
                {typeof rating === 'number' && (
                  <View style={styles.metaPill}>
                    <FontAwesome name="star" size={12} color="#FFD700" />
                    <Text style={styles.metaText}>{rating.toFixed(1)}</Text>
                  </View>
                )}
                {selected.price_tier && (
                  <View style={styles.metaPill}>
                    <Text style={styles.metaText}>{'$'.repeat(selected.price_tier)}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  emptyState: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  warningBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#E65100',
    fontWeight: '600',
  },
  toggleContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  cardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImage: {
    width: 85,
    height: 85,
  },
  cardContent: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'nowrap',
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f6f6f6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  contactText: {
    fontSize: 11,
    color: '#555',
    maxWidth: 130,
  },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  addrText: {
    fontSize: 12,
    color: '#666',
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f2f2f2',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
});

