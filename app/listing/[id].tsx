import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Linking, Modal, Alert, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getListing } from '@/lib/api';
import type { Listing } from '@/types/domain';
import { ListingCarousel } from '@/components/ListingCarousel';
import { ListingMap } from '@/components/ListingMap';
import { useSavedStore } from '@/state/savedStore';
import { capture } from '@/lib/analytics';
import { trackBusinessAnalytics } from '@/lib/businessAuth';
import { formatEventDateRange, isEventInProgress, getTimeUntilEvent } from '@/lib/dateUtils';
import { openGoogleCalendar } from '@/lib/googleCalendar';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const LIST_OPTIONS = [
  { key: 'default', label: 'General' },
  { key: 'date-ideas', label: 'Date Ideas' },
  { key: 'weekend-plans', label: 'Weekend Plans' },
  { key: 'favorites', label: 'Favorites' },
];

export default function ListingDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Listing | undefined>();
  const { isSaved, save, unsave } = useSavedStore();
  const [showListPicker, setShowListPicker] = useState(false);
  // Date/time picker state
  const [showIOSDateTime, setShowIOSDateTime] = useState(false);
  const [iosDate, setIOSDate] = useState<Date>(new Date());
  const [showAndroidDate, setShowAndroidDate] = useState(false);
  const [showAndroidTime, setShowAndroidTime] = useState(false);
  const [androidTempDate, setAndroidTempDate] = useState<Date>(new Date());

  useEffect(() => {
    (async () => setItem(id ? await getListing(id) : undefined))();
  }, [id]);

  useEffect(() => {
    if (id) capture('open_details', { id });
  }, [id]);

  if (!item) return <View style={styles.center}><Text>Loading…</Text></View>;

  const saved = isSaved(item.id);
  const isEvent = !!item.event_start_date;
  const eventInProgress = isEvent && item.event_start_date && item.event_end_date 
    ? isEventInProgress(item.event_start_date, item.event_end_date) 
    : false;

  const ensureUrlHasProtocol = (url: string) => {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  };

  const getWebsiteDomain = (url?: string) => {
    if (!url) return undefined;
    try {
      const withProto = ensureUrlHasProtocol(url);
      const u = new URL(withProto);
      return u.host.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  };

  const buildDetailsNote = (l: Listing) => {
    const websiteLine = l.website ? `More info: ${ensureUrlHasProtocol(l.website)}` : '';
    return [l.description || '', websiteLine].filter(Boolean).join('\n\n');
  };

  const openCalendarForRange = async (start: Date, end: Date) => {
    if (!item) return;
    const location = (item as any).address || item.city || 'Online';
    await openGoogleCalendar({
      title: item.title,
      start,
      end,
      location,
      details: buildDetailsNote(item),
    });
  };

  const handleAddCalendar = () => {
    if (!item) return;
    if (isEvent && item.event_start_date && item.event_end_date) {
      const start = new Date(item.event_start_date);
      const end = new Date(item.event_end_date);
      openCalendarForRange(start, end);
      return;
    }
    // Non-event: ask for start datetime, end = +1h
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
      return;
    }
    if (date) {
      // Combine selected time with previously chosen date
      const merged = new Date(androidTempDate);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      const end = new Date(merged.getTime() + 60 * 60 * 1000);
      setShowAndroidTime(false);
      openCalendarForRange(merged, end);
    }
  };

  // Debug logging
  console.log('Listing details:', {
    id: item.id,
    title: item.title,
    isEvent,
    hasWebsite: !!item.website,
    website: item.website,
    hasHours: !!item.hours,
    hasPhone: !!item.phone,
  });

  return (
    <ScrollView style={styles.container} contentInsetAdjustmentBehavior="automatic">
      <ListingCarousel images={item.images ?? []} isEvent={isEvent} />
      <View style={styles.content}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.subtitle && <Text style={styles.subtitle}>{item.subtitle}</Text>}
            <Text style={styles.meta}>{item.category} · {item.city}</Text>
          </View>
          {item.is_featured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
        </View>

        {/* Event Date/Time Section */}
        {isEvent && item.event_start_date && item.event_end_date && (
          <View style={styles.eventDateSection}>
            <View style={styles.eventDateRow}>
              <Text style={styles.eventDateIcon}>📅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventDateText}>
                  {formatEventDateRange(item.event_start_date, item.event_end_date)}
                </Text>
                {eventInProgress && (
                  <Text style={styles.eventStatusText}>🎉 Happening now!</Text>
                )}
                {!eventInProgress && (
                  <Text style={styles.eventTimeUntil}>
                    {getTimeUntilEvent(item.event_start_date)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {item.price_tier && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Price: </Text>
            <Text style={styles.priceValue}>{'$'.repeat(item.price_tier)}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Pressable
            style={[styles.saveBtn, saved ? styles.saveBtnSaved : null]}
            onPress={() => {
              if (saved) {
                unsave(item.id);
              } else {
                setShowListPicker(true);
              }
            }}
          >
            <Text style={[styles.saveText, saved ? { color: '#fff' } : null]}>{saved ? 'Saved' : 'Save to list'}</Text>
          </Pressable>
          
          {/* Add to Google Calendar button (events use event dates; places prompt for date/time) */}
          <Pressable
            style={styles.calendarBtn}
            onPress={() => {
              console.log('Add to Google Calendar tapped for:', item.title);
              handleAddCalendar();
            }}
          >
            <FontAwesome name="calendar-plus-o" size={16} color="#fff" />
            <Text style={styles.calendarBtnText}>Add to Google Calendar</Text>
          </Pressable>
          
          {/* Share button moved to top beside calendar */}
          <Pressable
            style={styles.shareBtn}
            onPress={() => {
              trackBusinessAnalytics(item.id, 'share');
              Share.share({ message: `${item.title} — ${item.subtitle ?? ''}`.trim() });
            }}
          >
            <FontAwesome name="share" size={16} color="#111" />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>

        {!!item.tags?.length && (
          <View style={styles.tagsRow}>
            {item.tags.map((t) => (
              <View key={t} style={styles.tagChip}><Text style={styles.tagText}>{t}</Text></View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.description}>
          {item.description || 'No description available for this location.'}
        </Text>

        {/* Details Section - Always show if ANY detail exists */}
        <Text style={styles.sectionTitle}>Details</Text>
        
        {item.hours && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Hours:</Text>
            <Text style={styles.detailValue}>{item.hours}</Text>
          </View>
        )}
        
        {item.phone && (
          <Pressable 
            onPress={() => {
              trackBusinessAnalytics(item.id, 'call');
              Linking.openURL(`tel:${item.phone}`);
            }} 
            style={styles.detailRow}
          >
            <Text style={styles.detailLabel}>Phone:</Text>
            <Text style={[styles.detailValue, styles.link]}>{item.phone}</Text>
          </Pressable>
        )}
        
        {item.website && (
          <Pressable 
            onPress={() => {
              console.log('Website clicked:', item.website);
              trackBusinessAnalytics(item.id, 'website_click');
              Linking.openURL(ensureUrlHasProtocol(item.website!));
            }} 
            style={styles.detailRow}
          >
            <Text style={styles.detailLabel}>Website:</Text>
            <Text style={[styles.detailValue, styles.link]}>{getWebsiteDomain(item.website) ?? 'Visit site →'}</Text>
          </Pressable>
        )}
        
        {!item.hours && !item.phone && !item.website && (
          <Text style={{ color: '#999', fontSize: 14, marginTop: 8 }}>
            No additional details available
          </Text>
        )}

        <Text style={styles.sectionTitle}>Location</Text>
        <ListingMap latitude={item.latitude} longitude={item.longitude} />

        <Text style={styles.sectionTitle}>Get There</Text>
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: '#111', flex: 1 }]}
            onPress={() => {
              trackBusinessAnalytics(item.id, 'directions');
              Linking.openURL(`http://maps.apple.com/?daddr=${item.latitude},${item.longitude}`);
            }}
          >
            <Text style={[styles.actionText, { color: '#fff' }]}>Directions</Text>
          </Pressable>
        </View>
        
      </View>

      {/* List picker modal */}
      <Modal visible={showListPicker} transparent animationType="fade" onRequestClose={() => setShowListPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowListPicker(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Save to list</Text>
            {LIST_OPTIONS.map((list) => (
              <Pressable
                key={list.key}
                style={styles.modalOption}
                onPress={() => {
                  save(item, list.key);
                  setShowListPicker(false);
                }}
              >
                <Text style={styles.modalOptionText}>{list.label}</Text>
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
        onRequestClose={() => setShowIOSDateTime(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowIOSDateTime(false)}>
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
              <Pressable style={[styles.actionBtn, { backgroundColor: '#f2f2f2', flex: 1 }]} onPress={() => setShowIOSDateTime(false)}>
                <Text style={styles.actionText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: '#111', flex: 1 }]}
                onPress={() => {
                  const start = iosDate;
                  const end = new Date(start.getTime() + 60 * 60 * 1000);
                  setShowIOSDateTime(false);
                  openCalendarForRange(start, end);
                }}
              >
                <Text style={[styles.actionText, { color: '#fff' }]}>Add</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#666', marginTop: 4 },
  meta: { color: '#666', marginTop: 8 },
  featuredBadge: { backgroundColor: '#ffc107', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  featuredText: { fontSize: 11, fontWeight: '800', color: '#000' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 16, fontWeight: '700', color: '#111' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 16 },
  description: { marginTop: 6, lineHeight: 20 },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: '#111' },
  saveBtnSaved: { backgroundColor: '#111', borderColor: '#111' },
  saveText: { fontWeight: '700', color: '#111' },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#4CAF50',
  },
  calendarBtnText: { fontWeight: '700', color: '#fff' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  shareBtnText: { fontWeight: '700', color: '#111' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tagChip: { backgroundColor: '#f2f2f2', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  tagText: { fontWeight: '600', color: '#333' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: '#333', width: 80 },
  detailValue: { fontSize: 14, color: '#111', flex: 1 },
  link: { color: '#007AFF', textDecorationLine: 'underline' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 24 },
  actionBtn: { flex: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  actionText: { fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 320 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, textAlign: 'center' },
  modalOption: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalOptionText: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  eventDateSection: { 
    marginTop: 16, 
    padding: 16, 
    backgroundColor: '#f8f8f8', 
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  eventDateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventDateIcon: { fontSize: 24 },
  eventDateText: { fontSize: 16, fontWeight: '700', color: '#111' },
  eventStatusText: { fontSize: 14, fontWeight: '600', color: '#ff4458', marginTop: 4 },
  eventTimeUntil: { fontSize: 14, color: '#666', marginTop: 4 },
});


