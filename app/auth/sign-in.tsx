import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { signIn, signInWithMagicLink, resetPassword } from '@/lib/auth';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'password' | 'magiclink' | 'reset'>('password');

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Navigate directly to discover - auth state will be updated automatically
      router.replace('/(tabs)/discover');
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Invalid email or password');
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      await signInWithMagicLink(email);
      Alert.alert(
        'Check Your Email',
        'We sent you a sign-in link. Click it to continue.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      Alert.alert(
        'Check Your Email',
        'We sent you a password reset link.',
        [{ text: 'OK', onPress: () => setMode('password') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          {mode === 'reset' ? 'Reset Password' : 'Welcome Back'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'reset' 
            ? 'Enter your email to receive a reset link' 
            : mode === 'magiclink'
            ? 'Sign in with a magic link'
            : 'Sign in to your account'}
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        {mode === 'password' && (
          <>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </>
        )}

        <Pressable
          style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          onPress={mode === 'reset' ? handleResetPassword : mode === 'magiclink' ? handleMagicLink : handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>
              {mode === 'reset' ? 'Send Reset Link' : mode === 'magiclink' ? 'Send Magic Link' : 'Sign In'}
            </Text>
          )}
        </Pressable>

        {mode === 'password' && (
          <>
            <Pressable onPress={() => setMode('magiclink')} style={{ marginTop: 12 }}>
              <Text style={styles.link}>Sign in with magic link instead</Text>
            </Pressable>

            <Pressable onPress={() => setMode('reset')} style={{ marginTop: 8 }}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </>
        )}

        {mode !== 'password' && (
          <Pressable onPress={() => setMode('password')} style={{ marginTop: 12 }}>
            <Text style={styles.link}>Back to password sign in</Text>
          </Pressable>
        )}


        <Pressable onPress={() => router.push('/auth/sign-up')}>
          <Text style={styles.switchText}>
            Don't have an account? <Text style={styles.switchLink}>Sign Up</Text>
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={[styles.link, { color: '#999' }]}>Continue as guest</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  input: { 
    borderWidth: 1, 
    borderColor: '#e1e1e1', 
    borderRadius: 10, 
    paddingHorizontal: 14, 
    paddingVertical: 12,
    fontSize: 15,
  },
  primaryBtn: { 
    marginTop: 24, 
    backgroundColor: '#111', 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: { color: '#007AFF', textAlign: 'center', fontSize: 14 },
  divider: { 
    height: 1, 
    backgroundColor: '#eee', 
    marginVertical: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerText: {
    position: 'absolute',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  socialBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  switchText: { textAlign: 'center', fontSize: 15, color: '#666' },
  switchLink: { color: '#007AFF', fontWeight: '700' },
});

