import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createLocalFavorite } from '@/lib/localsFavoritesApi';
import { geocodeAddress, geocodeAddressFallback } from '@/lib/geocoding';
import type { Category, Vibe } from '@/types/domain';

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'food', label: '🍽️ Food' },
  { value: 'coffee', label: '☕ Coffee' },
  { value: 'nightlife', label: '🍹 Nightlife' },
  { value: 'outdoors', label: '🌳 Outdoors' },
  { value: 'museum', label: '🎨 Museum' },
  { value: 'activities', label: '🎯 Activities' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'events', label: '🎉 Events' },
  { value: 'neighborhood', label: '🏘️ Neighborhood' },
];

const PRICE_TIERS = [
  { value: 1, label: '$', description: 'Budget-friendly' },
  { value: 2, label: '$$', description: 'Moderate' },
  { value: 3, label: '$$$', description: 'Pricey' },
  { value: 4, label: '$$$$', description: 'Splurge' },
];

const VIBES: { value: Vibe; label: string }[] = [
  { value: 'romantic', label: '💕 Romantic' },
  { value: 'chill', label: '😌 Chill' },
  { value: 'fun', label: '🎉 Fun' },
  { value: 'adventurous', label: '🚀 Adventurous' },
  { value: 'family-friendly', label: '👨‍👩‍👧‍👦 Family-Friendly' },
  { value: 'trendy', label: '✨ Trendy' },
  { value: 'hidden-gem', label: '💎 Hidden Gem' },
];

