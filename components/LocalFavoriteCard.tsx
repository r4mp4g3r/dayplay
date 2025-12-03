import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { LocalFavorite } from '@/types/domain';
import {
  likeLocalFavorite,
  unlikeLocalFavorite,
  saveLocalFavorite,
  unsaveLocalFavorite,
} from '@/lib/localsFavoritesApi';

interface LocalFavoriteCardProps {
  favorite: LocalFavorite;
}

export function LocalFavoriteCard({ favorite }: LocalFavoriteCardProps) {
  const [isLiked, setIsLiked] = useState(favorite.is_liked || false);
  const [isSaved, setIsSaved] = useState(favorite.is_saved || false);
  const [likesCount, setLikesCount] = useState(favorite.likes_count);

  // Debug logging
  if (favorite.id.startsWith('mock-')) {
    console.log(`[LocalFavoriteCard] Mock favorite ${favorite.name}:`, {
      photos: favorite.photos,
      photo_url: favorite.photo_url,
      photosLength: favorite.photos?.length || 0,
    });
  }

  const handleLike = async () => {
    if (isLiked) {
      const success = await unlikeLocalFavorite(favorite.id);
      if (success) {
        setIsLiked(false);
        setLikesCount((prev) => Math.max(0, prev - 1));
      }
    } else {
      const success = await likeLocalFavorite(favorite.id);
      if (success) {
        setIsLiked(true);
        setLikesCount((prev) => prev + 1);
      }
    }
  };

  const handleSave = async () => {
    if (isSaved) {
      const success = await unsaveLocalFavorite(favorite.id);
      if (success) setIsSaved(false);
    } else {
      const success = await saveLocalFavorite(favorite.id);
      if (success) setIsSaved(true);
    }
  };

  const handlePress = () => {
    router.push(`/locals-favorites/${favorite.id}`);
  };

  const firstPhoto = favorite.photos?.[0] || favorite.photo_url;

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      {/* Image */}
      {firstPhoto ? (
        <Image source={{ uri: firstPhoto }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderIcon}>📍</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {favorite.name}
            </Text>
            <Text style={styles.category}>{favorite.category}</Text>
          </View>
          {favorite.price_tier && (
            <Text style={styles.priceTier}>{'$'.repeat(favorite.price_tier)}</Text>
          )}
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {favorite.description}
        </Text>

        {/* Vibes */}
        {favorite.vibes && favorite.vibes.length > 0 && (
          <View style={styles.vibesRow}>
            {favorite.vibes.slice(0, 3).map((vibe) => (
              <View key={vibe} style={styles.vibeChip}>
                <Text style={styles.vibeText}>{vibe}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Meta */}
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            by {favorite.user_display_name || 'Local'}
            {favorite.distanceKm && ` • ${favorite.distanceKm} km away`}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={handleLike}>
            <Text style={styles.actionIcon}>{isLiked ? '❤️' : '🤍'}</Text>
            <Text style={styles.actionText}>{likesCount}</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleSave}>
            <Text style={styles.actionIcon}>{isSaved ? '🔖' : '📑'}</Text>
            <Text style={styles.actionText}>Save</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handlePress}>
            <Text style={styles.actionIcon}>👀</Text>
            <Text style={styles.actionText}>View</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9e9e9',
  },
  imagePlaceholderIcon: { fontSize: 48 },
  content: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  name: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  category: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'capitalize',
  },
  priceTier: { fontSize: 16, fontWeight: '700', color: '#333' },
  description: { fontSize: 15, color: '#666', lineHeight: 21, marginBottom: 12 },
  vibesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  vibeChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
  },
  vibeText: { fontSize: 11, fontWeight: '600', color: '#666' },
  meta: { marginBottom: 12 },
  metaText: { fontSize: 13, color: '#999' },
  actions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  actionIcon: { fontSize: 16 },
  actionText: { fontSize: 13, fontWeight: '600', color: '#333' },
});

