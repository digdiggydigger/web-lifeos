/** Local-time day arithmetic, the iOS `Calendar.current` calls used by the Tasks logic. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Whole calendar days from `from`'s day to `to`'s day (DST-safe: compares day starts, rounds). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

export function formatShortTime(date: Date, locale?: string): string {
  return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** `Fri 14 Aug` (locale-dependent order/punctuation), the iOS `.weekday(.abbreviated).day().month(.abbreviated)`. */
export function formatWeekdayDayMonth(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** `14 Aug 2026`-style, the iOS `.abbreviated` date style. */
export function formatAbbreviatedDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
