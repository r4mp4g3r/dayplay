import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useFilterStore } from '@/state/filterStore';
import { requestLocation, useLocationStore } from '@/state/locationStore';
import { useOnboardingStore } from '@/state/onboardingStore';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const CATEGORY_CHIPS = [
  'food', 'outdoors', 'nightlife', 'events', 'coffee', 'museum', 'activities', 'shopping',
  'arts-culture', 'live-music', 'games-entertainment', 'relax-recharge', 'sports-recreation',
  'drinks-bars', 'pet-friendly', 'road-trip-getaways', 'festivals-pop-ups', 'fitness-classes'
];

export default function OnboardingScreen() {
  const [step, setStep] = useState<'welcome' | 'interests' | 'location'>('welcome');
  const [selected, setSelected] = useState<string[]>([]);
  const { setInitialFromOnboarding } = useFilterStore();
  const { loading: locationLoading, granted, city } = useLocationStore();
  const { setCompleted } = useOnboardingStore();

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
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    setInitialFromOnboarding({ categories: selected });
    setCompleted(true);
    // If user is signed in, go to discover. Otherwise they'll see welcome screen
    router.replace('/(tabs)/discover');
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
      <Text style={styles.finePrint}>Please select at least 3 categories to continue</Text>
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
  subtitle: { fontSize: 16, color: '#666', marginBottom: 8 },
  finePrint: { fontSize: 12, color: '#999', marginBottom: 24, fontStyle: 'italic' },
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


