/** The three `MomentumScoreboard` helpers the Tasks logic needs now; the full scoreboard is Phase 2. */
import { addDays, isSameDay, startOfDay } from '@/domain/time/calendar';
import type { Task } from '@/domain/types';

/** Consecutive days with at least one stamped closure, counted back from today if today has one, else from yesterday. */
export function streak(tasks: readonly Task[], now: Date): number {
  const days = new Set(
    tasks
      .filter((t) => t.status === 'done' && t.completedAt !== undefined)
      .map((t) => startOfDay(t.completedAt!).getTime()),
  );
  let cursor = startOfDay(now);
  if (!days.has(cursor.getTime())) cursor = addDays(cursor, -1);
  let count = 0;
  while (days.has(cursor.getTime())) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Done tasks stamped within the rolling seven days ending today (start of today − 6 days). */
export function closedThisWeek(tasks: readonly Task[], now: Date): Task[] {
  const windowStart = addDays(startOfDay(now), -6);
  return tasks.filter(
    (t) => t.status === 'done' && t.completedAt !== undefined && t.completedAt >= windowStart,
  );
}

export function closedToday(tasks: readonly Task[], now: Date): Task[] {
  return tasks.filter(
    (t) => t.status === 'done' && t.completedAt !== undefined && isSameDay(t.completedAt, now),
  );
}

/** `"15 min"`, rounding up and never below one minute; nothing when there is no duration. */
export function effortLabel(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
  return `${Math.max(1, Math.ceil(seconds / 60))} min`;
}
