import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { Listing } from '@/types/domain';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.55;

interface PhotoGalleryModalProps {
  visible: boolean;
  listing: Listing | null;
  onClose: () => void;
}

export function PhotoGalleryModal({ visible, listing, onClose }: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      // Prefetch all images
      if (listing?.images) {
        listing.images.forEach((url) => {
          try { Image.prefetch(url); } catch {}
        });
      }
    }
  }, [visible, listing]);

  const handleScroll = (event: any) => {
    const contentOffsetY = event.nativeEvent.contentOffset.y;
    const rawIndex = Math.round(contentOffsetY / IMAGE_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(rawIndex, (listing?.images?.length || 1) - 1));
    setCurrentIndex(clampedIndex);
  };

  // Early return AFTER all hooks are called
  if (!visible || !listing || !listing.images || listing.images.length === 0) {
    return null;
  }

  const photos = listing.images;

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {/* Dimmed backdrop so Discover UI is still visible behind */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.content}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <FontAwesome name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.photoCounter}>
            {currentIndex + 1} of {photos.length}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Photo ScrollView */}
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {photos.map((photoUrl, index) => (
            <View key={index} style={styles.photoContainer}>
              <Image
                source={{ uri: photoUrl }}
                style={styles.photo}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.bottomTitle} numberOfLines={1}>
            {listing.title}
          </Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{listing.category}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Keep this transparent so the Discover page remains fully visible
    backgroundColor: 'transparent',
  },
  content: {
    width: SCREEN_WIDTH - 32,
    // Slightly shorter so the underlying swipe actions remain clearly visible
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.9)',
    marginTop: 20, // sit roughly where the card is, not full-screen
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  photoCounter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  photoContainer: {
    width: SCREEN_WIDTH - 32,
    height: IMAGE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: SCREEN_WIDTH - 32,
    height: '100%',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  bottomTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
});

