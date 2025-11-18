import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { getLocalsFavorites } from '@/lib/localsFavoritesApi';
import type { LocalFavorite } from '@/types/domain';
import { LocalFavoriteCard } from '@/components/LocalFavoriteCard';

type SortOption = 'newest' | 'trending' | 'nearby';

export default function LocalsFavoritesScreen() {
  const [favorites, setFavorites] = useState<LocalFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('trending');

  const loadFavorites = async () => {
    try {
      const data = await getLocalsFavorites({
        sortBy,
        limit: 50,
      });
      setFavorites(data);
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [sortBy]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const handleAddFavorite = () => {
    router.push('/locals-favorites/add');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Locals' Favorites 💎</Text>
        <Text style={styles.headerSubtitle}>Hidden gems shared by the community</Text>
      </View>

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
          <Text style={styles.emptyStateTitle}>No favorites yet</Text>
          <Text style={styles.emptyStateText}>
            Be the first to share a hidden gem with the community!
          </Text>
          <Pressable style={styles.addFirstBtn} onPress={handleAddFavorite}>
            <Text style={styles.addFirstBtnText}>Add a Favorite</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={({ item }) => <LocalFavoriteCard favorite={item} />}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

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
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#666' },
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

