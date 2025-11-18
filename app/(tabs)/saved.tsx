import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Share, Text, Alert, Modal, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavedStore } from '@/state/savedStore';
import { SwipeCard } from '@/components/SwipeCard';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const PRESET_LISTS = ['default', 'date-ideas', 'weekend-plans', 'favorites'];
const LIST_DISPLAY_NAMES: Record<string, string> = {
  'default': 'All Saved',
  'date-ideas': 'Date Ideas',
  'weekend-plans': 'Weekend Plans',
  'favorites': 'Favorites',
};

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const { savedItems, unsave, moveToList, getListItems, getAllLists } = useSavedStore();
  const [selectedList, setSelectedList] = useState<string>('default');
  const [showListPicker, setShowListPicker] = useState(false);
  const [itemToMove, setItemToMove] = useState<string | null>(null);

  console.log('SavedScreen: savedItems count =', savedItems.length);
  console.log('SavedScreen: savedItems =', savedItems);

  const allLists = getAllLists();
  const displayItems = selectedList === 'default' ? savedItems : getListItems(selectedList);

  const handleMoveToList = (itemId: string) => {
    setItemToMove(itemId);
    setShowListPicker(true);
  };

  const confirmMoveToList = (listName: string) => {
    if (itemToMove) {
      moveToList(itemToMove, listName);
      setShowListPicker(false);
      setItemToMove(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Modern Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved ❤️</Text>
        <Text style={styles.headerSubtitle}>
          {savedItems.length} {savedItems.length === 1 ? 'place' : 'places'} saved
        </Text>
      </View>

      {/* List filter chips - always show when there are saved items */}
      {savedItems.length > 0 && (
        <View style={styles.sortRow}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ gap: 8 }}
          >
            {PRESET_LISTS.map((list) => {
              const count = list === 'default' ? savedItems.length : getListItems(list).length;
              return (
                <Pressable
                  key={list}
                  onPress={() => {
                    console.log('Switching to list:', list);
                    setSelectedList(list);
                  }}
                  style={[styles.sortBtn, selectedList === list && styles.sortBtnActive]}
                >
                  <Text style={[styles.sortBtnText, selectedList === list && styles.sortBtnTextActive]}>
                    {LIST_DISPLAY_NAMES[list]} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/listing/${item.id}`)}
            onLongPress={() => {
              Alert.alert('Options', `Manage "${item.title}"`, [
                { text: 'Remove from saved', style: 'destructive', onPress: () => unsave(item.id) },
                { text: 'Move to list...', onPress: () => handleMoveToList(item.id) },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          >
            <View style={{ padding: 12 }}>
              <SwipeCard item={item} compact />
              {item.listName && item.listName !== 'default' && (
                <Text style={styles.listTag}>{LIST_DISPLAY_NAMES[item.listName] || item.listName}</Text>
              )}
            </View>
          </Pressable>
        )}
        contentContainerStyle={{ padding: 8, paddingBottom: 80 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>❤️</Text>
            <Text style={styles.emptyStateTitle}>No saved items yet</Text>
            <Text style={styles.emptyStateText}>
              Swipe right on places you love to save them here
            </Text>
          </View>
        }
      />

      {savedItems.length > 0 && (
        <Pressable
          style={styles.fab}
          onPress={() => Share.share({ message: savedItems.map((s: any) => `• ${s.title}`).join('\n') })}
          accessibilityLabel="Share saved list"
        >
          <FontAwesome name="share" size={20} color="#fff" />
        </Pressable>
      )}

      {/* List picker modal */}
      <Modal visible={showListPicker} transparent animationType="fade" onRequestClose={() => setShowListPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowListPicker(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Move to list</Text>
            {PRESET_LISTS.map((list) => (
              <Pressable
                key={list}
                style={styles.modalOption}
                onPress={() => confirmMoveToList(list)}
              >
                <Text style={styles.modalOptionText}>{LIST_DISPLAY_NAMES[list] || list}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.modalOption, { marginTop: 8 }]} onPress={() => setShowListPicker(false)}>
              <Text style={[styles.modalOptionText, { color: '#999' }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: '#666' },
  sortRow: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sortBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
  },
  sortBtnActive: { backgroundColor: '#007AFF' },
  sortBtnText: { fontSize: 13, fontWeight: '600', color: '#666' },
  sortBtnTextActive: { color: '#fff' },
  listTag: { fontSize: 11, color: '#666', marginTop: 4, marginLeft: 12, fontWeight: '600' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 80,
  },
  emptyStateIcon: { fontSize: 64, marginBottom: 16 },
  emptyStateTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    backgroundColor: '#007AFF',
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalOptionText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
