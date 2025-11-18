import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { submitListingForApproval } from '@/lib/businessAuth';
import { geocodeAddress, geocodeAddressFallback } from '@/lib/geocoding';
import { AVAILABLE_CITIES } from '@/data/multi-city-seed';

const CATEGORIES = ['food', 'outdoors', 'nightlife', 'events', 'coffee', 'museum', 'activities', 'shopping'];

export default function CreateListingScreen() {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');
  const [city, setCity] = useState('Austin');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [priceTier, setPriceTier] = useState(2);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const handleGeocodeAddress = async () => {
    if (!address.trim() && !postalCode.trim()) {
      Alert.alert('Missing Info', 'Please enter an address or postal code');
      return;
    }

    const searchQuery = `${address.trim()}, ${postalCode.trim()}, ${city}`.trim();
    
    setGeocoding(true);

    try {
      let result = await geocodeAddress(searchQuery);
      
      if (!result) {
        result = await geocodeAddressFallback(searchQuery);
      }

      if (result) {
        setLatitude(result.latitude);
        setLongitude(result.longitude);
        if (result.formattedAddress) {
          setAddress(result.formattedAddress);
        }
        Alert.alert(
          'Location Found! ✅',
          `${result.formattedAddress}\n\nCoordinates: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`
        );
      } else {
        Alert.alert(
          'Location Not Found',
          'Could not find coordinates for this address. Please verify the address and try again.'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to look up location. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (latitude === null || longitude === null) {
      Alert.alert(
        'Location Not Verified',
        'Please tap "Find Location" to verify the address and get coordinates.'
      );
      return;
    }

    setLoading(true);
    try {
      await submitListingForApproval({
        title,
        subtitle,
        description,
        category,
        city,
        latitude,
        longitude,
        hours,
        phone,
        website,
        price_tier: priceTier,
      });

      Alert.alert(
        'Submitted for Review!',
        'Your listing will be reviewed and published within 24-48 hours.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Submission Failed', error.message || 'Could not submit listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>Submit New Listing</Text>
      <Text style={styles.subtitle}>Your listing will be reviewed before going live</Text>

      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} placeholder="My Restaurant" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Tagline</Text>
      <TextInput style={styles.input} placeholder="Best tacos in town" value={subtitle} onChangeText={setSubtitle} />

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        placeholder="Tell people why they should visit..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
      />

      <Text style={styles.label}>Category *</Text>
      <View style={styles.chipGrid}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.chip, category === cat && styles.chipSelected]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>{cat}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>City *</Text>
      <View style={styles.chipGrid}>
        {AVAILABLE_CITIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.chip, city === c && styles.chipSelected]}
            onPress={() => setCity(c)}
          >
            <Text style={[styles.chipText, city === c && styles.chipTextSelected]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Street Address *</Text>
      <TextInput style={styles.input} placeholder="123 Main St" value={address} onChangeText={setAddress} />

      <Text style={styles.label}>Postal/ZIP Code</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 78701 or 10001"
        value={postalCode}
        onChangeText={setPostalCode}
        keyboardType="default"
        autoCapitalize="characters"
      />

      <Pressable
        style={[styles.findLocationBtn, geocoding && styles.findLocationBtnDisabled]}
        onPress={handleGeocodeAddress}
        disabled={geocoding}
      >
        {geocoding ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.findLocationIcon}>📍</Text>
            <Text style={styles.findLocationText}>Find Location</Text>
          </>
        )}
      </Pressable>

      {latitude !== null && longitude !== null && (
        <View style={styles.coordinatesDisplay}>
          <Text style={styles.coordinatesLabel}>✅ Location verified</Text>
          <Text style={styles.coordinatesText}>
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Text>
        </View>
      )}

      <Text style={styles.label}>Hours</Text>
      <TextInput style={styles.input} placeholder="9:00 AM - 10:00 PM" value={hours} onChangeText={setHours} />

      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        placeholder="(555) 123-4567"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Website</Text>
      <TextInput
        style={styles.input}
        placeholder="https://..."
        value={website}
        onChangeText={setWebsite}
        autoCapitalize="none"
      />

      <Text style={styles.label}>Price Range *</Text>
      <View style={styles.chipGrid}>
        {[1, 2, 3, 4].map((tier) => (
          <Pressable
            key={tier}
            style={[styles.chip, priceTier === tier && styles.chipSelected]}
            onPress={() => setPriceTier(tier)}
          >
            <Text style={[styles.chipText, priceTier === tier && styles.chipTextSelected]}>
              {'$'.repeat(tier)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.submitBtn, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Submit for Review</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
        <Text style={{ textAlign: 'center', color: '#999' }}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#f0f0f0' },
  chipSelected: { backgroundColor: '#111' },
  chipText: { color: '#111', fontWeight: '600', fontSize: 13 },
  chipTextSelected: { color: '#fff' },
  submitBtn: { 
    marginTop: 24, 
    backgroundColor: '#111', 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center' 
  },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  findLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  findLocationBtnDisabled: {
    backgroundColor: '#ccc',
  },
  findLocationIcon: {
    fontSize: 18,
  },
  findLocationText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  coordinatesDisplay: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  coordinatesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  coordinatesText: {
    fontSize: 11,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

