import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <Text style={styles.icon}>🎯</Text>
      <Text style={styles.title}>Welcome to Swipely</Text>
      <Text style={styles.subtitle}>
        Swipe into your next plan.{'\n'}
        Discover amazing places nearby.
      </Text>

      <View style={styles.buttonsContainer}>
        {/* Sign Up Button */}
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/auth/sign-up')}
        >
          <Text style={styles.primaryButtonText}>Sign Up</Text>
        </Pressable>

        {/* Sign In Button */}
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/auth/sign-in')}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </Pressable>

        {/* Continue as Guest */}
        <Pressable
          style={styles.skipButton}
          onPress={() => router.replace('/onboarding')}
        >
          <Text style={styles.skipButtonText}>Continue as Guest</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        By continuing, you agree to our Terms of Service and Privacy Policy
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 60,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#111',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111',
  },
  secondaryButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

