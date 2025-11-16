import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import type { Listing } from '@/types/domain';
import { getTrendingListings } from '@/state/swipeHistoryStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
const CARD_HEIGHT = 480;

export function SwipeCard({ item, compact = false }: { item: Listing; compact?: boolean }) {
  const img = item.images?.[0];
  const trending = getTrendingListings();
  const isTrending = trending.has(item.id);
  
  // Check if new this week (within last 7 days)
  const isNew = item.created_at 
    ? (Date.now() - new Date(item.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;
  
  return (
    <View style={[styles.card, compact && { height: 200 }]}>
      {img ? (
        <Image source={{ uri: img }} style={[styles.image, compact && { height: 200 }]} resizeMode="cover" />
      ) : (
        <View style={[styles.image, { backgroundColor: '#e9e9e9' }]} />
      )}
      {item.is_featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>⭐ Featured</Text>
        </View>
      )}
      {isTrending && !item.is_featured && (
        <View style={[styles.featuredBadge, { backgroundColor: '#ff4458', top: 16, left: 16, right: 'auto' }]}>
          <Text style={[styles.featuredText, { color: '#fff' }]}>🔥 Trending</Text>
        </View>
      )}
      {isNew && !item.is_featured && !isTrending && (
        <View style={[styles.featuredBadge, { backgroundColor: '#4CAF50', top: 16, left: 16, right: 'auto' }]}>
          <Text style={[styles.featuredText, { color: '#fff' }]}>✨ New</Text>
        </View>
      )}
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {item.category} · {item.distanceKm != null ? `${item.distanceKm.toFixed(1)} km` : item.city}
        </Text>
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
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  image: { width: '100%', height: CARD_HEIGHT },
  featuredBadge: { 
    position: 'absolute', 
    top: 16, 
    right: 16, 
    backgroundColor: '#ffc107', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  featuredText: { fontSize: 12, fontWeight: '800', color: '#000' },
  meta: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#f5f5f5', marginTop: 4 },
});


