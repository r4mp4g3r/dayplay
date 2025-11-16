import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useLocationStore } from '@/state/locationStore';

const CATEGORIES = ['food', 'outdoors', 'nightlife', 'events', 'coffee', 'museum', 'activities', 'shopping'];

export default function SubmitGemScreen() {
  const { latitude, longitude, city } = useLocationStore();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');
  const [address, setAddress] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    
    // In production, this would send to backend
    console.log('Submitting gem:', { title, category, city });
    Alert.alert(
      'Thanks for submitting!', 
      'We\'ll review your suggestion and add it soon.',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Submit a Hidden Gem</Text>
      <Text style={styles.subtitle}>Help others discover amazing spots in {city}!</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Secret Garden Cafe"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Tagline</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Cozy rooftop brunch"
        value={subtitle}
        onChangeText={setSubtitle}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
        placeholder="Tell us what makes this place special..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
          >
            <Text style={[styles.categoryText, category === cat && styles.categoryTextSelected]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Address</Text>
      <TextInput
        style={styles.input}
        placeholder="123 Main St, Austin, TX"
        value={address}
        onChangeText={setAddress}
      />

      <Text style={styles.label}>Website</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        value={website}
        onChangeText={setWebsite}
        autoCapitalize="none"
        keyboardType="url"
      />

      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        placeholder="(512) 555-1234"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Pressable style={styles.submitBtn} onPress={handleSubmit}>
        <Text style={styles.submitText}>Submit for Review</Text>
      </Pressable>

      <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  input: { 
    borderWidth: 1, 
    borderColor: '#e1e1e1', 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 10,
    fontSize: 15,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  categoryChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#f0f0f0' },
  categoryChipSelected: { backgroundColor: '#111' },
  categoryText: { color: '#111', fontWeight: '600', fontSize: 13 },
  categoryTextSelected: { color: '#fff' },
  submitBtn: { 
    marginTop: 24, 
    backgroundColor: '#111', 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  cancelBtn: { 
    marginTop: 12, 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center',
    marginBottom: 40,
  },
  cancelText: { color: '#666', fontWeight: '700', fontSize: 16 },
});

