import React from 'react';
import { View, Image, ScrollView, Dimensions, StyleSheet } from 'react-native';

const { width } = Dimensions.get('window');

export function ListingCarousel({ images }: { images: string[] }) {
  if (!images?.length) return null;
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
      {images.map((src, idx) => (
        <View key={idx} style={{ width }}>
          <Image source={{ uri: src }} style={styles.image} resizeMode="cover" />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 280 },
});


