import React from 'react';
import { View, Text, Image, ScrollView, Dimensions, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

export function ListingCarousel({ images }: { images: string[] }) {
  if (!images?.length) return null;
  
  // Show up to 5 photos
  const displayImages = images.slice(0, 5);
  
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


