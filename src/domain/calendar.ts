const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface CalendarFields {
  month: number;
  day_of_month: number;
  hour: number;
  minute: number;
}

/**
 * Timestamps are UTC milliseconds in the bundle's nominal year (chosen so weekdays match the simulation).
 * UTC avoids daylight-saving gaps; the year itself is never displayed.
 */
export function stepTimestamp(fields: CalendarFields, nominalYear: number): number {
  return Date.UTC(nominalYear, fields.month - 1, fields.day_of_month, fields.hour, fields.minute);
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function formatClock(timestamp: number): string {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
