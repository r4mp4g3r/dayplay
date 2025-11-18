import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { createBusinessProfile } from '@/lib/businessProfile';
import { useAuthStore } from '@/state/authStore';

export default function CreateBusinessProfile() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');

  const handleSubmit = async () => {
    // Validation
    if (!businessName.trim()) {
      Alert.alert('Missing Info', 'Please enter your business name');
      return;
    }

    if (!contactEmail.trim()) {
      Alert.alert('Missing Info', 'Please enter a contact email');
      return;
    }

    setLoading(true);

    try {
      const profile = await createBusinessProfile({
        business_name: businessName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || undefined,
        website: website.trim() || undefined,
      });

      setLoading(false);

      Alert.alert(
        '✅ Business Profile Created!',
        'Your business profile has been created. You can now create and manage listings.',
        [
          {
            text: 'Go to Dashboard',
            onPress: () => router.replace('/business/dashboard'),
          },
        ]
      );
    } catch (error: any) {
      setLoading(false);
      console.error('Business profile creation error:', error);
      
      Alert.alert(
        'Error Creating Profile',
        error.message || 'Failed to create business profile. Please make sure:\n\n1. You are signed in\n2. You don\'t already have a business profile\n3. Database migrations are run\n\nPlease try again or contact support.'
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.content}>
        <Text style={styles.title}>Set Up Business Profile 🏢</Text>
        <Text style={styles.subtitle}>
          Tell us about your business to get started with Swipely for Business
        </Text>

        {/* Required Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Information*</Text>

          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., The Coffee Shop"
            value={businessName}
            onChangeText={setBusinessName}
            maxLength={100}
            editable={!loading}
          />

          <Text style={styles.label}>Contact Email</Text>
          <TextInput
            style={styles.input}
            placeholder="business@example.com"
            value={contactEmail}
            onChangeText={setContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Optional Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optional Details</Text>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 123-4567"
            value={contactPhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            editable={!loading}
          />

          <Text style={styles.label}>Website</Text>
          <TextInput
            style={styles.input}
            placeholder="https://yourbusiness.com"
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        {/* Submit Button */}
        <Pressable
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Create Business Profile</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, lineHeight: 22 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  submitBtn: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  submitBtnDisabled: { backgroundColor: '#ccc' },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  backLink: { color: '#007AFF', fontSize: 16, textAlign: 'center', fontWeight: '600' },
});

