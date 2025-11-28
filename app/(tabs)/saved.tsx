import React, { useState } from 'react';
import { View, FlatList, StyleSheet, Pressable, Share, Text, Alert, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSavedStore } from '@/state/savedStore';
import { SwipeCard } from '@/components/SwipeCard';
import { router } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { openGoogleCalendar } from '@/lib/googleCalendar';

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
  // Calendar picker state
  const [calendarItemId, setCalendarItemId] = useState<string | null>(null);
  const [showIOSDateTime, setShowIOSDateTime] = useState(false);
  const [iosDate, setIOSDate] = useState<Date>(new Date());
  const [showAndroidDate, setShowAndroidDate] = useState(false);
  const [showAndroidTime, setShowAndroidTime] = useState(false);
  const [androidTempDate, setAndroidTempDate] = useState<Date>(new Date());

  console.log('SavedScreen: savedItems count =', savedItems.length);
  console.log('SavedScreen: savedItems =', savedItems);

  const allLists = getAllLists();
  const displayItems = selectedList === 'default' ? savedItems : getListItems(selectedList);

  const getItemById = (id: string) => savedItems.find((s: any) => s.id === id);
  const ensureUrlHasProtocol = (url: string) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };
  const buildDetailsNote = (l: any) => {
    const websiteLine = l.website ? `More info: ${ensureUrlHasProtocol(l.website)}` : '';
    return [l.description || '', websiteLine].filter(Boolean).join('\n\n');
  };
  const openCalendarForItem = async (l: any, start: Date, end: Date) => {
    const location = (l as any).address || l.city || 'Online';
    await openGoogleCalendar({
      title: l.title,
      start,
      end,
      location,
      details: buildDetailsNote(l),
    });
  };
  const startCalendarFlow = (l: any) => {
    if (l.event_start_date && l.event_end_date) {
      openCalendarForItem(l, new Date(l.event_start_date), new Date(l.event_end_date));
      return;
    }
    // Non-event: pick date/time
    setCalendarItemId(l.id);
    if (Platform.OS === 'ios') {
      setIOSDate(new Date());
      setShowIOSDateTime(true);
    } else {
      setAndroidTempDate(new Date());
      setShowAndroidDate(true);
    }
  };
  const onAndroidDateChange = (e: DateTimePickerEvent, date?: Date) => {
    if (e.type === 'dismissed') {
      setShowAndroidDate(false);
      setCalendarItemId(null);
      return;
    }
    if (date) {
      setAndroidTempDate(date);
      setShowAndroidDate(false);
      setShowAndroidTime(true);
    }
  };
  const onAndroidTimeChange = (e: DateTimePickerEvent, date?: Date) => {
    if (e.type === 'dismissed') {
      setShowAndroidTime(false);
      setCalendarItemId(null);
      return;
    }
    if (date && calendarItemId) {
      const base = new Date(androidTempDate);
      base.setHours(date.getHours(), date.getMinutes(), 0, 0);
      const end = new Date(base.getTime() + 60 * 60 * 1000);
      const l = getItemById(calendarItemId);
      setShowAndroidTime(false);
      setCalendarItemId(null);
      if (l) openCalendarForItem(l, base, end);
    }
  };

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
          <View style={{ padding: 12, position: 'relative' }}>
            <Pressable
              onPress={() => router.push(`/listing/${item.id}`)}
              style={{ flex: 1 }}
            >
              <SwipeCard item={item} compact />
              {item.listName && item.listName !== 'default' && (
                <Text style={styles.listTag}>{LIST_DISPLAY_NAMES[item.listName] || item.listName}</Text>
              )}
            </Pressable>
            {/* Remove button - top right */}
            <Pressable
              style={styles.removeBtn}
              onPress={() => {
                Alert.alert(
                  'Remove from saved?',
                  `Remove "${item.title}" from your saved items?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Remove', 
                      style: 'destructive', 
                      onPress: () => unsave(item.id) 
                    },
                  ]
                );
              }}
              accessibilityLabel="Remove from saved"
            >
              <FontAwesome name="times-circle" size={24} color="#FF3B30" />
            </Pressable>
          </View>
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
      {/* iOS datetime picker modal */}
      <Modal
        visible={showIOSDateTime}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowIOSDateTime(false);
          setCalendarItemId(null);
        }}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => {
            setShowIOSDateTime(false);
            setCalendarItemId(null);
          }}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Pick date & time</Text>
            <DateTimePicker
              value={iosDate}
              mode="datetime"
              display="inline"
              onChange={(_, date) => {
                if (date) setIOSDate(date);
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
              <Pressable
                style={[styles.sortBtn, { backgroundColor: '#f2f2f2', flex: 1 }]}
                onPress={() => {
                  setShowIOSDateTime(false);
                  setCalendarItemId(null);
                }}
              >
                <Text style={[styles.sortBtnText, { textAlign: 'center' }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sortBtn, { backgroundColor: '#111', flex: 1 }]}
                onPress={() => {
                  const start = iosDate;
                  const end = new Date(start.getTime() + 60 * 60 * 1000);
                  const l = calendarItemId ? getItemById(calendarItemId) : null;
                  setShowIOSDateTime(false);
                  setCalendarItemId(null);
                  if (l) openCalendarForItem(l, start, end);
                }}
              >
                <Text style={[styles.sortBtnText, { color: '#fff', textAlign: 'center' }]}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {/* Android pickers */}
      {showAndroidDate && (
        <DateTimePicker
          value={androidTempDate}
          mode="date"
          display="calendar"
          onChange={onAndroidDateChange}
        />
      )}
      {showAndroidTime && (
        <DateTimePicker
          value={androidTempDate}
          mode="time"
          display="clock"
          onChange={onAndroidTimeChange}
        />
      )}
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
  removeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 999,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
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
