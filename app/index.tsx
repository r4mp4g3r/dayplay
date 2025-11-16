import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useOnboardingStore } from '@/state/onboardingStore';
import { useAuthStore } from '@/state/authStore';
import { View, ActivityIndicator, Text } from 'react-native';

export default function Index() {
  const { completed } = useOnboardingStore();
  const { loading: authLoading } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for auth to initialize
    if (!authLoading) {
      const timer = setTimeout(() => {
        setReady(true);
        if (completed) {
          router.replace('/(tabs)/discover');
        } else {
          router.replace('/onboarding');
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [completed, authLoading]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 32, marginBottom: 20 }}>🎯</Text>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12, color: '#666' }}>Loading Swipely...</Text>
    </View>
  );
}

