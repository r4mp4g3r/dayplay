import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = 480;

export function LoadingSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.imageSkeleton} />
      <View style={styles.metaSkeleton}>
        <View style={styles.titleSkeleton} />
        <View style={styles.subtitleSkeleton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  imageSkeleton: {
    width: '100%',
    height: CARD_HEIGHT,
    backgroundColor: '#e0e0e0',
  },
  metaSkeleton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  titleSkeleton: {
    height: 20,
    width: '60%',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 4,
  },
  subtitleSkeleton: {
    height: 14,
    width: '40%',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 4,
    marginTop: 8,
  },
});

