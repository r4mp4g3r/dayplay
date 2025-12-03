import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { useFilterStore } from '@/state/filterStore';

const CATEGORY_CHIPS = [
  { id: 'food', label: 'Food', description: 'Restaurants, cafes, and dining' },
  { id: 'outdoors', label: 'Outdoors', description: 'Parks, trails, and nature' },
  { id: 'nightlife', label: 'Nightlife', description: 'Bars, clubs, and evening spots' },
  { id: 'events', label: 'Events', description: 'Concerts, festivals, and happenings' },
  { id: 'coffee', label: 'Coffee', description: 'Coffee shops and cafes' },
  { id: 'museum', label: 'Museum', description: 'Museums and galleries' },
  { id: 'activities', label: 'Activities', description: 'Things to do and experiences' },
  { id: 'shopping', label: 'Shopping', description: 'Stores, markets, and boutiques' },
  { id: 'arts-culture', label: 'Arts & Culture', description: 'Galleries, exhibits, creative shows' },
  { id: 'live-music', label: 'Live Music', description: 'Concerts, open mics, performance venues' },
  { id: 'games-entertainment', label: 'Games & Entertainment', description: 'Arcades, bowling, VR lounges, fun centers' },
  { id: 'relax-recharge', label: 'Relax & Recharge', description: 'Spas, saunas, wellness spots' },
  { id: 'sports-recreation', label: 'Sports & Recreation', description: 'Gyms, outdoor courts, pickup sports' },
  { id: 'drinks-bars', label: 'Drinks & Bars', description: 'Cocktail lounges, breweries, wine bars' },
  { id: 'pet-friendly', label: 'Pet-Friendly', description: 'Spots that allow pets' },
  { id: 'road-trip-getaways', label: 'Road Trip Getaways', description: '30–90 minute destinations' },
  { id: 'festivals-pop-ups', label: 'Festivals & Pop-Ups', description: 'Markets, fairs, temporary events' },
  { id: 'fitness-classes', label: 'Fitness & Classes', description: 'Yoga, pilates, group workouts' },
];

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { categories, setCategories, distanceKm, setDistanceKm, priceTiers, setPriceTiers, showOpenNow, setShowOpenNow, showNewThisWeek, setShowNewThisWeek } = useFilterStore();

  const toggleCategory = (c: string) => {
    const next = categories.includes(c) ? categories.filter((x) => x !== c) : [...categories, c];
    setCategories(next);
  };

  const togglePrice = (p: number) => {
    const next = priceTiers.includes(p) ? priceTiers.filter((x) => x !== p) : [...priceTiers, p];
    setPriceTiers(next.sort());
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView>
            <View style={styles.content}>
              <View style={styles.header}>
                <Text style={styles.title}>Filters</Text>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Distance: {distanceKm} km</Text>
              <Slider
                minimumValue={1}
                maximumValue={150}
                step={1}
                value={distanceKm}
                onValueChange={(v) => setDistanceKm(Array.isArray(v) ? v[0] : v)}
                style={{ height: 40 }}
              />

              <Text style={styles.label}>Categories</Text>
              <View style={styles.categoriesContainer}>
                {CATEGORY_CHIPS.map((cat) => {
                  const isSelected = categories.includes(cat.id);
                  return (
                    <Pressable 
                      key={cat.id} 
                      style={[styles.categoryCard, isSelected && styles.categoryCardSelected]} 
                      onPress={() => toggleCategory(cat.id)}
                    >
                      <Text style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}>
                        {cat.label}
                      </Text>
                      <Text style={[styles.categoryDescription, isSelected && styles.categoryDescriptionSelected]}>
                        {cat.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Price</Text>
              <View style={styles.rowWrap}>
                {[1, 2, 3, 4].map((p) => (
                  <Pressable key={p} style={[styles.chip, priceTiers.includes(p) && styles.chipSelected]} onPress={() => togglePrice(p)}>
              <Text style={[styles.chipText, priceTiers.includes(p) && styles.chipTextSelected]}> {'$'.repeat(p)} </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Special Filters</Text>
        <View style={styles.rowWrap}>
          <Pressable 
            style={[styles.chip, showNewThisWeek && styles.chipSelected]} 
            onPress={() => setShowNewThisWeek(!showNewThisWeek)}
          >
            <Text style={[styles.chipText, showNewThisWeek && styles.chipTextSelected]}>✨ New This Week</Text>
          </Pressable>
          <Pressable 
            style={[styles.chip, showOpenNow && styles.chipSelected]} 
            onPress={() => setShowOpenNow(!showOpenNow)}
          >
            <Text style={[styles.chipText, showOpenNow && styles.chipTextSelected]}>⏰ Open Now</Text>
          </Pressable>
        </View>

        <Pressable style={styles.doneBtn} onPress={onClose}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  content: { padding: 16, gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 8 },
  closeText: { fontSize: 28, color: '#666', lineHeight: 28 },
  label: { fontWeight: '700', marginTop: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#f0f0f0' },
  chipSelected: { backgroundColor: '#111' },
  chipText: { color: '#111', fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  categoriesContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10, 
    marginTop: 4 
  },
  categoryCard: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryCardSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  categoryLabelSelected: {
    color: '#fff',
  },
  categoryDescription: {
    fontSize: 11,
    color: '#666',
    lineHeight: 14,
  },
  categoryDescriptionSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  doneBtn: { marginTop: 16, backgroundColor: '#111', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  doneText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
