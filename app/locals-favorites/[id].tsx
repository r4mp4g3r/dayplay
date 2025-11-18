import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Linking,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getLocalFavorite,
  likeLocalFavorite,
  unlikeLocalFavorite,
  saveLocalFavorite,
  unsaveLocalFavorite,
} from '@/lib/localsFavoritesApi';
import type { LocalFavorite } from '@/types/domain';
import { ListingMap } from '@/components/ListingMap';

export default function LocalFavoriteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [favorite, setFavorite] = useState<LocalFavorite | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    loadFavorite();
  }, [id]);

  const loadFavorite = async () => {
    if (!id) return;
    
    setLoading(true);
    const data = await getLocalFavorite(id);
    
    if (data) {
      setFavorite(data);
      setIsLiked(data.is_liked || false);
      setIsSaved(data.is_saved || false);
      setLikesCount(data.likes_count);
    }
    
    setLoading(false);
  };

  const handleLike = async () => {
    if (!favorite) return;
    
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
    if (!favorite) return;
    
    if (isSaved) {
      const success = await unsaveLocalFavorite(favorite.id);
      if (success) setIsSaved(false);
    } else {
      const success = await saveLocalFavorite(favorite.id);
      if (success) setIsSaved(true);
    }
  };

  const handleDirections = () => {
    if (!favorite) return;
    Linking.openURL(
      `http://maps.apple.com/?daddr=${favorite.latitude},${favorite.longitude}`
    );
  };

  const handleShare = () => {
    if (!favorite) return;
    Share.share({
      message: `Check out this hidden gem: ${favorite.name} - ${favorite.description}`,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!favorite) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Favorite not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentInsetAdjustmentBehavior="automatic">
      {/* Image */}
      {favorite.photo_url ? (
        <Image source={{ uri: favorite.photo_url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderIcon}>📍</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{favorite.name}</Text>
            <Text style={styles.category}>{favorite.category}</Text>
            {favorite.distanceKm && (
              <Text style={styles.distance}>📍 {favorite.distanceKm} km away</Text>
            )}
          </View>
          {favorite.price_tier && (
            <Text style={styles.priceTier}>{'$'.repeat(favorite.price_tier)}</Text>
          )}
        </View>

        {/* Vibes */}
        {favorite.vibes && favorite.vibes.length > 0 && (
          <View style={styles.vibesRow}>
            {favorite.vibes.map((vibe) => (
              <View key={vibe} style={styles.vibeChip}>
                <Text style={styles.vibeText}>{vibe}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Description */}
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>{favorite.description}</Text>

        {/* Details */}
        {(favorite.hours || favorite.website || favorite.address) && (
          <>
            <Text style={styles.sectionTitle}>Details</Text>
            {favorite.hours && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hours:</Text>
                <Text style={styles.detailValue}>{favorite.hours}</Text>
              </View>
            )}
            {favorite.address && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailValue}>{favorite.address}</Text>
              </View>
            )}
            {favorite.website && (
              <Pressable
                style={styles.detailRow}
                onPress={() => Linking.openURL(favorite.website!)}
              >
                <Text style={styles.detailLabel}>Website:</Text>
                <Text style={[styles.detailValue, styles.link]}>Visit site</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Posted By */}
        <View style={styles.postedBy}>
          <Text style={styles.postedByText}>
            💎 Shared by {favorite.user_display_name || 'Local'}
          </Text>
          <Text style={styles.statsText}>
            {likesCount} likes • {favorite.saves_count} saves
          </Text>
        </View>

        {/* Map */}
        <Text style={styles.sectionTitle}>Location</Text>
        <ListingMap latitude={favorite.latitude} longitude={favorite.longitude} />

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable style={styles.likeBtn} onPress={handleLike}>
            <Text style={styles.actionIcon}>{isLiked ? '❤️' : '🤍'}</Text>
            <Text style={styles.actionText}>Like ({likesCount})</Text>
          </Pressable>

          <Pressable style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.actionIcon}>{isSaved ? '🔖' : '📑'}</Text>
            <Text style={styles.actionText}>{isSaved ? 'Saved' : 'Save'}</Text>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.directionsBtn} onPress={handleDirections}>
            <Text style={styles.directionsBtnText}>Get Directions</Text>
          </Pressable>

          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: 300, backgroundColor: '#f0f0f0' },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9e9e9',
  },
  imagePlaceholderIcon: { fontSize: 64 },
  content: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  name: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  category: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  distance: { fontSize: 13, color: '#666' },
  priceTier: { fontSize: 24, fontWeight: '700', color: '#333' },
  vibesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  vibeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
  },
  vibeText: { fontSize: 12, fontWeight: '600', color: '#666' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 20, marginBottom: 12 },
  description: { fontSize: 16, color: '#333', lineHeight: 24 },
  detailRow: { flexDirection: 'row', marginBottom: 12 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: '#666', width: 80 },
  detailValue: { fontSize: 14, color: '#333', flex: 1 },
  link: { color: '#007AFF', textDecorationLine: 'underline' },
  postedBy: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 8,
  },
  postedByText: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  statsText: { fontSize: 13, color: '#999' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  likeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFE5E5',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E5F3FF',
  },
  actionIcon: { fontSize: 18 },
  actionText: { fontSize: 15, fontWeight: '700', color: '#333' },
  directionsBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  directionsBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  shareBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f1f1',
    alignItems: 'center',
  },
  shareBtnText: { color: '#333', fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 16, color: '#999' },
});

