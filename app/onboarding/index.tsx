import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, TextInput, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useFilterStore } from '@/state/filterStore';
import { requestLocation, useLocationStore } from '@/state/locationStore';
import { useOnboardingStore } from '@/state/onboardingStore';
import { signUp, signInWithApple, signInWithGoogle, isAppleAuthAvailable } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const CATEGORY_CHIPS = ['food', 'outdoors', 'nightlife', 'events', 'coffee', 'museum', 'activities', 'shopping'];

export default function OnboardingScreen() {
  const [step, setStep] = useState<'welcome' | 'interests' | 'location' | 'account'>('welcome');
  const [selected, setSelected] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const { setInitialFromOnboarding } = useFilterStore();
  const { loading: locationLoading, granted, city } = useLocationStore();
  const { setCompleted } = useOnboardingStore();

  useEffect(() => {
    isAppleAuthAvailable().then(setAppleAvailable);
  }, []);

  const toggle = (c: string) => {
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const canContinue = selected.length >= 3;

  const handleContinue = async () => {
    if (step === 'welcome') {
      setStep('interests');
    } else if (step === 'interests') {
      setStep('location');
    } else if (step === 'location') {
      // Check if Supabase is configured - if not, skip account creation
      if (isSupabaseConfigured()) {
        setStep('account');
      } else {
        finishOnboarding();
      }
    } else {
      // Should not reach here - account step has its own handlers
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    setInitialFromOnboarding({ categories: selected });
    setCompleted(true);
    router.replace('/(tabs)/discover');
  };

  const handleCreateAccount = async () => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setCreatingAccount(true);
    try {
      await signUp(email, password);
      Alert.alert(
        'Account Created!',
        'Check your email to verify. You can start swiping now!',
        [{ text: 'OK', onPress: finishOnboarding }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not create account');
    } finally {
      setCreatingAccount(false);
    }
  };

  if (step === 'welcome') {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>🎯</Text>
        <Text style={[styles.title, { textAlign: 'center' }]}>Welcome to Swipely</Text>
        <Text style={[styles.subtitle, { textAlign: 'center', paddingHorizontal: 20 }]}>
          Swipe into your next plan.{'\n'}
          Discover amazing places nearby.
        </Text>
        <Pressable
          style={[styles.cta, { marginTop: 40, width: '80%' }]}
          onPress={handleContinue}
        >
          <Text style={styles.ctaText}>Get Started</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'account') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Save your discoveries across devices</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!creatingAccount}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 6 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!creatingAccount}
        />

        <Pressable
          style={[styles.cta, creatingAccount && { opacity: 0.6 }]}
          onPress={handleCreateAccount}
          disabled={creatingAccount}
        >
          {creatingAccount ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Create Account</Text>
          )}
        </Pressable>

        <Pressable 
          onPress={() => {
            Alert.alert('Continue as Guest?', 'You can create an account later from your profile', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue as Guest', onPress: finishOnboarding }
            ]);
          }}
          style={{ marginTop: 16 }}
        >
          <Text style={{ textAlign: 'center', color: '#666', fontSize: 14 }}>
            Skip for now
          </Text>
        </Pressable>

        <View style={{ marginTop: 24, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#eee' }} />
            <Text style={{ marginHorizontal: 12, color: '#999', fontSize: 13, fontWeight: '600' }}>OR</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#eee' }} />
          </View>

          {appleAvailable && (
            <Pressable
              style={[styles.socialBtn, { backgroundColor: '#000' }]}
              onPress={async () => {
                setCreatingAccount(true);
                try {
                  await signInWithApple();
                  finishOnboarding();
                } catch (error: any) {
                  if (!error.message.includes('canceled')) {
                    Alert.alert('Error', error.message);
                  }
                } finally {
                  setCreatingAccount(false);
                }
              }}
              disabled={creatingAccount}
            >
              <FontAwesome name="apple" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ color: '#fff', fontWeight: '700' }}>Continue with Apple</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.socialBtn, { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', marginTop: 8 }]}
            onPress={async () => {
              setCreatingAccount(true);
              try {
                await signInWithGoogle();
                if (Platform.OS !== 'web') {
                  finishOnboarding();
                }
              } catch (error: any) {
                if (Platform.OS !== 'web') {
                  Alert.alert('Error', error.message);
                }
              } finally {
                if (Platform.OS !== 'web') {
                  setCreatingAccount(false);
                }
              }
            }}
            disabled={creatingAccount}
          >
            <FontAwesome name="google" size={20} color="#DB4437" style={{ marginRight: 8 }} />
            <Text style={{ color: '#333', fontWeight: '700' }}>Continue with Google</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/auth/sign-in')} style={{ marginTop: 'auto' }}>
          <Text style={{ textAlign: 'center', color: '#007AFF', fontSize: 14 }}>
            Already have an account? Sign In
          </Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'location') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Enable location</Text>
        <Text style={styles.subtitle}>We'll show you great spots nearby</Text>
        
        {locationLoading ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 16, color: '#666' }}>Getting your location...</Text>
          </View>
        ) : granted ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 48 }}>✓</Text>
            <Text style={{ marginTop: 16, fontWeight: '700' }}>Location enabled</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>Discovering in {city}</Text>
          </View>
        ) : (
          <View style={{ marginTop: 40 }}>
            <Text style={{ textAlign: 'center', color: '#666', marginBottom: 20 }}>
              Tap below to allow location access
            </Text>
            <Pressable style={styles.cta} onPress={requestLocation}>
              <Text style={styles.ctaText}>Enable Location</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          style={[styles.cta, { backgroundColor: granted ? '#111' : '#666', marginTop: 'auto' }]}
          onPress={handleContinue}
        >
          <Text style={styles.ctaText}>{granted ? 'Start Swiping' : 'Skip for now'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find something to do in seconds</Text>
      <Text style={styles.subtitle}>Choose a few interests to get started</Text>
      <ScrollView contentContainerStyle={styles.chips} showsVerticalScrollIndicator={false}>
        {CATEGORY_CHIPS.map((c) => (
          <Pressable
            key={c}
            onPress={() => toggle(c)}
            style={[styles.chip, selected.includes(c) && styles.chipSelected]}
            accessibilityLabel={`Select ${c}`}
          >
            <Text style={[styles.chipText, selected.includes(c) && styles.chipTextSelected]}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.cta, !canContinue && { opacity: 0.4 }]}
        disabled={!canContinue}
        onPress={handleContinue}
        accessibilityLabel="Continue to Location"
      >
        <Text style={styles.ctaText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  input: { 
    borderWidth: 1, 
    borderColor: '#e1e1e1', 
    borderRadius: 10, 
    paddingHorizontal: 14, 
    paddingVertical: 12,
    fontSize: 15,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#f0f0f0' },
  chipSelected: { backgroundColor: '#111' },
  chipText: { color: '#111', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  cta: { marginTop: 'auto', backgroundColor: '#111', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
});


