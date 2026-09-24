/** `Home/MomentumWeekCharts.swift`: the trailing seven days as bars. */
import { addDays, isSameDay, startOfDay } from '@/domain/time/calendar';
import type { CompletedFocusSession, Task } from '@/domain/types';

function trailingDays(now: Date): Date[] {
  const today = startOfDay(now);
  return [6, 5, 4, 3, 2, 1, 0].map((back) => addDays(today, -back));
}

export function closedPerDay(tasks: readonly Task[], now: Date): number[] {
  return trailingDays(now).map(
    (day) =>
      tasks.filter(
        (t) => t.status === 'done' && t.completedAt !== undefined && isSameDay(t.completedAt, day),
      ).length,
  );
}

export function focusMinutesPerDay(
  sessions: readonly CompletedFocusSession[],
  now: Date,
): number[] {
  return trailingDays(now).map((day) =>
    Math.floor(
      sessions
        .filter((s) => isSameDay(s.endedAt, day))
        .reduce((sum, s) => sum + s.focusedSeconds, 0) / 60,
    ),
  );
}

export function barFractions(counts: readonly number[]): number[] {
  const peak = Math.max(0, ...counts);
  if (peak <= 0) return counts.map(() => 0);
  return counts.map((c) => c / peak);
}

function weekSessions(
  sessions: readonly CompletedFocusSession[],
  now: Date,
): CompletedFocusSession[] {
  const windowStart = addDays(startOfDay(now), -6);
  return sessions.filter((s) => s.endedAt >= windowStart);
}

function shortWeekday(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { weekday: 'short' });
}

export function windowLabel(now: Date, locale?: string): string {
  const today = startOfDay(now);
  return `${shortWeekday(addDays(today, -6), locale)}–${shortWeekday(today, locale)}`;
}

export function closedCaption(
  sessions: readonly CompletedFocusSession[],
  now: Date,
  locale?: string,
): string {
  const minutes = Math.floor(
    weekSessions(sessions, now).reduce((sum, s) => sum + s.focusedSeconds, 0) / 60,
  );
  return `${windowLabel(now, locale)}, items closed. ${minutes} focus minutes logged.`;
}

export function focusCaption(
  sessions: readonly CompletedFocusSession[],
  now: Date,
): string | undefined {
  const week = weekSessions(sessions, now);
  const planned = week.reduce((sum, s) => sum + s.plannedSeconds, 0);
  if (planned <= 0) return undefined;
  const focused = week.reduce((sum, s) => sum + s.focusedSeconds, 0);
  return `${Math.floor(focused / 60)} minutes logged against ${Math.floor(planned / 60)} targeted.`;
}
