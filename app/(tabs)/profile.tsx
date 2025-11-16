import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ScrollView, Modal } from 'react-native';
import { useFilterStore } from '@/state/filterStore';
import { useSavedStore } from '@/state/savedStore';
import { useOnboardingStore } from '@/state/onboardingStore';
import { useAuthStore } from '@/state/authStore';
import { useLocationStore, selectCity } from '@/state/locationStore';
import { signOut } from '@/lib/auth';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { categories, distanceKm, priceTiers, setCategories, setPriceTiers, setDistanceKm, showNewThisWeek, showOpenNow, setShowNewThisWeek, setShowOpenNow } = useFilterStore();
  const { savedItems, clear } = useSavedStore();
  const { setCompleted } = useOnboardingStore();
  const { user, isGuest, loading: authLoading } = useAuthStore();
  const { city, availableCities } = useLocationStore();
  const savedCount = savedItems.length;
  const [showCityPicker, setShowCityPicker] = useState(false);
  
  const resetFilters = () => {
    setCategories(['food', 'outdoors', 'events']);
    setPriceTiers([1, 2, 3, 4]);
    setDistanceKm(15);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ padding: 16 }}>
        <Text style={styles.title}>Profile</Text>
        
        {authLoading ? (
          <Text style={styles.muted}>Loading...</Text>
        ) : isGuest ? (
          <View>
            <Text style={styles.muted}>You are browsing as a guest</Text>
            <Pressable style={[styles.primary, { marginTop: 12 }]} onPress={() => router.push('/auth/sign-up')}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Create Account</Text>
            </Pressable>
            <Pressable style={[styles.primary, { backgroundColor: '#666', marginTop: 8 }]} onPress={() => router.push('/auth/sign-in')}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Sign In</Text>
            </Pressable>
            {savedCount > 0 && (
              <Text style={{ fontSize: 12, color: '#999', marginTop: 8, textAlign: 'center' }}>
                💡 Sign up to sync {savedCount} saved item{savedCount !== 1 ? 's' : ''} across devices
              </Text>
            )}
          </View>
        ) : (
          <View>
            <Text style={styles.infoText}>📧 {user?.email}</Text>
            <Pressable style={[styles.primary, { backgroundColor: '#dc3545', marginTop: 12 }]} onPress={handleSignOut}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Sign Out</Text>
            </Pressable>
          </View>
        )}

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontWeight: '800', marginBottom: 8 }}>City</Text>
        <Pressable
          style={[styles.primary, { backgroundColor: '#4CAF50' }]}
          onPress={() => setShowCityPicker(true)}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>📍 {city} - Change City</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontWeight: '800', marginBottom: 8 }}>Current Filters</Text>
        <Text style={styles.infoText}>Categories: {categories.length > 0 ? categories.join(', ') : 'All'}</Text>
        <Text style={styles.infoText}>Distance: {distanceKm} km</Text>
        <Text style={styles.infoText}>Saved items: {savedCount}</Text>
        {showNewThisWeek && <Text style={[styles.infoText, { color: '#ff9800' }]}>⚠️ "New This Week" filter is ON</Text>}
        {showOpenNow && <Text style={[styles.infoText, { color: '#ff9800' }]}>⚠️ "Open Now" filter is ON</Text>}
        <Pressable style={[styles.primary, { backgroundColor: '#666', marginTop: 8 }]} onPress={resetFilters}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>Reset All Filters</Text>
        </Pressable>
        {savedCount > 0 && (
          <Pressable style={[styles.primary, { backgroundColor: '#dc3545', marginTop: 8 }]} onPress={clearSaved}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Clear Saved Items</Text>
          </Pressable>
        )}
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontWeight: '800', marginBottom: 8 }}>Contribute</Text>
        <Pressable 
          style={[styles.primary, { backgroundColor: '#4CAF50' }]} 
          onPress={() => router.push('/submit-gem')}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Submit a Hidden Gem</Text>
        </Pressable>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontWeight: '800', marginBottom: 8 }}>For Businesses</Text>
        <Pressable 
          style={[styles.primary, { backgroundColor: '#6366F1' }]} 
          onPress={() => router.push('/business')}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>🏢 Business Portal</Text>
        </Pressable>
        <Text style={{ fontSize: 12, color: '#999', marginTop: 8, textAlign: 'center' }}>
          Promote your business and track analytics
        </Text>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontWeight: '800', marginBottom: 8 }}>Legal</Text>
        <Text style={styles.link}>Terms of Service</Text>
        <Text style={styles.link}>Privacy Policy</Text>
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={{ fontWeight: '800', marginBottom: 8 }}>Development</Text>
        <Pressable 
          style={[styles.primary, { backgroundColor: '#6c757d' }]} 
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
                    setCategories(['food', 'outdoors', 'events']);
                    setPriceTiers([1, 2, 3, 4]);
                    setDistanceKm(15);
                    setCompleted(false);
                    router.replace('/onboarding');
                  }
                }
              ]
            );
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Restart Onboarding</Text>
        </Pressable>
      </View>
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
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  muted: { color: '#666', fontSize: 14 },
  infoText: { color: '#333', marginTop: 4, fontSize: 14 },
  primary: { marginTop: 10, backgroundColor: '#111', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  link: { color: '#111', textDecorationLine: 'underline', marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  cityOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  cityOptionText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
});


