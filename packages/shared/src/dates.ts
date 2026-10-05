// Calendar helpers. Meal dates are plain calendar dates ("2026-10-01") in India
// Standard Time; they are never converted through the device timezone, so a
// phone set to another zone still shows the right day. Formatting is done by hand
// (not Intl) so it is identical on every device and JS engine.

/** A calendar date as YYYY-MM-DD. */
export type ISODate = string;

export const IST_OFFSET_MINUTES = 330;

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;
export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const pad = (n: number) => String(n).padStart(2, '0');

function toUTCDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTCDate(date: Date): ISODate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The wall-clock time in India for a given instant. */
export function istParts(now: Date = new Date()) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return {
    date: fromUTCDate(shifted),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
}

export function todayIST(now: Date = new Date()): ISODate {
  return istParts(now).date;
}

/** The instant for an IST wall-clock date + "HH:MM[:SS]" time. */
export function istInstant(date: ISODate, time = '00:00'): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(toUTCDate(date).getTime() + (h * 60 + m - IST_OFFSET_MINUTES) * 60_000);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = toUTCDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUTCDate(date);
}

/** Days from a to b (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / 86_400_000);
}

/** ISO weekday: 1 = Monday ... 7 = Sunday (matches Postgres isodow). */
export function isoWeekday(iso: ISODate): number {
  const day = toUTCDate(iso).getUTCDay();
  return day === 0 ? 7 : day;
}

export function weekdayName(iso: ISODate): string {
  return WEEKDAY_NAMES[isoWeekday(iso) - 1];
}

export function weekdayShort(iso: ISODate): string {
  return WEEKDAY_SHORT[isoWeekday(iso) - 1];
}

export function dayOfMonth(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

export function monthName(iso: ISODate): string {
  return MONTH_NAMES[Number(iso.slice(5, 7)) - 1];
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}

/** "1 October" */
export function formatDayMonth(iso: ISODate): string {
  return `${dayOfMonth(iso)} ${monthName(iso)}`;
}

/** "Wednesday, 1 October" */
export function formatDateLong(iso: ISODate): string {
  return `${weekdayName(iso)}, ${formatDayMonth(iso)}`;
}

/** "Wed, 1 Oct" */
export function formatDateShort(iso: ISODate): string {
  return `${weekdayShort(iso)}, ${dayOfMonth(iso)} ${MONTH_SHORT[Number(iso.slice(5, 7)) - 1]}`;
}

/**
 * Human label relative to today: "Today", "Tomorrow", "Yesterday", or the
 * long date. Always unambiguous (never just a weekday name).
 */
export function relativeDayLabel(iso: ISODate, today: ISODate): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDateLong(iso);
}

/** "Tomorrow (Wednesday, 30 September)", or just the long date beyond yesterday/today/tomorrow. */
export function relativeDayWithDate(iso: ISODate, today: ISODate): string {
  const rel = relativeDayLabel(iso, today);
  const long = formatDateLong(iso);
  return rel === long ? long : `${rel} (${long})`;
}

/** "12:30 PM" from "12:30" or "12:30:00". */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(m)} ${suffix}`;
}

/** "12:30 – 1:00 PM", or "11:30 AM – 12:00 PM" when the meridiem changes. */
export function formatTimeWindow(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start) return null;
  if (!end) return formatTime(start);
  const a = formatTime(start);
  const b = formatTime(end);
  const sameMeridiem = a.slice(-2) === b.slice(-2);
  return sameMeridiem ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/** "Monday – Saturday", "Every day", "Monday, Wednesday and Friday". */
export function formatDeliveryDays(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return 'Every day';
  if (sorted.length === 0) return 'No delivery days';
  if (sorted.length === 1) return `${WEEKDAY_NAMES[sorted[0] - 1]}s only`;
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous && sorted.length > 2) {
    return `${WEEKDAY_NAMES[sorted[0] - 1]} – ${WEEKDAY_NAMES[sorted[sorted.length - 1] - 1]}`;
  }
  const names = sorted.map((d) => WEEKDAY_NAMES[d - 1]);
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Time-of-day greeting in IST. */
export function greeting(now: Date = new Date()): string {
  const { hours } = istParts(now);
  if (hours < 12) return 'Good morning';
  if (hours < 17) return 'Good afternoon';
  return 'Good evening';
}
