import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import type { Listing } from '@/types/domain';
import { getTrendingListings } from '@/state/swipeHistoryStore';
import { formatEventDate, isEventSoon, isEventInProgress } from '@/lib/dateUtils';

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
  
  // Check if this is an event
  const isEvent = !!item.event_start_date;
  const eventHappeningSoon = isEvent && item.event_start_date ? isEventSoon(item.event_start_date) : false;
  const eventInProgress = isEvent && item.event_start_date && item.event_end_date 
    ? isEventInProgress(item.event_start_date, item.event_end_date) 
    : false;
  
  // Priority for badges: Featured > Happening Now > Soon > Trending > New
  let badge = null;
  if (item.is_featured) {
    badge = { text: '⭐ Featured', color: '#ffc107', textColor: '#000' };
  } else if (eventInProgress) {
    badge = { text: '🎉 Happening Now', color: '#ff4458', textColor: '#fff' };
  } else if (eventHappeningSoon) {
    badge = { text: '⏰ Soon', color: '#FF9800', textColor: '#fff' };
  } else if (isTrending) {
    badge = { text: '🔥 Trending', color: '#ff4458', textColor: '#fff' };
  } else if (isNew) {
    badge = { text: '✨ New', color: '#4CAF50', textColor: '#fff' };
  }
  
  return (
    <View style={[styles.card, compact && { height: 200 }]}>
      {img ? (
        <Image source={{ uri: img }} style={[styles.image, compact && { height: 200 }]} resizeMode="cover" />
      ) : (
        <View style={[styles.image, { backgroundColor: '#e9e9e9' }]} />
      )}
      {badge && (
        <View style={[styles.featuredBadge, { backgroundColor: badge.color, top: 16, left: 16, right: 'auto' }]}>
          <Text style={[styles.featuredText, { color: badge.textColor }]}>{badge.text}</Text>
        </View>
      )}
      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        
        {/* Event Date (if event) */}
        {isEvent && item.event_start_date && (
          <Text style={styles.eventDate}>
            📅 {formatEventDate(item.event_start_date)}
          </Text>
        )}
        
        {/* Info Row: Category, Price, Distance */}
        <View style={styles.infoRow}>
          <Text style={styles.category}>{item.category}</Text>
          {item.price_tier && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.price}>{'$'.repeat(item.price_tier)}</Text>
            </>
          )}
          {item.distanceKm != null && (
            <>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.distance}>📍 {item.distanceKm.toFixed(1)} km</Text>
            </>
          )}
        </View>
        
        {/* Tags/Vibes (if available) */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        
        {/* About/Description */}
        {item.description && (
          <View style={styles.aboutSection}>
            <Text style={styles.aboutLabel}>About</Text>
            <Text style={styles.aboutText} numberOfLines={3}>
              {item.description}
            </Text>
          </View>
        )}
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
  meta: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 20, 
    paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(10px)',
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  eventDate: { 
    color: '#FFD700', 
    fontSize: 14, 
    fontWeight: '700', 
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  infoRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  category: { 
    color: '#fff', 
    fontSize: 14, 
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  separator: { 
    color: 'rgba(255,255,255,0.5)', 
    marginHorizontal: 8,
    fontSize: 14,
  },
  price: { 
    color: '#4CAF50', 
    fontSize: 15, 
    fontWeight: '800',
    letterSpacing: 1,
  },
  distance: { 
    color: '#fff', 
    fontSize: 13, 
    fontWeight: '600',
  },
  tagsRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginTop: 4,
  },
  tagChip: { 
    paddingVertical: 4, 
    paddingHorizontal: 10, 
    borderRadius: 999, 
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tagText: { 
    color: '#fff', 
    fontSize: 11, 
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  aboutSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  aboutLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  aboutText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});


