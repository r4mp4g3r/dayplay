import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '@/state/onboardingStore';
import { useAuthStore } from '@/state/authStore';
import { View, ActivityIndicator, Text } from 'react-native';

export default function Index() {
  const { completed } = useOnboardingStore();
  const { user, loading: authLoading } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for auth to initialize
    if (!authLoading) {
      const timer = setTimeout(() => {
        setReady(true);
        
        // Priority 1: Authenticated user → Discover
        if (user) {
          router.replace('/(tabs)/discover');
        }
        // Priority 2: Guest who completed onboarding → Discover
        else if (completed) {
          router.replace('/(tabs)/discover');
        }
        // Priority 3: New user → Welcome screen
        else {
          router.replace('/welcome');
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [user, completed, authLoading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 32, marginBottom: 20 }}>🎯</Text>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12, color: '#666' }}>Loading Swipely...</Text>
    </View>
  );
}


