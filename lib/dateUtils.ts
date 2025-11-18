/**
 * Date and time utilities for event listings
 */

/**
 * Format event date for display
 */
export function formatEventDate(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const now = new Date();
  
  // Check if event is today
  const isToday = start.toDateString() === now.toDateString();
  
  // Check if event is tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = start.toDateString() === tomorrow.toDateString();
  
  // Format date
  let dateStr = '';
  if (isToday) {
    dateStr = 'Today';
  } else if (isTomorrow) {
    dateStr = 'Tomorrow';
  } else {
    // Check if this year or next year
    const isThisYear = start.getFullYear() === now.getFullYear();
    dateStr = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: isThisYear ? undefined : 'numeric',
    });
  }
  
  // Format time
  const timeStr = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  
  return `${dateStr} at ${timeStr}`;
}

/**
 * Format event date range (for multi-day events)
 */
export function formatEventDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if same day
  const sameDay = start.toDateString() === end.toDateString();
  
  if (sameDay) {
    return formatEventDate(startDate);
  }
  
  // Multi-day event
  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  
  return `${startStr} - ${endStr}`;
}

/**
 * Check if event is happening soon (within next 24 hours)
 */
export function isEventSoon(startDate: string): boolean {
  const start = new Date(startDate);
  const now = new Date();
  const hoursUntil = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  return hoursUntil > 0 && hoursUntil <= 24;
}

/**
 * Check if event is in progress
 */
export function isEventInProgress(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  
  return now >= start && now <= end;
}

/**
 * Check if event has passed
 */
export function isEventPast(endDate: string): boolean {
  const end = new Date(endDate);
  const now = new Date();
  
  return now > end;
}

/**
 * Get relative time until event (e.g., "in 2 hours", "in 3 days")
 */
export function getTimeUntilEvent(startDate: string): string {
  const start = new Date(startDate);
  const now = new Date();
  const msUntil = start.getTime() - now.getTime();
  
  if (msUntil < 0) return 'Started';
  
  const minutesUntil = Math.floor(msUntil / (1000 * 60));
  const hoursUntil = Math.floor(msUntil / (1000 * 60 * 60));
  const daysUntil = Math.floor(msUntil / (1000 * 60 * 60 * 24));
  
  if (minutesUntil < 60) {
    return `in ${minutesUntil} min`;
  } else if (hoursUntil < 24) {
    return `in ${hoursUntil} hr${hoursUntil !== 1 ? 's' : ''}`;
  } else if (daysUntil < 7) {
    return `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`;
  } else {
    const weeksUntil = Math.floor(daysUntil / 7);
    return `in ${weeksUntil} week${weeksUntil !== 1 ? 's' : ''}`;
  }
}

