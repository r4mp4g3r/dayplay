import React, { useState, useMemo } from 'react';
import MapView, { Marker, PROVIDER_GOOGLE, MapPressEvent } from 'react-native-maps';
import { StyleSheet, View, Text, Image, Pressable } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

type Props = {
  items: any[];
  latitude: number;
  longitude: number;
};

export function ExploreMap({ items, latitude, longitude }: Props) {
  const [selected, setSelected] = useState<any | null>(null);

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
        initialRegion={{ 
          latitude, 
          longitude, 
          latitudeDelta: 0.2, 
          longitudeDelta: 0.2 
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        loadingEnabled={true}
        onPress={handleMapPress}
      >
        {items.map((it) => (
          <Marker 
            key={it.id}
            coordinate={{ latitude: it.latitude, longitude: it.longitude }}
            title={''}
            description={undefined}
            onPress={() => setSelected(it)}
            onCalloutPress={() => router.push(`/listing/${it.id}`)}
          />
        ))}
      </MapView>

      {selected && (
        <View style={styles.cardWrap} pointerEvents="box-none">
          <Pressable style={styles.card} onPress={() => router.push(`/listing/${selected.id}`)}>
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

