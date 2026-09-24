/** `FocusAnalytics`: day buckets over the history, the week that starts on Monday, and the rolling window. */
import { addDays, startOfDay } from '@/domain/time/calendar';
import type { CompletedFocusSession } from '@/domain/types';

export interface FocusDayBucket {
  readonly date: Date;
  readonly focusedSeconds: number;
  readonly sessionCount: number;
  readonly completedCount: number;
}

export function bucketFocusedMinutes(bucket: FocusDayBucket): number {
  return Math.floor(bucket.focusedSeconds / 60);
}

function buckets(
  start: Date,
  count: number,
  sessions: readonly CompletedFocusSession[],
): FocusDayBucket[] {
  const grouped = new Map<number, CompletedFocusSession[]>();
  for (const session of sessions) {
    const key = startOfDay(session.endedAt).getTime();
    grouped.set(key, [...(grouped.get(key) ?? []), session]);
  }
  return Array.from({ length: count }, (_, offset) => {
    const day = addDays(start, offset);
    const onDay = grouped.get(day.getTime()) ?? [];
    return {
      date: day,
      focusedSeconds: onDay.reduce((sum, s) => sum + Math.max(0, s.focusedSeconds), 0),
      sessionCount: onDay.length,
      completedCount: onDay.filter((s) => s.completedNaturally).length,
    };
  });
}

/** Monday through Sunday of the week holding `now`. */
export function currentFocusWeek(
  sessions: readonly CompletedFocusSession[],
  now: Date,
): FocusDayBucket[] {
  const today = startOfDay(now);
  const distanceToMonday = (today.getDay() + 6) % 7;
  return buckets(addDays(today, -distanceToMonday), 7, sessions);
}

export function rollingFocusDays(
  sessions: readonly CompletedFocusSession[],
  days: number,
  now: Date,
): FocusDayBucket[] {
  if (days <= 0) return [];
  return buckets(addDays(startOfDay(now), -(days - 1)), days, sessions);
}

export function totalFocusedSeconds(b: readonly FocusDayBucket[]): number {
  return b.reduce((sum, bucket) => sum + bucket.focusedSeconds, 0);
}

export function totalSessions(b: readonly FocusDayBucket[]): number {
  return b.reduce((sum, bucket) => sum + bucket.sessionCount, 0);
}

export function activeDayCount(b: readonly FocusDayBucket[]): number {
  return b.filter((bucket) => bucket.focusedSeconds > 0).length;
}

export function dailyAverageSeconds(b: readonly FocusDayBucket[]): number {
  return b.length === 0 ? 0 : Math.floor(totalFocusedSeconds(b) / b.length);
}

export function peakDay(b: readonly FocusDayBucket[]): FocusDayBucket | undefined {
  return b
    .filter((bucket) => bucket.focusedSeconds > 0)
    .reduce<FocusDayBucket | undefined>(
      (best, bucket) => (!best || bucket.focusedSeconds > best.focusedSeconds ? bucket : best),
      undefined,
    );
}

/** Consecutive active days back from today; an empty today does not break yesterday's run. */
export function focusCurrentStreak(b: readonly FocusDayBucket[]): number {
  let streak = 0;
  let isFirst = true;
  for (const bucket of [...b].reverse()) {
    if (bucket.focusedSeconds > 0) streak += 1;
    else if (!isFirst) break;
    isFirst = false;
  }
  return streak;
}

export function focusGoalProgress(b: readonly FocusDayBucket[], dailyGoalMinutes: number): number {
  if (dailyGoalMinutes <= 0 || b.length === 0) return 0;
  return Math.min(1, Math.max(0, totalFocusedSeconds(b) / (dailyGoalMinutes * 60 * b.length)));
}
