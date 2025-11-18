import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function PromoteListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [promoting, setPromoting] = useState(false);

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase!
        .from('listings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setListing(data);
    } catch (error) {
      console.error('Error loading listing:', error);
      Alert.alert('Error', 'Failed to load listing');
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    Alert.alert(
      'Promote Listing',
      'Make this listing featured to increase visibility. Featured listings appear first in the feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Featured',
          onPress: async () => {
            setPromoting(true);
            try {
              const { error } = await supabase!
                .from('listings')
                .update({ is_featured: true })
                .eq('id', id);

              if (error) throw error;

              Alert.alert(
                '✨ Listing Promoted!',
                'Your listing is now featured and will appear first in user feeds.',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to promote listing');
            } finally {
              setPromoting(false);
            }
          },
        },
      ]
    );
  };

  const handleUnpromote = async () => {
    setPromoting(true);
    try {
      const { error } = await supabase!
        .from('listings')
        .update({ is_featured: false })
        .eq('id', id);

      if (error) throw error;

      setListing({ ...listing, is_featured: false });
      Alert.alert('Success', 'Listing unpromoted');
    } catch (error) {
      Alert.alert('Error', 'Failed to unpromote listing');
    } finally {
      setPromoting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Listing not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.content}>
        <Text style={styles.title}>Promote Listing</Text>
        <Text style={styles.subtitle}>Increase visibility and reach more customers</Text>

        {/* Listing Info */}
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle}>{listing.title}</Text>
          <Text style={styles.listingMeta}>
            {listing.category} · {listing.city}
          </Text>
          {listing.is_featured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>⭐ Currently Featured</Text>
            </View>
          )}
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Listing Benefits</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>⭐</Text>
            <Text style={styles.benefitText}>Appear first in user feeds</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>📈</Text>
            <Text style={styles.benefitText}>3-5x more views on average</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>💫</Text>
            <Text style={styles.benefitText}>Special "Featured" badge on your listing</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🎯</Text>
            <Text style={styles.benefitText}>Higher engagement and save rates</Text>
          </View>
        </View>

        {/* Pricing (Placeholder) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <View style={styles.pricingCard}>
            <Text style={styles.pricingTitle}>Featured Placement</Text>
            <Text style={styles.pricingAmount}>$49</Text>
            <Text style={styles.pricingPeriod}>per month</Text>
            <Text style={styles.pricingDescription}>
              Cancel anytime. No long-term commitment.
            </Text>
          </View>
        </View>

        {/* Action Button */}
        {listing.is_featured ? (
          <Pressable
            style={[styles.actionBtn, styles.unpromoteBtn, promoting && styles.actionBtnDisabled]}
            onPress={handleUnpromote}
            disabled={promoting}
          >
            {promoting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>Remove Featured Status</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.actionBtn, styles.promoteBtn, promoting && styles.actionBtnDisabled]}
            onPress={handlePromote}
            disabled={promoting}
          >
            {promoting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>✨ Make Featured</Text>
            )}
          </Pressable>
        )}

        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.backLink}>← Back to Dashboard</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, lineHeight: 22 },
  listingInfo: {
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 24,
  },
  listingTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  listingMeta: { fontSize: 14, color: '#666' },
  featuredBadge: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFC107',
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  featuredText: { fontSize: 12, fontWeight: '800', color: '#000' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  benefitIcon: { fontSize: 24, marginRight: 12, width: 32 },
  benefitText: { fontSize: 15, color: '#333', flex: 1, lineHeight: 21 },
  pricingCard: {
    padding: 24,
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
  },
  pricingTitle: { fontSize: 16, fontWeight: '700', color: '#666', marginBottom: 8 },
  pricingAmount: { fontSize: 48, fontWeight: '800', color: '#007AFF' },
  pricingPeriod: { fontSize: 14, color: '#666', marginBottom: 12 },
  pricingDescription: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
  actionBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  promoteBtn: { backgroundColor: '#007AFF' },
  unpromoteBtn: { backgroundColor: '#666' },
  actionBtnDisabled: { backgroundColor: '#ccc' },
  actionBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  backLink: { color: '#007AFF', fontSize: 16, textAlign: 'center', fontWeight: '600' },
  errorText: { fontSize: 16, color: '#999' },
});

