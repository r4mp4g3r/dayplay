import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { getLocalsFavorites } from '@/lib/localsFavoritesApi';
import { getTrendingListings } from '@/lib/api';
import type { LocalFavorite, Listing } from '@/types/domain';
import { LocalFavoriteCard } from '@/components/LocalFavoriteCard';
import { useLocationStore } from '@/state/locationStore';

type SortOption = 'newest' | 'trending' | 'nearby';

export default function LocalsTab() {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<LocalFavorite[]>([]);
  const [trendingListings, setTrendingListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  const locationStore = useLocationStore();
  const userCity = locationStore.city;

  const loadFavorites = React.useCallback(async () => {
    try {
      const data = await getLocalsFavorites({
        sortBy,
        limit: 50,
        city: userCity, // Filter by current city
      });
      setFavorites(data);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sortBy, userCity]);

  const loadTrendingListings = React.useCallback(async () => {
    if (!userCity) {
      console.log('No user city set, skipping trending');
      return;
    }
    try {
      console.log('Loading trending for city:', userCity);
      const trending = await getTrendingListings(userCity);
      console.log('Trending results:', trending.length, 'listings');
      setTrendingListings(trending);
    } catch (error) {
      console.error('Error loading trending listings:', error);
    }
  }, [userCity]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    loadTrendingListings();
  }, [loadTrendingListings]);

  // Refresh trending on screen focus
  useFocusEffect(
    React.useCallback(() => {
      loadTrendingListings();
      const interval = setInterval(() => loadTrendingListings(), 60000); // Refresh every 60s
      return () => clearInterval(interval);
    }, [loadTrendingListings])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const handleAddFavorite = () => {
    router.push('/(tabs)/submit-gem');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Local Suggestions</Text>
        <Text style={styles.headerSubtitle}>User-submitted spots from the community</Text>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Trending Listings Section */}
        {trendingListings.length > 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.trendingSectionHeader}>
              <Text style={styles.trendingSectionTitle}>🔥 Trending Spots</Text>
              <Text style={styles.trendingSectionSubtitle}>Most upvoted places this month</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingScrollContent}
            >
              {trendingListings.map((listing) => (
                <Pressable
                  key={listing.id}
                  style={styles.trendingCard}
                  onPress={() =>
                    router.push({ pathname: '/listing/[id]', params: { id: listing.id } })
                  }
                >
                  {listing.images?.[0] ? (
                    <Image 
                      source={{ uri: listing.images[0] }} 
                      style={styles.trendingImage} 
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.trendingImage, { backgroundColor: '#e9e9e9' }]} />
                  )}
                  <View style={styles.trendingCardContent}>
                    <Text style={styles.trendingCardTitle} numberOfLines={1}>
                      {listing.title}
                    </Text>
                    <Text style={styles.trendingCardCategory} numberOfLines={1}>
                      {listing.category}
                    </Text>
                    <View style={styles.upvoteBadge}>
                      <Text style={styles.upvoteBadgeText}>
                        ⬆️ {listing.upvoteCount || 0}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sort Options */}
        <View style={styles.sortRow}>
          <Pressable
            style={[styles.sortBtn, sortBy === 'trending' && styles.sortBtnActive]}
            onPress={() => setSortBy('trending')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'trending' && styles.sortBtnTextActive]}>
              🔥 Trending
            </Text>
          </Pressable>
          <Pressable
            style={[styles.sortBtn, sortBy === 'newest' && styles.sortBtnActive]}
            onPress={() => setSortBy('newest')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'newest' && styles.sortBtnTextActive]}>
              ✨ Newest
            </Text>
          </Pressable>
          <Pressable
            style={[styles.sortBtn, sortBy === 'nearby' && styles.sortBtnActive]}
            onPress={() => setSortBy('nearby')}
          >
            <Text style={[styles.sortBtnText, sortBy === 'nearby' && styles.sortBtnTextActive]}>
              📍 Nearby
            </Text>
          </Pressable>
        </View>

        {/* List */}
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>💎</Text>
            <Text style={styles.emptyStateTitle}>No suggestions yet</Text>
            <Text style={styles.emptyStateText}>
              Be the first to share a local spot with the community!
            </Text>
            <Pressable style={styles.addFirstBtn} onPress={handleAddFavorite}>
              <Text style={styles.addFirstBtnText}>Submit a Suggestion</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {favorites.map((item) => (
              <LocalFavoriteCard key={item.id} favorite={item} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Add Button */}
      <Pressable style={styles.fab} onPress={handleAddFavorite}>
        <Text style={styles.fabText}>+ Add Spot</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#666' },
  trendingSection: {
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  trendingSectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  trendingSectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  trendingSectionSubtitle: { fontSize: 13, color: '#666' },
  trendingScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  trendingCard: {
    width: 180,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    marginHorizontal: 4,
  },
  trendingImage: {
    width: 180,
    height: 120,
    backgroundColor: '#e9e9e9',
  },
  trendingCardContent: {
    padding: 12,
  },
  trendingCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  trendingCardCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  upvoteBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff4458',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  upvoteBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  sortRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sortBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  sortBtnActive: { backgroundColor: '#007AFF' },
  sortBtnText: { fontSize: 13, fontWeight: '600', color: '#666' },
  sortBtnTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 100 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateIcon: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  addFirstBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  addFirstBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});