export default function AddLocalFavorite() {
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  
  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('food');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [hours, setHours] = useState('');
  const [priceTier, setPriceTier] = useState<number | undefined>(undefined);
  const [website, setWebsite] = useState('');
  const [selectedVibes, setSelectedVibes] = useState<Vibe[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  const toggleVibe = (vibe: Vibe) => {
    setSelectedVibes((prev) =>
      prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]
    );
  };

  const handleGeocodeAddress = async () => {
    if (!address.trim() && !postalCode.trim()) {
      Alert.alert('Missing Info', 'Please enter an address or postal code');
      return;
    }

    const searchQuery = postalCode.trim() || address.trim();
    
    setGeocoding(true);

    try {
      // Try Google Geocoding API first
      let result = await geocodeAddress(searchQuery);
      
      // Fallback to free service if Google API not configured
      if (!result) {
        result = await geocodeAddressFallback(searchQuery);
      }

      if (result) {
        setLatitude(result.latitude);
        setLongitude(result.longitude);
        if (result.formattedAddress) {
          setAddress(result.formattedAddress);
        }
        if (result.city && !city.trim()) {
          setCity(result.city);
        }
        Alert.alert(
          'Location Found! ✅',
          `${result.formattedAddress}\n\nCoordinates: ${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`
        );
      } else {
        Alert.alert(
          'Location Not Found',
          'Could not find coordinates for this address. Please try:\n• Adding more details (city, state)\n• Using a different format\n• Checking the spelling'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to look up location. Please try again.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Please enter a name for this spot');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Missing Info', 'Please enter an address');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Missing Info', 'Please add a short description');
      return;
    }

    if (description.length > 200) {
      Alert.alert('Description too long', 'Please keep your description under 200 characters');
      return;
    }

    // Validate coordinates
    if (latitude === null || longitude === null) {
      Alert.alert(
        'Location Not Verified',
        'Please tap "Find Location" to verify the address and get coordinates.'
      );
      return;
    }

    setLoading(true);

    try {
      const result = await createLocalFavorite({
        name: name.trim(),
        category,
        description: description.trim(),
        latitude,
        longitude,
        address: address.trim(),
        city: city.trim() || undefined,
        photo_url: photoUrl.trim() || undefined,
        hours: hours.trim() || undefined,
        price_tier: priceTier,
        website: website.trim() || undefined,
        vibes: selectedVibes.length > 0 ? selectedVibes : undefined,
      });

      setLoading(false);

      if (result) {
        Alert.alert(
          'Submitted! 🎉',
          'Your hidden gem has been submitted for review. We\'ll notify you once it\'s approved!',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to submit. Please try again.');
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} contentInsetAdjustmentBehavior="automatic">
      {/* Unified header to match other tabs */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <Pressable style={styles.titleBack} onPress={() => router.back()} accessibilityLabel="Go back">
            <FontAwesome name="chevron-left" size={20} color="#007AFF" />
          </Pressable>
          <Text style={styles.title}>Share a Hidden Gem 💎</Text>
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Help others discover your favorite local spots that might not be well-known!
        </Text>

        {/* Required Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info*</Text>

          <Text style={styles.label}>Name of the Spot</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., The Coffee Underground"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.value}
                style={[
                  styles.categoryChip,
                  category === cat.value && styles.categoryChipActive,
                ]}
                onPress={() => setCategory(cat.value)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    category === cat.value && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Why is this a hidden gem?</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Share what makes this place special (max 200 chars)"
            value={description}
            onChangeText={setDescription}
            maxLength={200}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.charCount}>{description.length}/200</Text>

          <Text style={styles.label}>Street Address</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 123 Main St"
            value={address}
            onChangeText={setAddress}
          />

          <Text style={styles.label}>Postal Code / ZIP Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 80202 or 10001"
            value={postalCode}
            onChangeText={setPostalCode}
            keyboardType="default"
            autoCapitalize="characters"
          />

          {/* Find Location Button */}
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

          <Text style={styles.helper}>
            💡 Enter address and postal code, then tap "Find Location" to verify
          </Text>
        </View>

        {/* Optional Fields */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optional Details</Text>

          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="Denver"
            value={city}
            onChangeText={setCity}
          />

          <Text style={styles.label}>Photo URL (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            value={photoUrl}
            onChangeText={setPhotoUrl}
            keyboardType="url"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Hours</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Mon-Fri 8am-6pm"
            value={hours}
            onChangeText={setHours}
          />

          <Text style={styles.label}>Price Range</Text>
          <View style={styles.priceGrid}>
            {PRICE_TIERS.map((tier) => (
              <Pressable
                key={tier.value}
                style={[
                  styles.priceChip,
                  priceTier === tier.value && styles.priceChipActive,
                ]}
                onPress={() => setPriceTier(tier.value === priceTier ? undefined : tier.value)}
              >
                <Text
                  style={[
                    styles.priceChipLabel,
                    priceTier === tier.value && styles.priceChipLabelActive,
                  ]}
                >
                  {tier.label}
                </Text>
                <Text style={styles.priceChipDesc}>{tier.description}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Website</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            value={website}
            onChangeText={setWebsite}
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* Vibes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vibe (select all that apply)</Text>
          <View style={styles.vibesGrid}>
            {VIBES.map((vibe) => (
              <Pressable
                key={vibe.value}
                style={[
                  styles.vibeChip,
                  selectedVibes.includes(vibe.value) && styles.vibeChipActive,
                ]}
                onPress={() => toggleVibe(vibe.value)}
              >
                <Text
                  style={[
                    styles.vibeChipText,
                    selectedVibes.includes(vibe.value) && styles.vibeChipTextActive,
                  ]}
                >
                  {vibe.label}
                </Text>
              </Pressable>
            ))}
          </View>
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
            <Text style={styles.submitBtnText}>Submit for Review</Text>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          * Your submission will be reviewed before appearing in the app. We'll notify you once
          it's approved!
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topHeader: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 60 },
  headerBackText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  titleBack: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24, lineHeight: 22 },
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
  textArea: { height: 80, textAlignVertical: 'top' },
  charCount: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'right' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  helper: { fontSize: 12, color: '#666', marginTop: 6, fontStyle: 'italic' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  categoryChipActive: { borderColor: '#007AFF', backgroundColor: '#007AFF' },
  categoryChipText: { fontSize: 14, fontWeight: '600', color: '#666' },
  categoryChipTextActive: { color: '#fff' },
  priceGrid: { flexDirection: 'row', gap: 12 },
  priceChip: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  priceChipActive: { borderColor: '#007AFF', backgroundColor: '#007AFF' },
  priceChipLabel: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 4 },
  priceChipLabelActive: { color: '#fff' },
  priceChipDesc: { fontSize: 11, color: '#999' },
  vibesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  vibeChipActive: { borderColor: '#FF6B6B', backgroundColor: '#FF6B6B' },
  vibeChipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  vibeChipTextActive: { color: '#fff' },
  submitBtn: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: '#ccc' },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  disclaimer: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  findLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  findLocationBtnDisabled: {
    backgroundColor: '#ccc',
  },
  findLocationIcon: {
    fontSize: 20,
  },
  findLocationText: {
    color: '#fff',
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  coordinatesText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});

