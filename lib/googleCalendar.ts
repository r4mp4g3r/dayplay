import { Linking, Alert } from 'react-native';

type CalendarUrlParams = {
  title: string;
  start: Date;
  end: Date;
  location?: string;
  details?: string;
};

/**
 * Format a Date to Google Calendar expected UTC format: YYYYMMDDTHHmmssZ
 */
function formatAsGoogleUtc(date: Date): string {
  // Use ISO string then strip separators and milliseconds
  // Example: 2025-11-20T18:30:00.000Z -> 20251120T183000Z
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function buildGoogleCalendarUrl(params: CalendarUrlParams): string {
  const { title, start, end, location, details } = params;
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const text = `&text=${encodeURIComponent(title || '')}`;
  const dates = `&dates=${formatAsGoogleUtc(start)}/${formatAsGoogleUtc(end)}`;
  const loc = location ? `&location=${encodeURIComponent(location)}` : '';
  const det = details ? `&details=${encodeURIComponent(details)}` : '';
  return `${base}${text}${dates}${loc}${det}`;
}

export async function openGoogleCalendar(params: CalendarUrlParams): Promise<boolean> {
  try {
    const url = buildGoogleCalendarUrl(params);
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Unable to open Google Calendar', 'Please install or configure a browser to continue.');
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('openGoogleCalendar error', error);
    Alert.alert('Error', 'Failed to open Google Calendar.');
    return false;
  }
}


