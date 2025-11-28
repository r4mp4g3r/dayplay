import React from 'react';
import { View, Text, Image, ScrollView, Dimensions, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

export function ListingCarousel({ images, isEvent = false }: { images: string[]; isEvent?: boolean }) {
  if (!images?.length) return null;
  
  // For events, show minimum 4-5 photos; for others, show up to 5
  const minPhotos = isEvent ? 4 : 1;
  const maxPhotos = 5;
  const displayImages = images.slice(0, maxPhotos);
  
  // Warn if event has fewer than minimum photos
  if (isEvent && displayImages.length < minPhotos) {
    console.warn(`Event has only ${displayImages.length} photos, recommended minimum is ${minPhotos}`);
  }
  
  return (
    <View style={styles.container}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {displayImages.map((src, idx) => (
          <View key={idx} style={{ width }}>
            <Image source={{ uri: src }} style={styles.image} resizeMode="cover" />
          </View>
        ))}
      </ScrollView>
      {displayImages.length > 1 && (
        <View style={styles.photoIndicator}>
          <Text style={styles.photoCount}>📷 {displayImages.length} photos</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  image: { width: '100%', height: 320 },
  photoIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  photoCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});


