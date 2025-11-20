/**
 * Calendar integration utilities
 * Add events to user's native calendar (iOS/Android)
 */

import * as Calendar from 'expo-calendar';
import { Platform, Alert } from 'react-native';
import type { Listing } from '@/types/domain';

/**
 * Request calendar permissions
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Calendar Permission Required',
        'Please enable calendar access in your device settings to add events to your calendar.',
        [{ text: 'OK' }]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
    return false;
  }
}

/**
 * Get or create the Swipely calendar
 */
async function getSwipelyCalendar(): Promise<string | null> {
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    
    // Look for existing Swipely calendar
    const swipelyCalendar = calendars.find(cal => cal.title === 'Swipely Events');
    if (swipelyCalendar) {
      return swipelyCalendar.id;
    }

    // Create new calendar if it doesn't exist
    const defaultCalendar = calendars.find(
      cal => cal.allowsModifications && 
      (Platform.OS === 'ios' ? cal.source.name === 'Default' : cal.isPrimary)
    );

    if (!defaultCalendar) {
      // Fallback to first writable calendar
      const writableCalendar = calendars.find(cal => cal.allowsModifications);
      return writableCalendar?.id || null;
    }

    // On iOS, create new calendar
    if (Platform.OS === 'ios') {
      const newCalendarId = await Calendar.createCalendarAsync({
        title: 'Swipely Events',
        color: '#007AFF',
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: defaultCalendar.source.id,
        source: defaultCalendar.source,
        name: 'Swipely Events',
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
      return newCalendarId;
    }

    // On Android, use default calendar
    return defaultCalendar.id;
  } catch (error) {
    console.error('Error getting/creating calendar:', error);
    return null;
  }
}

/**
 * Add event to user's calendar
 */
export async function addEventToCalendar(listing: Listing): Promise<boolean> {
  // Check if this is an event
  if (!listing.event_start_date) {
    Alert.alert('Not an Event', 'Only events can be added to your calendar.');
    return false;
  }

  // Request permissions
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) return false;

  try {
    // Get calendar ID
    const calendarId = await getSwipelyCalendar();
    if (!calendarId) {
      Alert.alert('Error', 'Could not access calendar. Please check your calendar app.');
      return false;
    }

    // Parse dates
    const startDate = new Date(listing.event_start_date);
    const endDate = listing.event_end_date 
      ? new Date(listing.event_end_date)
      : new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours

    // Create calendar event
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: listing.title,
      startDate,
      endDate,
      location: listing.subtitle || `${listing.city}`,
      notes: listing.description || '',
      alarms: [
        { relativeOffset: -60 }, // 1 hour before
        { relativeOffset: -1440 }, // 1 day before
      ],
      url: listing.website,
    });

    if (eventId) {
      Alert.alert(
        '✅ Added to Calendar!',
        `"${listing.title}" has been added to your calendar with reminders.`,
        [{ text: 'OK' }]
      );
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('Error adding event to calendar:', error);
    Alert.alert(
      'Calendar Error',
      error.message || 'Could not add event to calendar. Please try again.'
    );
    return false;
  }
}

/**
 * Check if event is already in calendar (optional feature)
 */
export async function isEventInCalendar(listing: Listing): Promise<boolean> {
  if (!listing.event_start_date) return false;

  try {
    const hasPermission = await Calendar.getCalendarPermissionsAsync();
    if (hasPermission.status !== 'granted') return false;

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const swipelyCalendar = calendars.find(cal => cal.title === 'Swipely Events');
    
    if (!swipelyCalendar) return false;

    const startDate = new Date(listing.event_start_date);
    const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // Search window

    const events = await Calendar.getEventsAsync(
      [swipelyCalendar.id],
      startDate,
      endDate
    );

    return events.some(event => event.title === listing.title);
  } catch (error) {
    return false;
  }
}

/**
 * Create Google Calendar link (fallback for web or if expo-calendar not available)
 */
export function createGoogleCalendarLink(listing: Listing): string | null {
  if (!listing.event_start_date) return null;

  const startDate = new Date(listing.event_start_date);
  const endDate = listing.event_end_date 
    ? new Date(listing.event_end_date)
    : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  // Format dates for Google Calendar: YYYYMMDDTHHMMSSZ
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: listing.title,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    details: listing.description || '',
    location: listing.subtitle || `${listing.latitude},${listing.longitude}`,
  });

  if (listing.website) {
    params.append('sprop', `website:${listing.website}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

