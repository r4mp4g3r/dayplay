import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useFilterStore } from '@/state/filterStore';
import { useSavedStore } from '@/state/savedStore';
import { useOnboardingStore } from '@/state/onboardingStore';
import { useAuthStore } from '@/state/authStore';
import { useLocationStore, selectCity } from '@/state/locationStore';
import { signOut } from '@/lib/auth';
import { isDeveloper, registerAsDeveloper } from '@/lib/developerAuth';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { categories, distanceKm, priceTiers, setCategories, setPriceTiers, setDistanceKm, showNewThisWeek, showOpenNow, setShowNewThisWeek, setShowOpenNow } = useFilterStore();
  const { savedItems, clear } = useSavedStore();
  const { setCompleted } = useOnboardingStore();
  const { user, isGuest, loading: authLoading } = useAuthStore();
  const { city, availableCities } = useLocationStore();
  const insets = useSafeAreaInsets();
  const savedCount = savedItems.length;
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [developerStatus, setDeveloperStatus] = useState<boolean | null>(null);
  const [registeringDeveloper, setRegisteringDeveloper] = useState(false);

  useEffect(() => {
    if (!isGuest) {
      isDeveloper().then(setDeveloperStatus);
    }
  }, [isGuest, user]);
  
  const resetFilters = () => {
    setCategories([]);
    setPriceTiers([1, 2, 3, 4]);
    setDistanceKm(25);
    setShowNewThisWeek(false);
    setShowOpenNow(false);
    Alert.alert('Filters Reset', 'All filters have been reset to defaults', [
      { text: 'OK', onPress: () => router.push('/(tabs)/discover') }
    ]);
  };

  const clearSaved = () => {
    Alert.alert('Clear Saved Items?', 'This will remove all saved items', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clear() }
    ]);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out?',
      'Your saved items will remain in the cloud',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              Alert.alert('Signed Out', 'You can sign in again anytime');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Could not sign out');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Modern Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>
          {isGuest ? 'Guest mode' : user?.email || 'My account'}
        </Text>
      </View>

      {/* Account Section */}
        {authLoading ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.muted}>Loading...</Text>
        </View>
        ) : isGuest ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.infoText}>You are browsing as a guest</Text>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#007AFF', marginTop: 16 }]} onPress={() => router.push('/auth/sign-up')}>
            <Text style={styles.actionBtnText}>Create Account</Text>
            </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#666', marginTop: 8 }]} onPress={() => router.push('/auth/sign-in')}>
            <Text style={styles.actionBtnText}>Sign In</Text>
            </Pressable>
            {savedCount > 0 && (
            <View style={[styles.infoBox, { marginTop: 16 }]}>
              <Text style={styles.infoBoxText}>
                💡 Sign up to sync {savedCount} saved item{savedCount !== 1 ? 's' : ''} across devices
              </Text>
            </View>
            )}
          </View>
        ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoBox}>
            <Text style={styles.emailText}>📧 {user?.email}</Text>
          </View>
          <Pressable style={[styles.actionBtn, { backgroundColor: '#FF3B30', marginTop: 16 }]} onPress={handleSignOut}>
            <Text style={styles.actionBtnText}>Sign Out</Text>
            </Pressable>
          </View>
        )}

      {/* City Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <Pressable style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]} onPress={() => setShowCityPicker(true)}>
          <Text style={styles.actionBtnText}>📍 {city} - Change City</Text>
        </Pressable>
      </View>

      {/* Filters Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.infoBox}>
        <Text style={styles.infoText}>Categories: {categories.length > 0 ? categories.join(', ') : 'All'}</Text>
        <Text style={styles.infoText}>Distance: {distanceKm} km</Text>
        <Text style={styles.infoText}>Saved items: {savedCount}</Text>
        {showNewThisWeek && <Text style={[styles.infoText, { color: '#ff9800' }]}>⚠️ "New This Week" filter is ON</Text>}
        {showOpenNow && <Text style={[styles.infoText, { color: '#ff9800' }]}>⚠️ "Open Now" filter is ON</Text>}
        </View>
        <Pressable style={[styles.actionBtn, { backgroundColor: '#666', marginTop: 12 }]} onPress={resetFilters}>
          <Text style={styles.actionBtnText}>Reset All Filters</Text>
        </Pressable>
        {savedCount > 0 && (
          <Pressable style={[styles.actionBtn, { backgroundColor: '#FF3B30', marginTop: 8 }]} onPress={clearSaved}>
            <Text style={styles.actionBtnText}>Clear Saved Items</Text>
          </Pressable>
        )}
      </View>

      {/* Contribute Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contribute</Text>
        <Pressable style={[styles.actionBtn, { backgroundColor: '#FF9500' }]} onPress={() => router.push('/submit-gem')}>
          <Text style={styles.actionBtnText}>💎 Submit a Hidden Gem</Text>
        </Pressable>
      </View>

      {/* Business Section temporarily hidden */}

      {/* Legal Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <Pressable style={styles.linkRow}>
        <Text style={styles.link}>Terms of Service</Text>
        </Pressable>
        <Pressable style={styles.linkRow}>
        <Text style={styles.link}>Privacy Policy</Text>
        </Pressable>
      </View>

      {/* Development Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Development</Text>
        
        {!isGuest && (
          <>
            {developerStatus === null ? (
              <View style={[styles.infoBox, { marginBottom: 12 }]}>
                <Text style={styles.infoText}>Checking developer status...</Text>
              </View>
            ) : developerStatus ? (
              <View style={[styles.infoBox, { marginBottom: 12, borderLeftColor: '#4CAF50' }]}>
                <Text style={[styles.emailText, { color: '#4CAF50' }]}>✅ Developer Account Active</Text>
                <Text style={[styles.infoText, { marginTop: 8 }]}>You have access to the moderation interface</Text>
              </View>
            ) : (
              <View style={[styles.infoBox, { marginBottom: 12 }]}>
                <Text style={styles.emailText}>🔧 Become a Developer</Text>
                <Text style={[styles.infoText, { marginTop: 8 }]}>
                  Get access to moderate user-submitted hidden gems and help maintain content quality
                </Text>
              </View>
            )}

            {developerStatus ? (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                onPress={() => router.push('/moderation')}
              >
                <Text style={styles.actionBtnText}>🛡️ Open Moderation Panel</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#6366F1' }]}
                onPress={async () => {
                  setRegisteringDeveloper(true);
                  const success = await registerAsDeveloper();
                  setRegisteringDeveloper(false);
                  
                  if (success) {
                    setDeveloperStatus(true);
                    Alert.alert(
                      '✅ Developer Account Created!',
                      'You now have access to the moderation panel. You can approve/reject user-submitted hidden gems.',
                      [
                        { text: 'OK' },
                        { text: 'Open Moderation', onPress: () => router.push('/moderation') }
                      ]
                    );
                  } else {
                    Alert.alert('Error', 'Failed to create developer account. Please try again.');
                  }
                }}
                disabled={registeringDeveloper}
              >
                {registeringDeveloper ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>Register as Developer</Text>
                )}
              </Pressable>
            )}
          </>
        )}

        <Pressable 
          style={[styles.actionBtn, { backgroundColor: '#8E8E93', marginTop: 12 }]} 
          onPress={() => {
            Alert.alert(
              'Restart Onboarding?',
              'This will clear all saved items and reset filters',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Reset Everything', 
                  style: 'destructive',
                  onPress: () => {
                    clear();
                    setCategories([]);
                    setPriceTiers([1, 2, 3, 4]);
                    setDistanceKm(25);
                    setCompleted(false);
                    router.replace('/onboarding');
                  }
                }
              ]
            );
          }}
        >
          <Text style={styles.actionBtnText}>Restart Onboarding</Text>
        </Pressable>
      </View>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} transparent animationType="slide" onRequestClose={() => setShowCityPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCityPicker(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choose Your City</Text>
            {availableCities.map((cityName) => (
              <Pressable
                key={cityName}
                style={styles.cityOption}
                onPress={() => {
                  selectCity(cityName);
                  setShowCityPicker(false);
                  Alert.alert('City Changed', `Now showing ${cityName}`, [
                    { text: 'OK', onPress: () => router.push('/(tabs)/discover') }
                  ]);
                }}
              >
                <Text style={styles.cityOptionText}>
                  {cityName === city ? '✓ ' : ''}{cityName}
                </Text>
              </Pressable>
            ))}
            <Pressable style={[styles.cityOption, { marginTop: 8 }]} onPress={() => setShowCityPicker(false)}>
              <Text style={[styles.cityOptionText, { color: '#999' }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: '#000' },
  muted: { color: '#666', fontSize: 14, marginBottom: 12 },
  infoBox: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  infoText: { color: '#666', fontSize: 14, marginBottom: 8 },
  infoBoxText: { color: '#666', fontSize: 13, lineHeight: 18 },
  emailText: { color: '#333', fontSize: 15, fontWeight: '600' },
  actionBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  helper: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  linkRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  link: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  cityOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cityOptionText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
});


