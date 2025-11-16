import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Share, Text, Alert, Modal, TextInput, ScrollView } from 'react-native';
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
    <View style={styles.container}>
      {/* List filter chips - always show when there are saved items */}
      {savedItems.length > 0 && (
        <View style={{ backgroundColor: '#fff', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: '800' }}>
              Saved ({savedItems.length})
            </Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.listChips}
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
                  style={[styles.listChip, selectedList === list && styles.listChipSelected]}
                >
                  <Text style={[styles.listChipText, selectedList === list && styles.listChipTextSelected]}>
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
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#999' }}>No saved items yet</Text>
            <Text style={{ fontSize: 14, color: '#ccc', marginTop: 4 }}>Swipe right to save</Text>
          </View>
        }
      />

      {savedItems.length > 0 && (
        <Pressable
          style={styles.fab}
          onPress={() => Share.share({ message: savedItems.map((s) => `• ${s.title}`).join('\n') })}
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
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  listChips: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, flexDirection: 'row' },
  listChip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#e9e9e9', borderWidth: 2, borderColor: 'transparent' },
  listChipSelected: { backgroundColor: '#111', borderColor: '#111' },
  listChipText: { fontWeight: '700', color: '#111', fontSize: 13 },
  listChipTextSelected: { color: '#fff' },
  listTag: { fontSize: 11, color: '#666', marginTop: 4, marginLeft: 12, fontWeight: '600' },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#111', width: 56, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalOptionText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
