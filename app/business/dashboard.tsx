import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { getBusinessProfile, getBusinessListings, getBusinessAnalytics } from '@/lib/businessAuth';
import { signOut } from '@/lib/auth';
import type { BusinessProfile } from '@/lib/businessAuth';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function BusinessDashboard() {
  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profile, businessListings, stats] = await Promise.all([
        getBusinessProfile(),
        getBusinessListings(),
        getBusinessAnalytics({
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          end: new Date(),
        }),
      ]);

      setBusinessProfile(profile);
      setListings(businessListings);
      setAnalytics(stats);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out?', 'You can sign back in anytime', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/business');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading dashboard...</Text>
      </View>
    );
  }

  if (!businessProfile) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 18, color: '#999' }}>No business profile found</Text>
        <Pressable onPress={() => router.replace('/business')} style={{ marginTop: 16 }}>
          <Text style={{ color: '#007AFF' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const totalViews = analytics.filter((a) => a.metric_type === 'view').length;
  const totalLikes = analytics.filter((a) => a.metric_type === 'swipe_right').length;
  const totalSaves = analytics.filter((a) => a.metric_type === 'save').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.businessName}>{businessProfile.business_name}</Text>
          <Text style={styles.email}>{businessProfile.contact_email}</Text>
          {businessProfile.is_verified && (
            <Text style={styles.verified}>✓ Verified</Text>
          )}
        </View>
        <Pressable onPress={handleSignOut}>
          <FontAwesome name="sign-out" size={24} color="#666" />
        </Pressable>
      </View>

      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last 30 Days</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalViews}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalLikes}</Text>
            <Text style={styles.statLabel}>Likes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalSaves}</Text>
            <Text style={styles.statLabel}>Saves</Text>
          </View>
        </View>
      </View>

      {/* My Listings */}
      <View style={styles.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.sectionTitle}>My Listings ({listings.length})</Text>
          <Pressable onPress={() => router.push('/business/create-listing')}>
            <Text style={{ color: '#007AFF', fontWeight: '700' }}>+ Add New</Text>
          </Pressable>
        </View>
        
        {listings.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: '#999' }}>No listings yet</Text>
            <Pressable
              style={[styles.primaryBtn, { marginTop: 12 }]}
              onPress={() => router.push('/business/create-listing')}
            >
              <Text style={styles.primaryBtnText}>Create Your First Listing</Text>
            </Pressable>
          </View>
        ) : (
          listings.map((listing) => (
            <View key={listing.id} style={styles.listingCard}>
              <Text style={{ fontWeight: '700', fontSize: 16 }}>{listing.title}</Text>
              <Text style={{ color: '#666', marginTop: 4 }}>{listing.category} · {listing.city}</Text>
              <Pressable
                style={{ marginTop: 8 }}
                onPress={() => router.push(`/business/promote/${listing.id}`)}
              >
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>Promote this listing</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push('/business/create-listing')}
        >
          <FontAwesome name="plus-circle" size={20} color="#111" />
          <Text style={styles.actionText}>Submit New Listing</Text>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => Alert.alert('Coming Soon', 'Promotions will be available soon')}
        >
          <FontAwesome name="rocket" size={20} color="#111" />
          <Text style={styles.actionText}>Boost a Listing</Text>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => Alert.alert('Coming Soon', 'Detailed analytics coming soon')}
        >
          <FontAwesome name="bar-chart" size={20} color="#111" />
          <Text style={styles.actionText}>View Analytics</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  header: { 
    backgroundColor: '#fff', 
    padding: 20, 
    paddingTop: 60, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  businessName: { fontSize: 22, fontWeight: '800' },
  email: { fontSize: 14, color: '#666', marginTop: 4 },
  verified: { fontSize: 12, color: '#4CAF50', fontWeight: '700', marginTop: 4 },
  section: { backgroundColor: '#fff', padding: 16, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { 
    flex: 1, 
    backgroundColor: '#f9f9f9', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 13, color: '#666', marginTop: 4 },
  listingCard: { 
    backgroundColor: '#f9f9f9', 
    padding: 14, 
    borderRadius: 10, 
    marginBottom: 10 
  },
  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 14, 
    backgroundColor: '#f9f9f9', 
    borderRadius: 10, 
    marginBottom: 8 
  },
  actionText: { fontSize: 16, fontWeight: '600' },
  primaryBtn: { 
    backgroundColor: '#111', 
    paddingVertical: 12, 
    borderRadius: 10, 
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

