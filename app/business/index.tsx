import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getBusinessProfile } from '@/lib/businessAuth';
import { useAuthStore } from '@/state/authStore';
import type { BusinessProfile } from '@/lib/businessAuth';

export default function BusinessPortalIndex() {
  const { user, isGuest } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    if (isGuest) {
      setLoading(false);
      return;
    }

    getBusinessProfile().then((profile) => {
      setBusinessProfile(profile);
      setLoading(false);
    });
  }, [isGuest, user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  // Not signed in
  if (isGuest) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 24, paddingTop: 80 }}>
          <Text style={styles.icon}>🏢</Text>
          <Text style={styles.title}>Swipely for Business</Text>
          <Text style={styles.subtitle}>
            Promote your restaurant, venue, or event to thousands of local users
          </Text>

          <View style={{ marginTop: 32 }}>
            <Text style={styles.benefitTitle}>Benefits:</Text>
            <Text style={styles.benefit}>• Reach engaged local audiences</Text>
            <Text style={styles.benefit}>• Boost visibility with promoted listings</Text>
            <Text style={styles.benefit}>• Track performance with analytics</Text>
            <Text style={styles.benefit}>• Manage all locations in one dashboard</Text>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/business/sign-up')}
          >
            <Text style={styles.primaryBtnText}>Create Business Account</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/business/sign-in')}
          >
            <Text style={styles.secondaryBtnText}>Sign In to Business Portal</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={styles.link}>Back to app</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Signed in but no business profile
  if (!businessProfile) {
    return (
      <View style={styles.container}>
        <View style={{ padding: 24, paddingTop: 80 }}>
          <Text style={styles.icon}>🏢</Text>
          <Text style={styles.title}>No Business Profile</Text>
          <Text style={styles.subtitle}>
            You're signed in as {user?.email}, but don't have a business account yet.
          </Text>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/business/create-profile')}
          >
            <Text style={styles.primaryBtnText}>Set Up Business Profile</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={styles.link}>Back to app</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Has business profile - redirect to dashboard
  useEffect(() => {
    if (businessProfile) {
      router.replace('/business/dashboard');
    }
  }, [businessProfile]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  icon: { fontSize: 64, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 24, textAlign: 'center', lineHeight: 22 },
  benefitTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  benefit: { fontSize: 15, color: '#333', marginBottom: 8, lineHeight: 22 },
  primaryBtn: { 
    marginTop: 32, 
    backgroundColor: '#111', 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondaryBtn: { 
    marginTop: 12, 
    backgroundColor: '#f0f0f0', 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  secondaryBtnText: { color: '#111', fontWeight: '800', fontSize: 16 },
  link: { color: '#007AFF', textAlign: 'center', fontSize: 14 },
});

