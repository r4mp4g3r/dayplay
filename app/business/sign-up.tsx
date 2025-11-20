import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { businessSignUp } from '@/lib/businessAuth';

export default function BusinessSignUpScreen() {
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!businessName.trim()) {
      Alert.alert('Error', 'Please enter your business name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Two-step approach: Create user account first, then profile
      const { signUp } = await import('@/lib/auth');
      const result = await signUp(email, password);
      
      if (!result.user) {
        throw new Error('Failed to create account');
      }

      // Store business info temporarily
      const businessInfo = {
        businessName: businessName.trim(),
        phone: phone.trim(),
        website: website.trim(),
      };

      // Auto sign-in happened, now redirect to create profile
      Alert.alert(
        '✅ Account Created!',
        'Now let\'s set up your business profile',
        [{
          text: 'Continue',
          onPress: () => {
            // Navigate to create-profile with pre-filled data
            router.replace({
              pathname: '/business/create-profile',
              params: {
                businessName: businessInfo.businessName,
                email: email.trim(),
                phone: businessInfo.phone,
                website: businessInfo.website,
              }
            });
          }
        }]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Could not create business account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Create Business Account</Text>
        <Text style={styles.subtitle}>Join Swipely to promote your business</Text>

        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="My Restaurant"
          value={businessName}
          onChangeText={setBusinessName}
          editable={!loading}
        />

        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          placeholder="business@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <Text style={styles.label}>Password *</Text>
        <TextInput
          style={styles.input}
          placeholder="At least 6 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="(555) 123-4567"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading}
        />

        <Text style={styles.label}>Website</Text>
        <TextInput
          style={styles.input}
          placeholder="https://mybusiness.com"
          value={website}
          onChangeText={setWebsite}
          autoCapitalize="none"
          keyboardType="url"
          editable={!loading}
        />

        <Pressable
          style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Create Business Account</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/business/sign-in')} style={{ marginTop: 20 }}>
          <Text style={styles.switchText}>
            Already have a business account? <Text style={styles.switchLink}>Sign In</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },
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

