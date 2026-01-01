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
import { useUpvoteStore } from '@/state/upvoteStore';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function ProfileScreen() {
  const { categories, distanceKm, priceTiers, setCategories, setPriceTiers, setDistanceKm, showNewThisWeek, showOpenNow, setShowNewThisWeek, setShowOpenNow } = useFilterStore();
  const { savedItems, clear } = useSavedStore();
  const { setCompleted } = useOnboardingStore();
  const { user, isGuest, loading: authLoading } = useAuthStore();
  const { city, availableCities } = useLocationStore();
  const upvoteStore = useUpvoteStore();
  const insets = useSafeAreaInsets();
  const savedCount = savedItems.length;
  const upvoteCount = upvoteStore.upvotedListings.size;
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [developerStatus, setDeveloperStatus] = useState<boolean | null>(null);
  const [registeringDeveloper, setRegisteringDeveloper] = useState(false);

  useEffect(() => {
    if (!isGuest) {
      isDeveloper().then(setDeveloperStatus);
    }
  }, [isGuest, user]);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (isGuest) return 'G';
    const email = user?.email || '';
    return email.charAt(0).toUpperCase() || '?';
  };
  
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
      {/* Modern Header with Avatar */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isGuest && styles.avatarGuest]}>
            <Text style={styles.avatarText}>{getUserInitials()}</Text>
          </View>
        </View>
        <Text style={styles.headerTitle}>
          {isGuest ? 'Guest User' : user?.email?.split('@')[0] || 'My Profile'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {isGuest ? 'Sign in to sync across devices' : user?.email}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <FontAwesome name="heart" size={24} color="#FF3B30" />
          <Text style={styles.statValue}>{savedCount}</Text>
          <Text style={styles.statLabel}>Saved</Text>
        </View>
        <View style={styles.statCard}>
          <FontAwesome name="thumbs-up" size={24} color="#007AFF" />
          <Text style={styles.statValue}>{upvoteCount}</Text>
          <Text style={styles.statLabel}>Upvoted</Text>
        </View>
        <Pressable style={styles.statCard} onPress={() => setShowCityPicker(true)}>
          <FontAwesome name="map-marker" size={24} color="#4CAF50" />
          <View style={{ alignItems: 'center', width: '100%', paddingHorizontal: 4 }}>
            <Text style={[styles.statValue, { fontSize: 14 }]} numberOfLines={1} ellipsizeMode="tail">
              {city}
            </Text>
          </View>
          <Text style={styles.statLabel}>Tap to Change</Text>
        </Pressable>
      </View>

      {/* Account Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FontAwesome name="user" size={18} color="#000" /> Account
        </Text>
        {authLoading ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={[styles.muted, { marginTop: 8 }]}>Loading...</Text>
          </View>
        ) : isGuest ? (
          <>
            <View style={styles.guestBanner}>
              <FontAwesome name="info-circle" size={20} color="#FF9500" />
              <Text style={styles.guestBannerText}>
                You're browsing as a guest. Sign in to save your preferences!
              </Text>
            </View>
            <Pressable style={[styles.actionBtn, styles.primaryBtn]} onPress={() => router.push('/auth/sign-up')}>
              <FontAwesome name="user-plus" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Create Account</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.secondaryBtn]} onPress={() => router.push('/auth/sign-in')}>
              <FontAwesome name="sign-in" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Sign In</Text>
            </Pressable>
            {savedCount > 0 && (
              <View style={styles.tipBox}>
                <Text style={styles.tipText}>
                  💡 Sign up to sync {savedCount} saved item{savedCount !== 1 ? 's' : ''} across devices
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.accountInfo}>
              <FontAwesome name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.accountEmail}>{user?.email}</Text>
            </View>
            <Pressable style={[styles.actionBtn, styles.dangerBtn]} onPress={handleSignOut}>
              <FontAwesome name="sign-out" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.actionBtnText}>Sign Out</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Location Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FontAwesome name="map-marker" size={18} color="#000" /> Location
        </Text>
        <Pressable style={styles.locationRow} onPress={() => setShowCityPicker(true)}>
          <View style={styles.locationInfo}>
            <FontAwesome name="map-marker" size={20} color="#4CAF50" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.locationLabel}>Current City</Text>
              <Text style={styles.locationValue} numberOfLines={1}>{city}</Text>
            </View>
          </View>
          <FontAwesome name="chevron-right" size={16} color="#ccc" />
        </Pressable>
      </View>

      {/* Preferences Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FontAwesome name="sliders" size={18} color="#000" /> Preferences
        </Text>
        <View style={styles.preferencesList}>
          <View style={styles.preferenceItem}>
            <FontAwesome name="tags" size={14} color="#666" />
            <Text style={styles.preferenceLabel}>Categories</Text>
            <Text style={styles.preferenceValue}>{categories.length > 0 ? categories.length : 'All'}</Text>
          </View>
          <View style={styles.preferenceItem}>
            <FontAwesome name="location-arrow" size={14} color="#666" />
            <Text style={styles.preferenceLabel}>Distance</Text>
            <Text style={styles.preferenceValue}>{distanceKm} km</Text>
          </View>
          {showNewThisWeek && (
            <View style={[styles.preferenceItem, { backgroundColor: '#FFF3E0' }]}>
              <FontAwesome name="star" size={14} color="#FF9500" />
              <Text style={[styles.preferenceLabel, { color: '#FF9500' }]}>New This Week</Text>
              <Text style={[styles.preferenceValue, { color: '#FF9500' }]}>ON</Text>
            </View>
          )}
          {showOpenNow && (
            <View style={[styles.preferenceItem, { backgroundColor: '#E8F5E9' }]}>
              <FontAwesome name="clock-o" size={14} color="#4CAF50" />
              <Text style={[styles.preferenceLabel, { color: '#4CAF50' }]}>Open Now</Text>
              <Text style={[styles.preferenceValue, { color: '#4CAF50' }]}>ON</Text>
            </View>
          )}
        </View>
        <Pressable style={[styles.actionBtn, styles.secondaryBtn]} onPress={resetFilters}>
          <FontAwesome name="refresh" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.actionBtnText}>Reset All Filters</Text>
        </Pressable>
        {savedCount > 0 && (
          <Pressable style={[styles.actionBtn, styles.dangerBtn]} onPress={clearSaved}>
            <FontAwesome name="trash" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Clear Saved Items</Text>
          </Pressable>
        )}
      </View>

      {/* Contribute Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FontAwesome name="plus-circle" size={18} color="#000" /> Contribute
        </Text>
        <Pressable style={[styles.actionBtn, styles.contributeBtn]} onPress={() => router.push('/(tabs)/submit-gem')}>
          <FontAwesome name="diamond" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.actionBtnText}>Submit a Local Gem</Text>
        </Pressable>
      </View>

      {/* Legal Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FontAwesome name="file-text" size={18} color="#000" /> Legal
        </Text>
        <Pressable style={styles.linkRow}>
          <FontAwesome name="file-text-o" size={14} color="#007AFF" />
          <Text style={styles.link}>Terms of Service</Text>
          <FontAwesome name="chevron-right" size={14} color="#007AFF" />
        </Pressable>
        <Pressable style={styles.linkRow}>
          <FontAwesome name="shield" size={14} color="#007AFF" />
          <Text style={styles.link}>Privacy Policy</Text>
          <FontAwesome name="chevron-right" size={14} color="#007AFF" />
        </Pressable>
      </View>

      {/* Development Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FontAwesome name="code" size={18} color="#000" /> Development
        </Text>
        
        {!isGuest && (
          <>
            {developerStatus === null ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={[styles.muted, { marginLeft: 8 }]}>Checking developer status...</Text>
              </View>
            ) : developerStatus ? (
              <View style={styles.successBox}>
                <FontAwesome name="check-circle" size={20} color="#4CAF50" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.successTitle}>Developer Account Active</Text>
                  <Text style={styles.successText}>You have access to the moderation interface</Text>
                </View>
              </View>
            ) : (
              <View style={styles.devInfoBox}>
                <FontAwesome name="wrench" size={20} color="#6366F1" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.devInfoTitle}>Become a Developer</Text>
                  <Text style={styles.devInfoText}>
                    Get access to moderate user-submitted local suggestions and help maintain content quality
                  </Text>
                </View>
              </View>
            )}

            {developerStatus ? (
              <Pressable
                style={[styles.actionBtn, styles.successBtn]}
                onPress={() => router.push('/moderation')}
              >
                <FontAwesome name="shield" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Open Moderation Panel</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.actionBtn, styles.devBtn]}
                onPress={async () => {
                  setRegisteringDeveloper(true);
                  const success = await registerAsDeveloper();
                  setRegisteringDeveloper(false);
                  
                  if (success) {
                    setDeveloperStatus(true);
                    Alert.alert(
                      '✅ Developer Account Created!',
                      'You now have access to the moderation panel. You can approve/reject user-submitted local suggestions.',
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
                  <>
                    <FontAwesome name="code" size={16} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>Register as Developer</Text>
                  </>
                )}
              </Pressable>
            )}
          </>
        )}

        <Pressable 
          style={[styles.actionBtn, styles.resetBtn]} 
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
                    // Send user back through the main welcome screen so they can
                    // choose Sign Up / Sign In / Continue as Guest again.
                    router.replace('/welcome');
                  }
                }
              ]
            );
          }}
        >
          <FontAwesome name="undo" size={16} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.actionBtnText}>Restart Onboarding</Text>
        </Pressable>
      </View>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} transparent animationType="slide" onRequestClose={() => setShowCityPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCityPicker(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Choose Your City</Text>
            <Text style={styles.modalSubtitle}>Select a city to explore local experiences</Text>
            <ScrollView style={styles.cityList} showsVerticalScrollIndicator={false}>
              {availableCities.map((cityName) => (
                <Pressable
                  key={cityName}
                  style={[styles.cityOption, cityName === city && styles.cityOptionActive]}
                  onPress={() => {
                    selectCity(cityName);
                    setShowCityPicker(false);
                    Alert.alert('City Changed', `Now showing ${cityName}`, [
                      { text: 'OK', onPress: () => router.push('/(tabs)/discover') }
                    ]);
                  }}
                >
                  <FontAwesome 
                    name={cityName === city ? "check-circle" : "circle-o"} 
                    size={20} 
                    color={cityName === city ? "#007AFF" : "#ccc"} 
                  />
                  <Text style={[styles.cityOptionText, cityName === city && styles.cityOptionTextActive]}>
                    {cityName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.modalCancelBtn} onPress={() => setShowCityPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f7',
  },
  header: {
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e7',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarGuest: {
    backgroundColor: '#8E8E93',
  },
  avatarText: { 
    fontSize: 32, 
    fontWeight: '700', 
    color: '#fff',
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 4,
    color: '#000',
  },
  headerSubtitle: { 
    fontSize: 14, 
    color: '#8E8E93',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 16, 
    color: '#000',
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  guestBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  accountEmail: {
    flex: 1,
    fontSize: 15,
    color: '#1E40AF',
    fontWeight: '600',
  },
  tipBox: {
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  tipText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryBtn: {
    backgroundColor: '#007AFF',
  },
  secondaryBtn: {
    backgroundColor: '#8E8E93',
  },
  dangerBtn: {
    backgroundColor: '#FF3B30',
  },
  successBtn: {
    backgroundColor: '#4CAF50',
  },
  contributeBtn: {
    backgroundColor: '#FF9500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
  },
  locationInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  devBtn: {
    backgroundColor: '#6366F1',
  },
  resetBtn: {
    backgroundColor: '#8E8E93',
  },
  actionBtnText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
  },
  preferencesList: {
    marginBottom: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  preferenceLabel: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  preferenceValue: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 4,
  },
  successText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  devInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  devInfoTitle: {
    fontSize: 15,
    color: '#6366F1',
    fontWeight: '600',
    marginBottom: 4,
  },
  devInfoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  link: { 
    flex: 1,
    color: '#007AFF', 
    fontSize: 15, 
    fontWeight: '600',
  },
  muted: { 
    color: '#8E8E93', 
    fontSize: 14,
  },
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end',
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { 
    fontSize: 22, 
    fontWeight: '700', 
    marginBottom: 8, 
    textAlign: 'center',
    color: '#000',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  cityList: {
    maxHeight: 400,
  },
  cityOption: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    gap: 12,
  },
  cityOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  cityOptionText: { 
    flex: 1,
    fontSize: 16, 
    fontWeight: '600',
    color: '#333',
  },
  cityOptionTextActive: {
    color: '#007AFF',
  },
  modalCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    marginTop: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});


