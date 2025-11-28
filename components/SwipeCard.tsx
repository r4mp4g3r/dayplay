import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import type { Listing } from '@/types/domain';
import { getTrendingListings } from '@/state/swipeHistoryStore';
import { formatEventDate, isEventSoon, isEventInProgress } from '@/lib/dateUtils';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width - 32;
// Make the card significantly taller to reduce empty space above the tab bar and buttons
const RESERVED_VERTICAL_SPACE = 320; // header + actions + safe areas
const CARD_HEIGHT = Math.max(520, Math.min(720, height - RESERVED_VERTICAL_SPACE));

export function SwipeCard({ item, compact = false }: { item: Listing; compact?: boolean }) {
  const img = item.images?.[0];
  const trending = getTrendingListings();
  const isTrending = trending.has(item.id);
  
  const getWebsiteDomain = (url?: string) => {
    if (!url) return undefined;
    try {
      const withProto = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      const u = new URL(withProto);
      return u.host.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  };
  const websiteDomain = getWebsiteDomain(item.website);
  
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
  
  // For compact mode (saved cards), use a cleaner layout with image on top
  if (compact) {
    return (
      <View style={styles.compactCard}>
        {/* Image Section */}
        <View style={styles.compactImageContainer}>
          {img ? (
            <Image source={{ uri: img }} style={styles.compactImage} resizeMode="cover" />
          ) : (
            <View style={[styles.compactImage, { backgroundColor: '#e9e9e9' }]} />
          )}
          {badge && (
            <View style={[styles.compactBadge, { backgroundColor: badge.color }]}>
              <Text style={[styles.compactBadgeText, { color: badge.textColor }]}>{badge.text}</Text>
            </View>
          )}
        </View>
        
        {/* Content Section */}
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={2}>{item.title}</Text>
          
          {/* Event Date */}
          {isEvent && item.event_start_date && (
            <Text style={styles.compactEventDate}>
              📅 {formatEventDate(item.event_start_date)}
            </Text>
          )}
          
          {/* Category, Price, Distance Row */}
          <View style={styles.compactInfoRow}>
            <Text style={styles.compactCategory}>{item.category}</Text>
            {item.price_tier && (
              <>
                <Text style={styles.compactSeparator}>•</Text>
                <Text style={styles.compactPrice}>{'$'.repeat(item.price_tier)}</Text>
              </>
            )}
            {item.distanceKm != null && (
              <>
                <Text style={styles.compactSeparator}>•</Text>
                <Text style={styles.compactDistance}>📍 {item.distanceKm.toFixed(1)} km</Text>
              </>
            )}
          </View>
          
          {/* Location */}
          {(item.subtitle || (item as any).address || item.city) && (
            <Text style={styles.compactLocation} numberOfLines={1}>
              📍 {item.subtitle || (item as any).address || item.city}
            </Text>
          )}
          
          {/* Website */}
          {websiteDomain && (
            <Text style={styles.compactWebsite} numberOfLines={1}>
              🔗 {websiteDomain}
            </Text>
          )}
          
          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.compactTagsRow}>
              {item.tags.slice(0, 3).map((tag, index) => (
                <View key={index} style={styles.compactTagChip}>
                  <Text style={styles.compactTagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* Description */}
          <Text style={styles.compactDescription} numberOfLines={2}>
            {item.description || 'No description available.'}
          </Text>
        </View>
      </View>
    );
  }
  
  // Full card layout (for Discover page)
  return (
    <View style={styles.card}>
      {img ? (
        <Image source={{ uri: img }} style={styles.image} resizeMode="cover" />
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
        
        {/* Location - Show address or city */}
        {(item.subtitle || (item as any).address || item.city) && (
          <Text style={styles.location} numberOfLines={1}>
            📍 {item.subtitle || (item as any).address || item.city}
          </Text>
        )}
        
        {/* Website domain if available */}
        {websiteDomain && (
          <Text style={styles.website} numberOfLines={1}>🔗 {websiteDomain}</Text>
        )}
        
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
        
        {/* About/Description - Always show */}
        <View style={styles.aboutSection}>
          <Text style={styles.aboutLabel}>About</Text>
          <Text style={styles.aboutText} numberOfLines={3}>
            {item.description || 'No description available.'}
          </Text>
        </View>
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
    padding: 16, 
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(10px)',
    minHeight: 180, // Ensure enough space for all content
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
  location: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 6,
  },
  website: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
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
  // Compact card styles (for Saved page)
  compactCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  compactImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  compactBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  compactContent: {
    padding: 16,
  },
  compactTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginBottom: 8,
    lineHeight: 24,
  },
  compactEventDate: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  compactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  compactCategory: {
    color: '#666',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  compactSeparator: {
    color: '#ccc',
    marginHorizontal: 6,
    fontSize: 12,
  },
  compactPrice: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  compactDistance: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  compactLocation: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  compactWebsite: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  compactTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  compactTagChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  compactTagText: {
    color: '#666',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  compactDescription: {
    color: '#444',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
});


