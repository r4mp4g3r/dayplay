import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { businessSignIn } from '@/lib/businessAuth';

export default function BusinessSignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      await businessSignIn(email, password);
      router.replace('/business/dashboard');
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Invalid credentials or no business profile found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Business Portal Sign In</Text>
        <Text style={styles.subtitle}>Access your business dashboard</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="business@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <Pressable
          style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Sign In to Dashboard</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/business/sign-up')} style={{ marginTop: 20 }}>
          <Text style={styles.switchText}>
            Don't have a business account? <Text style={styles.switchLink}>Sign Up</Text>
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={[styles.switchText, { color: '#999' }]}>Back to app</Text>
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
  switchText: { textAlign: 'center', fontSize: 15, color: '#666' },
  switchLink: { color: '#007AFF', fontWeight: '700' },
});

